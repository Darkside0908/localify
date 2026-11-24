import { spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getEnrichedEnv, resolveBinary } from './binaries';
import { Store } from './store';
import { Chapter, Track } from './types';

export const AUDIO_EXTENSIONS = new Set([
  '.mp3',
  '.m4a',
  '.opus',
  '.ogg',
  '.flac',
  '.wav',
  '.webm',
  '.aac',
]);

const IGNORED_DIRS = new Set([
  'localify',
  'node_modules',
  '.git',
  'dist',
  'dist-electron',
]);

export function computeTrackId(filePath: string): string {
  return crypto.createHash('sha1').update(path.resolve(filePath)).digest('hex').slice(0, 16);
}

function cleanTitleFromFilename(filename: string): string {
  const ext = path.extname(filename);
  const base = ext ? filename.slice(0, -ext.length) : filename;
  return base.replace(/[_]+/g, ' ').trim() || filename;
}

function getTag(tags: Record<string, unknown> | undefined, ...keys: string[]): string | null {
  if (!tags) return null;
  const lowered = new Map<string, string>();
  for (const [k, v] of Object.entries(tags)) {
    if (typeof v === 'string' && v.trim()) {
      lowered.set(k.toLowerCase(), v.trim());
    }
  }
  for (const key of keys) {
    const found = lowered.get(key.toLowerCase());
    if (found) return found;
  }
  return null;
}

interface ProbeStream {
  codec_type?: string;
  codec_name?: string;
  bit_rate?: string;
  disposition?: {
    attached_pic?: number;
  };
}

interface ProbeChapter {
  start_time?: string;
  end_time?: string;
  tags?: Record<string, unknown>;
}

interface ProbeOutput {
  format?: {
    duration?: string;
    bit_rate?: string;
    tags?: Record<string, unknown>;
  };
  streams?: ProbeStream[];
  chapters?: ProbeChapter[];
}

function runCommandQuiet(binPath: string, args: string[], timeoutMs = 15000): Promise<{ code: number; stdout: string }> {
  return new Promise((resolve) => {
    let stdout = '';
    let done = false;
    const child = spawn(binPath, args, {
      shell: false,
      env: getEnrichedEnv(),
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        try {
          child.kill('SIGTERM');
        } catch {
          // ignore
        }
        resolve({ code: -1, stdout });
      }
    }, timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.on('error', () => {
      if (!done) {
        done = true;
        clearTimeout(timer);
        resolve({ code: -1, stdout });
      }
    });
    child.on('close', (code) => {
      if (!done) {
        done = true;
        clearTimeout(timer);
        resolve({ code: code ?? -1, stdout });
      }
    });
  });
}

async function probeFile(filePath: string, ffprobePath: string | null): Promise<ProbeOutput | null> {
  if (!ffprobePath) return null;
  const { code, stdout } = await runCommandQuiet(ffprobePath, [
    '-v',
    'quiet',
    '-print_format',
    'json',
    '-show_format',
    '-show_streams',
    '-show_chapters',
    filePath,
  ]);
  if (code !== 0 || !stdout.trim()) return null;
  try {
    return JSON.parse(stdout) as ProbeOutput;
  } catch {
    return null;
  }
}

async function extractEmbeddedCover(
  filePath: string,
  coverDest: string,
  ffmpegPath: string | null,
): Promise<string | null> {
  if (!ffmpegPath) return null;
  const { code } = await runCommandQuiet(ffmpegPath, [
    '-y',
    '-i',
    filePath,
    '-an',
    '-vcodec',
    'mjpeg',
    '-frames:v',
    '1',
    coverDest,
  ]);
  if (code === 0 && fs.existsSync(coverDest)) {
    try {
      if (fs.statSync(coverDest).size > 0) {
        return coverDest;
      }
    } catch {
      return null;
    }
  }
  return null;
}

function collectAudioFiles(dir: string, depth: number, maxDepth: number, out: string[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      if (depth < maxDepth) {
        collectAudioFiles(fullPath, depth + 1, maxDepth, out);
      }
      continue;
    }

    if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (AUDIO_EXTENSIONS.has(ext)) {
        out.push(path.resolve(fullPath));
      }
    }
  }
}

export interface ScanOverrides {
  title?: string;
  artist?: string;
  album?: string;
  sourceUrl?: string | null;
  chapters?: Chapter[];
  coverPath?: string | null;
}

export async function scanSingleFile(
  filePath: string,
  store: Store,
  overrides?: ScanOverrides,
): Promise<Track | null> {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) return null;

  let stat: fs.Stats;
  try {
    stat = fs.statSync(resolved);
  } catch {
    return null;
  }
  if (!stat.isFile()) return null;

  const id = computeTrackId(resolved);
  const existing = store.getTrack(id);
  const filename = path.basename(resolved);
  const ext = path.extname(filename).toLowerCase().replace('.', '') || 'audio';

  const existingCoverValid =
    existing?.coverPath && fs.existsSync(existing.coverPath) ? existing.coverPath : null;

  if (
    existing &&
    !overrides &&
    existing.filePath === resolved &&
    existing.mtimeMs === stat.mtimeMs &&
    existing.size === stat.size
  ) {
    if (existing.coverPath !== existingCoverValid) {
      const fixed = { ...existing, coverPath: existingCoverValid };
      store.upsertTrack(fixed);
      return fixed;
    }
    return existing;
  }

  const ffprobePath = resolveBinary('ffprobe');
  const ffmpegPath = resolveBinary('ffmpeg');
  const probe = await probeFile(resolved, ffprobePath);

  const formatTags = probe?.format?.tags;
  const audioStream = probe?.streams?.find((s) => s.codec_type === 'audio');
  const hasEmbeddedPic = Boolean(
    probe?.streams?.some(
      (s) =>
        s.disposition?.attached_pic === 1 ||
        (s.codec_type === 'video' &&
          ['mjpeg', 'png', 'webp', 'bmp'].includes((s.codec_name || '').toLowerCase())),
    ),
  );

  const duration = Number(probe?.format?.duration) || existing?.duration || 0;
  const rawBitrate = Number(probe?.format?.bit_rate) || Number(audioStream?.bit_rate) || 0;
  const bitrate = rawBitrate > 0 ? Math.round(rawBitrate / 1000) : existing?.bitrate || 0;

  let chapters: Chapter[] = [];
  if (overrides?.chapters && overrides.chapters.length > 0) {
    chapters = overrides.chapters;
  } else if (Array.isArray(probe?.chapters) && probe.chapters.length > 0) {
    chapters = probe.chapters
      .map((c, idx) => ({
        title: getTag(c.tags, 'title') || `Chapter ${idx + 1}`,
        startTime: Number(c.start_time) || 0,
        endTime: Number(c.end_time) || 0,
      }))
      .filter((c) => c.endTime > c.startTime || c.startTime >= 0);
  } else if (existing?.chapters && existing.chapters.length > 0) {
    chapters = existing.chapters;
  }

  let coverPath: string | null = overrides?.coverPath || existingCoverValid || null;
  if (!coverPath && hasEmbeddedPic) {
    const coverDest = path.join(store.getCoversDir(), `${id}.jpg`);
    coverPath = await extractEmbeddedCover(resolved, coverDest, ffmpegPath);
  }

  const probedTitle = getTag(formatTags, 'title');
  const probedArtist = getTag(formatTags, 'artist', 'album_artist', 'uploader', 'channel');
  const probedAlbum = getTag(formatTags, 'album');
  const probedSourceUrl = getTag(formatTags, 'purl', 'comment');

  const track: Track = {
    id,
    filePath: resolved,
    filename,
    title: overrides?.title || probedTitle || cleanTitleFromFilename(filename),
    artist: overrides?.artist || probedArtist || 'Unknown Artist',
    album: overrides?.album || probedAlbum || 'Local Library',
    duration,
    size: stat.size,
    format: ext,
    bitrate,
    addedAt: existing?.addedAt || stat.birthtimeMs || stat.mtimeMs || Date.now(),
    mtimeMs: stat.mtimeMs,
    coverPath,
    sourceUrl:
      overrides?.sourceUrl ??
      existing?.sourceUrl ??
      (probedSourceUrl && /^https?:\/\//i.test(probedSourceUrl) ? probedSourceUrl : null),
    chapters,
    lastPosition: existing?.lastPosition || 0,
    playCount: existing?.playCount || 0,
    lastPlayedAt: existing?.lastPlayedAt ?? null,
    liked: existing?.liked || false,
  };

  if (overrides) {
    store.upsertTrack(track);
  }

  return track;
}

export async function scanDirectory(musicDir: string, store: Store): Promise<Track[]> {
  const resolvedRoot = path.resolve(musicDir);
  if (!fs.existsSync(resolvedRoot)) {
    store.setTracks([]);
    return [];
  }

  const audioFiles: string[] = [];
  collectAudioFiles(resolvedRoot, 0, 2, audioFiles);

  const scanned: Track[] = [];
  for (const filePath of audioFiles) {
    const track = await scanSingleFile(filePath, store);
    if (track) {
      scanned.push(track);
    }
  }

  scanned.sort((a, b) => b.addedAt - a.addedAt);
  store.setTracks(scanned);
  return scanned;
}
