import { existsSync } from 'node:fs';
import path from 'node:path';

export interface AppConfig {
  nodeEnv: 'development' | 'production' | 'test';
  port: number;
  databasePath: string;
  allowedOrigins: string[];
  sessionTtlDays: number;
  trustProxy: boolean;
  cookieSecure: boolean;
  clientDistPath: string | null;
  rateLimitEnabled: boolean;
  /** When set, first-run owner setup must include this code. */
  setupToken: string | null;
}

function loadDotEnv(): void {
  const candidates = [path.resolve(process.cwd(), '.env'), path.resolve(process.cwd(), '..', '.env')];
  for (const file of candidates) {
    if (existsSync(file)) {
      process.loadEnvFile(file);
      return;
    }
  }
}

export function loadConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  loadDotEnv();
  const nodeEnv = (process.env.NODE_ENV as AppConfig['nodeEnv']) ?? 'development';
  const clientDist = path.resolve(process.cwd(), '..', 'client', 'dist');
  const config: AppConfig = {
    nodeEnv,
    port: Number(process.env.PORT ?? 4000),
    databasePath: process.env.DATABASE_PATH ?? path.resolve(process.cwd(), 'data', 'scrapbook.db'),
    allowedOrigins: (process.env.CLIENT_ORIGIN ?? 'http://localhost:5173,http://127.0.0.1:5173')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    sessionTtlDays: Number(process.env.SESSION_TTL_DAYS ?? 14),
    trustProxy: process.env.TRUST_PROXY === 'true',
    cookieSecure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : nodeEnv === 'production',
    clientDistPath: existsSync(clientDist) ? clientDist : null,
    rateLimitEnabled: nodeEnv !== 'test',
    setupToken: process.env.SETUP_TOKEN?.trim() || null,
  };
  return { ...config, ...overrides };
}
