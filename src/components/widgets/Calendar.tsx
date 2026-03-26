import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  startOfWeek,
  endOfWeek,
  addDays,
  eachDayOfInterval,
  isSameDay,
  isToday,
  format,
} from 'date-fns';
import { Plus, ChevronDown } from 'lucide-react';
import type { CalendarEvent, EventIcon, LocalCalendarEvent } from '../../types';
import { EVENT_ICON_MAP, EventIconBadge } from './EventIcons';
import { AddEventModal } from './AddEventModal';
import { addLocalEvent } from '../../services/storage';
import { createCalendarEvent } from '../../services/googleCalendar';
import { db } from '../../db';

const DAY_OPTIONS = [1, 3, 5, 7, 14];
const WEEK_START_LABELS: Record<number, string> = { 0: 'Sun', 1: 'Mon' };

interface CalendarProps {
  events: CalendarEvent[];
  accessToken?: string | null;
  calendarColors?: Record<string, string>;
  eventColorOverrides?: Record<string, string>;
  onEventColorChange?: (eventId: string, color: string) => void;
  daysToShow: number;
  weekStartsOn: 0 | 1;
  onDaysToShowChange: (days: number) => void;
  onWeekStartsOnChange: (day: 0 | 1) => void;
}

export function Calendar({
  events,
  accessToken,
  calendarColors = {},
  eventColorOverrides = {},
  onEventColorChange,
  daysToShow,
  weekStartsOn,
  onDaysToShowChange,
  onWeekStartsOnChange,
}: CalendarProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [colorPickerEvent, setColorPickerEvent] = useState<string | null>(null);
  const [showViewMenu, setShowViewMenu] = useState(false);

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
    if (daysToShow === 7 || daysToShow === 14) {
      const start = startOfWeek(now, { weekStartsOn });
      const end = daysToShow === 14
        ? addDays(endOfWeek(now, { weekStartsOn }), 7)
        : endOfWeek(now, { weekStartsOn });
      return eachDayOfInterval({ start, end });
    }
    // For 1, 3, 5 — show today + next N-1 days
    return eachDayOfInterval({ start: now, end: addDays(now, daysToShow - 1) });
  }, [daysToShow, weekStartsOn]);

  const cols = Math.min(daysToShow, 7);

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
    await addLocalEvent({
      title: eventData.title,
      start: eventData.start,
      end: eventData.end,
      color: eventData.color,
      icon: eventData.icon,
      allDay: eventData.allDay,
    });

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
      {/* View controls */}
      <div className="flex items-center gap-2 mb-2 relative">
        <button
          onClick={() => setShowViewMenu(!showViewMenu)}
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/10 hover:bg-white/15 transition-colors text-xs text-white/70"
        >
          {daysToShow}‑day · {WEEK_START_LABELS[weekStartsOn]} start
          <ChevronDown size={12} />
        </button>

        {showViewMenu && (
          <div
            className="absolute top-8 left-0 z-50 bg-slate-800 border border-white/10 rounded-xl shadow-2xl p-3 min-w-[180px]"
            onMouseLeave={() => setShowViewMenu(false)}
          >
            <p className="text-[0.6rem] uppercase tracking-wider text-white/40 font-semibold mb-1.5">Days shown</p>
            <div className="flex gap-1 mb-3">
              {DAY_OPTIONS.map((n) => (
                <button
                  key={n}
                  onClick={() => { onDaysToShowChange(n); }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    daysToShow === n
                      ? 'bg-blue-500 text-white'
                      : 'bg-white/10 text-white/60 hover:bg-white/20'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="text-[0.6rem] uppercase tracking-wider text-white/40 font-semibold mb-1.5">Week starts on</p>
            <div className="flex gap-1">
              {([0, 1] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => { onWeekStartsOnChange(d); }}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    weekStartsOn === d
                      ? 'bg-blue-500 text-white'
                      : 'bg-white/10 text-white/60 hover:bg-white/20'
                  }`}
                >
                  {d === 0 ? 'Sunday' : 'Monday'}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div
        className="grid gap-1 h-full"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
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
