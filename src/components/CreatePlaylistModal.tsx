import { X } from 'lucide-react';
import { useEffect, useState } from 'react';

interface CreatePlaylistModalProps {
  onCreate: (name: string, description: string) => Promise<void>;
  onClose: () => void;
}

export function CreatePlaylistModal({ onCreate, onClose }: CreatePlaylistModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await onCreate(name.trim(), description.trim());
      onClose();
    } finally {
      setSubmitting(false);
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
        className="w-full max-w-md rounded-2xl border border-white/[0.12] bg-[#19191B] p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-medium text-[#EDEDED]">New playlist</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[#85858B] hover:bg-[#232325] hover:text-[#EDEDED]"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#A1A1A6]">Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Late night sets"
              className="h-9 w-full rounded-lg border border-white/[0.08] bg-[#141415] px-3 text-sm text-[#EDEDED] placeholder-[#85858B] focus:border-white/[0.2] focus:outline-none"
              autoFocus
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[#A1A1A6]">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional note"
              className="h-9 w-full rounded-lg border border-white/[0.08] bg-[#141415] px-3 text-sm text-[#EDEDED] placeholder-[#85858B] focus:border-white/[0.2] focus:outline-none"
            />
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
            disabled={submitting || !name.trim()}
            className="h-9 rounded-lg bg-[#EDEDED] px-4 text-xs font-medium text-[#0F0F10] hover:bg-white disabled:opacity-40"
          >
            {submitting ? 'Creating' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
}
