import type { EventIcon } from '../../types';

export const EVENT_ICON_MAP: Record<EventIcon, { emoji: string; label: string; color: string }> = {
  playtime: { emoji: '🎮', label: 'Play Time', color: '#22c55e' },
  bedtime: { emoji: '🌙', label: 'Bed Time', color: '#6366f1' },
  dinner: { emoji: '🍽️', label: 'Dinner', color: '#f97316' },
  movies: { emoji: '🎬', label: 'Movies', color: '#ef4444' },
  cleanup: { emoji: '🧹', label: 'Clean Up', color: '#14b8a6' },
  school: { emoji: '📚', label: 'School', color: '#3b82f6' },
  sports: { emoji: '⚽', label: 'Sports', color: '#22c55e' },
  birthday: { emoji: '🎂', label: 'Birthday', color: '#ec4899' },
  doctor: { emoji: '🏥', label: 'Doctor', color: '#ef4444' },
  music: { emoji: '🎵', label: 'Music', color: '#a855f7' },
  art: { emoji: '🎨', label: 'Art', color: '#f59e0b' },
  bath: { emoji: '🛁', label: 'Bath Time', color: '#06b6d4' },
  homework: { emoji: '✏️', label: 'Homework', color: '#f97316' },
  reading: { emoji: '📖', label: 'Reading', color: '#8b5cf6' },
  grocery: { emoji: '🛒', label: 'Grocery', color: '#22c55e' },
  travel: { emoji: '✈️', label: 'Travel', color: '#0ea5e9' },
  work: { emoji: '💼', label: 'Work', color: '#64748b' },
  custom: { emoji: '📌', label: 'Custom', color: '#94a3b8' },
};

export function EventIconBadge({ icon, size = 'md' }: { icon: EventIcon; size?: 'sm' | 'md' | 'lg' }) {
  const def = EVENT_ICON_MAP[icon];
  const sizeClass =
    size === 'sm' ? 'text-sm w-6 h-6' : size === 'lg' ? 'text-2xl w-10 h-10' : 'text-lg w-8 h-8';

  return (
    <span
      className={`${sizeClass} flex items-center justify-center rounded-lg shrink-0`}
      style={{ backgroundColor: def.color + '20' }}
      title={def.label}
    >
      {def.emoji}
    </span>
  );
}
