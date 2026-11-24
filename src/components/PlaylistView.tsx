import { Heart, Music, Pencil, Play, Shuffle, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Playlist, Track, TrackPatch } from '../types';
import { formatTotalListeningTime } from '../utils/format';
import { TrackCover } from './TrackCover';
import { TrackList } from './TrackList';

interface PlaylistViewProps {
  mode: 'liked' | 'playlist';
  playlist?: Playlist;
  allTracks: Track[];
  allPlaylists: Playlist[];
  searchQuery: string;
  currentTrackId: string | null;
  isPlaying: boolean;
  onPlayTrack: (track: Track, list?: Track[]) => void;
  onToggleLike: (track: Track) => void;
  onAddToQueue: (track: Track) => void;
  onAddToPlaylist: (playlistId: string, trackId: string) => void;
  onRemoveFromPlaylist?: (playlistId: string, trackId: string) => void;
  onRenamePlaylist?: (playlistId: string, name: string, description: string) => Promise<void>;
  onDeletePlaylist?: (playlistId: string) => Promise<void>;
  onUpdateTrack: (id: string, patch: TrackPatch) => Promise<void>;
  onDeleteTrack: (id: string, deleteFile: boolean) => Promise<void>;
  onRevealInFolder: (filePath: string) => void;
}

export function PlaylistView({
  mode,
  playlist,
  allTracks,
  allPlaylists,
  searchQuery,
  currentTrackId,
  isPlaying,
  onPlayTrack,
  onToggleLike,
  onAddToQueue,
  onAddToPlaylist,
  onRemoveFromPlaylist,
  onRenamePlaylist,
  onDeletePlaylist,
  onUpdateTrack,
  onDeleteTrack,
  onRevealInFolder,
}: PlaylistViewProps) {
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [descInput, setDescInput] = useState('');

  const playlistTracks = useMemo(() => {
    const map = new Map(allTracks.map((t) => [t.id, t]));
    const base =
      mode === 'liked'
        ? allTracks.filter((t) => t.liked)
        : (playlist?.trackIds || []).map((id) => map.get(id)).filter((t): t is Track => Boolean(t));

    const q = searchQuery.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (t) => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q),
    );
  }, [allTracks, mode, playlist, searchQuery]);

  const totalDuration = useMemo(
    () => playlistTracks.reduce((sum, t) => sum + (t.duration || 0), 0),
    [playlistTracks],
  );

  const openEditModal = () => {
    if (!playlist) return;
    setNameInput(playlist.name);
    setDescInput(playlist.description);
    setEditing(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playlist || !onRenamePlaylist) return;
    await onRenamePlaylist(playlist.id, nameInput.trim() || playlist.name, descInput.trim());
    setEditing(false);
  };

  const title = mode === 'liked' ? 'Liked songs' : playlist?.name || 'Playlist';
  const subtitle =
    mode === 'liked'
      ? 'Saved tracks and sets for offline listening'
      : playlist?.description || 'Offline playlist';

  return (
    <div className="space-y-6 pb-8">
      {/* Calm Graphite Header */}
      <section className="flex flex-col gap-5 border-b border-white/[0.08] pt-6 pb-6 sm:flex-row sm:items-end">
        {mode === 'liked' ? (
          <div className="flex h-[120px] w-[120px] shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-[#19191B]">
            <Heart size={32} strokeWidth={1.5} className="text-[#E0A23B]" />
          </div>
        ) : playlistTracks.length >= 4 ? (
          <div className="grid h-[120px] w-[120px] shrink-0 grid-cols-2 grid-rows-2 overflow-hidden rounded-xl border border-white/[0.08] bg-[#19191B]">
            {playlistTracks.slice(0, 4).map((t) => (
              <TrackCover
                key={t.id}
                track={t}
                sizeClass="h-full w-full"
                radiusClass="rounded-none"
                showSpindleDetail={false}
              />
            ))}
          </div>
        ) : playlistTracks.length > 0 ? (
          <TrackCover track={playlistTracks[0]} sizeClass="h-[120px] w-[120px]" radiusClass="rounded-xl" />
        ) : (
          <div className="flex h-[120px] w-[120px] shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-[#19191B]">
            <Music size={32} strokeWidth={1.5} className="text-[#85858B]" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium text-[#85858B]">Playlist</div>
          <h1 className="mt-1 truncate text-[28px] leading-[1.15] font-medium tracking-[-0.02em] text-[#EDEDED]">
            {title}
          </h1>
          <p className="mt-2 text-sm text-[#A1A1A6]">{subtitle}</p>
          <div className="mt-2 font-mono tabular-nums text-xs text-[#85858B]">
            {playlistTracks.length} {playlistTracks.length === 1 ? 'track' : 'tracks'} ·{' '}
            {formatTotalListeningTime(totalDuration)}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={playlistTracks.length === 0}
              onClick={() => onPlayTrack(playlistTracks[0], playlistTracks)}
              className="flex h-9 items-center gap-2 rounded-lg bg-[#EDEDED] px-4 text-sm font-medium text-[#0F0F10] transition-colors duration-150 hover:bg-white active:scale-[0.98] disabled:opacity-40"
            >
              <Play size={16} strokeWidth={1.5} className="fill-[#0F0F10]" />
              <span>Play</span>
            </button>

            <button
              type="button"
              disabled={playlistTracks.length === 0}
              onClick={() => {
                const idx = Math.floor(Math.random() * playlistTracks.length);
                onPlayTrack(playlistTracks[idx], playlistTracks);
              }}
              className="flex h-9 items-center gap-2 rounded-lg border border-white/[0.08] bg-[#232325] px-4 text-sm font-medium text-[#EDEDED] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-colors duration-150 hover:bg-[#2B2B2E] active:scale-[0.98] disabled:opacity-40"
            >
              <Shuffle size={16} strokeWidth={1.5} className="text-[#A1A1A6]" />
              <span>Shuffle</span>
            </button>

            {mode === 'playlist' && playlist && (
              <>
                <button
                  type="button"
                  onClick={openEditModal}
                  className="flex h-9 items-center gap-2 rounded-lg border border-white/[0.08] bg-[#232325] px-3 text-xs font-medium text-[#EDEDED] transition-colors duration-150 hover:bg-[#2B2B2E]"
                >
                  <Pencil size={16} strokeWidth={1.5} className="text-[#85858B]" />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  onClick={() => onDeletePlaylist?.(playlist.id)}
                  className="flex h-9 items-center gap-2 rounded-lg border border-white/[0.08] bg-[#232325] px-3 text-xs font-medium text-[#E5484D] transition-colors duration-150 hover:bg-[#2B2B2E]"
                >
                  <Trash2 size={16} strokeWidth={1.5} />
                  <span>Delete</span>
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      <TrackList
        tracks={playlistTracks}
        currentTrackId={currentTrackId}
        isPlaying={isPlaying}
        playlists={allPlaylists}
        onPlayTrack={(t) => onPlayTrack(t, playlistTracks)}
        onToggleLike={onToggleLike}
        onAddToQueue={onAddToQueue}
        onAddToPlaylist={onAddToPlaylist}
        onRemoveFromPlaylist={
          mode === 'playlist' && playlist && onRemoveFromPlaylist
            ? (trackId) => onRemoveFromPlaylist(playlist.id, trackId)
            : undefined
        }
        onUpdateTrack={onUpdateTrack}
        onDeleteTrack={onDeleteTrack}
        onRevealInFolder={onRevealInFolder}
        emptyMessage={
          mode === 'liked'
            ? 'No liked tracks yet'
            : 'This playlist is empty'
        }
      />

      {editing && playlist && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setEditing(false)}
        >
          <form
            onSubmit={handleSaveEdit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-white/[0.12] bg-[#19191B] p-6 shadow-2xl"
          >
            <h3 className="text-base font-medium text-[#EDEDED]">Edit playlist</h3>
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-[#A1A1A6]">Name</label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="h-9 w-full rounded-lg border border-white/[0.08] bg-[#141415] px-3 text-sm text-[#EDEDED] focus:border-white/[0.2] focus:outline-none"
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#A1A1A6]">Description</label>
                <input
                  type="text"
                  value={descInput}
                  onChange={(e) => setDescInput(e.target.value)}
                  className="h-9 w-full rounded-lg border border-white/[0.08] bg-[#141415] px-3 text-sm text-[#EDEDED] focus:border-white/[0.2] focus:outline-none"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="h-9 rounded-lg border border-white/[0.08] bg-[#232325] px-4 text-xs font-medium text-[#EDEDED] hover:bg-[#2B2B2E]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="h-9 rounded-lg bg-[#EDEDED] px-4 text-xs font-medium text-[#0F0F10] hover:bg-white"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
