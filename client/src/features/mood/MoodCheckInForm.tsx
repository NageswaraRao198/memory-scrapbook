import { useState, type FormEvent } from 'react';
import { InlineError } from '../../components/States';
import { MoodPicker } from '../../components/MoodPicker';
import { TagInput } from '../../components/TagInput';
import { useToast } from '../../components/Toast';
import { api, ApiError } from '../../lib/api';
import { EMOTION_SUGGESTIONS } from '../../lib/moods';
import type { MoodCheckIn } from '../../types';

interface Props {
  recordedAt?: string;
  onSaved?: (checkIn: MoodCheckIn) => void;
  submitLabel?: string;
}

export function MoodCheckInForm({ recordedAt, onSaved, submitLabel = 'Add to my garden' }: Props) {
  const toast = useToast();
  const [mood, setMood] = useState<string | null>(null);
  const [intensity, setIntensity] = useState<number | null>(null);
  const [emotions, setEmotions] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [detail, setDetail] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!mood) {
      setError('Choose the feeling that fits best, or the closest one.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { checkIn } = await api.post<{ checkIn: MoodCheckIn }>('/mood-checkins', {
        mood,
        intensity,
        emotions,
        note: note || null,
        ...(recordedAt ? { recordedAt } : {}),
      });
      toast('A new bloom has been planted.');
      setMood(null);
      setIntensity(null);
      setEmotions([]);
      setNote('');
      setDetail(false);
      onSaved?.(checkIn);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'We could not save that just now. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" aria-label="Mood check-in">
      <MoodPicker mood={mood} onMoodChange={setMood} intensity={intensity} onIntensityChange={setIntensity} compact />
      {mood && (
        <>
          <button type="button" className="text-sm text-accent underline underline-offset-2" onClick={() => setDetail((d) => !d)} aria-expanded={detail}>
            {detail ? 'Less detail' : 'Add more detail (optional)'}
          </button>
          {detail && (
            <div className="space-y-4">
              <TagInput id="checkin-emotions" label="Other feelings alongside it" value={emotions} onChange={setEmotions} suggestions={EMOTION_SUGGESTIONS} />
              <div>
                <label htmlFor="checkin-note" className="label">What might have shaped this? (optional)</label>
                <textarea id="checkin-note" className="field" rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
              </div>
            </div>
          )}
        </>
      )}
      {error && <InlineError>{error}</InlineError>}
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? 'Planting...' : submitLabel}
      </button>
    </form>
  );
}
