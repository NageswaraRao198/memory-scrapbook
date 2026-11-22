import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Flower } from '../../components/Flower';
import { Icon } from '../../components/Icon';
import { EmptyState, ErrorState, Loading, PageHeader } from '../../components/States';
import { api } from '../../lib/api';
import { dayKey, endOfDayIso, formatMonthYear, formatShortDate, monthKey, monthRangeIso, startOfDayIso } from '../../lib/dates';
import { useAsync, useDebouncedValue } from '../../lib/hooks';
import { moodColor } from '../../lib/moods';
import { entryTitle, excerpt } from '../../lib/text';
import type { Entry, Paged } from '../../types';

interface Filters {
  q: string;
  from: string;
  to: string;
  mood: string;
  emotion: string;
  tag: string;
  sort: 'newest' | 'oldest';
}

const PAGE_SIZE = 20;
const EMPTY_FILTERS: Filters = { q: '', from: '', to: '', mood: '', emotion: '', tag: '', sort: 'newest' };

function EntryRow({ entry }: { entry: Entry }) {
  return (
    <li>
      <Link to={`/diary/${entry.id}`} className="paper paper-lift flex items-start gap-4 p-4">
        <div className="w-16 shrink-0 text-center">
          <p className="font-display text-3xl leading-none">{new Date(entry.entryDate).getDate()}</p>
          <p className="text-xs uppercase tracking-wider text-muted">
            {new Intl.DateTimeFormat(undefined, { month: 'short' }).format(new Date(entry.entryDate))}
          </p>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-lg">{entryTitle(entry)}</h3>
            {entry.isDraft && <span className="stamp">Draft</span>}
          </div>
          <p className="line-clamp-2 text-sm text-muted">{excerpt(entry.body, 200)}</p>
          {entry.contextTags.length > 0 && (
            <p className="mt-1 text-xs text-muted">{entry.contextTags.map((t) => `#${t}`).join('  ')}</p>
          )}
        </div>
        {entry.mood && (
          <div className="flex shrink-0 flex-col items-center text-xs text-muted" title={entry.mood}>
            <Flower color={moodColor(entry.mood)} intensity={entry.intensity} size={30} />
            <span className="mt-0.5 hidden sm:block">{entry.mood.split(' ')[0]}</span>
          </div>
        )}
      </Link>
    </li>
  );
}

function Calendar({ onPickDay, selected }: { onPickDay: (key: string | null) => void; selected: string | null }) {
  const today = new Date();
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const range = monthRangeIso(cursor.year, cursor.month);
  const data = useAsync(
    () => api.get<Paged<Entry>>('/entries', { from: range.from, to: range.to, limit: 100, sort: 'oldest' }),
    [cursor.year, cursor.month],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const e of data.data?.items ?? []) {
      const key = dayKey(e.entryDate);
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    return map;
  }, [data.data]);

  const first = new Date(cursor.year, cursor.month, 1);
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(first.getDay()).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const shift = (delta: number) => {
    const d = new Date(cursor.year, cursor.month + delta, 1);
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
    onPickDay(null);
  };
  const todayKey = dayKey(today);
  const selectedEntries = selected ? byDay.get(selected) ?? [] : [];

  return (
    <div className="space-y-5">
      <div className="paper p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => shift(-1)} aria-label="Previous month">
            <Icon name="chevronLeft" size={16} />
          </button>
          <h2 className="text-xl" aria-live="polite">{formatMonthYear(first)}</h2>
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => shift(1)} aria-label="Next month">
            <Icon name="chevronRight" size={16} />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted" aria-hidden="true">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1" role="grid" aria-label={`Entries in ${formatMonthYear(first)}`}>
          {cells.map((day, i) => {
            if (!day) return <div key={`b${i}`} />;
            const key = dayKey(new Date(cursor.year, cursor.month, day));
            const entries = byDay.get(key) ?? [];
            const isSelected = selected === key;
            return (
              <button
                key={key}
                type="button"
                role="gridcell"
                aria-label={`${formatShortDate(startOfDayIso(key))}${entries.length ? `, ${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}` : ''}`}
                aria-pressed={isSelected}
                onClick={() => onPickDay(isSelected ? null : key)}
                className={`flex min-h-[48px] flex-col items-center justify-start rounded-lg border p-1 text-sm transition-colors sm:min-h-[60px] ${
                  isSelected ? 'border-accent bg-rose/25' : key === todayKey ? 'border-accent/60' : 'border-transparent hover:border-line hover:bg-surface-2'
                }`}
              >
                <span>{day}</span>
                {entries.length > 0 && (
                  <span className="mt-1 flex gap-0.5" aria-hidden="true">
                    {entries.slice(0, 3).map((e) => (
                      <span key={e.id} className="h-2 w-2 rounded-full" style={{ background: e.mood ? moodColor(e.mood) : 'var(--accent-soft)' }} />
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {data.loading && <p className="mt-3 text-center text-sm text-muted" role="status">Loading this month...</p>}
        {data.error && <div className="mt-3"><ErrorState error={data.error} onRetry={data.reload} /></div>}
      </div>

      {selected && (
        <section aria-label={`Entries on ${formatShortDate(startOfDayIso(selected))}`}>
          <h3 className="mb-3 text-lg">{formatShortDate(startOfDayIso(selected))}</h3>
          {selectedEntries.length === 0 ? (
            <p className="text-muted">No pages on this day. That is perfectly okay.</p>
          ) : (
            <ul className="space-y-3">
              {selectedEntries.map((e) => (
                <EntryRow key={e.id} entry={e} />
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function ListView() {
  const [params] = useSearchParams();
  const [filters, setFilters] = useState<Filters>({ ...EMPTY_FILTERS, tag: params.get('tag') ?? '' });
  const [showFilters, setShowFilters] = useState(Boolean(params.get('tag')));
  const debouncedQ = useDebouncedValue(filters.q, 300);
  const facets = useAsync(() => api.get<{ moods: string[]; emotions: string[]; contextTags: string[] }>('/entries/facets'), []);

  const [items, setItems] = useState<Entry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const query = useCallback(
    (offset: number) => ({
      q: debouncedQ,
      from: filters.from ? startOfDayIso(filters.from) : undefined,
      to: filters.to ? endOfDayIso(filters.to) : undefined,
      mood: filters.mood,
      emotion: filters.emotion,
      tag: filters.tag,
      sort: filters.sort,
      limit: PAGE_SIZE,
      offset,
    }),
    [debouncedQ, filters.from, filters.to, filters.mood, filters.emotion, filters.tag, filters.sort],
  );

  const [reloadTick, setReloadTick] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.get<Paged<Entry>>('/entries', query(0)).then(
      (res) => {
        if (cancelled) return;
        setItems(res.items);
        setTotal(res.total);
        setLoading(false);
      },
      (err: Error) => {
        if (cancelled) return;
        setError(err);
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [query, reloadTick]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const res = await api.get<Paged<Entry>>('/entries', query(items.length));
      setItems((prev) => [...prev, ...res.items]);
      setTotal(res.total);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoadingMore(false);
    }
  };

  const groups = useMemo(() => {
    const out: { key: string; entries: Entry[] }[] = [];
    for (const e of items) {
      const key = monthKey(e.entryDate);
      const last = out[out.length - 1];
      if (last?.key === key) last.entries.push(e);
      else out.push({ key, entries: [e] });
    }
    return out;
  }, [items]);

  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => setFilters((f) => ({ ...f, [key]: value }));
  const isFiltered = Boolean(filters.q || filters.from || filters.to || filters.mood || filters.emotion || filters.tag);
  const clear = () => setFilters({ ...EMPTY_FILTERS, sort: filters.sort });

  return (
    <div className="space-y-6">
      <div className="paper space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[14rem] flex-1">
            <label htmlFor="diary-search" className="sr-only">Search your entries</label>
            <Icon name="search" size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              id="diary-search"
              type="search"
              className="field !pl-10"
              placeholder="Search titles and words"
              value={filters.q}
              onChange={(e) => set('q', e.target.value)}
            />
          </div>
          <button type="button" className="btn btn-quiet" aria-expanded={showFilters} onClick={() => setShowFilters((s) => !s)}>
            Filters{isFiltered ? ' (on)' : ''}
          </button>
          <div>
            <label htmlFor="sort" className="sr-only">Sort entries</label>
            <select id="sort" className="field !w-auto" value={filters.sort} onChange={(e) => set('sort', e.target.value as Filters['sort'])}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>
        </div>
        {showFilters && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label htmlFor="f-from" className="label">From</label>
              <input id="f-from" type="date" className="field" value={filters.from} onChange={(e) => set('from', e.target.value)} />
            </div>
            <div>
              <label htmlFor="f-to" className="label">To</label>
              <input id="f-to" type="date" className="field" value={filters.to} onChange={(e) => set('to', e.target.value)} />
            </div>
            <div>
              <label htmlFor="f-mood" className="label">Feeling</label>
              <select id="f-mood" className="field" value={filters.mood} onChange={(e) => set('mood', e.target.value)}>
                <option value="">Any</option>
                {facets.data?.moods.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="f-emotion" className="label">Emotion tag</label>
              <select id="f-emotion" className="field" value={filters.emotion} onChange={(e) => set('emotion', e.target.value)}>
                <option value="">Any</option>
                {facets.data?.emotions.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="f-tag" className="label">About</label>
              <select id="f-tag" className="field" value={filters.tag} onChange={(e) => set('tag', e.target.value)}>
                <option value="">Anything</option>
                {facets.data?.contextTags.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div className="flex items-end">
              <button type="button" className="btn btn-quiet" onClick={clear} disabled={!isFiltered}>
                Clear filters
              </button>
            </div>
          </div>
        )}
      </div>

      {loading && <Loading label="Finding your pages..." />}
      {error && !loading && <ErrorState error={error} onRetry={() => setReloadTick((t) => t + 1)} />}

      {!loading && !error && items.length === 0 && (
        isFiltered ? (
          <EmptyState title="Nothing matches just yet" action={<button type="button" className="btn btn-primary" onClick={clear}>Clear search and filters</button>}>
            Try fewer words, a wider date range, or a different feeling.
          </EmptyState>
        ) : (
          <EmptyState title="Your diary is waiting for its first page" action={<Link to="/diary/write" className="btn btn-primary">Write a little</Link>}>
            Whenever you are ready. A single sentence is enough.
          </EmptyState>
        )
      )}

      {!loading && groups.map((g) => (
        <section key={g.key} aria-labelledby={`m-${g.key}`}>
          <h2 id={`m-${g.key}`} className="mb-3 flex items-center gap-3 text-xl">
            {formatMonthYear(`${g.key}-15T12:00:00`)}
            <span className="hand text-base">{g.entries.length} {g.entries.length === 1 ? 'page' : 'pages'}</span>
          </h2>
          <ul className="space-y-3">
            {g.entries.map((e) => <EntryRow key={e.id} entry={e} />)}
          </ul>
        </section>
      ))}

      {!loading && items.length > 0 && (
        <div className="flex flex-col items-center gap-2 pt-2">
          <p className="text-sm text-muted" role="status">Showing {items.length} of {total}</p>
          {items.length < total && (
            <button type="button" className="btn btn-quiet" onClick={() => void loadMore()} disabled={loadingMore}>
              {loadingMore ? 'Loading...' : 'Show more'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function DiaryPage() {
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  return (
    <div>
      <PageHeader
        title="My Diary"
        note="every page, just as you wrote it"
        actions={
          <>
            <div role="group" aria-label="View" className="flex overflow-hidden rounded-full border border-line">
              <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')} className={`flex min-h-[40px] items-center gap-1.5 px-4 text-sm ${view === 'list' ? 'bg-rose/30' : ''}`}>
                <Icon name="list" size={16} /> List
              </button>
              <button type="button" aria-pressed={view === 'calendar'} onClick={() => setView('calendar')} className={`flex min-h-[40px] items-center gap-1.5 px-4 text-sm ${view === 'calendar' ? 'bg-rose/30' : ''}`}>
                <Icon name="calendar" size={16} /> Calendar
              </button>
            </div>
            <Link to="/diary/write" className="btn btn-primary">
              <Icon name="pen" size={16} /> New entry
            </Link>
          </>
        }
      />
      {view === 'list' ? <ListView /> : <Calendar selected={selectedDay} onPickDay={setSelectedDay} />}
    </div>
  );
}
