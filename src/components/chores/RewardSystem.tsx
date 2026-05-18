import { useState, useRef, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { Gift, Plus, Star, X, Lock, Unlock, Check, Trash2 } from 'lucide-react';

const PASSCODE = '6554';
const AUTO_LOCK_MS = 3 * 60 * 1000; // 3 minutes of inactivity

const REWARD_ICONS = [
  { emoji: '📺', label: 'TV Time' },
  { emoji: '🍦', label: 'Ice Cream' },
  { emoji: '🎮', label: 'Gaming' },
  { emoji: '🎬', label: 'Movie' },
  { emoji: '🍕', label: 'Pizza Night' },
  { emoji: '🧸', label: 'New Toy' },
  { emoji: '🛍️', label: 'Shopping' },
  { emoji: '🎡', label: 'Outing' },
  { emoji: '💻', label: 'Computer' },
  { emoji: '🎵', label: 'Music' },
  { emoji: '🏊', label: 'Swimming' },
  { emoji: '🎁', label: 'Gift' },
  { emoji: '🍰', label: 'Cake / Treat' },
  { emoji: '🌳', label: 'Park Day' },
  { emoji: '📚', label: 'Books' },
  { emoji: '⭐', label: 'Special' },
  { emoji: '🎠', label: 'Fun Day' },
  { emoji: '🎯', label: 'Activity' },
];

interface RewardSystemProps {
  selectedMemberId: string | null;
}

export default function RewardSystem({ selectedMemberId }: RewardSystemProps) {
  // ── Lock state ──────────────────────────────────────────────────────────
  const [locked, setLocked] = useState(true);
  const [passcodeInput, setPasscodeInput] = useState('');
  const [passcodeError, setPasscodeError] = useState(false);
  const autoLockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetAutoLock = useCallback(() => {
    if (autoLockTimerRef.current) clearTimeout(autoLockTimerRef.current);
    autoLockTimerRef.current = setTimeout(() => {
      setLocked(true);
      setPasscodeInput('');
      setShowForm(false);
    }, AUTO_LOCK_MS);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { if (autoLockTimerRef.current) clearTimeout(autoLockTimerRef.current); }, []);

  const handleNumpad = (key: string) => {
    if (key === '⌫') {
      setPasscodeInput((p) => p.slice(0, -1));
      setPasscodeError(false);
      return;
    }
    const next = passcodeInput + key;
    if (next.length > 4) return;
    setPasscodeInput(next);
    if (next.length === 4) {
      if (next === PASSCODE) {
        setLocked(false);
        setPasscodeInput('');
        setPasscodeError(false);
        resetAutoLock();
      } else {
        setPasscodeError(true);
        setTimeout(() => { setPasscodeInput(''); setPasscodeError(false); }, 900);
      }
    }
  };

  const handleLock = () => {
    if (autoLockTimerRef.current) clearTimeout(autoLockTimerRef.current);
    setLocked(true);
    setPasscodeInput('');
    setShowForm(false);
  };

  // Any admin action resets the inactivity timer
  const touch = () => resetAutoLock();

  // ── Form state ──────────────────────────────────────────────────────────
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [pointsCost, setPointsCost] = useState(10);
  const [selectedIcon, setSelectedIcon] = useState('');
  const [claimedId, setClaimedId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── Data ────────────────────────────────────────────────────────────────
  const rewards = useLiveQuery(() => db.rewards.toArray()) ?? [];
  const members = useLiveQuery(() => db.familyMembers.toArray()) ?? [];
  const stickers = useLiveQuery(() => db.stickerRecords.toArray()) ?? [];

  const getAvailablePoints = (memberId: string) => {
    const earned = stickers.filter((s) => s.memberId === memberId).reduce((sum, s) => sum + s.points, 0);
    const spent = rewards.filter((r) => r.claimedBy === memberId).reduce((sum, r) => sum + r.pointsCost, 0);
    return earned - spent;
  };

  const selectedMember = members.find((m) => m.id === selectedMemberId);
  const availablePoints = selectedMemberId ? getAvailablePoints(selectedMemberId) : 0;

  const claimReward = async (rewardId: string) => {
    if (!selectedMemberId) return;
    const reward = rewards.find((r) => r.id === rewardId);
    if (!reward || getAvailablePoints(selectedMemberId) < reward.pointsCost) return;
    setClaimedId(rewardId);
    await db.rewards.update(rewardId, { claimedBy: selectedMemberId });
    setTimeout(() => setClaimedId(null), 600);
  };

  const addReward = async () => {
    touch();
    const trimmed = title.trim();
    if (!trimmed) return;
    setSaveError(null);
    try {
      await db.rewards.add({
        id: crypto.randomUUID(),
        title: trimmed,
        description: description.trim(),
        pointsCost: pointsCost || 10,
        imageUrl: selectedIcon || undefined,
        claimedBy: null,
      });
      setTitle('');
      setDescription('');
      setPointsCost(10);
      setSelectedIcon('');
      setShowForm(false);
    } catch (err) {
      setSaveError(String(err));
    }
  };

  const cancelForm = () => {
    touch();
    setShowForm(false);
    setTitle('');
    setDescription('');
    setPointsCost(10);
    setSelectedIcon('');
    setSaveError(null);
  };

  const deleteReward = async (id: string) => {
    touch();
    await db.rewards.delete(id);
  };

  const availableRewards = rewards.filter((r) => r.claimedBy === null);

  // ── Numpad UI ────────────────────────────────────────────────────────────
  const numpadKeys = ['1','2','3','4','5','6','7','8','9','⌫','0',''];

  const LockOverlay = () => (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-900/97 rounded-xl">
      <Lock className="w-10 h-10 text-purple-400 mb-2" />
      <h3 className="text-white font-bold text-xl mb-1">Rewards</h3>
      <p className="text-slate-400 text-sm mb-6">Enter passcode to manage</p>

      {/* Dots */}
      <div className={`flex gap-3 mb-6 ${passcodeError ? 'animate-bounce' : ''}`}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`w-5 h-5 rounded-full border-2 transition-all duration-150 ${
              i < passcodeInput.length
                ? passcodeError
                  ? 'bg-red-500 border-red-500'
                  : 'bg-purple-400 border-purple-400'
                : 'border-slate-600'
            }`}
          />
        ))}
      </div>

      {/* Numpad */}
      <div className="grid grid-cols-3 gap-3">
        {numpadKeys.map((key, idx) => (
          <button
            key={idx}
            onClick={() => key && handleNumpad(key)}
            disabled={!key}
            className={`w-16 h-16 rounded-2xl font-bold text-xl transition-all active:scale-90 ${
              key === '⌫'
                ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                : key
                ? 'bg-slate-800 text-white hover:bg-slate-700'
                : 'opacity-0 pointer-events-none'
            }`}
          >
            {key}
          </button>
        ))}
      </div>

      {passcodeError && (
        <p className="text-red-400 text-sm mt-4 font-medium">Incorrect passcode</p>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden relative">
      {/* ── Header — always visible ─────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Gift className="w-6 h-6 text-purple-400" />
          Rewards
          {!locked && (
            <span className="text-xs text-emerald-400 font-normal ml-1 flex items-center gap-1">
              <Unlock className="w-3 h-3" /> unlocked
            </span>
          )}
        </h2>

        <div className="flex items-center gap-2">
          {/* Lock / Unlock button */}
          {locked ? (
            <button
              onClick={() => setLocked(true) /* already locked; tapping does nothing visual */}
              className="p-2 rounded-xl bg-slate-700 text-slate-400"
              title="Locked — enter passcode to manage rewards"
            >
              <Lock className="w-5 h-5" />
            </button>
          ) : (
            <>
              {!showForm ? (
                <button
                  onClick={() => { touch(); setSaveError(null); setShowForm(true); }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-medium transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  Add
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={cancelForm}
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl font-medium transition-colors"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                  <button
                    onClick={addReward}
                    disabled={!title.trim()}
                    className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-600 disabled:text-slate-400 text-white rounded-xl font-medium transition-colors"
                  >
                    <Check className="w-4 h-4" />
                    Save
                  </button>
                </div>
              )}
              <button
                onClick={handleLock}
                className="p-2 rounded-xl bg-emerald-600/20 hover:bg-red-500/20 text-emerald-400 hover:text-red-400 transition-colors"
                title="Lock rewards"
              >
                <Unlock className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Selected member balance ─────────────────────────────────────── */}
      {selectedMember && (
        <div className="bg-slate-800 rounded-xl p-4 mb-4 flex items-center gap-3 flex-shrink-0">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white overflow-hidden"
            style={{ backgroundColor: selectedMember.color }}
          >
            {selectedMember.avatar ? (
              <img src={selectedMember.avatar} alt={selectedMember.name} className="w-full h-full object-cover" />
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

      {/* ── Add reward form ─────────────────────────────────────────────── */}
      {showForm && !locked && (
        <div className="bg-slate-800 rounded-xl p-4 mb-4 space-y-3 flex-shrink-0">
          {/* Icon picker */}
          <div>
            <label className="text-xs text-slate-400 mb-2 block">Choose an icon (optional)</label>
            <div className="grid grid-cols-6 gap-2">
              {REWARD_ICONS.map(({ emoji, label }) => (
                <button
                  key={emoji}
                  onClick={() => { touch(); setSelectedIcon(selectedIcon === emoji ? '' : emoji); }}
                  title={label}
                  className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all ${
                    selectedIcon === emoji
                      ? 'bg-purple-500/40 ring-2 ring-purple-400 scale-110'
                      : 'bg-white/5 hover:bg-white/10'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <input
            type="text"
            placeholder="Reward title *"
            value={title}
            onChange={(e) => { touch(); setTitle(e.target.value); }}
            onKeyDown={(e) => e.key === 'Enter' && addReward()}
            autoFocus
            className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none text-lg"
          />
          <input
            type="text"
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => { touch(); setDescription(e.target.value); }}
            onKeyDown={(e) => e.key === 'Enter' && addReward()}
            className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
          />
          <div>
            <label className="text-sm text-slate-400 mb-1 block">Point Cost</label>
            <input
              type="number"
              min={1}
              value={pointsCost}
              onChange={(e) => { touch(); setPointsCost(Math.max(1, Number(e.target.value) || 1)); }}
              className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
            />
          </div>
          {saveError && <p className="text-red-400 text-sm">{saveError}</p>}
        </div>
      )}

      {/* ── Reward grid ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-2 gap-3">
          {availableRewards.map((reward) => {
            const canClaim = !!selectedMemberId && availablePoints >= reward.pointsCost;
            const isEmoji = reward.imageUrl && !reward.imageUrl.startsWith('http') && !reward.imageUrl.startsWith('data:');
            return (
              <div
                key={reward.id}
                className={`bg-slate-800 rounded-xl p-4 flex flex-col relative transition-all duration-300 ${
                  claimedId === reward.id ? 'scale-95 opacity-70' : ''
                }`}
              >
                {/* Delete — only when unlocked */}
                {!locked && (
                  <button
                    onClick={() => deleteReward(reward.id)}
                    className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded-full text-slate-600 hover:text-red-400 hover:bg-red-900/30 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}

                {/* Icon */}
                {isEmoji ? (
                  <div className="text-4xl mb-2">{reward.imageUrl}</div>
                ) : reward.imageUrl ? (
                  <img src={reward.imageUrl} alt={reward.title} className="w-10 h-10 object-contain mb-2" />
                ) : (
                  <Gift className="w-8 h-8 text-purple-400 mb-2" />
                )}

                <h3 className="text-white font-semibold leading-snug pr-6">{reward.title}</h3>
                {reward.description && (
                  <p className="text-slate-400 text-sm mt-1 line-clamp-2">{reward.description}</p>
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

        {availableRewards.length === 0 && !showForm && (
          <div className="text-center text-slate-500 py-12">
            <Gift className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-lg">No rewards available</p>
            <p className="text-sm mt-1">
              {locked ? 'Tap 🔒 to unlock and add rewards' : 'Add rewards to motivate the family!'}
            </p>
          </div>
        )}
      </div>

      {/* ── Lock overlay ─────────────────────────────────────────────────── */}
      {locked && <LockOverlay />}
    </div>
  );
}
