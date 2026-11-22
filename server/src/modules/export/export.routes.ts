import { randomUUID } from 'node:crypto';
import { readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Router } from 'express';
import { z } from 'zod';
import type { AppConfig } from '../../config/env.js';
import { type Db, type Row, transaction } from '../../db/database.js';
import { SESSION_COOKIE, getAuth, sessionCookieOptions } from '../../middleware/auth.js';
import { parse } from '../../utils/validate.js';
import { toEntry } from '../entries/entries.routes.js';
import { toMemory } from '../memories/memories.routes.js';
import { toMoodCheckIn } from '../moods/mood.service.js';
import { toReflection } from '../reflections/reflections.routes.js';

const exportQuery = z.object({ format: z.enum(['json', 'markdown']).default('json') });
const deleteSchema = z.object({ confirm: z.literal('DELETE'), deleteAccount: z.boolean().default(false) });

function loadAll(db: Db, ownerId: string) {
  const all = (table: string, order: string) =>
    db.prepare(`SELECT * FROM ${table} WHERE owner_id = ? ORDER BY ${order}`).all(ownerId) as Row[];
  return {
    entries: all('entries', 'entry_date ASC').map(toEntry),
    moodCheckIns: all('mood_checkins', 'recorded_at ASC').map(toMoodCheckIn),
    memories: all('memories', 'memory_date ASC').map(toMemory),
    reflections: all('reflections', 'created_at ASC').map(toReflection),
  };
}

type ExportData = ReturnType<typeof loadAll>;

export function renderMarkdown(data: ExportData, exportedAt: string): string {
  const lines: string[] = ['# The Memory Scrapbook - export', '', `Exported on ${exportedAt}`, ''];
  const day = (iso: string) => iso.slice(0, 10);

  lines.push('## Diary entries', '');
  if (!data.entries.length) lines.push('_No entries yet._', '');
  for (const e of data.entries) {
    lines.push(`### ${day(e.entryDate)} - ${e.title ?? 'Untitled'}${e.isDraft ? ' (draft)' : ''}`, '');
    const meta = [
      e.mood && `Mood: ${e.mood}`,
      e.intensity && `Intensity: ${e.intensity}/5`,
      e.emotions.length && `Emotions: ${e.emotions.join(', ')}`,
      e.contextTags.length && `Tags: ${e.contextTags.join(', ')}`,
    ].filter(Boolean);
    if (meta.length) lines.push(`*${meta.join(' | ')}*`, '');
    lines.push(e.body, '');
  }

  lines.push('## Memories', '');
  if (!data.memories.length) lines.push('_No memories yet._', '');
  for (const m of data.memories) {
    lines.push(`### ${day(m.memoryDate)} - ${m.title}`, '');
    const meta = [
      m.locationLabel && `Place: ${m.locationLabel}`,
      m.peopleLabels.length && `People: ${m.peopleLabels.join(', ')}`,
      m.tags.length && `Tags: ${m.tags.join(', ')}`,
    ].filter(Boolean);
    if (meta.length) lines.push(`*${meta.join(' | ')}*`, '');
    if (m.description) lines.push(m.description, '');
  }

  lines.push('## Reflections', '');
  if (!data.reflections.length) lines.push('_No reflections yet._', '');
  for (const r of data.reflections) {
    lines.push(`### ${day(r.createdAt)} - ${r.title ?? r.type}`, '');
    if (r.prompt) lines.push(`> ${r.prompt}`, '');
    lines.push(r.response, '');
  }

  lines.push('## Mood check-ins', '');
  if (!data.moodCheckIns.length) lines.push('_No check-ins yet._', '');
  for (const c of data.moodCheckIns) {
    const bits = [c.mood, c.intensity && `intensity ${c.intensity}/5`, c.emotions.length && c.emotions.join(', '), c.note].filter(Boolean);
    lines.push(`- ${day(c.recordedAt)}: ${bits.join(' - ')}`);
  }
  lines.push('');
  return lines.join('\n');
}

export function exportRouter(db: Db, config: AppConfig): Router {
  const router = Router();

  router.get('/export', (req, res) => {
    const { userId } = getAuth(res);
    const { format } = parse(exportQuery, req.query);
    const exportedAt = new Date().toISOString();
    const data = loadAll(db, userId);
    res.setHeader('Cache-Control', 'no-store');
    const stamp = exportedAt.slice(0, 10);
    if (format === 'markdown') {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="memory-scrapbook-${stamp}.md"`);
      res.send(renderMarkdown(data, exportedAt));
      return;
    }
    res.setHeader('Content-Disposition', `attachment; filename="memory-scrapbook-${stamp}.json"`);
    res.json({ app: 'memory-scrapbook', version: 1, exportedAt, ...data });
  });

  router.get('/export/backup', async (_req, res) => {
    getAuth(res);
    const target = path.join(tmpdir(), `scrapbook-backup-${randomUUID()}.db`);
    try {
      db.exec(`VACUUM INTO '${target.replaceAll("'", "''")}'`);
      const file = await readFile(target);
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="memory-scrapbook-backup-${new Date().toISOString().slice(0, 10)}.db"`);
      res.send(file);
    } finally {
      await rm(target, { force: true });
    }
  });

  router.delete('/account/data', (req, res) => {
    const { userId } = getAuth(res);
    const body = parse(deleteSchema, req.body);
    transaction(db, () => {
      for (const table of ['mood_checkins', 'memories', 'reflections', 'entries']) {
        db.prepare(`DELETE FROM ${table} WHERE owner_id = ?`).run(userId);
      }
      if (body.deleteAccount) {
        db.prepare('DELETE FROM users WHERE id = ?').run(userId);
      }
    });
    if (body.deleteAccount) res.clearCookie(SESSION_COOKIE, sessionCookieOptions(config));
    res.status(204).end();
  });

  return router;
}
