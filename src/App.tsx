import { useCallback, useEffect, useMemo, useState } from 'react';
import { CreatePlaylistModal } from './components/CreatePlaylistModal';
import { DownloaderView } from './components/DownloaderView';
import { LibraryView } from './components/LibraryView';
import { PlayerBar } from './components/PlayerBar';
import { PlaylistView } from './components/PlaylistView';
import { RightPanel } from './components/RightPanel';
import { SettingsModal } from './components/SettingsModal';
import { ActiveNav, Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { useAudioPlayer } from './hooks/useAudioPlayer';
import { AppSettings, DownloadJob, Playlist, Track, TrackPatch } from './types';

const DEFAULT_SETTINGS: AppSettings = {
  musicDir: '',
  audioFormat: 'mp3',
  audioQuality: '0',
  noPlaylistByDefault: true,
  volume: 0.85,
  shuffle: false,
  repeat: 'off',
  resumeThresholdSeconds: 600,
};

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 2];

export function App() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [jobs, setJobs] = useState<DownloadJob[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [activeNav, setActiveNav] = useState<ActiveNav>({ type: 'library' });
  const [searchQuery, setSearchQuery] = useState('');
  const [isRescanning, setIsRescanning] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [createPlaylistOpen, setCreatePlaylistOpen] = useState(false);

  const handleTrackUpdatedLocal = useCallback((updated: Track) => {
    setTracks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  }, []);

  const handleSettingsPatch = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
    if (window.localify) {
      void window.localify.settings.update(patch).catch(() => {
        // ignore background persist error
      });
    }
  }, []);

  const player = useAudioPlayer({
    tracks,
    settings,
    onTrackUpdated: handleTrackUpdatedLocal,
    onSettingsUpdated: handleSettingsPatch,
  });

  useEffect(() => {
    if (!window.localify) return;

    void Promise.all([
      window.localify.library.getAll(),
      window.localify.playlists.getAll(),
      window.localify.settings.get(),
      window.localify.downloader.getJobs(),
    ]).then(([loadedTracks, loadedPlaylists, loadedSettings, loadedJobs]) => {
      setTracks(loadedTracks);
      setPlaylists(loadedPlaylists);
      setSettings(loadedSettings);
      setJobs(loadedJobs);
    });

    const unsubLib = window.localify.library.onUpdated((updatedTracks) => {
      setTracks(updatedTracks);
      void window.localify.playlists.getAll().then(setPlaylists);
    });

    const unsubJobs = window.localify.downloader.onJobsUpdated((updatedJobs) => {
      setJobs(updatedJobs);
    });

    return () => {
      unsubLib();
      unsubJobs();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        setActiveNav({ type: 'downloader' });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleRescan = async () => {
    if (!window.localify) return;
    setIsRescanning(true);
    try {
      const updated = await window.localify.library.rescan();
      setTracks(updated);
      const updatedPlaylists = await window.localify.playlists.getAll();
      setPlaylists(updatedPlaylists);
    } finally {
      setIsRescanning(false);
    }
  };

  const handleToggleLike = async (track: Track) => {
    const updated = await window.localify.library.updateTrack(track.id, { liked: !track.liked });
    if (updated) {
      handleTrackUpdatedLocal(updated);
    }
  };

  const handleUpdateTrack = async (id: string, patch: TrackPatch) => {
    const updated = await window.localify.library.updateTrack(id, patch);
    if (updated) {
      handleTrackUpdatedLocal(updated);
    }
  };

  const handleDeleteTrack = async (id: string, deleteFile: boolean) => {
    const ok = await window.localify.library.deleteTrack(id, deleteFile);
    if (ok) {
      setTracks((prev) => prev.filter((t) => t.id !== id));
      const updatedPlaylists = await window.localify.playlists.getAll();
      setPlaylists(updatedPlaylists);
    }
  };

  const handleCreatePlaylist = async (name: string, description: string) => {
    const created = await window.localify.playlists.create(name, description);
    setPlaylists((prev) => [...prev, created]);
    setActiveNav({ type: 'playlist', playlistId: created.id });
  };

  const handleRenamePlaylist = async (id: string, name: string, description: string) => {
    const updated = await window.localify.playlists.update(id, { name, description });
    if (updated) {
      setPlaylists((prev) => prev.map((p) => (p.id === id ? updated : p)));
    }
  };

  const handleDeletePlaylist = async (id: string) => {
    const ok = await window.localify.playlists.delete(id);
    if (ok) {
      setPlaylists((prev) => prev.filter((p) => p.id !== id));
      setActiveNav({ type: 'library' });
    }
  };

  const handleAddToPlaylist = async (playlistId: string, trackId: string) => {
    const updated = await window.localify.playlists.addTrack(playlistId, trackId);
    if (updated) {
      setPlaylists((prev) => prev.map((p) => (p.id === playlistId ? updated : p)));
    }
  };

  const handleRemoveFromPlaylist = async (playlistId: string, trackId: string) => {
    const updated = await window.localify.playlists.removeTrack(playlistId, trackId);
    if (updated) {
      setPlaylists((prev) => prev.map((p) => (p.id === playlistId ? updated : p)));
    }
  };

  const handleSaveSettings = async (patch: Partial<AppSettings>) => {
    const updated = await window.localify.settings.update(patch);
    setSettings(updated);
    const refreshed = await window.localify.library.getAll();
    setTracks(refreshed);
  };

  const handlePlayTrackById = (trackId: string) => {
    const found = tracks.find((t) => t.id === trackId);
    if (found) {
      player.playTrack(found, tracks);
    }
  };

  const handleCyclePlaybackRate = () => {
    const idx = SPEED_OPTIONS.indexOf(player.playbackRate);
    const next = SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length];
    player.setPlaybackRate(next);
  };

  const likedCount = useMemo(() => tracks.filter((t) => t.liked).length, [tracks]);
  const activeDownloadCount = useMemo(
    () =>
      jobs.filter(
        (j) =>
          j.status === 'queued' ||
          j.status === 'fetching' ||
          j.status === 'downloading' ||
          j.status === 'converting',
      ).length,
    [jobs],
  );

  const selectedPlaylist =
    activeNav.type === 'playlist'
      ? playlists.find((p) => p.id === activeNav.playlistId)
      : undefined;

  return (
    <div className="flex h-screen w-screen flex-col bg-[#0F0F10] text-[#EDEDED]">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar
          activeNav={activeNav}
          onSelectNav={setActiveNav}
          playlists={playlists}
          likedCount={likedCount}
          totalCount={tracks.length}
          activeDownloadCount={activeDownloadCount}
          onOpenCreatePlaylist={() => setCreatePlaylistOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        {/* Main Workspace */}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[#141415]">
          <TopBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onOpenDownloader={() => setActiveNav({ type: 'downloader' })}
            onRescan={handleRescan}
            isRescanning={isRescanning}
            isDownloaderActive={activeNav.type === 'downloader'}
          />

          <div className="min-h-0 flex-1 overflow-y-auto px-6">
            <div className="mx-auto max-w-[1440px]">
              {activeNav.type === 'library' && (
                <LibraryView
                  tracks={tracks}
                  searchQuery={searchQuery}
                  currentTrackId={player.currentTrack?.id ?? null}
                  isPlaying={player.isPlaying}
                  playlists={playlists}
                  onPlayTrack={player.playTrack}
                  onToggleLike={handleToggleLike}
                  onAddToQueue={player.addToQueue}
                  onAddToPlaylist={handleAddToPlaylist}
                  onUpdateTrack={handleUpdateTrack}
                  onDeleteTrack={handleDeleteTrack}
                  onRevealInFolder={(fp) => void window.localify.system.revealInFolder(fp)}
                  onOpenDownloader={() => setActiveNav({ type: 'downloader' })}
                />
              )}

              {activeNav.type === 'downloader' && (
                <DownloaderView
                  jobs={jobs}
                  playlists={playlists}
                  tracks={tracks}
                  defaultFormat={settings.audioFormat}
                  defaultNoPlaylist={settings.noPlaylistByDefault}
                  onPlayTrackById={handlePlayTrackById}
                />
              )}

              {activeNav.type === 'liked' && (
                <PlaylistView
                  mode="liked"
                  allTracks={tracks}
                  allPlaylists={playlists}
                  searchQuery={searchQuery}
                  currentTrackId={player.currentTrack?.id ?? null}
                  isPlaying={player.isPlaying}
                  onPlayTrack={player.playTrack}
                  onToggleLike={handleToggleLike}
                  onAddToQueue={player.addToQueue}
                  onAddToPlaylist={handleAddToPlaylist}
                  onUpdateTrack={handleUpdateTrack}
                  onDeleteTrack={handleDeleteTrack}
                  onRevealInFolder={(fp) => void window.localify.system.revealInFolder(fp)}
                />
              )}

              {activeNav.type === 'playlist' && selectedPlaylist && (
                <PlaylistView
                  mode="playlist"
                  playlist={selectedPlaylist}
                  allTracks={tracks}
                  allPlaylists={playlists}
                  searchQuery={searchQuery}
                  currentTrackId={player.currentTrack?.id ?? null}
                  isPlaying={player.isPlaying}
                  onPlayTrack={player.playTrack}
                  onToggleLike={handleToggleLike}
                  onAddToQueue={player.addToQueue}
                  onAddToPlaylist={handleAddToPlaylist}
                  onRemoveFromPlaylist={handleRemoveFromPlaylist}
                  onRenamePlaylist={handleRenamePlaylist}
                  onDeletePlaylist={handleDeletePlaylist}
                  onUpdateTrack={handleUpdateTrack}
                  onDeleteTrack={handleDeleteTrack}
                  onRevealInFolder={(fp) => void window.localify.system.revealInFolder(fp)}
                />
              )}
            </div>
          </div>
        </main>

        {rightPanelOpen && (
          <RightPanel
            currentTrack={player.currentTrack}
            currentTime={player.currentTime}
            queue={player.queue}
            queueIndex={player.queueIndex}
            onSeek={player.seek}
            onJumpToQueueIndex={player.jumpToQueueIndex}
            onRemoveFromQueue={player.removeFromQueue}
            onClearUpNext={player.clearUpNext}
            onClose={() => setRightPanelOpen(false)}
          />
        )}
      </div>

      <PlayerBar
        currentTrack={player.currentTrack}
        isPlaying={player.isPlaying}
        currentTime={player.currentTime}
        duration={player.duration}
        volume={player.volume}
        muted={player.muted}
        playbackRate={player.playbackRate}
        shuffle={player.shuffle}
        repeat={player.repeat}
        resumedFrom={player.resumedFrom}
        playError={player.playError}
        rightPanelOpen={rightPanelOpen}
        onTogglePlayPause={player.togglePlayPause}
        onPrev={player.playPrev}
        onNext={() => player.playNext(false)}
        onSeek={player.seek}
        onVolumeChange={player.setVolume}
        onToggleMute={player.toggleMute}
        onCyclePlaybackRate={handleCyclePlaybackRate}
        onToggleShuffle={player.toggleShuffle}
        onCycleRepeat={player.cycleRepeat}
        onToggleLike={handleToggleLike}
        onToggleRightPanel={() => setRightPanelOpen((o) => !o)}
        onDismissResumed={player.dismissResumedBanner}
      />

      {settingsOpen && (
        <SettingsModal
          settings={settings}
          onSave={handleSaveSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {createPlaylistOpen && (
        <CreatePlaylistModal
          onCreate={handleCreatePlaylist}
          onClose={() => setCreatePlaylistOpen(false)}
        />
      )}
    </div>
  );
}

export default App;
