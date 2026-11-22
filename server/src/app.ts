import path from 'node:path';
import cookieParser from 'cookie-parser';
import express, { type Express } from 'express';
import helmet from 'helmet';
import type { AppConfig } from './config/env.js';
import type { Db } from './db/database.js';
import { loadSession, originCheck, requireAuth } from './middleware/auth.js';
import { errorHandler, notFoundHandler, requestLogger } from './middleware/error.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { entriesRouter } from './modules/entries/entries.routes.js';
import { exportRouter } from './modules/export/export.routes.js';
import { memoriesRouter } from './modules/memories/memories.routes.js';
import { moodsRouter } from './modules/moods/moods.routes.js';
import { reflectionsRouter } from './modules/reflections/reflections.routes.js';

export function createApp(db: Db, config: AppConfig): Express {
  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', 1);

  app.use(helmet());
  app.use(requestLogger(config.nodeEnv !== 'test'));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  const api = express.Router();
  api.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  api.use(originCheck(config));
  api.use(loadSession(db, config));
  api.get('/health', (_req, res) => {
    res.json({ ok: true });
  });
  api.use('/auth', authRouter(db, config));
  api.use('/entries', requireAuth, entriesRouter(db));
  api.use('/mood-checkins', requireAuth, moodsRouter(db));
  api.use('/memories', requireAuth, memoriesRouter(db));
  api.use('/reflections', requireAuth, reflectionsRouter(db));
  api.use('/', requireAuth, exportRouter(db, config));
  api.use(notFoundHandler);
  app.use('/api/v1', api);

  if (config.clientDistPath) {
    const dist = config.clientDistPath;
    app.use(express.static(dist, { index: false, maxAge: '1h' }));
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
      res.sendFile(path.join(dist, 'index.html'));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
