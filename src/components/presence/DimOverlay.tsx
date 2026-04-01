import { useEffect, useState } from 'react';

interface DimOverlayProps {
  mode: 'partial' | 'black' | 'clock';
  /** Opacity percentage 10–90, used when mode === 'partial' */
  opacity?: number;
  onDismiss: () => void;
}

function useClock() {
  const [time, setTime] = useState(() => {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  });
  useEffect(() => {
    const id = setInterval(() => {
      setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 10000);
    return () => clearInterval(id);
  }, []);
  return time;
}

export function DimOverlay({ mode, opacity = 70, onDismiss }: DimOverlayProps) {
  const time = useClock();

  const bgOpacity = mode === 'partial' ? opacity / 100 : 1;
  const bg = `rgba(0,0,0,${bgOpacity})`;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center cursor-pointer animate-fade-in"
      style={{ background: bg }}
      onClick={onDismiss}
      onTouchStart={onDismiss}
      aria-label="Tap to wake"
    >
      {mode === 'clock' && (
        <div className="text-center select-none pointer-events-none">
          <p className="text-white font-thin tracking-widest" style={{ fontSize: 'clamp(4rem, 18vw, 14rem)' }}>
            {time}
          </p>
          <p className="text-white/40 text-lg mt-2 tracking-widest uppercase">
            {new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
      )}
      {mode === 'partial' && (
        <p className="text-white/20 text-sm tracking-widest select-none pointer-events-none">
          Tap to wake
        </p>
      )}
    </div>
  );
}

export default DimOverlay;
