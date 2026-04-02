import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export function ReconnectBanner() {
  const { signIn, user } = useAuth();
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReconnect = async () => {
    setError(null);
    setSigning(true);
    try {
      await signIn();
    } catch {
      setError('Could not reconnect — tap to try again');
    } finally {
      setSigning(false);
    }
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-3 rounded-2xl bg-black/80 backdrop-blur-lg border border-white/10 px-5 py-3 shadow-2xl">
      {user?.picture ? (
        <img src={user.picture} alt={user.name} className="w-8 h-8 rounded-full ring-1 ring-white/20 shrink-0" />
      ) : (
        <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-sm font-bold text-white shrink-0">
          {user?.name?.charAt(0).toUpperCase() ?? '?'}
        </div>
      )}

      <div className="flex flex-col min-w-0">
        <span className="text-xs font-semibold text-white leading-tight">Session expired</span>
        {error ? (
          <span className="text-[0.65rem] text-red-400 leading-tight">{error}</span>
        ) : (
          <span className="text-[0.65rem] text-white/50 leading-tight">Retrying automatically…</span>
        )}
      </div>

      <button
        onClick={handleReconnect}
        disabled={signing}
        className="flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors disabled:opacity-60 disabled:pointer-events-none shrink-0"
      >
        <RefreshCw size={12} className={signing ? 'animate-spin' : ''} />
        {signing ? 'Reconnecting…' : 'Reconnect'}
      </button>
    </div>
  );
}
