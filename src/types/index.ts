/* ── Identity ─────────────────────────────────────────────────────────── */

export interface GoogleUser {
  email: string;
  name: string;
  picture: string;
  accessToken: string;
  expiresAt: number;
  tokenExpired?: boolean;
}

/* ── Family ───────────────────────────────────────────────────────────── */

export interface FamilyMember {
  id: string;
  name: string;
  avatar: string;
  color: string;
}

/* ── Calendar ─────────────────────────────────────────────────────────── */

export type EventIcon =
  | 'playtime'
  | 'bedtime'
  | 'dinner'
  | 'movies'
  | 'cleanup'
  | 'school'
  | 'sports'
  | 'birthday'
  | 'doctor'
  | 'music'
  | 'art'
  | 'bath'
  | 'homework'
  | 'reading'
  | 'grocery'
  | 'travel'
  | 'work'
  | 'custom';

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  calendarId: string;
  color: string;
  imageUrl?: string;
  icon?: EventIcon;
  allDay: boolean;
  isLocal?: boolean;
}

export interface LocalCalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  color: string;
  icon: EventIcon;
  allDay: boolean;
}

/* ── Chores ───────────────────────────────────────────────────────────── */

export type ChoreRecurrence = 'daily' | 'weekly' | 'monthly' | 'none';

export interface Chore {
  id: string;
  title: string;
  description: string;
  assignedTo: string[];
  dueDate: Date;
  recurrence: ChoreRecurrence;
  completed: boolean;
  completedBy: string;
  completedAt: Date | null;
  points: number;
}

export interface Reward {
  id: string;
  title: string;
  description: string;
  pointsCost: number;
  imageUrl?: string;
  claimedBy: string | null;
}

export interface StickerRecord {
  id: string;
  memberId: string;
  choreId: string;
  earnedAt: Date;
  points: number;
}

/* ── Photos ───────────────────────────────────────────────────────────── */

export type PhotoSource = 'local' | 'immich' | 'google-photos' | 'unsplash';

export interface Photo {
  id: string;
  blob: Blob;
  name: string;
  addedAt: Date;
}

export interface EventImage {
  id: string;
  eventId: string;
  blob: Blob;
  name: string;
}

/* ── Themes ───────────────────────────────────────────────────────────── */

export type ThemeName =
  | 'ocean'
  | 'forest'
  | 'sunset'
  | 'purple'
  | 'rose'
  | 'slate'
  | 'midnight'
  | 'emerald';

export interface ThemeDefinition {
  name: ThemeName;
  label: string;
  emoji: string;
  bgFrom: string;
  bgVia: string;
  bgTo: string;
  accent: string;
  accentLight: string;
  card: string;
  cardHover: string;
}

/* ── Layout ───────────────────────────────────────────────────────────── */

export interface WidgetLayout {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/* ── Google Calendars ─────────────────────────────────────────────────── */

export interface GoogleCalendarInfo {
  id: string;
  summary: string;
  backgroundColor: string;
  primary?: boolean;
  accessRole: string;
}

/* ── Settings ─────────────────────────────────────────────────────────── */

export type AiProvider = 'openai' | 'azure-openai';

export interface DashboardSettings {
  id: string;
  weatherApiKey: string;
  weatherLocation: string;
  googleToken: string | null;
  nightModeStart: string;
  nightModeEnd: string;
  screenSaverTimeout: number;
  openaiApiKey: string;
  aiProvider: AiProvider;
  azureEndpoint: string;
  azureDeployment: string;
  openaiModel: string;
  layouts: WidgetLayout[];
  theme: ThemeName;
  photoSource: PhotoSource;
  immichUrl: string;
  immichApiKey: string;
  immichAlbumId: string;
  googlePhotosAlbumId: string;
  allowedEmails: string[];
  slideInterval: number;
  selectedCalendarIds: string[];
  activeWidgets: string[];
  calendarColors: Record<string, string>;
  widgetColors: Record<string, string>;
  eventColorOverrides: Record<string, string>;
  calendarDaysToShow: number;
  weekStartsOn: 0 | 1; // 0 = Sunday, 1 = Monday
  ttsEngine: 'browser' | 'openai';  // which TTS engine to use
  ttsVoiceName: string;   // browser voice name (empty = auto)
  ttsRate: number;        // 0.5–2.0
  ttsPitch: number;       // 0.5–2.0
  openaiTtsApiKey: string; // separate OpenAI key just for TTS (useful for Azure chat users)
  openaiTtsVoice: string; // OpenAI voice: alloy, echo, fable, onyx, nova, shimmer
  openaiTtsModel: string; // tts-1 or tts-1-hd
  enabledPages: string[]; // ordered list of enabled page IDs
  autoPictureMode: boolean; // auto-enter picture mode on idle
  autoPictureModeTimeout: number; // seconds before auto picture mode
  widgetBlur: Record<string, boolean>; // false = no blur for that widget
  presenceDetectionEnabled: boolean;
  presenceSensitivity: number;        // 1–10
  presenceInactivityTimeout: number;  // minutes before releasing wake lock
  presenceScheduleEnabled: boolean;
  presenceScheduleStart: string;      // HH:MM
  presenceScheduleEnd: string;        // HH:MM
}

/* ── Misc ─────────────────────────────────────────────────────────────── */

export interface ShoppingItem {
  id: string;
  text: string;
  checked: boolean;
  addedAt: Date;
}

export interface Note {
  id: string;
  text: string;
  color: string;
  x: number;
  y: number;
  updatedAt: Date;
}

export interface CountdownEvent {
  id: string;
  title: string;
  date: Date;
  color: string;
}

export interface Recipe {
  id: string;
  title: string;
  ingredients: string[];
  instructions: string;
  prepTime?: string;
  cookTime?: string;
  servings?: string;
  addedAt: Date;
}
