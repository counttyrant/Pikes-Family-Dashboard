import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isToday,
  format,
} from 'date-fns';
import { Plus } from 'lucide-react';
import type { CalendarEvent, EventIcon, LocalCalendarEvent } from '../../types';
import { EVENT_ICON_MAP, EventIconBadge } from './EventIcons';
import { AddEventModal } from './AddEventModal';
import { addLocalEvent } from '../../services/storage';
import { createCalendarEvent } from '../../services/googleCalendar';
import { db } from '../../db';

interface CalendarProps {
  events: CalendarEvent[];
  accessToken?: string | null;
}

export function Calendar({ events, accessToken }: CalendarProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();

  const localEvents = useLiveQuery(() => db.localEvents.toArray()) ?? [];

  const allEvents = useMemo(() => {
    const mapped: CalendarEvent[] = localEvents.map((le: LocalCalendarEvent) => ({
      id: le.id,
      title: le.title,
      start: le.start,
      end: le.end,
      calendarId: 'local',
      color: le.color,
      icon: le.icon,
      allDay: le.allDay,
      isLocal: true,
    }));
    return [...events, ...mapped];
  }, [events, localEvents]);

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
        allEvents
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
  }, [days, allEvents]);

  const handleAddEvent = async (eventData: {
    title: string;
    start: Date;
    end: Date;
    icon: EventIcon;
    color: string;
    allDay: boolean;
  }) => {
    // Save locally
    await addLocalEvent({
      title: eventData.title,
      start: eventData.start,
      end: eventData.end,
      color: eventData.color,
      icon: eventData.icon,
      allDay: eventData.allDay,
    });

    // Also push to Google Calendar if connected
    if (accessToken) {
      try {
        await createCalendarEvent(accessToken, {
          title: eventData.title,
          start: eventData.start,
          end: eventData.end,
          allDay: eventData.allDay,
        });
      } catch (err) {
        console.warn('Failed to push event to Google Calendar:', err);
      }
    }
  };

  return (
    <>
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
                ${today ? 'ring-1' : 'bg-white/5'}
              `}
              style={{
                backgroundColor: today ? 'color-mix(in srgb, var(--theme-accent, #3b82f6) 15%, transparent)' : undefined,
                ...(today ? { '--tw-ring-color': 'color-mix(in srgb, var(--theme-accent, #3b82f6) 40%, transparent)' } as React.CSSProperties : {}),
              }}
            >
              {/* Day header */}
              <div className="flex items-center justify-between mb-2 shrink-0">
                <div className="flex flex-col items-center flex-1">
                  <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-white/50">
                    {format(day, 'EEE')}
                  </span>
                  <span
                    className="text-xl font-semibold leading-tight"
                    style={{ color: today ? 'var(--theme-accent-light, #60a5fa)' : 'rgba(255,255,255,0.9)' }}
                  >
                    {format(day, 'd')}
                  </span>
                </div>
                <button
                  onClick={() => { setSelectedDate(day); setShowAddModal(true); }}
                  className="p-1 rounded-full hover:bg-white/10 transition-colors opacity-40 hover:opacity-100"
                  title="Add event"
                >
                  <Plus size={14} />
                </button>
              </div>

              {/* Events list */}
              <div className="flex flex-col gap-1.5 overflow-y-auto min-h-0 flex-1">
                {dayEvents.map((evt) => (
                  <button
                    key={evt.id}
                    className="flex items-start gap-1.5 rounded-md px-1.5 py-1 text-left
                               hover:bg-white/10 active:bg-white/15 transition-colors"
                  >
                    {/* Icon or color dot */}
                    {evt.icon && evt.icon in EVENT_ICON_MAP ? (
                      <EventIconBadge icon={evt.icon} size="sm" />
                    ) : (
                      <span
                        className="mt-1 w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: evt.color }}
                      />
                    )}

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

      <AddEventModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleAddEvent}
        defaultDate={selectedDate}
      />
    </>
  );
}
