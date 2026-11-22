import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { type Db, type Row, one } from '../../db/database.js';
import { getAuth } from '../../middleware/auth.js';
import { Filter } from '../../utils/filter.js';
import { HttpError, notFound } from '../../utils/errors.js';
import { escapeLike, idParam, intensity, isoDate, nowIso, pageQuery, parseJsonArray, tagList } from '../../utils/schemas.js';
import { parse } from '../../utils/validate.js';
import { syncEntryMood } from '../moods/mood.service.js';

export function toEntry(row: Row) {
  return {
    id: String(row.id),
    title: (row.title as string | null) ?? null,
    body: String(row.body),
    bodyFormat: String(row.body_format) as 'markdown' | 'plain-text',
    entryDate: String(row.entry_date),
    mood: (row.mood as string | null) ?? null,
    emotions: parseJsonArray(row.emotions),
    intensity: (row.intensity as number | null) ?? null,
    contextTags: parseJsonArray(row.context_tags),
    isDraft: Boolean(row.is_draft),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

const moodLabel = z
  .string()
  .trim()
  .max(40)
  .nullish()
  .transform((v) => v || null);

const entryFields = {
  title: z
    .string()
    .trim()
    .max(200)
    .nullish()
    .transform((v) => v || null),
  body: z.string().max(200_000),
  bodyFormat: z.enum(['markdown', 'plain-text']),
  entryDate: isoDate,
  mood: moodLabel,
  emotions: tagList(12),
  intensity: intensity.nullish().transform((v) => v ?? null),
  contextTags: tagList(12),
  isDraft: z.boolean(),
};

const createSchema = z.object({
  title: entryFields.title,
  body: entryFields.body.default(''),
  bodyFormat: entryFields.bodyFormat.default('markdown'),
  entryDate: entryFields.entryDate.default(() => nowIso()),
  mood: entryFields.mood,
  emotions: entryFields.emotions,
  intensity: entryFields.intensity,
  contextTags: entryFields.contextTags,
  isDraft: entryFields.isDraft.default(false),
});
const updateSchema = z.object(entryFields).partial();

const listQuery = z.object({
  q: z.string().trim().max(200).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  mood: z.string().trim().max(40).optional(),
  emotion: z.string().trim().max(40).optional(),
  tag: z.string().trim().max(40).optional(),
  sort: z.enum(['newest', 'oldest']).default('newest'),
  drafts: z.enum(['include', 'exclude', 'only']).default('include'),
  ...pageQuery,
});

const onThisDayQuery = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tz: z.string().max(64).default('UTC'),
});

function assertWritable(entry: { body: string; isDraft: boolean }) {
  if (!entry.isDraft && !entry.body.trim()) {
    throw new HttpError(400, 'validation_error', 'Write a few words before saving this entry.', {
      issues: [{ path: 'body', message: 'Write a few words before saving this entry.' }],
    });
  }
}

export function entriesRouter(db: Db): Router {
  const router = Router();

  const getRow = (ownerId: string, id: string) =>
    one(db, 'SELECT * FROM entries WHERE id = $1 AND owner_id = $2', [id, ownerId]);

  router.get('/', async (req, res) => {
    const { userId } = getAuth(res);
    const q = parse(listQuery, req.query);
    const f = new Filter().add('owner_id = ?', userId);
    if (q.q) {
      const like = `%${escapeLike(q.q)}%`;
      f.add("(title ILIKE ? ESCAPE '\\' OR body ILIKE ? ESCAPE '\\')", like, like);
    }
    if (q.from) f.add('entry_date >= ?', q.from);
    if (q.to) f.add('entry_date <= ?', q.to);
    if (q.mood) f.add('mood = ?', q.mood);
    if (q.emotion) {
      f.add('EXISTS (SELECT 1 FROM jsonb_array_elements_text(entries.emotions) AS v(value) WHERE lower(v.value) = lower(?))', q.emotion);
    }
    if (q.tag) {
      f.add('EXISTS (SELECT 1 FROM jsonb_array_elements_text(entries.context_tags) AS v(value) WHERE lower(v.value) = lower(?))', q.tag);
    }
    if (q.drafts === 'exclude') f.add('is_draft = FALSE');
    if (q.drafts === 'only') f.add('is_draft = TRUE');
    const dir = q.sort === 'oldest' ? 'ASC' : 'DESC';
    const { total } = (await one<{ total: number }>(db, `SELECT COUNT(*)::int AS total FROM entries WHERE ${f.clause}`, f.params))!;
    const limit = f.push(q.limit);
    const offset = f.push(q.offset);
    const rows = await db.query(
      `SELECT * FROM entries WHERE ${f.clause} ORDER BY entry_date ${dir}, id ${dir} LIMIT ${limit} OFFSET ${offset}`,
      f.params,
    );
    res.json({ items: rows.map(toEntry), total, limit: q.limit, offset: q.offset });
  });

  router.get('/facets', async (_req, res) => {
    const { userId } = getAuth(res);
    const distinct = async (column: 'emotions' | 'context_tags') =>
      (
        await db.query<{ value: string }>(
          `SELECT value FROM (
             SELECT DISTINCT v.value AS value FROM entries, jsonb_array_elements_text(entries.${column}) AS v(value) WHERE owner_id = $1
           ) t ORDER BY lower(value), value`,
          [userId],
        )
      ).map((r) => r.value);
    const moods = (
      await db.query<{ mood: string }>('SELECT DISTINCT mood FROM entries WHERE owner_id = $1 AND mood IS NOT NULL ORDER BY mood', [userId])
    ).map((r) => r.mood);
    res.json({ moods, emotions: await distinct('emotions'), contextTags: await distinct('context_tags') });
  });

  router.get('/on-this-day', async (req, res) => {
    const { userId } = getAuth(res);
    const q = parse(onThisDayQuery, req.query);
    let formatter: Intl.DateTimeFormat;
    try {
      formatter = new Intl.DateTimeFormat('en-CA', { timeZone: q.tz, year: 'numeric', month: '2-digit', day: '2-digit' });
    } catch {
      throw new HttpError(400, 'validation_error', 'Unknown timezone.');
    }
    const monthDay = q.date.slice(5);
    const year = q.date.slice(0, 4);
    const rows = await db.query('SELECT * FROM entries WHERE owner_id = $1 AND is_draft = FALSE ORDER BY entry_date DESC', [userId]);
    const match = rows.find((r) => {
      const local = formatter.format(new Date(String(r.entry_date)));
      return local.slice(5) === monthDay && local.slice(0, 4) !== year;
    });
    res.json({ entry: match ? toEntry(match) : null });
  });

  router.post('/', async (req, res) => {
    const { userId } = getAuth(res);
    const body = parse(createSchema, req.body);
    assertWritable(body);
    const id = randomUUID();
    const now = nowIso();
    await db.transaction(async (tx) => {
      await tx.query(
        `INSERT INTO entries (id, owner_id, title, body, body_format, entry_date, mood, emotions, intensity, context_tags, is_draft, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10::jsonb, $11, $12, $12)`,
        [
          id,
          userId,
          body.title,
          body.body,
          body.bodyFormat,
          body.entryDate,
          body.mood,
          JSON.stringify(body.emotions),
          body.intensity,
          JSON.stringify(body.contextTags),
          body.isDraft,
          now,
        ],
      );
      await syncEntryMood(tx, userId, { id, entryDate: body.entryDate, mood: body.mood, emotions: body.emotions, intensity: body.intensity });
    });
    res.status(201).json({ entry: toEntry((await getRow(userId, id))!) });
  });

  router.get('/:id', async (req, res) => {
    const { userId } = getAuth(res);
    const { id } = parse(idParam, req.params);
    const row = await getRow(userId, id);
    if (!row) throw notFound('That entry');
    res.json({ entry: toEntry(row) });
  });

  router.patch('/:id', async (req, res) => {
    const { userId } = getAuth(res);
    const { id } = parse(idParam, req.params);
    const patch = parse(updateSchema, req.body);
    const row = await getRow(userId, id);
    if (!row) throw notFound('That entry');
    const merged = { ...toEntry(row), ...patch };
    assertWritable(merged);
    await db.transaction(async (tx) => {
      await tx.query(
        `UPDATE entries SET title = $1, body = $2, body_format = $3, entry_date = $4, mood = $5, emotions = $6::jsonb, intensity = $7,
         context_tags = $8::jsonb, is_draft = $9, updated_at = $10 WHERE id = $11 AND owner_id = $12`,
        [
          merged.title,
          merged.body,
          merged.bodyFormat,
          merged.entryDate,
          merged.mood,
          JSON.stringify(merged.emotions),
          merged.intensity,
          JSON.stringify(merged.contextTags),
          merged.isDraft,
          nowIso(),
          id,
          userId,
        ],
      );
      await syncEntryMood(tx, userId, merged);
    });
    res.json({ entry: toEntry((await getRow(userId, id))!) });
  });

  router.delete('/:id', async (req, res) => {
    const { userId } = getAuth(res);
    const { id } = parse(idParam, req.params);
    if (!(await getRow(userId, id))) throw notFound('That entry');
    await db.transaction(async (tx) => {
      await tx.query("DELETE FROM mood_checkins WHERE owner_id = $1 AND linked_entry_id = $2 AND source = 'entry'", [userId, id]);
      await tx.query('DELETE FROM entries WHERE id = $1 AND owner_id = $2', [id, userId]);
    });
    res.status(204).end();
  });

  return router;
}
