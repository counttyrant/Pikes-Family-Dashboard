import { useMemo } from 'react';
import { differenceInCalendarDays, isToday, isTomorrow } from 'date-fns';
import { PartyPopper } from 'lucide-react';
import type { CountdownEvent } from '../../types';

interface CountdownProps {
  events: CountdownEvent[];
}

function daysLabel(eventDate: Date): string {
  if (isToday(eventDate)) return 'Today!';
  if (isTomorrow(eventDate)) return 'Tomorrow!';
  const diff = differenceInCalendarDays(eventDate, new Date());
  if (diff < 0) return 'Passed';
  return `${diff} day${diff === 1 ? '' : 's'}`;
}

export function Countdown({ events }: CountdownProps) {
  const sorted = useMemo(() => {
    const now = new Date();
    return [...events]
      .filter((e) => differenceInCalendarDays(new Date(e.date), now) >= 0)
      .sort(
        (a, b) =>
          new Date(a.date).getTime() - new Date(b.date).getTime(),
      )
      .slice(0, 5);
  }, [events]);

  if (sorted.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 py-6 text-white/30">
        <PartyPopper className="w-6 h-6" />
        <span className="text-sm">No upcoming events</span>
      </div>
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {sorted.map((evt) => {
        const eventDate = new Date(evt.date);
        const label = daysLabel(eventDate);
        const isSpecial = isToday(eventDate) || isTomorrow(eventDate);

        return (
          <div
            key={evt.id}
            className="flex flex-col items-center gap-2 rounded-xl px-5 py-4
                       border shrink-0 min-w-[120px]
                       transition-transform active:scale-95"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--theme-accent, #3b82f6) 8%, transparent)',
              borderColor: 'color-mix(in srgb, var(--theme-accent, #3b82f6) 15%, transparent)',
            }}
          >
            {/* Accent bar */}
            <div
              className="w-10 h-1 rounded-full"
              style={{ backgroundColor: evt.color }}
            />

            {/* Days count */}
            <span
              className={`text-2xl font-bold tabular-nums ${
                isSpecial ? 'text-amber-300' : 'text-white'
              }`}
            >
              {label}
            </span>

            {/* Title */}
            <span className="text-xs text-white/60 text-center leading-tight line-clamp-2">
              {evt.title}
            </span>
          </div>
        );
      })}
    </div>
  );
}
