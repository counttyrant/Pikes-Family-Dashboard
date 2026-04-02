import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';

const CLOCK_W = 320; // approximate width of the clock box
const CLOCK_H = 130; // approximate height
const SPEED = 0.6;   // pixels per frame (~36px/s at 60fps)

interface Pos { x: number; y: number }
interface Vel { dx: number; dy: number }

// Rotate through a handful of soft colours to vary the pixel load
const COLORS = ['#6366f1', '#3b82f6', '#22c55e', '#f59e0b', '#ec4899', '#14b8a6'];

export function BouncingClock() {
  const [now, setNow] = useState(new Date());
  const [colorIdx, setColorIdx] = useState(0);

  const posRef = useRef<Pos>({ x: 100, y: 100 });
  const velRef = useRef<Vel>({ dx: SPEED, dy: SPEED });
  const [renderPos, setRenderPos] = useState<Pos>({ x: 100, y: 100 });

  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  // Clock tick
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Bounce animation
  useEffect(() => {
    const animate = (ts: number) => {
      const dt = lastTimeRef.current ? Math.min(ts - lastTimeRef.current, 50) : 16;
      lastTimeRef.current = ts;

      const maxX = window.innerWidth - CLOCK_W;
      const maxY = window.innerHeight - CLOCK_H;

      let { x, y } = posRef.current;
      let { dx, dy } = velRef.current;

      x += dx * (dt / 16);
      y += dy * (dt / 16);

      let bounced = false;

      if (x <= 0) { x = 0; dx = Math.abs(dx); bounced = true; }
      if (x >= maxX) { x = maxX; dx = -Math.abs(dx); bounced = true; }
      if (y <= 0) { y = 0; dy = Math.abs(dy); bounced = true; }
      if (y >= maxY) { y = maxY; dy = -Math.abs(dy); bounced = true; }

      if (bounced) {
        setColorIdx((c) => (c + 1) % COLORS.length);
      }

      posRef.current = { x, y };
      velRef.current = { dx, dy };
      setRenderPos({ x: Math.round(x), y: Math.round(y) });

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const color = COLORS[colorIdx];
  const timeStr = format(now, 'h:mm');
  const secondsStr = format(now, 'ss');
  const period = format(now, 'a');
  const dateStr = format(now, 'EEEE, MMMM d');

  return (
    <div className="fixed inset-0 z-[300] bg-black" style={{ touchAction: 'none' }}>
      {/* Bouncing clock element */}
      <div
        className="absolute select-none pointer-events-none"
        style={{
          left: renderPos.x,
          top: renderPos.y,
          width: CLOCK_W,
          transition: 'none',
        }}
      >
        {/* Time */}
        <div className="flex items-end gap-2 leading-none">
          <span
            className="font-bold tabular-nums"
            style={{ fontSize: 96, color, lineHeight: 1 }}
          >
            {timeStr}
          </span>
          <div className="flex flex-col items-start pb-2" style={{ color, opacity: 0.7 }}>
            <span className="text-3xl font-semibold tabular-nums leading-none">{secondsStr}</span>
            <span className="text-xl font-medium leading-none mt-0.5">{period}</span>
          </div>
        </div>

        {/* Date */}
        <p className="text-base font-medium mt-1" style={{ color, opacity: 0.6 }}>
          {dateStr}
        </p>
      </div>
    </div>
  );
}
