import { randomUUID, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import type { AppConfig } from '../../config/env.js';
import type { Db, Row } from '../../db/database.js';
import { SESSION_COOKIE, createSession, getAuth, requireAuth, sessionCookieOptions } from '../../middleware/auth.js';
import { HttpError } from '../../utils/errors.js';
import { hashPassword, verifyPassword } from '../../utils/password.js';
import { nowIso } from '../../utils/schemas.js';
import { parse } from '../../utils/validate.js';

export function toUser(row: Row) {
  return {
    id: String(row.id),
    email: String(row.email),
    displayName: (row.display_name as string | null) ?? null,
    timezone: String(row.timezone),
    preferences: {
      theme: String(row.theme) as 'light' | 'dark' | 'system',
      aiEnabled: Boolean(row.ai_enabled),
      defaultEditorMode: String(row.editor_mode) as 'distraction-free' | 'standard',
    },
  };
}

const password = z.string().min(10, 'Please use at least 10 characters.').max(200);
const timezone = z
  .string()
  .max(64)
  .refine((tz) => {
    try {
      new Intl.DateTimeFormat('en', { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, 'Unknown timezone');

const setupSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password,
  displayName: z.string().trim().max(80).optional(),
  timezone: timezone.optional(),
  setupToken: z.string().max(200).optional(),
});
const loginSchema = z.object({ email: z.string().trim().toLowerCase().max(200), password: z.string().max(200) });
const changePasswordSchema = z.object({ currentPassword: z.string().max(200), newPassword: password });
const profileSchema = z
  .object({
    displayName: z.string().trim().max(80).nullable(),
    timezone,
    theme: z.enum(['light', 'dark', 'system']),
    aiEnabled: z.boolean(),
    defaultEditorMode: z.enum(['distraction-free', 'standard']),
  })
  .partial();

// A fixed hash used to keep login timing similar when the email is unknown.
let dummyHash: Promise<string> | undefined;

export function authRouter(db: Db, config: AppConfig): Router {
  const router = Router();
  const limiter = rateLimit({
    windowMs: 15 * 60_000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => !config.rateLimitEnabled,
    message: { error: { code: 'rate_limited', message: 'Too many attempts. Please wait a little while and try again.' } },
  });

  const startSession = (res: import('express').Response, userId: string) => {
    const { token, csrfToken, ttlMs } = createSession(db, config, userId);
    res.cookie(SESSION_COOKIE, token, sessionCookieOptions(config, ttlMs));
    return csrfToken;
  };

  const findUser = (id: string) => db.prepare('SELECT * FROM users WHERE id = ?').get(id) as Row | undefined;

  router.get('/status', (_req, res) => {
    const { count } = db.prepare('SELECT COUNT(*) AS count FROM users').get() as { count: number };
    res.json({ setupRequired: count === 0, setupTokenRequired: count === 0 && config.setupToken !== null });
  });

  router.post('/setup', limiter, async (req, res) => {
    const body = parse(setupSchema, req.body);
    const { count } = db.prepare('SELECT COUNT(*) AS count FROM users').get() as { count: number };
    if (count > 0) throw new HttpError(409, 'already_set_up', 'This diary already has an owner.');
    if (config.setupToken) {
      const given = Buffer.from(body.setupToken ?? '');
      const expected = Buffer.from(config.setupToken);
      if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
        throw new HttpError(403, 'invalid_setup_token', 'That setup code is not right.');
      }
    }
    const id = randomUUID();
    const now = nowIso();
    db.prepare(
      `INSERT INTO users (id, email, password_hash, display_name, timezone, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, body.email, await hashPassword(body.password), body.displayName ?? null, body.timezone ?? 'UTC', now, now);
    const csrfToken = startSession(res, id);
    res.status(201).json({ user: toUser(findUser(id)!), csrfToken });
  });

  router.post('/login', limiter, async (req, res) => {
    const body = parse(loginSchema, req.body);
    const row = db.prepare('SELECT * FROM users WHERE email = ?').get(body.email) as Row | undefined;
    dummyHash ??= hashPassword('not-a-real-password');
    const valid = await verifyPassword(body.password, row ? String(row.password_hash) : await dummyHash);
    if (!row || !valid) throw new HttpError(401, 'invalid_credentials', 'That email and password do not match.');
    const csrfToken = startSession(res, String(row.id));
    res.json({ user: toUser(row), csrfToken });
  });

  router.post('/logout', requireAuth, (_req, res) => {
    const auth = getAuth(res);
    db.prepare('DELETE FROM sessions WHERE id = ?').run(auth.sessionId);
    res.clearCookie(SESSION_COOKIE, sessionCookieOptions(config));
    res.status(204).end();
  });

  router.get('/me', requireAuth, (_req, res) => {
    const auth = getAuth(res);
    const row = findUser(auth.userId);
    if (!row) throw new HttpError(401, 'unauthenticated', 'Please sign in to continue.');
    res.json({ user: toUser(row), csrfToken: auth.csrfToken });
  });

  router.patch('/profile', requireAuth, (req, res) => {
    const auth = getAuth(res);
    const body = parse(profileSchema, req.body);
    const current = findUser(auth.userId)!;
    db.prepare(
      `UPDATE users SET display_name = ?, timezone = ?, theme = ?, ai_enabled = ?, editor_mode = ?, updated_at = ? WHERE id = ?`,
    ).run(
      body.displayName !== undefined ? body.displayName || null : ((current.display_name as string | null) ?? null),
      body.timezone ?? String(current.timezone),
      body.theme ?? String(current.theme),
      body.aiEnabled !== undefined ? Number(body.aiEnabled) : Number(current.ai_enabled),
      body.defaultEditorMode ?? String(current.editor_mode),
      nowIso(),
      auth.userId,
    );
    res.json({ user: toUser(findUser(auth.userId)!) });
  });

  router.post('/change-password', requireAuth, limiter, async (req, res) => {
    const auth = getAuth(res);
    const body = parse(changePasswordSchema, req.body);
    const row = findUser(auth.userId)!;
    if (!(await verifyPassword(body.currentPassword, String(row.password_hash)))) {
      throw new HttpError(400, 'wrong_password', 'Your current password does not match.');
    }
    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(
      await hashPassword(body.newPassword),
      nowIso(),
      auth.userId,
    );
    db.prepare('DELETE FROM sessions WHERE user_id = ? AND id != ?').run(auth.userId, auth.sessionId);
    res.status(204).end();
  });

  return router;
}
