import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import type { Db, Row } from '../../db/database.js';
import { getAuth } from '../../middleware/auth.js';
import { HttpError, notFound } from '../../utils/errors.js';
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
    db.prepare('SELECT * FROM memories WHERE id = ? AND owner_id = ?').get(id, ownerId) as Row | undefined;
  const assertEntryOwned = (ownerId: string, entryId: string | null | undefined) => {
    if (!entryId) return;
    if (!db.prepare('SELECT 1 FROM entries WHERE id = ? AND owner_id = ?').get(entryId, ownerId)) {
      throw new HttpError(400, 'validation_error', 'That diary entry could not be found.');
    }
  };

  router.get('/', (req, res) => {
    const { userId } = getAuth(res);
    const q = parse(listQuery, req.query);
    const where = ['owner_id = ?'];
    const params: (string | number)[] = [userId];
    if (q.q) {
      const like = `%${escapeLike(q.q)}%`;
      where.push("(title LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\' OR location_label LIKE ? ESCAPE '\\')");
      params.push(like, like, like);
    }
    if (q.year) {
      where.push('substr(memory_date, 1, 4) = ?');
      params.push(String(q.year));
    }
    if (q.tag) {
      where.push(
        `(EXISTS (SELECT 1 FROM json_each(memories.tags) WHERE lower(value) = lower(?))
          OR EXISTS (SELECT 1 FROM json_each(memories.people_labels) WHERE lower(value) = lower(?)))`,
      );
      params.push(q.tag, q.tag);
    }
    if (q.from) {
      where.push('memory_date >= ?');
      params.push(q.from);
    }
    if (q.to) {
      where.push('memory_date <= ?');
      params.push(q.to);
    }
    const clause = where.join(' AND ');
    const { total } = db.prepare(`SELECT COUNT(*) AS total FROM memories WHERE ${clause}`).get(...params) as { total: number };
    const rows = db
      .prepare(`SELECT * FROM memories WHERE ${clause} ORDER BY memory_date DESC, id DESC LIMIT ? OFFSET ?`)
      .all(...params, q.limit, q.offset) as Row[];
    const years = (
      db
        .prepare('SELECT DISTINCT substr(memory_date, 1, 4) AS year FROM memories WHERE owner_id = ? ORDER BY year DESC')
        .all(userId) as { year: string }[]
    ).map((r) => Number(r.year));
    const tags = (
      db
        .prepare(
          `SELECT DISTINCT value FROM (
             SELECT value FROM memories, json_each(memories.tags) WHERE owner_id = ?1
             UNION SELECT value FROM memories, json_each(memories.people_labels) WHERE owner_id = ?1
           ) ORDER BY lower(value)`,
        )
        .all(userId) as { value: string }[]
    ).map((r) => r.value);
    res.json({ items: rows.map(toMemory), total, limit: q.limit, offset: q.offset, facets: { years, tags } });
  });

  router.post('/', (req, res) => {
    const { userId } = getAuth(res);
    const body = parse(createSchema, req.body);
    assertEntryOwned(userId, body.linkedEntryId);
    const id = randomUUID();
    const now = nowIso();
    db.prepare(
      `INSERT INTO memories (id, owner_id, title, description, memory_date, tags, people_labels, location_label, linked_entry_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, userId, body.title, body.description, body.memoryDate, JSON.stringify(body.tags), JSON.stringify(body.peopleLabels), body.locationLabel, body.linkedEntryId, now, now);
    res.status(201).json({ memory: toMemory(getRow(userId, id)!) });
  });

  router.get('/:id', (req, res) => {
    const { userId } = getAuth(res);
    const { id } = parse(idParam, req.params);
    const row = getRow(userId, id);
    if (!row) throw notFound('That memory');
    res.json({ memory: toMemory(row) });
  });

  router.patch('/:id', (req, res) => {
    const { userId } = getAuth(res);
    const { id } = parse(idParam, req.params);
    const patch = parse(updateSchema, req.body);
    const row = getRow(userId, id);
    if (!row) throw notFound('That memory');
    assertEntryOwned(userId, patch.linkedEntryId);
    const merged = { ...toMemory(row), ...patch };
    db.prepare(
      `UPDATE memories SET title = ?, description = ?, memory_date = ?, tags = ?, people_labels = ?, location_label = ?,
       linked_entry_id = ?, updated_at = ? WHERE id = ? AND owner_id = ?`,
    ).run(merged.title, merged.description, merged.memoryDate, JSON.stringify(merged.tags), JSON.stringify(merged.peopleLabels), merged.locationLabel, merged.linkedEntryId, nowIso(), id, userId);
    res.json({ memory: toMemory(getRow(userId, id)!) });
  });

  router.delete('/:id', (req, res) => {
    const { userId } = getAuth(res);
    const { id } = parse(idParam, req.params);
    if (!getRow(userId, id)) throw notFound('That memory');
    db.prepare('DELETE FROM memories WHERE id = ? AND owner_id = ?').run(id, userId);
    res.status(204).end();
  });

  return router;
}
