import { contextBridge, ipcRenderer } from 'electron';
import { AppSettings, DownloadJob, EnqueueDownloadInput, Track, TrackPatch } from './types';

function subscribe<T>(channel: string, callback: (payload: T) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, data: T) => {
    callback(data);
  };
  ipcRenderer.on(channel, listener);
  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
}

const api = {
  library: {
    getAll: () => ipcRenderer.invoke('library:getAll'),
    rescan: () => ipcRenderer.invoke('library:rescan'),
    updateTrack: (id: string, patch: TrackPatch) => ipcRenderer.invoke('library:updateTrack', id, patch),
    deleteTrack: (id: string, deleteFile = false) =>
      ipcRenderer.invoke('library:deleteTrack', id, deleteFile),
    onUpdated: (callback: (tracks: Track[]) => void) => subscribe<Track[]>('library:updated', callback),
  },
  playlists: {
    getAll: () => ipcRenderer.invoke('playlists:getAll'),
    create: (name: string, description?: string) =>
      ipcRenderer.invoke('playlists:create', name, description),
    update: (id: string, patch: { name?: string; description?: string }) =>
      ipcRenderer.invoke('playlists:update', id, patch),
    delete: (id: string) => ipcRenderer.invoke('playlists:delete', id),
    addTrack: (playlistId: string, trackId: string) =>
      ipcRenderer.invoke('playlists:addTrack', playlistId, trackId),
    removeTrack: (playlistId: string, trackId: string) =>
      ipcRenderer.invoke('playlists:removeTrack', playlistId, trackId),
  },
  downloader: {
    getJobs: () => ipcRenderer.invoke('downloader:getJobs'),
    fetchInfo: (url: string, noPlaylist: boolean) =>
      ipcRenderer.invoke('downloader:fetchInfo', url, noPlaylist),
    enqueue: (input: EnqueueDownloadInput) => ipcRenderer.invoke('downloader:enqueue', input),
    cancel: (jobId: string) => ipcRenderer.invoke('downloader:cancel', jobId),
    clearCompleted: () => ipcRenderer.invoke('downloader:clearCompleted'),
    readLinksFile: () => ipcRenderer.invoke('downloader:readLinksFile'),
    onJobsUpdated: (callback: (jobs: DownloadJob[]) => void) =>
      subscribe<DownloadJob[]>('downloader:jobsUpdated', callback),
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    update: (patch: Partial<AppSettings>) => ipcRenderer.invoke('settings:update', patch),
    chooseFolder: () => ipcRenderer.invoke('settings:chooseFolder'),
  },
  system: {
    getDiagnostics: () => ipcRenderer.invoke('system:getDiagnostics'),
    revealInFolder: (filePath: string) => ipcRenderer.invoke('system:revealInFolder', filePath),
  },
};

contextBridge.exposeInMainWorld('localify', api);
