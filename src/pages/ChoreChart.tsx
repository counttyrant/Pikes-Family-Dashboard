import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import {
  Settings,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Users,
} from 'lucide-react';
import FamilyMemberCard from '../components/chores/FamilyMember';
import ChoreList from '../components/chores/ChoreList';
import RewardSystem from '../components/chores/RewardSystem';
import Leaderboard from '../components/chores/Leaderboard';

export default function ChoreChart() {
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [showLeaderboard, setShowLeaderboard] = useState(true);

  const members = useLiveQuery(() => db.familyMembers.toArray()) ?? [];

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
    </div>
  );
}
