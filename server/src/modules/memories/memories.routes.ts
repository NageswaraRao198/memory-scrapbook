import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { type Db, type Row, one } from '../../db/database.js';
import { getAuth } from '../../middleware/auth.js';
import { HttpError, notFound } from '../../utils/errors.js';
import { Filter } from '../../utils/filter.js';
import { escapeLike, idParam, isoDate, nowIso, optionalText, pageQuery, parseJsonArray, tagList } from '../../utils/schemas.js';
import { parse } from '../../utils/validate.js';

export function toMemory(row: Row) {
  return {
    id: String(row.id),
    title: String(row.title),
    description: (row.description as string | null) ?? null,
    memoryDate: String(row.memory_date),
    tags: parseJsonArray(row.tags),
    peopleLabels: parseJsonArray(row.people_labels),
    locationLabel: (row.location_label as string | null) ?? null,
    linkedEntryId: (row.linked_entry_id as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

const fields = {
  title: z.string().trim().min(1, 'Give this moment a name.').max(200),
  description: optionalText(10_000),
  memoryDate: isoDate,
  tags: tagList(12),
  peopleLabels: tagList(12),
  locationLabel: optionalText(120),
  linkedEntryId: z.string().uuid().nullish().transform((v) => v ?? null),
};

const createSchema = z.object({ ...fields, memoryDate: fields.memoryDate.default(() => nowIso()) });
const updateSchema = z.object(fields).partial();

const listQuery = z.object({
  q: z.string().trim().max(200).optional(),
  year: z.coerce.number().int().min(1900).max(2200).optional(),
  tag: z.string().trim().max(40).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  ...pageQuery,
});

export function memoriesRouter(db: Db): Router {
  const router = Router();
  const getRow = (ownerId: string, id: string) =>
    one(db, 'SELECT * FROM memories WHERE id = $1 AND owner_id = $2', [id, ownerId]);
  const assertEntryOwned = async (ownerId: string, entryId: string | null | undefined) => {
    if (!entryId) return;
    if (!(await one(db, 'SELECT 1 FROM entries WHERE id = $1 AND owner_id = $2', [entryId, ownerId]))) {
      throw new HttpError(400, 'validation_error', 'That diary entry could not be found.');
    }
  };

  router.get('/', async (req, res) => {
    const { userId } = getAuth(res);
    const q = parse(listQuery, req.query);
    const f = new Filter().add('owner_id = ?', userId);
    if (q.q) {
      const like = `%${escapeLike(q.q)}%`;
      f.add("(title ILIKE ? ESCAPE '\\' OR description ILIKE ? ESCAPE '\\' OR location_label ILIKE ? ESCAPE '\\')", like, like, like);
    }
    if (q.year) f.add('substr(memory_date, 1, 4) = ?', String(q.year));
    if (q.tag) {
      f.add(
        `(EXISTS (SELECT 1 FROM jsonb_array_elements_text(memories.tags) AS v(value) WHERE lower(v.value) = lower(?))
          OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(memories.people_labels) AS v(value) WHERE lower(v.value) = lower(?)))`,
        q.tag,
        q.tag,
      );
    }
    if (q.from) f.add('memory_date >= ?', q.from);
    if (q.to) f.add('memory_date <= ?', q.to);
    const { total } = (await one<{ total: number }>(db, `SELECT COUNT(*)::int AS total FROM memories WHERE ${f.clause}`, f.params))!;
    const limit = f.push(q.limit);
    const offset = f.push(q.offset);
    const rows = await db.query(
      `SELECT * FROM memories WHERE ${f.clause} ORDER BY memory_date DESC, id DESC LIMIT ${limit} OFFSET ${offset}`,
      f.params,
    );
    const years = (
      await db.query<{ year: string }>(
        'SELECT DISTINCT substr(memory_date, 1, 4) AS year FROM memories WHERE owner_id = $1 ORDER BY year DESC',
        [userId],
      )
    ).map((r) => Number(r.year));
    const tags = (
      await db.query<{ value: string }>(
        `SELECT value FROM (
           SELECT v.value AS value FROM memories, jsonb_array_elements_text(memories.tags) AS v(value) WHERE owner_id = $1
           UNION
           SELECT v.value AS value FROM memories, jsonb_array_elements_text(memories.people_labels) AS v(value) WHERE owner_id = $1
         ) t ORDER BY lower(value), value`,
        [userId],
      )
    ).map((r) => r.value);
    res.json({ items: rows.map(toMemory), total, limit: q.limit, offset: q.offset, facets: { years, tags } });
  });

  router.post('/', async (req, res) => {
    const { userId } = getAuth(res);
    const body = parse(createSchema, req.body);
    await assertEntryOwned(userId, body.linkedEntryId);
    const id = randomUUID();
    const now = nowIso();
    await db.query(
      `INSERT INTO memories (id, owner_id, title, description, memory_date, tags, people_labels, location_label, linked_entry_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10, $10)`,
      [id, userId, body.title, body.description, body.memoryDate, JSON.stringify(body.tags), JSON.stringify(body.peopleLabels), body.locationLabel, body.linkedEntryId, now],
    );
    res.status(201).json({ memory: toMemory((await getRow(userId, id))!) });
  });

  router.get('/:id', async (req, res) => {
    const { userId } = getAuth(res);
    const { id } = parse(idParam, req.params);
    const row = await getRow(userId, id);
    if (!row) throw notFound('That memory');
    res.json({ memory: toMemory(row) });
  });

  router.patch('/:id', async (req, res) => {
    const { userId } = getAuth(res);
    const { id } = parse(idParam, req.params);
    const patch = parse(updateSchema, req.body);
    const row = await getRow(userId, id);
    if (!row) throw notFound('That memory');
    await assertEntryOwned(userId, patch.linkedEntryId);
    const merged = { ...toMemory(row), ...patch };
    await db.query(
      `UPDATE memories SET title = $1, description = $2, memory_date = $3, tags = $4::jsonb, people_labels = $5::jsonb, location_label = $6,
       linked_entry_id = $7, updated_at = $8 WHERE id = $9 AND owner_id = $10`,
      [merged.title, merged.description, merged.memoryDate, JSON.stringify(merged.tags), JSON.stringify(merged.peopleLabels), merged.locationLabel, merged.linkedEntryId, nowIso(), id, userId],
    );
    res.json({ memory: toMemory((await getRow(userId, id))!) });
  });

  router.delete('/:id', async (req, res) => {
    const { userId } = getAuth(res);
    const { id } = parse(idParam, req.params);
    if (!(await getRow(userId, id))) throw notFound('That memory');
    await db.query('DELETE FROM memories WHERE id = $1 AND owner_id = $2', [id, userId]);
    res.status(204).end();
  });

  return router;
}
