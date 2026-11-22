import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { ApiError, api } from '../../lib/api';
import { AUTOSAVE_DELAY_MS, useEntryEditor } from './useEntryEditor';

vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return { ...actual, api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() } };
});

const mocked = api as unknown as Record<'get' | 'post' | 'patch' | 'del', ReturnType<typeof vi.fn>>;

const savedEntry = (over: Record<string, unknown> = {}) => ({
  entry: {
    id: 'entry-1',
    title: null,
    body: 'hello',
    bodyFormat: 'markdown',
    entryDate: '2025-01-01T10:00:00.000Z',
    mood: null,
    emotions: [],
    intensity: null,
    contextTags: [],
    isDraft: true,
    createdAt: '2025-01-01T10:00:00.000Z',
    updatedAt: '2025-01-01T10:00:00.000Z',
    ...over,
  },
});

describe('useEntryEditor autosave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.values(mocked).forEach((fn) => fn.mockReset());
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces typing into one draft creation, then updates the same entry', async () => {
    mocked.post.mockResolvedValue(savedEntry());
    mocked.patch.mockResolvedValue(savedEntry({ body: 'hello world' }));
    const { result } = renderHook(() => useEntryEditor(undefined));

    act(() => result.current.update({ body: 'h' }));
    act(() => result.current.update({ body: 'hel' }));
    act(() => result.current.update({ body: 'hello' }));
    expect(result.current.status).toBe('dirty');
    expect(mocked.post).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS + 50);
    });
    expect(mocked.post).toHaveBeenCalledTimes(1);
    expect(mocked.post.mock.calls[0]![1]).toMatchObject({ body: 'hello', isDraft: true });
    expect(result.current.status).toBe('saved');
    expect(result.current.entryId).toBe('entry-1');

    act(() => result.current.update({ body: 'hello world' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS + 50);
    });
    expect(mocked.post).toHaveBeenCalledTimes(1);
    expect(mocked.patch).toHaveBeenCalledWith('/entries/entry-1', expect.objectContaining({ body: 'hello world' }));
  });

  it('does not create an entry for an untouched or blank editor', async () => {
    const { result } = renderHook(() => useEntryEditor(undefined));
    act(() => result.current.update({ body: '   ' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS + 50);
    });
    expect(mocked.post).not.toHaveBeenCalled();
  });

  it('keeps the words, shows an error, and recovers on retry', async () => {
    mocked.post.mockRejectedValueOnce(new ApiError(0, 'network', 'We could not reach the server.')).mockResolvedValueOnce(savedEntry());
    const { result } = renderHook(() => useEntryEditor(undefined));

    act(() => result.current.update({ body: 'precious words' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS + 50);
    });
    expect(result.current.status).toBe('error');
    expect(result.current.errorMessage).toBe('We could not reach the server.');
    expect(result.current.form.body).toBe('precious words');
    expect(result.current.hasUnsaved()).toBe(true);
    expect(localStorage.getItem('scrapbook:draft:new')).toContain('precious words');

    await act(async () => {
      await result.current.saveNow();
    });
    expect(result.current.status).toBe('saved');
    expect(result.current.hasUnsaved()).toBe(false);
    expect(localStorage.getItem('scrapbook:draft:new')).toBeNull();
    expect(mocked.post).toHaveBeenCalledTimes(2);
  });

  it('refuses to finish an empty entry without calling the server', async () => {
    const { result } = renderHook(() => useEntryEditor(undefined));
    let finished: unknown = 'unset';
    await act(async () => {
      finished = await result.current.finalize();
    });
    expect(finished).toBeNull();
    expect(result.current.status).toBe('error');
    expect(mocked.post).not.toHaveBeenCalled();
  });

  it('marks an entry as a finished page when finalized', async () => {
    mocked.post.mockResolvedValue(savedEntry({ isDraft: false }));
    const { result } = renderHook(() => useEntryEditor(undefined));
    act(() => result.current.update({ body: 'done' }));
    let entry: unknown;
    await act(async () => {
      entry = await result.current.finalize();
    });
    expect(mocked.post.mock.calls[0]![1]).toMatchObject({ isDraft: false, body: 'done' });
    expect(entry).toMatchObject({ id: 'entry-1' });
    expect(result.current.isDraft).toBe(false);
  });

  it('offers to restore an unsaved safety copy and applies it', async () => {
    localStorage.setItem(
      'scrapbook:draft:new',
      JSON.stringify({ savedAt: '2025-01-01T09:00:00.000Z', form: { title: 'Lost', body: 'words that were not saved', entryDate: '2025-01-01T09:00:00.000Z', mood: null, emotions: [], intensity: null, contextTags: [] } }),
    );
    const { result } = renderHook(() => useEntryEditor(undefined));
    expect(result.current.recovery?.form.body).toBe('words that were not saved');
    act(() => result.current.restoreRecovery());
    expect(result.current.form.title).toBe('Lost');
    expect(result.current.recovery).toBeNull();
  });

  it('loads an existing entry and shows its content', async () => {
    mocked.get.mockResolvedValue(savedEntry({ id: 'abc', title: 'Existing', body: 'from server', isDraft: false }));
    const { result } = renderHook(() => useEntryEditor('abc'));
    expect(result.current.loading).toBe(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.form).toMatchObject({ title: 'Existing', body: 'from server' });
    expect(result.current.isDraft).toBe(false);
  });
});
