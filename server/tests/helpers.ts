import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { loadConfig, type AppConfig } from '../src/config/env.js';
import { type Db, createPgliteDb, migrate } from '../src/db/database.js';
import { hashPassword } from '../src/utils/password.js';

export const PASSWORD = 'a-long-gentle-password';

/** An in-memory Postgres that is created and migrated on first use, so tests can build the app synchronously. */
function lazyTestDb(): Db {
  let ready: Promise<Db> | undefined;
  const get = () => (ready ??= createPgliteDb().then(async (db) => (await migrate(db), db)));
  return {
    query: async (sql, params) => (await get()).query(sql, params),
    exec: async (sql) => (await get()).exec(sql),
    transaction: async (fn) => (await get()).transaction(fn),
    close: async () => (await get()).close(),
  };
}

export function buildTestApp(overrides: Partial<AppConfig> = {}) {
  const db = lazyTestDb();
  const config = loadConfig({ nodeEnv: 'test', clientDistPath: null, rateLimitEnabled: false, cookieSecure: false, setupToken: null, ...overrides });
  const app = createApp(db, config);
  return { app, db, config };
}

export interface Session {
  agent: ReturnType<typeof request.agent>;
  csrf: string;
  userId: string;
  post: (url: string, body?: object) => request.Test;
  patch: (url: string, body?: object) => request.Test;
  get: (url: string) => request.Test;
  del: (url: string, body?: object) => request.Test;
}

function wrap(app: Parameters<typeof request.agent>[0], csrf: string, userId: string): Session {
  const agent = request.agent(app);
  const s: Session = {
    agent,
    csrf,
    userId,
    post: (url, body = {}) => agent.post(`/api/v1${url}`).set('X-CSRF-Token', s.csrf).send(body),
    patch: (url, body = {}) => agent.patch(`/api/v1${url}`).set('X-CSRF-Token', s.csrf).send(body),
    get: (url) => agent.get(`/api/v1${url}`),
    del: (url, body = {}) => agent.delete(`/api/v1${url}`).set('X-CSRF-Token', s.csrf).send(body),
  };
  return s;
}

export async function signUpOwner(app: Parameters<typeof request.agent>[0], email = 'owner@example.com'): Promise<Session> {
  const session = wrap(app, '', '');
  const res = await session.agent.post('/api/v1/auth/setup').send({ email, password: PASSWORD, timezone: 'UTC' });
  if (res.status !== 201) throw new Error(`setup failed: ${res.status} ${JSON.stringify(res.body)}`);
  session.csrf = res.body.csrfToken;
  session.userId = res.body.user.id;
  return session;
}

export async function addUserAndSignIn(
  ctx: ReturnType<typeof buildTestApp>,
  email: string,
): Promise<Session> {
  const id = randomUUID();
  const now = new Date().toISOString();
  await ctx.db.query('INSERT INTO users (id, email, password_hash, created_at, updated_at) VALUES ($1, $2, $3, $4, $4)', [
    id,
    email,
    await hashPassword(PASSWORD),
    now,
  ]);
  const session = wrap(ctx.app, '', id);
  const res = await session.agent.post('/api/v1/auth/login').send({ email, password: PASSWORD });
  if (res.status !== 200) throw new Error(`login failed: ${res.status}`);
  session.csrf = res.body.csrfToken;
  return session;
}
