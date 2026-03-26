import { useState, useEffect } from 'react';
import { format } from 'date-fns';

export function Clock() {
  const [now, setNow] = useState(new Date());
  const [colonVisible, setColonVisible] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
      setColonVisible((v) => !v);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const hours = format(now, 'hh');
  const minutes = format(now, 'mm');
  const ampm = format(now, 'a');
  const dateStr = format(now, 'EEEE, MMMM d, yyyy');

  return (
    <div className="flex flex-col items-center justify-center select-none">
      <div className="flex items-baseline gap-1" style={{ textShadow: '0 2px 12px rgba(0,0,0,0.8), 0 0 40px rgba(0,0,0,0.5)' }}>
        <span className="text-[8rem] font-extralight tracking-tight text-white leading-none tabular-nums">
          {hours}
        </span>
        <span
          className="text-[8rem] font-extralight text-white leading-none transition-opacity duration-300"
          style={{ opacity: colonVisible ? 1 : 0.2 }}
        >
          :
        </span>
        <span className="text-[8rem] font-extralight tracking-tight text-white leading-none tabular-nums">
          {minutes}
        </span>
        <span className="text-3xl font-light text-white/70 ml-2 self-end mb-5">
          {ampm}
        </span>
      </div>
      <p
        className="text-2xl font-light text-white/80 tracking-wide mt-1"
        style={{ textShadow: '0 2px 8px rgba(0,0,0,0.7)' }}
      >
        {dateStr}
      </p>
    </div>
  );
}
