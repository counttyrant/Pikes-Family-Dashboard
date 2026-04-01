import { db } from '../db';
import { syncToCloud, deleteFromCloud } from './cloudSync';
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
  Recipe,
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
  widgetColors: {},
  eventColorOverrides: {},
  calendarDaysToShow: 7,
  weekStartsOn: 0,
  ttsEngine: 'openai',
  ttsVoiceName: '',
  ttsRate: 0.95,
  ttsPitch: 1.1,
  openaiTtsApiKey: '',
  openaiTtsVoice: 'nova',
  openaiTtsModel: 'tts-1',
  enabledPages: ['dashboard', 'chores', 'shopping', 'activities', 'recipes', 'jellyfin'],
  autoPictureMode: true,
  autoPictureModeTimeout: 300,
  widgetBlur: {},
  presenceDetectionEnabled: false,
  presenceSensitivity: 5,
  presenceInactivityTimeout: 5,
  presenceScheduleEnabled: false,
  presenceScheduleStart: '07:00',
  presenceScheduleEnd: '22:00',
  presenceSource: 'camera',
  dimEnabled: false,
  dimMode: 'partial',
  dimOpacity: 70,
  brightnessServiceEnabled: false,
  brightnessServicePort: 3737,
  brightnessOnPresence: 100,
  brightnessOnIdle: 10,
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
  const merged = { ...current, ...settings, id: 'main' };
  await db.settings.put(merged);
  // Sync to cloud — await so callers know if it succeeded
  try {
    await syncToCloud('settings', merged);
  } catch (err) {
    console.warn('Cloud sync failed for settings:', err);
  }
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
  const doc = { ...member, id };
  await db.familyMembers.put(doc);
  syncToCloud('familyMembers', doc).catch(() => {});
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
  deleteFromCloud('familyMembers', id).catch(() => {});
}

// ---------------------------------------------------------------------------
// Chores
// ---------------------------------------------------------------------------

export async function getChores(): Promise<Chore[]> {
  return db.chores.toArray();
}

export async function addChore(chore: Omit<Chore, 'id'>): Promise<string> {
  const id = crypto.randomUUID();
  const doc = { ...chore, id };
  await db.chores.put(doc);
  syncToCloud('chores', doc).catch(() => {});
  return id;
}

export async function updateChore(
  id: string,
  data: Partial<Chore>,
): Promise<void> {
  await db.chores.update(id, data);
  const updated = await db.chores.get(id);
  if (updated) syncToCloud('chores', updated).catch(() => {});
}

export async function deleteChore(id: string): Promise<void> {
  await db.chores.delete(id);
  deleteFromCloud('chores', id).catch(() => {});
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
  const doc = { ...reward, id };
  await db.rewards.put(doc);
  syncToCloud('rewards', doc).catch(() => {});
  return id;
}

export async function updateReward(
  id: string,
  data: Partial<Reward>,
): Promise<void> {
  await db.rewards.update(id, data);
  const updated = await db.rewards.get(id);
  if (updated) syncToCloud('rewards', updated).catch(() => {});
}

export async function deleteReward(id: string): Promise<void> {
  await db.rewards.delete(id);
  deleteFromCloud('rewards', id).catch(() => {});
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
  const doc = { ...record, id };
  await db.stickerRecords.put(doc);
  syncToCloud('stickerRecords', doc).catch(() => {});
  return id;
}

export async function deleteStickerRecord(id: string): Promise<void> {
  await db.stickerRecords.delete(id);
  deleteFromCloud('stickerRecords', id).catch(() => {});
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
  const doc = { id, text, checked: false, addedAt: new Date() };
  await db.shoppingItems.put(doc);
  syncToCloud('shoppingItems', { ...doc, addedAt: doc.addedAt.toISOString() }).catch(() => {});
  return id;
}

export async function updateShoppingItem(
  id: string,
  data: Partial<ShoppingItem>,
): Promise<void> {
  await db.shoppingItems.update(id, data);
  const updated = await db.shoppingItems.get(id);
  if (updated) syncToCloud('shoppingItems', { ...updated, addedAt: updated.addedAt instanceof Date ? updated.addedAt.toISOString() : updated.addedAt }).catch(() => {});
}

export async function deleteShoppingItem(id: string): Promise<void> {
  await db.shoppingItems.delete(id);
  deleteFromCloud('shoppingItems', id).catch(() => {});
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
  const doc = { ...note, id, updatedAt: new Date() };
  await db.notes.put(doc);
  syncToCloud('notes', { ...doc, updatedAt: doc.updatedAt.toISOString() }).catch(() => {});
  return id;
}

export async function updateNote(
  id: string,
  data: Partial<Note>,
): Promise<void> {
  await db.notes.update(id, { ...data, updatedAt: new Date() });
  const updated = await db.notes.get(id);
  if (updated) syncToCloud('notes', { ...updated, updatedAt: updated.updatedAt instanceof Date ? updated.updatedAt.toISOString() : updated.updatedAt }).catch(() => {});
}

export async function deleteNote(id: string): Promise<void> {
  await db.notes.delete(id);
  deleteFromCloud('notes', id).catch(() => {});
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
  const doc = { ...event, id };
  await db.countdownEvents.put(doc);
  syncToCloud('countdownEvents', doc).catch(() => {});
  return id;
}

export async function updateCountdownEvent(
  id: string,
  data: Partial<CountdownEvent>,
): Promise<void> {
  await db.countdownEvents.update(id, data);
  const updated = await db.countdownEvents.get(id);
  if (updated) syncToCloud('countdownEvents', updated).catch(() => {});
}

export async function deleteCountdownEvent(id: string): Promise<void> {
  await db.countdownEvents.delete(id);
  deleteFromCloud('countdownEvents', id).catch(() => {});
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
  const doc = { ...event, id };
  await db.localEvents.put(doc);
  syncToCloud('localEvents', doc).catch(() => {});
  return id;
}

export async function updateLocalEvent(
  id: string,
  data: Partial<LocalCalendarEvent>,
): Promise<void> {
  await db.localEvents.update(id, data);
  const updated = await db.localEvents.get(id);
  if (updated) syncToCloud('localEvents', updated).catch(() => {});
}

export async function deleteLocalEvent(id: string): Promise<void> {
  await db.localEvents.delete(id);
  deleteFromCloud('localEvents', id).catch(() => {});
}

// ---------------------------------------------------------------------------
// Recipes
// ---------------------------------------------------------------------------

export async function getRecipes(): Promise<Recipe[]> {
  return db.recipes.orderBy('addedAt').reverse().toArray();
}

export async function addRecipe(recipe: Omit<Recipe, 'id' | 'addedAt'>): Promise<string> {
  const id = crypto.randomUUID();
  const doc = { ...recipe, id, addedAt: new Date() };
  await db.recipes.put(doc);
  syncToCloud('recipes', { ...doc, addedAt: doc.addedAt.toISOString() }).catch(() => {});
  return id;
}

export async function deleteRecipe(id: string): Promise<void> {
  await db.recipes.delete(id);
  deleteFromCloud('recipes', id).catch(() => {});
}
