import { randomUUID, timingSafeEqual } from 'node:crypto';
import { type Response, Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import type { AppConfig } from '../../config/env.js';
import { type Db, type Row, one } from '../../db/database.js';
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
    hasPin: Boolean(row.pin_hash),
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

const pin = z.string().regex(/^\d{6}$/, 'The PIN must be exactly 6 digits.');

const setupSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password,
  pin,
  displayName: z.string().trim().max(80).optional(),
  timezone: timezone.optional(),
  setupToken: z.string().max(200).optional(),
});
const loginSchema = z.object({
  email: z.string().trim().toLowerCase().max(200),
  password: z.string().max(200),
  pin: z.string().max(20).optional(),
});
const changePasswordSchema = z.object({ currentPassword: z.string().max(200), newPassword: password });
const changePinSchema = z.object({
  currentPassword: z.string().max(200),
  currentPin: z.string().max(20).optional(),
  newPin: pin,
});
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

  const startSession = async (res: Response, userId: string) => {
    const { token, csrfToken, ttlMs } = await createSession(db, config, userId);
    res.cookie(SESSION_COOKIE, token, sessionCookieOptions(config, ttlMs));
    return csrfToken;
  };

  const findUser = (id: string) => one(db, 'SELECT * FROM users WHERE id = $1', [id]);
  const userCount = async () => (await one<{ count: number }>(db, 'SELECT COUNT(*)::int AS count FROM users'))!.count;

  router.get('/status', async (_req, res) => {
    const setupRequired = (await userCount()) === 0;
    res.json({ setupRequired, setupTokenRequired: setupRequired && config.setupToken !== null });
  });

  router.post('/setup', limiter, async (req, res) => {
    const body = parse(setupSchema, req.body);
    if ((await userCount()) > 0) throw new HttpError(409, 'already_set_up', 'This diary already has an owner.');
    if (config.setupToken) {
      const given = Buffer.from(body.setupToken ?? '');
      const expected = Buffer.from(config.setupToken);
      if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
        throw new HttpError(403, 'invalid_setup_token', 'That setup code is not right.');
      }
    }
    const id = randomUUID();
    const now = nowIso();
    await db.query(
      `INSERT INTO users (id, email, password_hash, pin_hash, display_name, timezone, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7)`,
      [id, body.email, await hashPassword(body.password), await hashPassword(body.pin), body.displayName ?? null, body.timezone ?? 'UTC', now],
    );
    const csrfToken = await startSession(res, id);
    res.status(201).json({ user: toUser((await findUser(id))!), csrfToken });
  });

  router.post('/login', limiter, async (req, res) => {
    const body = parse(loginSchema, req.body);
    const row = await one(db, 'SELECT * FROM users WHERE email = $1', [body.email]);
    dummyHash ??= hashPassword('not-a-real-password');
    const passwordOk = await verifyPassword(body.password, row ? String(row.password_hash) : await dummyHash);
    // Accounts created before PINs existed (no pin_hash) can still sign in, then set a PIN in Settings.
    const pinOk = row?.pin_hash ? await verifyPassword(body.pin ?? '', String(row.pin_hash)) : true;
    if (!row || !passwordOk || !pinOk) {
      throw new HttpError(401, 'invalid_credentials', 'That email, password and PIN do not match.');
    }
    const csrfToken = await startSession(res, String(row.id));
    res.json({ user: toUser(row), csrfToken });
  });

  router.post('/logout', requireAuth, async (_req, res) => {
    const auth = getAuth(res);
    await db.query('DELETE FROM sessions WHERE id = $1', [auth.sessionId]);
    res.clearCookie(SESSION_COOKIE, sessionCookieOptions(config));
    res.status(204).end();
  });

  router.get('/me', requireAuth, async (_req, res) => {
    const auth = getAuth(res);
    const row = await findUser(auth.userId);
    if (!row) throw new HttpError(401, 'unauthenticated', 'Please sign in to continue.');
    res.json({ user: toUser(row), csrfToken: auth.csrfToken });
  });

  router.patch('/profile', requireAuth, async (req, res) => {
    const auth = getAuth(res);
    const body = parse(profileSchema, req.body);
    const current = (await findUser(auth.userId))!;
    await db.query(
      `UPDATE users SET display_name = $1, timezone = $2, theme = $3, ai_enabled = $4, editor_mode = $5, updated_at = $6 WHERE id = $7`,
      [
        body.displayName !== undefined ? body.displayName || null : ((current.display_name as string | null) ?? null),
        body.timezone ?? String(current.timezone),
        body.theme ?? String(current.theme),
        body.aiEnabled ?? Boolean(current.ai_enabled),
        body.defaultEditorMode ?? String(current.editor_mode),
        nowIso(),
        auth.userId,
      ],
    );
    res.json({ user: toUser((await findUser(auth.userId))!) });
  });

  router.post('/change-password', requireAuth, limiter, async (req, res) => {
    const auth = getAuth(res);
    const body = parse(changePasswordSchema, req.body);
    const row = (await findUser(auth.userId))!;
    if (!(await verifyPassword(body.currentPassword, String(row.password_hash)))) {
      throw new HttpError(400, 'wrong_password', 'Your current password does not match.');
    }
    await db.query('UPDATE users SET password_hash = $1, updated_at = $2 WHERE id = $3', [
      await hashPassword(body.newPassword),
      nowIso(),
      auth.userId,
    ]);
    await db.query('DELETE FROM sessions WHERE user_id = $1 AND id != $2', [auth.userId, auth.sessionId]);
    res.status(204).end();
  });

  router.post('/change-pin', requireAuth, limiter, async (req, res) => {
    const auth = getAuth(res);
    const body = parse(changePinSchema, req.body);
    const row = (await findUser(auth.userId))!;
    const passwordOk = await verifyPassword(body.currentPassword, String(row.password_hash));
    const pinOk = row.pin_hash ? await verifyPassword(body.currentPin ?? '', String(row.pin_hash)) : true;
    if (!passwordOk || !pinOk) throw new HttpError(400, 'wrong_credentials', 'Your current password or PIN does not match.');
    await db.query('UPDATE users SET pin_hash = $1, updated_at = $2 WHERE id = $3', [
      await hashPassword(body.newPin),
      nowIso(),
      auth.userId,
    ]);
    await db.query('DELETE FROM sessions WHERE user_id = $1 AND id != $2', [auth.userId, auth.sessionId]);
    res.status(204).end();
  });

  return router;
}
