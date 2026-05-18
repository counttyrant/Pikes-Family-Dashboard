import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import {
  Settings,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Users,
  Gift,
  X,
} from 'lucide-react';
import FamilyMemberCard from '../components/chores/FamilyMember';
import ChoreList from '../components/chores/ChoreList';
import RewardSystem from '../components/chores/RewardSystem';
import Leaderboard from '../components/chores/Leaderboard';

export default function ChoreChart() {
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [showLeaderboard, setShowLeaderboard] = useState(true);
  const [givePointsMemberId, setGivePointsMemberId] = useState<string | null>(null);
  const [givePointsAmount, setGivePointsAmount] = useState(5);
  const [givePointsReason, setGivePointsReason] = useState('');
  const [givePointsError, setGivePointsError] = useState('');

  const members = useLiveQuery(() => db.familyMembers.toArray()) ?? [];

  const openGivePoints = (memberId: string) => {
    setGivePointsMemberId(memberId);
    setGivePointsAmount(5);
    setGivePointsReason('');
    setGivePointsError('');
  };

  const saveGivePoints = async () => {
    if (!givePointsMemberId) return;
    const pts = Math.max(1, Math.round(givePointsAmount));
    try {
      await db.stickerRecords.add({
        id: crypto.randomUUID(),
        memberId: givePointsMemberId,
        earnedAt: new Date(),
        points: pts,
      });
      setGivePointsMemberId(null);
    } catch (e) {
      setGivePointsError('Failed to save. Try again.');
      console.error(e);
    }
  };

  const givePointsMember = members.find((m) => m.id === givePointsMemberId);

  return (
    <div className="h-screen bg-slate-900 flex flex-col overflow-hidden">
      {/* header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <ClipboardList className="w-7 h-7 text-blue-400" />
          <h1 className="text-3xl font-bold text-white">Chore Chart</h1>
        </div>
        <button className="w-11 h-11 flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
          <Settings className="w-6 h-6" />
        </button>
      </header>

      {/* family members row */}
      <div className="px-6 py-4 border-b border-slate-800">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-5 h-5 text-slate-400" />
          <span className="text-sm font-medium text-slate-400">
            Family Members
          </span>
          {selectedMemberId && (
            <button
              onClick={() => openGivePoints(selectedMemberId)}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-lg text-sm font-medium transition-colors"
            >
              <Gift className="w-4 h-4" />
              Give Points
            </button>
          )}
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2">
          <button
            onClick={() => setSelectedMemberId(null)}
            className={`flex-shrink-0 px-5 py-3 rounded-2xl font-semibold transition-all ${
              selectedMemberId === null
                ? 'bg-blue-600 text-white scale-105'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            All
          </button>
          {members.map((member) => (
            <FamilyMemberCard
              key={member.id}
              member={member}
              selected={selectedMemberId === member.id}
              onClick={() =>
                setSelectedMemberId(
                  selectedMemberId === member.id ? null : member.id,
                )
              }
            />
          ))}
        </div>
      </div>

      {/* main content: chores 60% | rewards 40% */}
      <div className="flex-1 flex overflow-hidden px-6 py-4 gap-6">
        <div className="w-3/5 overflow-hidden flex flex-col">
          <ChoreList selectedMemberId={selectedMemberId} />
        </div>
        <div className="w-2/5 overflow-hidden flex flex-col">
          <RewardSystem selectedMemberId={selectedMemberId} />
        </div>
      </div>

      {/* collapsible leaderboard */}
      <div className="border-t border-slate-800">
        <button
          onClick={() => setShowLeaderboard(!showLeaderboard)}
          className="w-full flex items-center justify-center gap-2 py-3 text-slate-400 hover:text-white transition-colors"
        >
          <span className="font-medium">Leaderboard</span>
          {showLeaderboard ? (
            <ChevronDown className="w-5 h-5" />
          ) : (
            <ChevronUp className="w-5 h-5" />
          )}
        </button>
        {showLeaderboard && (
          <div className="px-6 pb-4 animate-fade-in-up">
            <Leaderboard />
          </div>
        )}
      </div>

      {/* Give Points modal */}
      {givePointsMemberId && givePointsMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-2xl p-6 w-80 shadow-2xl border border-slate-700">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white overflow-hidden"
                  style={{ backgroundColor: givePointsMember.color }}
                >
                  {givePointsMember.avatar ? (
                    <img src={givePointsMember.avatar} alt={givePointsMember.name} className="w-full h-full object-cover" />
                  ) : (
                    givePointsMember.name[0]
                  )}
                </div>
                <h2 className="text-lg font-bold text-white">
                  Give {givePointsMember.name} Points
                </h2>
              </div>
              <button
                onClick={() => setGivePointsMemberId(null)}
                className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X size={18} className="text-slate-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Points</label>
                <input
                  type="number"
                  min={1}
                  value={givePointsAmount}
                  onChange={(e) => setGivePointsAmount(Number(e.target.value))}
                  onKeyDown={(e) => e.key === 'Enter' && saveGivePoints()}
                  className="w-full rounded-lg bg-white/10 border border-white/10 px-3 py-2 text-white text-lg font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Reason (optional)</label>
                <input
                  type="text"
                  value={givePointsReason}
                  onChange={(e) => setGivePointsReason(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && saveGivePoints()}
                  placeholder="e.g. Helped a neighbor"
                  className="w-full rounded-lg bg-white/10 border border-white/10 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
              {givePointsError && (
                <p className="text-red-400 text-sm">{givePointsError}</p>
              )}
              <button
                onClick={saveGivePoints}
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-white rounded-xl font-bold text-lg transition-colors"
              >
                Give {Math.max(1, givePointsAmount)} Points ⭐
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
