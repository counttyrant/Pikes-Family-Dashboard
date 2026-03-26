import { useMemo } from 'react';
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isToday,
  format,
} from 'date-fns';
import type { CalendarEvent } from '../../types';

interface CalendarProps {
  events: CalendarEvent[];
}

export function Calendar({ events }: CalendarProps) {
  const days = useMemo(() => {
    const now = new Date();
    const start = startOfWeek(now, { weekStartsOn: 1 });
    const end = endOfWeek(now, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, []);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const day of days) {
      const key = format(day, 'yyyy-MM-dd');
      map.set(
        key,
        events
          .filter(
            (e) =>
              isSameDay(new Date(e.start), day) ||
              isSameDay(new Date(e.end), day),
          )
          .sort(
            (a, b) =>
              new Date(a.start).getTime() - new Date(b.start).getTime(),
          ),
      );
    }
    return map;
  }, [days, events]);

  return (
    <div className="grid grid-cols-7 gap-1 h-full">
      {days.map((day) => {
        const key = format(day, 'yyyy-MM-dd');
        const dayEvents = eventsByDay.get(key) ?? [];
        const today = isToday(day);

        return (
          <div
            key={key}
            className={`
              flex flex-col rounded-lg p-2 min-h-0
              ${today ? 'bg-blue-500/20 ring-1 ring-blue-400/40' : 'bg-white/5'}
            `}
          >
            {/* Day header */}
            <div className="flex flex-col items-center mb-2 shrink-0">
              <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-white/50">
                {format(day, 'EEE')}
              </span>
              <span
                className={`
                  text-xl font-semibold leading-tight
                  ${today ? 'text-blue-400' : 'text-white/90'}
                `}
              >
                {format(day, 'd')}
              </span>
            </div>

            {/* Events list – scrollable */}
            <div className="flex flex-col gap-1.5 overflow-y-auto min-h-0 flex-1">
              {dayEvents.map((evt) => (
                <button
                  key={evt.id}
                  className="flex items-start gap-1.5 rounded-md px-1.5 py-1 text-left
                             hover:bg-white/10 active:bg-white/15 transition-colors"
                >
                  {/* Color dot */}
                  <span
                    className="mt-1 w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: evt.color }}
                  />

                  <div className="flex flex-col min-w-0 flex-1">
                    {!evt.allDay && (
                      <span className="text-[0.6rem] text-white/40 tabular-nums">
                        {format(new Date(evt.start), 'h:mm a')}
                      </span>
                    )}
                    <span className="text-xs text-white/90 leading-tight truncate">
                      {evt.title}
                    </span>
                  </div>

                  {/* Event thumbnail */}
                  {evt.imageUrl && (
                    <img
                      src={evt.imageUrl}
                      alt=""
                      className="w-7 h-7 rounded object-cover shrink-0 mt-0.5"
                    />
                  )}
                </button>
              ))}

              {dayEvents.length === 0 && (
                <span className="text-[0.6rem] text-white/20 text-center mt-2">
                  No events
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
