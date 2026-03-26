import { useState, useEffect, useCallback } from 'react';
import type { EventIcon } from '../../types';
import { EVENT_ICON_MAP } from './EventIcons';

interface AddEventModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (event: {
    title: string;
    start: Date;
    end: Date;
    icon: EventIcon;
    color: string;
    allDay: boolean;
  }) => void;
  defaultDate?: Date;
}

const COLOR_PRESETS: { name: string; value: string }[] = [
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Teal', value: '#14b8a6' },
  { name: 'Amber', value: '#f59e0b' },
];

const ALL_ICONS = Object.keys(EVENT_ICON_MAP) as EventIcon[];

function toDateInputValue(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toTimeInputValue(d: Date): string {
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function AddEventModal({ open, onClose, onSave, defaultDate }: AddEventModalProps) {
  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState<EventIcon>('custom');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [allDay, setAllDay] = useState(false);
  const [color, setColor] = useState(COLOR_PRESETS[0].value);
  const [errors, setErrors] = useState<{ title?: string; date?: string }>({});

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      const base = defaultDate ?? new Date();
      setTitle('');
      setIcon('custom');
      setDate(toDateInputValue(base));
      setStartTime(toTimeInputValue(base));
      const endDefault = new Date(base.getTime() + 60 * 60 * 1000);
      setEndTime(toTimeInputValue(endDefault));
      setAllDay(false);
      setColor(COLOR_PRESETS[0].value);
      setErrors({});
    }
  }, [open, defaultDate]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  const validate = (): boolean => {
    const next: { title?: string; date?: string } = {};
    if (!title.trim()) next.title = 'Title is required';
    if (!date) next.date = 'Date is required';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;

    const [year, month, day] = date.split('-').map(Number);

    let start: Date;
    let end: Date;

    if (allDay) {
      start = new Date(year, month - 1, day, 0, 0, 0);
      end = new Date(year, month - 1, day, 23, 59, 59);
    } else {
      const [sh, sm] = startTime.split(':').map(Number);
      const [eh, em] = endTime.split(':').map(Number);
      start = new Date(year, month - 1, day, sh, sm, 0);
      end = new Date(year, month - 1, day, eh, em, 0);
    }

    onSave({ title: title.trim(), start, end, icon, color, allDay });
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="bg-slate-800 rounded-2xl w-full h-full sm:max-w-lg sm:max-h-[90vh] sm:h-auto mx-0 sm:mx-4 p-6 shadow-2xl overflow-y-auto flex flex-col">
        <h2 className="text-xl font-bold text-white mb-5">Add Event</h2>

        {/* Title */}
        <label className="block mb-4">
          <span className="text-sm font-medium text-slate-300">Event Title</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What's happening?"
            className="mt-1 w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {errors.title && <p className="mt-1 text-xs text-red-400">{errors.title}</p>}
        </label>

        {/* Icon Picker */}
        <fieldset className="mb-4">
          <legend className="text-sm font-medium text-slate-300 mb-2">Icon</legend>
          <div className="grid grid-cols-6 gap-2">
            {ALL_ICONS.map((key) => {
              const def = EVENT_ICON_MAP[key];
              const selected = icon === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setIcon(key)}
                  className={`flex flex-col items-center gap-0.5 rounded-lg p-1.5 transition-all ${
                    selected
                      ? 'ring-2 ring-blue-400 bg-slate-600'
                      : 'hover:bg-slate-700'
                  }`}
                  title={def.label}
                >
                  <span className="text-lg">{def.emoji}</span>
                  <span className="text-[10px] text-slate-400 leading-tight truncate w-full text-center">
                    {def.label}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* Date */}
        <label className="block mb-4">
          <span className="text-sm font-medium text-slate-300">Date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {errors.date && <p className="mt-1 text-xs text-red-400">{errors.date}</p>}
        </label>

        {/* All Day Toggle */}
        <label className="flex items-center gap-3 mb-4 cursor-pointer select-none">
          <div className="relative">
            <input
              type="checkbox"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-10 h-5 rounded-full bg-slate-600 peer-checked:bg-blue-500 transition-colors" />
            <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform peer-checked:translate-x-5" />
          </div>
          <span className="text-sm text-slate-300">All day</span>
        </label>

        {/* Time Inputs */}
        {!allDay && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <label className="block">
              <span className="text-sm font-medium text-slate-300">Start</span>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="mt-1 w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-300">End</span>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="mt-1 w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
          </div>
        )}

        {/* Color Picker */}
        <fieldset className="mb-6">
          <legend className="text-sm font-medium text-slate-300 mb-2">Color</legend>
          <div className="flex gap-2 flex-wrap">
            {COLOR_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => setColor(preset.value)}
                className={`w-8 h-8 rounded-full transition-all ${
                  color === preset.value ? 'ring-2 ring-offset-2 ring-offset-slate-800 ring-white scale-110' : 'hover:scale-110'
                }`}
                style={{ backgroundColor: preset.value }}
                title={preset.name}
              />
            ))}
          </div>
        </fieldset>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 transition-colors"
          >
            Save Event
          </button>
        </div>
      </div>
    </div>
  );
}
