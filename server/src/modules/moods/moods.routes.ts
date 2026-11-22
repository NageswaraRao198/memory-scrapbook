import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { type Db, type Row, one } from '../../db/database.js';
import { getAuth } from '../../middleware/auth.js';
import { HttpError, notFound } from '../../utils/errors.js';
import { Filter } from '../../utils/filter.js';
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

type Counted = { label: string; count: number };
const counted = (rows: Counted[]) => rows.map((r) => ({ label: r.label, count: r.count }));

function rangeFilter(ownerId: string, q: { from?: string; to?: string }, column: 'recorded_at' | 'entry_date') {
  const f = new Filter().add('owner_id = ?', ownerId);
  if (q.from) f.add(`${column} >= ?`, q.from);
  if (q.to) f.add(`${column} <= ?`, q.to);
  return f;
}

export function moodsRouter(db: Db): Router {
  const router = Router();
  const getRow = (ownerId: string, id: string) =>
    one(db, 'SELECT * FROM mood_checkins WHERE id = $1 AND owner_id = $2', [id, ownerId]);

  const assertEntryOwned = async (ownerId: string, entryId: string | null | undefined) => {
    if (!entryId) return;
    if (!(await one(db, 'SELECT 1 FROM entries WHERE id = $1 AND owner_id = $2', [entryId, ownerId]))) {
      throw new HttpError(400, 'validation_error', 'That diary entry could not be found.');
    }
  };

  const assertEditable = (row: Row) => {
    if (row.source === 'entry') {
      throw new HttpError(409, 'managed_by_entry', 'This feeling belongs to a diary entry. Edit it from the entry.');
    }
  };

  router.get('/', async (req, res) => {
    const { userId } = getAuth(res);
    const q = parse(range, req.query);
    const f = rangeFilter(userId, q, 'recorded_at');
    const limit = f.push(q.limit);
    const offset = f.push(q.offset);
    const rows = await db.query(
      `SELECT * FROM mood_checkins WHERE ${f.clause} ORDER BY recorded_at DESC LIMIT ${limit} OFFSET ${offset}`,
      f.params,
    );
    res.json({ items: rows.map(toMoodCheckIn) });
  });

  router.get('/summary', async (req, res) => {
    const { userId } = getAuth(res);
    const q = parse(range, req.query);
    const moodFilter = rangeFilter(userId, q, 'recorded_at');
    const entryFilter = rangeFilter(userId, q, 'entry_date');

    const { total } = (await one<{ total: number }>(
      db,
      `SELECT COUNT(*)::int AS total FROM mood_checkins WHERE ${moodFilter.clause}`,
      moodFilter.params,
    ))!;
    const byMood = counted(
      await db.query<Counted>(
        `SELECT mood AS label, COUNT(*)::int AS count FROM mood_checkins WHERE ${moodFilter.clause} GROUP BY mood ORDER BY 2 DESC, 1`,
        moodFilter.params,
      ),
    );
    const topEmotions = counted(
      await db.query<Counted>(
        `SELECT lower(v.value) AS label, COUNT(*)::int AS count
         FROM mood_checkins, jsonb_array_elements_text(mood_checkins.emotions) AS v(value)
         WHERE ${moodFilter.clause} GROUP BY lower(v.value) ORDER BY 2 DESC, 1 LIMIT 8`,
        moodFilter.params,
      ),
    );
    const topContextTags = counted(
      await db.query<Counted>(
        `SELECT lower(v.value) AS label, COUNT(*)::int AS count
         FROM entries, jsonb_array_elements_text(entries.context_tags) AS v(value)
         WHERE ${entryFilter.clause} AND is_draft = FALSE GROUP BY lower(v.value) ORDER BY 2 DESC, 1 LIMIT 8`,
        entryFilter.params,
      ),
    );
    res.json({ total, byMood, topEmotions, topContextTags });
  });

  router.post('/', async (req, res) => {
    const { userId } = getAuth(res);
    const body = parse(createSchema, req.body);
    await assertEntryOwned(userId, body.linkedEntryId);
    const id = randomUUID();
    const now = nowIso();
    await db.query(
      `INSERT INTO mood_checkins (id, owner_id, recorded_at, mood, emotions, intensity, note, linked_entry_id, source, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, 'checkin', $9, $9)`,
      [id, userId, body.recordedAt, body.mood, JSON.stringify(body.emotions), body.intensity, body.note, body.linkedEntryId, now],
    );
    res.status(201).json({ checkIn: toMoodCheckIn((await getRow(userId, id))!) });
  });

  router.patch('/:id', async (req, res) => {
    const { userId } = getAuth(res);
    const { id } = parse(idParam, req.params);
    const patch = parse(updateSchema, req.body);
    const row = await getRow(userId, id);
    if (!row) throw notFound('That check-in');
    assertEditable(row);
    await assertEntryOwned(userId, patch.linkedEntryId);
    const merged = { ...toMoodCheckIn(row), ...patch };
    await db.query(
      `UPDATE mood_checkins SET recorded_at = $1, mood = $2, emotions = $3::jsonb, intensity = $4, note = $5, linked_entry_id = $6, updated_at = $7
       WHERE id = $8 AND owner_id = $9`,
      [merged.recordedAt, merged.mood, JSON.stringify(merged.emotions), merged.intensity, merged.note, merged.linkedEntryId, nowIso(), id, userId],
    );
    res.json({ checkIn: toMoodCheckIn((await getRow(userId, id))!) });
  });

  router.delete('/:id', async (req, res) => {
    const { userId } = getAuth(res);
    const { id } = parse(idParam, req.params);
    const row = await getRow(userId, id);
    if (!row) throw notFound('That check-in');
    assertEditable(row);
    await db.query('DELETE FROM mood_checkins WHERE id = $1 AND owner_id = $2', [id, userId]);
    res.status(204).end();
  });

  return router;
}
