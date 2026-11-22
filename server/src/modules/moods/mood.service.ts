import { randomUUID } from 'node:crypto';
import { type Queryable, type Row, one } from '../../db/database.js';
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
export async function syncEntryMood(db: Queryable, ownerId: string, entry: EntryMoodFields): Promise<void> {
  const existing = await one<{ id: string }>(
    db,
    "SELECT id FROM mood_checkins WHERE owner_id = $1 AND linked_entry_id = $2 AND source = 'entry'",
    [ownerId, entry.id],
  );

  if (!entry.mood) {
    if (existing) await db.query('DELETE FROM mood_checkins WHERE id = $1', [existing.id]);
    return;
  }
  const now = nowIso();
  if (existing) {
    await db.query(
      'UPDATE mood_checkins SET recorded_at = $1, mood = $2, emotions = $3::jsonb, intensity = $4, updated_at = $5 WHERE id = $6',
      [entry.entryDate, entry.mood, JSON.stringify(entry.emotions), entry.intensity, now, existing.id],
    );
  } else {
    await db.query(
      `INSERT INTO mood_checkins (id, owner_id, recorded_at, mood, emotions, intensity, note, linked_entry_id, source, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, NULL, $7, 'entry', $8, $8)`,
      [randomUUID(), ownerId, entry.entryDate, entry.mood, JSON.stringify(entry.emotions), entry.intensity, entry.id, now],
    );
  }
}
