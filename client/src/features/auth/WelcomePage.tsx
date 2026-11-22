import { useState, type FormEvent } from 'react';
import { ApiError } from '../../lib/api';
import { localTimezone } from '../../lib/dates';
import { Flower } from '../../components/Flower';
import { InlineError } from '../../components/States';
import { useAuth } from './AuthContext';

export function WelcomePage({ mode }: { mode: 'setup' | 'signin' }) {
  const { login, setup, sessionExpired } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [setupToken, setSetupToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isSetup = mode === 'setup';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (isSetup && password !== confirm) {
      setError('The two passwords do not match yet.');
      return;
    }
    setBusy(true);
    try {
      if (isSetup) {
        await setup({ email, password, displayName: displayName || undefined, timezone: localTimezone(), setupToken: setupToken || undefined });
      } else {
        await login(email, password);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.issues[0]?.message ?? err.message : 'Something went wrong. Please try again.');
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="rise relative w-full max-w-md">
        <div className="paper relative px-7 pb-8 pt-10" style={{ ['--tape-rot' as string]: '-4deg' }}>
          <span className="tape" aria-hidden="true" />
          <div className="mb-6 text-center">
            <Flower color="#C99591" intensity={4} size={64} className="mx-auto" />
            <p className="hand mt-2">a private place, just for you</p>
            <h1 className="text-3xl">The Memory Scrapbook</h1>
            <p className="mt-2 text-muted">
              {isSetup
                ? 'Welcome. Let us set up your private diary. Only you will ever be able to open it.'
                : 'Welcome back. Your pages are right where you left them.'}
            </p>
          </div>

          {sessionExpired && !error && (
            <p role="status" className="mb-4 rounded-lg bg-sage/15 px-3 py-2 text-sm">
              Your session ended to keep your diary safe. Sign in again whenever you are ready.
            </p>
          )}

          <form onSubmit={submit} className="space-y-4" noValidate>
            {isSetup && (
              <div>
                <label htmlFor="displayName" className="label">What should we call you? (optional)</label>
                <input id="displayName" className="field" value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoComplete="nickname" maxLength={80} />
              </div>
            )}
            <div>
              <label htmlFor="email" className="label">Email</label>
              <input id="email" type="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
            </div>
            <div>
              <label htmlFor="password" className="label">Password</label>
              <input
                id="password"
                type="password"
                className="field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isSetup ? 'new-password' : 'current-password'}
                aria-describedby={isSetup ? 'pw-help' : undefined}
                required
              />
              {isSetup && <p id="pw-help" className="mt-1 text-sm text-muted">At least 10 characters. A few words in a row works well.</p>}
            </div>
            {isSetup && (
              <div>
                <label htmlFor="confirm" className="label">Confirm password</label>
                <input id="confirm" type="password" className="field" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
              </div>
            )}
            {isSetup && (
              <div>
                <label htmlFor="setupToken" className="label">Setup code (only if your host gave you one)</label>
                <input id="setupToken" type="password" className="field" value={setupToken} onChange={(e) => setSetupToken(e.target.value)} autoComplete="off" />
              </div>
            )}
            {error && <InlineError>{error}</InlineError>}
            <button type="submit" className="btn btn-primary w-full" disabled={busy}>
              {busy ? 'One moment...' : isSetup ? 'Create my diary' : 'Open my scrapbook'}
            </button>
          </form>
          <p className="mt-5 text-center text-sm text-muted">There is no public sign-up. This space belongs to one person.</p>
        </div>
      </div>
    </main>
  );
}
