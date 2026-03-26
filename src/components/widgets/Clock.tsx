import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Minus, Plus } from 'lucide-react';

const SIZE_KEY = 'pfd-clock-size';
const SIZES = [
  { time: 'text-[4rem]', date: 'text-base', ampm: 'text-lg', label: 'S' },
  { time: 'text-[5rem]', date: 'text-lg', ampm: 'text-xl', label: 'M' },
  { time: 'text-[6.5rem]', date: 'text-xl', ampm: 'text-2xl', label: 'L' },
  { time: 'text-[8rem]', date: 'text-2xl', ampm: 'text-3xl', label: 'XL' },
  { time: 'text-[10rem]', date: 'text-3xl', ampm: 'text-4xl', label: '2XL' },
];

function loadSize(): number {
  try {
    const v = parseInt(localStorage.getItem(SIZE_KEY) || '3', 10);
    return Math.max(0, Math.min(SIZES.length - 1, v));
  } catch { return 3; }
}

export function Clock() {
  const [now, setNow] = useState(new Date());
  const [colonVisible, setColonVisible] = useState(true);
  const [sizeIdx, setSizeIdx] = useState(loadSize);
  const [showControls, setShowControls] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
      setColonVisible((v) => !v);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    localStorage.setItem(SIZE_KEY, String(sizeIdx));
  }, [sizeIdx]);

  // Auto-hide controls after 4 seconds
  useEffect(() => {
    if (!showControls) return;
    const t = setTimeout(() => setShowControls(false), 4000);
    return () => clearTimeout(t);
  }, [showControls, sizeIdx]);

  const hours = format(now, 'hh');
  const minutes = format(now, 'mm');
  const ampm = format(now, 'a');
  const dateStr = format(now, 'EEEE, MMMM d, yyyy');
  const s = SIZES[sizeIdx];

  return (
    <div
      className="flex flex-col items-center justify-center select-none relative h-full"
      onClick={() => setShowControls(true)}
    >
      {/* Size controls */}
      {showControls && (
        <div
          className="absolute top-1 right-1 flex items-center gap-1 bg-slate-800/90 rounded-lg px-2 py-1 z-10 border border-white/10"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => setSizeIdx((i) => Math.max(0, i - 1))}
            disabled={sizeIdx === 0}
            className="p-1 rounded hover:bg-white/10 disabled:opacity-30 transition-colors"
          >
            <Minus size={14} className="text-white" />
          </button>
          <span className="text-xs text-white/60 w-8 text-center font-medium">{s.label}</span>
          <button
            onClick={() => setSizeIdx((i) => Math.min(SIZES.length - 1, i + 1))}
            disabled={sizeIdx === SIZES.length - 1}
            className="p-1 rounded hover:bg-white/10 disabled:opacity-30 transition-colors"
          >
            <Plus size={14} className="text-white" />
          </button>
        </div>
      )}

      <div className="flex items-baseline gap-1" style={{ textShadow: '0 2px 12px rgba(0,0,0,0.8), 0 0 40px rgba(0,0,0,0.5)' }}>
        <span className={`${s.time} font-extralight tracking-tight text-white leading-none tabular-nums`}>
          {hours}
        </span>
        <span
          className={`${s.time} font-extralight text-white leading-none transition-opacity duration-300`}
          style={{ opacity: colonVisible ? 1 : 0.2 }}
        >
          :
        </span>
        <span className={`${s.time} font-extralight tracking-tight text-white leading-none tabular-nums`}>
          {minutes}
        </span>
        <span className={`${s.ampm} font-light text-white/70 ml-2 self-end mb-2`}>
          {ampm}
        </span>
      </div>
      <p
        className={`${s.date} font-light text-white/80 tracking-wide mt-1`}
        style={{ textShadow: '0 2px 8px rgba(0,0,0,0.7)' }}
      >
        {dateStr}
      </p>
    </div>
  );
}
