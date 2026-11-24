export interface Chapter {
  title: string;
  startTime: number;
  endTime: number;
}

export interface Track {
  id: string;
  filePath: string;
  filename: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  size: number;
  format: string;
  bitrate: number;
  addedAt: number;
  mtimeMs: number;
  coverPath: string | null;
  sourceUrl: string | null;
  chapters: Chapter[];
  lastPosition: number;
  playCount: number;
  lastPlayedAt: number | null;
  liked: boolean;
  audioUrl?: string;
  coverUrl?: string | null;
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  trackIds: string[];
  createdAt: number;
  updatedAt: number;
}

export type AudioFormat = 'mp3' | 'm4a' | 'opus';
export type RepeatMode = 'off' | 'all' | 'one';

export interface AppSettings {
  musicDir: string;
  audioFormat: AudioFormat;
  audioQuality: string;
  noPlaylistByDefault: boolean;
  volume: number;
  shuffle: boolean;
  repeat: RepeatMode;
  resumeThresholdSeconds: number;
}

export type DownloadStatus =
  | 'queued'
  | 'fetching'
  | 'downloading'
  | 'converting'
  | 'done'
  | 'error'
  | 'cancelled';

export interface DownloadJob {
  id: string;
  url: string;
  title: string;
  thumbnail: string | null;
  format: AudioFormat;
  noPlaylist: boolean;
  playlistId: string | null;
  status: DownloadStatus;
  progress: number;
  speed: string;
  eta: string;
  error: string | null;
  outputTrackId: string | null;
  createdAt: number;
}

export interface VideoPreview {
  url: string;
  title: string;
  artist: string;
  duration: number;
  thumbnail: string | null;
  chapterCount: number;
  isPlaylistUrl: boolean;
}

export interface BinaryStatus {
  found: boolean;
  path: string | null;
  version: string | null;
}

export interface SystemDiagnostics {
  ytdlp: BinaryStatus;
  ffmpeg: BinaryStatus;
  ffprobe: BinaryStatus;
  musicDir: string;
  dataDir: string;
}

export interface EnqueueDownloadInput {
  urls: string[];
  format: AudioFormat;
  quality?: string;
  noPlaylist: boolean;
  playlistId: string | null;
}

export type TrackPatch = Partial<
  Pick<Track, 'title' | 'artist' | 'album' | 'liked' | 'lastPosition' | 'playCount' | 'lastPlayedAt'>
>;

export interface LocalifyAPI {
  library: {
    getAll: () => Promise<Track[]>;
    rescan: () => Promise<Track[]>;
    updateTrack: (id: string, patch: TrackPatch) => Promise<Track | null>;
    deleteTrack: (id: string, deleteFile?: boolean) => Promise<boolean>;
    onUpdated: (callback: (tracks: Track[]) => void) => () => void;
  };
  playlists: {
    getAll: () => Promise<Playlist[]>;
    create: (name: string, description?: string) => Promise<Playlist>;
    update: (id: string, patch: { name?: string; description?: string }) => Promise<Playlist | null>;
    delete: (id: string) => Promise<boolean>;
    addTrack: (playlistId: string, trackId: string) => Promise<Playlist | null>;
    removeTrack: (playlistId: string, trackId: string) => Promise<Playlist | null>;
  };
  downloader: {
    getJobs: () => Promise<DownloadJob[]>;
    fetchInfo: (url: string, noPlaylist: boolean) => Promise<VideoPreview>;
    enqueue: (input: EnqueueDownloadInput) => Promise<DownloadJob[]>;
    cancel: (jobId: string) => Promise<boolean>;
    clearCompleted: () => Promise<DownloadJob[]>;
    readLinksFile: () => Promise<string[]>;
    onJobsUpdated: (callback: (jobs: DownloadJob[]) => void) => () => void;
  };
  settings: {
    get: () => Promise<AppSettings>;
    update: (patch: Partial<AppSettings>) => Promise<AppSettings>;
    chooseFolder: () => Promise<string | null>;
  };
  system: {
    getDiagnostics: () => Promise<SystemDiagnostics>;
    revealInFolder: (filePath: string) => Promise<boolean>;
  };
}

declare global {
  interface Window {
    localify: LocalifyAPI;
  }
}
