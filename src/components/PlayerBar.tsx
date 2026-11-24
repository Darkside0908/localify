import {
  Heart,
  ListOrdered,
  Pause,
  Play,
  Repeat,
  Repeat1,
  RotateCcw,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useState } from 'react';
import { RepeatMode, Track } from '../types';
import { formatDuration } from '../utils/format';
import { TrackCover } from './TrackCover';

interface PlayerBarProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  playbackRate: number;
  shuffle: boolean;
  repeat: RepeatMode;
  resumedFrom: number | null;
  playError: string | null;
  rightPanelOpen: boolean;
  onTogglePlayPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSeek: (seconds: number) => void;
  onVolumeChange: (val: number) => void;
  onToggleMute: () => void;
  onCyclePlaybackRate: () => void;
  onToggleShuffle: () => void;
  onCycleRepeat: () => void;
  onToggleLike: (track: Track) => void;
  onToggleRightPanel: () => void;
  onDismissResumed: () => void;
}

export function PlayerBar({
  currentTrack,
  isPlaying,
  currentTime,
  duration,
  volume,
  muted,
  playbackRate,
  shuffle,
  repeat,
  resumedFrom,
  playError,
  rightPanelOpen,
  onTogglePlayPause,
  onPrev,
  onNext,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onCyclePlaybackRate,
  onToggleShuffle,
  onCycleRepeat,
  onToggleLike,
  onToggleRightPanel,
  onDismissResumed,
}: PlayerBarProps) {
  const [hoverSeek, setHoverSeek] = useState<{ pct: number; time: number } | null>(null);

  const effectiveDuration = duration || currentTrack?.duration || 0;
  const progressPct =
    effectiveDuration > 0 ? Math.min(100, Math.max(0, (currentTime / effectiveDuration) * 100)) : 0;
  const displayVolume = muted ? 0 : Math.round(volume * 100);

  return (
    <footer className="relative z-30 flex h-20 shrink-0 items-center justify-between gap-4 border-t border-white/[0.08] bg-[#0F0F10] px-4">
      {/* Left: Active Track */}
      <div className="flex w-[30%] min-w-[200px] items-center gap-3">
        {currentTrack ? (
          <>
            <TrackCover track={currentTrack} sizeClass="h-12 w-12" radiusClass="rounded-md" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-[#EDEDED]">
                {currentTrack.title}
              </div>
              <div className="flex items-center gap-2 text-xs text-[#A1A1A6]">
                <span className="truncate">{currentTrack.artist}</span>
                {resumedFrom !== null && (
                  <button
                    type="button"
                    onClick={() => {
                      onSeek(0);
                      onDismissResumed();
                    }}
                    className="inline-flex shrink-0 items-center gap-1 font-mono text-xs text-[#E0A23B] hover:underline"
                    title="Restart from 0:00"
                  >
                    <RotateCcw size={12} strokeWidth={1.5} />
                    <span>{formatDuration(resumedFrom)}</span>
                  </button>
                )}
              </div>
              {playError && <div className="text-xs text-[#E5484D]">{playError}</div>}
            </div>
            <button
              type="button"
              onClick={() => onToggleLike(currentTrack)}
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors duration-150 ${
                currentTrack.liked
                  ? 'text-[#E0A23B]'
                  : 'text-[#85858B] hover:text-[#EDEDED]'
              }`}
              title={currentTrack.liked ? 'Unlike' : 'Like'}
            >
              <Heart size={16} strokeWidth={1.5} className={currentTrack.liked ? 'fill-[#E0A23B]' : ''} />
            </button>
          </>
        ) : (
          <div className="text-xs text-[#85858B]">Ready for playback</div>
        )}
      </div>

      {/* Center: Deck Transport + Precision Scrubber */}
      <div className="flex max-w-[44%] flex-1 flex-col items-center gap-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleShuffle}
            className={`relative flex h-8 w-8 items-center justify-center rounded-md transition-colors duration-150 ${
              shuffle ? 'text-[#E0A23B]' : 'text-[#85858B] hover:text-[#EDEDED]'
            }`}
            title="Shuffle"
          >
            <Shuffle size={16} strokeWidth={1.5} />
          </button>

          <button
            type="button"
            onClick={onPrev}
            disabled={!currentTrack}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[#A1A1A6] transition-colors duration-150 hover:text-[#EDEDED] disabled:opacity-35"
            title="Previous"
          >
            <SkipBack size={16} strokeWidth={1.5} />
          </button>

          <button
            type="button"
            onClick={onTogglePlayPause}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#EDEDED] text-[#0F0F10] transition-colors duration-150 hover:bg-white active:scale-[0.97]"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause size={18} strokeWidth={1.5} className="fill-[#0F0F10]" />
            ) : (
              <Play size={18} strokeWidth={1.5} className="ml-[2px] fill-[#0F0F10]" />
            )}
          </button>

          <button
            type="button"
            onClick={onNext}
            disabled={!currentTrack}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[#A1A1A6] transition-colors duration-150 hover:text-[#EDEDED] disabled:opacity-35"
            title="Next"
          >
            <SkipForward size={16} strokeWidth={1.5} />
          </button>

          <button
            type="button"
            onClick={onCycleRepeat}
            className={`relative flex h-8 w-8 items-center justify-center rounded-md transition-colors duration-150 ${
              repeat !== 'off' ? 'text-[#E0A23B]' : 'text-[#85858B] hover:text-[#EDEDED]'
            }`}
            title={`Repeat: ${repeat}`}
          >
            {repeat === 'one' ? (
              <Repeat1 size={16} strokeWidth={1.5} />
            ) : (
              <Repeat size={16} strokeWidth={1.5} />
            )}
          </button>
        </div>

        {/* Precision Seekbar */}
        <div className="flex w-full items-center gap-3">
          <span className="w-14 text-right font-mono tabular-nums text-xs text-[#85858B]">
            {formatDuration(currentTime)}
          </span>

          <div
            className="group relative flex h-4 flex-1 items-center"
            onMouseMove={(e) => {
              if (!effectiveDuration) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
              setHoverSeek({ pct: pct * 100, time: pct * effectiveDuration });
            }}
            onMouseLeave={() => setHoverSeek(null)}
          >
            {hoverSeek && (
              <div
                className="pointer-events-none absolute -top-7 -translate-x-1/2 rounded border border-white/[0.12] bg-[#232325] px-2 py-0.5 font-mono tabular-nums text-xs text-[#EDEDED] shadow-md"
                style={{ left: `${hoverSeek.pct}%` }}
              >
                {formatDuration(hoverSeek.time)}
              </div>
            )}

            {/* Chapter markers */}
            {effectiveDuration > 0 &&
              currentTrack?.chapters.map((ch, idx) => {
                const leftPct = (ch.startTime / effectiveDuration) * 100;
                if (leftPct <= 0 || leftPct >= 100) return null;
                return (
                  <span
                    key={`${ch.startTime}-${idx}`}
                    className="pointer-events-none absolute z-10 h-2 w-[2px] bg-white/40"
                    style={{ left: `${leftPct}%` }}
                  />
                );
              })}

            <input
              type="range"
              min={0}
              max={effectiveDuration || 100}
              step={0.5}
              disabled={!currentTrack || effectiveDuration <= 0}
              value={Math.min(currentTime, effectiveDuration || 0)}
              onChange={(e) => onSeek(Number(e.target.value))}
              className="deck-range relative z-20 w-full"
              style={{
                background: `linear-gradient(to right, #E0A23B ${progressPct}%, rgba(237,237,237,0.14) ${progressPct}%)`,
                borderRadius: '9999px',
                height: '3px',
              }}
            />
          </div>

          <span className="w-14 font-mono tabular-nums text-xs text-[#85858B]">
            {formatDuration(effectiveDuration)}
          </span>
        </div>
      </div>

      {/* Right: Drawer Toggle, Speed, Volume */}
      <div className="flex w-[26%] min-w-[180px] items-center justify-end gap-2">
        <button
          type="button"
          onClick={onToggleRightPanel}
          className={`flex h-8 items-center gap-2 rounded-lg px-2 text-xs font-medium transition-colors duration-150 ${
            rightPanelOpen
              ? 'bg-[#232325] text-[#EDEDED]'
              : 'text-[#85858B] hover:bg-[#19191B] hover:text-[#EDEDED]'
          }`}
          title="Queue and chapters"
        >
          <ListOrdered size={16} strokeWidth={1.5} />
          {currentTrack && currentTrack.chapters.length > 0 && (
            <span className="font-mono tabular-nums text-xs text-[#A1A1A6]">
              {currentTrack.chapters.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={onCyclePlaybackRate}
          className={`h-8 rounded-lg px-2 font-mono tabular-nums text-xs font-medium transition-colors duration-150 ${
            playbackRate !== 1
              ? 'bg-[#232325] text-[#E0A23B]'
              : 'text-[#A1A1A6] hover:bg-[#19191B] hover:text-[#EDEDED]'
          }`}
          title="Playback speed"
        >
          {playbackRate}x
        </button>

        <button
          type="button"
          onClick={onToggleMute}
          className="flex h-8 w-8 items-center justify-center rounded-md text-[#85858B] transition-colors duration-150 hover:text-[#EDEDED]"
          title={muted ? 'Unmute' : 'Mute'}
        >
          {muted || volume === 0 ? (
            <VolumeX size={16} strokeWidth={1.5} />
          ) : (
            <Volume2 size={16} strokeWidth={1.5} />
          )}
        </button>

        <div className="group flex w-24 items-center">
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={muted ? 0 : volume}
            onChange={(e) => onVolumeChange(Number(e.target.value))}
            className="deck-range w-full"
            style={{
              background: `linear-gradient(to right, #A1A1A6 ${displayVolume}%, rgba(237,237,237,0.14) ${displayVolume}%)`,
              borderRadius: '9999px',
              height: '3px',
            }}
          />
        </div>
      </div>
    </footer>
  );
}
