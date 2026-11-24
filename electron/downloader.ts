import { ChildProcess, spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getEnrichedEnv, resolveBinary } from './binaries';
import { computeTrackId, scanSingleFile } from './scanner';
import { Store } from './store';
import { Chapter, DownloadJob, EnqueueDownloadInput, VideoPreview } from './types';

interface InfoJsonShape {
  title?: string;
  artist?: string;
  uploader?: string;
  channel?: string;
  duration?: number;
  thumbnail?: string;
  webpage_url?: string;
  _type?: string;
  entries?: Array<{
    title?: string;
    uploader?: string;
    channel?: string;
    duration?: number;
    thumbnail?: string;
    chapters?: Array<{ title?: string; start_time?: number; end_time?: number }>;
  }>;
  chapters?: Array<{ title?: string; start_time?: number; end_time?: number }>;
}

function isValidHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export class DownloaderManager {
  private readonly store: Store;
  private readonly onJobsUpdated: (jobs: DownloadJob[]) => void;
  private readonly onLibraryUpdated: () => void;

  private jobs: DownloadJob[] = [];
  private activeProcesses = new Map<string, ChildProcess>();
  private cancelledJobIds = new Set<string>();
  private runningCount = 0;
  private readonly maxConcurrent = 2;

  constructor(
    store: Store,
    onJobsUpdated: (jobs: DownloadJob[]) => void,
    onLibraryUpdated: () => void,
  ) {
    this.store = store;
    this.onJobsUpdated = onJobsUpdated;
    this.onLibraryUpdated = onLibraryUpdated;
  }

  getJobs(): DownloadJob[] {
    return this.jobs.map((j) => ({ ...j }));
  }

  clearCompleted(): DownloadJob[] {
    this.jobs = this.jobs.filter(
      (j) => j.status === 'queued' || j.status === 'fetching' || j.status === 'downloading' || j.status === 'converting',
    );
    this.emitJobs();
    return this.getJobs();
  }

  readLinksFile(): string[] {
    const musicDir = this.store.getSettings().musicDir;
    const linksPath = path.join(musicDir, 'links.txt');
    if (!fs.existsSync(linksPath)) return [];
    try {
      const content = fs.readFileSync(linksPath, 'utf8');
      return content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith('#'));
    } catch {
      return [];
    }
  }

  async fetchInfo(url: string, noPlaylist: boolean): Promise<VideoPreview> {
    const trimmed = url.trim();
    if (!isValidHttpUrl(trimmed)) {
      throw new Error('URL tidak valid. Masukkan link HTTP/HTTPS YouTube yang benar.');
    }

    const ytdlp = resolveBinary('yt-dlp');
    if (!ytdlp) {
      throw new Error('Binary yt-dlp tidak ditemukan di ~/.local/bin atau PATH.');
    }

    const args = ['--dump-single-json', '--no-warnings', '--skip-download'];
    if (noPlaylist) {
      args.push('--no-playlist');
    }
    args.push(trimmed);

    const jsonText = await new Promise<string>((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      let settled = false;

      const child = spawn(ytdlp, args, {
        shell: false,
        env: getEnrichedEnv(),
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          try {
            child.kill('SIGTERM');
          } catch {
            // ignore
          }
          reject(new Error('Timeout mengambil info video dari YouTube.'));
        }
      }, 30000);

      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString('utf8');
      });
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf8');
      });
      child.on('error', (err) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(err);
        }
      });
      child.on('close', (code) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          if (code !== 0 || !stdout.trim()) {
            reject(new Error(stderr.trim() || `yt-dlp gagal mengambil info (exit ${code}).`));
            return;
          }
          resolve(stdout);
        }
      });
    });

    const parsed = JSON.parse(jsonText) as InfoJsonShape;
    const isPlaylistUrl = /[?&]list=/i.test(trimmed);

    if (parsed._type === 'playlist' && Array.isArray(parsed.entries) && parsed.entries.length > 0) {
      const totalDuration = parsed.entries.reduce((acc, e) => acc + (Number(e?.duration) || 0), 0);
      return {
        url: trimmed,
        title: `${parsed.title || 'Playlist'} (${parsed.entries.length} tracks)`,
        artist: parsed.entries[0]?.uploader || parsed.entries[0]?.channel || 'YouTube Playlist',
        duration: totalDuration,
        thumbnail: parsed.thumbnail || parsed.entries[0]?.thumbnail || null,
        chapterCount: 0,
        isPlaylistUrl,
      };
    }

    return {
      url: parsed.webpage_url || trimmed,
      title: parsed.title || 'Untitled Video',
      artist: parsed.artist || parsed.uploader || parsed.channel || 'YouTube',
      duration: Number(parsed.duration) || 0,
      thumbnail: parsed.thumbnail || null,
      chapterCount: Array.isArray(parsed.chapters) ? parsed.chapters.length : 0,
      isPlaylistUrl,
    };
  }

  enqueue(input: EnqueueDownloadInput): DownloadJob[] {
    const cleanUrls = input.urls
      .map((u) => u.trim())
      .filter((u) => u.length > 0 && isValidHttpUrl(u));

    if (cleanUrls.length === 0) {
      throw new Error('Tidak ada URL YouTube valid untuk di-download.');
    }

    const settings = this.store.getSettings();
    const created: DownloadJob[] = cleanUrls.map((url) => ({
      id: crypto.randomBytes(6).toString('hex'),
      url,
      title: url,
      thumbnail: null,
      format: input.format || settings.audioFormat,
      noPlaylist: input.noPlaylist,
      playlistId: input.playlistId || null,
      status: 'queued',
      progress: 0,
      speed: '',
      eta: '',
      error: null,
      outputTrackId: null,
      createdAt: Date.now(),
    }));

    this.jobs.unshift(...created);
    this.emitJobs();
    this.processQueue(input.quality || settings.audioQuality);
    return this.getJobs();
  }

  cancel(jobId: string): boolean {
    const job = this.jobs.find((j) => j.id === jobId);
    if (!job) return false;

    if (job.status === 'queued') {
      this.cancelledJobIds.add(jobId);
      job.status = 'cancelled';
      job.error = 'Dibatalkan oleh user';
      this.emitJobs();
      return true;
    }

    const proc = this.activeProcesses.get(jobId);
    if (proc) {
      this.cancelledJobIds.add(jobId);
      job.status = 'cancelled';
      job.error = 'Dibatalkan oleh user';
      this.emitJobs();
      try {
        proc.kill('SIGTERM');
      } catch {
        // ignore
      }
      setTimeout(() => {
        if (!proc.killed) {
          try {
            proc.kill('SIGKILL');
          } catch {
            // ignore
          }
        }
      }, 2000);
      return true;
    }

    return false;
  }

  private emitJobs(): void {
    this.onJobsUpdated(this.getJobs());
  }

  private processQueue(quality: string): void {
    while (this.runningCount < this.maxConcurrent) {
      const nextJob = [...this.jobs].reverse().find((j) => j.status === 'queued');
      if (!nextJob) break;
      this.runningCount += 1;
      void this.runJob(nextJob, quality).finally(() => {
        this.runningCount -= 1;
        this.processQueue(quality);
      });
    }
  }

  private async runJob(job: DownloadJob, quality: string): Promise<void> {
    const ytdlp = resolveBinary('yt-dlp');
    if (!ytdlp) {
      job.status = 'error';
      job.error = 'Binary yt-dlp tidak ditemukan.';
      this.emitJobs();
      return;
    }

    const ffmpegPath = resolveBinary('ffmpeg');
    const musicDir = this.store.getSettings().musicDir;
    fs.mkdirSync(musicDir, { recursive: true });

    job.status = 'fetching';
    job.progress = 0;
    this.emitJobs();

    const args: string[] = [
      '--newline',
      '--progress',
      '--no-simulate',
      '--extract-audio',
      '--audio-format',
      job.format,
      '--audio-quality',
      quality || '0',
      '--add-metadata',
      '--embed-chapters',
      '--write-info-json',
      '--write-thumbnail',
      '--convert-thumbnails',
      'jpg',
    ];

    if (job.format === 'mp3' || job.format === 'm4a') {
      args.push('--embed-thumbnail');
    }
    if (ffmpegPath) {
      args.push('--ffmpeg-location', path.dirname(ffmpegPath));
    }
    if (job.noPlaylist) {
      args.push('--no-playlist');
    }

    args.push(
      '-o',
      path.join(musicDir, '%(title).180B.%(ext)s'),
      '--print',
      'after_move:LOCALIFY_FILE:%(filepath)s',
      job.url,
    );

    const outputFiles: string[] = [];
    let lastErrorLine = '';

    const exitCode = await new Promise<number>((resolve) => {
      const child = spawn(ytdlp, args, {
        shell: false,
        env: getEnrichedEnv(),
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      this.activeProcesses.set(job.id, child);

      let stdoutBuf = '';
      let stderrBuf = '';

      const handleLine = (rawLine: string, isErrorStream: boolean) => {
        const line = rawLine.trim();
        if (!line) return;

        if (this.cancelledJobIds.has(job.id)) return;

        if (line.startsWith('LOCALIFY_FILE:')) {
          const outPath = line.slice('LOCALIFY_FILE:'.length).trim();
          if (outPath && !outputFiles.includes(outPath)) {
            outputFiles.push(outPath);
          }
          return;
        }

        const progressMatch =
          /\[download\]\s+(\d+(?:\.\d+)?)%\s+of\s+\S+(?:\s+at\s+(\S+))?(?:\s+ETA\s+(\S+))?/.exec(
            line,
          );
        if (progressMatch) {
          job.status = 'downloading';
          job.progress = Math.min(99, Math.max(0, Number.parseFloat(progressMatch[1]) || 0));
          job.speed = progressMatch[2] || '';
          job.eta = progressMatch[3] || '';
          this.emitJobs();
          return;
        }

        if (line.startsWith('[download] Destination:')) {
          const destPath = line.slice('[download] Destination:'.length).trim();
          const baseName = path.basename(destPath, path.extname(destPath));
          if (baseName && job.title === job.url) {
            job.title = baseName;
          }
          job.status = 'downloading';
          this.emitJobs();
          return;
        }

        if (
          line.startsWith('[ExtractAudio]') ||
          line.startsWith('[Metadata]') ||
          line.startsWith('[EmbedThumbnail]') ||
          line.startsWith('[ThumbnailsConvertor]')
        ) {
          job.status = 'converting';
          job.progress = 99;
          job.speed = '';
          job.eta = '';
          this.emitJobs();
          return;
        }

        if (isErrorStream && /ERROR:/i.test(line)) {
          lastErrorLine = line;
        }
      };

      const flushBuffer = (buf: string, isErrorStream: boolean): string => {
        const parts = buf.split(/[\r\n]+/);
        const remainder = parts.pop() || '';
        for (const p of parts) {
          handleLine(p, isErrorStream);
        }
        return remainder;
      };

      child.stdout.on('data', (chunk: Buffer) => {
        stdoutBuf = flushBuffer(stdoutBuf + chunk.toString('utf8'), false);
      });
      child.stderr.on('data', (chunk: Buffer) => {
        stderrBuf = flushBuffer(stderrBuf + chunk.toString('utf8'), true);
      });
      child.on('error', (err) => {
        lastErrorLine = err.message;
        resolve(-1);
      });
      child.on('close', (code) => {
        if (stdoutBuf.trim()) handleLine(stdoutBuf, false);
        if (stderrBuf.trim()) handleLine(stderrBuf, true);
        this.activeProcesses.delete(job.id);
        resolve(code ?? -1);
      });
    });

    if (this.cancelledJobIds.has(job.id)) {
      this.cancelledJobIds.delete(job.id);
      job.status = 'cancelled';
      this.emitJobs();
      return;
    }

    if (exitCode !== 0 || outputFiles.length === 0) {
      job.status = 'error';
      job.error = lastErrorLine || `Download gagal (exit code ${exitCode}).`;
      this.emitJobs();
      return;
    }

    let lastTrackId: string | null = null;
    for (const filePath of outputFiles) {
      if (!fs.existsSync(filePath)) continue;

      const ext = path.extname(filePath);
      const basePath = ext ? filePath.slice(0, -ext.length) : filePath;
      const infoJsonPath = `${basePath}.info.json`;

      let info: InfoJsonShape | null = null;
      if (fs.existsSync(infoJsonPath)) {
        try {
          info = JSON.parse(fs.readFileSync(infoJsonPath, 'utf8')) as InfoJsonShape;
        } catch {
          info = null;
        }
      }

      const trackId = computeTrackId(filePath);
      let importedCoverPath: string | null = null;

      for (const thumbExt of ['.jpg', '.jpeg', '.webp', '.png']) {
        const candidateThumb = `${basePath}${thumbExt}`;
        if (fs.existsSync(candidateThumb)) {
          if (!importedCoverPath) {
            const destExt = thumbExt === '.jpeg' ? '.jpg' : thumbExt;
            const destCover = path.join(this.store.getCoversDir(), `${trackId}${destExt}`);
            try {
              fs.copyFileSync(candidateThumb, destCover);
              importedCoverPath = destCover;
            } catch {
              importedCoverPath = null;
            }
          }
          try {
            fs.unlinkSync(candidateThumb);
          } catch {
            // ignore sidecar cleanup errors
          }
        }
      }

      if (fs.existsSync(infoJsonPath)) {
        try {
          fs.unlinkSync(infoJsonPath);
        } catch {
          // ignore
        }
      }

      const chapters: Chapter[] = Array.isArray(info?.chapters)
        ? info.chapters.map((c, idx) => ({
            title: c.title || `Chapter ${idx + 1}`,
            startTime: Number(c.start_time) || 0,
            endTime: Number(c.end_time) || 0,
          }))
        : [];

      const track = await scanSingleFile(filePath, this.store, {
        title: info?.title,
        artist: info?.artist || info?.uploader || info?.channel,
        sourceUrl: info?.webpage_url || job.url,
        chapters,
        coverPath: importedCoverPath,
      });

      if (track) {
        lastTrackId = track.id;
        job.title = track.title;
        if (info?.thumbnail) {
          job.thumbnail = info.thumbnail;
        }
        if (job.playlistId) {
          this.store.addTrackToPlaylist(job.playlistId, track.id);
        }
      }
    }

    job.outputTrackId = lastTrackId;
    job.status = 'done';
    job.progress = 100;
    job.speed = '';
    job.eta = '';
    this.emitJobs();
    this.onLibraryUpdated();
  }
}
