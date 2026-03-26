import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { isToday, isThisWeek, isPast, format } from 'date-fns';
import { Plus, Trash2, Check, Calendar, Star, X } from 'lucide-react';
import type { Chore, FamilyMember, ChoreRecurrence } from '../../types';

interface ChoreListProps {
  selectedMemberId: string | null;
}

export default function ChoreList({ selectedMemberId }: ChoreListProps) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedTo, setAssignedTo] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState('');
  const [recurrence, setRecurrence] = useState<ChoreRecurrence>('none');
  const [points, setPoints] = useState(1);

  const members = useLiveQuery(() => db.familyMembers.toArray()) ?? [];
  const allChores = useLiveQuery(() => db.chores.toArray()) ?? [];

  const chores = selectedMemberId
    ? allChores.filter((c) => c.assignedTo.includes(selectedMemberId))
    : allChores;

  const today: Chore[] = [];
  const thisWeek: Chore[] = [];
  const upcoming: Chore[] = [];
  const completed: Chore[] = [];

  chores.forEach((chore) => {
    if (chore.completed) {
      completed.push(chore);
      return;
    }
    const due = new Date(chore.dueDate);
    if (isToday(due)) today.push(chore);
    else if (isThisWeek(due, { weekStartsOn: 0 })) thisWeek.push(chore);
    else upcoming.push(chore);
  });

  const getInitials = (m: FamilyMember) =>
    m.name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  /* ── actions ─────────────────────────────────────────────────────────── */

  const toggleComplete = async (chore: Chore) => {
    if (chore.completed) {
      await db.chores.update(chore.id, {
        completed: false,
        completedBy: '',
        completedAt: null,
      });
      await db.stickerRecords
        .where('choreId')
        .equals(chore.id)
        .delete();
    } else {
      const completedBy = selectedMemberId || chore.assignedTo[0] || '';
      await db.chores.update(chore.id, {
        completed: true,
        completedBy,
        completedAt: new Date(),
      });
      if (completedBy) {
        await db.stickerRecords.add({
          id: crypto.randomUUID(),
          memberId: completedBy,
          choreId: chore.id,
          earnedAt: new Date(),
          points: chore.points,
        });
      }
    }
  };

  const deleteChore = async (id: string) => {
    await db.chores.delete(id);
    await db.stickerRecords.where('choreId').equals(id).delete();
  };

  const addChore = async () => {
    if (!title.trim() || !dueDate) return;
    await db.chores.add({
      id: crypto.randomUUID(),
      title: title.trim(),
      description: description.trim(),
      assignedTo,
      dueDate: new Date(dueDate),
      recurrence,
      completed: false,
      completedBy: '',
      completedAt: null,
      points,
    });
    setTitle('');
    setDescription('');
    setAssignedTo([]);
    setDueDate('');
    setRecurrence('none');
    setPoints(1);
    setShowForm(false);
  };

  const toggleMemberAssign = (id: string) =>
    setAssignedTo((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id],
    );

  /* ── sub-renders ─────────────────────────────────────────────────────── */

  const renderChoreCard = (chore: Chore) => {
    const assignedMembers = members.filter((m) =>
      chore.assignedTo.includes(m.id),
    );
    const due = new Date(chore.dueDate);
    const overdue = !chore.completed && isPast(due) && !isToday(due);

    return (
      <div
        key={chore.id}
        className={`flex items-center gap-3 p-4 rounded-xl transition-all duration-300 ${
          chore.completed
            ? 'bg-slate-800/50 opacity-60'
            : overdue
              ? 'bg-red-900/30 border border-red-500/30'
              : 'bg-slate-800 hover:bg-slate-700'
        }`}
      >
        {/* completion toggle */}
        <button
          onClick={() => toggleComplete(chore)}
          className={`flex-shrink-0 w-11 h-11 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
            chore.completed
              ? 'bg-emerald-500 border-emerald-500'
              : 'border-slate-500 hover:border-emerald-400'
          }`}
        >
          {chore.completed && (
            <Check className="w-6 h-6 text-white animate-checkmark" />
          )}
        </button>

        {/* content */}
        <div className="flex-1 min-w-0">
          <p
            className={`font-semibold text-lg leading-snug ${
              chore.completed ? 'line-through text-slate-400' : 'text-white'
            }`}
          >
            {chore.title}
          </p>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span
              className={`text-sm flex items-center gap-1 ${
                overdue ? 'text-red-400' : 'text-slate-400'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              {format(due, 'MMM d')}
            </span>
            <span className="text-amber-400 text-sm font-medium flex items-center gap-0.5">
              <Star className="w-3.5 h-3.5 fill-amber-400" />
              {chore.points}
            </span>
          </div>
        </div>

        {/* assigned avatars */}
        <div className="flex -space-x-2">
          {assignedMembers.map((member) => (
            <div
              key={member.id}
              className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold border-2 border-slate-900 overflow-hidden"
              style={{ backgroundColor: member.color }}
              title={member.name}
            >
              {member.avatar ? (
                <img
                  src={member.avatar}
                  alt={member.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-white">{getInitials(member)}</span>
              )}
            </div>
          ))}
        </div>

        {/* delete */}
        <button
          onClick={() => deleteChore(chore.id)}
          className="flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-red-900/30 transition-colors"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>
    );
  };

  const renderGroup = (label: string, items: Chore[]) => {
    if (items.length === 0) return null;
    return (
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 px-1">
          {label}
        </h3>
        <div className="space-y-2">{items.map(renderChoreCard)}</div>
      </div>
    );
  };

  /* ── main render ─────────────────────────────────────────────────────── */

  return (
    <div className="flex flex-col h-full">
      {/* header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-white">Chores</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-colors"
        >
          {showForm ? (
            <X className="w-5 h-5" />
          ) : (
            <Plus className="w-5 h-5" />
          )}
          {showForm ? 'Cancel' : 'Add Chore'}
        </button>
      </div>

      {/* inline add form */}
      {showForm && (
        <div className="bg-slate-800 rounded-xl p-5 mb-5 space-y-4 animate-fade-in-up">
          <input
            type="text"
            placeholder="Chore title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none text-lg"
          />
          <input
            type="text"
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
          />

          <div>
            <label className="text-sm text-slate-400 mb-2 block">
              Assign to
            </label>
            <div className="flex flex-wrap gap-2">
              {members.map((m) => (
                <button
                  key={m.id}
                  onClick={() => toggleMemberAssign(m.id)}
                  className={`px-4 py-2 rounded-lg font-medium text-white transition-all ${
                    assignedTo.includes(m.id)
                      ? 'ring-2 ring-white'
                      : 'opacity-50 hover:opacity-80'
                  }`}
                  style={{ backgroundColor: m.color }}
                >
                  {m.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-sm text-slate-400 mb-1 block">
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-1 block">
                Recurrence
              </label>
              <select
                value={recurrence}
                onChange={(e) =>
                  setRecurrence(e.target.value as ChoreRecurrence)
                }
                className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
              >
                <option value="none">None</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-1 block">
                Points
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={points}
                onChange={(e) => setPoints(Number(e.target.value))}
                className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <button
            onClick={addChore}
            disabled={!title.trim() || !dueDate}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 disabled:text-slate-400 text-white rounded-xl font-semibold text-lg transition-colors"
          >
            Add Chore
          </button>
        </div>
      )}

      {/* chore groups */}
      <div className="flex-1 overflow-y-auto pr-1">
        {renderGroup('Today', today)}
        {renderGroup('This Week', thisWeek)}
        {renderGroup('Upcoming', upcoming)}
        {completed.length > 0 && renderGroup('Completed', completed)}

        {chores.length === 0 && (
          <div className="text-center text-slate-500 py-12">
            <Check className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-lg">No chores yet</p>
            <p className="text-sm mt-1">Tap &ldquo;Add Chore&rdquo; to get started</p>
          </div>
        )}
      </div>
    </div>
  );
}
