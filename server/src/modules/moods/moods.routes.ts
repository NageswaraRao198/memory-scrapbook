import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import type { Db, Row } from '../../db/database.js';
import { getAuth } from '../../middleware/auth.js';
import { HttpError, notFound } from '../../utils/errors.js';
import { idParam, intensity, isoDate, nowIso, optionalText, tagList } from '../../utils/schemas.js';
import { parse } from '../../utils/validate.js';
import { toMoodCheckIn } from './mood.service.js';

const fields = {
  recordedAt: isoDate,
  mood: z.string().trim().min(1, 'Choose a feeling first.').max(40),
  emotions: tagList(12),
  intensity: intensity.nullish().transform((v) => v ?? null),
  note: optionalText(1000),
  linkedEntryId: z.string().uuid().nullish().transform((v) => v ?? null),
};

const createSchema = z.object({ ...fields, recordedAt: fields.recordedAt.default(() => nowIso()) });
const updateSchema = z.object(fields).partial();

const range = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
  offset: z.coerce.number().int().min(0).default(0),
});

function counted(rows: { label: string; count: number }[]) {
  return rows.map((r) => ({ label: r.label, count: r.count }));
}

function rangeFilter(ownerId: string, q: { from?: string; to?: string }) {
  const where = ['owner_id = ?'];
  const params: string[] = [ownerId];
  if (q.from) {
    where.push('recorded_at >= ?');
    params.push(q.from);
  }
  if (q.to) {
    where.push('recorded_at <= ?');
    params.push(q.to);
  }
  return { clause: where.join(' AND '), params };
}

export function moodsRouter(db: Db): Router {
  const router = Router();
  const getRow = (ownerId: string, id: string) =>
    db.prepare('SELECT * FROM mood_checkins WHERE id = ? AND owner_id = ?').get(id, ownerId) as Row | undefined;

  const assertEntryOwned = (ownerId: string, entryId: string | null) => {
    if (!entryId) return;
    const found = db.prepare('SELECT 1 FROM entries WHERE id = ? AND owner_id = ?').get(entryId, ownerId);
    if (!found) throw new HttpError(400, 'validation_error', 'That diary entry could not be found.');
  };

  const assertEditable = (row: Row) => {
    if (row.source === 'entry') {
      throw new HttpError(409, 'managed_by_entry', 'This feeling belongs to a diary entry. Edit it from the entry.');
    }
  };

  router.get('/', (req, res) => {
    const { userId } = getAuth(res);
    const q = parse(range, req.query);
    const { clause, params } = rangeFilter(userId, q);
    const rows = db
      .prepare(`SELECT * FROM mood_checkins WHERE ${clause} ORDER BY recorded_at DESC LIMIT ? OFFSET ?`)
      .all(...params, q.limit, q.offset) as Row[];
    res.json({ items: rows.map(toMoodCheckIn) });
  });

  router.get('/summary', (req, res) => {
    const { userId } = getAuth(res);
    const q = parse(range, req.query);
    const { clause, params } = rangeFilter(userId, q);
    const { total } = db.prepare(`SELECT COUNT(*) AS total FROM mood_checkins WHERE ${clause}`).get(...params) as {
      total: number;
    };
    const byMood = counted(
      db
        .prepare(
          `SELECT mood AS label, COUNT(*) AS count FROM mood_checkins WHERE ${clause} GROUP BY mood ORDER BY count DESC, mood`,
        )
        .all(...params) as { label: string; count: number }[],
    );
    const topEmotions = counted(
      db
        .prepare(
          `SELECT lower(value) AS label, COUNT(*) AS count FROM mood_checkins, json_each(mood_checkins.emotions)
           WHERE ${clause} GROUP BY lower(value) ORDER BY count DESC, label LIMIT 8`,
        )
        .all(...params) as { label: string; count: number }[],
    );
    const entryWhere = clause.replaceAll('recorded_at', 'entry_date');
    const topContextTags = counted(
      db
        .prepare(
          `SELECT lower(value) AS label, COUNT(*) AS count FROM entries, json_each(entries.context_tags)
           WHERE ${entryWhere} AND is_draft = 0 GROUP BY lower(value) ORDER BY count DESC, label LIMIT 8`,
        )
        .all(...params) as { label: string; count: number }[],
    );
    res.json({ total, byMood, topEmotions, topContextTags });
  });

  router.post('/', (req, res) => {
    const { userId } = getAuth(res);
    const body = parse(createSchema, req.body);
    assertEntryOwned(userId, body.linkedEntryId);
    const id = randomUUID();
    const now = nowIso();
    db.prepare(
      `INSERT INTO mood_checkins (id, owner_id, recorded_at, mood, emotions, intensity, note, linked_entry_id, source, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'checkin', ?, ?)`,
    ).run(id, userId, body.recordedAt, body.mood, JSON.stringify(body.emotions), body.intensity, body.note, body.linkedEntryId, now, now);
    res.status(201).json({ checkIn: toMoodCheckIn(getRow(userId, id)!) });
  });

  router.patch('/:id', (req, res) => {
    const { userId } = getAuth(res);
    const { id } = parse(idParam, req.params);
    const patch = parse(updateSchema, req.body);
    const row = getRow(userId, id);
    if (!row) throw notFound('That check-in');
    assertEditable(row);
    if (patch.linkedEntryId) assertEntryOwned(userId, patch.linkedEntryId);
    const merged = { ...toMoodCheckIn(row), ...patch };
    db.prepare(
      'UPDATE mood_checkins SET recorded_at = ?, mood = ?, emotions = ?, intensity = ?, note = ?, linked_entry_id = ?, updated_at = ? WHERE id = ? AND owner_id = ?',
    ).run(merged.recordedAt, merged.mood, JSON.stringify(merged.emotions), merged.intensity, merged.note, merged.linkedEntryId, nowIso(), id, userId);
    res.json({ checkIn: toMoodCheckIn(getRow(userId, id)!) });
  });

  router.delete('/:id', (req, res) => {
    const { userId } = getAuth(res);
    const { id } = parse(idParam, req.params);
    const row = getRow(userId, id);
    if (!row) throw notFound('That check-in');
    assertEditable(row);
    db.prepare('DELETE FROM mood_checkins WHERE id = ? AND owner_id = ?').run(id, userId);
    res.status(204).end();
  });

  return router;
}
