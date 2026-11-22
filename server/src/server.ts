import { createApp } from './app.js';
import { loadConfig } from './config/env.js';
import { openDatabase } from './db/database.js';

const config = loadConfig();

if (config.nodeEnv === 'production' && !config.databaseUrl) {
  console.error('DATABASE_URL is required in production. Without it, your diary would not be stored permanently.');
  process.exit(1);
}

const db = await openDatabase({ url: config.databaseUrl, localDataDir: config.localDataDir });
const app = createApp(db, config);

const server = app.listen(config.port, () => {
  const where = config.databaseUrl ? 'hosted Postgres' : `embedded Postgres in ${config.localDataDir}`;
  console.log(`The Memory Scrapbook server is listening on http://localhost:${config.port} (${where})`);
});

function shutdown() {
  server.close(() => {
    void db.close().finally(() => process.exit(0));
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
