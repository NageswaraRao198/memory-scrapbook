import { describe, expect, it } from 'vitest';
import { PASSWORD, PIN, buildTestApp, signUpOwner } from './helpers.js';
import request from 'supertest';

describe('mood check-ins', () => {
  it('records a standalone check-in with several emotions and summarises a period', async () => {
    const s = await signUpOwner(buildTestApp().app);
    const res = await s.post('/mood-checkins', {
      mood: 'Anxious',
      emotions: ['restless', 'hopeful'],
      intensity: 2,
      note: 'Big meeting',
      recordedAt: '2025-05-01T09:00:00Z',
    });
    expect(res.status).toBe(201);
    await s.post('/mood-checkins', { mood: 'Anxious', emotions: ['Restless'], recordedAt: '2025-05-02T09:00:00Z' });
    await s.post('/mood-checkins', { mood: 'Happy', recordedAt: '2025-05-03T09:00:00Z' });
    await s.post('/entries', { body: 'Work day', contextTags: ['work'], entryDate: '2025-05-02T10:00:00Z' });
    await s.post('/entries', { body: 'Draft', contextTags: ['work'], isDraft: true, entryDate: '2025-05-02T11:00:00Z' });

    const summary = (await s.get('/mood-checkins/summary?from=2025-05-01T00:00:00Z&to=2025-05-31T00:00:00Z')).body;
    expect(summary.total).toBe(3);
    expect(summary.byMood[0]).toEqual({ label: 'Anxious', count: 2 });
    expect(summary.topEmotions[0]).toEqual({ label: 'restless', count: 2 });
    expect(summary.topContextTags).toEqual([{ label: 'work', count: 1 }]);

    const ranged = (await s.get('/mood-checkins?from=2025-05-02T00:00:00Z&to=2025-05-02T23:59:59Z')).body.items;
    expect(ranged).toHaveLength(1);
  });

  it('edits and deletes standalone check-ins', async () => {
    const s = await signUpOwner(buildTestApp().app);
    const id = (await s.post('/mood-checkins', { mood: 'Tired' })).body.checkIn.id;
    expect((await s.patch(`/mood-checkins/${id}`, { mood: 'Content', intensity: 5 })).body.checkIn).toMatchObject({ mood: 'Content', intensity: 5 });
    expect((await s.del(`/mood-checkins/${id}`)).status).toBe(204);
    expect((await s.post('/mood-checkins', { mood: '' })).status).toBe(400);
  });
});

describe('memories and reflections', () => {
  it('creates, filters, and deletes memories', async () => {
    const s = await signUpOwner(buildTestApp().app);
    await s.post('/memories', { title: 'Beach day', description: 'Warm sand', memoryDate: '2023-07-04T00:00:00Z', tags: ['summer'], peopleLabels: ['Asha'], locationLabel: 'Goa' });
    await s.post('/memories', { title: 'First snow', memoryDate: '2024-12-20T00:00:00Z', tags: ['winter'] });
    const all = (await s.get('/memories')).body;
    expect(all.items.map((m: { title: string }) => m.title)).toEqual(['First snow', 'Beach day']);
    expect(all.facets.years).toEqual([2024, 2023]);
    expect(all.facets.tags).toEqual(['Asha', 'summer', 'winter']);
    expect((await s.get('/memories?year=2023')).body.total).toBe(1);
    expect((await s.get('/memories?tag=asha')).body.total).toBe(1);
    expect((await s.get('/memories?q=goa')).body.total).toBe(1);
    const id = all.items[0].id;
    expect((await s.patch(`/memories/${id}`, { title: 'First snowfall' })).body.memory.title).toBe('First snowfall');
    expect((await s.del(`/memories/${id}`)).status).toBe(204);
    expect((await s.post('/memories', { title: '   ' })).status).toBe(400);
  });

  it('saves reflections and filters by type', async () => {
    const s = await signUpOwner(buildTestApp().app);
    await s.post('/reflections', { type: 'daily', prompt: 'What gave me energy?', response: 'A walk.' });
    const letter = await s.post('/reflections', { type: 'future-letter', title: 'Dear me', response: 'Hello', periodEnd: '2030-01-01T00:00:00Z' });
    expect(letter.body.reflection.periodEnd).toBe('2030-01-01T00:00:00.000Z');
    expect((await s.get('/reflections?type=daily')).body.total).toBe(1);
    expect((await s.get('/reflections')).body.total).toBe(2);
    expect((await s.post('/reflections', { type: 'bogus', response: 'x' })).status).toBe(400);
    expect((await s.post('/reflections', { type: 'daily', response: ' ' })).status).toBe(400);
  });
});

describe('export and deletion', () => {
  it('exports everything as JSON and Markdown', async () => {
    const s = await signUpOwner(buildTestApp().app);
    await s.post('/entries', { title: 'Hello', body: 'Dear diary', mood: 'Happy', entryDate: '2025-01-02T00:00:00Z' });
    await s.post('/memories', { title: 'A memory', memoryDate: '2025-01-03T00:00:00Z' });
    await s.post('/reflections', { type: 'daily', prompt: 'P?', response: 'Answer' });

    const json = await s.get('/export');
    expect(json.headers['content-disposition']).toContain('attachment');
    expect(json.body).toMatchObject({ app: 'memory-scrapbook', version: 1 });
    expect(json.body.entries).toHaveLength(1);
    expect(json.body.moodCheckIns).toHaveLength(1);
    expect(json.body.memories).toHaveLength(1);
    expect(json.body.reflections).toHaveLength(1);
    expect(JSON.stringify(json.body)).not.toContain('password');

    const md = await s.get('/export?format=markdown');
    expect(md.headers['content-type']).toContain('text/markdown');
    expect(md.text).toContain('Dear diary');
    expect(md.text).toContain('A memory');
    expect(md.text).toContain('Answer');
  });

  it('requires explicit confirmation before deleting, then deletes content but keeps the account', async () => {
    const s = await signUpOwner(buildTestApp().app);
    await s.post('/entries', { body: 'x', mood: 'Happy' });
    await s.post('/memories', { title: 'm' });
    await s.post('/reflections', { type: 'daily', response: 'r' });
    expect((await s.del('/account/data', {})).status).toBe(400);
    expect((await s.del('/account/data', { confirm: 'delete' })).status).toBe(400);
    expect((await s.get('/entries')).body.total).toBe(1);

    expect((await s.del('/account/data', { confirm: 'DELETE' })).status).toBe(204);
    expect((await s.get('/entries')).body.total).toBe(0);
    expect((await s.get('/memories')).body.total).toBe(0);
    expect((await s.get('/reflections')).body.total).toBe(0);
    expect((await s.get('/mood-checkins')).body.items).toHaveLength(0);
    expect((await s.get('/auth/me')).status).toBe(200);
  });

  it('removes everything when the account is deleted', async () => {
    const ctx = buildTestApp();
    const s = await signUpOwner(ctx.app);
    await s.post('/entries', { body: 'x' });
    expect((await s.del('/account/data', { confirm: 'DELETE', deleteAccount: true })).status).toBe(204);
    expect((await s.get('/auth/me')).status).toBe(401);
    expect((await request(ctx.app).get('/api/v1/auth/status')).body.setupRequired).toBe(true);
    const row = (await ctx.db.query<{ c: number }>('SELECT COUNT(*)::int AS c FROM entries'))[0];
    expect(row?.c).toBe(0);
  });
});

describe('end-to-end journey (API level)', () => {
  it('sign in -> write entry -> add mood -> revisit -> export', async () => {
    const ctx = buildTestApp();
    await signUpOwner(ctx.app, 'me@example.com');
    const agent = request.agent(ctx.app);
    const login = await agent.post('/api/v1/auth/login').send({ email: 'me@example.com', password: PASSWORD, pin: PIN });
    const csrf = login.body.csrfToken as string;
    const entry = (await agent.post('/api/v1/entries').set('X-CSRF-Token', csrf).send({ title: 'Today', body: 'It rained.', mood: 'Peaceful', emotions: ['cosy'] })).body.entry;
    const found = await agent.get('/api/v1/entries?q=rained');
    expect(found.body.items[0].id).toBe(entry.id);
    const garden = await agent.get('/api/v1/mood-checkins');
    expect(garden.body.items[0].linkedEntryId).toBe(entry.id);
    const exported = await agent.get('/api/v1/export?format=markdown');
    expect(exported.text).toContain('It rained.');
  });
});
