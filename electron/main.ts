import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import fs from 'fs';
import path from 'path';
import { getDiagnostics } from './binaries';
import { DownloaderManager } from './downloader';
import { MediaServer } from './mediaServer';
import { scanDirectory } from './scanner';
import { Store } from './store';
import { AppSettings, EnqueueDownloadInput, Track, TrackPatch } from './types';

const isSmokeTest = process.argv.includes('--smoke-test');
const screenshotFlagIdx = process.argv.indexOf('--screenshot');
const screenshotOutPath =
  screenshotFlagIdx >= 0 && process.argv[screenshotFlagIdx + 1]
    ? path.resolve(process.argv[screenshotFlagIdx + 1])
    : null;
const isHeadlessRun = isSmokeTest || Boolean(screenshotOutPath);

let mainWindow: BrowserWindow | null = null;
let store: Store;
let mediaServer: MediaServer;
let downloader: DownloaderManager;

function hydrateTrack(track: Track): Track {
  return {
    ...track,
    audioUrl: mediaServer.getAudioUrl(track.id),
    coverUrl: track.coverPath ? mediaServer.getCoverUrl(track.id) : null,
  };
}

function hydrateTracks(tracks: Track[]): Track[] {
  return tracks.map(hydrateTrack);
}

function broadcastLibrary(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('library:updated', hydrateTracks(store.getTracks()));
  }
}

function registerIpcHandlers(): void {
  ipcMain.handle('library:getAll', async () => {
    const cached = store.getTracks();
    if (cached.length === 0) {
      const scanned = await scanDirectory(store.getSettings().musicDir, store);
      return hydrateTracks(scanned);
    }
    return hydrateTracks(cached);
  });

  ipcMain.handle('library:rescan', async () => {
    const scanned = await scanDirectory(store.getSettings().musicDir, store);
    const hydrated = hydrateTracks(scanned);
    broadcastLibrary();
    return hydrated;
  });

  ipcMain.handle('library:updateTrack', (_event, id: string, patch: TrackPatch) => {
    const updated = store.updateTrack(id, patch);
    return updated ? hydrateTrack(updated) : null;
  });

  ipcMain.handle('library:deleteTrack', (_event, id: string, deleteFile = false) => {
    const removed = store.deleteTrackRecord(id);
    if (!removed) return false;
    if (deleteFile && fs.existsSync(removed.filePath)) {
      try {
        fs.unlinkSync(removed.filePath);
      } catch {
        // ignore delete failure
      }
    }
    broadcastLibrary();
    return true;
  });

  ipcMain.handle('playlists:getAll', () => store.getPlaylists());
  ipcMain.handle('playlists:create', (_event, name: string, description?: string) =>
    store.createPlaylist(name, description),
  );
  ipcMain.handle(
    'playlists:update',
    (_event, id: string, patch: { name?: string; description?: string }) =>
      store.updatePlaylist(id, patch),
  );
  ipcMain.handle('playlists:delete', (_event, id: string) => store.deletePlaylist(id));
  ipcMain.handle('playlists:addTrack', (_event, playlistId: string, trackId: string) =>
    store.addTrackToPlaylist(playlistId, trackId),
  );
  ipcMain.handle('playlists:removeTrack', (_event, playlistId: string, trackId: string) =>
    store.removeTrackFromPlaylist(playlistId, trackId),
  );

  ipcMain.handle('downloader:getJobs', () => downloader.getJobs());
  ipcMain.handle('downloader:fetchInfo', (_event, url: string, noPlaylist: boolean) =>
    downloader.fetchInfo(url, noPlaylist),
  );
  ipcMain.handle('downloader:enqueue', (_event, input: EnqueueDownloadInput) =>
    downloader.enqueue(input),
  );
  ipcMain.handle('downloader:cancel', (_event, jobId: string) => downloader.cancel(jobId));
  ipcMain.handle('downloader:clearCompleted', () => downloader.clearCompleted());
  ipcMain.handle('downloader:readLinksFile', () => downloader.readLinksFile());

  ipcMain.handle('settings:get', () => store.getSettings());
  ipcMain.handle('settings:update', async (_event, patch: Partial<AppSettings>) => {
    const prevDir = store.getSettings().musicDir;
    const updated = store.updateSettings(patch);
    if (patch.musicDir && patch.musicDir !== prevDir) {
      await scanDirectory(updated.musicDir, store);
      broadcastLibrary();
    }
    return updated;
  });
  ipcMain.handle('settings:chooseFolder', async () => {
    const targetWindow = mainWindow ?? undefined;
    const result = targetWindow
      ? await dialog.showOpenDialog(targetWindow, {
          properties: ['openDirectory'],
          defaultPath: store.getSettings().musicDir,
        })
      : await dialog.showOpenDialog({
          properties: ['openDirectory'],
          defaultPath: store.getSettings().musicDir,
        });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('system:getDiagnostics', () =>
    getDiagnostics(store.getSettings().musicDir, store.getDataDir()),
  );
  ipcMain.handle('system:revealInFolder', (_event, filePath: string) => {
    if (!fs.existsSync(filePath)) return false;
    shell.showItemInFolder(filePath);
    return true;
  });
}

async function createWindow(): Promise<void> {
  const iconPath = path.resolve(__dirname, '..', 'assets', 'icon.svg');

  mainWindow = new BrowserWindow({
    width: 1320,
    height: 840,
    minWidth: 960,
    minHeight: 620,
    show: !isHeadlessRun,
    backgroundColor: '#0F0F10',
    autoHideMenuBar: true,
    title: 'Localify',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    await mainWindow.loadURL(devServerUrl);
  } else {
    const distHtml = path.resolve(__dirname, '..', 'dist', 'index.html');
    await mainWindow.loadFile(distHtml);
  }

  if (isSmokeTest || screenshotOutPath) {
    try {
      const result = await mainWindow.webContents.executeJavaScript(`
        (async () => {
          const waitForRender = async () => {
            for (let i = 0; i < 40; i++) {
              const root = document.getElementById('root');
              if (root && root.children.length > 0 && window.localify) break;
              await new Promise(r => setTimeout(r, 100));
            }
          };
          await waitForRender();
          await new Promise(r => setTimeout(r, 250));
          if (!window.localify) throw new Error('window.localify missing');
          const tracks = await window.localify.library.getAll();
          const root = document.getElementById('root');
          return {
            rendered: Boolean(root && root.innerText.trim().length > 0),
            trackCount: Array.isArray(tracks) ? tracks.length : -1,
            firstTitle: tracks?.[0]?.title || null,
          };
        })()
      `);
      if (!result?.rendered || result.trackCount < 1) {
        console.error('SMOKE_TEST_FAILED', JSON.stringify(result));
        await mediaServer.stop();
        app.exit(1);
        return;
      }
      if (screenshotOutPath) {
        const image = await mainWindow.webContents.capturePage();
        fs.mkdirSync(path.dirname(screenshotOutPath), { recursive: true });
        fs.writeFileSync(screenshotOutPath, image.toPNG());
        console.log(`SCREENSHOT_OK:${screenshotOutPath}`);
      } else {
        console.log(`SMOKE_TEST_OK:${result.trackCount}`);
      }
      await mediaServer.stop();
      app.exit(0);
    } catch (err) {
      console.error('SMOKE_TEST_ERROR', err);
      await mediaServer.stop();
      app.exit(1);
    }
  }
}

app.whenReady().then(async () => {
  store = new Store(app.getPath('userData'));
  mediaServer = new MediaServer(store);
  await mediaServer.start();

  downloader = new DownloaderManager(
    store,
    (jobs) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('downloader:jobsUpdated', jobs);
      }
    },
    () => {
      broadcastLibrary();
    },
  );

  registerIpcHandlers();
  await scanDirectory(store.getSettings().musicDir, store);
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on('before-quit', () => {
  if (mediaServer) {
    void mediaServer.stop();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
