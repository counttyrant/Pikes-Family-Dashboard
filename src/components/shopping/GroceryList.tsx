import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { Plus, Trash2, ShoppingCart, Check } from 'lucide-react';

export default function GroceryList() {
  const [newItem, setNewItem] = useState('');

  const items = useLiveQuery(() => db.shoppingItems.toArray()) ?? [];

  const unchecked = items
    .filter((i) => !i.checked)
    .sort(
      (a, b) =>
        new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime(),
    );

  const checked = items
    .filter((i) => i.checked)
    .sort(
      (a, b) =>
        new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime(),
    );

  const addItem = async () => {
    const text = newItem.trim();
    if (!text) return;
    await db.shoppingItems.add({
      id: crypto.randomUUID(),
      text,
      checked: false,
      addedAt: new Date(),
    });
    setNewItem('');
  };

  const toggleItem = async (id: string, current: boolean) => {
    await db.shoppingItems.update(id, { checked: !current });
  };

  const deleteItem = async (id: string) => {
    await db.shoppingItems.delete(id);
  };

  const clearCompleted = async () => {
    await db.shoppingItems.bulkDelete(checked.map((i) => i.id));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') addItem();
  };

  return (
    <div className="flex flex-col h-full">
      {/* header */}
      <div className="flex items-center gap-3 mb-4">
        <ShoppingCart className="w-7 h-7 text-emerald-400" />
        <h2 className="text-2xl font-bold text-white">Grocery List</h2>
      </div>

      {/* input */}
      <div className="flex gap-2 mb-5">
        <input
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add an item…"
          className="flex-1 px-4 py-3 bg-slate-800 text-white rounded-xl border border-slate-700 focus:border-emerald-500 focus:outline-none text-lg placeholder-slate-500"
        />
        <button
          onClick={addItem}
          disabled={!newItem.trim()}
          className="w-14 flex items-center justify-center bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl transition-colors"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {/* items */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {unchecked.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3 p-3 bg-slate-800 rounded-xl hover:bg-slate-700/70 transition-colors animate-fade-in-up"
          >
            <button
              onClick={() => toggleItem(item.id, item.checked)}
              className="w-11 h-11 flex-shrink-0 rounded-lg border-2 border-slate-600 hover:border-emerald-400 flex items-center justify-center transition-colors"
              aria-label="Mark complete"
            />
            <span className="flex-1 text-white text-lg">{item.text}</span>
            <button
              onClick={() => deleteItem(item.id)}
              className="w-11 h-11 flex-shrink-0 flex items-center justify-center text-slate-500 hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        ))}

        {/* checked section */}
        {checked.length > 0 && (
          <>
            <div className="flex items-center justify-between pt-4 pb-2">
              <span className="text-sm text-slate-500 font-medium">
                Completed ({checked.length})
              </span>
              <button
                onClick={clearCompleted}
                className="text-sm text-red-400 hover:text-red-300 font-medium px-3 py-1.5 rounded-lg hover:bg-red-900/20 transition-colors"
              >
                Clear all
              </button>
            </div>

            {checked.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl opacity-60"
              >
                <button
                  onClick={() => toggleItem(item.id, item.checked)}
                  className="w-11 h-11 flex-shrink-0 rounded-lg bg-emerald-600 flex items-center justify-center transition-colors"
                  aria-label="Mark incomplete"
                >
                  <Check className="w-6 h-6 text-white" />
                </button>
                <span className="flex-1 text-slate-400 text-lg line-through">
                  {item.text}
                </span>
                <button
                  onClick={() => deleteItem(item.id)}
                  className="w-11 h-11 flex-shrink-0 flex items-center justify-center text-slate-600 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
          </>
        )}

        {items.length === 0 && (
          <div className="text-center text-slate-500 py-12">
            <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-lg">List is empty</p>
            <p className="text-sm mt-1">Add items above to get started</p>
          </div>
        )}
      </div>
    </div>
  );
}
