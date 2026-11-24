import { Download, RefreshCw, Search, X } from 'lucide-react';
import { useEffect, useRef } from 'react';

interface TopBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenDownloader: () => void;
  onRescan: () => void;
  isRescanning: boolean;
  isDownloaderActive: boolean;
}

export function TopBar({
  searchQuery,
  onSearchChange,
  onOpenDownloader,
  onRescan,
  isRescanning,
  isDownloaderActive,
}: TopBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-4 border-b border-white/[0.08] bg-[#141415]/95 px-6 backdrop-blur-sm">
      <div className="relative w-80 max-w-full">
        <Search
          size={16}
          strokeWidth={1.5}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#85858B]"
        />
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search"
          className="h-9 w-full rounded-lg border border-white/[0.08] bg-[#19191B] pl-9 pr-14 text-sm text-[#EDEDED] placeholder-[#85858B] transition-colors duration-150 focus:border-white/[0.2] focus:bg-[#232325] focus:outline-none"
        />
        {searchQuery ? (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[#85858B] transition-colors duration-150 hover:text-[#EDEDED]"
            title="Clear search"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        ) : (
          <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-white/[0.08] bg-[#232325] px-1.5 py-0.5 font-mono text-xs text-[#85858B]">
            Ctrl F
          </kbd>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onRescan}
          disabled={isRescanning}
          className="flex h-8 items-center gap-2 rounded-lg border border-white/[0.08] bg-[#232325] px-3 text-xs font-medium text-[#EDEDED] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-colors duration-150 hover:bg-[#2B2B2E] active:scale-[0.98] disabled:opacity-50"
        >
          <RefreshCw
            size={16}
            strokeWidth={1.5}
            className={isRescanning ? 'animate-spin text-[#E0A23B]' : 'text-[#85858B]'}
          />
          <span>{isRescanning ? 'Scanning' : 'Rescan'}</span>
        </button>

        <button
          type="button"
          onClick={onOpenDownloader}
          className={`flex h-8 items-center gap-2 rounded-lg border px-3 text-xs font-medium transition-colors duration-150 active:scale-[0.98] ${
            isDownloaderActive
              ? 'border-white/[0.14] bg-[#232325] text-[#EDEDED] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
              : 'border-white/[0.08] bg-[#232325] text-[#EDEDED] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:bg-[#2B2B2E]'
          }`}
        >
          <Download size={16} strokeWidth={1.5} className="text-[#85858B]" />
          <span>Download</span>
        </button>
      </div>
    </header>
  );
}
