import { useState, useEffect } from 'react';
import { Plus, Trash2, CheckCircle2, Circle } from 'lucide-react';

interface Chore {
  id: string;
  text: string;
  assignee: string;
  done: boolean;
}

const STORAGE_KEY = 'pfd-chores';

function loadChores(): Chore[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function persistChores(chores: Chore[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(chores));
}

export function Chores() {
  const [chores, setChores] = useState<Chore[]>(loadChores);
  const [newText, setNewText] = useState('');
  const [newAssignee, setNewAssignee] = useState('');

  useEffect(() => persistChores(chores), [chores]);

  const addChore = () => {
    if (!newText.trim()) return;
    setChores((prev) => [
      ...prev,
      { id: crypto.randomUUID(), text: newText.trim(), assignee: newAssignee.trim(), done: false },
    ]);
    setNewText('');
    setNewAssignee('');
  };

  const toggle = (id: string) =>
    setChores((prev) => prev.map((c) => (c.id === id ? { ...c, done: !c.done } : c)));

  const remove = (id: string) =>
    setChores((prev) => prev.filter((c) => c.id !== id));

  return (
    <div className="flex flex-col gap-2 h-full">
      {/* Add row */}
      <div className="flex gap-1.5">
        <input
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addChore()}
          placeholder="New chore…"
          className="flex-1 bg-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder-white/30 focus:outline-none"
        />
        <input
          value={newAssignee}
          onChange={(e) => setNewAssignee(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addChore()}
          placeholder="Who"
          className="w-20 bg-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder-white/30 focus:outline-none"
        />
        <button onClick={addChore} className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors">
          <Plus size={16} className="text-white/60" />
        </button>
      </div>

      {/* List */}
      <div className="flex flex-col gap-1 overflow-y-auto flex-1 min-h-0">
        {chores.length === 0 && (
          <p className="text-sm text-white/30 text-center py-4">No chores yet</p>
        )}
        {chores.map((c) => (
          <div
            key={c.id}
            className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 transition-colors ${
              c.done ? 'opacity-40' : 'hover:bg-white/5'
            }`}
          >
            <button onClick={() => toggle(c.id)} className="shrink-0">
              {c.done ? (
                <CheckCircle2 size={18} className="text-green-400" />
              ) : (
                <Circle size={18} className="text-white/40" />
              )}
            </button>
            <span className={`flex-1 text-sm text-white/90 ${c.done ? 'line-through' : ''}`}>
              {c.text}
            </span>
            {c.assignee && (
              <span className="text-[0.6rem] bg-white/10 px-1.5 py-0.5 rounded text-white/50">
                {c.assignee}
              </span>
            )}
            <button
              onClick={() => remove(c.id)}
              className="shrink-0 p-1 hover:bg-red-500/20 rounded transition-colors opacity-0 group-hover:opacity-100"
              style={{ opacity: undefined }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.3')}
            >
              <Trash2 size={14} className="text-red-400" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
