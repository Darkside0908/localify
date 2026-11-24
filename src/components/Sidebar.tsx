import { Download, Heart, Home, ListMusic, Plus, Settings } from 'lucide-react';
import { Playlist } from '../types';

export type ActiveNav =
  | { type: 'library' }
  | { type: 'downloader' }
  | { type: 'liked' }
  | { type: 'playlist'; playlistId: string };

interface SidebarProps {
  activeNav: ActiveNav;
  onSelectNav: (nav: ActiveNav) => void;
  playlists: Playlist[];
  likedCount: number;
  totalCount: number;
  activeDownloadCount: number;
  onOpenCreatePlaylist: () => void;
  onOpenSettings: () => void;
}

export function Sidebar({
  activeNav,
  onSelectNav,
  playlists,
  likedCount,
  totalCount,
  activeDownloadCount,
  onOpenCreatePlaylist,
  onOpenSettings,
}: SidebarProps) {
  const isNavActive = (kind: 'library' | 'downloader' | 'liked') => activeNav.type === kind;

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-white/[0.08] bg-[#0F0F10] p-4">
      {/* Brand mark */}
      <div className="mb-6 flex h-8 items-center gap-2 px-2">
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden="true">
          <circle cx="12" cy="12" r="9.5" fill="none" stroke="#EDEDED" strokeOpacity="0.85" strokeWidth="1.5" />
          <circle cx="12" cy="12" r="5.5" fill="none" stroke="#EDEDED" strokeOpacity="0.3" strokeWidth="1" />
          <circle cx="12" cy="12" r="2" fill="#E0A23B" />
        </svg>
        <span className="text-base font-medium tracking-tight text-[#EDEDED]">Localify</span>
      </div>

      {/* Primary Navigation */}
      <nav className="space-y-1">
        <button
          type="button"
          onClick={() => onSelectNav({ type: 'library' })}
          className={`flex h-9 w-full items-center justify-between rounded-lg px-3 text-sm font-medium transition-colors duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            isNavActive('library')
              ? 'bg-[#232325] text-[#EDEDED] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
              : 'text-[#A1A1A6] hover:bg-[#19191B] hover:text-[#EDEDED]'
          }`}
        >
          <span className="flex items-center gap-2">
            <span className="flex w-5 items-center justify-center">
              <Home size={16} strokeWidth={1.5} className="text-[#85858B]" />
            </span>
            <span>Library</span>
          </span>
          <span className="font-mono tabular-nums text-xs text-[#85858B]">{totalCount}</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectNav({ type: 'downloader' })}
          className={`flex h-9 w-full items-center justify-between rounded-lg px-3 text-sm font-medium transition-colors duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            isNavActive('downloader')
              ? 'bg-[#232325] text-[#EDEDED] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
              : 'text-[#A1A1A6] hover:bg-[#19191B] hover:text-[#EDEDED]'
          }`}
        >
          <span className="flex items-center gap-2">
            <span className="flex w-5 items-center justify-center">
              <Download size={16} strokeWidth={1.5} className="text-[#85858B]" />
            </span>
            <span>Downloader</span>
          </span>
          {activeDownloadCount > 0 && (
            <span className="flex items-center gap-2 font-mono tabular-nums text-xs text-[#E0A23B]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#E0A23B]" />
              {activeDownloadCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => onSelectNav({ type: 'liked' })}
          className={`flex h-9 w-full items-center justify-between rounded-lg px-3 text-sm font-medium transition-colors duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            isNavActive('liked')
              ? 'bg-[#232325] text-[#EDEDED] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
              : 'text-[#A1A1A6] hover:bg-[#19191B] hover:text-[#EDEDED]'
          }`}
        >
          <span className="flex items-center gap-2">
            <span className="flex w-5 items-center justify-center">
              <Heart size={16} strokeWidth={1.5} className="text-[#85858B]" />
            </span>
            <span>Liked songs</span>
          </span>
          <span className="font-mono tabular-nums text-xs text-[#85858B]">{likedCount}</span>
        </button>
      </nav>

      {/* Playlists Section */}
      <div className="mt-6 flex min-h-0 flex-1 flex-col">
        <div className="mb-2 flex items-center justify-between px-3">
          <span className="text-xs font-medium text-[#85858B]">Playlists</span>
          <button
            type="button"
            onClick={onOpenCreatePlaylist}
            title="New playlist"
            className="flex h-6 w-6 items-center justify-center rounded-md text-[#85858B] transition-colors duration-150 hover:bg-[#232325] hover:text-[#EDEDED]"
          >
            <Plus size={16} strokeWidth={1.5} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
          {playlists.length === 0 ? (
            <div className="rounded-lg border border-white/[0.06] bg-[#141415] p-3">
              <p className="text-xs text-[#A1A1A6]">No playlists yet</p>
              <button
                type="button"
                onClick={onOpenCreatePlaylist}
                className="mt-2 h-8 rounded-lg border border-white/[0.08] bg-[#232325] px-3 text-xs font-medium text-[#EDEDED] transition-colors duration-150 hover:bg-[#2B2B2E]"
              >
                New playlist
              </button>
            </div>
          ) : (
            playlists.map((pl) => {
              const selected = activeNav.type === 'playlist' && activeNav.playlistId === pl.id;
              return (
                <button
                  key={pl.id}
                  type="button"
                  onClick={() => onSelectNav({ type: 'playlist', playlistId: pl.id })}
                  className={`flex h-9 w-full items-center justify-between rounded-lg px-3 text-left text-sm transition-colors duration-150 ${
                    selected
                      ? 'bg-[#232325] font-medium text-[#EDEDED] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                      : 'font-normal text-[#A1A1A6] hover:bg-[#19191B] hover:text-[#EDEDED]'
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="flex w-5 shrink-0 items-center justify-center">
                      <ListMusic size={16} strokeWidth={1.5} className="text-[#85858B]" />
                    </span>
                    <span className="truncate">{pl.name}</span>
                  </span>
                  <span className="ml-2 shrink-0 font-mono tabular-nums text-xs text-[#85858B]">
                    {pl.trackIds.length}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Footer Settings */}
      <div className="mt-4 border-t border-white/[0.08] pt-3">
        <button
          type="button"
          onClick={onOpenSettings}
          className="flex h-9 w-full items-center gap-2 rounded-lg px-3 text-sm font-medium text-[#A1A1A6] transition-colors duration-150 hover:bg-[#19191B] hover:text-[#EDEDED]"
        >
          <span className="flex w-5 items-center justify-center">
            <Settings size={16} strokeWidth={1.5} className="text-[#85858B]" />
          </span>
          <span>Settings</span>
        </button>
      </div>
    </aside>
  );
}
