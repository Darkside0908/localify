import { Track } from '../types';

interface TrackCoverProps {
  track: Track;
  sizeClass?: string;
  radiusClass?: string;
  showSpindleDetail?: boolean;
}

export function TrackCover({
  track,
  sizeClass = 'h-10 w-10',
  radiusClass = 'rounded-md',
  showSpindleDetail = true,
}: TrackCoverProps) {
  const isLongSet = track.duration >= 1200;

  if (track.coverUrl) {
    return (
      <div
        className={`relative shrink-0 overflow-hidden border border-white/[0.08] bg-[#19191B] ${sizeClass} ${radiusClass}`}
      >
        <img
          src={track.coverUrl}
          alt={track.title}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden border border-white/[0.08] bg-[#1B1B1E] ${sizeClass} ${radiusClass}`}
    >
      {/* Subtle concentric vinyl pressing grooves */}
      <svg viewBox="0 0 64 64" className="h-[82%] w-[82%]" aria-hidden="true">
        <circle cx="32" cy="32" r="28" fill="#141415" stroke="#EDEDED" strokeOpacity="0.09" strokeWidth="1" />
        <circle cx="32" cy="32" r="23" fill="none" stroke="#EDEDED" strokeOpacity="0.06" strokeWidth="1" />
        <circle cx="32" cy="32" r="18" fill="none" stroke="#EDEDED" strokeOpacity="0.05" strokeWidth="1" />
        <circle cx="32" cy="32" r="11" fill="#232325" stroke="#EDEDED" strokeOpacity="0.14" strokeWidth="1" />
        {showSpindleDetail && (
          <circle
            cx="32"
            cy="32"
            r="3"
            fill={isLongSet ? '#E0A23B' : '#85858B'}
          />
        )}
      </svg>
    </div>
  );
}
