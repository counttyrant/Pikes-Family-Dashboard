import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { deleteRecipe } from '../../services/storage';
import { Trash2, ChefHat } from 'lucide-react';

export function RecipesWidget() {
  const recipes = useLiveQuery(() => db.recipes.orderBy('addedAt').reverse().toArray()) ?? [];

  if (recipes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-white/40 gap-2">
        <ChefHat size={32} />
        <p className="text-sm">No saved recipes</p>
        <p className="text-xs">Swipe to Recipes page to find some!</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 h-full overflow-y-auto">
      {recipes.slice(0, 5).map((r) => (
        <div key={r.id} className="flex items-start gap-2 p-2 rounded-lg bg-white/5">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{r.title}</p>
            <p className="text-xs text-white/40">{r.ingredients?.slice(0, 3).join(', ')}...</p>
          </div>
          <button
            onClick={() => deleteRecipe(r.id)}
            className="p-1 text-red-400/50 hover:text-red-400 transition-colors shrink-0"
          >
            <Trash2 size={12} />
          </button>
        </div>
      ))}
      {recipes.length > 5 && (
        <p className="text-xs text-white/30 text-center">+{recipes.length - 5} more</p>
      )}
    </div>
  );
}
