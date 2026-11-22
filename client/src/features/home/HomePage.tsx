import { Link } from 'react-router-dom';
import { Flower } from '../../components/Flower';
import { ErrorState } from '../../components/States';
import { useAuth } from '../auth/AuthContext';
import { api } from '../../lib/api';
import { dayKey, formatLongDate, formatShortDate, greetingFor, localTimezone } from '../../lib/dates';
import { useAsync } from '../../lib/hooks';
import { moodColor } from '../../lib/moods';
import { entryTitle, excerpt } from '../../lib/text';
import type { Entry, Paged } from '../../types';
import { MoodCheckInForm } from '../mood/MoodCheckInForm';
import { DAILY_PROMPTS, promptForDay } from '../reflections/prompts';

function Snippet({ entry, tilt }: { entry: Entry; tilt: number }) {
  return (
    <Link
      to={`/diary/${entry.id}`}
      className="paper paper-lift relative block p-4 pt-6"
      style={{ ['--tilt' as string]: `${tilt}deg` }}
    >
      <span className="tape" style={{ ['--tape-rot' as string]: `${tilt * 2}deg` }} aria-hidden="true" />
      <p className="stamp">{formatShortDate(entry.entryDate)}</p>
      <h3 className="mt-3 text-lg">{entryTitle(entry)}</h3>
      <p className="mt-1 line-clamp-3 text-sm text-muted">{excerpt(entry.body, 150)}</p>
      {entry.mood && (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted">
          <Flower color={moodColor(entry.mood)} intensity={entry.intensity} size={22} />
          {entry.mood}
        </p>
      )}
    </Link>
  );
}

export function HomePage() {
  const { user } = useAuth();
  const today = new Date();
  const recent = useAsync(() => api.get<Paged<Entry>>('/entries', { limit: 3, drafts: 'exclude' }), []);
  const draft = useAsync(() => api.get<Paged<Entry>>('/entries', { limit: 1, drafts: 'only' }), []);
  const onThisDay = useAsync(
    () => api.get<{ entry: Entry | null }>('/entries/on-this-day', { date: dayKey(today), tz: localTimezone() }),
    [dayKey(today)],
  );

  const prompt = promptForDay(today);
  const reflectionPrompt = DAILY_PROMPTS[(DAILY_PROMPTS.indexOf(prompt) + 5) % DAILY_PROMPTS.length]!;
  const name = user?.displayName;
  const pendingDraft = draft.data?.items[0];

  return (
    <div className="space-y-12">
      <section className="rise grid items-center gap-6 md:grid-cols-[1.4fr_1fr]">
        <div>
          <p className="hand">{formatLongDate(today.toISOString())}</p>
          <h1 className="text-4xl sm:text-5xl">
            {greetingFor(today)}
            {name ? `, ${name}` : ''}.
          </h1>
          <p className="mt-3 max-w-prose text-lg text-muted">Would you like to write a little today? There is no right way to begin, and nothing you need to catch up on.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/diary/write" className="btn btn-primary">
              Write today's entry
            </Link>
            {pendingDraft && (
              <Link to={`/diary/write/${pendingDraft.id}`} className="btn btn-quiet">
                Continue your draft
              </Link>
            )}
          </div>
        </div>
        <div className="paper relative rotate-1 p-6 pt-8" style={{ ['--tape-rot' as string]: '3deg' }}>
          <span className="tape" aria-hidden="true" />
          <p className="hand">today's question</p>
          <p className="mt-1 font-display text-2xl leading-snug">{prompt}</p>
          <Link to="/diary/write" state={{ prompt }} className="mt-4 inline-block text-sm text-accent underline underline-offset-2">
            Write about this
          </Link>
          <span className="ml-3 text-sm text-muted">or skip it. Free writing is always welcome.</span>
        </div>
      </section>

      <section aria-labelledby="checkin-title" className="paper p-6">
        <h2 id="checkin-title" className="text-2xl">How are you feeling right now?</h2>
        <p className="mb-5 text-muted">Pick whatever is closest. You can leave this blank any day.</p>
        <MoodCheckInForm />
      </section>

      <section aria-labelledby="recent-title">
        <div className="mb-4 flex items-end justify-between">
          <h2 id="recent-title" className="text-2xl">Recent pages</h2>
          <Link to="/diary" className="text-sm text-accent underline underline-offset-2">
            Open my diary
          </Link>
        </div>
        {recent.loading && <p className="text-muted" role="status">Finding your recent pages...</p>}
        {recent.error && <ErrorState error={recent.error} onRetry={recent.reload} />}
        {recent.data && recent.data.items.length === 0 && (
          <div className="paper p-8 text-center">
            <p className="font-display text-xl">A blank page is a lovely place to begin.</p>
            <p className="mt-1 text-muted">Whenever you are ready, your first entry will appear here.</p>
          </div>
        )}
        {recent.data && recent.data.items.length > 0 && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {recent.data.items.map((entry, i) => (
              <Snippet key={entry.id} entry={entry} tilt={[-1.2, 0.8, -0.6][i % 3]!} />
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-8 md:grid-cols-2">
        {onThisDay.data?.entry && (
          <section aria-labelledby="otd-title" className="paper relative p-6 pt-8">
            <span className="tape" aria-hidden="true" />
            <p className="hand">on this day</p>
            <h2 id="otd-title" className="text-xl">{formatShortDate(onThisDay.data.entry.entryDate)}</h2>
            <p className="mt-2 text-muted">{excerpt(onThisDay.data.entry.body, 160)}</p>
            <Link to={`/diary/${onThisDay.data.entry.id}`} className="mt-3 inline-block text-sm text-accent underline underline-offset-2">
              Revisit this page
            </Link>
          </section>
        )}
        <section aria-labelledby="reflect-title" className="paper p-6">
          <p className="hand">something to consider</p>
          <h2 id="reflect-title" className="font-display text-2xl leading-snug">{reflectionPrompt}</h2>
          <Link to="/reflections" className="mt-3 inline-block text-sm text-accent underline underline-offset-2">
            Reflect, only if you want to
          </Link>
        </section>
      </div>
    </div>
  );
}
