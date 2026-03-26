import { useState, useEffect } from 'react';
import { Plus, Trash2, Clock } from 'lucide-react';
import { syncLocalStorageToCloud } from '../../services/cloudSync';

interface Activity {
  id: string;
  emoji: string;
  label: string;
  time?: string;
  done: boolean;
}

const STORAGE_KEY = 'pfd-activities';

const KID_ICONS = [
  { emoji: '🎨', label: 'Art' },
  { emoji: '⚽', label: 'Soccer' },
  { emoji: '🏊', label: 'Swimming' },
  { emoji: '🚴', label: 'Biking' },
  { emoji: '🎮', label: 'Games' },
  { emoji: '📚', label: 'Reading' },
  { emoji: '🎵', label: 'Music' },
  { emoji: '🎬', label: 'Movie' },
  { emoji: '🧩', label: 'Puzzles' },
  { emoji: '🏃', label: 'Running' },
  { emoji: '🎲', label: 'Board Game' },
  { emoji: '🧁', label: 'Baking' },
  { emoji: '🌳', label: 'Park' },
  { emoji: '🛝', label: 'Playground' },
  { emoji: '🎭', label: 'Pretend Play' },
  { emoji: '🧪', label: 'Science' },
  { emoji: '✏️', label: 'Homework' },
  { emoji: '🛁', label: 'Bath Time' },
  { emoji: '🍽️', label: 'Snack' },
  { emoji: '🍕', label: 'Pizza' },
  { emoji: '🧹', label: 'Clean Up' },
  { emoji: '🐕', label: 'Dog Walk' },
  { emoji: '🌙', label: 'Bed Time' },
  { emoji: '📺', label: 'TV Time' },
  { emoji: '🤸', label: 'Gymnastics' },
  { emoji: '🎤', label: 'Singing' },
  { emoji: '💃', label: 'Dance' },
  { emoji: '🏀', label: 'Basketball' },
  { emoji: '⛸️', label: 'Skating' },
  { emoji: '🎯', label: 'Practice' },
  { emoji: '🧸', label: 'Playtime' },
  { emoji: '🎪', label: 'Show' },
  { emoji: '🖍️', label: 'Coloring' },
  { emoji: '🪁', label: 'Kite' },
  { emoji: '🏕️', label: 'Camping' },
  { emoji: '🎻', label: 'Violin' },
];

function loadActivities(): Activity[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function persistActivities(items: Activity[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  syncLocalStorageToCloud(STORAGE_KEY).catch(() => {});
}

export function Activities() {
  const [activities, setActivities] = useState<Activity[]>(loadActivities);
  const [showPicker, setShowPicker] = useState(false);
  const [customLabel, setCustomLabel] = useState('');
  const [customTime, setCustomTime] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);

  useEffect(() => persistActivities(activities), [activities]);

  const addActivity = (emoji: string, label: string) => {
    setActivities((prev) => [
      ...prev,
      { id: crypto.randomUUID(), emoji, label, time: customTime || undefined, done: false },
    ]);
    setSelectedEmoji(null);
    setCustomLabel('');
    setCustomTime('');
    setShowPicker(false);
  };

  const toggleDone = (id: string) => {
    setActivities((prev) => prev.map((a) => (a.id === id ? { ...a, done: !a.done } : a)));
  };

  const removeActivity = (id: string) => {
    setActivities((prev) => prev.filter((a) => a.id !== id));
  };

  const clearAll = () => setActivities([]);

  return (
    <div className="flex flex-col h-full gap-2">
      {/* Header with add & clear */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowPicker(!showPicker)}
          className="flex items-center gap-1 text-xs bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded-lg transition-colors active:scale-95"
        >
          <Plus size={14} /> Add
        </button>
        {activities.length > 0 && (
          <button
            onClick={clearAll}
            className="text-xs text-slate-400 hover:text-red-400 px-2 py-1 transition-colors"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Icon picker overlay */}
      {showPicker && (
        <div className="bg-slate-700/90 rounded-xl p-3 border border-slate-600">
          {!selectedEmoji ? (
            <>
              <p className="text-xs text-slate-300 mb-2 font-medium">Pick an activity:</p>
              <div className="grid grid-cols-6 gap-2 max-h-48 overflow-y-auto">
                {KID_ICONS.map((item) => (
                  <button
                    key={item.emoji + item.label}
                    onClick={() => {
                      setSelectedEmoji(item.emoji);
                      setCustomLabel(item.label);
                    }}
                    className="flex flex-col items-center gap-0.5 rounded-lg p-2 hover:bg-slate-600 active:scale-95 transition-all"
                    title={item.label}
                  >
                    <span className="text-2xl">{item.emoji}</span>
                    <span className="text-[9px] text-slate-400 truncate w-full text-center">{item.label}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-3xl">{selectedEmoji}</span>
                <input
                  type="text"
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  placeholder="Activity name"
                  className="flex-1 rounded-lg bg-slate-600 border border-slate-500 px-2 py-1.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-slate-400" />
                <input
                  type="time"
                  value={customTime}
                  onChange={(e) => setCustomTime(e.target.value)}
                  className="flex-1 rounded-lg bg-slate-600 border border-slate-500 px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-xs text-slate-400">(optional)</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setSelectedEmoji(null); setCustomLabel(''); setCustomTime(''); }}
                  className="flex-1 text-xs text-slate-300 bg-slate-600 hover:bg-slate-500 px-2 py-1.5 rounded-lg transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => customLabel.trim() && addActivity(selectedEmoji, customLabel.trim())}
                  className="flex-1 text-xs text-white bg-blue-600 hover:bg-blue-500 px-2 py-1.5 rounded-lg transition-colors"
                >
                  Add
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Activity list */}
      <div className="flex-1 overflow-y-auto space-y-1.5 min-h-0">
        {activities.length === 0 && !showPicker && (
          <p className="text-sm text-slate-400 text-center mt-4">
            No activities planned yet!<br />
            <span className="text-xs">Tap + to add today's plan</span>
          </p>
        )}
        {activities.map((activity) => (
          <div
            key={activity.id}
            className={`flex items-center gap-3 rounded-xl px-3 py-2 transition-all ${
              activity.done ? 'bg-green-900/30 opacity-60' : 'bg-slate-700/50'
            }`}
          >
            <button
              onClick={() => toggleDone(activity.id)}
              className="text-3xl transition-transform active:scale-90 shrink-0"
            >
              {activity.done ? '✅' : activity.emoji}
            </button>
            <div className="flex-1 min-w-0">
              <p className={`text-base font-medium truncate ${activity.done ? 'line-through text-slate-400' : 'text-white'}`}>
                {activity.label}
              </p>
              {activity.time && (
                <p className="text-xs text-slate-400">{activity.time}</p>
              )}
            </div>
            <button
              onClick={() => removeActivity(activity.id)}
              className="text-slate-500 hover:text-red-400 p-1 transition-colors shrink-0"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
