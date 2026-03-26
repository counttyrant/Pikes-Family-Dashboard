import { db } from '../db';
import type {
  DashboardSettings,
  FamilyMember,
  Chore,
  Reward,
  StickerRecord,
  Photo,
  EventImage,
  ShoppingItem,
  Note,
  CountdownEvent,
  GoogleUser,
  LocalCalendarEvent,
} from '../types';

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

const DEFAULT_SETTINGS: DashboardSettings = {
  id: 'main',
  weatherApiKey: '',
  weatherLocation: '',
  googleToken: null,
  nightModeStart: '21:00',
  nightModeEnd: '06:00',
  screenSaverTimeout: 300,
  openaiApiKey: '',
  aiProvider: 'openai',
  azureEndpoint: '',
  azureDeployment: '',
  openaiModel: 'gpt-4o-mini',
  layouts: [],
  theme: 'ocean',
  photoSource: 'local',
  immichUrl: '',
  immichApiKey: '',
  immichAlbumId: '',
  googlePhotosAlbumId: '',
  allowedEmails: [],
  slideInterval: 15,
  selectedCalendarIds: ['primary'],
  activeWidgets: ['clock', 'weather', 'countdown', 'calendar'],
  calendarColors: {},
};

export async function getSettings(): Promise<DashboardSettings> {
  const existing = await db.settings.get('main');
  if (existing) return existing;
  await db.settings.put(DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS };
}

export async function saveSettings(
  settings: Partial<DashboardSettings>,
): Promise<void> {
  const current = await getSettings();
  await db.settings.put({ ...current, ...settings, id: 'main' });
}

// ---------------------------------------------------------------------------
// Family Members
// ---------------------------------------------------------------------------

export async function getFamilyMembers(): Promise<FamilyMember[]> {
  return db.familyMembers.toArray();
}

export async function addFamilyMember(
  member: Omit<FamilyMember, 'id'>,
): Promise<string> {
  const id = crypto.randomUUID();
  await db.familyMembers.put({ ...member, id });
  return id;
}

export async function updateFamilyMember(
  id: string,
  data: Partial<FamilyMember>,
): Promise<void> {
  await db.familyMembers.update(id, data);
}

export async function deleteFamilyMember(id: string): Promise<void> {
  await db.familyMembers.delete(id);
}

// ---------------------------------------------------------------------------
// Chores
// ---------------------------------------------------------------------------

export async function getChores(): Promise<Chore[]> {
  return db.chores.toArray();
}

export async function addChore(chore: Omit<Chore, 'id'>): Promise<string> {
  const id = crypto.randomUUID();
  await db.chores.put({ ...chore, id });
  return id;
}

export async function updateChore(
  id: string,
  data: Partial<Chore>,
): Promise<void> {
  await db.chores.update(id, data);
}

export async function deleteChore(id: string): Promise<void> {
  await db.chores.delete(id);
}

// ---------------------------------------------------------------------------
// Rewards
// ---------------------------------------------------------------------------

export async function getRewards(): Promise<Reward[]> {
  return db.rewards.toArray();
}

export async function addReward(
  reward: Omit<Reward, 'id'>,
): Promise<string> {
  const id = crypto.randomUUID();
  await db.rewards.put({ ...reward, id });
  return id;
}

export async function updateReward(
  id: string,
  data: Partial<Reward>,
): Promise<void> {
  await db.rewards.update(id, data);
}

export async function deleteReward(id: string): Promise<void> {
  await db.rewards.delete(id);
}

// ---------------------------------------------------------------------------
// Sticker Records
// ---------------------------------------------------------------------------

export async function getStickerRecords(): Promise<StickerRecord[]> {
  return db.stickerRecords.toArray();
}

export async function getStickerRecordsByMember(
  memberId: string,
): Promise<StickerRecord[]> {
  return db.stickerRecords.where('memberId').equals(memberId).toArray();
}

export async function addStickerRecord(
  record: Omit<StickerRecord, 'id'>,
): Promise<string> {
  const id = crypto.randomUUID();
  await db.stickerRecords.put({ ...record, id });
  return id;
}

export async function deleteStickerRecord(id: string): Promise<void> {
  await db.stickerRecords.delete(id);
}

// ---------------------------------------------------------------------------
// Photos
// ---------------------------------------------------------------------------

export async function getPhotos(): Promise<Photo[]> {
  return db.photos.orderBy('addedAt').reverse().toArray();
}

export async function addPhoto(file: File): Promise<string> {
  const id = crypto.randomUUID();
  const blob = new Blob([await file.arrayBuffer()], { type: file.type });
  await db.photos.put({ id, blob, name: file.name, addedAt: new Date() });
  return id;
}

export async function deletePhoto(id: string): Promise<void> {
  await db.photos.delete(id);
}

// ---------------------------------------------------------------------------
// Event Images
// ---------------------------------------------------------------------------

export async function getEventImage(
  eventId: string,
): Promise<EventImage | undefined> {
  return db.eventImages.where('eventId').equals(eventId).first();
}

export async function addEventImage(
  eventId: string,
  file: File,
): Promise<string> {
  // Replace any existing image for this event
  const existing = await getEventImage(eventId);
  if (existing) await db.eventImages.delete(existing.id);

  const id = crypto.randomUUID();
  const blob = new Blob([await file.arrayBuffer()], { type: file.type });
  await db.eventImages.put({ id, eventId, blob, name: file.name });
  return id;
}

export async function deleteEventImage(eventId: string): Promise<void> {
  const existing = await getEventImage(eventId);
  if (existing) await db.eventImages.delete(existing.id);
}

// ---------------------------------------------------------------------------
// Shopping Items
// ---------------------------------------------------------------------------

export async function getShoppingItems(): Promise<ShoppingItem[]> {
  return db.shoppingItems.orderBy('addedAt').toArray();
}

export async function addShoppingItem(text: string): Promise<string> {
  const id = crypto.randomUUID();
  await db.shoppingItems.put({
    id,
    text,
    checked: false,
    addedAt: new Date(),
  });
  return id;
}

export async function updateShoppingItem(
  id: string,
  data: Partial<ShoppingItem>,
): Promise<void> {
  await db.shoppingItems.update(id, data);
}

export async function deleteShoppingItem(id: string): Promise<void> {
  await db.shoppingItems.delete(id);
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

export async function getNotes(): Promise<Note[]> {
  return db.notes.toArray();
}

export async function addNote(
  note: Omit<Note, 'id' | 'updatedAt'>,
): Promise<string> {
  const id = crypto.randomUUID();
  await db.notes.put({ ...note, id, updatedAt: new Date() });
  return id;
}

export async function updateNote(
  id: string,
  data: Partial<Note>,
): Promise<void> {
  await db.notes.update(id, { ...data, updatedAt: new Date() });
}

export async function deleteNote(id: string): Promise<void> {
  await db.notes.delete(id);
}

// ---------------------------------------------------------------------------
// Countdown Events
// ---------------------------------------------------------------------------

export async function getCountdownEvents(): Promise<CountdownEvent[]> {
  return db.countdownEvents.orderBy('date').toArray();
}

export async function addCountdownEvent(
  event: Omit<CountdownEvent, 'id'>,
): Promise<string> {
  const id = crypto.randomUUID();
  await db.countdownEvents.put({ ...event, id });
  return id;
}

export async function updateCountdownEvent(
  id: string,
  data: Partial<CountdownEvent>,
): Promise<void> {
  await db.countdownEvents.update(id, data);
}

export async function deleteCountdownEvent(id: string): Promise<void> {
  await db.countdownEvents.delete(id);
}

// ---------------------------------------------------------------------------
// Auth User
// ---------------------------------------------------------------------------

export async function getAuthUser(): Promise<GoogleUser | undefined> {
  const users = await db.authUser.toArray();
  return users[0];
}

export async function saveAuthUser(user: GoogleUser): Promise<void> {
  // Only keep one user record
  await db.authUser.clear();
  await db.authUser.put(user);
}

export async function clearAuthUser(): Promise<void> {
  await db.authUser.clear();
}

// ---------------------------------------------------------------------------
// Local Calendar Events
// ---------------------------------------------------------------------------

export async function getLocalEvents(): Promise<LocalCalendarEvent[]> {
  return db.localEvents.toArray();
}

export async function addLocalEvent(
  event: Omit<LocalCalendarEvent, 'id'>,
): Promise<string> {
  const id = crypto.randomUUID();
  await db.localEvents.put({ ...event, id });
  return id;
}

export async function updateLocalEvent(
  id: string,
  data: Partial<LocalCalendarEvent>,
): Promise<void> {
  await db.localEvents.update(id, data);
}

export async function deleteLocalEvent(id: string): Promise<void> {
  await db.localEvents.delete(id);
}
