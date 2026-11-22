export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  aiEnabled: boolean;
  defaultEditorMode: 'distraction-free' | 'standard';
}

export interface User {
  id: string;
  email: string;
  displayName: string | null;
  timezone: string;
  preferences: UserPreferences;
}

export interface Entry {
  id: string;
  title: string | null;
  body: string;
  bodyFormat: 'markdown' | 'plain-text';
  entryDate: string;
  mood: string | null;
  emotions: string[];
  intensity: number | null;
  contextTags: string[];
  isDraft: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EntryInput {
  title: string | null;
  body: string;
  bodyFormat: 'markdown' | 'plain-text';
  entryDate: string;
  mood: string | null;
  emotions: string[];
  intensity: number | null;
  contextTags: string[];
  isDraft: boolean;
}

export interface Paged<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface MoodCheckIn {
  id: string;
  recordedAt: string;
  mood: string;
  emotions: string[];
  intensity: number | null;
  note: string | null;
  linkedEntryId: string | null;
  source: 'checkin' | 'entry';
  createdAt: string;
  updatedAt: string;
}

export interface MoodSummary {
  total: number;
  byMood: { label: string; count: number }[];
  topEmotions: { label: string; count: number }[];
  topContextTags: { label: string; count: number }[];
}

export interface Memory {
  id: string;
  title: string;
  description: string | null;
  memoryDate: string;
  tags: string[];
  peopleLabels: string[];
  locationLabel: string | null;
  linkedEntryId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ReflectionType = 'daily' | 'weekly' | 'monthly' | 'future-letter' | 'learned' | 'carrying' | 'custom';

export interface Reflection {
  id: string;
  type: ReflectionType;
  title: string | null;
  prompt: string | null;
  response: string;
  periodStart: string | null;
  periodEnd: string | null;
  createdAt: string;
  updatedAt: string;
}
