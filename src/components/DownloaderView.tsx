import {
  Download,
  FileText,
  Loader2,
  Play,
  Search,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { AudioFormat, DownloadJob, Playlist, Track, VideoPreview } from '../types';
import { formatDuration } from '../utils/format';

interface DownloaderViewProps {
  jobs: DownloadJob[];
  playlists: Playlist[];
  tracks: Track[];
  defaultFormat: AudioFormat;
  defaultNoPlaylist: boolean;
  onPlayTrackById: (trackId: string) => void;
}

const FORMAT_OPTIONS: Array<{ id: AudioFormat; label: string; hint: string }> = [
  { id: 'mp3', label: 'MP3', hint: 'Standard compatibility' },
  { id: 'm4a', label: 'M4A', hint: 'Balanced quality' },
  { id: 'opus', label: 'OPUS', hint: 'Smallest file size' },
];

export function DownloaderView({
  jobs,
  playlists,
  tracks,
  defaultFormat,
  defaultNoPlaylist,
  onPlayTrackById,
}: DownloaderViewProps) {
  const [urlsText, setUrlsText] = useState('');
  const [format, setFormat] = useState<AudioFormat>(defaultFormat);
  const [noPlaylist, setNoPlaylist] = useState<boolean>(defaultNoPlaylist);
  const [playlistId, setPlaylistId] = useState<string>('');
  const [preview, setPreview] = useState<VideoPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const parsedUrls = useMemo(
    () =>
      urlsText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0),
    [urlsText],
  );

  const hasPlaylistParam = useMemo(
    () => parsedUrls.some((u) => /[?&]list=/i.test(u)),
    [parsedUrls],
  );

  const handleLoadLinksTxt = async () => {
    setErrorMsg(null);
    const links = await window.localify.downloader.readLinksFile();
    if (links.length === 0) {
      setErrorMsg('No links found in links.txt');
      return;
    }
    setUrlsText(links.join('\n'));
  };

  const handlePreview = async () => {
    const first = parsedUrls[0];
    if (!first) {
      setErrorMsg('Paste a YouTube URL first');
      return;
    }
    setErrorMsg(null);
    setPreviewLoading(true);
    try {
      const info = await window.localify.downloader.fetchInfo(first, noPlaylist);
      setPreview(info);
    } catch (err) {
      setPreview(null);
      setErrorMsg(err instanceof Error ? err.message : 'Failed to fetch video info');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleEnqueue = async () => {
    if (parsedUrls.length === 0) {
      setErrorMsg('Enter at least one YouTube URL');
      return;
    }
    setErrorMsg(null);
    setSubmitting(true);
    try {
      await window.localify.downloader.enqueue({
        urls: parsedUrls,
        format,
        noPlaylist,
        playlistId: playlistId || null,
      });
      setUrlsText('');
      setPreview(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to enqueue download');
    } finally {
      setSubmitting(false);
    }
  };

  const trackMap = useMemo(() => new Map(tracks.map((t) => [t.id, t])), [tracks]);

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <section className="flex flex-wrap items-end justify-between gap-4 border-b border-white/[0.08] pt-6 pb-6">
        <div>
          <h1 className="text-[28px] leading-[1.15] font-medium tracking-[-0.02em] text-[#EDEDED]">
            Downloader
          </h1>
          <p className="mt-2 text-sm text-[#A1A1A6]">
            Save audio, artwork, and chapters from YouTube to your local folder
          </p>
        </div>

        <button
          type="button"
          onClick={handleLoadLinksTxt}
          className="flex h-9 items-center gap-2 rounded-lg border border-white/[0.08] bg-[#232325] px-4 text-xs font-medium text-[#EDEDED] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-colors duration-150 hover:bg-[#2B2B2E]"
        >
          <FileText size={16} strokeWidth={1.5} className="text-[#85858B]" />
          <span>Import links.txt</span>
        </button>
      </section>

      {/* Input Card */}
      <section className="rounded-xl border border-white/[0.08] bg-[#19191B] p-5">
        <textarea
          rows={3}
          value={urlsText}
          onChange={(e) => setUrlsText(e.target.value)}
          placeholder="Paste YouTube URLs, one per line"
          className="w-full rounded-lg border border-white/[0.08] bg-[#141415] p-3 text-sm text-[#EDEDED] placeholder-[#85858B] focus:border-white/[0.2] focus:outline-none"
        />

        {hasPlaylistParam && (
          <div className="mt-3 border-l-2 border-[#E0A23B] bg-[#141415] px-3 py-2 text-xs text-[#A1A1A6]">
            URL contains <code className="font-mono text-[#EDEDED]">list=</code>.{' '}
            {noPlaylist
              ? 'Single track mode is active, so only this video will download'
              : 'Playlist mode is active, so every video in the list will download'}
          </div>
        )}

        {errorMsg && (
          <div className="mt-3 border-l-2 border-[#E5484D] bg-[#141415] px-3 py-2 text-xs text-[#E5484D]">
            {errorMsg}
          </div>
        )}

        {/* Options Bar */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1 rounded-lg border border-white/[0.08] bg-[#141415] p-1">
              {FORMAT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setFormat(opt.id)}
                  title={opt.hint}
                  className={`h-7 rounded px-3 font-mono text-xs font-medium transition-colors duration-150 ${
                    format === opt.id
                      ? 'bg-[#232325] text-[#EDEDED] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                      : 'text-[#85858B] hover:text-[#EDEDED]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-xs text-[#A1A1A6]">
              <input
                type="checkbox"
                checked={noPlaylist}
                onChange={(e) => setNoPlaylist(e.target.checked)}
                className="h-4 w-4 rounded accent-[#E0A23B]"
              />
              <span>Single track only</span>
            </label>

            <select
              value={playlistId}
              onChange={(e) => setPlaylistId(e.target.value)}
              className="h-8 rounded-lg border border-white/[0.08] bg-[#141415] px-3 text-xs text-[#EDEDED] focus:border-white/[0.2] focus:outline-none"
            >
              <option value="">Library only</option>
              {playlists.map((pl) => (
                <option key={pl.id} value={pl.id}>
                  Add to: {pl.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePreview}
              disabled={previewLoading || parsedUrls.length === 0}
              className="flex h-9 items-center gap-2 rounded-lg border border-white/[0.08] bg-[#232325] px-4 text-xs font-medium text-[#EDEDED] transition-colors duration-150 hover:bg-[#2B2B2E] disabled:opacity-40"
            >
              {previewLoading ? (
                <Loader2 size={16} strokeWidth={1.5} className="animate-spin text-[#E0A23B]" />
              ) : (
                <Search size={16} strokeWidth={1.5} className="text-[#85858B]" />
              )}
              <span>Preview</span>
            </button>

            <button
              type="button"
              onClick={handleEnqueue}
              disabled={submitting || parsedUrls.length === 0}
              className="flex h-9 items-center gap-2 rounded-lg bg-[#EDEDED] px-4 text-xs font-medium text-[#0F0F10] transition-colors duration-150 hover:bg-white active:scale-[0.98] disabled:opacity-40"
            >
              <Download size={16} strokeWidth={1.5} />
              <span>
                Download{parsedUrls.length > 1 ? ` (${parsedUrls.length})` : ''}
              </span>
            </button>
          </div>
        </div>

        {/* Preview */}
        {preview && (
          <div className="mt-4 flex items-center gap-4 rounded-lg border border-white/[0.08] bg-[#141415] p-3">
            {preview.thumbnail ? (
              <img
                src={preview.thumbnail}
                alt={preview.title}
                className="h-14 w-24 shrink-0 rounded-md object-cover"
              />
            ) : (
              <div className="flex h-14 w-24 shrink-0 items-center justify-center rounded-md bg-[#232325] font-mono text-xs text-[#85858B]">
                Audio
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-[#EDEDED]">{preview.title}</div>
              <div className="mt-1 text-xs text-[#A1A1A6]">{preview.artist}</div>
              <div className="mt-1 font-mono tabular-nums text-xs text-[#85858B]">
                {formatDuration(preview.duration)}
                {preview.chapterCount > 0 && ` · ${preview.chapterCount} chapters`}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Queue List */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-[#A1A1A6]">
            Queue <span className="font-mono text-[#85858B]">({jobs.length})</span>
          </h2>
          {jobs.some((j) => j.status === 'done' || j.status === 'error' || j.status === 'cancelled') && (
            <button
              type="button"
              onClick={() => void window.localify.downloader.clearCompleted()}
              className="flex h-8 items-center gap-2 rounded-lg border border-white/[0.08] bg-[#232325] px-3 text-xs font-medium text-[#A1A1A6] hover:text-[#EDEDED]"
            >
              <Trash2 size={16} strokeWidth={1.5} />
              <span>Clear finished</span>
            </button>
          )}
        </div>

        {jobs.length === 0 ? (
          <div className="rounded-xl border border-white/[0.08] bg-[#19191B] px-6 py-12 text-center text-sm text-[#85858B]">
            No active downloads
          </div>
        ) : (
          <div className="space-y-2">
            {jobs.map((job) => {
              const linkedTrack = job.outputTrackId ? trackMap.get(job.outputTrackId) : undefined;
              const isActive =
                job.status === 'queued' ||
                job.status === 'fetching' ||
                job.status === 'downloading' ||
                job.status === 'converting';

              return (
                <div
                  key={job.id}
                  className="flex items-center gap-4 rounded-xl border border-white/[0.08] bg-[#19191B] p-4"
                >
                  {job.thumbnail || linkedTrack?.coverUrl ? (
                    <img
                      src={linkedTrack?.coverUrl || job.thumbnail || ''}
                      alt={job.title}
                      className="h-12 w-12 shrink-0 rounded-md border border-white/[0.08] object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-white/[0.08] bg-[#141415] font-mono text-xs text-[#A1A1A6]">
                      {job.format}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate text-sm font-medium text-[#EDEDED]">{job.title}</div>
                      <span
                        className={`shrink-0 font-mono text-xs ${
                          job.status === 'done'
                            ? 'text-[#4CC38A]'
                            : job.status === 'error' || job.status === 'cancelled'
                              ? 'text-[#E5484D]'
                              : 'text-[#E0A23B]'
                        }`}
                      >
                        {job.status}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center gap-3">
                      <div className="h-[2px] flex-1 overflow-hidden rounded-full bg-white/[0.1]">
                        <div
                          className={`h-full transition-[width] duration-200 ${
                            job.status === 'error' || job.status === 'cancelled'
                              ? 'bg-[#E5484D]'
                              : job.status === 'done'
                                ? 'bg-[#4CC38A]'
                                : 'bg-[#E0A23B]'
                          }`}
                          style={{ width: `${job.progress}%` }}
                        />
                      </div>
                      <span className="w-10 text-right font-mono tabular-nums text-xs text-[#A1A1A6]">
                        {Math.round(job.progress)}%
                      </span>
                    </div>

                    <div className="mt-1 flex items-center justify-between font-mono text-xs text-[#85858B]">
                      <span className="truncate">
                        {job.error
                          ? job.error
                          : job.speed || job.eta
                            ? `${job.speed}${job.eta ? ` · ${job.eta}` : ''}`
                            : job.url}
                      </span>
                      <span className="ml-3 shrink-0">{job.format}</span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {job.status === 'done' && job.outputTrackId && (
                      <button
                        type="button"
                        onClick={() => onPlayTrackById(job.outputTrackId!)}
                        className="flex h-8 items-center gap-2 rounded-lg bg-[#EDEDED] px-3 text-xs font-medium text-[#0F0F10] hover:bg-white"
                      >
                        <Play size={16} strokeWidth={1.5} className="fill-[#0F0F10]" />
                        <span>Play</span>
                      </button>
                    )}
                    {isActive && (
                      <button
                        type="button"
                        onClick={() => void window.localify.downloader.cancel(job.id)}
                        className="rounded-md p-2 text-[#85858B] transition-colors duration-150 hover:text-[#E5484D]"
                        title="Cancel download"
                      >
                        <XCircle size={16} strokeWidth={1.5} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
