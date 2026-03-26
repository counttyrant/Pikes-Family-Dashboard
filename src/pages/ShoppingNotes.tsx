import { ShoppingBag } from 'lucide-react';
import GroceryList from '../components/shopping/GroceryList';
import NotesBoard from '../components/shopping/NotesBoard';

export default function ShoppingNotes() {
  return (
    <div className="h-screen bg-slate-900 flex flex-col overflow-hidden">
      {/* header */}
      <header className="flex items-center px-6 py-4 border-b border-slate-800">
        <ShoppingBag className="w-7 h-7 text-emerald-400 mr-3" />
        <h1 className="text-3xl font-bold text-white">Lists &amp; Notes</h1>
      </header>

      {/* main: grocery 50% | notes 50% */}
      <div className="flex-1 flex overflow-hidden px-6 py-4 gap-6">
        <div className="w-1/2 overflow-hidden flex flex-col">
          <GroceryList />
        </div>
        <div className="w-1/2 overflow-hidden flex flex-col">
          <NotesBoard />
        </div>
      </div>
    </div>
  );
}
