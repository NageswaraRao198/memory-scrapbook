import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { AppConfig } from '../config/env.js';
import type { Db, Row } from '../db/database.js';
import { HttpError } from '../utils/errors.js';

export const SESSION_COOKIE = 'scrapbook.sid';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export interface AuthContext {
  userId: string;
  sessionId: string;
  csrfToken: string;
}

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export function getAuth(res: Response): AuthContext {
  const auth = res.locals.auth as AuthContext | undefined;
  if (!auth) throw new HttpError(401, 'unauthenticated', 'Please sign in to continue.');
  return auth;
}

export function sessionCookieOptions(config: AppConfig, maxAgeMs?: number) {
  return {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'strict' as const,
    path: '/',
    ...(maxAgeMs ? { maxAge: maxAgeMs } : {}),
  };
}

export function createSession(db: Db, config: AppConfig, userId: string) {
  const token = randomBytes(32).toString('base64url');
  const csrfToken = randomBytes(24).toString('base64url');
  const now = new Date();
  const ttlMs = config.sessionTtlDays * 86_400_000;
  db.prepare(
    'INSERT INTO sessions (id, user_id, csrf_token, created_at, expires_at) VALUES (?, ?, ?, ?, ?)',
  ).run(hashToken(token), userId, csrfToken, now.toISOString(), new Date(now.getTime() + ttlMs).toISOString());
  return { token, csrfToken, ttlMs };
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Reject cross-site state-changing requests based on the Origin header. */
export function originCheck(config: AppConfig) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (SAFE_METHODS.has(req.method)) return next();
    const origin = req.get('origin');
    if (origin) {
      let sameHost = false;
      try {
        sameHost = new URL(origin).host === req.get('host');
      } catch {
        /* invalid origin falls through to rejection */
      }
      if (!sameHost && !config.allowedOrigins.includes(origin)) {
        return next(new HttpError(403, 'forbidden_origin', 'This request came from an unexpected place.'));
      }
    }
    next();
  };
}

export function loadSession(db: Db, config: AppConfig) {
  return (req: Request, res: Response, next: NextFunction) => {
    const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
    if (!token) return next();
    const id = hashToken(token);
    const row = db.prepare('SELECT user_id, csrf_token, expires_at FROM sessions WHERE id = ?').get(id) as
      | Row
      | undefined;
    if (!row) return next();
    const expiresAt = new Date(String(row.expires_at));
    if (expiresAt.getTime() <= Date.now()) {
      db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
      res.clearCookie(SESSION_COOKIE, sessionCookieOptions(config));
      return next();
    }
    const ttlMs = config.sessionTtlDays * 86_400_000;
    if (expiresAt.getTime() - Date.now() < ttlMs / 2) {
      const renewed = new Date(Date.now() + ttlMs);
      db.prepare('UPDATE sessions SET expires_at = ? WHERE id = ?').run(renewed.toISOString(), id);
      res.cookie(SESSION_COOKIE, token, sessionCookieOptions(config, ttlMs));
    }
    res.locals.auth = { userId: String(row.user_id), sessionId: id, csrfToken: String(row.csrf_token) } satisfies AuthContext;
    next();
  };
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const auth = res.locals.auth as AuthContext | undefined;
  if (!auth) return next(new HttpError(401, 'unauthenticated', 'Please sign in to continue.'));
  if (!SAFE_METHODS.has(req.method)) {
    const header = req.get('x-csrf-token') ?? '';
    if (!safeEqual(header, auth.csrfToken)) {
      return next(new HttpError(403, 'csrf_failed', 'Your session needs a refresh. Please reload the page.'));
    }
  }
  next();
}
