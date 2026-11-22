import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { PASSWORD, buildTestApp, signUpOwner } from './helpers.js';

describe('authentication', () => {
  it('reports that setup is required until an owner exists, then refuses a second owner', async () => {
    const { app } = buildTestApp();
    expect((await request(app).get('/api/v1/auth/status')).body).toEqual({ setupRequired: true, setupTokenRequired: false });
    await signUpOwner(app);
    expect((await request(app).get('/api/v1/auth/status')).body).toEqual({ setupRequired: false, setupTokenRequired: false });
    const second = await request(app).post('/api/v1/auth/setup').send({ email: 'x@example.com', password: PASSWORD });
    expect(second.status).toBe(409);
  });

  it('requires the setup code when one is configured', async () => {
    const ctx = buildTestApp({ setupToken: 'letmein-123' });
    expect((await request(ctx.app).get('/api/v1/auth/status')).body).toEqual({ setupRequired: true, setupTokenRequired: true });
    const body = { email: 'a@example.com', password: PASSWORD };
    expect((await request(ctx.app).post('/api/v1/auth/setup').send(body)).status).toBe(403);
    expect((await request(ctx.app).post('/api/v1/auth/setup').send({ ...body, setupToken: 'nope' })).status).toBe(403);
    expect((await request(ctx.app).post('/api/v1/auth/setup').send({ ...body, setupToken: 'letmein-123' })).status).toBe(201);
  });

  it('rejects short passwords and stores only a hash', async () => {
    const { app, db } = buildTestApp();
    const weak = await request(app).post('/api/v1/auth/setup').send({ email: 'a@example.com', password: 'short' });
    expect(weak.status).toBe(400);
    await signUpOwner(app);
    const row = db.prepare('SELECT password_hash FROM users').get() as { password_hash: string };
    expect(row.password_hash).not.toContain(PASSWORD);
    expect(row.password_hash.startsWith('scrypt$')).toBe(true);
  });

  it('requires a session for private routes', async () => {
    const { app } = buildTestApp();
    await signUpOwner(app);
    const res = await request(app).get('/api/v1/entries');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('unauthenticated');
  });

  it('signs in with the right password and rejects the wrong one', async () => {
    const { app } = buildTestApp();
    await signUpOwner(app, 'me@example.com');
    const bad = await request(app).post('/api/v1/auth/login').send({ email: 'me@example.com', password: 'wrong-password-123' });
    expect(bad.status).toBe(401);
    const unknown = await request(app).post('/api/v1/auth/login').send({ email: 'nobody@example.com', password: PASSWORD });
    expect(unknown.status).toBe(401);
    const ok = await request(app).post('/api/v1/auth/login').send({ email: 'me@example.com', password: PASSWORD });
    expect(ok.status).toBe(200);
    const cookie = ok.headers['set-cookie']?.[0] ?? '';
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
  });

  it('blocks state-changing requests without the CSRF token', async () => {
    const { app } = buildTestApp();
    const s = await signUpOwner(app);
    const res = await s.agent.post('/api/v1/entries').send({ body: 'hello' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('csrf_failed');
  });

  it('blocks requests from unexpected origins', async () => {
    const { app } = buildTestApp();
    const s = await signUpOwner(app);
    const res = await s.agent
      .post('/api/v1/entries')
      .set('X-CSRF-Token', s.csrf)
      .set('Origin', 'https://evil.example')
      .send({ body: 'hello' });
    expect(res.status).toBe(403);
  });

  it('signs out and ends the session', async () => {
    const { app } = buildTestApp();
    const s = await signUpOwner(app);
    expect((await s.get('/auth/me')).status).toBe(200);
    expect((await s.post('/auth/logout')).status).toBe(204);
    expect((await s.get('/auth/me')).status).toBe(401);
  });

  it('expires old sessions', async () => {
    const { app, db } = buildTestApp();
    const s = await signUpOwner(app);
    db.prepare('UPDATE sessions SET expires_at = ?').run(new Date(Date.now() - 1000).toISOString());
    expect((await s.get('/auth/me')).status).toBe(401);
  });

  it('changes the password and signs out other sessions', async () => {
    const { app } = buildTestApp();
    const first = await signUpOwner(app, 'me@example.com');
    const other = await request.agent(app);
    const login = await other.post('/api/v1/auth/login').send({ email: 'me@example.com', password: PASSWORD });
    expect(login.status).toBe(200);

    const wrong = await first.post('/auth/change-password', { currentPassword: 'nope-nope-nope', newPassword: 'another-long-password' });
    expect(wrong.status).toBe(400);
    const ok = await first.post('/auth/change-password', { currentPassword: PASSWORD, newPassword: 'another-long-password' });
    expect(ok.status).toBe(204);
    expect((await other.get('/api/v1/auth/me')).status).toBe(401);
    expect((await first.get('/auth/me')).status).toBe(200);
    const relogin = await request(app).post('/api/v1/auth/login').send({ email: 'me@example.com', password: 'another-long-password' });
    expect(relogin.status).toBe(200);
  });

  it('updates preferences', async () => {
    const { app } = buildTestApp();
    const s = await signUpOwner(app);
    const res = await s.patch('/auth/profile', { theme: 'dark', aiEnabled: false, displayName: 'Sam', timezone: 'Asia/Kolkata' });
    expect(res.status).toBe(200);
    expect(res.body.user.preferences.theme).toBe('dark');
    expect(res.body.user.displayName).toBe('Sam');
    expect(res.body.user.timezone).toBe('Asia/Kolkata');
    expect((await s.patch('/auth/profile', { timezone: 'Mars/Base' })).status).toBe(400);
  });
});
