import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { AppSettings, Playlist, Track, TrackPatch } from './types';

export const DEFAULT_SETTINGS: AppSettings = {
  musicDir: path.join(os.homedir(), 'Music'),
  audioFormat: 'mp3',
  audioQuality: '0',
  noPlaylistByDefault: true,
  volume: 0.85,
  shuffle: false,
  repeat: 'off',
  resumeThresholdSeconds: 600,
};

function atomicWriteJson(filePath: string, data: unknown): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmpPath, filePath);
}

function safeReadJson<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw.trim()) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export class Store {
  private readonly dataDir: string;
  private readonly coversDir: string;
  private readonly libraryPath: string;
  private readonly playlistsPath: string;
  private readonly settingsPath: string;

  private tracks: Track[] = [];
  private trackMap = new Map<string, Track>();
  private playlists: Playlist[] = [];
  private settings: AppSettings;

  constructor(dataDir: string) {
    this.dataDir = path.resolve(dataDir);
    this.coversDir = path.join(this.dataDir, 'covers');
    this.libraryPath = path.join(this.dataDir, 'library.json');
    this.playlistsPath = path.join(this.dataDir, 'playlists.json');
    this.settingsPath = path.join(this.dataDir, 'settings.json');

    fs.mkdirSync(this.dataDir, { recursive: true });
    fs.mkdirSync(this.coversDir, { recursive: true });

    const loadedTracks = safeReadJson<Track[]>(this.libraryPath, []);
    this.tracks = Array.isArray(loadedTracks) ? loadedTracks : [];
    this.rebuildTrackMap();

    const loadedPlaylists = safeReadJson<Playlist[]>(this.playlistsPath, []);
    this.playlists = Array.isArray(loadedPlaylists) ? loadedPlaylists : [];

    const loadedSettings = safeReadJson<Partial<AppSettings>>(this.settingsPath, {});
    this.settings = { ...DEFAULT_SETTINGS, ...loadedSettings };
    if (!this.settings.musicDir) {
      this.settings.musicDir = DEFAULT_SETTINGS.musicDir;
    }
  }

  private rebuildTrackMap(): void {
    this.trackMap.clear();
    for (const track of this.tracks) {
      this.trackMap.set(track.id, track);
    }
  }

  private saveLibrary(): void {
    atomicWriteJson(this.libraryPath, this.tracks);
  }

  private savePlaylists(): void {
    atomicWriteJson(this.playlistsPath, this.playlists);
  }

  private saveSettings(): void {
    atomicWriteJson(this.settingsPath, this.settings);
  }

  getDataDir(): string {
    return this.dataDir;
  }

  getCoversDir(): string {
    return this.coversDir;
  }

  getTracks(): Track[] {
    return [...this.tracks];
  }

  getTrack(id: string): Track | undefined {
    return this.trackMap.get(id);
  }

  getTrackByPath(filePath: string): Track | undefined {
    const resolved = path.resolve(filePath);
    return this.tracks.find((t) => path.resolve(t.filePath) === resolved);
  }

  setTracks(tracks: Track[]): void {
    this.tracks = [...tracks];
    this.rebuildTrackMap();
    this.saveLibrary();

    const validIds = new Set(this.tracks.map((t) => t.id));
    let playlistsChanged = false;
    for (const pl of this.playlists) {
      const filtered = pl.trackIds.filter((id) => validIds.has(id));
      if (filtered.length !== pl.trackIds.length) {
        pl.trackIds = filtered;
        pl.updatedAt = Date.now();
        playlistsChanged = true;
      }
    }
    if (playlistsChanged) {
      this.savePlaylists();
    }
  }

  upsertTrack(track: Track): Track {
    const idx = this.tracks.findIndex((t) => t.id === track.id);
    if (idx >= 0) {
      this.tracks[idx] = track;
    } else {
      this.tracks.unshift(track);
    }
    this.trackMap.set(track.id, track);
    this.saveLibrary();
    return track;
  }

  updateTrack(id: string, patch: TrackPatch): Track | null {
    const existing = this.trackMap.get(id);
    if (!existing) return null;

    const updated: Track = {
      ...existing,
      ...patch,
    };
    const idx = this.tracks.findIndex((t) => t.id === id);
    if (idx >= 0) {
      this.tracks[idx] = updated;
    }
    this.trackMap.set(id, updated);
    this.saveLibrary();
    return updated;
  }

  deleteTrackRecord(id: string): Track | null {
    const existing = this.trackMap.get(id);
    if (!existing) return null;

    this.tracks = this.tracks.filter((t) => t.id !== id);
    this.trackMap.delete(id);
    this.saveLibrary();

    let playlistsChanged = false;
    for (const pl of this.playlists) {
      if (pl.trackIds.includes(id)) {
        pl.trackIds = pl.trackIds.filter((tid) => tid !== id);
        pl.updatedAt = Date.now();
        playlistsChanged = true;
      }
    }
    if (playlistsChanged) {
      this.savePlaylists();
    }

    if (existing.coverPath && existing.coverPath.startsWith(this.coversDir)) {
      try {
        if (fs.existsSync(existing.coverPath)) {
          fs.unlinkSync(existing.coverPath);
        }
      } catch {
        // ignore cleanup failure
      }
    }

    return existing;
  }

  getPlaylists(): Playlist[] {
    return this.playlists.map((pl) => ({ ...pl, trackIds: [...pl.trackIds] }));
  }

  getPlaylist(id: string): Playlist | undefined {
    const pl = this.playlists.find((p) => p.id === id);
    return pl ? { ...pl, trackIds: [...pl.trackIds] } : undefined;
  }

  createPlaylist(name: string, description = ''): Playlist {
    const now = Date.now();
    const playlist: Playlist = {
      id: crypto.randomBytes(6).toString('hex'),
      name: name.trim() || 'Untitled Playlist',
      description: description.trim(),
      trackIds: [],
      createdAt: now,
      updatedAt: now,
    };
    this.playlists.push(playlist);
    this.savePlaylists();
    return { ...playlist };
  }

  updatePlaylist(id: string, patch: { name?: string; description?: string }): Playlist | null {
    const pl = this.playlists.find((p) => p.id === id);
    if (!pl) return null;
    if (typeof patch.name === 'string' && patch.name.trim()) {
      pl.name = patch.name.trim();
    }
    if (typeof patch.description === 'string') {
      pl.description = patch.description.trim();
    }
    pl.updatedAt = Date.now();
    this.savePlaylists();
    return { ...pl, trackIds: [...pl.trackIds] };
  }

  deletePlaylist(id: string): boolean {
    const before = this.playlists.length;
    this.playlists = this.playlists.filter((p) => p.id !== id);
    if (this.playlists.length === before) return false;
    this.savePlaylists();
    return true;
  }

  addTrackToPlaylist(playlistId: string, trackId: string): Playlist | null {
    const pl = this.playlists.find((p) => p.id === playlistId);
    if (!pl || !this.trackMap.has(trackId)) return null;
    if (!pl.trackIds.includes(trackId)) {
      pl.trackIds.push(trackId);
      pl.updatedAt = Date.now();
      this.savePlaylists();
    }
    return { ...pl, trackIds: [...pl.trackIds] };
  }

  removeTrackFromPlaylist(playlistId: string, trackId: string): Playlist | null {
    const pl = this.playlists.find((p) => p.id === playlistId);
    if (!pl) return null;
    const filtered = pl.trackIds.filter((id) => id !== trackId);
    if (filtered.length !== pl.trackIds.length) {
      pl.trackIds = filtered;
      pl.updatedAt = Date.now();
      this.savePlaylists();
    }
    return { ...pl, trackIds: [...pl.trackIds] };
  }

  getSettings(): AppSettings {
    return { ...this.settings };
  }

  updateSettings(patch: Partial<AppSettings>): AppSettings {
    this.settings = {
      ...this.settings,
      ...patch,
    };
    this.saveSettings();
    return { ...this.settings };
  }
}
