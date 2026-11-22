import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { ConfirmDialog, Modal } from '../../components/Modal';
import { EmptyState, ErrorState, InlineError, Loading, PageHeader } from '../../components/States';
import { TagInput } from '../../components/TagInput';
import { useToast } from '../../components/Toast';
import { api, ApiError } from '../../lib/api';
import { formatLongDate, fromLocalInput, toLocalInput } from '../../lib/dates';
import { useDebouncedValue } from '../../lib/hooks';
import { entryTitle } from '../../lib/text';
import type { Entry, Memory, Paged } from '../../types';

interface MemoryPage extends Paged<Memory> {
  facets: { years: number[]; tags: string[] };
}

const WASHES = ['#E9D5C4', '#DCE3D5', '#EBD3D0', '#E6DEC3', '#D9DFE3', '#E4D6E0'];
const PAGE_SIZE = 24;

interface FormState {
  title: string;
  description: string;
  date: string;
  locationLabel: string;
  peopleLabels: string[];
  tags: string[];
  linkedEntryId: string;
}

const blank = (): FormState => ({
  title: '',
  description: '',
  date: toLocalInput(new Date().toISOString()).slice(0, 10),
  locationLabel: '',
  peopleLabels: [],
  tags: [],
  linkedEntryId: '',
});

function MemoryForm({ memory, onClose, onSaved }: { memory: Memory | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState<FormState>(
    memory
      ? {
          title: memory.title,
          description: memory.description ?? '',
          date: toLocalInput(memory.memoryDate).slice(0, 10),
          locationLabel: memory.locationLabel ?? '',
          peopleLabels: memory.peopleLabels,
          tags: memory.tags,
          linkedEntryId: memory.linkedEntryId ?? '',
        }
      : blank(),
  );
  const [entries, setEntries] = useState<Entry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<Paged<Entry>>('/entries', { limit: 100, drafts: 'exclude' }).then((r) => setEntries(r.items), () => undefined);
  }, []);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setError('Give this moment a name, even a short one.');
      return;
    }
    setBusy(true);
    setError(null);
    const body = {
      title: form.title,
      description: form.description || null,
      memoryDate: fromLocalInput(`${form.date}T12:00`) ?? new Date().toISOString(),
      locationLabel: form.locationLabel || null,
      peopleLabels: form.peopleLabels,
      tags: form.tags,
      linkedEntryId: form.linkedEntryId || null,
    };
    try {
      if (memory) await api.patch(`/memories/${memory.id}`, body);
      else await api.post('/memories', body);
      toast(memory ? 'Memory updated.' : 'A moment worth keeping, saved.');
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.issues[0]?.message ?? err.message : 'We could not save that. Please try again.');
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="mem-title" className="label">Title</label>
        <input id="mem-title" className="field" value={form.title} onChange={(e) => set('title', e.target.value)} maxLength={200} autoFocus />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="mem-date" className="label">Date</label>
          <input id="mem-date" type="date" className="field" value={form.date} onChange={(e) => set('date', e.target.value)} required />
        </div>
        <div>
          <label htmlFor="mem-place" className="label">Place (optional)</label>
          <input id="mem-place" className="field" value={form.locationLabel} onChange={(e) => set('locationLabel', e.target.value)} maxLength={120} placeholder="Typed by you, never detected" />
        </div>
      </div>
      <div>
        <label htmlFor="mem-desc" className="label">The story, in a few words (optional)</label>
        <textarea id="mem-desc" className="field" rows={4} value={form.description} onChange={(e) => set('description', e.target.value)} maxLength={10000} />
      </div>
      <TagInput id="mem-people" label="People (optional)" value={form.peopleLabels} onChange={(v) => set('peopleLabels', v)} placeholder="A name or nickname" />
      <TagInput id="mem-tags" label="Tags (optional)" value={form.tags} onChange={(v) => set('tags', v)} />
      <div>
        <label htmlFor="mem-entry" className="label">Link a diary page (optional)</label>
        <select id="mem-entry" className="field" value={form.linkedEntryId} onChange={(e) => set('linkedEntryId', e.target.value)}>
          <option value="">No link</option>
          {entries.map((en) => (
            <option key={en.id} value={en.id}>
              {new Date(en.entryDate).toLocaleDateString()} - {entryTitle(en)}
            </option>
          ))}
        </select>
      </div>
      {error && <InlineError>{error}</InlineError>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn btn-quiet" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving...' : memory ? 'Save changes' : 'Keep this memory'}</button>
      </div>
    </form>
  );
}

function Polaroid({ memory, index, onEdit, onDelete }: { memory: Memory; index: number; onEdit: () => void; onDelete: () => void }) {
  const d = new Date(memory.memoryDate);
  const tilt = [-1.5, 1.2, -0.8, 1.6][index % 4]!;
  const wash = WASHES[index % WASHES.length]!;
  return (
    <li className="relative" style={{ ['--tilt' as string]: `${tilt}deg` }}>
      <article className="paper paper-lift relative p-3 pb-5">
        <span className="tape" style={{ ['--tape-rot' as string]: `${-tilt * 2}deg` }} aria-hidden="true" />
        <div className="flex aspect-[4/3] flex-col items-center justify-center rounded-md" style={{ background: wash, color: '#4a3f35' }} aria-hidden="true">
          <span className="font-display text-5xl leading-none">{d.getDate()}</span>
          <span className="hand !text-[#6b4a3c]">{new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(d)}</span>
        </div>
        <div className="px-2 pt-4">
          <h3 className="text-xl">{memory.title}</h3>
          <p className="sr-only">{formatLongDate(memory.memoryDate)}</p>
          {memory.locationLabel && (
            <p className="mt-0.5 flex items-center gap-1 text-sm text-muted"><Icon name="pin" size={14} /> {memory.locationLabel}</p>
          )}
          {memory.description && <p className="mt-2 whitespace-pre-wrap text-sm">{memory.description}</p>}
          {(memory.peopleLabels.length > 0 || memory.tags.length > 0) && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {memory.peopleLabels.map((p) => <span key={`p-${p}`} className="chip">with {p}</span>)}
              {memory.tags.map((t) => <span key={`t-${t}`} className="chip"># {t}</span>)}
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {memory.linkedEntryId && <Link to={`/diary/${memory.linkedEntryId}`} className="btn btn-quiet btn-sm">Read the diary page</Link>}
            <button type="button" className="btn btn-quiet btn-sm" onClick={onEdit} aria-label={`Edit ${memory.title}`}><Icon name="edit" size={14} /> Edit</button>
            <button type="button" className="btn btn-danger btn-sm" onClick={onDelete} aria-label={`Delete ${memory.title}`}><Icon name="trash" size={14} /></button>
          </div>
        </div>
      </article>
    </li>
  );
}

export function MemoryLanePage() {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [year, setYear] = useState('');
  const [tag, setTag] = useState('');
  const debouncedQ = useDebouncedValue(q, 300);
  const [items, setItems] = useState<Memory[]>([]);
  const [total, setTotal] = useState(0);
  const [facets, setFacets] = useState<MemoryPage['facets']>({ years: [], tags: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);
  const [editing, setEditing] = useState<Memory | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Memory | null>(null);
  const [busy, setBusy] = useState(false);

  const params = useCallback((offset: number) => ({ q: debouncedQ, year, tag, limit: PAGE_SIZE, offset }), [debouncedQ, year, tag]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.get<MemoryPage>('/memories', params(0)).then(
      (res) => {
        if (cancelled) return;
        setItems(res.items);
        setTotal(res.total);
        setFacets(res.facets);
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
  }, [params, tick]);

  const more = async () => {
    const res = await api.get<MemoryPage>('/memories', params(items.length));
    setItems((prev) => [...prev, ...res.items]);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.del(`/memories/${deleting.id}`);
      toast('That memory has been deleted.');
      setDeleting(null);
      setTick((t) => t + 1);
    } catch {
      toast('We could not delete that just now.');
    } finally {
      setBusy(false);
    }
  };

  const filtered = Boolean(q || year || tag);
  const byYear = items.reduce<{ year: number; list: Memory[] }[]>((acc, m) => {
    const y = new Date(m.memoryDate).getFullYear();
    const last = acc[acc.length - 1];
    if (last?.year === y) last.list.push(m);
    else acc.push({ year: y, list: [m] });
    return acc;
  }, []);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Memory Lane"
        note="a moment worth keeping"
        subtitle="Small moments, pressed between the pages."
        actions={<button type="button" className="btn btn-primary" onClick={() => setEditing('new')}><Icon name="plus" size={16} /> Add a memory</button>}
      />

      <div className="paper flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[12rem] flex-1">
          <label htmlFor="mem-search" className="label">Search</label>
          <input id="mem-search" type="search" className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Titles, stories, places" />
        </div>
        <div>
          <label htmlFor="mem-year" className="label">Year</label>
          <select id="mem-year" className="field" value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="">All years</option>
            {facets.years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="mem-tag" className="label">Tag or person</label>
          <select id="mem-tag" className="field" value={tag} onChange={(e) => setTag(e.target.value)}>
            <option value="">Anyone, anything</option>
            {facets.tags.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        {filtered && <button type="button" className="btn btn-quiet" onClick={() => { setQ(''); setYear(''); setTag(''); }}>Clear</button>}
      </div>

      {loading && <Loading label="Unpacking your memories..." />}
      {error && !loading && <ErrorState error={error} onRetry={() => setTick((t) => t + 1)} />}
      {!loading && !error && items.length === 0 && (
        filtered ? (
          <EmptyState title="No memories match that" action={<button type="button" className="btn btn-primary" onClick={() => { setQ(''); setYear(''); setTag(''); }}>Clear search</button>}>
            Try a different word, year or tag.
          </EmptyState>
        ) : (
          <EmptyState title="Your timeline is ready for its first moment" action={<button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>Add a memory</button>}>
            A trip, a conversation, a small ordinary afternoon. Anything you would like to keep.
          </EmptyState>
        )
      )}

      {!loading && !error && byYear.map((group) => (
        <section key={group.year} aria-labelledby={`y-${group.year}`}>
          <h2 id={`y-${group.year}`} className="mb-6 flex items-center gap-4">
            <span className="stamp !text-base">{group.year}</span>
            <span className="h-px flex-1 divider" aria-hidden="true" />
          </h2>
          <ol className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {group.list.map((m) => (
              <Polaroid key={m.id} memory={m} index={items.indexOf(m)} onEdit={() => setEditing(m)} onDelete={() => setDeleting(m)} />
            ))}
          </ol>
        </section>
      ))}

      {!loading && items.length < total && (
        <div className="text-center">
          <button type="button" className="btn btn-quiet" onClick={() => void more()}>Show more</button>
        </div>
      )}

      <Modal open={editing !== null} title={editing === 'new' ? 'A moment worth keeping' : 'Edit this memory'} onClose={() => setEditing(null)} wide>
        {editing !== null && <MemoryForm memory={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => setTick((t) => t + 1)} />}
      </Modal>
      <ConfirmDialog
        open={deleting !== null}
        title="Delete this memory?"
        message={`"${deleting?.title ?? ''}" will be permanently removed. Linked diary pages are not affected.`}
        confirmLabel="Delete permanently"
        busy={busy}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
