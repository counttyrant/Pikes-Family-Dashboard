import Dexie, { type Table } from 'dexie';
import type {
  FamilyMember,
  Chore,
  Reward,
  StickerRecord,
  Photo,
  EventImage,
  DashboardSettings,
  ShoppingItem,
  Note,
  CountdownEvent,
  GoogleUser,
  LocalCalendarEvent,
} from '../types';

class DashboardDB extends Dexie {
  familyMembers!: Table<FamilyMember, string>;
  chores!: Table<Chore, string>;
  rewards!: Table<Reward, string>;
  stickerRecords!: Table<StickerRecord, string>;
  photos!: Table<Photo, string>;
  eventImages!: Table<EventImage, string>;
  settings!: Table<DashboardSettings, string>;
  shoppingItems!: Table<ShoppingItem, string>;
  notes!: Table<Note, string>;
  countdownEvents!: Table<CountdownEvent, string>;
  authUser!: Table<GoogleUser, string>;
  localEvents!: Table<LocalCalendarEvent, string>;

  constructor() {
    super('PikesFamilyDashboard');

    this.version(1).stores({
      familyMembers: 'id, name',
      chores: 'id, *assignedTo, dueDate, completed',
      rewards: 'id, claimedBy',
      stickerRecords: 'id, memberId, choreId, earnedAt',
      photos: 'id, addedAt',
      eventImages: 'id, eventId',
      settings: 'id',
      shoppingItems: 'id, checked, addedAt',
      notes: 'id, updatedAt',
      countdownEvents: 'id, date',
    });

    this.version(2).stores({
      familyMembers: 'id, name',
      chores: 'id, *assignedTo, dueDate, completed',
      rewards: 'id, claimedBy',
      stickerRecords: 'id, memberId, choreId, earnedAt',
      photos: 'id, addedAt',
      eventImages: 'id, eventId',
      settings: 'id',
      shoppingItems: 'id, checked, addedAt',
      notes: 'id, updatedAt',
      countdownEvents: 'id, date',
      authUser: 'email',
      localEvents: 'id, start',
    });
  }
}

export const db = new DashboardDB();
