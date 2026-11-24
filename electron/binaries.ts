import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { BinaryStatus, SystemDiagnostics } from './types';

export type BinaryName = 'yt-dlp' | 'ffmpeg' | 'ffprobe';

export function getEnrichedEnv(): NodeJS.ProcessEnv {
  const localBin = path.join(os.homedir(), '.local', 'bin');
  const existingPath = process.env.PATH || '';
  const extraDirs = [localBin, '/usr/local/bin', '/usr/bin', '/bin'];
  const parts = existingPath.split(path.delimiter).filter(Boolean);
  const merged = [...extraDirs, ...parts].filter((dir, idx, arr) => arr.indexOf(dir) === idx);

  return {
    ...process.env,
    PATH: merged.join(path.delimiter),
  };
}

function isExecutable(filePath: string): boolean {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return false;
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export function resolveBinary(name: BinaryName): string | null {
  const localCandidate = path.join(os.homedir(), '.local', 'bin', name);
  if (isExecutable(localCandidate)) {
    return localCandidate;
  }

  const env = getEnrichedEnv();
  const dirs = (env.PATH || '').split(path.delimiter).filter(Boolean);
  for (const dir of dirs) {
    const candidate = path.join(dir, name);
    if (isExecutable(candidate)) {
      return candidate;
    }
  }
  return null;
}

function readBinaryVersion(binPath: string, args: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    let output = '';
    let settled = false;
    const child = spawn(binPath, args, {
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
        resolve(null);
      }
    }, 4000);

    child.stdout.on('data', (chunk: Buffer) => {
      output += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      output += chunk.toString('utf8');
    });
    child.on('error', () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(null);
      }
    });
    child.on('close', (code) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        if (code !== 0 && !output.trim()) {
          resolve(null);
          return;
        }
        const firstLine = output
          .split(/\r?\n/)
          .map((line) => line.trim())
          .find(Boolean);
        resolve(firstLine || null);
      }
    });
  });
}

async function checkBinary(name: BinaryName, versionArgs: string[]): Promise<BinaryStatus> {
  const binPath = resolveBinary(name);
  if (!binPath) {
    return { found: false, path: null, version: null };
  }
  const version = await readBinaryVersion(binPath, versionArgs);
  return { found: true, path: binPath, version };
}

export async function getDiagnostics(musicDir: string, dataDir: string): Promise<SystemDiagnostics> {
  const [ytdlp, ffmpeg, ffprobe] = await Promise.all([
    checkBinary('yt-dlp', ['--version']),
    checkBinary('ffmpeg', ['-version']),
    checkBinary('ffprobe', ['-version']),
  ]);

  return {
    ytdlp,
    ffmpeg,
    ffprobe,
    musicDir,
    dataDir,
  };
}
