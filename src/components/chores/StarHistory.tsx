import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { deleteStickerRecord } from '../../services/storage';
import { Star, ClipboardCheck, Gift, Hand, History, Trash2 } from 'lucide-react';
import type { StickerRecord, FamilyMember } from '../../types';

type Filter = 'all' | 'earned' | 'spent';

const RANGES = [
  { key: 7, label: '7 days' },
  { key: 30, label: '30 days' },
  { key: 0, label: 'All time' },
] as const;

function toDate(value: Date | string): Date {
  // Records round-tripped through the cloud sync come back as ISO strings.
  return value instanceof Date ? value : new Date(value);
}

function formatWhen(date: Date, nowTs: number): string {
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  const now = new Date(nowTs);
  const sameDay = date.toDateString() === now.toDateString();
  const yesterday = new Date(nowTs);
  yesterday.setDate(now.getDate() - 1);

  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (sameDay) return `Today ${time}`;
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday ${time}`;
  return `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${time}`;
}

function entryIcon(record: StickerRecord) {
  if (record.kind === 'reward' || record.rewardId) return Gift;
  if (record.kind === 'chore' || record.choreId) return ClipboardCheck;
  return Hand;
}

function entryLabel(record: StickerRecord): string {
  if (record.label) return record.label;
  // Fallback for records written before labels were stored.
  if (record.kind === 'reward' || record.rewardId) return 'Reward claimed';
  if (record.kind === 'chore' || record.choreId) return 'Chore completed';
  return record.points < 0 ? 'Points removed' : 'Bonus points';
}

interface Props {
  members: FamilyMember[];
  selectedMemberId: string | null;
  locked?: boolean;
}

export default function StarHistory({ members, selectedMemberId, locked = true }: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const [days, setDays] = useState<number>(30);
  // Reading the clock during render is impure and makes the date-range filter
  // and "Today/Yesterday" labels unstable across re-renders. Snapshot it and
  // refresh once a minute so the always-on kiosk rolls over correctly.
  const [nowTs, setNowTs] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNowTs(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const records = useLiveQuery(
    () => db.stickerRecords.orderBy('earnedAt').reverse().toArray(),
    [],
  );

  const memberById = useMemo(
    () => new Map(members.map((m) => [m.id, m])),
    [members],
  );

  const visible = useMemo(() => {
    const cutoff = days > 0 ? nowTs - days * 24 * 60 * 60 * 1000 : null;
    return (records ?? [])
      .filter((r) => (selectedMemberId ? r.memberId === selectedMemberId : true))
      .filter((r) => (filter === 'earned' ? r.points > 0 : filter === 'spent' ? r.points < 0 : true))
      .filter((r) => (cutoff === null ? true : toDate(r.earnedAt).getTime() >= cutoff))
      // orderBy('earnedAt') sorts on the stored value; re-sort defensively so
      // string-valued dates from cloud sync still land in the right order.
      .sort((a, b) => toDate(b.earnedAt).getTime() - toDate(a.earnedAt).getTime());
  }, [records, selectedMemberId, filter, days, nowTs]);

  const { earned, spent } = useMemo(() => {
    let earnedSum = 0;
    let spentSum = 0;
    for (const r of visible) {
      if (r.points > 0) earnedSum += r.points;
      else spentSum += Math.abs(r.points);
    }
    return { earned: earnedSum, spent: spentSum };
  }, [visible]);

  const removeEntry = async (id: string) => {
    await deleteStickerRecord(id);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2 mb-3 flex-shrink-0">
        <History className="w-5 h-5 text-blue-400" />
        <h3 className="text-lg font-bold text-white">Star History</h3>
        <span className="text-slate-500 text-sm">
          {selectedMemberId ? memberById.get(selectedMemberId)?.name ?? '' : 'Everyone'}
        </span>
      </div>

      {/* totals */}
      <div className="grid grid-cols-3 gap-2 mb-3 flex-shrink-0">
        <div className="bg-slate-800 rounded-xl px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Earned</p>
          <p className="text-emerald-400 font-bold text-lg">+{earned}</p>
        </div>
        <div className="bg-slate-800 rounded-xl px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Spent</p>
          <p className="text-rose-400 font-bold text-lg">−{spent}</p>
        </div>
        <div className="bg-slate-800 rounded-xl px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Net</p>
          <p className="text-amber-400 font-bold text-lg">{earned - spent}</p>
        </div>
      </div>

      {/* filters */}
      <div className="flex items-center gap-2 mb-3 flex-shrink-0 flex-wrap">
        {(['all', 'earned', 'spent'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
              filter === f
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            {f}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setDays(r.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                days === r.key
                  ? 'bg-slate-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* entries */}
      <div className="flex-1 overflow-y-auto pr-1">
        {visible.length === 0 ? (
          <div className="text-center text-slate-500 py-12">
            <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-lg">No activity yet</p>
            <p className="text-sm mt-1">Completed chores and claimed rewards will show up here.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {visible.map((record) => {
              const Icon = entryIcon(record);
              const member = memberById.get(record.memberId);
              const positive = record.points > 0;
              return (
                <li
                  key={record.id}
                  className="flex items-center gap-3 bg-slate-800 rounded-xl px-3 py-2.5"
                >
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      positive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-white text-sm font-medium truncate">
                      {entryLabel(record)}
                    </p>
                    <p className="text-slate-500 text-xs truncate">
                      {!selectedMemberId && member ? `${member.name} · ` : ''}
                      {formatWhen(toDate(record.earnedAt), nowTs)}
                    </p>
                  </div>

                  <div
                    className={`flex items-center gap-1 font-bold text-sm flex-shrink-0 ${
                      positive ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    <Star className={`w-3.5 h-3.5 ${positive ? 'fill-emerald-400' : 'fill-rose-400'}`} />
                    {positive ? `+${record.points}` : record.points}
                  </div>

                  {!locked && (
                    <button
                      onClick={() => removeEntry(record.id)}
                      title="Delete entry"
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-900/30 transition-colors flex-shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
