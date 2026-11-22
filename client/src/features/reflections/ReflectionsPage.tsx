import { useState, type FormEvent } from 'react';
import { Icon, type IconName } from '../../components/Icon';
import { Markdown } from '../../components/Markdown';
import { ConfirmDialog, Modal } from '../../components/Modal';
import { EmptyState, ErrorState, InlineError, Loading, PageHeader } from '../../components/States';
import { useToast } from '../../components/Toast';
import { api, ApiError } from '../../lib/api';
import { dayKey, daysAgoIso, formatShortDate, fromLocalInput } from '../../lib/dates';
import { useAsync } from '../../lib/hooks';
import type { Paged, Reflection, ReflectionType } from '../../types';
import {
  CARRYING_QUESTIONS,
  DAILY_PROMPTS,
  LEARNED_QUESTIONS,
  MONTHLY_QUESTIONS,
  REFLECTION_LABELS,
  WEEKLY_QUESTIONS,
  promptForDay,
} from './prompts';

interface Kind {
  type: ReflectionType;
  title: string;
  blurb: string;
  icon: IconName;
}

const KINDS: Kind[] = [
  { type: 'daily', title: 'A question for today', blurb: 'One gentle prompt, answered in your own time.', icon: 'pen' },
  { type: 'weekly', title: 'Weekly reflection', blurb: 'Look back over the last seven days.', icon: 'calendar' },
  { type: 'monthly', title: 'Monthly reflection', blurb: 'A slower look at the month so far.', icon: 'book' },
  { type: 'future-letter', title: 'Letter to my future self', blurb: 'Write now, open it later.', icon: 'mail' },
  { type: 'learned', title: 'What did I learn?', blurb: 'Notice what has quietly changed.', icon: 'spark' },
  { type: 'carrying', title: 'What am I carrying?', blurb: 'Name it, then decide what to keep.', icon: 'flower' },
];

const GUIDED: Partial<Record<ReflectionType, string[]>> = {
  weekly: WEEKLY_QUESTIONS,
  monthly: MONTHLY_QUESTIONS,
  learned: LEARNED_QUESTIONS,
  carrying: CARRYING_QUESTIONS,
};

function Composer({ kind, onClose, onSaved }: { kind: Kind; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const guided = GUIDED[kind.type];
  const [promptIndex, setPromptIndex] = useState(DAILY_PROMPTS.indexOf(promptForDay()));
  const [answers, setAnswers] = useState<string[]>(() => (guided ?? ['']).map(() => ''));
  const [title, setTitle] = useState(kind.type === 'future-letter' ? 'A letter to future me' : '');
  const [openOn, setOpenOn] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return dayKey(d);
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const questions = guided ?? [kind.type === 'daily' ? DAILY_PROMPTS[promptIndex]! : 'Dear future me,'];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const parts = guided
      ? questions.map((q, i) => ({ q, a: answers[i]?.trim() ?? '' })).filter((p) => p.a)
      : [{ q: '', a: answers[0]?.trim() ?? '' }].filter((p) => p.a);
    if (parts.length === 0) {
      setError('Write a few words, or simply skip this one. There is no pressure either way.');
      return;
    }
    const response = guided ? parts.map((p) => `**${p.q}**\n\n${p.a}`).join('\n\n') : parts[0]!.a;
    const now = new Date();
    const period =
      kind.type === 'weekly'
        ? { periodStart: daysAgoIso(6), periodEnd: now.toISOString() }
        : kind.type === 'monthly'
          ? { periodStart: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(), periodEnd: now.toISOString() }
          : kind.type === 'future-letter'
            ? { periodStart: null, periodEnd: openOn ? fromLocalInput(`${openOn}T09:00`) : null }
            : {};
    setBusy(true);
    setError(null);
    try {
      await api.post('/reflections', {
        type: kind.type,
        title: kind.type === 'future-letter' ? title || null : kind.title,
        prompt: kind.type === 'daily' ? DAILY_PROMPTS[promptIndex] : null,
        response,
        ...period,
      });
      toast('Your reflection is saved, just for you.');
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'We could not save that just now.');
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      {kind.type === 'daily' && (
        <div>
          <p className="font-display text-2xl leading-snug">{DAILY_PROMPTS[promptIndex]}</p>
          <button type="button" className="mt-2 text-sm text-accent underline underline-offset-2" onClick={() => setPromptIndex((i) => (i + 1) % DAILY_PROMPTS.length)}>
            Offer me a different question
          </button>
        </div>
      )}
      {kind.type === 'future-letter' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="letter-title" className="label">Title</label>
            <input id="letter-title" className="field" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          </div>
          <div>
            <label htmlFor="letter-open" className="label">Open it on</label>
            <input id="letter-open" type="date" className="field" value={openOn} onChange={(e) => setOpenOn(e.target.value)} />
          </div>
        </div>
      )}
      {(guided ?? ['']).map((_, i) => (
        <div key={i}>
          {guided && <label htmlFor={`answer-${i}`} className="label !text-base !text-ink">{questions[i]}</label>}
          {!guided && kind.type === 'future-letter' && <label htmlFor={`answer-${i}`} className="label">Dear future me,</label>}
          {!guided && kind.type === 'daily' && <label htmlFor={`answer-${i}`} className="sr-only">Your answer</label>}
          <textarea
            id={`answer-${i}`}
            className="field writing-surface"
            rows={guided ? 3 : 8}
            value={answers[i]}
            onChange={(e) => setAnswers((prev) => prev.map((a, j) => (j === i ? e.target.value : a)))}
            placeholder={guided ? 'Skip this one if you like' : 'Take your time'}
          />
        </div>
      ))}
      {error && <InlineError>{error}</InlineError>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn btn-quiet" onClick={onClose}>Skip for now</button>
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving...' : kind.type === 'future-letter' ? 'Seal the letter' : 'Save reflection'}</button>
      </div>
    </form>
  );
}

function EditForm({ reflection, onClose, onSaved }: { reflection: Reflection; onClose: () => void; onSaved: () => void }) {
  const [response, setResponse] = useState(reflection.response);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.patch(`/reflections/${reflection.id}`, { response });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.issues[0]?.message ?? err.message : 'We could not save that.');
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <label htmlFor="edit-response" className="label">Your words</label>
      <textarea id="edit-response" className="field writing-surface" rows={10} value={response} onChange={(e) => setResponse(e.target.value)} />
      {error && <InlineError>{error}</InlineError>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn btn-quiet" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={busy}>Save changes</button>
      </div>
    </form>
  );
}

function SavedCard({ r, onEdit, onDelete }: { r: Reflection; onEdit: () => void; onDelete: () => void }) {
  const sealed = r.type === 'future-letter' && r.periodEnd !== null && new Date(r.periodEnd).getTime() > Date.now();
  const [peek, setPeek] = useState(false);
  const hidden = sealed && !peek;
  return (
    <li className="paper relative p-5 pt-7">
      <span className="tape" aria-hidden="true" />
      <div className="flex flex-wrap items-center gap-2">
        <span className="stamp">{REFLECTION_LABELS[r.type]}</span>
        <span className="text-sm text-muted">{formatShortDate(r.createdAt)}</span>
      </div>
      {r.title && r.type === 'future-letter' && <h3 className="mt-2 text-xl">{r.title}</h3>}
      {r.prompt && <p className="hand mt-2">{r.prompt}</p>}
      {hidden ? (
        <div className="mt-3 rounded-lg bg-surface-2 p-4 text-center">
          <Icon name="lock" className="mx-auto mb-1 text-muted" />
          <p>Sealed until {formatShortDate(r.periodEnd!)}.</p>
          <button type="button" className="mt-2 text-sm text-accent underline underline-offset-2" onClick={() => setPeek(true)}>
            Open it early
          </button>
        </div>
      ) : (
        <div className="mt-3"><Markdown>{r.response}</Markdown></div>
      )}
      <div className="mt-3 flex gap-2">
        {!hidden && <button type="button" className="btn btn-quiet btn-sm" onClick={onEdit}><Icon name="edit" size={14} /> Edit</button>}
        <button type="button" className="btn btn-danger btn-sm" onClick={onDelete} aria-label="Delete reflection"><Icon name="trash" size={14} /></button>
      </div>
    </li>
  );
}

export function ReflectionsPage() {
  const toast = useToast();
  const [filter, setFilter] = useState<'' | ReflectionType>('');
  const [composing, setComposing] = useState<Kind | null>(null);
  const [editing, setEditing] = useState<Reflection | null>(null);
  const [deleting, setDeleting] = useState<Reflection | null>(null);
  const [busy, setBusy] = useState(false);
  const list = useAsync(() => api.get<Paged<Reflection>>('/reflections', { type: filter, limit: 100 }), [filter]);

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.del(`/reflections/${deleting.id}`);
      toast('That reflection has been deleted.');
      setDeleting(null);
      list.reload();
    } catch {
      toast('We could not delete that just now.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-10">
      <PageHeader title="Reflections" note="only if you feel like it" subtitle="Gentle questions for noticing yourself. Every prompt is optional, and every one can be skipped." />

      <section aria-labelledby="start-title">
        <h2 id="start-title" className="sr-only">Start a reflection</h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {KINDS.map((k, i) => (
            <li key={k.type}>
              <button
                type="button"
                onClick={() => setComposing(k)}
                className="paper paper-lift flex h-full w-full flex-col items-start gap-2 p-5 text-left"
                style={{ ['--tilt' as string]: `${[-0.8, 0.6, -0.4][i % 3]}deg` }}
              >
                <Icon name={k.icon} size={24} className="text-accent" />
                <span className="font-display text-xl">{k.title}</span>
                <span className="text-sm text-muted">{k.blurb}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="saved-title" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="saved-title" className="text-2xl">Your reflections</h2>
          <div>
            <label htmlFor="r-filter" className="sr-only">Show</label>
            <select id="r-filter" className="field !w-auto" value={filter} onChange={(e) => setFilter(e.target.value as '' | ReflectionType)}>
              <option value="">Everything</option>
              {Object.entries(REFLECTION_LABELS).filter(([k]) => k !== 'custom').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
        {list.loading && <Loading label="Gathering your reflections..." />}
        {list.error && <ErrorState error={list.error} onRetry={list.reload} />}
        {list.data && list.data.items.length === 0 && (
          <EmptyState title="Nothing here yet">
            Reflections you save will gather here. You can come back to this whenever you are ready.
          </EmptyState>
        )}
        {list.data && list.data.items.length > 0 && (
          <ul className="grid gap-5 md:grid-cols-2">
            {list.data.items.map((r) => (
              <SavedCard key={r.id} r={r} onEdit={() => setEditing(r)} onDelete={() => setDeleting(r)} />
            ))}
          </ul>
        )}
      </section>

      <Modal open={composing !== null} title={composing?.title ?? ''} onClose={() => setComposing(null)} wide>
        {composing && <Composer kind={composing} onClose={() => setComposing(null)} onSaved={list.reload} />}
      </Modal>
      <Modal open={editing !== null} title="Edit reflection" onClose={() => setEditing(null)} wide>
        {editing && <EditForm reflection={editing} onClose={() => setEditing(null)} onSaved={list.reload} />}
      </Modal>
      <ConfirmDialog
        open={deleting !== null}
        title="Delete this reflection?"
        message="It will be permanently removed. This cannot be undone."
        confirmLabel="Delete permanently"
        busy={busy}
        onConfirm={() => void remove()}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
