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
  calendarColors?: Record<string, string>;
  eventColorOverrides?: Record<string, string>;
  onEventColorChange?: (eventId: string, color: string) => void;
}

export function Calendar({ events, accessToken, calendarColors = {}, eventColorOverrides = {}, onEventColorChange }: CalendarProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [colorPickerEvent, setColorPickerEvent] = useState<string | null>(null);

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
                ${today ? 'ring-1' : ''}
              `}
              style={{
                backgroundColor: today
                  ? 'color-mix(in srgb, var(--theme-accent, #3b82f6) 15%, transparent)'
                  : 'color-mix(in srgb, var(--theme-accent, #3b82f6) 5%, transparent)',
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
                {dayEvents.map((evt) => {
                  const dotColor = eventColorOverrides[evt.id] || calendarColors[evt.calendarId] || evt.color;
                  return (
                    <div key={evt.id} className="relative">
                      <button
                        className="flex items-start gap-1.5 rounded-md px-1.5 py-1 text-left w-full
                                   hover:bg-white/10 active:bg-white/15 transition-colors"
                        onClick={() => setColorPickerEvent(colorPickerEvent === evt.id ? null : evt.id)}
                      >
                        {/* Icon or color dot — color-coded by calendar */}
                        {evt.icon && evt.icon in EVENT_ICON_MAP ? (
                          <EventIconBadge icon={evt.icon} size="sm" />
                        ) : (
                          <span
                            className="mt-1 w-2.5 h-2.5 rounded-full shrink-0 cursor-pointer ring-1 ring-white/20"
                            style={{ backgroundColor: dotColor }}
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

                      {/* Inline color picker */}
                      {colorPickerEvent === evt.id && onEventColorChange && (
                        <div className="flex gap-1 flex-wrap px-1.5 py-1 bg-black/40 rounded-md mt-0.5">
                          {['#3b82f6','#22c55e','#ef4444','#f97316','#a855f7','#ec4899','#14b8a6','#f59e0b','#6366f1','#8b5cf6'].map((c) => (
                            <button
                              key={c}
                              onClick={() => { onEventColorChange(evt.id, c); setColorPickerEvent(null); }}
                              className={`w-4 h-4 rounded-full transition-transform hover:scale-125 ${dotColor === c ? 'ring-1 ring-white scale-125' : ''}`}
                              style={{ backgroundColor: c }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

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
