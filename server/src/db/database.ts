import pg from 'pg';

export type Row = Record<string, unknown>;

export interface Queryable {
  query<T extends Row = Row>(sql: string, params?: unknown[]): Promise<T[]>;
}

export interface Db extends Queryable {
  exec(sql: string): Promise<void>;
  transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export async function one<T extends Row = Row>(q: Queryable, sql: string, params?: unknown[]): Promise<T | undefined> {
  return (await q.query<T>(sql, params))[0];
}

// Dates are stored as UTC ISO-8601 text ("2025-03-04T10:00:00.000Z"): they sort and compare correctly as strings.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  theme TEXT NOT NULL DEFAULT 'light',
  ai_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  editor_mode TEXT NOT NULL DEFAULT 'standard',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf_token TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS entries (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  body TEXT NOT NULL DEFAULT '',
  body_format TEXT NOT NULL DEFAULT 'markdown',
  entry_date TEXT NOT NULL,
  mood TEXT,
  emotions JSONB NOT NULL DEFAULT '[]'::jsonb,
  intensity INTEGER,
  context_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_draft BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_entries_owner_date ON entries(owner_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_entries_owner_mood ON entries(owner_id, mood);

CREATE TABLE IF NOT EXISTS mood_checkins (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recorded_at TEXT NOT NULL,
  mood TEXT NOT NULL,
  emotions JSONB NOT NULL DEFAULT '[]'::jsonb,
  intensity INTEGER,
  note TEXT,
  linked_entry_id TEXT REFERENCES entries(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'checkin',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_moods_owner_date ON mood_checkins(owner_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_moods_entry ON mood_checkins(linked_entry_id);

CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  memory_date TEXT NOT NULL,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  people_labels JSONB NOT NULL DEFAULT '[]'::jsonb,
  location_label TEXT,
  linked_entry_id TEXT REFERENCES entries(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_memories_owner_date ON memories(owner_id, memory_date DESC);

CREATE TABLE IF NOT EXISTS reflections (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT,
  prompt TEXT,
  response TEXT NOT NULL,
  period_start TEXT,
  period_end TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reflections_owner_created ON reflections(owner_id, created_at DESC);
`;

export async function migrate(db: Db): Promise<void> {
  await db.exec(SCHEMA);
}

/** A hosted Postgres database (for example Neon). */
export function createPgDb(connectionString: string): Db {
  const pool = new pg.Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 20_000,
  });
  // An idle connection can be dropped by the host (e.g. scale-to-zero); the pool replaces it.
  pool.on('error', () => console.error('Database connection error (will reconnect)'));

  return {
    async query<T extends Row = Row>(sql: string, params?: unknown[]) {
      return (await pool.query(sql, params)).rows as T[];
    },
    async exec(sql) {
      await pool.query(sql);
    },
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn({
          query: async <T extends Row = Row>(sql: string, params?: unknown[]) => (await client.query(sql, params)).rows as T[],
        });
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw err;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}

/** An embedded Postgres (PGlite): zero-setup local development and tests. `dataDir` undefined = in memory. */
export async function createPgliteDb(dataDir?: string): Promise<Db> {
  const { PGlite } = await import('@electric-sql/pglite');
  const lite = await PGlite.create(dataDir);
  return {
    async query<T extends Row = Row>(sql: string, params?: unknown[]) {
      return (await lite.query(sql, params)).rows as T[];
    },
    async exec(sql) {
      await lite.exec(sql);
    },
    transaction: (fn) =>
      lite.transaction((tx) =>
        fn({ query: async <T extends Row = Row>(sql: string, params?: unknown[]) => (await tx.query(sql, params)).rows as T[] }),
      ),
    close: () => lite.close(),
  };
}

export async function openDatabase(opts: { url: string | null; localDataDir: string }): Promise<Db> {
  const db = opts.url ? createPgDb(opts.url) : await createPgliteDb(opts.localDataDir);
  await migrate(db);
  return db;
}
