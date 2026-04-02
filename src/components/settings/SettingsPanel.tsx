import { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import {
  getSettings,
  saveSettings,
  addPhoto,
  deletePhoto,
  addFamilyMember,
  deleteFamilyMember,
  addCountdownEvent,
  deleteCountdownEvent,
} from '../../services/storage';
import type { DashboardSettings, PhotoSource, ThemeName, GoogleCalendarInfo } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { fetchImmichAlbums } from '../../services/immich';
import { fetchGooglePhotosAlbums } from '../../services/googlePhotos';
import { fetchCalendarList } from '../../services/googleCalendar';
import { saveAllToCloud, loadAllFromCloud } from '../../services/cloudSync';
import { checkBrightnessService } from '../../services/brightnessService';
import {
  Settings,
  X,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Upload,
  Calendar,
  Cloud,
  CloudUpload,
  CloudDownload,
  Users,
  Image as ImageIcon,
  Timer,
  Moon,
  Bot,
  Info,
  Camera,
  Mic,
  Palette,
  Shield,
  LogOut,
  LayoutGrid,
  GripVertical,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Download,
  CheckCircle,
  XCircle,
  Sun,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { ALL_PAGES, DEFAULT_PAGE_ORDER } from '../../constants/pages';
import { WIDGET_REGISTRY } from '../widgets/widgetRegistry';

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* -------------------------------------------------------------------------- */
/*  Reusable sub-components                                                   */
/* -------------------------------------------------------------------------- */

function Section({
  title,
  icon,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-white/10 pb-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full py-3 text-left text-sm font-semibold text-white/90 hover:text-white transition-colors"
      >
        <span className="flex items-center gap-2">
          {icon}
          {title}
        </span>
        {open ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
      </button>
      <div
        className={`overflow-hidden transition-all duration-200 ${open ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}
      >
        <div className="pb-3 space-y-3">{children}</div>
      </div>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder = '',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs text-white/60">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg bg-white/10 border border-white/10 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
      />
    </label>
  );
}

function VoiceSelector({ voiceName, onVoiceChange }: { voiceName: string; onVoiceChange: (name: string) => void }) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    const load = () => {
      const v = window.speechSynthesis?.getVoices() ?? [];
      if (v.length) setVoices(v);
    };
    load();
    window.speechSynthesis?.addEventListener('voiceschanged', load);
    return () => window.speechSynthesis?.removeEventListener('voiceschanged', load);
  }, []);

  const englishVoices = voices.filter(v => v.lang.startsWith('en'));

  return (
    <select
      value={voiceName}
      onChange={(e) => onVoiceChange(e.target.value)}
      className="w-full rounded-lg bg-white/10 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
    >
      <option value="">Auto (friendly female)</option>
      {englishVoices.map((v) => (
        <option key={v.name} value={v.name}>
          {v.name} ({v.lang})
        </option>
      ))}
    </select>
  );
}

/* -------------------------------------------------------------------------- */
/*  SettingsPanel                                                             */
/* -------------------------------------------------------------------------- */

interface SettingsPanelProps {
  open?: boolean;
  onClose?: () => void;
}

export function SettingsPanel({ open: controlledOpen, onClose }: SettingsPanelProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const handleClose = () => {
    onClose?.();
    if (!isControlled) setInternalOpen(false);
  };

  const { user, signOut, signIn, accessToken } = useAuth();
  const { theme, setTheme, themes } = useTheme();

  const [settings, setSettings] = useState<DashboardSettings | null>(null);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberColor, setNewMemberColor] = useState('#3b82f6');
  const [newMemberAvatar, setNewMemberAvatar] = useState('');
  const [newCountdownTitle, setNewCountdownTitle] = useState('');
  const [newCountdownDate, setNewCountdownDate] = useState('');
  const [newCountdownColor, setNewCountdownColor] = useState('#3b82f6');
  const [newAllowedEmail, setNewAllowedEmail] = useState('');
  const [immichAlbums, setImmichAlbums] = useState<{ id: string; albumName: string; assetCount: number }[]>([]);
  const [googleAlbums, setGoogleAlbums] = useState<{ id: string; title: string; mediaItemsCount: string }[]>([]);
  const [googleAlbumsLoading, setGoogleAlbumsLoading] = useState(false);
  const [googleAlbumsError, setGoogleAlbumsError] = useState<string | null>(null);
  const [googleCalendars, setGoogleCalendars] = useState<GoogleCalendarInfo[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [calendarErrorIs403, setCalendarErrorIs403] = useState(false);
  const [manualCalendarEmail, setManualCalendarEmail] = useState('');
  const [cloudStatus, setCloudStatus] = useState<'idle' | 'saving' | 'loading' | 'saved' | 'loaded' | 'error'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const members = useLiveQuery(() => db.familyMembers.toArray()) ?? [];
  const photos = useLiveQuery(() => db.photos.orderBy('addedAt').reverse().toArray()) ?? [];
  const countdowns = useLiveQuery(() => db.countdownEvents.orderBy('date').toArray()) ?? [];

  useEffect(() => {
    getSettings().then(setSettings);
  }, [open]);

  const save = async (patch: Partial<DashboardSettings>) => {
    await saveSettings(patch);
    setSettings((s) => (s ? { ...s, ...patch } : s));
  };

  /* -- Family Members ----------------------------------------------------- */

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const base64 = await fileToBase64(file);
      setNewMemberAvatar(base64);
    }
  };

  const handleAddMember = async () => {
    if (!newMemberName.trim()) return;
    await addFamilyMember({
      name: newMemberName.trim(),
      avatar: newMemberAvatar,
      color: newMemberColor,
    });
    setNewMemberName('');
    setNewMemberColor('#3b82f6');
    setNewMemberAvatar('');
  };

  /* -- Photos ------------------------------------------------------------- */

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      await addPhoto(file);
    }
    e.target.value = '';
  };

  /* -- Countdown Events --------------------------------------------------- */

  const handleAddCountdown = async () => {
    if (!newCountdownTitle.trim() || !newCountdownDate) return;
    await addCountdownEvent({
      title: newCountdownTitle.trim(),
      date: new Date(newCountdownDate),
      color: newCountdownColor,
    });
    setNewCountdownTitle('');
    setNewCountdownDate('');
    setNewCountdownColor('#3b82f6');
  };

  /* -- Immich Albums ------------------------------------------------------ */

  const [immichLoading, setImmichLoading] = useState(false);
  const [immichError, setImmichError] = useState('');
  const [brightnessTestStatus, setBrightnessTestStatus] = useState<'idle' | 'ok' | 'fail'>('idle');

  const handleFetchImmichAlbums = async () => {
    if (!settings?.immichUrl || !settings?.immichApiKey) {
      setImmichError('Set Immich URL and API key first');
      return;
    }
    setImmichLoading(true);
    setImmichError('');
    try {
      const albums = await fetchImmichAlbums(settings.immichUrl, settings.immichApiKey);
      if (albums.length === 0) {
        setImmichError('No albums found — check URL and API key. CORS may block direct browser requests.');
      }
      setImmichAlbums(albums);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setImmichError(`Failed: ${msg}`);
    }
    setImmichLoading(false);
  };

  /* -- Google Photos Albums ----------------------------------------------- */

  const handleFetchGoogleAlbums = async () => {
    if (!accessToken) {
      setGoogleAlbumsError(user?.tokenExpired ? 'Session expired — tap "Reconnect" to refresh your Google session' : 'Not signed in — sign in with Google first');
      return;
    }
    setGoogleAlbumsLoading(true);
    setGoogleAlbumsError(null);
    try {
      const albums = await fetchGooglePhotosAlbums(accessToken);
      setGoogleAlbums(albums);
      if (albums.length === 0) {
        setGoogleAlbumsError('No albums found. Make sure the Photos Library API is enabled in your Google Cloud Console.');
      }
    } catch (err) {
      console.warn('Failed to fetch Google Photos albums:', err);
      setGoogleAlbumsError(
        'Failed to load albums. Ensure the Photos Library API is enabled in your Google Cloud Console project.'
      );
    } finally {
      setGoogleAlbumsLoading(false);
    }
  };

  /* -- Google Calendars -------------------------------------------------- */

  const handleFetchGoogleCalendars = async () => {
    if (!accessToken) {
      setCalendarError(user?.tokenExpired ? 'Session expired — tap "Reconnect" to refresh your Google session' : 'Not signed in — sign in with Google first');
      return;
    }
    setCalendarLoading(true);
    setCalendarError(null);
    setCalendarErrorIs403(false);
    try {
      const calendars = await fetchCalendarList(accessToken);
      setGoogleCalendars(calendars);
      // Save calendar colors for color-coding events
      const colorMap: Record<string, string> = { ...(settings?.calendarColors ?? {}) };
      for (const cal of calendars) {
        colorMap[cal.id] = cal.backgroundColor;
      }
      save({ calendarColors: colorMap });
      if (calendars.length === 0) {
        setCalendarError('No calendars found');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load calendars';
      const is403 = msg.includes('403');
      setCalendarErrorIs403(is403);
      setCalendarError(
        is403
          ? 'Access denied (403). Your token may be stale — try re-authenticating below.'
          : msg,
      );
      console.warn('Failed to fetch calendar list:', err);
    } finally {
      setCalendarLoading(false);
    }
  };

  const handleAddManualCalendar = () => {
    if (!manualCalendarEmail.trim() || !settings) return;
    const email = manualCalendarEmail.trim().toLowerCase();
    const current = settings.selectedCalendarIds ?? ['primary'];
    if (!current.includes(email)) {
      save({ selectedCalendarIds: [...current, email] });
    }
    // Also add to the displayed list so it shows in the UI
    if (!googleCalendars.find((c) => c.id === email)) {
      setGoogleCalendars((prev) => [
        ...prev,
        {
          id: email,
          summary: email,
          backgroundColor: '#8b5cf6',
          primary: false,
          accessRole: 'reader',
        },
      ]);
    }
    setManualCalendarEmail('');
  };

  const handleToggleCalendar = (calId: string) => {
    if (!settings) return;
    const current = settings.selectedCalendarIds ?? ['primary'];
    const updated = current.includes(calId)
      ? current.filter((id) => id !== calId)
      : [...current, calId];
    save({ selectedCalendarIds: updated.length > 0 ? updated : ['primary'] });
  };

  /* -- Allowed Emails ----------------------------------------------------- */

  const handleAddAllowedEmail = () => {
    if (!newAllowedEmail.trim() || !settings) return;
    const updated = [...(settings.allowedEmails ?? []), newAllowedEmail.trim().toLowerCase()];
    save({ allowedEmails: updated });
    setNewAllowedEmail('');
  };

  const handleRemoveAllowedEmail = (email: string) => {
    if (!settings) return;
    const updated = (settings.allowedEmails ?? []).filter((e) => e !== email);
    save({ allowedEmails: updated });
  };

  if (!settings) return null;

  return (
    <>
      {!isControlled && (
        <button
          onClick={() => setInternalOpen(true)}
          className="fixed top-4 right-4 z-40 rounded-full bg-black/40 p-3 backdrop-blur-sm hover:bg-black/60 transition-colors"
          aria-label="Open settings"
        >
          <Settings size={20} />
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40" onClick={handleClose} />
      )}

      <div
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-[400px] bg-slate-900/95 backdrop-blur-xl border-l border-white/10 transform transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        } overflow-y-auto`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 sticky top-0 bg-slate-900/95 backdrop-blur-xl z-10">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Settings size={20} className="text-slate-400" />
            Settings
          </h2>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* User info bar */}
        {user && (
          <div className="flex items-center gap-3 p-4 border-b border-white/10">
            <img src={user.picture} alt="" className="w-10 h-10 rounded-full" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.name}</p>
              <p className="text-xs text-white/50 truncate">{user.email}</p>
            </div>
            <button
              onClick={signOut}
              className="flex items-center gap-1 px-3 py-2 text-xs bg-red-500/20 hover:bg-red-500/30 rounded-lg text-red-400 transition-colors"
            >
              <LogOut size={14} /> Sign Out
            </button>
          </div>
        )}

        {/* Cloud Sync Bar */}
        <div className="flex items-center gap-2 p-3 border-b border-white/10">
          <Cloud size={16} className="text-blue-400 shrink-0" />
          <span className="text-xs text-white/60 flex-1">Cloud Sync</span>
          {cloudStatus === 'saved' && <span className="text-xs text-green-400">✓ Saved</span>}
          {cloudStatus === 'loaded' && <span className="text-xs text-green-400">✓ Loaded</span>}
          {cloudStatus === 'error' && <span className="text-xs text-red-400">Failed</span>}
          <button
            disabled={cloudStatus === 'saving' || cloudStatus === 'loading'}
            onClick={async () => {
              setCloudStatus('saving');
              const ok = await saveAllToCloud();
              setCloudStatus(ok ? 'saved' : 'error');
              setTimeout(() => setCloudStatus('idle'), 3000);
            }}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-500/20 hover:bg-blue-500/30 rounded-lg text-blue-400 transition-colors disabled:opacity-50"
          >
            <CloudUpload size={14} />
            {cloudStatus === 'saving' ? 'Saving…' : 'Save'}
          </button>
          <button
            disabled={cloudStatus === 'saving' || cloudStatus === 'loading'}
            onClick={async () => {
              setCloudStatus('loading');
              const ok = await loadAllFromCloud();
              if (ok) {
                const fresh = await getSettings();
                setSettings(fresh);
              }
              setCloudStatus(ok ? 'loaded' : 'error');
              setTimeout(() => setCloudStatus('idle'), 3000);
            }}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-emerald-500/20 hover:bg-emerald-500/30 rounded-lg text-emerald-400 transition-colors disabled:opacity-50"
          >
            <CloudDownload size={14} />
            {cloudStatus === 'loading' ? 'Loading…' : 'Load'}
          </button>
        </div>

        {/* Sections */}
        <div className="p-4 space-y-1">
          {/* ---- Theme ---- */}
          <Section title="Theme" icon={<Palette size={16} className="text-pink-400" />} defaultOpen>
            <div className="grid grid-cols-4 gap-2">
              {themes.map((t) => (
                <button
                  key={t.name}
                  onClick={() => setTheme(t.name as ThemeName)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all ${
                    theme === t.name ? 'ring-2 bg-white/10' : 'hover:bg-white/5'
                  }`}
                  style={{ '--tw-ring-color': t.accent } as React.CSSProperties}
                >
                  <div
                    className="w-8 h-8 rounded-full"
                    style={{ background: `linear-gradient(135deg, ${t.bgFrom}, ${t.accent}, ${t.bgTo})` }}
                  />
                  <span className="text-[0.6rem] text-white/70">{t.emoji} {t.label}</span>
                </button>
              ))}
            </div>

            {/* Widget transparency shortcuts */}
            <div className="mt-3 pt-3 border-t border-white/10 space-y-3">
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const colors: Record<string, string> = {};
                    WIDGET_REGISTRY.forEach((w) => { colors[w.id] = 'transparent'; });
                    save({ widgetColors: colors });
                  }}
                  className="flex-1 px-3 py-2 text-xs bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-white/70"
                >
                  🪟 All Transparent
                </button>
                <button
                  onClick={() => {
                    save({ widgetColors: {} });
                  }}
                  className="flex-1 px-3 py-2 text-xs bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-white/70"
                >
                  🎨 Reset Widget Colors
                </button>
              </div>
              {/* Global opacity slider */}
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/50 w-24">All Widget Opacity</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={(() => {
                      const colors = settings.widgetColors ?? {};
                      const vals = Object.values(colors);
                      if (vals.length === 0) return 70;
                      const first = vals[0];
                      if (first === 'transparent') return 0;
                      const m = first.match(/rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*([\d.]+))?\s*\)/);
                      return m?.[1] !== undefined ? Math.round(+m[1] * 100) : 70;
                    })()}
                    onChange={(e) => {
                      const opacity = +e.target.value / 100;
                      const colors: Record<string, string> = {};
                      if (opacity === 0) {
                        WIDGET_REGISTRY.forEach((w) => { colors[w.id] = 'transparent'; });
                      } else {
                        const current = settings.widgetColors ?? {};
                        WIDGET_REGISTRY.forEach((w) => {
                          const existing = current[w.id] || 'rgba(30, 41, 59, 0.7)';
                          if (existing === 'transparent') {
                            colors[w.id] = `rgba(30, 41, 59, ${opacity})`;
                          } else {
                            const m = existing.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
                            if (m) {
                              colors[w.id] = `rgba(${m[1]}, ${m[2]}, ${m[3]}, ${Math.round(opacity * 100) / 100})`;
                            } else {
                              colors[w.id] = `rgba(30, 41, 59, ${opacity})`;
                            }
                          }
                        });
                      }
                      save({ widgetColors: colors });
                    }}
                    className="flex-1 h-1 accent-blue-500 cursor-pointer"
                  />
                  <span className="text-xs text-white/50 w-8 text-right">
                    {(() => {
                      const colors = settings.widgetColors ?? {};
                      const vals = Object.values(colors);
                      if (vals.length === 0) return '70%';
                      const first = vals[0];
                      if (first === 'transparent') return '0%';
                      const m = first.match(/rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*([\d.]+))?\s*\)/);
                      return m?.[1] !== undefined ? `${Math.round(+m[1] * 100)}%` : '70%';
                    })()}
                  </span>
                </div>
              </div>
              {/* Global blur toggle */}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const blurOff: Record<string, boolean> = {};
                    WIDGET_REGISTRY.forEach((w) => { blurOff[w.id] = false; });
                    save({ widgetBlur: blurOff });
                  }}
                  className="flex-1 px-3 py-2 text-xs bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-white/70"
                >
                  🚫 Remove All Blur
                </button>
                <button
                  onClick={() => save({ widgetBlur: {} })}
                  className="flex-1 px-3 py-2 text-xs bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-white/70"
                >
                  💧 Restore All Blur
                </button>
              </div>
            </div>
          </Section>

          {/* ---- Google Calendar ---- */}
          <Section title="Google Calendar" icon={<Calendar size={16} className="text-blue-400" />}>
            {user ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-green-400 flex-1">✓ Connected as {user.email}</span>
                </div>
                <button
                  onClick={handleFetchGoogleCalendars}
                  disabled={calendarLoading}
                  className="px-4 py-2 text-sm bg-blue-500/20 hover:bg-blue-500/30 disabled:opacity-50 rounded-lg text-blue-400 transition-colors"
                >
                  {calendarLoading ? 'Loading…' : 'Load Calendars'}
                </button>
                {calendarError && (
                  <div className="space-y-2">
                    <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{calendarError}</p>
                    {calendarErrorIs403 && (
                      <button
                        onClick={async () => {
                          await signIn();
                          // Auto-retry after re-auth
                          setTimeout(() => handleFetchGoogleCalendars(), 1000);
                        }}
                        className="px-4 py-2 text-sm bg-yellow-500/20 hover:bg-yellow-500/30 rounded-lg text-yellow-400 transition-colors"
                      >
                        🔄 Re-authenticate with Google
                      </button>
                    )}
                  </div>
                )}
                {googleCalendars.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-xs text-white/60">Select calendars to display:</span>
                    {googleCalendars.map((cal) => {
                      const selected = (settings.selectedCalendarIds ?? ['primary']).includes(cal.id);
                      return (
                        <button
                          key={cal.id}
                          onClick={() => handleToggleCalendar(cal.id)}
                          className={`w-full flex items-center gap-2 text-left px-3 py-2 text-sm rounded-lg transition-all ${
                            selected
                              ? 'bg-blue-500/30 text-blue-300'
                              : 'bg-white/5 text-white/60 hover:bg-white/10'
                          }`}
                        >
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: cal.backgroundColor }}
                          />
                          <span className="flex-1 truncate">{cal.summary}</span>
                          {cal.primary && (
                            <span className="text-[0.6rem] bg-white/10 px-1.5 py-0.5 rounded text-white/40">Primary</span>
                          )}
                          {selected && <span className="text-blue-300">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Manual calendar by email */}
                <div className="space-y-1 pt-2 border-t border-white/10">
                  <span className="text-xs text-white/60">Add shared calendar by email:</span>
                  <div className="flex gap-2">
                    <input
                      value={manualCalendarEmail}
                      onChange={(e) => setManualCalendarEmail(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddManualCalendar()}
                      placeholder="someone@gmail.com"
                      className="flex-1 rounded-lg bg-white/10 border border-white/10 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none"
                    />
                    <button
                      onClick={handleAddManualCalendar}
                      className="p-2 bg-blue-500/20 hover:bg-blue-500/30 rounded-lg transition-colors"
                    >
                      <Plus size={18} className="text-blue-400" />
                    </button>
                  </div>
                  <p className="text-xs text-white/30">
                    Enter the email of someone who shared their calendar with you.
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-white/50">Sign in to connect Google Calendar</p>
            )}
          </Section>

          {/* ---- Weather ---- */}
          <Section title="Weather" icon={<Cloud size={16} className="text-sky-400" />}>
            <InputField
              label="Location"
              value={settings.weatherLocation}
              onChange={(v) => save({ weatherLocation: v })}
              placeholder="City name, e.g. Erie, CO"
            />
            <p className="text-xs text-white/40">
              Weather data from{' '}
              <a
                href="https://open-meteo.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 underline hover:text-blue-300"
              >
                Open-Meteo
              </a>{' '}
              — free, no API key required.
            </p>
          </Section>

          {/* ---- Photos ---- */}
          <Section title="Photos" icon={<ImageIcon size={16} className="text-emerald-400" />}>
            {/* Source selector */}
            <div className="space-y-2">
              <span className="text-xs text-white/60">Photo Source</span>
              <div className="grid grid-cols-2 gap-2">
                {(['local', 'immich', 'google-photos', 'unsplash'] as PhotoSource[]).map((src) => (
                  <button
                    key={src}
                    onClick={() => save({ photoSource: src })}
                    className={`px-3 py-2 text-xs rounded-lg transition-all ${
                      settings.photoSource === src
                        ? 'bg-blue-500/30 text-blue-300 ring-1 ring-blue-400/40'
                        : 'bg-white/5 text-white/60 hover:bg-white/10'
                    }`}
                  >
                    {src === 'local' && '📁 Local'}
                    {src === 'immich' && '📷 Immich'}
                    {src === 'google-photos' && '🖼️ Google'}
                    {src === 'unsplash' && '🌄 Unsplash'}
                  </button>
                ))}
              </div>
            </div>

            {/* Slide interval */}
            <div className="space-y-2">
              <span className="text-xs text-white/60">Slide Duration (minutes)</span>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="1"
                  max="60"
                  step="1"
                  value={settings.slideInterval || 1}
                  onChange={(e) => save({ slideInterval: parseInt(e.target.value) })}
                  className="flex-1 h-1.5 bg-white/10 rounded-full appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-400 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:cursor-pointer"
                />
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={settings.slideInterval || 1}
                  onChange={(e) => {
                    const v = parseInt(e.target.value);
                    if (v > 0) save({ slideInterval: v });
                  }}
                  className="w-16 rounded-lg bg-white/10 border border-white/10 px-2 py-1.5 text-sm text-white text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Local photos upload */}
            {settings.photoSource === 'local' && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-500/20 hover:bg-blue-500/30 rounded-lg text-blue-400 transition-colors"
                >
                  <Upload size={14} /> Upload Photos
                </button>
                {photos.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 mt-2">
                    {photos.map((p) => {
                      const url = URL.createObjectURL(p.blob);
                      return (
                        <div
                          key={p.id}
                          className="relative group aspect-square rounded-lg overflow-hidden"
                        >
                          <img
                            src={url}
                            alt={p.name}
                            className="w-full h-full object-cover"
                            onLoad={() => URL.revokeObjectURL(url)}
                          />
                          <button
                            onClick={() => deletePhoto(p.id)}
                            className="absolute top-1 right-1 p-1 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 size={12} className="text-red-400" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
                <p className="text-xs text-white/40">If no photos uploaded, beautiful landscapes will show.</p>
              </>
            )}

            {/* Immich config */}
            {settings.photoSource === 'immich' && (
              <div className="space-y-3">
                <InputField
                  label="Server URL"
                  value={settings.immichUrl}
                  onChange={(v) => save({ immichUrl: v })}
                  placeholder="https://immich.example.com"
                />
                <InputField
                  label="API Key"
                  value={settings.immichApiKey}
                  onChange={(v) => save({ immichApiKey: v })}
                  placeholder="Immich API key"
                />
                <button
                  onClick={handleFetchImmichAlbums}
                  disabled={immichLoading}
                  className="px-4 py-2 text-sm bg-blue-500/20 hover:bg-blue-500/30 rounded-lg text-blue-400 transition-colors disabled:opacity-50"
                >
                  {immichLoading ? 'Loading…' : 'Load Albums'}
                </button>
                {immichError && (
                  <p className="text-xs text-red-400">{immichError}</p>
                )}
                {immichAlbums.length > 0 && (
                  <div className="space-y-1">
                    {immichAlbums.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => save({ immichAlbumId: a.id })}
                        className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-all ${
                          settings.immichAlbumId === a.id
                            ? 'bg-blue-500/30 text-blue-300'
                            : 'bg-white/5 text-white/60 hover:bg-white/10'
                        }`}
                      >
                        {a.albumName} ({a.assetCount} photos)
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Google Photos config */}
            {settings.photoSource === 'google-photos' && (
              <div className="space-y-3">
                {user ? (
                  <>
                    <button
                      onClick={handleFetchGoogleAlbums}
                      disabled={googleAlbumsLoading}
                      className="px-4 py-2 text-sm bg-blue-500/20 hover:bg-blue-500/30 rounded-lg text-blue-400 transition-colors disabled:opacity-50"
                    >
                      {googleAlbumsLoading ? 'Loading…' : 'Load Albums'}
                    </button>
                    {googleAlbumsError && (
                      <p className="text-xs text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2">
                        ⚠️ {googleAlbumsError}
                      </p>
                    )}
                    {googleAlbums.length > 0 && (
                      <div className="space-y-1">
                        {googleAlbums.map((a) => (
                          <button
                            key={a.id}
                            onClick={() => save({ googlePhotosAlbumId: a.id })}
                            className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-all ${
                              settings.googlePhotosAlbumId === a.id
                                ? 'bg-blue-500/30 text-blue-300'
                                : 'bg-white/5 text-white/60 hover:bg-white/10'
                            }`}
                          >
                            {a.title} ({a.mediaItemsCount} items)
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-white/50">Sign in to access Google Photos</p>
                )}
              </div>
            )}

            {/* Unsplash info */}
            {settings.photoSource === 'unsplash' && (
              <p className="text-xs text-white/40">
                Uses beautiful landscape photos. Set <code className="text-white/60">VITE_UNSPLASH_ACCESS_KEY</code> in your .env
                for custom Unsplash photos, or enjoy the built-in curated collection.
              </p>
            )}
          </Section>

          {/* ---- Family Members ---- */}
          <Section title="Family Members" icon={<Users size={16} className="text-violet-400" />}>
            <div className="space-y-2">
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-2 p-2 rounded-lg bg-white/5">
                  {m.avatar ? (
                    <img
                      src={m.avatar}
                      alt={m.name}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
                      style={{ backgroundColor: m.color }}
                    >
                      {m.name[0]}
                    </div>
                  )}
                  <span className="flex-1 text-sm">{m.name}</span>
                  <div
                    className="w-4 h-4 rounded-full border border-white/20"
                    style={{ backgroundColor: m.color }}
                  />
                  <button
                    onClick={() => deleteFamilyMember(m.id)}
                    className="p-1 hover:bg-red-500/20 rounded transition-colors"
                  >
                    <Trash2 size={14} className="text-red-400" />
                  </button>
                </div>
              ))}
            </div>

            <div className="space-y-2 pt-2">
              <div className="flex gap-2">
                <input
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  placeholder="Name"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddMember()}
                  className="flex-1 rounded-lg bg-white/10 border border-white/10 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <input
                  type="color"
                  value={newMemberColor}
                  onChange={(e) => setNewMemberColor(e.target.value)}
                  className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0"
                  title="Pick color"
                />
              </div>
              <div className="flex gap-2 items-center">
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs bg-white/10 hover:bg-white/15 rounded-lg text-white/70 transition-colors"
                >
                  <Camera size={14} />
                  {newMemberAvatar ? 'Avatar ✓' : 'Upload avatar'}
                </button>
                {newMemberAvatar && (
                  <img
                    src={newMemberAvatar}
                    alt="Preview"
                    className="w-8 h-8 rounded-full object-cover"
                  />
                )}
                <div className="flex-1" />
                <button
                  onClick={handleAddMember}
                  className="p-2 bg-blue-500/20 hover:bg-blue-500/30 rounded-lg transition-colors"
                >
                  <Plus size={18} className="text-blue-400" />
                </button>
              </div>
            </div>
          </Section>

          {/* ---- Countdown Events ---- */}
          <Section title="Countdown Events" icon={<Timer size={16} className="text-amber-400" />}>
            <div className="space-y-2">
              {countdowns.map((c) => (
                <div key={c.id} className="flex items-center gap-2 p-2 rounded-lg bg-white/5">
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: c.color }}
                  />
                  <span className="flex-1 text-sm truncate">{c.title}</span>
                  <span className="text-xs text-white/40 shrink-0">
                    {new Date(c.date).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => deleteCountdownEvent(c.id)}
                    className="p-1 hover:bg-red-500/20 rounded transition-colors"
                  >
                    <Trash2 size={14} className="text-red-400" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={newCountdownTitle}
                onChange={(e) => setNewCountdownTitle(e.target.value)}
                placeholder="Event title"
                className="flex-1 rounded-lg bg-white/10 border border-white/10 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none"
              />
              <input
                type="date"
                value={newCountdownDate}
                onChange={(e) => setNewCountdownDate(e.target.value)}
                className="rounded-lg bg-white/10 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none"
              />
              <input
                type="color"
                value={newCountdownColor}
                onChange={(e) => setNewCountdownColor(e.target.value)}
                className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0"
              />
              <button
                onClick={handleAddCountdown}
                className="p-2 bg-blue-500/20 hover:bg-blue-500/30 rounded-lg transition-colors"
              >
                <Plus size={18} className="text-blue-400" />
              </button>
            </div>
          </Section>

          {/* ---- Night Mode ---- */}
          <Section title="Night Mode" icon={<Moon size={16} className="text-indigo-400" />}>
            <div className="flex gap-3">
              <InputField
                label="Start (dim)"
                value={settings.nightModeStart}
                onChange={(v) => save({ nightModeStart: v })}
                type="time"
              />
              <InputField
                label="End (bright)"
                value={settings.nightModeEnd}
                onChange={(v) => save({ nightModeEnd: v })}
                type="time"
              />
            </div>
            <InputField
              label="Screen saver timeout (seconds)"
              value={String(settings.screenSaverTimeout)}
              onChange={(v) => save({ screenSaverTimeout: parseInt(v) || 300 })}
              type="number"
            />
            <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
              <label className="flex items-center gap-2 text-sm text-white/70 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.autoPictureMode ?? true}
                  onChange={(e) => save({ autoPictureMode: e.target.checked })}
                  className="accent-blue-500"
                />
                Auto picture mode on idle
              </label>
              {(settings.autoPictureMode ?? true) && (
                <InputField
                  label="Auto picture mode timeout (seconds)"
                  value={String(settings.autoPictureModeTimeout ?? 300)}
                  onChange={(v) => save({ autoPictureModeTimeout: parseInt(v) || 300 })}
                  type="number"
                />
              )}
            </div>

            {/* Late night mode */}
            <div className="mt-3 pt-3 border-t border-white/10 space-y-3">
              <label className="flex items-center gap-2 text-sm text-white/70 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.lateNightEnabled ?? false}
                  onChange={(e) => save({ lateNightEnabled: e.target.checked })}
                  className="accent-indigo-500"
                />
                <span className="font-medium text-white/80">Late night mode (bouncing clock)</span>
              </label>
              <p className="text-xs text-white/40 -mt-1">
                Replaces the entire screen with a moving clock to prevent burn-in. Nothing is static.
              </p>
              {settings.lateNightEnabled && (
                <div className="flex gap-3">
                  <InputField
                    label="Start"
                    value={settings.lateNightStart ?? '22:00'}
                    onChange={(v) => save({ lateNightStart: v })}
                    type="time"
                  />
                  <InputField
                    label="End"
                    value={settings.lateNightEnd ?? '06:00'}
                    onChange={(v) => save({ lateNightEnd: v })}
                    type="time"
                  />
                </div>
              )}
            </div>
          </Section>

          {/* ---- Presence & Wake ---- */}
          <Section title="Presence & Wake" icon={<Camera size={16} className="text-cyan-400" />}>
            <p className="text-xs text-white/40 mb-3">
              Detects motion or sound to keep the screen awake. Screen dims after the inactivity timeout.
            </p>
            <div className="space-y-3">
              {/* Master toggle */}
              <label className="flex items-center justify-between gap-3 cursor-pointer">
                <span className="text-sm text-white/80">Enable presence detection</span>
                <input
                  type="checkbox"
                  checked={settings.presenceDetectionEnabled ?? false}
                  onChange={(e) => save({ presenceDetectionEnabled: e.target.checked })}
                  className="w-4 h-4 rounded"
                />
              </label>

              {(settings.presenceDetectionEnabled ?? false) && (
                <>
                  {/* Source selector */}
                  <div className="space-y-1">
                    <span className="text-xs text-white/60">Detection source</span>
                    <div className="flex gap-2 mt-1">
                      {(['camera', 'microphone'] as const).map((src) => (
                        <button
                          key={src}
                          onClick={() => save({ presenceSource: src })}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            (settings.presenceSource ?? 'camera') === src
                              ? 'bg-cyan-500/30 text-cyan-300 ring-1 ring-cyan-400/40'
                              : 'bg-white/5 text-white/50 hover:bg-white/10'
                          }`}
                        >
                          {src === 'camera' ? <Camera size={12} /> : <Mic size={12} />}
                          {src === 'camera' ? 'Camera' : 'Microphone'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Sensitivity */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-white/60">
                      <span>Sensitivity</span>
                      <span>{settings.presenceSensitivity ?? 5} / 10</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={settings.presenceSensitivity ?? 5}
                      onChange={(e) => save({ presenceSensitivity: parseInt(e.target.value) })}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-white/10"
                    />
                    <div className="flex justify-between text-xs text-white/30">
                      <span>Very sensitive</span>
                      <span>Large motion only</span>
                    </div>
                  </div>

                  {/* Inactivity timeout */}
                  <div className="space-y-1">
                    <span className="text-xs text-white/60">Dim after (minutes of no activity)</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {[1, 2, 5, 10, 15].map((mins) => (
                        <button
                          key={mins}
                          onClick={() => save({ presenceInactivityTimeout: mins })}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            (settings.presenceInactivityTimeout ?? 5) === mins
                              ? 'bg-cyan-500/30 text-cyan-300 ring-1 ring-cyan-400/40'
                              : 'bg-white/5 text-white/50 hover:bg-white/10'
                          }`}
                        >
                          {mins} min
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Schedule */}
                  <label className="flex items-center justify-between gap-3 cursor-pointer">
                    <span className="text-sm text-white/80">Limit to schedule</span>
                    <input
                      type="checkbox"
                      checked={settings.presenceScheduleEnabled ?? false}
                      onChange={(e) => save({ presenceScheduleEnabled: e.target.checked })}
                      className="w-4 h-4 rounded"
                    />
                  </label>

                  {(settings.presenceScheduleEnabled ?? false) && (
                    <div className="flex gap-3 items-center">
                      <div className="flex flex-col gap-1 flex-1">
                        <span className="text-xs text-white/50">Start</span>
                        <input
                          type="time"
                          value={settings.presenceScheduleStart ?? '07:00'}
                          onChange={(e) => save({ presenceScheduleStart: e.target.value })}
                          className="rounded-lg bg-white/10 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1 flex-1">
                        <span className="text-xs text-white/50">End</span>
                        <input
                          type="time"
                          value={settings.presenceScheduleEnd ?? '22:00'}
                          onChange={(e) => save({ presenceScheduleEnd: e.target.value })}
                          className="rounded-lg bg-white/10 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {/* Dim overlay */}
                  <div className="pt-2 border-t border-white/10 space-y-3">
                    <label className="flex items-center justify-between gap-3 cursor-pointer">
                      <span className="text-sm text-white/80">Dim screen when idle</span>
                      <input
                        type="checkbox"
                        checked={settings.dimEnabled ?? false}
                        onChange={(e) => save({ dimEnabled: e.target.checked })}
                        className="w-4 h-4 rounded"
                      />
                    </label>

                    {(settings.dimEnabled ?? false) && (
                      <>
                        <div className="space-y-1">
                          <span className="text-xs text-white/60">Dim style</span>
                          <div className="flex gap-2 mt-1 flex-wrap">
                            {(['partial', 'black', 'clock'] as const).map((m) => (
                              <button
                                key={m}
                                onClick={() => save({ dimMode: m })}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                                  (settings.dimMode ?? 'partial') === m
                                    ? 'bg-cyan-500/30 text-cyan-300 ring-1 ring-cyan-400/40'
                                    : 'bg-white/5 text-white/50 hover:bg-white/10'
                                }`}
                              >
                                {m === 'partial' ? 'Partial dim' : m === 'black' ? 'Full black' : 'Clock'}
                              </button>
                            ))}
                          </div>
                        </div>

                        {(settings.dimMode ?? 'partial') === 'partial' && (
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs text-white/60">
                              <span>Dim opacity</span>
                              <span>{settings.dimOpacity ?? 70}%</span>
                            </div>
                            <input
                              type="range"
                              min={10}
                              max={95}
                              value={settings.dimOpacity ?? 70}
                              onChange={(e) => save({ dimOpacity: parseInt(e.target.value) })}
                              className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-white/10"
                            />
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Brightness service */}
                  <div className="pt-2 border-t border-white/10 space-y-3">
                    <label className="flex items-center justify-between gap-3 cursor-pointer">
                      <span className="text-sm text-white/80">
                        <Sun size={13} className="inline mr-1 opacity-60" />
                        Real brightness control
                      </span>
                      <input
                        type="checkbox"
                        checked={settings.brightnessServiceEnabled ?? false}
                        onChange={(e) => save({ brightnessServiceEnabled: e.target.checked })}
                        className="w-4 h-4 rounded"
                      />
                    </label>

                    {(settings.brightnessServiceEnabled ?? false) && (
                      <>
                        <p className="text-xs text-white/30">
                          Requires the brightness service running on the Surface.
                          Download and run install.bat once on the Surface device.
                        </p>

                        {/* Download button */}
                        <div className="flex gap-2 flex-wrap">
                          <a
                            href="/brightness-service/brightness-service.zip"
                            download="brightness-service.zip"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-500/20 text-green-300 hover:bg-green-500/30 transition-colors"
                          >
                            <Download size={12} />
                            Download brightness-service.zip
                          </a>
                        </div>
                        <p className="text-xs text-white/20">
                          Extract the zip, then run install.bat — all files will be in the same folder.
                        </p>

                        <div className="flex gap-2 items-end">
                          <div className="flex flex-col gap-1 flex-1">
                            <span className="text-xs text-white/50">Service port</span>
                            <input
                              type="number"
                              value={settings.brightnessServicePort ?? 3737}
                              onChange={(e) => save({ brightnessServicePort: parseInt(e.target.value) || 3737 })}
                              className="rounded-lg bg-white/10 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none w-full"
                            />
                          </div>
                          <button
                            onClick={async () => {
                              setBrightnessTestStatus('idle');
                              const result = await checkBrightnessService(settings.brightnessServicePort ?? 3737);
                              setBrightnessTestStatus(result.ok ? 'ok' : 'fail');
                              setTimeout(() => setBrightnessTestStatus('idle'), 4000);
                            }}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/20 transition-colors mb-0.5"
                          >
                            {brightnessTestStatus === 'ok' && <CheckCircle size={13} className="text-green-400" />}
                            {brightnessTestStatus === 'fail' && <XCircle size={13} className="text-red-400" />}
                            {brightnessTestStatus === 'idle' && null}
                            Test
                          </button>
                        </div>

                        <div className="space-y-2">
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs text-white/60">
                              <span>Brightness when active</span>
                              <span>{settings.brightnessOnPresence ?? 100}%</span>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={100}
                              value={settings.brightnessOnPresence ?? 100}
                              onChange={(e) => save({ brightnessOnPresence: parseInt(e.target.value) })}
                              className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-white/10"
                            />
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs text-white/60">
                              <span>Brightness when idle</span>
                              <span>{settings.brightnessOnIdle ?? 10}%</span>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={100}
                              value={settings.brightnessOnIdle ?? 10}
                              onChange={(e) => save({ brightnessOnIdle: parseInt(e.target.value) })}
                              className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-white/10"
                            />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </Section>

          {/* ---- Access Control ---- */}
          <Section title="Access Control" icon={<Shield size={16} className="text-yellow-400" />}>
            <p className="text-xs text-white/40 mb-2">
              Restrict who can sign in. Leave empty to allow anyone with a Google account.
            </p>
            <div className="space-y-2">
              {(settings.allowedEmails ?? []).map((email) => (
                <div key={email} className="flex items-center gap-2 p-2 rounded-lg bg-white/5">
                  <span className="flex-1 text-sm truncate">{email}</span>
                  <button
                    onClick={() => handleRemoveAllowedEmail(email)}
                    className="p-1 hover:bg-red-500/20 rounded transition-colors"
                  >
                    <Trash2 size={14} className="text-red-400" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={newAllowedEmail}
                onChange={(e) => setNewAllowedEmail(e.target.value)}
                placeholder="email@example.com"
                onKeyDown={(e) => e.key === 'Enter' && handleAddAllowedEmail()}
                className="flex-1 rounded-lg bg-white/10 border border-white/10 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none"
              />
              <button
                onClick={handleAddAllowedEmail}
                className="p-2 bg-blue-500/20 hover:bg-blue-500/30 rounded-lg transition-colors"
              >
                <Plus size={18} className="text-blue-400" />
              </button>
            </div>
          </Section>

          {/* ---- AI Assistant ---- */}
          <Section title="AI Assistant" icon={<Bot size={16} className="text-teal-400" />}>
            {/* Provider toggle */}
            <div className="flex flex-col gap-1 mb-3">
              <span className="text-xs text-white/60 font-medium">Provider</span>
              <div className="flex gap-2">
                {(['openai', 'azure-openai'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => save({ aiProvider: p })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      (settings.aiProvider || 'openai') === p
                        ? 'bg-teal-500/30 text-teal-300 ring-1 ring-teal-400/40'
                        : 'bg-white/5 text-white/50 hover:bg-white/10'
                    }`}
                  >
                    {p === 'openai' ? 'OpenAI' : 'Azure OpenAI'}
                  </button>
                ))}
              </div>
            </div>

            <InputField
              label={(settings.aiProvider || 'openai') === 'azure-openai' ? 'Azure API Key' : 'OpenAI API Key'}
              value={settings.openaiApiKey}
              onChange={(v) => save({ openaiApiKey: v })}
              placeholder={(settings.aiProvider || 'openai') === 'azure-openai' ? 'Your Azure OpenAI key' : 'sk-...'}
            />

            {(settings.aiProvider || 'openai') === 'azure-openai' ? (
              <>
                <InputField
                  label="Azure Endpoint"
                  value={settings.azureEndpoint || ''}
                  onChange={(v) => save({ azureEndpoint: v })}
                  placeholder="https://your-resource.openai.azure.com"
                />
                <InputField
                  label="Deployment Name"
                  value={settings.azureDeployment || ''}
                  onChange={(v) => save({ azureDeployment: v })}
                  placeholder="gpt-4o-mini"
                />
                <p className="text-xs text-white/40">
                  Each deployment uses one model. Create multiple deployments in{' '}
                  <a
                    href="https://portal.azure.com/#view/Microsoft_Azure_ProjectOxford/CognitiveServicesHub/~/OpenAI"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 underline hover:text-blue-300"
                  >
                    Azure Portal
                  </a>{' '}
                  and change the deployment name here to switch models.
                </p>
              </>
            ) : (
              <>
                {/* OpenAI model selector */}
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-white/60 font-medium">Model</span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { id: 'gpt-4o-mini', label: 'GPT-4o Mini', badge: 'Fast & cheap' },
                      { id: 'gpt-4o', label: 'GPT-4o', badge: 'Smart' },
                      { id: 'gpt-4-turbo', label: 'GPT-4 Turbo', badge: 'Legacy' },
                      { id: 'gpt-3.5-turbo', label: 'GPT-3.5', badge: 'Budget' },
                    ].map((m) => (
                      <button
                        key={m.id}
                        onClick={() => save({ openaiModel: m.id })}
                        className={`px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                          (settings.openaiModel || 'gpt-4o-mini') === m.id
                            ? 'bg-teal-500/30 text-teal-300 ring-1 ring-teal-400/40'
                            : 'bg-white/5 text-white/50 hover:bg-white/10'
                        }`}
                      >
                        {m.label}
                        <span className="text-[0.55rem] ml-1 opacity-60">{m.badge}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-white/40">
                  Get a key at{' '}
                  <a
                    href="https://platform.openai.com/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 underline hover:text-blue-300"
                  >
                    platform.openai.com
                  </a>
                </p>
              </>
            )}

            {/* Voice settings */}
            <div className="border-t border-white/10 pt-3 mt-3 space-y-3">
              <span className="text-xs text-white/60 font-medium">Voice Settings</span>

              {/* Engine selector */}
              <div className="flex gap-2">
                {(['openai', 'browser'] as const).map((eng) => (
                  <button
                    key={eng}
                    onClick={() => save({ ttsEngine: eng })}
                    className={`flex-1 px-3 py-2 text-xs rounded-lg transition-all ${
                      (settings.ttsEngine || 'openai') === eng
                        ? 'bg-teal-500/30 text-teal-300 ring-1 ring-teal-500/50'
                        : 'bg-white/5 text-white/50 hover:bg-white/10'
                    }`}
                  >
                    {eng === 'openai' ? '🤖 OpenAI TTS' : '🔊 Browser Voice'}
                  </button>
                ))}
              </div>

              {(settings.ttsEngine || 'openai') === 'openai' ? (
                <>
                  {/* TTS API Key — separate from chat key for Azure users */}
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">
                      OpenAI TTS API Key {settings.aiProvider === 'azure-openai' ? '(required — Azure keys don\'t work with OpenAI TTS)' : '(optional — uses main key if empty)'}
                    </label>
                    <input
                      type="password"
                      value={settings.openaiTtsApiKey || ''}
                      onChange={(e) => save({ openaiTtsApiKey: e.target.value })}
                      placeholder={settings.aiProvider === 'azure-openai' ? 'sk-... from platform.openai.com' : 'Leave empty to use main API key'}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-teal-500/50"
                    />
                  </div>

                  {/* OpenAI voice picker */}
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Voice</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { id: 'nova', label: '✨ Nova', desc: 'Warm female' },
                        { id: 'shimmer', label: '💫 Shimmer', desc: 'Gentle female' },
                        { id: 'alloy', label: '🎵 Alloy', desc: 'Neutral' },
                        { id: 'echo', label: '🌊 Echo', desc: 'Smooth male' },
                        { id: 'fable', label: '📖 Fable', desc: 'British' },
                        { id: 'onyx', label: '🪨 Onyx', desc: 'Deep male' },
                      ].map((v) => (
                        <button
                          key={v.id}
                          onClick={() => save({ openaiTtsVoice: v.id })}
                          className={`p-2 text-left rounded-lg transition-all ${
                            (settings.openaiTtsVoice || 'nova') === v.id
                              ? 'bg-teal-500/30 text-teal-300 ring-1 ring-teal-500/50'
                              : 'bg-white/5 text-white/50 hover:bg-white/10'
                          }`}
                        >
                          <div className="text-xs font-medium">{v.label}</div>
                          <div className="text-[0.6rem] text-white/30">{v.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Quality */}
                  <div className="flex gap-2">
                    {(['tts-1', 'tts-1-hd'] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => save({ openaiTtsModel: m })}
                        className={`flex-1 px-3 py-1.5 text-xs rounded-lg transition-all ${
                          (settings.openaiTtsModel || 'tts-1') === m
                            ? 'bg-teal-500/30 text-teal-300 ring-1 ring-teal-500/50'
                            : 'bg-white/5 text-white/50 hover:bg-white/10'
                        }`}
                      >
                        {m === 'tts-1' ? 'Standard' : 'HD Quality'}
                      </button>
                    ))}
                  </div>

                  {/* Speed slider */}
                  <div>
                    <label className="text-xs text-white/50">Speed ({(settings.ttsRate ?? 0.95).toFixed(2)})</label>
                    <input type="range" min="0.5" max="2" step="0.05" value={settings.ttsRate ?? 0.95} onChange={(e) => save({ ttsRate: parseFloat(e.target.value) })} className="w-full accent-teal-500" />
                  </div>

                  {/* Test button — uses TTS key or main key */}
                  <button
                    onClick={async () => {
                      const ttsKey = settings.openaiTtsApiKey || (settings.aiProvider !== 'azure-openai' ? settings.openaiApiKey : '');
                      if (!ttsKey) { alert('Enter an OpenAI TTS API key first'); return; }
                      try {
                        const res = await fetch('https://api.openai.com/v1/audio/speech', {
                          method: 'POST',
                          headers: { 'Authorization': `Bearer ${ttsKey}`, 'Content-Type': 'application/json' },
                          body: JSON.stringify({ model: settings.openaiTtsModel || 'tts-1', input: "Hi! I'm your family assistant. How can I help today?", voice: settings.openaiTtsVoice || 'nova', speed: settings.ttsRate ?? 0.95 }),
                        });
                        if (res.ok) {
                          const blob = await res.blob();
                          const url = URL.createObjectURL(blob);
                          const audio = new Audio(url);
                          audio.onended = () => URL.revokeObjectURL(url);
                          audio.play();
                        } else {
                          alert(`TTS failed: ${res.status} — make sure you're using an OpenAI key from platform.openai.com (not Azure)`);
                        }
                      } catch (err) {
                        alert(`TTS error: ${err}`);
                      }
                    }}
                    className="text-xs bg-teal-500/20 hover:bg-teal-500/30 text-teal-400 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    🔊 Test Voice
                  </button>
                </>
              ) : (
                <>
                  {/* Browser voice settings (existing) */}
                  <VoiceSelector
                    voiceName={settings.ttsVoiceName || ''}
                    onVoiceChange={(name) => save({ ttsVoiceName: name })}
                  />
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="text-xs text-white/50">Speed ({settings.ttsRate?.toFixed(2) ?? '0.95'})</label>
                      <input type="range" min="0.5" max="2" step="0.05" value={settings.ttsRate ?? 0.95} onChange={(e) => save({ ttsRate: parseFloat(e.target.value) })} className="w-full accent-teal-500" />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-white/50">Pitch ({settings.ttsPitch?.toFixed(2) ?? '1.10'})</label>
                      <input type="range" min="0.5" max="2" step="0.05" value={settings.ttsPitch ?? 1.1} onChange={(e) => save({ ttsPitch: parseFloat(e.target.value) })} className="w-full accent-teal-500" />
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const synth = window.speechSynthesis;
                      if (!synth) return;
                      synth.cancel();
                      const utt = new SpeechSynthesisUtterance('Hi! I\'m your family assistant. How can I help today?');
                      utt.rate = settings.ttsRate ?? 0.95;
                      utt.pitch = settings.ttsPitch ?? 1.1;
                      const voices = synth.getVoices();
                      const v = settings.ttsVoiceName ? voices.find(x => x.name === settings.ttsVoiceName) : voices.find(x => x.lang.startsWith('en'));
                      if (v) utt.voice = v;
                      synth.speak(utt);
                    }}
                    className="text-xs bg-teal-500/20 hover:bg-teal-500/30 text-teal-400 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    🔊 Test Voice
                  </button>
                </>
              )}
            </div>
          </Section>

          {/* ---- Pages ---- */}
          <Section title="Pages" icon={<LayoutGrid size={16} className="text-indigo-400" />}>
            <p className="text-xs text-white/40 mb-3">
              Enable/disable pages and drag to reorder. At least one page must remain enabled.
            </p>
            {(() => {
              const enabled: string[] = settings?.enabledPages ?? DEFAULT_PAGE_ORDER;
              // Build full list: enabled pages in order, then disabled ones
              const disabled = ALL_PAGES.map(p => p.id).filter(id => !enabled.includes(id));
              const ordered = [...enabled, ...disabled];

              const toggle = (id: string) => {
                const current = settings?.enabledPages ?? [...DEFAULT_PAGE_ORDER];
                if (current.includes(id)) {
                  if (current.length <= 1) return; // keep at least one
                  save({ enabledPages: current.filter(p => p !== id) });
                } else {
                  save({ enabledPages: [...current, id] });
                }
              };

              const moveUp = (id: string) => {
                const current = [...(settings?.enabledPages ?? DEFAULT_PAGE_ORDER)];
                const idx = current.indexOf(id);
                if (idx <= 0) return;
                [current[idx - 1], current[idx]] = [current[idx], current[idx - 1]];
                save({ enabledPages: current });
              };

              const moveDown = (id: string) => {
                const current = [...(settings?.enabledPages ?? DEFAULT_PAGE_ORDER)];
                const idx = current.indexOf(id);
                if (idx < 0 || idx >= current.length - 1) return;
                [current[idx], current[idx + 1]] = [current[idx + 1], current[idx]];
                save({ enabledPages: current });
              };

              return (
                <div className="space-y-1">
                  {ordered.map((id) => {
                    const page = ALL_PAGES.find(p => p.id === id);
                    if (!page) return null;
                    const isEnabled = enabled.includes(id);
                    const enabledIdx = enabled.indexOf(id);
                    return (
                      <div
                        key={id}
                        className={`flex items-center gap-2 px-2 py-2 rounded-lg transition-colors ${
                          isEnabled ? 'bg-white/5' : 'bg-white/[0.02] opacity-50'
                        }`}
                      >
                        <GripVertical size={14} className="text-white/30 shrink-0" />
                        <span className="flex-1 text-sm text-white/80">{page.label}</span>
                        {isEnabled && (
                          <div className="flex gap-0.5">
                            <button
                              onClick={() => moveUp(id)}
                              disabled={enabledIdx === 0}
                              className="p-1 rounded hover:bg-white/10 disabled:opacity-20 transition-colors"
                            >
                              <ArrowUp size={12} />
                            </button>
                            <button
                              onClick={() => moveDown(id)}
                              disabled={enabledIdx === enabled.length - 1}
                              className="p-1 rounded hover:bg-white/10 disabled:opacity-20 transition-colors"
                            >
                              <ArrowDown size={12} />
                            </button>
                          </div>
                        )}
                        <button
                          onClick={() => toggle(id)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            isEnabled
                              ? 'text-emerald-400 hover:bg-emerald-500/20'
                              : 'text-white/30 hover:bg-white/10'
                          }`}
                        >
                          {isEnabled ? <Eye size={14} /> : <EyeOff size={14} />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </Section>

          {/* ---- About ---- */}
          <Section title="About" icon={<Info size={16} className="text-slate-400" />}>
            <p className="text-sm text-white/60">Pikes Family Dashboard</p>
            <p className="text-sm font-mono text-white/40">v2.1.0</p>
            <p className="text-xs text-white/30 mt-1">
              Built with React, Tailwind CSS, and ❤️
            </p>
          </Section>
        </div>
      </div>
    </>
  );
}

export default SettingsPanel;
