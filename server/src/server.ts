import { loadConfig } from './config/env.js';
import { createApp } from './app.js';
import { openDatabase } from './db/database.js';

const config = loadConfig();
const db = openDatabase(config.databasePath);
const app = createApp(db, config);

const server = app.listen(config.port, () => {
  console.log(`The Memory Scrapbook server is listening on http://localhost:${config.port}`);
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
