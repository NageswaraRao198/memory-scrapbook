import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Flower } from '../../components/Flower';
import { Icon } from '../../components/Icon';
import { Markdown } from '../../components/Markdown';
import { ConfirmDialog } from '../../components/Modal';
import { ErrorState, InlineError, Loading } from '../../components/States';
import { useToast } from '../../components/Toast';
import { api, ApiError } from '../../lib/api';
import { formatLongDate, formatTime } from '../../lib/dates';
import { useAsync } from '../../lib/hooks';
import { INTENSITY_LABELS, moodColor } from '../../lib/moods';
import type { Entry } from '../../types';

export function EntryDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const entry = useAsync(() => api.get<{ entry: Entry }>(`/entries/${id}`).then((r) => r.entry), [id]);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (entry.loading) return <Loading label="Opening your page..." />;
  if (entry.error || !entry.data) {
    return <ErrorState error={entry.error ?? new Error('Missing')} onRetry={entry.reload} title="We could not open this page" />;
  }
  const e = entry.data;

  const remove = async () => {
    setBusy(true);
    try {
      await api.del(`/entries/${e.id}`);
      toast('That entry has been deleted.');
      navigate('/diary', { replace: true });
    } catch (err) {
      setConfirming(false);
      setError(err instanceof ApiError ? err.message : 'We could not delete that just now.');
      setBusy(false);
    }
  };

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/diary" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
          <Icon name="chevronLeft" size={16} /> My Diary
        </Link>
        <div className="flex gap-2">
          <Link to={`/diary/write/${e.id}`} className="btn btn-quiet btn-sm">
            <Icon name="edit" size={14} /> Edit
          </Link>
          <button type="button" className="btn btn-danger btn-sm" onClick={() => setConfirming(true)}>
            <Icon name="trash" size={14} /> Delete
          </button>
        </div>
      </div>
      {error && <InlineError>{error}</InlineError>}

      <div className="paper relative px-6 pb-8 pt-10 sm:px-10">
        <span className="tape" aria-hidden="true" />
        <div className="flex flex-wrap items-center gap-3">
          <p className="hand">{formatLongDate(e.entryDate)}</p>
          <span className="text-sm text-muted">{formatTime(e.entryDate)}</span>
          {e.isDraft && <span className="stamp">Draft</span>}
        </div>
        <h1 className="mt-1 text-3xl sm:text-4xl">{e.title || 'Untitled page'}</h1>
        <hr className="divider my-5" />
        {e.body.trim() ? <Markdown>{e.body}</Markdown> : <p className="text-muted">This page is still blank.</p>}

        {(e.mood || e.emotions.length > 0 || e.contextTags.length > 0) && (
          <>
            <hr className="divider my-6" />
            <div className="space-y-3">
              {e.mood && (
                <p className="flex items-center gap-3">
                  <Flower color={moodColor(e.mood)} intensity={e.intensity} size={34} />
                  <span>
                    Feeling <strong className="font-medium">{e.mood.toLowerCase()}</strong>
                    {e.intensity ? <span className="text-muted"> ({INTENSITY_LABELS[e.intensity - 1]?.toLowerCase()})</span> : null}
                  </span>
                </p>
              )}
              {e.emotions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {e.emotions.map((t) => (
                    <span key={t} className="chip">{t}</span>
                  ))}
                </div>
              )}
              {e.contextTags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {e.contextTags.map((t) => (
                    <Link key={t} to={`/diary?tag=${encodeURIComponent(t)}`} className="chip hover:border-accent">
                      # {t}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        open={confirming}
        title="Delete this entry?"
        message="This page will be permanently removed, along with any feeling recorded on it. This cannot be undone."
        confirmLabel="Delete permanently"
        busy={busy}
        onConfirm={() => void remove()}
        onCancel={() => setConfirming(false)}
      />
    </article>
  );
}
