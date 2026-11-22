import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../utils/errors.js';

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction) {
  next(new HttpError(404, 'not_found', 'That page does not exist.'));
}

// Never log bodies, queries or stack traces that could contain diary content.
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }
  const type = (err as { type?: string } | null)?.type;
  if (type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'bad_json', message: 'That request could not be read.' } });
    return;
  }
  if (type === 'entity.too.large') {
    res.status(413).json({ error: { code: 'too_large', message: 'That is more than can be saved at once.' } });
    return;
  }
  console.error('Unexpected error:', err instanceof Error ? err.name : 'unknown');
  res.status(500).json({ error: { code: 'internal_error', message: 'Something went wrong on our side.' } });
}

export function requestLogger(enabled: boolean) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!enabled) return next();
    res.on('finish', () => {
      console.log(`${req.method} ${req.path} ${res.statusCode}`);
    });
    next();
  };
}
