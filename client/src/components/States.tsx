import type { ReactNode } from 'react';
import { ApiError } from '../lib/api';
import { Sprout } from './Flower';

export function Loading({ label = 'Turning the page...' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex items-center justify-center gap-3 py-16 text-muted">
      <Sprout className="animate-pulse" />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="paper mx-auto max-w-xl px-6 py-10 text-center">
      <Sprout size={40} className="mx-auto mb-3" />
      <h3 className="text-xl">{title}</h3>
      {children && <p className="mt-2 text-muted">{children}</p>}
      {action && <div className="mt-5 flex justify-center gap-3">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, title = 'We hit a small snag' }: { error: Error; onRetry?: () => void; title?: string }) {
  const message = error instanceof ApiError ? error.message : 'Something unexpected happened.';
  return (
    <div role="alert" className="paper mx-auto max-w-xl px-6 py-8 text-center">
      <h3 className="text-xl">{title}</h3>
      <p className="mt-2 text-muted">{message}</p>
      <p className="mt-1 text-sm text-muted">Nothing you wrote has been lost. You can try again whenever you are ready.</p>
      {onRetry && (
        <button type="button" className="btn btn-primary mt-5" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function InlineError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-lg border border-[#b9806a]/50 bg-[#b9806a]/10 px-3 py-2 text-sm">
      {children}
    </p>
  );
}

export function PageHeader({ title, subtitle, note, actions }: { title: string; subtitle?: ReactNode; note?: string; actions?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {note && <p className="hand -mb-1">{note}</p>}
        <h1 className="text-3xl sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1 max-w-prose text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
