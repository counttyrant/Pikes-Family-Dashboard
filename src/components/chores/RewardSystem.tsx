import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { Gift, Plus, Star, X, Trophy } from 'lucide-react';

interface RewardSystemProps {
  selectedMemberId: string | null;
}

export default function RewardSystem({ selectedMemberId }: RewardSystemProps) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [pointsCost, setPointsCost] = useState(10);
  const [claimedId, setClaimedId] = useState<string | null>(null);

  const rewards = useLiveQuery(() => db.rewards.toArray()) ?? [];
  const members = useLiveQuery(() => db.familyMembers.toArray()) ?? [];
  const stickers = useLiveQuery(() => db.stickerRecords.toArray()) ?? [];

  const getAvailablePoints = (memberId: string) => {
    const earned = stickers
      .filter((s) => s.memberId === memberId)
      .reduce((sum, s) => sum + s.points, 0);
    const spent = rewards
      .filter((r) => r.claimedBy === memberId)
      .reduce((sum, r) => sum + r.pointsCost, 0);
    return earned - spent;
  };

  const selectedMember = members.find((m) => m.id === selectedMemberId);
  const availablePoints = selectedMemberId
    ? getAvailablePoints(selectedMemberId)
    : 0;

  const claimReward = async (rewardId: string) => {
    if (!selectedMemberId) return;
    const reward = rewards.find((r) => r.id === rewardId);
    if (!reward || getAvailablePoints(selectedMemberId) < reward.pointsCost)
      return;

    setClaimedId(rewardId);
    await db.rewards.update(rewardId, { claimedBy: selectedMemberId });
    setTimeout(() => setClaimedId(null), 600);
  };

  const addReward = async () => {
    if (!title.trim()) return;
    await db.rewards.add({
      id: crypto.randomUUID(),
      title: title.trim(),
      description: description.trim(),
      pointsCost,
      claimedBy: null,
    });
    setTitle('');
    setDescription('');
    setPointsCost(10);
    setShowForm(false);
  };

  const deleteReward = async (id: string) => {
    await db.rewards.delete(id);
  };

  const availableRewards = rewards.filter((r) => r.claimedBy === null);

  return (
    <div className="flex flex-col h-full">
      {/* header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Gift className="w-6 h-6 text-purple-400" />
          Rewards
        </h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-medium transition-colors"
        >
          {showForm ? (
            <X className="w-5 h-5" />
          ) : (
            <Plus className="w-5 h-5" />
          )}
          {showForm ? 'Cancel' : 'Add'}
        </button>
      </div>

      {/* selected member balance */}
      {selectedMember && (
        <div className="bg-slate-800 rounded-xl p-4 mb-4 flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white overflow-hidden"
            style={{ backgroundColor: selectedMember.color }}
          >
            {selectedMember.avatar ? (
              <img
                src={selectedMember.avatar}
                alt={selectedMember.name}
                className="w-full h-full object-cover"
              />
            ) : (
              selectedMember.name[0]
            )}
          </div>
          <div>
            <p className="text-white font-medium">{selectedMember.name}</p>
            <p className="text-amber-400 text-sm flex items-center gap-1">
              <Star className="w-3.5 h-3.5 fill-amber-400" />
              {availablePoints} points available
            </p>
          </div>
        </div>
      )}

      {/* inline add form */}
      {showForm && (
        <div className="bg-slate-800 rounded-xl p-5 mb-4 space-y-3 animate-fade-in-up">
          <input
            type="text"
            placeholder="Reward title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none text-lg"
          />
          <input
            type="text"
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
          />
          <div>
            <label className="text-sm text-slate-400 mb-1 block">
              Point Cost
            </label>
            <input
              type="number"
              min={1}
              value={pointsCost}
              onChange={(e) => setPointsCost(Number(e.target.value))}
              className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
            />
          </div>
          <button
            onClick={addReward}
            disabled={!title.trim()}
            className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-600 disabled:text-slate-400 text-white rounded-xl font-semibold transition-colors"
          >
            Add Reward
          </button>
        </div>
      )}

      {/* reward grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-2 gap-3">
          {availableRewards.map((reward) => {
            const canClaim =
              !!selectedMemberId && availablePoints >= reward.pointsCost;
            return (
              <div
                key={reward.id}
                className={`bg-slate-800 rounded-xl p-4 flex flex-col relative transition-all duration-300 ${
                  claimedId === reward.id ? 'animate-claim-pop' : ''
                }`}
              >
                {/* delete */}
                <button
                  onClick={() => deleteReward(reward.id)}
                  className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded-full text-slate-600 hover:text-red-400 hover:bg-red-900/30 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>

                <Trophy className="w-8 h-8 text-purple-400 mb-2" />
                <h3 className="text-white font-semibold leading-snug pr-6">
                  {reward.title}
                </h3>
                {reward.description && (
                  <p className="text-slate-400 text-sm mt-1 line-clamp-2">
                    {reward.description}
                  </p>
                )}
                <div className="flex items-center gap-1 mt-auto pt-3 text-amber-400 font-bold">
                  <Star className="w-4 h-4 fill-amber-400" />
                  {reward.pointsCost}
                </div>
                <button
                  onClick={() => claimReward(reward.id)}
                  disabled={!canClaim}
                  className="mt-3 py-2.5 rounded-lg font-semibold transition-all active:scale-95 disabled:bg-slate-700 disabled:text-slate-500 bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  {selectedMemberId ? 'Claim' : 'Select member'}
                </button>
              </div>
            );
          })}
        </div>

        {availableRewards.length === 0 && (
          <div className="text-center text-slate-500 py-12">
            <Gift className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-lg">No rewards available</p>
            <p className="text-sm mt-1">Add rewards to motivate the family!</p>
          </div>
        )}
      </div>
    </div>
  );
}
