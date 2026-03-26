import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { Plus, X, StickyNote } from 'lucide-react';

const PASTEL_COLORS = [
  '#fef08a', // yellow
  '#fda4af', // pink
  '#93c5fd', // blue
  '#86efac', // green
  '#c4b5fd', // purple
];

export default function NotesBoard() {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const notes = useLiveQuery(() => db.notes.toArray()) ?? [];

  const sorted = [...notes].sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  const addNote = async () => {
    const color =
      PASTEL_COLORS[Math.floor(Math.random() * PASTEL_COLORS.length)];
    const id = crypto.randomUUID();
    await db.notes.add({
      id,
      text: '',
      color,
      x: 0,
      y: 0,
      updatedAt: new Date(),
    });
    setEditingId(id);
    setEditText('');
  };

  const startEdit = (note: { id: string; text: string }) => {
    setEditingId(note.id);
    setEditText(note.text);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    if (editText.trim()) {
      await db.notes.update(editingId, {
        text: editText.trim(),
        updatedAt: new Date(),
      });
    } else {
      // empty note — delete it
      await db.notes.delete(editingId);
    }
    setEditingId(null);
    setEditText('');
  };

  const deleteNote = async (id: string) => {
    await db.notes.delete(id);
    if (editingId === id) {
      setEditingId(null);
      setEditText('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') saveEdit();
  };

  return (
    <div className="flex flex-col h-full">
      {/* header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <StickyNote className="w-7 h-7 text-amber-400" />
          <h2 className="text-2xl font-bold text-white">Notes</h2>
        </div>
        <button
          onClick={addNote}
          className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-medium transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Note
        </button>
      </div>

      {/* notes grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
          {sorted.map((note) => (
            <div
              key={note.id}
              className="relative rounded-xl p-4 min-h-[120px] shadow-lg transition-all duration-200 hover:scale-[1.02] animate-fade-in-up"
              style={{ backgroundColor: note.color }}
            >
              {/* delete */}
              <button
                onClick={() => deleteNote(note.id)}
                className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded-full bg-black/15 hover:bg-black/30 text-slate-700 hover:text-red-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              {editingId === note.id ? (
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onBlur={saveEdit}
                  onKeyDown={handleKeyDown}
                  autoFocus
                  className="w-full h-full min-h-[80px] bg-transparent text-slate-800 font-medium resize-none focus:outline-none placeholder-slate-500"
                  placeholder="Write a note…"
                />
              ) : (
                <div
                  onClick={() => startEdit(note)}
                  className="text-slate-800 font-medium cursor-pointer pr-6 whitespace-pre-wrap break-words"
                >
                  {note.text || (
                    <span className="text-slate-500 italic">
                      Tap to edit…
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {notes.length === 0 && (
          <div className="text-center text-slate-500 py-12">
            <StickyNote className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-lg">No notes yet</p>
            <p className="text-sm mt-1">
              Tap &ldquo;Add Note&rdquo; to create one
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
