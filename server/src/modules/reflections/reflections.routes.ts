import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import type { Db, Row } from '../../db/database.js';
import { getAuth } from '../../middleware/auth.js';
import { notFound } from '../../utils/errors.js';
import { idParam, isoDate, nowIso, optionalText, pageQuery } from '../../utils/schemas.js';
import { parse } from '../../utils/validate.js';

export const REFLECTION_TYPES = ['daily', 'weekly', 'monthly', 'future-letter', 'learned', 'carrying', 'custom'] as const;

export function toReflection(row: Row) {
  return {
    id: String(row.id),
    type: String(row.type) as (typeof REFLECTION_TYPES)[number],
    title: (row.title as string | null) ?? null,
    prompt: (row.prompt as string | null) ?? null,
    response: String(row.response),
    periodStart: (row.period_start as string | null) ?? null,
    periodEnd: (row.period_end as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

const optionalDate = isoDate.nullish().transform((v) => v ?? null);

const fields = {
  type: z.enum(REFLECTION_TYPES),
  title: optionalText(200),
  prompt: optionalText(500),
  response: z.string().trim().min(1, 'Write a few words, or skip this one.').max(100_000),
  periodStart: optionalDate,
  periodEnd: optionalDate,
};

const createSchema = z.object(fields);
const updateSchema = z.object(fields).partial();
const listQuery = z.object({ type: z.enum(REFLECTION_TYPES).optional(), ...pageQuery });

export function reflectionsRouter(db: Db): Router {
  const router = Router();
  const getRow = (ownerId: string, id: string) =>
    db.prepare('SELECT * FROM reflections WHERE id = ? AND owner_id = ?').get(id, ownerId) as Row | undefined;

  router.get('/', (req, res) => {
    const { userId } = getAuth(res);
    const q = parse(listQuery, req.query);
    const where = ['owner_id = ?'];
    const params: (string | number)[] = [userId];
    if (q.type) {
      where.push('type = ?');
      params.push(q.type);
    }
    const clause = where.join(' AND ');
    const { total } = db.prepare(`SELECT COUNT(*) AS total FROM reflections WHERE ${clause}`).get(...params) as { total: number };
    const rows = db
      .prepare(`SELECT * FROM reflections WHERE ${clause} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`)
      .all(...params, q.limit, q.offset) as Row[];
    res.json({ items: rows.map(toReflection), total, limit: q.limit, offset: q.offset });
  });

  router.post('/', (req, res) => {
    const { userId } = getAuth(res);
    const body = parse(createSchema, req.body);
    const id = randomUUID();
    const now = nowIso();
    db.prepare(
      `INSERT INTO reflections (id, owner_id, type, title, prompt, response, period_start, period_end, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, userId, body.type, body.title, body.prompt, body.response, body.periodStart, body.periodEnd, now, now);
    res.status(201).json({ reflection: toReflection(getRow(userId, id)!) });
  });

  router.patch('/:id', (req, res) => {
    const { userId } = getAuth(res);
    const { id } = parse(idParam, req.params);
    const patch = parse(updateSchema, req.body);
    const row = getRow(userId, id);
    if (!row) throw notFound('That reflection');
    const merged = { ...toReflection(row), ...patch };
    db.prepare(
      `UPDATE reflections SET type = ?, title = ?, prompt = ?, response = ?, period_start = ?, period_end = ?, updated_at = ?
       WHERE id = ? AND owner_id = ?`,
    ).run(merged.type, merged.title, merged.prompt, merged.response, merged.periodStart, merged.periodEnd, nowIso(), id, userId);
    res.json({ reflection: toReflection(getRow(userId, id)!) });
  });

  router.delete('/:id', (req, res) => {
    const { userId } = getAuth(res);
    const { id } = parse(idParam, req.params);
    if (!getRow(userId, id)) throw notFound('That reflection');
    db.prepare('DELETE FROM reflections WHERE id = ? AND owner_id = ?').run(id, userId);
    res.status(204).end();
  });

  return router;
}
