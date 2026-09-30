import { useState } from 'react';
import { Images, Check, Loader2 } from 'lucide-react';
import { fetchImmichAlbums } from '../../services/immich';
import { saveSettings } from '../../services/storage';
import type { DashboardSettings } from '../../types';

type Album = { id: string; albumName: string; assetCount: number };

interface Props {
  settings: DashboardSettings | null;
}

export function AlbumSwitcher({ settings }: Props) {
  const [open, setOpen] = useState(false);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!settings || settings.photoSource !== 'immich' || !settings.immichUrl || !settings.immichApiKey) {
    return null;
  }

  const toggleOpen = async () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    setLoading(true);
    setError('');
    try {
      const list = await fetchImmichAlbums(settings.immichUrl, settings.immichApiKey);
      list.sort((a, b) => a.albumName.localeCompare(b.albumName));
      setAlbums(list);
      if (list.length === 0) setError('No albums found');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load albums');
    }
    setLoading(false);
  };

  const selectAlbum = async (id: string) => {
    setOpen(false);
    if (id !== settings.immichAlbumId) await saveSettings({ immichAlbumId: id });
  };

  return (
    <div className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); toggleOpen(); }}
        className={`rounded-full p-3 backdrop-blur-sm transition-colors ${open ? 'bg-blue-500/60' : 'bg-black/40 hover:bg-black/60'}`}
        title="Switch photo album"
      >
        <Images size={20} />
      </button>

      {open && (
        <>
          {/* Backdrop closes the menu on outside tap */}
          <div
            className="fixed inset-0 z-40"
            onClick={(e) => { e.stopPropagation(); setOpen(false); }}
            onTouchEnd={(e) => e.stopPropagation()}
          />
          <div
            className="no-swipe absolute right-0 top-full mt-2 z-50 w-72 max-h-[60vh] overflow-y-auto rounded-2xl bg-black/80 backdrop-blur-md border border-white/10 p-2 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            <p className="px-3 py-1.5 text-xs uppercase tracking-wide text-white/40">Photo album</p>
            {loading && (
              <div className="flex items-center gap-2 px-3 py-3 text-sm text-white/60">
                <Loader2 size={16} className="animate-spin" /> Loading albums…
              </div>
            )}
            {!loading && error && <p className="px-3 py-2 text-sm text-red-400">{error}</p>}
            {!loading && albums.map((a) => {
              const active = a.id === settings.immichAlbumId;
              return (
                <button
                  key={a.id}
                  onClick={() => selectAlbum(a.id)}
                  className={`w-full flex items-center gap-2 text-left px-3 py-3 text-sm rounded-xl transition-colors ${
                    active ? 'bg-blue-500/30 text-blue-200' : 'text-white/80 hover:bg-white/10'
                  }`}
                >
                  <span className="flex-1 truncate">{a.albumName}</span>
                  <span className="text-xs text-white/40">{a.assetCount}</span>
                  {active && <Check size={16} />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
