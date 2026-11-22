import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { type Db, type Row, one } from '../../db/database.js';
import { getAuth } from '../../middleware/auth.js';
import { notFound } from '../../utils/errors.js';
import { Filter } from '../../utils/filter.js';
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
    one(db, 'SELECT * FROM reflections WHERE id = $1 AND owner_id = $2', [id, ownerId]);

  router.get('/', async (req, res) => {
    const { userId } = getAuth(res);
    const q = parse(listQuery, req.query);
    const f = new Filter().add('owner_id = ?', userId);
    if (q.type) f.add('type = ?', q.type);
    const { total } = (await one<{ total: number }>(db, `SELECT COUNT(*)::int AS total FROM reflections WHERE ${f.clause}`, f.params))!;
    const limit = f.push(q.limit);
    const offset = f.push(q.offset);
    const rows = await db.query(
      `SELECT * FROM reflections WHERE ${f.clause} ORDER BY created_at DESC, id DESC LIMIT ${limit} OFFSET ${offset}`,
      f.params,
    );
    res.json({ items: rows.map(toReflection), total, limit: q.limit, offset: q.offset });
  });

  router.post('/', async (req, res) => {
    const { userId } = getAuth(res);
    const body = parse(createSchema, req.body);
    const id = randomUUID();
    const now = nowIso();
    await db.query(
      `INSERT INTO reflections (id, owner_id, type, title, prompt, response, period_start, period_end, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)`,
      [id, userId, body.type, body.title, body.prompt, body.response, body.periodStart, body.periodEnd, now],
    );
    res.status(201).json({ reflection: toReflection((await getRow(userId, id))!) });
  });

  router.patch('/:id', async (req, res) => {
    const { userId } = getAuth(res);
    const { id } = parse(idParam, req.params);
    const patch = parse(updateSchema, req.body);
    const row = await getRow(userId, id);
    if (!row) throw notFound('That reflection');
    const merged = { ...toReflection(row), ...patch };
    await db.query(
      `UPDATE reflections SET type = $1, title = $2, prompt = $3, response = $4, period_start = $5, period_end = $6, updated_at = $7
       WHERE id = $8 AND owner_id = $9`,
      [merged.type, merged.title, merged.prompt, merged.response, merged.periodStart, merged.periodEnd, nowIso(), id, userId],
    );
    res.json({ reflection: toReflection((await getRow(userId, id))!) });
  });

  router.delete('/:id', async (req, res) => {
    const { userId } = getAuth(res);
    const { id } = parse(idParam, req.params);
    if (!(await getRow(userId, id))) throw notFound('That reflection');
    await db.query('DELETE FROM reflections WHERE id = $1 AND owner_id = $2', [id, userId]);
    res.status(204).end();
  });

  return router;
}
