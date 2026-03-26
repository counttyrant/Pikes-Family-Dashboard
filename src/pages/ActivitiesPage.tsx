import { Activities } from '../components/widgets/Activities';

export default function ActivitiesPage() {
  return (
    <div className="h-full w-full p-6 pt-16 overflow-y-auto">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">
          🗓️ Activities
        </h1>
        <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-4 min-h-[60vh]">
          <Activities />
        </div>
      </div>
    </div>
  );
}
