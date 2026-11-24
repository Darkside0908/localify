import { CheckCircle2, FolderOpen, X, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AppSettings, AudioFormat, BinaryStatus, SystemDiagnostics } from '../types';

interface SettingsModalProps {
  settings: AppSettings;
  onSave: (patch: Partial<AppSettings>) => Promise<void>;
  onClose: () => void;
}

function BinaryRow({ label, status }: { label: string; status: BinaryStatus }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-white/[0.08] bg-[#141415] px-3 py-2 text-xs">
      <div className="min-w-0">
        <div className="flex items-center gap-2 font-medium text-[#EDEDED]">
          {status.found ? (
            <CheckCircle2 size={16} strokeWidth={1.5} className="shrink-0 text-[#4CC38A]" />
          ) : (
            <XCircle size={16} strokeWidth={1.5} className="shrink-0 text-[#E5484D]" />
          )}
          <span>{label}</span>
        </div>
        <div className="mt-1 truncate font-mono text-xs text-[#85858B]">
          {status.path || 'Not found in PATH'}
        </div>
      </div>
      <span className="max-w-[160px] shrink-0 truncate font-mono text-xs text-[#A1A1A6]">
        {status.version || (status.found ? 'Available' : 'Missing')}
      </span>
    </div>
  );
}

export function SettingsModal({ settings, onSave, onClose }: SettingsModalProps) {
  const [musicDir, setMusicDir] = useState(settings.musicDir);
  const [audioFormat, setAudioFormat] = useState<AudioFormat>(settings.audioFormat);
  const [noPlaylistByDefault, setNoPlaylistByDefault] = useState(settings.noPlaylistByDefault);
  const [resumeThresholdSeconds, setResumeThresholdSeconds] = useState(
    settings.resumeThresholdSeconds,
  );
  const [diagnostics, setDiagnostics] = useState<SystemDiagnostics | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    void window.localify.system
      .getDiagnostics()
      .then(setDiagnostics)
      .catch(() => setDiagnostics(null));
  }, []);

  const handleChooseFolder = async () => {
    const selected = await window.localify.settings.chooseFolder();
    if (selected) {
      setMusicDir(selected);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        musicDir: musicDir.trim() || settings.musicDir,
        audioFormat,
        noPlaylistByDefault,
        resumeThresholdSeconds,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/[0.12] bg-[#19191B] p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-medium text-[#EDEDED]">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[#85858B] hover:bg-[#232325] hover:text-[#EDEDED]"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {/* Music Folder */}
          <div>
            <label className="mb-1 block text-xs font-medium text-[#A1A1A6]">Music folder</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={musicDir}
                onChange={(e) => setMusicDir(e.target.value)}
                className="h-9 min-w-0 flex-1 rounded-lg border border-white/[0.08] bg-[#141415] px-3 font-mono text-xs text-[#EDEDED] focus:border-white/[0.2] focus:outline-none"
              />
              <button
                type="button"
                onClick={handleChooseFolder}
                className="flex h-9 shrink-0 items-center gap-2 rounded-lg border border-white/[0.08] bg-[#232325] px-3 text-xs font-medium text-[#EDEDED] hover:bg-[#2B2B2E]"
              >
                <FolderOpen size={16} strokeWidth={1.5} className="text-[#85858B]" />
                <span>Browse</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#A1A1A6]">
                Default format
              </label>
              <select
                value={audioFormat}
                onChange={(e) => setAudioFormat(e.target.value as AudioFormat)}
                className="h-9 w-full rounded-lg border border-white/[0.08] bg-[#141415] px-3 text-xs text-[#EDEDED] focus:border-white/[0.2] focus:outline-none"
              >
                <option value="mp3">MP3</option>
                <option value="m4a">M4A</option>
                <option value="opus">OPUS</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[#A1A1A6]">
                Auto-resume sets
              </label>
              <select
                value={resumeThresholdSeconds}
                onChange={(e) => setResumeThresholdSeconds(Number(e.target.value))}
                className="h-9 w-full rounded-lg border border-white/[0.08] bg-[#141415] px-3 text-xs text-[#EDEDED] focus:border-white/[0.2] focus:outline-none"
              >
                <option value={300}>5 min or longer</option>
                <option value={600}>10 min or longer</option>
                <option value={1200}>20 min or longer</option>
                <option value={9999999}>Off</option>
              </select>
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/[0.08] bg-[#141415] px-3 py-2 text-xs text-[#A1A1A6]">
            <input
              type="checkbox"
              checked={noPlaylistByDefault}
              onChange={(e) => setNoPlaylistByDefault(e.target.checked)}
              className="h-4 w-4 rounded accent-[#E0A23B]"
            />
            <span>Use --no-playlist by default when downloading URLs</span>
          </label>

          <div className="pt-2">
            <div className="mb-2 text-xs font-medium text-[#85858B]">Media binaries</div>
            {diagnostics ? (
              <div className="space-y-2">
                <BinaryRow label="yt-dlp" status={diagnostics.ytdlp} />
                <BinaryRow label="ffmpeg" status={diagnostics.ffmpeg} />
                <BinaryRow label="ffprobe" status={diagnostics.ffprobe} />
                <div className="pt-1 font-mono text-xs text-[#85858B]">
                  Data: {diagnostics.dataDir}
                </div>
              </div>
            ) : (
              <div className="text-xs text-[#85858B]">Checking binaries</div>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg border border-white/[0.08] bg-[#232325] px-4 text-xs font-medium text-[#EDEDED] hover:bg-[#2B2B2E]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="h-9 rounded-lg bg-[#EDEDED] px-4 text-xs font-medium text-[#0F0F10] hover:bg-white disabled:opacity-50"
          >
            {saving ? 'Saving' : 'Save settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
