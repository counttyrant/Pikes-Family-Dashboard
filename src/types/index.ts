export interface FamilyMember {
  id: string;
  name: string;
  avatar: string;
  color: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  calendarId: string;
  color: string;
  imageUrl?: string;
  allDay: boolean;
}

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

export interface WidgetLayout {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DashboardSettings {
  id: string;
  weatherApiKey: string;
  weatherLocation: string;
  googleToken: string | null;
  nightModeStart: string;
  nightModeEnd: string;
  screenSaverTimeout: number;
  openaiApiKey: string;
  layouts: WidgetLayout[];
}

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
