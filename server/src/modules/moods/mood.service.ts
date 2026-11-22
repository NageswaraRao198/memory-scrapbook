import { randomUUID } from 'node:crypto';
import type { Db, Row } from '../../db/database.js';
import { nowIso, parseJsonArray } from '../../utils/schemas.js';

export function toMoodCheckIn(row: Row) {
  return {
    id: String(row.id),
    recordedAt: String(row.recorded_at),
    mood: String(row.mood),
    emotions: parseJsonArray(row.emotions),
    intensity: (row.intensity as number | null) ?? null,
    note: (row.note as string | null) ?? null,
    linkedEntryId: (row.linked_entry_id as string | null) ?? null,
    source: String(row.source) as 'checkin' | 'entry',
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

interface EntryMoodFields {
  id: string;
  entryDate: string;
  mood: string | null;
  emotions: string[];
  intensity: number | null;
}

/**
 * Keeps exactly one entry-sourced mood check-in per diary entry so the Mood Garden
 * never shows duplicates for the same moment.
 */
export function syncEntryMood(db: Db, ownerId: string, entry: EntryMoodFields): void {
  const existing = db
    .prepare("SELECT id FROM mood_checkins WHERE owner_id = ? AND linked_entry_id = ? AND source = 'entry'")
    .get(ownerId, entry.id) as { id: string } | undefined;

  if (!entry.mood) {
    if (existing) db.prepare('DELETE FROM mood_checkins WHERE id = ?').run(existing.id);
    return;
  }
  const now = nowIso();
  if (existing) {
    db.prepare(
      'UPDATE mood_checkins SET recorded_at = ?, mood = ?, emotions = ?, intensity = ?, updated_at = ? WHERE id = ?',
    ).run(entry.entryDate, entry.mood, JSON.stringify(entry.emotions), entry.intensity, now, existing.id);
  } else {
    db.prepare(
      `INSERT INTO mood_checkins (id, owner_id, recorded_at, mood, emotions, intensity, note, linked_entry_id, source, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL, ?, 'entry', ?, ?)`,
    ).run(randomUUID(), ownerId, entry.entryDate, entry.mood, JSON.stringify(entry.emotions), entry.intensity, entry.id, now, now);
  }
}
