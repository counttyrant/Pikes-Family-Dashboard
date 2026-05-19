import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import {
  Settings,
  ClipboardList,
  Users,
  Gift,
  X,
  Lock,
  Unlock,
} from 'lucide-react';
import FamilyMemberCard from '../components/chores/FamilyMember';
import ChoreList from '../components/chores/ChoreList';
import RewardSystem from '../components/chores/RewardSystem';

const PASSCODE = '6554';
const AUTO_LOCK_MS = 3 * 60 * 1000;

export default function ChoreChart() {
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [givePointsMemberId, setGivePointsMemberId] = useState<string | null>(null);
  const [givePointsAmount, setGivePointsAmount] = useState(5);
  const [givePointsRemove, setGivePointsRemove] = useState(false);
  const [givePointsReason, setGivePointsReason] = useState('');
  const [givePointsError, setGivePointsError] = useState('');

  // ── Rewards lock ────────────────────────────────────────────────────────
  const [rewardsLocked, setRewardsLocked] = useState(true);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const autoLockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetAutoLock = useCallback(() => {
    if (autoLockTimerRef.current) clearTimeout(autoLockTimerRef.current);
    autoLockTimerRef.current = setTimeout(() => setRewardsLocked(true), AUTO_LOCK_MS);
  }, []);

  useEffect(() => () => { if (autoLockTimerRef.current) clearTimeout(autoLockTimerRef.current); }, []);

  const handlePinChange = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 4);
    setPinInput(digits);
    setPinError(false);
    if (digits.length === 4) {
      if (digits === PASSCODE) {
        setRewardsLocked(false);
        setShowUnlockModal(false);
        setPinInput('');
        resetAutoLock();
      } else {
        setPinError(true);
        setTimeout(() => { setPinInput(''); setPinError(false); }, 900);
      }
    }
  };

  const handleLockButton = () => {
    if (rewardsLocked) {
      // Show unlock modal
      setPinInput('');
      setPinError(false);
      setShowUnlockModal(true);
    } else {
      // Lock immediately
      if (autoLockTimerRef.current) clearTimeout(autoLockTimerRef.current);
      setRewardsLocked(true);
    }
  };

  const members = useLiveQuery(() => db.familyMembers.toArray()) ?? [];

  const openGivePoints = (memberId: string) => {
    setGivePointsMemberId(memberId);
    setGivePointsAmount(5);
    setGivePointsRemove(false);
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
        points: givePointsRemove ? -pts : pts,
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
        <div className="flex items-center gap-2">
          <button className="w-11 h-11 flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <Settings className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* family members row */}
      <div className="px-6 py-4 border-b border-slate-800">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-5 h-5 text-slate-400" />
          <span className="text-sm font-medium text-slate-400">
            Family Members
          </span>
          <div className="ml-auto flex items-center gap-2">
            {selectedMemberId && !rewardsLocked && (
              <button
                onClick={() => openGivePoints(selectedMemberId)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-lg text-sm font-medium transition-colors"
              >
                <Gift className="w-4 h-4" />
                Give Points
              </button>
            )}
            {/* Admin lock button — prominent and always accessible */}
            <button
              onClick={handleLockButton}
              title={rewardsLocked ? 'Unlock admin controls' : 'Lock admin controls'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                rewardsLocked
                  ? 'bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-white'
                  : 'bg-emerald-500/20 hover:bg-red-500/20 text-emerald-400 hover:text-red-400'
              }`}
            >
              {rewardsLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
              {rewardsLocked ? 'Unlock' : 'Lock'}
            </button>
          </div>
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
          <ChoreList selectedMemberId={selectedMemberId} locked={rewardsLocked} />
        </div>
        <div className="w-2/5 overflow-hidden flex flex-col">
          <RewardSystem
            selectedMemberId={selectedMemberId}
            locked={rewardsLocked}
            onActivity={resetAutoLock}
          />
        </div>
      </div>

      {/* ── Unlock passcode modal (portal — renders to body, outside Swiper transform) ── */}
      {showUnlockModal && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && (setShowUnlockModal(false), setPinInput(''))}
        >
          <div className="bg-slate-800 rounded-2xl p-8 w-72 shadow-2xl border border-slate-700 flex flex-col items-center">
            <Lock className="w-8 h-8 text-purple-400 mb-3" />
            <h2 className="text-white font-bold text-xl mb-1">Unlock Rewards</h2>
            <p className="text-slate-400 text-sm mb-6 text-center">Enter the passcode to manage rewards</p>

            {/* PIN dots */}
            <div className="flex gap-3 mb-5">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`w-5 h-5 rounded-full border-2 transition-all duration-100 ${
                    i < pinInput.length
                      ? pinError
                        ? 'bg-red-500 border-red-500'
                        : 'bg-purple-400 border-purple-400'
                      : 'border-slate-600'
                  }`}
                />
              ))}
            </div>

            {/* Visible numeric input — triggers the device soft keyboard on tap */}
            <input
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              value={pinInput}
              onChange={(e) => handlePinChange(e.target.value)}
              autoFocus
              placeholder="Tap to enter code"
              className={`w-full py-3 px-4 rounded-xl text-center text-lg font-mono tracking-widest border outline-none transition-colors mb-4 bg-slate-700 text-white placeholder-slate-500 ${
                pinError
                  ? 'border-red-500 bg-red-500/10 text-red-400'
                  : 'border-slate-600 focus:border-purple-400'
              }`}
              aria-label="Enter passcode"
            />

            <button
              onClick={() => { setShowUnlockModal(false); setPinInput(''); setPinError(false); }}
              className="text-slate-500 hover:text-slate-300 text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      , document.body)}

      {/* Give Points modal (portal — renders to body, outside Swiper transform) */}
      {givePointsMemberId && givePointsMember && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-2xl p-6 w-80 shadow-2xl border border-slate-700">
            <div className="flex items-center justify-between mb-4">
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
                  {givePointsRemove ? 'Remove' : 'Give'} {givePointsMember.name} Points
                </h2>
              </div>
              <button
                onClick={() => setGivePointsMemberId(null)}
                className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X size={18} className="text-slate-400" />
              </button>
            </div>

            {/* Give / Remove toggle */}
            <div className="flex rounded-xl overflow-hidden border border-slate-600 mb-4">
              <button
                onClick={() => setGivePointsRemove(false)}
                className={`flex-1 py-2 text-sm font-semibold transition-colors ${!givePointsRemove ? 'bg-amber-500 text-white' : 'bg-slate-700 text-slate-400 hover:text-white'}`}
              >
                ⭐ Give Points
              </button>
              <button
                onClick={() => setGivePointsRemove(true)}
                className={`flex-1 py-2 text-sm font-semibold transition-colors ${givePointsRemove ? 'bg-red-500 text-white' : 'bg-slate-700 text-slate-400 hover:text-white'}`}
              >
                ➖ Remove Points
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Points</label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={givePointsAmount}
                  onChange={(e) => setGivePointsAmount(Math.max(1, Number(e.target.value) || 1))}
                  onKeyDown={(e) => e.key === 'Enter' && saveGivePoints()}
                  className="w-full rounded-lg bg-white/10 border border-white/10 px-3 py-3 text-white text-2xl font-bold text-center focus:outline-none focus:ring-2 focus:ring-amber-500"
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
                className={`w-full py-3 rounded-xl font-bold text-lg transition-colors text-white ${givePointsRemove ? 'bg-red-500 hover:bg-red-400' : 'bg-amber-500 hover:bg-amber-400'}`}
              >
                {givePointsRemove ? `Remove ${Math.max(1, givePointsAmount)} Points` : `Give ${Math.max(1, givePointsAmount)} Points ⭐`}
              </button>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  );
}
