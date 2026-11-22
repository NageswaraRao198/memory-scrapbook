import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { api } from '../../lib/api';
import { MoodCheckInForm } from '../mood/MoodCheckInForm';
import { DiaryPage } from './DiaryPage';

vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return { ...actual, api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() } };
});

const mocked = api as unknown as Record<'get' | 'post' | 'patch' | 'del', ReturnType<typeof vi.fn>>;

const entry = (id: string, title: string, date: string, mood: string | null = null) => ({
  id,
  title,
  body: `${title} body`,
  bodyFormat: 'markdown',
  entryDate: date,
  mood,
  emotions: [],
  intensity: null,
  contextTags: [],
  isDraft: false,
  createdAt: date,
  updatedAt: date,
});

describe('MoodCheckInForm', () => {
  beforeEach(() => Object.values(mocked).forEach((fn) => fn.mockReset()));

  it('asks for a feeling before saving, then posts the check-in', async () => {
    const user = userEvent.setup();
    mocked.post.mockResolvedValue({ checkIn: { id: '1' } });
    const onSaved = vi.fn();
    render(<MoodCheckInForm onSaved={onSaved} />);

    await user.click(screen.getByRole('button', { name: 'Add to my garden' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/choose the feeling/i);
    expect(mocked.post).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Grateful' }));
    await user.click(screen.getByRole('radio', { name: /4 of 5/ }));
    await user.click(screen.getByRole('button', { name: 'Add to my garden' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(mocked.post).toHaveBeenCalledWith('/mood-checkins', expect.objectContaining({ mood: 'Grateful', intensity: 4, emotions: [] }));
  });
});

describe('Diary archive', () => {
  beforeEach(() => {
    Object.values(mocked).forEach((fn) => fn.mockReset());
    mocked.get.mockImplementation(async (path: string, params?: Record<string, unknown>) => {
      if (path === '/entries/facets') return { moods: ['Happy'], emotions: [], contextTags: ['work'] };
      if (path === '/entries') {
        const all = [entry('a', 'River walk', '2025-03-10T10:00:00.000Z', 'Happy'), entry('b', 'Old page', '2025-01-05T10:00:00.000Z')];
        const q = String(params?.q ?? '').toLowerCase();
        const items = all.filter((e) => !q || e.title.toLowerCase().includes(q));
        return { items, total: items.length, limit: 20, offset: 0 };
      }
      throw new Error(`unexpected ${path}`);
    });
  });

  it('groups entries by month', async () => {
    render(
      <MemoryRouter>
        <DiaryPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText('River walk')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /March 2025/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /January 2025/ })).toBeInTheDocument();
  });

  it('searches, shows a helpful empty state, and clears the search', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DiaryPage />
      </MemoryRouter>,
    );
    await screen.findByText('River walk');
    await user.type(screen.getByLabelText('Search your entries'), 'zzz');
    expect(await screen.findByText('Nothing matches just yet')).toBeInTheDocument();
    expect(mocked.get).toHaveBeenCalledWith('/entries', expect.objectContaining({ q: 'zzz' }));

    await user.click(screen.getByRole('button', { name: 'Clear search and filters' }));
    expect(await screen.findByText('River walk')).toBeInTheDocument();
  });

  it('filters by feeling', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DiaryPage />
      </MemoryRouter>,
    );
    await screen.findByText('River walk');
    await user.click(screen.getByRole('button', { name: /filters/i }));
    await user.selectOptions(await screen.findByLabelText('Feeling'), 'Happy');
    await waitFor(() => expect(mocked.get).toHaveBeenCalledWith('/entries', expect.objectContaining({ mood: 'Happy' })));
  });
});
