import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useBlocker, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ConfirmDialog } from '../../components/Modal';
import { Icon } from '../../components/Icon';
import { Markdown } from '../../components/Markdown';
import { MoodPicker } from '../../components/MoodPicker';
import { ErrorState, InlineError, Loading } from '../../components/States';
import { TagInput } from '../../components/TagInput';
import { useToast } from '../../components/Toast';
import { api, ApiError } from '../../lib/api';
import { formatTime, fromLocalInput, toLocalInput, wordCount } from '../../lib/dates';
import { CONTEXT_SUGGESTIONS, EMOTION_SUGGESTIONS } from '../../lib/moods';
import { useAuth } from '../auth/AuthContext';
import { type SaveStatus, useEntryEditor } from './useEntryEditor';

function AutoTextarea({ value, onChange, className, ...rest }: { value: string; onChange: (v: string) => void; className?: string } & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return <textarea ref={ref} value={value} onChange={(e) => onChange(e.target.value)} className={className} {...rest} />;
}

export function SaveIndicator({ status, message, onRetry }: { status: SaveStatus; message: string | null; onRetry: () => void }) {
  return (
    <p aria-live="polite" role="status" className="flex min-h-[28px] items-center gap-2 text-sm text-muted">
      {status === 'saving' && 'Saving...'}
      {status === 'saved' && (
        <>
          <Icon name="check" size={14} /> Saved
        </>
      )}
      {status === 'dirty' && 'Unsaved changes'}
      {status === 'error' && (
        <span className="flex items-center gap-2">
          <span className="text-[#9a4a3a]">{message ?? 'Could not save.'}</span>
          <button type="button" className="btn btn-quiet btn-sm" onClick={onRetry}>
            Retry
          </button>
        </span>
      )}
    </p>
  );
}

export function EntryEditorPage() {
  const { id: routeId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { user } = useAuth();
  const editor = useEntryEditor(routeId);
  const { form, update } = editor;

  const [focusMode, setFocusMode] = useState(user?.preferences.defaultEditorMode === 'distraction-free');
  const [preview, setPreview] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [leaveWarning, setLeaveWarning] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  const prompt = (location.state as { prompt?: string } | null)?.prompt;

  // Reflect a freshly created draft in the URL without remounting the editor.
  useEffect(() => {
    editor.onCreated((id) => navigate(`/diary/write/${id}`, { replace: true, state: location.state }));
  });

  const blocker = useBlocker(({ nextLocation }) => !nextLocation.pathname.startsWith('/diary/write') && editor.hasUnsaved());

  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    void editor.saveNow().then((ok) => {
      if (ok) blocker.proceed();
      else setLeaveWarning(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocker.state]);

  useEffect(() => {
    if (!focusMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFocusMode(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focusMode]);

  if (editor.loading) return <Loading label="Opening your page..." />;
  if (editor.loadError) return <ErrorState error={editor.loadError} onRetry={editor.retryLoad} title="We could not open this page" />;

  const finish = async () => {
    setFinishing(true);
    setFinishError(null);
    const entry = await editor.finalize();
    setFinishing(false);
    if (entry) {
      toast('Saved to your diary.');
      navigate(`/diary/${entry.id}`);
    } else {
      setFinishError('Write a few words, then try again. Your work is kept safe as a draft.');
    }
  };

  const remove = async () => {
    if (!editor.entryId) {
      navigate('/diary');
      return;
    }
    setDeleting(true);
    try {
      await api.del(`/entries/${editor.entryId}`);
      try {
        localStorage.removeItem(`scrapbook:draft:${editor.entryId}`);
      } catch {
        /* ignore */
      }
      toast('That entry has been deleted.');
      navigate('/diary', { replace: true });
    } catch (err) {
      setConfirmDelete(false);
      setFinishError(err instanceof ApiError ? err.message : 'We could not delete that just now.');
    } finally {
      setDeleting(false);
    }
  };

  const insertScaffold = (text: string) => {
    const sep = form.body && !form.body.endsWith('\n\n') ? (form.body.endsWith('\n') ? '\n' : '\n\n') : '';
    update({ body: `${form.body}${sep}${text}\n\n` });
    setPreview(false);
  };

  const words = wordCount(form.body);

  const titleField = (
    <input
      aria-label="Entry title (optional)"
      className="w-full border-0 bg-transparent font-display text-3xl outline-none placeholder:text-muted/70 sm:text-4xl"
      placeholder="Give this page a title (optional)"
      value={form.title}
      maxLength={200}
      onChange={(e) => update({ title: e.target.value })}
    />
  );

  const bodyField = preview ? (
    <div className="min-h-[40vh]">
      {form.body.trim() ? <Markdown>{form.body}</Markdown> : <p className="text-muted">Nothing to preview yet.</p>}
    </div>
  ) : (
    <AutoTextarea
      aria-label="Entry body"
      className="writing-surface block min-h-[48vh] w-full resize-none border-0 bg-transparent outline-none placeholder:text-muted/70"
      placeholder={prompt ? `${prompt}\n\nWrite whatever comes, in any order.` : 'Start anywhere. There is no right way to do this.'}
      value={form.body}
      onChange={(body) => update({ body })}
      autoFocus
    />
  );

  const statusBar = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <SaveIndicator status={editor.status} message={editor.errorMessage} onRetry={() => void editor.saveNow()} />
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">{words} {words === 1 ? 'word' : 'words'}</span>
        <button type="button" className="btn btn-quiet btn-sm" aria-pressed={preview} onClick={() => setPreview((p) => !p)}>
          {preview ? 'Keep writing' : 'Preview'}
        </button>
        <button type="button" className="btn btn-quiet btn-sm" onClick={() => setFocusMode((f) => !f)} aria-pressed={focusMode}>
          <Icon name="expand" size={14} /> {focusMode ? 'Exit focus' : 'Focus mode'}
        </button>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => void finish()} disabled={finishing}>
          {finishing ? 'Saving...' : 'Save entry'}
        </button>
      </div>
    </div>
  );

  const dialogs = (
    <>
      <ConfirmDialog
        open={confirmDelete}
        title="Delete this entry?"
        message="This page will be permanently removed, along with any feeling recorded on it. This cannot be undone."
        confirmLabel="Delete permanently"
        busy={deleting}
        onConfirm={() => void remove()}
        onCancel={() => setConfirmDelete(false)}
      />
      <ConfirmDialog
        open={leaveWarning}
        title="Your latest words are not saved yet"
        message="We could not reach the server. A safety copy is kept on this device, and you can restore it next time you open this page."
        confirmLabel="Leave anyway"
        cancelLabel="Stay and retry"
        onConfirm={() => {
          setLeaveWarning(false);
          blocker.proceed?.();
        }}
        onCancel={() => {
          setLeaveWarning(false);
          blocker.reset?.();
        }}
      />
    </>
  );

  if (focusMode) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-bg">
        <div className="mx-auto flex min-h-full max-w-3xl flex-col gap-4 px-5 py-6 sm:px-8">
          {statusBar}
          {finishError && <InlineError>{finishError}</InlineError>}
          {titleField}
          <hr className="divider" />
          {bodyField}
          <p className="text-center text-sm text-muted">Press Escape to leave focus mode.</p>
        </div>
        {dialogs}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/diary" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
          <Icon name="chevronLeft" size={16} /> My Diary
        </Link>
        {editor.entryId && (
          <button type="button" className="btn btn-danger btn-sm" onClick={() => setConfirmDelete(true)}>
            <Icon name="trash" size={14} /> Delete
          </button>
        )}
      </div>

      {editor.recovery && (
        <div role="alert" className="paper flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <p className="text-sm">
            We kept a safety copy of some writing from {formatTime(editor.recovery.savedAt)} that was not saved. Would you like it back?
          </p>
          <div className="flex gap-2">
            <button type="button" className="btn btn-primary btn-sm" onClick={editor.restoreRecovery}>
              Restore it
            </button>
            <button type="button" className="btn btn-quiet btn-sm" onClick={editor.discardRecovery}>
              Let it go
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <section className="paper relative px-5 pb-6 pt-8 sm:px-8" aria-label="Diary page">
          <span className="tape" aria-hidden="true" />
          {prompt && (
            <p className="hand mb-2">
              {prompt}
            </p>
          )}
          {titleField}
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <label htmlFor="entry-date" className="sr-only">
              Date and time
            </label>
            <input
              id="entry-date"
              type="datetime-local"
              className="field !min-h-[36px] !w-auto text-sm"
              value={toLocalInput(form.entryDate)}
              onChange={(e) => {
                const iso = fromLocalInput(e.target.value);
                if (iso) update({ entryDate: iso });
              }}
            />
            {editor.isDraft && editor.entryId && <span className="stamp">Draft</span>}
          </div>
          <hr className="divider my-4" />
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted">If it helps:</span>
            <button type="button" className="chip chip-toggle" aria-pressed="false" onClick={() => insertScaffold('**What happened?**')}>
              What happened?
            </button>
            <button type="button" className="chip chip-toggle" aria-pressed="false" onClick={() => insertScaffold('**How did it make me feel?**')}>
              How did it make me feel?
            </button>
          </div>
          {bodyField}
          <p className="mt-2 text-xs text-muted">Markdown is supported: **bold**, *italic*, lists and &gt; quotes. Line breaks are kept as you write them.</p>
          <hr className="divider my-4" />
          {finishError && <div className="mb-3"><InlineError>{finishError}</InlineError></div>}
          {statusBar}
        </section>

        <aside className="space-y-5" aria-label="Details">
          <section className="paper space-y-4 p-5">
            <h2 className="text-lg">How are you feeling?</h2>
            <p className="-mt-2 text-sm text-muted">Optional. Skip it freely.</p>
            <MoodPicker mood={form.mood} onMoodChange={(mood) => update({ mood, ...(mood ? {} : { intensity: null }) })} intensity={form.intensity} onIntensityChange={(intensity) => update({ intensity })} compact />
            <TagInput id="emotions" label="Other feelings" value={form.emotions} onChange={(emotions) => update({ emotions })} suggestions={EMOTION_SUGGESTIONS} />
          </section>
          <section className="paper p-5">
            <TagInput id="context" label="What is this about?" value={form.contextTags} onChange={(contextTags) => update({ contextTags })} suggestions={CONTEXT_SUGGESTIONS} />
          </section>
        </aside>
      </div>
      {dialogs}
    </div>
  );
}
