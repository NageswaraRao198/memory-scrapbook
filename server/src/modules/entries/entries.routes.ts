import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { type Db, type Row, transaction } from '../../db/database.js';
import { getAuth } from '../../middleware/auth.js';
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
    db.prepare('SELECT * FROM entries WHERE id = ? AND owner_id = ?').get(id, ownerId) as Row | undefined;

  router.get('/', (_req, res) => {
    const { userId } = getAuth(res);
    const q = parse(listQuery, _req.query);
    const where = ['owner_id = ?'];
    const params: (string | number)[] = [userId];
    if (q.q) {
      where.push("(title LIKE ? ESCAPE '\\' OR body LIKE ? ESCAPE '\\')");
      const like = `%${escapeLike(q.q)}%`;
      params.push(like, like);
    }
    const add = (clause: string, value: string) => {
      where.push(clause);
      params.push(value);
    };
    if (q.from) add('entry_date >= ?', q.from);
    if (q.to) add('entry_date <= ?', q.to);
    if (q.mood) add('mood = ?', q.mood);
    if (q.emotion) {
      where.push('EXISTS (SELECT 1 FROM json_each(entries.emotions) WHERE lower(value) = lower(?))');
      params.push(q.emotion);
    }
    if (q.tag) {
      where.push('EXISTS (SELECT 1 FROM json_each(entries.context_tags) WHERE lower(value) = lower(?))');
      params.push(q.tag);
    }
    if (q.drafts === 'exclude') where.push('is_draft = 0');
    if (q.drafts === 'only') where.push('is_draft = 1');
    const clause = where.join(' AND ');
    const dir = q.sort === 'oldest' ? 'ASC' : 'DESC';
    const { total } = db.prepare(`SELECT COUNT(*) AS total FROM entries WHERE ${clause}`).get(...params) as {
      total: number;
    };
    const rows = db
      .prepare(`SELECT * FROM entries WHERE ${clause} ORDER BY entry_date ${dir}, id ${dir} LIMIT ? OFFSET ?`)
      .all(...params, q.limit, q.offset) as Row[];
    res.json({ items: rows.map(toEntry), total, limit: q.limit, offset: q.offset });
  });

  router.get('/facets', (_req, res) => {
    const { userId } = getAuth(res);
    const distinct = (column: string) =>
      (
        db
          .prepare(
            `SELECT DISTINCT value FROM entries, json_each(entries.${column}) WHERE owner_id = ? ORDER BY lower(value)`,
          )
          .all(userId) as { value: string }[]
      ).map((r) => r.value);
    const moods = (
      db.prepare('SELECT DISTINCT mood FROM entries WHERE owner_id = ? AND mood IS NOT NULL ORDER BY mood').all(userId) as {
        mood: string;
      }[]
    ).map((r) => r.mood);
    res.json({ moods, emotions: distinct('emotions'), contextTags: distinct('context_tags') });
  });

  router.get('/on-this-day', (req, res) => {
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
    const rows = db
      .prepare('SELECT * FROM entries WHERE owner_id = ? AND is_draft = 0 ORDER BY entry_date DESC')
      .all(userId) as Row[];
    const match = rows.find((r) => {
      const local = formatter.format(new Date(String(r.entry_date)));
      return local.slice(5) === monthDay && local.slice(0, 4) !== year;
    });
    res.json({ entry: match ? toEntry(match) : null });
  });

  router.post('/', (req, res) => {
    const { userId } = getAuth(res);
    const body = parse(createSchema, req.body);
    assertWritable(body);
    const id = randomUUID();
    const now = nowIso();
    transaction(db, () => {
      db.prepare(
        `INSERT INTO entries (id, owner_id, title, body, body_format, entry_date, mood, emotions, intensity, context_tags, is_draft, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
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
        Number(body.isDraft),
        now,
        now,
      );
      syncEntryMood(db, userId, { id, entryDate: body.entryDate, mood: body.mood, emotions: body.emotions, intensity: body.intensity });
    });
    res.status(201).json({ entry: toEntry(getRow(userId, id)!) });
  });

  router.get('/:id', (req, res) => {
    const { userId } = getAuth(res);
    const { id } = parse(idParam, req.params);
    const row = getRow(userId, id);
    if (!row) throw notFound('That entry');
    res.json({ entry: toEntry(row) });
  });

  router.patch('/:id', (req, res) => {
    const { userId } = getAuth(res);
    const { id } = parse(idParam, req.params);
    const patch = parse(updateSchema, req.body);
    const row = getRow(userId, id);
    if (!row) throw notFound('That entry');
    const merged = { ...toEntry(row), ...patch };
    assertWritable(merged);
    transaction(db, () => {
      db.prepare(
        `UPDATE entries SET title = ?, body = ?, body_format = ?, entry_date = ?, mood = ?, emotions = ?, intensity = ?,
         context_tags = ?, is_draft = ?, updated_at = ? WHERE id = ? AND owner_id = ?`,
      ).run(
        merged.title,
        merged.body,
        merged.bodyFormat,
        merged.entryDate,
        merged.mood,
        JSON.stringify(merged.emotions),
        merged.intensity,
        JSON.stringify(merged.contextTags),
        Number(merged.isDraft),
        nowIso(),
        id,
        userId,
      );
      syncEntryMood(db, userId, merged);
    });
    res.json({ entry: toEntry(getRow(userId, id)!) });
  });

  router.delete('/:id', (req, res) => {
    const { userId } = getAuth(res);
    const { id } = parse(idParam, req.params);
    if (!getRow(userId, id)) throw notFound('That entry');
    transaction(db, () => {
      db.prepare("DELETE FROM mood_checkins WHERE owner_id = ? AND linked_entry_id = ? AND source = 'entry'").run(userId, id);
      db.prepare('DELETE FROM entries WHERE id = ? AND owner_id = ?').run(id, userId);
    });
    res.status(204).end();
  });

  return router;
}
