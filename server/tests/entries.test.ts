import { describe, expect, it } from 'vitest';
import { addUserAndSignIn, buildTestApp, signUpOwner } from './helpers.js';

describe('diary entries', () => {
  it('creates, reads, updates, and deletes an entry', async () => {
    const ctx = buildTestApp();
    const s = await signUpOwner(ctx.app);
    const created = await s.post('/entries', {
      title: '  A quiet day ',
      body: 'Line one\n\nLine two',
      entryDate: '2025-03-04T10:00:00Z',
      mood: 'Peaceful',
      emotions: ['calm', 'Calm', ' relieved '],
      intensity: 3,
      contextTags: ['family'],
    });
    expect(created.status).toBe(201);
    const entry = created.body.entry;
    expect(entry.title).toBe('A quiet day');
    expect(entry.body).toBe('Line one\n\nLine two');
    expect(entry.emotions).toEqual(['calm', 'relieved']);
    expect(entry.entryDate).toBe('2025-03-04T10:00:00.000Z');

    expect((await s.get(`/entries/${entry.id}`)).body.entry.mood).toBe('Peaceful');

    const updated = await s.patch(`/entries/${entry.id}`, { body: 'Changed', mood: 'Grateful' });
    expect(updated.body.entry.body).toBe('Changed');
    expect(updated.body.entry.mood).toBe('Grateful');

    expect((await s.del(`/entries/${entry.id}`)).status).toBe(204);
    expect((await s.get(`/entries/${entry.id}`)).status).toBe(404);
  });

  it('keeps exactly one mood check-in in sync with an entry', async () => {
    const ctx = buildTestApp();
    const s = await signUpOwner(ctx.app);
    const { entry } = (await s.post('/entries', { body: 'x', mood: 'Happy', intensity: 4 })).body;
    let moods = (await s.get('/mood-checkins')).body.items;
    expect(moods).toHaveLength(1);
    expect(moods[0]).toMatchObject({ mood: 'Happy', linkedEntryId: entry.id, source: 'entry' });

    await s.patch(`/entries/${entry.id}`, { mood: 'Tired' });
    moods = (await s.get('/mood-checkins')).body.items;
    expect(moods).toHaveLength(1);
    expect(moods[0].mood).toBe('Tired');

    expect((await s.patch(`/mood-checkins/${moods[0].id}`, { mood: 'Sad' })).status).toBe(409);

    await s.patch(`/entries/${entry.id}`, { mood: null });
    expect((await s.get('/mood-checkins')).body.items).toHaveLength(0);

    await s.patch(`/entries/${entry.id}`, { mood: 'Happy' });
    await s.del(`/entries/${entry.id}`);
    expect((await s.get('/mood-checkins')).body.items).toHaveLength(0);
  });

  it('allows empty drafts but requires text to save a finished entry', async () => {
    const s = await signUpOwner(buildTestApp().app);
    expect((await s.post('/entries', { body: '', isDraft: false })).status).toBe(400);
    const draft = await s.post('/entries', { title: 'Just a title', body: '', isDraft: true });
    expect(draft.status).toBe(201);
    const id = draft.body.entry.id;
    expect((await s.patch(`/entries/${id}`, { isDraft: false })).status).toBe(400);
    expect((await s.patch(`/entries/${id}`, { body: 'Now written', isDraft: false })).body.entry.isDraft).toBe(false);
  });

  it('validates input', async () => {
    const s = await signUpOwner(buildTestApp().app);
    expect((await s.post('/entries', { body: 'x', intensity: 9 })).status).toBe(400);
    expect((await s.post('/entries', { body: 'x', entryDate: 'not a date' })).status).toBe(400);
    expect((await s.get('/entries/not-a-uuid')).status).toBe(400);
    const res = await s.post('/entries', { body: 'x', intensity: 0 });
    expect(res.body.error.code).toBe('validation_error');
  });

  it('searches, filters, sorts and paginates', async () => {
    const s = await signUpOwner(buildTestApp().app);
    await s.post('/entries', { body: 'Walked by the river', entryDate: '2025-01-10T08:00:00Z', mood: 'Peaceful', emotions: ['calm'], contextTags: ['nature'] });
    await s.post('/entries', { body: 'Deadline stress at work', entryDate: '2025-02-10T08:00:00Z', mood: 'Anxious', emotions: ['tense'], contextTags: ['work'] });
    await s.post('/entries', { title: 'River again', body: '100% better', entryDate: '2025-03-10T08:00:00Z', mood: 'Peaceful', contextTags: ['nature', 'work'] });
    await s.post('/entries', { body: 'unfinished', isDraft: true, entryDate: '2025-04-10T08:00:00Z' });

    const titles = (r: { body: { items: { body: string }[] } }) => r.body.items.map((e) => e.body);
    expect(titles(await s.get('/entries?q=river'))).toHaveLength(2);
    expect(titles(await s.get('/entries?q=100%25'))).toEqual(['100% better']);
    expect(titles(await s.get('/entries?q=%25'))).toEqual(['100% better']);
    expect((await s.get('/entries?mood=Peaceful')).body.total).toBe(2);
    expect((await s.get('/entries?emotion=CALM')).body.total).toBe(1);
    expect((await s.get('/entries?tag=work')).body.total).toBe(2);
    expect((await s.get('/entries?from=2025-02-01T00:00:00Z&to=2025-02-28T00:00:00Z')).body.total).toBe(1);
    expect((await s.get('/entries?drafts=only')).body.total).toBe(1);
    expect((await s.get('/entries?drafts=exclude')).body.total).toBe(3);
    expect(titles(await s.get('/entries?sort=oldest&drafts=exclude'))[0]).toBe('Walked by the river');
    const page = await s.get('/entries?sort=oldest&limit=2&offset=2&drafts=exclude');
    expect(page.body.items).toHaveLength(1);
    expect(page.body.total).toBe(3);

    const facets = (await s.get('/entries/facets')).body;
    expect(facets.moods).toEqual(['Anxious', 'Peaceful']);
    expect(facets.contextTags).toEqual(['nature', 'work']);
  });

  it('finds an entry from this day in a past year, using the owner timezone', async () => {
    const s = await signUpOwner(buildTestApp().app);
    await s.post('/entries', { body: 'Last year', entryDate: '2024-06-15T12:00:00Z' });
    await s.post('/entries', { body: 'Draft memory', isDraft: true, entryDate: '2023-06-15T12:00:00Z' });
    const hit = await s.get('/entries/on-this-day?date=2025-06-15&tz=UTC');
    expect(hit.body.entry.body).toBe('Last year');
    expect((await s.get('/entries/on-this-day?date=2025-06-16&tz=UTC')).body.entry).toBeNull();
    expect((await s.get('/entries/on-this-day?date=2024-06-15&tz=UTC')).body.entry).toBeNull();
    // 23:30 UTC on the 14th is already the 15th in Kolkata
    await s.post('/entries', { body: 'Late night', entryDate: '2022-06-14T23:30:00Z' });
    expect((await s.get('/entries/on-this-day?date=2025-06-15&tz=Asia/Kolkata')).body.entry.body).toBe('Last year');
  });
});

describe('ownership isolation', () => {
  it("never lets one owner read or change another owner's records", async () => {
    const ctx = buildTestApp();
    const alice = await signUpOwner(ctx.app, 'alice@example.com');
    const bob = await addUserAndSignIn(ctx, 'bob@example.com');

    const entry = (await alice.post('/entries', { body: 'Alice secret', mood: 'Sad' })).body.entry;
    const memory = (await alice.post('/memories', { title: 'Alice trip' })).body.memory;
    const reflection = (await alice.post('/reflections', { type: 'daily', response: 'private' })).body.reflection;
    const checkIn = (await alice.post('/mood-checkins', { mood: 'Happy' })).body.checkIn;

    expect((await bob.get(`/entries/${entry.id}`)).status).toBe(404);
    expect((await bob.patch(`/entries/${entry.id}`, { body: 'hacked' })).status).toBe(404);
    expect((await bob.del(`/entries/${entry.id}`)).status).toBe(404);
    expect((await bob.get(`/memories/${memory.id}`)).status).toBe(404);
    expect((await bob.patch(`/memories/${memory.id}`, { title: 'hacked' })).status).toBe(404);
    expect((await bob.del(`/memories/${memory.id}`)).status).toBe(404);
    expect((await bob.patch(`/reflections/${reflection.id}`, { response: 'hacked' })).status).toBe(404);
    expect((await bob.del(`/reflections/${reflection.id}`)).status).toBe(404);
    expect((await bob.patch(`/mood-checkins/${checkIn.id}`, { mood: 'Sad' })).status).toBe(404);
    expect((await bob.del(`/mood-checkins/${checkIn.id}`)).status).toBe(404);

    expect((await bob.get('/entries')).body.total).toBe(0);
    expect((await bob.get('/memories')).body.total).toBe(0);
    expect((await bob.get('/reflections')).body.total).toBe(0);
    expect((await bob.get('/mood-checkins')).body.items).toHaveLength(0);
    expect((await bob.get('/entries/facets')).body.moods).toEqual([]);

    // linking to someone else's entry is rejected
    expect((await bob.post('/memories', { title: 'sneaky', linkedEntryId: entry.id })).status).toBe(400);
    expect((await bob.post('/mood-checkins', { mood: 'Happy', linkedEntryId: entry.id })).status).toBe(400);

    const aliceExport = (await alice.get('/export')).body;
    expect(aliceExport.entries).toHaveLength(1);
    const bobExport = (await bob.get('/export')).body;
    expect(bobExport.entries).toHaveLength(0);
    expect(JSON.stringify(bobExport)).not.toContain('Alice');

    // Alice's data is untouched
    expect((await alice.get(`/entries/${entry.id}`)).body.entry.body).toBe('Alice secret');
  });
});
