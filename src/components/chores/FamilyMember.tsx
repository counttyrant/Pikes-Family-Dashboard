import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { Star } from 'lucide-react';
import type { FamilyMember } from '../../types';

interface FamilyMemberCardProps {
  member: FamilyMember;
  selected?: boolean;
  onClick?: () => void;
}

export default function FamilyMemberCard({
  member,
  selected,
  onClick,
}: FamilyMemberCardProps) {
  const stickers =
    useLiveQuery(
      () => db.stickerRecords.where('memberId').equals(member.id).toArray(),
      [member.id],
    ) ?? [];

  const totalPoints = stickers.reduce((sum, s) => sum + s.points, 0);

  const recentStickers = [...stickers]
    .sort(
      (a, b) =>
        new Date(b.earnedAt).getTime() - new Date(a.earnedAt).getTime(),
    )
    .slice(0, 5);

  const initials = member.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-2 p-4 rounded-2xl transition-all duration-200 min-w-[120px] ${
        selected
          ? 'bg-slate-700 scale-105'
          : 'bg-slate-800 hover:bg-slate-700/70'
      }`}
      style={selected ? { boxShadow: `0 0 0 3px ${member.color}` } : undefined}
    >
      {/* avatar */}
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-white shadow-lg overflow-hidden"
        style={{ backgroundColor: member.color }}
      >
        {member.avatar ? (
          <img
            src={member.avatar}
            alt={member.name}
            className="w-full h-full object-cover"
          />
        ) : (
          initials
        )}
      </div>

      {/* name */}
      <span className="text-white font-semibold text-sm truncate max-w-full">
        {member.name}
      </span>

      {/* points */}
      <div className="flex items-center gap-1 text-amber-400 text-sm font-medium">
        <Star className="w-4 h-4 fill-amber-400" />
        {totalPoints}
      </div>

      {/* mini sticker collection */}
      {recentStickers.length > 0 && (
        <div className="flex gap-0.5">
          {recentStickers.map((s) => (
            <Star
              key={s.id}
              className="w-3.5 h-3.5 fill-amber-400 text-amber-400"
            />
          ))}
        </div>
      )}
    </button>
  );
}
