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
import { signIn, signOut, initGoogleAuth } from '../../services/googleCalendar';
import type { DashboardSettings } from '../../types';
import {
  Settings,
  X,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Upload,
  Link,
  Unlink,
  Calendar,
  Cloud,
  Users,
  Image as ImageIcon,
  Timer,
  Moon,
  Bot,
  Info,
  Camera,
} from 'lucide-react';
import type { ReactNode } from 'react';

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

/* -------------------------------------------------------------------------- */
/*  SettingsPanel                                                             */
/* -------------------------------------------------------------------------- */

interface SettingsPanelProps {
  open?: boolean;
  onClose?: () => void;
}

export function SettingsPanel({ open: controlledOpen, onClose }: SettingsPanelProps) {
  // Support both controlled (via props) and self-managed mode
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const handleClose = () => {
    onClose?.();
    if (!isControlled) setInternalOpen(false);
  };

  const [settings, setSettings] = useState<DashboardSettings | null>(null);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberColor, setNewMemberColor] = useState('#3b82f6');
  const [newMemberAvatar, setNewMemberAvatar] = useState('');
  const [newCountdownTitle, setNewCountdownTitle] = useState('');
  const [newCountdownDate, setNewCountdownDate] = useState('');
  const [newCountdownColor, setNewCountdownColor] = useState('#3b82f6');
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

  /* -- Google Calendar ---------------------------------------------------- */

  const handleGoogleConnect = async () => {
    try {
      const clientId = prompt('Enter your Google OAuth Client ID:');
      if (!clientId) return;
      await initGoogleAuth(clientId);
      const token = await signIn();
      await save({ googleToken: token });
    } catch (e) {
      console.error('Google auth failed:', e);
    }
  };

  const handleGoogleDisconnect = async () => {
    if (settings?.googleToken) {
      await signOut(settings.googleToken);
      await save({ googleToken: null });
    }
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

  if (!settings) return null;

  return (
    <>
      {/* Self-managed gear button (only shown if not externally controlled) */}
      {!isControlled && (
        <button
          onClick={() => setInternalOpen(true)}
          className="fixed top-4 right-4 z-40 rounded-full bg-black/40 p-3 backdrop-blur-sm hover:bg-black/60 transition-colors"
          aria-label="Open settings"
        >
          <Settings size={20} />
        </button>
      )}

      {/* Backdrop */}
      {open && (
        <div className="fixed inset-0 z-50 bg-black/40" onClick={handleClose} />
      )}

      {/* Slide-in panel */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-[400px] bg-slate-900/95 backdrop-blur-xl border-l border-white/10 transform transition-transform duration-300 ease-in-out ${
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

        {/* Sections */}
        <div className="p-4 space-y-1">
          {/* ---- Google Calendar ---- */}
          <Section title="Google Calendar" icon={<Calendar size={16} className="text-blue-400" />}>
            {settings.googleToken ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-green-400 flex-1">✓ Connected</span>
                <button
                  onClick={handleGoogleDisconnect}
                  className="flex items-center gap-1 px-3 py-2 text-sm bg-red-500/20 hover:bg-red-500/30 rounded-lg text-red-400 transition-colors"
                >
                  <Unlink size={14} /> Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={handleGoogleConnect}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-500/20 hover:bg-blue-500/30 rounded-lg text-blue-400 transition-colors"
              >
                <Link size={14} /> Connect Google Calendar
              </button>
            )}
          </Section>

          {/* ---- Weather ---- */}
          <Section title="Weather" icon={<Cloud size={16} className="text-sky-400" />}>
            <InputField
              label="API Key"
              value={settings.weatherApiKey}
              onChange={(v) => save({ weatherApiKey: v })}
              placeholder="Enter OpenWeatherMap API key"
            />
            <InputField
              label="Location"
              value={settings.weatherLocation}
              onChange={(v) => save({ weatherLocation: v })}
              placeholder="City name, e.g. Denver, CO"
            />
            <p className="text-xs text-white/40">
              Get a free key at{' '}
              <a
                href="https://openweathermap.org/api"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 underline hover:text-blue-300"
              >
                openweathermap.org
              </a>
            </p>
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

            {/* Add new member */}
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

          {/* ---- Photos ---- */}
          <Section title="Photos" icon={<ImageIcon size={16} className="text-emerald-400" />}>
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
          </Section>

          {/* ---- AI Assistant ---- */}
          <Section title="AI Assistant" icon={<Bot size={16} className="text-teal-400" />}>
            <InputField
              label="OpenAI API Key"
              value={settings.openaiApiKey}
              onChange={(v) => save({ openaiApiKey: v })}
              placeholder="sk-..."
            />
            <p className="text-xs text-white/40">
              Uses <strong className="text-white/60">gpt-4o-mini</strong> for cost
              efficiency. Get a key at{' '}
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 underline hover:text-blue-300"
              >
                platform.openai.com
              </a>
            </p>
          </Section>

          {/* ---- About ---- */}
          <Section title="About" icon={<Info size={16} className="text-slate-400" />}>
            <p className="text-sm text-white/60">Pikes Family Dashboard</p>
            <p className="text-sm font-mono text-white/40">v1.0.0</p>
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
