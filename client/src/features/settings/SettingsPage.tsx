import { useState, type FormEvent, type ReactNode } from 'react';
import { ConfirmDialog } from '../../components/Modal';
import { Icon } from '../../components/Icon';
import { InlineError, PageHeader } from '../../components/States';
import { useToast } from '../../components/Toast';
import { api, ApiError } from '../../lib/api';
import { useAuth, useUser } from '../auth/AuthContext';

function Section({ title, children, id }: { title: string; children: ReactNode; id: string }) {
  return (
    <section aria-labelledby={id} className="paper space-y-4 p-6">
      <h2 id={id} className="text-2xl">{title}</h2>
      {children}
    </section>
  );
}

function ChangePassword() {
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (next !== confirm) {
      setError('The new passwords do not match yet.');
      return;
    }
    setBusy(true);
    try {
      await api.post('/auth/change-password', { currentPassword: current, newPassword: next });
      toast('Your password has been changed. Other devices were signed out.');
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err) {
      setError(err instanceof ApiError ? err.issues[0]?.message ?? err.message : 'We could not change that just now.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid max-w-md gap-4" noValidate>
      <div>
        <label htmlFor="pw-current" className="label">Current password</label>
        <input id="pw-current" type="password" className="field" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
      </div>
      <div>
        <label htmlFor="pw-new" className="label">New password</label>
        <input id="pw-new" type="password" className="field" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} aria-describedby="pw-new-help" />
        <p id="pw-new-help" className="mt-1 text-sm text-muted">At least 10 characters.</p>
      </div>
      <div>
        <label htmlFor="pw-confirm" className="label">Confirm new password</label>
        <input id="pw-confirm" type="password" className="field" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </div>
      {error && <InlineError>{error}</InlineError>}
      <div>
        <button type="submit" className="btn btn-primary" disabled={busy || !current || !next}>Change password</button>
      </div>
    </form>
  );
}

function DeleteData() {
  const { resetAfterAccountDeletion } = useAuth();
  const toast = useToast();
  const [mode, setMode] = useState<'content' | 'account' | null>(null);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setMode(null);
    setTyped('');
    setError(null);
  };

  const run = async () => {
    if (!mode) return;
    setBusy(true);
    setError(null);
    try {
      await api.del('/account/data', { confirm: 'DELETE', deleteAccount: mode === 'account' });
      if (mode === 'account') {
        resetAfterAccountDeletion();
      } else {
        toast('All entries, memories, reflections and moods were deleted.');
        close();
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'We could not delete that just now.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <p className="text-muted">Deleting is permanent. Download a copy first if there is any chance you will want these pages back.</p>
      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn btn-danger" onClick={() => setMode('content')}>Delete everything I have written</button>
        <button type="button" className="btn btn-danger" onClick={() => setMode('account')}>Delete everything and my account</button>
      </div>
      <ConfirmDialog
        open={mode !== null}
        title={mode === 'account' ? 'Delete your diary and account?' : 'Delete all of your writing?'}
        message={
          mode === 'account'
            ? 'Every entry, memory, reflection, mood and your sign-in will be erased permanently. The app will return to its first-time setup.'
            : 'Every entry, memory, reflection and mood will be erased permanently. Your sign-in stays.'
        }
        confirmLabel="Delete permanently"
        cancelLabel="Keep everything"
        busy={busy}
        confirmDisabled={typed !== 'DELETE'}
        onConfirm={() => void run()}
        onCancel={close}
      >
        <div>
          <label htmlFor="delete-confirm" className="label">Type DELETE to confirm</label>
          <input id="delete-confirm" className="field" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
        </div>
        {error && <InlineError>{error}</InlineError>}
      </ConfirmDialog>
    </>
  );
}

export function SettingsPage() {
  const user = useUser();
  const { updateProfile, logout } = useAuth();
  const toast = useToast();
  const [displayName, setDisplayName] = useState(user.displayName ?? '');
  const [error, setError] = useState<string | null>(null);

  const save = async (patch: Parameters<typeof updateProfile>[0], message = 'Saved.') => {
    setError(null);
    try {
      await updateProfile(patch);
      toast(message);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'We could not save that just now.');
    }
  };

  const themes = [
    { value: 'light', label: 'Light paper' },
    { value: 'dark', label: 'Lamp-lit dark' },
    { value: 'system', label: 'Match my device' },
  ] as const;

  return (
    <div className="space-y-8">
      <PageHeader title="Settings & Privacy" note="your space, your rules" subtitle="Everything here is about keeping this place yours." />
      {error && <InlineError>{error}</InlineError>}

      <Section title="About you" id="s-profile">
        <form
          className="flex max-w-md items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void save({ displayName: displayName.trim() || null }, 'Your name is saved.');
          }}
        >
          <div className="flex-1">
            <label htmlFor="display-name" className="label">What should we call you?</label>
            <input id="display-name" className="field" value={displayName} maxLength={80} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-quiet">Save</button>
        </form>
        <p className="text-sm text-muted">Signed in as {user.email}</p>
      </Section>

      <Section title="Appearance and writing" id="s-appearance">
        <fieldset>
          <legend className="label">Theme</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup">
            {themes.map((t) => (
              <button key={t.value} type="button" role="radio" aria-checked={user.preferences.theme === t.value} className="chip chip-toggle" aria-pressed={user.preferences.theme === t.value} onClick={() => void save({ theme: t.value })}>
                {t.label}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="label">When I open the editor</legend>
          <div className="flex flex-wrap gap-2">
            {([['standard', 'Show everything'], ['distraction-free', 'Start in focus mode']] as const).map(([value, label]) => (
              <button key={value} type="button" className="chip chip-toggle" aria-pressed={user.preferences.defaultEditorMode === value} onClick={() => void save({ defaultEditorMode: value })}>
                {label}
              </button>
            ))}
          </div>
        </fieldset>
      </Section>

      <Section title="Privacy and AI" id="s-privacy">
        <div className="space-y-2 text-muted">
          <p><strong className="font-medium text-ink">Where your writing lives.</strong> In a managed Postgres database that belongs to you, reachable only by this app. It is only readable after you sign in, and nothing is sent to analytics or third-party scripts.</p>
          <p><strong className="font-medium text-ink">AI.</strong> This version of the scrapbook has no AI provider connected, so no part of your diary is sent to any external service. If one is added later, it will stay off until you explicitly allow it, and it will tell you what would be shared and with whom.</p>
        </div>
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="mt-1.5 h-5 w-5 accent-[var(--accent)]"
            checked={user.preferences.aiEnabled}
            onChange={(e) => void save({ aiEnabled: e.target.checked })}
          />
          <span>
            Allow optional AI features in the future
            <span className="block text-sm text-muted">Off by default. Turning this on does nothing today; it only records that you are open to it later.</span>
          </span>
        </label>
      </Section>

      <Section title="Your data" id="s-data">
        <p className="text-muted">Your writing belongs to you. Take a copy any time, in a format you can read without this app.</p>
        <div className="flex flex-wrap gap-3">
          <a className="btn btn-quiet" href="/api/v1/export?format=json" download><Icon name="download" size={16} /> Export as JSON</a>
          <a className="btn btn-quiet" href="/api/v1/export?format=markdown" download><Icon name="download" size={16} /> Export as Markdown</a>
        </div>
        <details className="rounded-lg bg-surface-2 p-4 text-sm text-muted">
          <summary className="cursor-pointer font-medium text-ink">How your data is kept safe</summary>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li>Your diary is stored in a managed Postgres database, separate from the website, so redeploying or restarting the site never erases it.</li>
            <li>Download the JSON export now and then and keep it somewhere safe, such as an encrypted drive. It is your own backup.</li>
            <li>The Markdown export is a readable copy you can open in any text editor.</li>
          </ul>
        </details>
      </Section>

      <Section title="Security" id="s-security">
        <ChangePassword />
        <hr className="divider" />
        <button type="button" className="btn btn-quiet" onClick={() => void logout()}>Sign out</button>
      </Section>

      <Section title="Delete my data" id="s-delete">
        <DeleteData />
      </Section>
    </div>
  );
}
