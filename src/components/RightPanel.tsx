import { Trash2, X } from 'lucide-react';
import { Track } from '../types';
import { formatBytes, formatDuration } from '../utils/format';
import { TrackCover } from './TrackCover';

interface RightPanelProps {
  currentTrack: Track | null;
  currentTime: number;
  queue: Track[];
  queueIndex: number;
  onSeek: (seconds: number) => void;
  onJumpToQueueIndex: (index: number) => void;
  onRemoveFromQueue: (index: number) => void;
  onClearUpNext: () => void;
  onClose: () => void;
}

export function RightPanel({
  currentTrack,
  currentTime,
  queue,
  queueIndex,
  onSeek,
  onJumpToQueueIndex,
  onRemoveFromQueue,
  onClearUpNext,
  onClose,
}: RightPanelProps) {
  const upNext = queueIndex >= 0 ? queue.slice(queueIndex + 1) : [];

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-white/[0.08] bg-[#0F0F10] p-4">
      <div className="mb-4 flex h-8 items-center justify-between">
        <span className="text-sm font-medium text-[#EDEDED]">Queue &amp; chapters</span>
        <button
          type="button"
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-md text-[#85858B] transition-colors duration-150 hover:bg-[#232325] hover:text-[#EDEDED]"
          title="Close panel"
        >
          <X size={16} strokeWidth={1.5} />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto">
        {currentTrack ? (
          <div className="space-y-3 rounded-xl border border-white/[0.08] bg-[#19191B] p-3">
            <TrackCover track={currentTrack} sizeClass="aspect-square w-full" radiusClass="rounded-lg" />
            <div>
              <div className="text-sm font-medium leading-snug text-[#EDEDED]">
                {currentTrack.title}
              </div>
              <div className="mt-1 text-xs text-[#A1A1A6]">{currentTrack.artist}</div>
              <div className="mt-2 font-mono tabular-nums text-xs text-[#85858B]">
                {currentTrack.format}
                {currentTrack.bitrate > 0 && ` · ${currentTrack.bitrate} kbps`}
                {` · ${formatBytes(currentTrack.size)}`}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-white/[0.08] bg-[#19191B] p-4 text-xs text-[#85858B]">
            Select a track to inspect chapters and queue
          </div>
        )}

        {/* Chapters */}
        {currentTrack && currentTrack.chapters.length > 0 && (
          <div>
            <div className="mb-2 flex items-center justify-between text-xs font-medium text-[#85858B]">
              <span>Chapters</span>
              <span className="font-mono tabular-nums">{currentTrack.chapters.length}</span>
            </div>
            <div className="space-y-1">
              {currentTrack.chapters.map((ch, idx) => {
                const nextStart =
                  currentTrack.chapters[idx + 1]?.startTime ?? currentTrack.duration;
                const active = currentTime >= ch.startTime && currentTime < nextStart;
                return (
                  <button
                    key={`${ch.startTime}-${idx}`}
                    type="button"
                    onClick={() => onSeek(ch.startTime)}
                    className={`flex h-9 w-full items-center justify-between gap-2 rounded-lg px-3 text-left text-xs transition-colors duration-150 ${
                      active
                        ? 'bg-[#232325] font-medium text-[#E0A23B]'
                        : 'text-[#A1A1A6] hover:bg-[#19191B] hover:text-[#EDEDED]'
                    }`}
                  >
                    <span className="truncate">{ch.title}</span>
                    <span className="shrink-0 font-mono tabular-nums text-xs text-[#85858B]">
                      {formatDuration(ch.startTime)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Up next */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-[#85858B]">
              Up next <span className="font-mono tabular-nums">({upNext.length})</span>
            </span>
            {upNext.length > 0 && (
              <button
                type="button"
                onClick={onClearUpNext}
                className="text-xs text-[#85858B] transition-colors duration-150 hover:text-[#EDEDED]"
              >
                Clear
              </button>
            )}
          </div>

          {upNext.length === 0 ? (
            <p className="text-xs text-[#85858B]">Queue is empty</p>
          ) : (
            <div className="space-y-1">
              {upNext.map((t, offset) => {
                const actualIndex = queueIndex + 1 + offset;
                return (
                  <div
                    key={`${t.id}-${actualIndex}`}
                    className="group flex h-12 items-center gap-2 rounded-lg px-2 transition-colors duration-150 hover:bg-[#19191B]"
                  >
                    <button
                      type="button"
                      onClick={() => onJumpToQueueIndex(actualIndex)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      <TrackCover track={t} sizeClass="h-8 w-8" radiusClass="rounded" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-medium text-[#EDEDED]">{t.title}</div>
                        <div className="truncate text-xs text-[#85858B]">{t.artist}</div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveFromQueue(actualIndex)}
                      className="rounded p-1 text-[#85858B] opacity-0 transition-colors duration-150 hover:text-[#E5484D] group-hover:opacity-100"
                      title="Remove from queue"
                    >
                      <Trash2 size={16} strokeWidth={1.5} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
