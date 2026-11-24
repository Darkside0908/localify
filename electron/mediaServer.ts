import crypto from 'crypto';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { Store } from './store';

const AUDIO_MIME_TYPES: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.opus': 'audio/opus',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac',
  '.wav': 'audio/wav',
  '.webm': 'audio/webm',
};

const IMAGE_MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

export class MediaServer {
  private readonly store: Store;
  private readonly token: string;
  private server: http.Server | null = null;
  private port = 0;

  constructor(store: Store) {
    this.store = store;
    this.token = crypto.randomBytes(12).toString('hex');
  }

  start(): Promise<number> {
    if (this.server && this.port > 0) {
      return Promise.resolve(this.port);
    }

    return new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      server.on('error', reject);
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (!addr || typeof addr === 'string') {
          reject(new Error('Failed to bind media server'));
          return;
        }
        this.server = server;
        this.port = addr.port;
        resolve(this.port);
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.server) {
        resolve();
        return;
      }
      const srv = this.server;
      this.server = null;
      this.port = 0;
      srv.close(() => resolve());
    });
  }

  getPort(): number {
    return this.port;
  }

  getToken(): string {
    return this.token;
  }

  getAudioUrl(trackId: string): string {
    return `http://127.0.0.1:${this.port}/media/${this.token}/${trackId}`;
  }

  getCoverUrl(trackId: string): string {
    return `http://127.0.0.1:${this.port}/cover/${this.token}/${trackId}`;
  }

  private setCorsHeaders(res: http.ServerResponse): void {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length');
  }

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    this.setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405);
      res.end('Method Not Allowed');
      return;
    }

    const urlPath = (req.url || '/').split('?')[0];
    const parts = urlPath.split('/').filter(Boolean);
    if (parts.length !== 3) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }

    const [kind, token, trackId] = parts;
    if (token !== this.token) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    const track = this.store.getTrack(trackId);
    if (!track) {
      res.writeHead(404);
      res.end('Track Not Found');
      return;
    }

    if (kind === 'cover') {
      this.serveCover(track.coverPath, req.method, res);
      return;
    }

    if (kind === 'media') {
      this.serveMedia(track.filePath, req, res);
      return;
    }

    res.writeHead(404);
    res.end('Not Found');
  }

  private serveCover(coverPath: string | null, method: string, res: http.ServerResponse): void {
    if (!coverPath || !fs.existsSync(coverPath)) {
      res.writeHead(404);
      res.end('Cover Not Found');
      return;
    }

    let stat: fs.Stats;
    try {
      stat = fs.statSync(coverPath);
    } catch {
      res.writeHead(404);
      res.end('Cover Not Found');
      return;
    }

    const ext = path.extname(coverPath).toLowerCase();
    const mime = IMAGE_MIME_TYPES[ext] || 'image/jpeg';

    res.writeHead(200, {
      'Content-Type': mime,
      'Content-Length': stat.size,
      'Cache-Control': 'public, max-age=86400',
    });

    if (method === 'HEAD') {
      res.end();
      return;
    }

    const stream = fs.createReadStream(coverPath);
    res.on('close', () => stream.destroy());
    stream.on('error', () => {
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
    stream.pipe(res);
  }

  private serveMedia(filePath: string, req: http.IncomingMessage, res: http.ServerResponse): void {
    if (!fs.existsSync(filePath)) {
      res.writeHead(404);
      res.end('File Not Found');
      return;
    }

    let stat: fs.Stats;
    try {
      stat = fs.statSync(filePath);
    } catch {
      res.writeHead(404);
      res.end('File Not Found');
      return;
    }

    const totalSize = stat.size;
    const ext = path.extname(filePath).toLowerCase();
    const mime = AUDIO_MIME_TYPES[ext] || 'application/octet-stream';
    const rangeHeader = req.headers.range;

    if (rangeHeader) {
      const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
      if (!match) {
        res.writeHead(416, { 'Content-Range': `bytes */${totalSize}` });
        res.end();
        return;
      }

      const rawStart = match[1];
      const rawEnd = match[2];

      let start: number;
      let end: number;

      if (rawStart === '' && rawEnd === '') {
        res.writeHead(416, { 'Content-Range': `bytes */${totalSize}` });
        res.end();
        return;
      } else if (rawStart === '') {
        const suffix = Number.parseInt(rawEnd, 10);
        if (Number.isNaN(suffix) || suffix <= 0) {
          res.writeHead(416, { 'Content-Range': `bytes */${totalSize}` });
          res.end();
          return;
        }
        start = Math.max(0, totalSize - suffix);
        end = totalSize - 1;
      } else {
        start = Number.parseInt(rawStart, 10);
        end = rawEnd === '' ? totalSize - 1 : Number.parseInt(rawEnd, 10);
      }

      if (Number.isNaN(start) || Number.isNaN(end) || start >= totalSize || end >= totalSize || start > end) {
        res.writeHead(416, { 'Content-Range': `bytes */${totalSize}` });
        res.end();
        return;
      }

      const chunkSize = end - start + 1;
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${totalSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': mime,
      });

      if (req.method === 'HEAD') {
        res.end();
        return;
      }

      const stream = fs.createReadStream(filePath, { start, end });
      const destroyStream = () => {
        if (!stream.destroyed) stream.destroy();
      };
      res.on('close', destroyStream);
      req.on('aborted', destroyStream);
      stream.on('error', () => {
        destroyStream();
        if (!res.headersSent) res.writeHead(500);
        res.end();
      });
      stream.pipe(res);
      return;
    }

    res.writeHead(200, {
      'Accept-Ranges': 'bytes',
      'Content-Length': totalSize,
      'Content-Type': mime,
    });

    if (req.method === 'HEAD') {
      res.end();
      return;
    }

    const stream = fs.createReadStream(filePath);
    const destroyStream = () => {
      if (!stream.destroyed) stream.destroy();
    };
    res.on('close', destroyStream);
    req.on('aborted', destroyStream);
    stream.on('error', () => {
      destroyStream();
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
    stream.pipe(res);
  }
}
