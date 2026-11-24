import { Play, Shuffle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Playlist, Track, TrackPatch } from '../types';
import { formatBytes, formatDuration, formatTotalListeningTime } from '../utils/format';
import { TrackCover } from './TrackCover';
import { TrackList } from './TrackList';

type LibraryFilter = 'all' | 'sets' | 'liked';
type SortKey = 'recent' | 'title' | 'duration' | 'plays';

interface LibraryViewProps {
  tracks: Track[];
  searchQuery: string;
  currentTrackId: string | null;
  isPlaying: boolean;
  playlists: Playlist[];
  onPlayTrack: (track: Track, list?: Track[]) => void;
  onToggleLike: (track: Track) => void;
  onAddToQueue: (track: Track) => void;
  onAddToPlaylist: (playlistId: string, trackId: string) => void;
  onUpdateTrack: (id: string, patch: TrackPatch) => Promise<void>;
  onDeleteTrack: (id: string, deleteFile: boolean) => Promise<void>;
  onRevealInFolder: (filePath: string) => void;
  onOpenDownloader: () => void;
}

export function LibraryView({
  tracks,
  searchQuery,
  currentTrackId,
  isPlaying,
  playlists,
  onPlayTrack,
  onToggleLike,
  onAddToQueue,
  onAddToPlaylist,
  onUpdateTrack,
  onDeleteTrack,
  onRevealInFolder,
  onOpenDownloader,
}: LibraryViewProps) {
  const [filter, setFilter] = useState<LibraryFilter>('all');
  const [sortBy, setSortBy] = useState<SortKey>('recent');

  const totalDuration = useMemo(
    () => tracks.reduce((sum, t) => sum + (t.duration || 0), 0),
    [tracks],
  );
  const totalSize = useMemo(() => tracks.reduce((sum, t) => sum + (t.size || 0), 0), [tracks]);

  const continueListening = useMemo(
    () =>
      tracks
        .filter((t) => t.lastPosition > 5 && t.duration > 0 && t.lastPosition < t.duration - 15)
        .sort((a, b) => (b.lastPlayedAt || 0) - (a.lastPlayedAt || 0))
        .slice(0, 4),
    [tracks],
  );

  const visibleTracks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = tracks.filter((t) => {
      if (filter === 'sets' && t.duration < 1200) return false;
      if (filter === 'liked' && !t.liked) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        t.album.toLowerCase().includes(q) ||
        t.filename.toLowerCase().includes(q)
      );
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      if (sortBy === 'duration') return b.duration - a.duration;
      if (sortBy === 'plays') return (b.playCount || 0) - (a.playCount || 0);
      return b.addedAt - a.addedAt;
    });
  }, [tracks, filter, sortBy, searchQuery]);

  const handlePlayAll = () => {
    if (visibleTracks.length > 0) {
      onPlayTrack(visibleTracks[0], visibleTracks);
    }
  };

  const handleShufflePlay = () => {
    if (visibleTracks.length > 0) {
      const randomIdx = Math.floor(Math.random() * visibleTracks.length);
      onPlayTrack(visibleTracks[randomIdx], visibleTracks);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Calm Page Header */}
      <section className="flex flex-col justify-between gap-4 border-b border-white/[0.08] pt-6 pb-6 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-[28px] leading-[1.15] font-medium tracking-[-0.02em] text-[#EDEDED]">
            Library
          </h1>
          <p className="mt-2 font-mono tabular-nums text-xs text-[#A1A1A6]">
            {tracks.length} {tracks.length === 1 ? 'track' : 'tracks'} ·{' '}
            {formatTotalListeningTime(totalDuration)} · {formatBytes(totalSize)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePlayAll}
            disabled={visibleTracks.length === 0}
            className="flex h-9 items-center gap-2 rounded-lg bg-[#EDEDED] px-4 text-sm font-medium text-[#0F0F10] transition-colors duration-150 hover:bg-white active:scale-[0.98] disabled:opacity-40"
          >
            <Play size={16} strokeWidth={1.5} className="fill-[#0F0F10]" />
            <span>Play</span>
          </button>

          <button
            type="button"
            onClick={handleShufflePlay}
            disabled={visibleTracks.length === 0}
            className="flex h-9 items-center gap-2 rounded-lg border border-white/[0.08] bg-[#232325] px-4 text-sm font-medium text-[#EDEDED] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-colors duration-150 hover:bg-[#2B2B2E] active:scale-[0.98] disabled:opacity-40"
          >
            <Shuffle size={16} strokeWidth={1.5} className="text-[#A1A1A6]" />
            <span>Shuffle</span>
          </button>
        </div>
      </section>

      {/* Continue listening (only when partially played tracks exist) */}
      {continueListening.length > 0 && !searchQuery && (
        <section>
          <h2 className="mb-3 text-sm font-medium text-[#A1A1A6]">Continue listening</h2>
          <div
            className={`grid gap-3 ${
              continueListening.length === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'
            }`}
          >
            {continueListening.map((track) => {
              const pct = Math.min(100, Math.round((track.lastPosition / track.duration) * 100));
              return (
                <button
                  key={track.id}
                  type="button"
                  onClick={() => onPlayTrack(track, tracks)}
                  className="group flex items-center gap-3 rounded-xl border border-white/[0.08] bg-[#19191B] p-4 text-left transition-colors duration-150 hover:bg-[#232325]"
                >
                  <TrackCover track={track} sizeClass="h-12 w-12" radiusClass="rounded-md" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-[#EDEDED]">{track.title}</div>
                    <div className="mt-1 truncate text-xs text-[#A1A1A6]">{track.artist}</div>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="h-[2px] flex-1 overflow-hidden rounded-full bg-white/[0.1]">
                        <div
                          className="h-full bg-[#E0A23B]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="font-mono tabular-nums text-xs text-[#A1A1A6]">
                        {formatDuration(track.lastPosition)} / {formatDuration(track.duration)}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Filter & Sort Controls */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-white/[0.08] bg-[#19191B] p-1">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'sets', label: 'Live sets' },
                { id: 'liked', label: 'Liked' },
              ] as const
            ).map((pill) => (
              <button
                key={pill.id}
                type="button"
                onClick={() => setFilter(pill.id)}
                className={`h-7 rounded px-3 text-xs font-medium transition-colors duration-150 ${
                  filter === pill.id
                    ? 'bg-[#232325] text-[#EDEDED] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                    : 'text-[#A1A1A6] hover:text-[#EDEDED]'
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-[#85858B]">Sort</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="h-8 rounded-lg border border-white/[0.08] bg-[#19191B] px-3 text-xs font-medium text-[#EDEDED] focus:border-white/[0.2] focus:outline-none"
            >
              <option value="recent">Recently added</option>
              <option value="title">Title</option>
              <option value="duration">Duration</option>
              <option value="plays">Most played</option>
            </select>
          </div>
        </div>

        {tracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-white/[0.08] bg-[#19191B] px-6 py-16 text-center">
            <h3 className="text-base font-medium text-[#EDEDED]">No audio files found</h3>
            <p className="mt-2 max-w-md text-sm text-[#A1A1A6]">
              Download from YouTube or add audio files to your local music folder
            </p>
            <button
              type="button"
              onClick={onOpenDownloader}
              className="mt-5 h-9 rounded-lg bg-[#EDEDED] px-4 text-xs font-medium text-[#0F0F10] transition-colors duration-150 hover:bg-white"
            >
              Open downloader
            </button>
          </div>
        ) : (
          <TrackList
            tracks={visibleTracks}
            currentTrackId={currentTrackId}
            isPlaying={isPlaying}
            playlists={playlists}
            onPlayTrack={(t) => onPlayTrack(t, visibleTracks)}
            onToggleLike={onToggleLike}
            onAddToQueue={onAddToQueue}
            onAddToPlaylist={onAddToPlaylist}
            onUpdateTrack={onUpdateTrack}
            onDeleteTrack={onDeleteTrack}
            onRevealInFolder={onRevealInFolder}
            emptyMessage="No matching tracks"
          />
        )}
      </section>
    </div>
  );
}
