import { NavLink, Outlet } from 'react-router-dom';
import { Flower } from '../components/Flower';
import { Icon, type IconName } from '../components/Icon';
import { useAuth } from '../features/auth/AuthContext';

const NAV: { to: string; label: string; short: string; icon: IconName; end?: boolean }[] = [
  { to: '/', label: 'Home', short: 'Home', icon: 'home', end: true },
  { to: '/diary', label: 'My Diary', short: 'Diary', icon: 'book' },
  { to: '/garden', label: 'Mood Garden', short: 'Garden', icon: 'flower' },
  { to: '/memories', label: 'Memory Lane', short: 'Memories', icon: 'polaroid' },
  { to: '/reflections', label: 'Reflections', short: 'Reflect', icon: 'spark' },
  { to: '/settings', label: 'Settings & Privacy', short: 'Settings', icon: 'settings' },
];

export function AppShell() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen md:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2">
        Skip to content
      </a>

      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-surface-2/70 px-4 py-6 md:flex">
        <div className="mb-8 flex items-center gap-3 px-2">
          <Flower color="#C99591" intensity={3} size={38} />
          <div>
            <p className="font-display text-lg leading-tight">The Memory</p>
            <p className="font-display text-lg leading-tight">Scrapbook</p>
          </div>
        </div>
        <nav aria-label="Main" className="flex flex-1 flex-col gap-1">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${isActive ? 'bg-rose/25 font-medium text-ink' : 'text-muted hover:bg-rose/10 hover:text-ink'}`
              }
            >
              <Icon name={item.icon} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-line px-2 pt-4">
          <p className="hand">{user?.displayName ? `Hello, ${user.displayName}` : 'Hello, you'}</p>
          <button type="button" className="btn btn-quiet btn-sm mt-2 w-full" onClick={() => void logout()}>
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-line bg-surface-2/70 px-4 py-2.5 md:hidden">
          <div className="flex items-center gap-2">
            <Flower color="#C99591" intensity={3} size={28} />
            <span className="font-display text-lg">The Memory Scrapbook</span>
          </div>
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => void logout()}>
            Sign out
          </button>
        </header>
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-8 outline-none sm:px-8 md:pb-16 md:pt-12">
          <Outlet />
        </main>
      </div>

      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-surface/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            aria-label={item.label}
            className={({ isActive }) =>
              `flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 rounded-lg text-[0.68rem] ${isActive ? 'font-semibold text-accent' : 'text-muted'}`
            }
          >
            <Icon name={item.icon} size={22} />
            {item.short}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
