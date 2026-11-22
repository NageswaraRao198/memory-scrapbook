import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, onUnauthorized, setCsrfToken } from '../../lib/api';
import type { User, UserPreferences } from '../../types';

type Status = 'loading' | 'setup' | 'signed-out' | 'signed-in';

interface AuthValue {
  status: Status;
  user: User | null;
  sessionExpired: boolean;
  login: (email: string, password: string, pin: string) => Promise<void>;
  setup: (input: { email: string; password: string; pin: string; displayName?: string; timezone: string; setupToken?: string }) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (patch: Partial<UserPreferences> & { displayName?: string | null }) => Promise<void>;
  resetAfterAccountDeletion: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function applyTheme(theme: UserPreferences['theme']) {
  try {
    localStorage.setItem('scrapbook:theme', theme);
  } catch {
    /* storage may be unavailable; the theme still applies for this visit */
  }
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const statusRef = useRef<Status>('loading');
  statusRef.current = status;

  const signedIn = useCallback((nextUser: User, csrf: string) => {
    setCsrfToken(csrf);
    setUser(nextUser);
    setSessionExpired(false);
    setStatus('signed-in');
    applyTheme(nextUser.preferences.theme);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await api.get<{ user: User; csrfToken: string }>('/auth/me');
        if (!cancelled) signedIn(me.user, me.csrfToken);
      } catch {
        try {
          const { setupRequired } = await api.get<{ setupRequired: boolean }>('/auth/status');
          if (!cancelled) setStatus(setupRequired ? 'setup' : 'signed-out');
        } catch {
          if (!cancelled) setStatus('signed-out');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  useEffect(
    () =>
      onUnauthorized(() => {
        if (statusRef.current !== 'signed-in') return;
        setUser(null);
        setSessionExpired(true);
        setStatus('signed-out');
      }),
    [],
  );

  const value = useMemo<AuthValue>(
    () => ({
      status,
      user,
      sessionExpired,
      login: async (email, password, pin) => {
        const res = await api.post<{ user: User; csrfToken: string }>('/auth/login', { email, password, pin: pin || undefined });
        signedIn(res.user, res.csrfToken);
      },
      setup: async (input) => {
        const res = await api.post<{ user: User; csrfToken: string }>('/auth/setup', input);
        signedIn(res.user, res.csrfToken);
      },
      logout: async () => {
        await api.post('/auth/logout').catch(() => undefined);
        setCsrfToken('');
        setUser(null);
        setSessionExpired(false);
        setStatus('signed-out');
      },
      updateProfile: async (patch) => {
        const res = await api.patch<{ user: User }>('/auth/profile', patch);
        setUser(res.user);
        applyTheme(res.user.preferences.theme);
      },
      resetAfterAccountDeletion: () => {
        setCsrfToken('');
        setUser(null);
        setStatus('setup');
      },
    }),
    [status, user, sessionExpired, signedIn],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export function useUser(): User {
  const { user } = useAuth();
  if (!user) throw new Error('A signed-in user is required here');
  return user;
}
