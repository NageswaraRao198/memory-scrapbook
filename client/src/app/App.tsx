import { useState } from 'react';
import { Link, createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Loading, EmptyState } from '../components/States';
import { ToastProvider } from '../components/Toast';
import { AuthProvider, useAuth } from '../features/auth/AuthContext';
import { WelcomePage } from '../features/auth/WelcomePage';
import { DiaryPage } from '../features/diary/DiaryPage';
import { EntryDetailPage } from '../features/diary/EntryDetailPage';
import { EntryEditorPage } from '../features/diary/EntryEditorPage';
import { HomePage } from '../features/home/HomePage';
import { MemoryLanePage } from '../features/memories/MemoryLanePage';
import { MoodGardenPage } from '../features/mood/MoodGardenPage';
import { ReflectionsPage } from '../features/reflections/ReflectionsPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { AppShell } from './AppShell';

function Gate() {
  const { status } = useAuth();
  if (status === 'loading') return <Loading label="Opening your scrapbook..." />;
  if (status === 'setup') return <WelcomePage mode="setup" />;
  if (status === 'signed-out') return <WelcomePage mode="signin" />;
  return <AppShell />;
}

function Root() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Gate />
      </ToastProvider>
    </AuthProvider>
  );
}

function NotFound() {
  return (
    <EmptyState title="This page wandered off" action={<Link to="/" className="btn btn-primary">Back home</Link>}>
      We could not find what you were looking for.
    </EmptyState>
  );
}

export function createAppRouter() {
  return createBrowserRouter([
    {
      path: '/',
      element: <Root />,
      children: [
        { index: true, element: <HomePage /> },
        { path: 'diary', element: <DiaryPage /> },
        { path: 'diary/write/:id?', element: <EntryEditorPage /> },
        { path: 'diary/:id', element: <EntryDetailPage /> },
        { path: 'garden', element: <MoodGardenPage /> },
        { path: 'memories', element: <MemoryLanePage /> },
        { path: 'reflections', element: <ReflectionsPage /> },
        { path: 'settings', element: <SettingsPage /> },
        { path: '*', element: <NotFound /> },
      ],
    },
  ]);
}

export function App() {
  const [router] = useState(createAppRouter);
  return <RouterProvider router={router} />;
}
