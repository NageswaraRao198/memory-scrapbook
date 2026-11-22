import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Flower } from '../../components/Flower';
import { Icon } from '../../components/Icon';
import { ConfirmDialog } from '../../components/Modal';
import { ErrorState, InlineError, Loading, PageHeader } from '../../components/States';
import { useToast } from '../../components/Toast';
import { api, ApiError } from '../../lib/api';
import { dayKey, daysAgoIso, formatMonthYear, formatShortDate, formatTime, monthRangeIso, startOfDayIso } from '../../lib/dates';
import { useAsync } from '../../lib/hooks';
import { INTENSITY_LABELS, MOODS, moodColor } from '../../lib/moods';
import type { MoodCheckIn, MoodSummary } from '../../types';
import { MoodCheckInForm } from './MoodCheckInForm';

const MIN_FOR_INSIGHTS = 7;

function CheckInCard({ checkIn, onDeleted }: { checkIn: MoodCheckIn; onDeleted: () => void }) {
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    setBusy(true);
    try {
      await api.del(`/mood-checkins/${checkIn.id}`);
      toast('That check-in has been removed.');
      setConfirm(false);
      onDeleted();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'We could not remove that.');
      setConfirm(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="paper flex gap-4 p-4">
      <Flower color={moodColor(checkIn.mood)} intensity={checkIn.intensity} size={48} />
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {checkIn.mood}
          {checkIn.intensity ? <span className="font-normal text-muted"> - {INTENSITY_LABELS[checkIn.intensity - 1]?.toLowerCase()}</span> : null}
        </p>
        <p className="text-sm text-muted">{formatTime(checkIn.recordedAt)}</p>
        {checkIn.emotions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {checkIn.emotions.map((e) => <span key={e} className="chip">{e}</span>)}
          </div>
        )}
        {checkIn.note && <p className="mt-2 text-sm">{checkIn.note}</p>}
        {error && <div className="mt-2"><InlineError>{error}</InlineError></div>}
        <div className="mt-3 flex flex-wrap gap-2">
          {checkIn.linkedEntryId && (
            <Link to={`/diary/${checkIn.linkedEntryId}`} className="btn btn-quiet btn-sm">
              Open the diary page
            </Link>
          )}
          {checkIn.source === 'checkin' && (
            <button type="button" className="btn btn-danger btn-sm" onClick={() => setConfirm(true)}>
              <Icon name="trash" size={14} /> Remove
            </button>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={confirm}
        title="Remove this check-in?"
        message="This bloom will be taken out of your garden permanently."
        confirmLabel="Remove it"
        busy={busy}
        onConfirm={() => void remove()}
        onCancel={() => setConfirm(false)}
      />
    </li>
  );
}

type Period = '30' | '90' | '365' | 'all';

function Insights({ refreshKey }: { refreshKey: number }) {
  const [period, setPeriod] = useState<Period>('90');
  const summary = useAsync(
    () => api.get<MoodSummary>('/mood-checkins/summary', period === 'all' ? {} : { from: daysAgoIso(Number(period)) }),
    [period, refreshKey],
  );
  const s = summary.data;
  const maxCount = Math.max(1, ...(s?.byMood.map((m) => m.count) ?? [1]));

  return (
    <section aria-labelledby="insights-title" className="paper space-y-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="insights-title" className="text-2xl">Gentle observations</h2>
          <p className="text-sm text-muted">A look back at what you chose to record. These are your own words, not conclusions.</p>
        </div>
        <div>
          <label htmlFor="period" className="sr-only">Time period</label>
          <select id="period" className="field !w-auto" value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
            <option value="30">Last 30 days</option>
            <option value="90">Last 3 months</option>
            <option value="365">Last year</option>
            <option value="all">All time</option>
          </select>
        </div>
      </div>

      {summary.loading && <Loading label="Gathering your garden..." />}
      {summary.error && <ErrorState error={summary.error} onRetry={summary.reload} />}
      {s && s.total < MIN_FOR_INSIGHTS && (
        <p className="rounded-lg bg-sage/15 p-4">
          Your garden will grow at its own pace. Patterns tend to show up after a handful of check-ins, so there is nothing to do here yet.
          {s.total > 0 ? ` You have recorded ${s.total} so far.` : ''}
        </p>
      )}
      {s && s.total >= MIN_FOR_INSIGHTS && (
        <div className="space-y-6">
          <div>
            <h3 className="mb-2 text-lg">What you noticed, {s.total} times</h3>
            <ul className="space-y-2">
              {s.byMood.map((m) => (
                <li key={m.label} className="grid grid-cols-[8.5rem_1fr_2rem] items-center gap-3 text-sm">
                  <span className="truncate">{m.label.replace(' / prefer not to say', '')}</span>
                  <span className="h-3 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
                    <span className="block h-full rounded-full" style={{ width: `${(m.count / maxCount) * 100}%`, background: moodColor(m.label) }} />
                  </span>
                  <span className="text-right text-muted">{m.count}</span>
                </li>
              ))}
            </ul>
          </div>
          {s.topEmotions.length > 0 && (
            <div>
              <h3 className="mb-2 text-lg">Feelings that came up more than once</h3>
              <div className="flex flex-wrap gap-2">
                {s.topEmotions.filter((e) => e.count > 1).map((e) => (
                  <span key={e.label} className="chip">{e.label} <span className="text-muted">x{e.count}</span></span>
                ))}
                {s.topEmotions.every((e) => e.count <= 1) && <p className="text-sm text-muted">Nothing has repeated yet.</p>}
              </div>
            </div>
          )}
          {s.topContextTags.length > 0 && (
            <div>
              <h3 className="mb-2 text-lg">What your pages were often about</h3>
              <div className="flex flex-wrap gap-2">
                {s.topContextTags.map((e) => (
                  <Link key={e.label} to={`/diary?tag=${encodeURIComponent(e.label)}`} className="chip hover:border-accent"># {e.label} <span className="text-muted">x{e.count}</span></Link>
                ))}
              </div>
            </div>
          )}
          <p className="text-sm text-muted">
            This summary only counts what you recorded. It cannot know why you felt a certain way, and it is not a diagnosis or a score.
          </p>
        </div>
      )}
    </section>
  );
}

export function MoodGardenPage() {
  const today = new Date();
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [selected, setSelected] = useState<string | null>(null);
  const range = monthRangeIso(cursor.year, cursor.month);
  const data = useAsync(
    () => api.get<{ items: MoodCheckIn[] }>('/mood-checkins', { from: range.from, to: range.to, limit: 500 }),
    [cursor.year, cursor.month],
  );
  const [insightsKey, setInsightsKey] = useState(0);

  const byDay = useMemo(() => {
    const map = new Map<string, MoodCheckIn[]>();
    for (const c of data.data?.items ?? []) {
      const key = dayKey(c.recordedAt);
      map.set(key, [...(map.get(key) ?? []), c].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt)));
    }
    return map;
  }, [data.data]);

  const first = new Date(cursor.year, cursor.month, 1);
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(first.getDay()).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const todayKey = dayKey(today);
  const shift = (d: number) => {
    const next = new Date(cursor.year, cursor.month + d, 1);
    setCursor({ year: next.getFullYear(), month: next.getMonth() });
    setSelected(null);
  };
  const refresh = () => {
    data.reload();
    setInsightsKey((k) => k + 1);
  };
  const dayEntries = selected ? byDay.get(selected) ?? [] : [];

  return (
    <div className="space-y-10">
      <PageHeader title="Mood Garden" note="your garden will grow at its own pace" subtitle="Each feeling you record becomes a small bloom. There are no good or bad flowers here, only the ones that were true." />

      <section aria-labelledby="plant-title" className="paper p-6">
        <h2 id="plant-title" className="text-2xl">Plant a feeling</h2>
        <p className="mb-5 text-muted">How is it, right now? You can choose just one word.</p>
        <MoodCheckInForm onSaved={refresh} />
      </section>

      <section aria-labelledby="garden-title" className="space-y-4">
        <div className="paper p-4 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <button type="button" className="btn btn-quiet btn-sm" onClick={() => shift(-1)} aria-label="Previous month"><Icon name="chevronLeft" size={16} /></button>
            <h2 id="garden-title" className="text-xl" aria-live="polite">{formatMonthYear(first)}</h2>
            <button type="button" className="btn btn-quiet btn-sm" onClick={() => shift(1)} aria-label="Next month"><Icon name="chevronRight" size={16} /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted" aria-hidden="true">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d} className="py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1" role="grid" aria-label={`Mood garden for ${formatMonthYear(first)}`}>
            {cells.map((day, i) => {
              if (!day) return <div key={`b${i}`} />;
              const key = dayKey(new Date(cursor.year, cursor.month, day));
              const list = byDay.get(key) ?? [];
              const isSelected = selected === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="gridcell"
                  aria-pressed={isSelected}
                  aria-label={`${formatShortDate(startOfDayIso(key))}${list.length ? `: ${list.map((c) => c.mood).join(', ')}` : ''}`}
                  onClick={() => setSelected(isSelected ? null : key)}
                  className={`flex min-h-[58px] flex-col items-center rounded-xl border p-1 text-xs transition-colors sm:min-h-[76px] ${
                    isSelected ? 'border-accent bg-rose/25' : key === todayKey ? 'border-accent/60' : 'border-transparent hover:border-line hover:bg-surface-2'
                  }`}
                >
                  <span className="text-muted">{day}</span>
                  <span className="mt-0.5 flex flex-wrap items-center justify-center">
                    {list.slice(0, 3).map((c) => (
                      <Flower key={c.id} color={moodColor(c.mood)} intensity={c.intensity} size={list.length === 1 ? 36 : 22} />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
          {data.loading && <p className="mt-3 text-center text-sm text-muted" role="status">Tending the garden...</p>}
          {data.error && <div className="mt-3"><ErrorState error={data.error} onRetry={data.reload} /></div>}
          {!data.loading && !data.error && (data.data?.items.length ?? 0) === 0 && (
            <p className="mt-4 text-center text-muted">Nothing is growing this month yet. That is just fine.</p>
          )}
          <div className="mt-5 flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-4 text-xs text-muted" aria-label="Colour guide">
            {MOODS.map((m) => (
              <span key={m.label} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: m.color }} aria-hidden="true" />
                {m.label.replace(' / prefer not to say', '')}
              </span>
            ))}
          </div>
        </div>

        {selected && (
          <section aria-label={`Feelings on ${formatShortDate(startOfDayIso(selected))}`} className="space-y-4">
            <h3 className="text-xl">{formatShortDate(startOfDayIso(selected))}</h3>
            {dayEntries.length === 0 ? (
              <p className="text-muted">No feelings recorded on this day.</p>
            ) : (
              <ul className="space-y-3">
                {dayEntries.map((c) => <CheckInCard key={c.id} checkIn={c} onDeleted={refresh} />)}
              </ul>
            )}
            {selected !== todayKey && (
              <details className="paper p-4">
                <summary className="cursor-pointer font-medium">Add a feeling for this day</summary>
                <div className="mt-4">
                  <MoodCheckInForm recordedAt={new Date(`${selected}T12:00:00`).toISOString()} onSaved={refresh} submitLabel="Plant it on this day" />
                </div>
              </details>
            )}
          </section>
        )}
      </section>

      <Insights refreshKey={insightsKey} />
    </div>
  );
}
