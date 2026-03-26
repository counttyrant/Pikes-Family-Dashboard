import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { Star } from 'lucide-react';

export default function Leaderboard() {
  const members = useLiveQuery(() => db.familyMembers.toArray()) ?? [];
  const stickers = useLiveQuery(() => db.stickerRecords.toArray()) ?? [];

  const ranked = members
    .map((m) => ({
      ...m,
      points: stickers
        .filter((s) => s.memberId === m.id)
        .reduce((sum, s) => sum + s.points, 0),
    }))
    .sort((a, b) => b.points - a.points);

  const maxPoints = Math.max(...ranked.map((m) => m.points), 1);
  const medals = ['🥇', '🥈', '🥉'];

  const initials = (name: string) =>
    name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  if (ranked.length === 0) {
    return (
      <p className="text-center text-slate-500 py-4">
        No family members yet
      </p>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
        <span>🏆</span> Leaderboard
      </h2>

      <div className="space-y-3">
        {ranked.map((member, idx) => (
          <div
            key={member.id}
            className="flex items-center gap-3 animate-fade-in-up"
            style={{ animationDelay: `${idx * 100}ms` }}
          >
            {/* position */}
            <span className="text-2xl w-10 text-center flex-shrink-0">
              {idx < 3 ? (
                medals[idx]
              ) : (
                <span className="text-slate-500 text-lg font-bold">
                  {idx + 1}
                </span>
              )}
            </span>

            {/* avatar */}
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0 overflow-hidden"
              style={{ backgroundColor: member.color }}
            >
              {member.avatar ? (
                <img
                  src={member.avatar}
                  alt={member.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                initials(member.name)
              )}
            </div>

            {/* name + bar */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-white font-medium truncate">
                  {member.name}
                </span>
                <span className="text-amber-400 font-bold flex items-center gap-1 flex-shrink-0 ml-2">
                  <Star className="w-3.5 h-3.5 fill-amber-400" />
                  {member.points}
                </span>
              </div>
              <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full animate-slide-in"
                  style={{
                    width: `${(member.points / maxPoints) * 100}%`,
                    backgroundColor: member.color,
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
