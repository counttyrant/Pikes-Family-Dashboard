import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { syncLocalStorageToCloud } from '../../services/cloudSync';

interface TodoItem {
  id: string;
  text: string;
  done: boolean;
  createdAt: number;
}

const STORAGE_KEY = 'pfd-todos';

function loadTodos(): TodoItem[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function persistTodos(items: TodoItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  syncLocalStorageToCloud(STORAGE_KEY).catch(() => {});
}

export function TodoList() {
  const [items, setItems] = useState<TodoItem[]>(loadTodos);
  const [newText, setNewText] = useState('');

  useEffect(() => persistTodos(items), [items]);

  const addItem = () => {
    if (!newText.trim()) return;
    setItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), text: newText.trim(), done: false, createdAt: Date.now() },
    ]);
    setNewText('');
  };

  const toggle = (id: string) =>
    setItems((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));

  const remove = (id: string) =>
    setItems((prev) => prev.filter((t) => t.id !== id));

  const clearDone = () =>
    setItems((prev) => prev.filter((t) => !t.done));

  const pending = items.filter((t) => !t.done);
  const done = items.filter((t) => t.done);

  return (
    <div className="flex flex-col gap-2 h-full">
      {/* Add row */}
      <div className="flex gap-1.5">
        <input
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addItem()}
          placeholder="Add a task…"
          className="flex-1 bg-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder-white/30 focus:outline-none"
        />
        <button onClick={addItem} className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors">
          <Plus size={16} className="text-white/60" />
        </button>
      </div>

      {/* Pending */}
      <div className="flex flex-col gap-1 overflow-y-auto flex-1 min-h-0">
        {pending.length === 0 && done.length === 0 && (
          <p className="text-sm text-white/30 text-center py-4">All done! 🎉</p>
        )}
        {pending.map((t) => (
          <label
            key={t.id}
            className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-white/5 cursor-pointer transition-colors"
          >
            <input
              type="checkbox"
              checked={false}
              onChange={() => toggle(t.id)}
              className="w-4 h-4 rounded accent-blue-500"
            />
            <span className="flex-1 text-sm text-white/90">{t.text}</span>
            <button
              onClick={(e) => { e.preventDefault(); remove(t.id); }}
              className="shrink-0 p-1 rounded transition-colors opacity-30 hover:opacity-100 hover:bg-red-500/20"
            >
              <Trash2 size={12} className="text-red-400" />
            </button>
          </label>
        ))}

        {/* Done section */}
        {done.length > 0 && (
          <>
            <div className="flex items-center gap-2 mt-2 mb-1">
              <span className="text-[0.6rem] uppercase tracking-wider text-white/30 font-semibold">
                Done ({done.length})
              </span>
              <button
                onClick={clearDone}
                className="text-[0.6rem] text-red-400/60 hover:text-red-400 transition-colors"
              >
                Clear
              </button>
            </div>
            {done.map((t) => (
              <label
                key={t.id}
                className="flex items-center gap-2 rounded-lg px-2.5 py-1 opacity-40 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={true}
                  onChange={() => toggle(t.id)}
                  className="w-4 h-4 rounded accent-green-500"
                />
                <span className="flex-1 text-sm text-white/90 line-through">{t.text}</span>
              </label>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
