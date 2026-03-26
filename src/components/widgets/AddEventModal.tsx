import { useState, useEffect } from 'react';
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

  const validate = (): boolean => {
    const next: { title?: string; date?: string } = {};
    if (!title.trim()) next.title = 'Title is required';
    if (!date) next.date = 'Date is required';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleIconSelect = (key: EventIcon) => {
    setIcon(key);
    // Prepend emoji to title if empty or starts with a previous emoji
    const def = EVENT_ICON_MAP[key];
    const cleaned = title.replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}]\s*/u, '').trim();
    if (key !== 'custom') {
      setTitle(`${def.emoji} ${cleaned}`);
    } else {
      setTitle(cleaned);
    }
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
    <div className="fixed inset-0 z-50 bg-slate-900/95 backdrop-blur-sm overflow-y-auto">
      <div className="min-h-full flex flex-col p-4 sm:p-8 max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">Add Event</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-3xl leading-none p-2"
          >
            ✕
          </button>
        </div>

        {/* Title with emoji support */}
        <label className="block mb-6">
          <span className="text-base font-medium text-slate-300">Event Title</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="🎉 What's happening?"
            className="mt-2 w-full rounded-xl bg-slate-700 border border-slate-600 px-4 py-3 text-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {errors.title && <p className="mt-1 text-sm text-red-400">{errors.title}</p>}
        </label>

        {/* Icon Picker — large touch-friendly grid */}
        <fieldset className="mb-6">
          <legend className="text-base font-medium text-slate-300 mb-3">Icon (tap to add to title)</legend>
          <div className="grid grid-cols-6 sm:grid-cols-9 gap-3">
            {ALL_ICONS.map((key) => {
              const def = EVENT_ICON_MAP[key];
              const selected = icon === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleIconSelect(key)}
                  className={`flex flex-col items-center gap-1 rounded-xl p-3 transition-all ${
                    selected
                      ? 'ring-2 ring-blue-400 bg-slate-600 scale-105'
                      : 'hover:bg-slate-700 active:scale-95'
                  }`}
                  title={def.label}
                >
                  <span className="text-3xl sm:text-4xl">{def.emoji}</span>
                  <span className="text-xs text-slate-400 leading-tight truncate w-full text-center">
                    {def.label}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* Date */}
        <label className="block mb-5">
          <span className="text-base font-medium text-slate-300">Date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-2 w-full rounded-xl bg-slate-700 border border-slate-600 px-4 py-3 text-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {errors.date && <p className="mt-1 text-sm text-red-400">{errors.date}</p>}
        </label>

        {/* All Day Toggle */}
        <label className="flex items-center gap-3 mb-5 cursor-pointer select-none">
          <div className="relative">
            <input
              type="checkbox"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-12 h-6 rounded-full bg-slate-600 peer-checked:bg-blue-500 transition-colors" />
            <div className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform peer-checked:translate-x-6" />
          </div>
          <span className="text-base text-slate-300">All day</span>
        </label>

        {/* Time Inputs */}
        {!allDay && (
          <div className="grid grid-cols-2 gap-4 mb-5">
            <label className="block">
              <span className="text-base font-medium text-slate-300">Start</span>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="mt-2 w-full rounded-xl bg-slate-700 border border-slate-600 px-4 py-3 text-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <label className="block">
              <span className="text-base font-medium text-slate-300">End</span>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="mt-2 w-full rounded-xl bg-slate-700 border border-slate-600 px-4 py-3 text-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
          </div>
        )}

        {/* Color Picker */}
        <fieldset className="mb-8">
          <legend className="text-base font-medium text-slate-300 mb-3">Color</legend>
          <div className="flex gap-3 flex-wrap">
            {COLOR_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => setColor(preset.value)}
                className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full transition-all ${
                  color === preset.value ? 'ring-3 ring-offset-2 ring-offset-slate-900 ring-white scale-110' : 'hover:scale-110 active:scale-95'
                }`}
                style={{ backgroundColor: preset.value }}
                title={preset.name}
              />
            ))}
          </div>
        </fieldset>

        {/* Actions — large touch buttons */}
        <div className="flex gap-4 mt-auto pt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-6 py-4 rounded-xl text-lg font-medium text-slate-300 bg-slate-700 hover:bg-slate-600 transition-colors active:scale-95"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 px-6 py-4 rounded-xl text-lg font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors active:scale-95"
          >
            Save Event
          </button>
        </div>
      </div>
    </div>
  );
}
