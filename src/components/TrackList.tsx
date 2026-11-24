import {
  Check,
  FolderOpen,
  Heart,
  ListPlus,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Playlist, Track, TrackPatch } from '../types';
import { formatBytes, formatDuration } from '../utils/format';
import { TrackCover } from './TrackCover';

interface TrackListProps {
  tracks: Track[];
  currentTrackId: string | null;
  isPlaying: boolean;
  playlists: Playlist[];
  onPlayTrack: (track: Track) => void;
  onToggleLike: (track: Track) => void;
  onAddToQueue: (track: Track) => void;
  onAddToPlaylist: (playlistId: string, trackId: string) => void;
  onRemoveFromPlaylist?: (trackId: string) => void;
  onUpdateTrack: (id: string, patch: TrackPatch) => Promise<void>;
  onDeleteTrack: (id: string, deleteFile: boolean) => Promise<void>;
  onRevealInFolder: (filePath: string) => void;
  emptyMessage?: string;
}

export function TrackList({
  tracks,
  currentTrackId,
  isPlaying,
  playlists,
  onPlayTrack,
  onToggleLike,
  onAddToQueue,
  onAddToPlaylist,
  onRemoveFromPlaylist,
  onUpdateTrack,
  onDeleteTrack,
  onRevealInFolder,
  emptyMessage = 'No tracks in this view',
}: TrackListProps) {
  const [menuTrackId, setMenuTrackId] = useState<string | null>(null);
  const [playlistMenuTrackId, setPlaylistMenuTrackId] = useState<string | null>(null);
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editArtist, setEditArtist] = useState('');
  const [editAlbum, setEditAlbum] = useState('');
  const [deletingTrack, setDeletingTrack] = useState<Track | null>(null);

  useEffect(() => {
    const closeMenus = () => {
      setMenuTrackId(null);
      setPlaylistMenuTrackId(null);
    };
    window.addEventListener('click', closeMenus);
    return () => window.removeEventListener('click', closeMenus);
  }, []);

  const openEdit = (track: Track) => {
    setEditingTrack(track);
    setEditTitle(track.title);
    setEditArtist(track.artist);
    setEditAlbum(track.album);
    setMenuTrackId(null);
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTrack) return;
    await onUpdateTrack(editingTrack.id, {
      title: editTitle.trim() || editingTrack.title,
      artist: editArtist.trim() || 'Unknown Artist',
      album: editAlbum.trim() || 'Local Library',
    });
    setEditingTrack(null);
  };

  if (tracks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-white/[0.08] bg-[#19191B] px-6 py-12 text-center">
        <p className="text-sm text-[#A1A1A6]">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <>
      <div className="w-full">
        {/* Table Header */}
        <div className="grid h-9 grid-cols-[40px_minmax(0,1fr)_180px_80px_96px] items-center gap-3 border-b border-white/[0.08] px-3 text-xs font-medium text-[#85858B]">
          <div className="text-center font-mono">#</div>
          <div>Title</div>
          <div className="hidden md:block">Audio</div>
          <div className="text-right">Time</div>
          <div />
        </div>

        {/* Rows */}
        <div className="mt-1 space-y-1">
          {tracks.map((track, idx) => {
            const active = track.id === currentTrackId;
            const activePlaying = active && isPlaying;
            const resumePct =
              track.duration > 0 && track.lastPosition > 5
                ? Math.min(100, Math.max(0, (track.lastPosition / track.duration) * 100))
                : 0;

            return (
              <div
                key={track.id}
                onDoubleClick={() => onPlayTrack(track)}
                className={`group relative grid h-14 grid-cols-[40px_minmax(0,1fr)_180px_80px_96px] items-center gap-3 rounded-lg px-3 transition-colors duration-150 ${
                  active
                    ? 'bg-[#232325] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                    : 'hover:bg-[#19191B]'
                }`}
              >
                {/* Signature 2px vertical amber indicator for active track */}
                {active && (
                  <span
                    className="absolute bottom-2 left-0 top-2 w-[2px] rounded-full bg-[#E0A23B]"
                    aria-hidden="true"
                  />
                )}

                {/* Index / Equalizer / Play */}
                <div className="flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => onPlayTrack(track)}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-[#A1A1A6] transition-colors duration-150 hover:text-[#EDEDED]"
                    title={activePlaying ? 'Pause' : 'Play'}
                  >
                    {activePlaying ? (
                      <>
                        <span className="flex h-3 items-end gap-[2px] group-hover:hidden">
                          <span className="eq-bar-1 w-[2px] rounded-full bg-[#E0A23B]" />
                          <span className="eq-bar-2 w-[2px] rounded-full bg-[#E0A23B]" />
                          <span className="eq-bar-3 w-[2px] rounded-full bg-[#E0A23B]" />
                        </span>
                        <Pause
                          size={16}
                          strokeWidth={1.5}
                          className="hidden fill-[#EDEDED] text-[#EDEDED] group-hover:block"
                        />
                      </>
                    ) : (
                      <>
                        <span
                          className={`font-mono tabular-nums text-xs group-hover:hidden ${
                            active ? 'text-[#E0A23B]' : 'text-[#85858B]'
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <Play
                          size={16}
                          strokeWidth={1.5}
                          className="hidden fill-[#EDEDED] text-[#EDEDED] group-hover:block"
                        />
                      </>
                    )}
                  </button>
                </div>

                {/* Title + Sleeve + Resume Bar */}
                <div className="flex min-w-0 items-center gap-3">
                  <TrackCover track={track} sizeClass="h-10 w-10" radiusClass="rounded" />
                  <div className="min-w-0 flex-1">
                    <div
                      className={`truncate text-sm font-medium ${
                        active ? 'text-[#E0A23B]' : 'text-[#EDEDED]'
                      }`}
                    >
                      {track.title}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[#A1A1A6]">
                      <span className="truncate">{track.artist}</span>
                      {resumePct > 0 && (
                        <span className="inline-flex shrink-0 items-center gap-2 font-mono tabular-nums text-xs text-[#E0A23B]">
                          · {formatDuration(track.lastPosition)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Quiet Mono Specs */}
                <div className="hidden items-center gap-1 truncate font-mono tabular-nums text-xs text-[#85858B] md:flex">
                  <span>{track.format}</span>
                  {track.bitrate > 0 && <span>· {track.bitrate}k</span>}
                  <span>· {formatBytes(track.size)}</span>
                  {track.chapters.length > 0 && <span>· {track.chapters.length}ch</span>}
                </div>

                {/* Duration */}
                <div className="text-right font-mono tabular-nums text-xs text-[#A1A1A6]">
                  {formatDuration(track.duration)}
                </div>

                {/* Row Actions */}
                <div className="relative flex items-center justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => onToggleLike(track)}
                    className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors duration-150 ${
                      track.liked
                        ? 'text-[#E0A23B] opacity-100'
                        : 'text-[#85858B] opacity-0 hover:text-[#EDEDED] group-hover:opacity-100'
                    }`}
                    title={track.liked ? 'Remove from liked' : 'Save to liked'}
                  >
                    <Heart size={16} strokeWidth={1.5} className={track.liked ? 'fill-[#E0A23B]' : ''} />
                  </button>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuTrackId(null);
                        setPlaylistMenuTrackId(playlistMenuTrackId === track.id ? null : track.id);
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-[#85858B] opacity-0 transition-colors duration-150 hover:bg-[#232325] hover:text-[#EDEDED] group-hover:opacity-100"
                      title="Add to playlist"
                    >
                      <Plus size={16} strokeWidth={1.5} />
                    </button>

                    {playlistMenuTrackId === track.id && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-0 top-8 z-30 w-52 rounded-xl border border-white/[0.12] bg-[#19191B] p-1 shadow-xl"
                      >
                        <div className="px-3 py-2 text-xs font-medium text-[#85858B]">
                          Add to playlist
                        </div>
                        {playlists.length === 0 ? (
                          <div className="px-3 py-2 text-xs text-[#85858B]">No playlists created</div>
                        ) : (
                          playlists.map((pl) => {
                            const added = pl.trackIds.includes(track.id);
                            return (
                              <button
                                key={pl.id}
                                type="button"
                                onClick={() => {
                                  onAddToPlaylist(pl.id, track.id);
                                  setPlaylistMenuTrackId(null);
                                }}
                                className="flex h-8 w-full items-center justify-between rounded-lg px-3 text-left text-xs text-[#EDEDED] transition-colors duration-150 hover:bg-[#232325]"
                              >
                                <span className="truncate">{pl.name}</span>
                                {added && <Check size={16} strokeWidth={1.5} className="shrink-0 text-[#E0A23B]" />}
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPlaylistMenuTrackId(null);
                        setMenuTrackId(menuTrackId === track.id ? null : track.id);
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-[#85858B] opacity-0 transition-colors duration-150 hover:bg-[#232325] hover:text-[#EDEDED] group-hover:opacity-100"
                      title="More options"
                    >
                      <MoreHorizontal size={16} strokeWidth={1.5} />
                    </button>

                    {menuTrackId === track.id && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-0 top-8 z-30 w-48 rounded-xl border border-white/[0.12] bg-[#19191B] p-1 text-xs shadow-xl"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            onAddToQueue(track);
                            setMenuTrackId(null);
                          }}
                          className="flex h-8 w-full items-center gap-2 rounded-lg px-3 text-left text-[#EDEDED] transition-colors duration-150 hover:bg-[#232325]"
                        >
                          <ListPlus size={16} strokeWidth={1.5} className="text-[#85858B]" />
                          <span>Add to queue</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(track)}
                          className="flex h-8 w-full items-center gap-2 rounded-lg px-3 text-left text-[#EDEDED] transition-colors duration-150 hover:bg-[#232325]"
                        >
                          <Pencil size={16} strokeWidth={1.5} className="text-[#85858B]" />
                          <span>Edit metadata</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onRevealInFolder(track.filePath);
                            setMenuTrackId(null);
                          }}
                          className="flex h-8 w-full items-center gap-2 rounded-lg px-3 text-left text-[#EDEDED] transition-colors duration-150 hover:bg-[#232325]"
                        >
                          <FolderOpen size={16} strokeWidth={1.5} className="text-[#85858B]" />
                          <span>Reveal in folder</span>
                        </button>
                        {onRemoveFromPlaylist && (
                          <button
                            type="button"
                            onClick={() => {
                              onRemoveFromPlaylist(track.id);
                              setMenuTrackId(null);
                            }}
                            className="flex h-8 w-full items-center gap-2 rounded-lg px-3 text-left text-[#E0A23B] transition-colors duration-150 hover:bg-[#232325]"
                          >
                            <X size={16} strokeWidth={1.5} />
                            <span>Remove from playlist</span>
                          </button>
                        )}
                        <div className="my-1 border-t border-white/[0.08]" />
                        <button
                          type="button"
                          onClick={() => {
                            setDeletingTrack(track);
                            setMenuTrackId(null);
                          }}
                          className="flex h-8 w-full items-center gap-2 rounded-lg px-3 text-left text-[#E5484D] transition-colors duration-150 hover:bg-[#232325]"
                        >
                          <Trash2 size={16} strokeWidth={1.5} />
                          <span>Delete track</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Edit Metadata Modal */}
      {editingTrack && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setEditingTrack(null)}
        >
          <form
            onSubmit={submitEdit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-white/[0.12] bg-[#19191B] p-6 shadow-2xl"
          >
            <h3 className="text-base font-medium text-[#EDEDED]">Edit track metadata</h3>
            <p className="mt-1 truncate font-mono text-xs text-[#85858B]">{editingTrack.filename}</p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-[#A1A1A6]">Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="h-9 w-full rounded-lg border border-white/[0.08] bg-[#141415] px-3 text-sm text-[#EDEDED] focus:border-white/[0.2] focus:outline-none"
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#A1A1A6]">Artist</label>
                <input
                  type="text"
                  value={editArtist}
                  onChange={(e) => setEditArtist(e.target.value)}
                  className="h-9 w-full rounded-lg border border-white/[0.08] bg-[#141415] px-3 text-sm text-[#EDEDED] focus:border-white/[0.2] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#A1A1A6]">Album</label>
                <input
                  type="text"
                  value={editAlbum}
                  onChange={(e) => setEditAlbum(e.target.value)}
                  className="h-9 w-full rounded-lg border border-white/[0.08] bg-[#141415] px-3 text-sm text-[#EDEDED] focus:border-white/[0.2] focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingTrack(null)}
                className="h-9 rounded-lg border border-white/[0.08] bg-[#232325] px-4 text-xs font-medium text-[#EDEDED] transition-colors duration-150 hover:bg-[#2B2B2E]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="h-9 rounded-lg bg-[#EDEDED] px-4 text-xs font-medium text-[#0F0F10] transition-colors duration-150 hover:bg-white"
              >
                Save changes
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingTrack && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setDeletingTrack(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-white/[0.12] bg-[#19191B] p-6 shadow-2xl"
          >
            <h3 className="text-base font-medium text-[#EDEDED]">Delete track</h3>
            <p className="mt-2 text-sm font-medium text-[#EDEDED]">{deletingTrack.title}</p>
            <p className="mt-1 text-xs leading-5 text-[#A1A1A6]">
              Remove this entry from the app list or permanently delete the audio file from disk
            </p>

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingTrack(null)}
                className="h-9 rounded-lg px-3 text-xs font-medium text-[#A1A1A6] hover:text-[#EDEDED]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await onDeleteTrack(deletingTrack.id, false);
                  setDeletingTrack(null);
                }}
                className="h-9 rounded-lg border border-white/[0.08] bg-[#232325] px-4 text-xs font-medium text-[#EDEDED] transition-colors duration-150 hover:bg-[#2B2B2E]"
              >
                Remove from library
              </button>
              <button
                type="button"
                onClick={async () => {
                  await onDeleteTrack(deletingTrack.id, true);
                  setDeletingTrack(null);
                }}
                className="h-9 rounded-lg bg-[#E5484D] px-4 text-xs font-medium text-white transition-colors duration-150 hover:bg-[#D43D42]"
              >
                Delete file
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
