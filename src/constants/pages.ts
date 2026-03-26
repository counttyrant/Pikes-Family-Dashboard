// All available pages — id must match enabledPages values
export const ALL_PAGES = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'chores', label: 'Chores' },
  { id: 'shopping', label: 'Shopping' },
  { id: 'activities', label: 'Activities' },
  { id: 'recipes', label: 'Recipes' },
] as const;

export const DEFAULT_PAGE_ORDER = ALL_PAGES.map(p => p.id);
