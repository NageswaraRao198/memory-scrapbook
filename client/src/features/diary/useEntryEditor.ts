import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import type { Entry, EntryInput } from '../../types';

export interface EditorForm {
  title: string;
  body: string;
  entryDate: string;
  mood: string | null;
  emotions: string[];
  intensity: number | null;
  contextTags: string[];
}

export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

export const AUTOSAVE_DELAY_MS = 1200;

const backupKey = (id: string | null) => `scrapbook:draft:${id ?? 'new'}`;

interface Backup {
  form: EditorForm;
  savedAt: string;
}

function readBackup(id: string | null): Backup | null {
  try {
    const raw = localStorage.getItem(backupKey(id));
    return raw ? (JSON.parse(raw) as Backup) : null;
  } catch {
    return null;
  }
}

function writeBackup(id: string | null, form: EditorForm) {
  try {
    localStorage.setItem(backupKey(id), JSON.stringify({ form, savedAt: new Date().toISOString() } satisfies Backup));
  } catch {
    /* a full or blocked storage should never interrupt writing */
  }
}

function clearBackup(id: string | null) {
  try {
    localStorage.removeItem(backupKey(id));
  } catch {
    /* ignore */
  }
}

const hasContent = (f: EditorForm) => Boolean(f.title.trim() || f.body.trim());

const sameForm = (a: EditorForm, b: EditorForm) => JSON.stringify(a) === JSON.stringify(b);

export const blankForm = (): EditorForm => ({
  title: '',
  body: '',
  entryDate: new Date().toISOString(),
  mood: null,
  emotions: [],
  intensity: null,
  contextTags: [],
});

const fromEntry = (e: Entry): EditorForm => ({
  title: e.title ?? '',
  body: e.body,
  entryDate: e.entryDate,
  mood: e.mood,
  emotions: e.emotions,
  intensity: e.intensity,
  contextTags: e.contextTags,
});

const toInput = (f: EditorForm, isDraft: boolean): EntryInput => ({
  title: f.title.trim() || null,
  body: f.body,
  bodyFormat: 'markdown',
  entryDate: f.entryDate,
  mood: f.mood,
  emotions: f.emotions,
  intensity: f.mood ? f.intensity : null,
  contextTags: f.contextTags,
  isDraft,
});

export interface UseEntryEditor {
  form: EditorForm;
  update: (patch: Partial<EditorForm>) => void;
  status: SaveStatus;
  errorMessage: string | null;
  entryId: string | null;
  isDraft: boolean;
  loading: boolean;
  loadError: Error | null;
  recovery: Backup | null;
  restoreRecovery: () => void;
  discardRecovery: () => void;
  saveNow: () => Promise<boolean>;
  finalize: () => Promise<Entry | null>;
  hasUnsaved: () => boolean;
  onCreated: (cb: (id: string) => void) => void;
  retryLoad: () => void;
}

/**
 * Owns the editor's draft lifecycle: debounced autosave, serialised network saves,
 * a local safety copy while changes are unsaved, and explicit finishing.
 */
export function useEntryEditor(routeId: string | undefined): UseEntryEditor {
  const [form, setForm] = useState<EditorForm>(blankForm);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDraft, setIsDraft] = useState(true);
  const [entryId, setEntryId] = useState<string | null>(routeId ?? null);
  const [loading, setLoading] = useState(Boolean(routeId));
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [recovery, setRecovery] = useState<Backup | null>(null);
  const [loadTick, setLoadTick] = useState(0);

  const formRef = useRef(form);
  const idRef = useRef<string | null>(routeId ?? null);
  const draftRef = useRef(true);
  const dirtyRef = useRef(false);
  const versionRef = useRef(0);
  const savingRef = useRef(0);
  const chainRef = useRef<Promise<unknown>>(Promise.resolve());
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const createdCbRef = useRef<(id: string) => void>(() => undefined);
  const lastSavedRef = useRef<Entry | null>(null);

  const apply = useCallback((next: EditorForm) => {
    formRef.current = next;
    setForm(next);
  }, []);

  const runSave = useCallback(async (finalize: boolean): Promise<boolean> => {
    const snapshot = formRef.current;
    const version = versionRef.current;
    const id = idRef.current;

    if (finalize && !snapshot.body.trim()) {
      setStatus('error');
      setErrorMessage('Write a few words before saving this entry. Your draft is safe in the meantime.');
      return false;
    }
    if (!finalize && !dirtyRef.current) return true;
    if (!id && !hasContent(snapshot)) {
      dirtyRef.current = false;
      setStatus('idle');
      return true;
    }

    const payload = toInput(snapshot, finalize ? false : draftRef.current);
    savingRef.current += 1;
    setStatus('saving');
    setErrorMessage(null);
    try {
      const res = id
        ? await api.patch<{ entry: Entry }>(`/entries/${id}`, payload)
        : await api.post<{ entry: Entry }>('/entries', { ...payload, isDraft: finalize ? false : true });
      const entry = res.entry;
      lastSavedRef.current = entry;
      draftRef.current = entry.isDraft;
      setIsDraft(entry.isDraft);
      if (!id) {
        idRef.current = entry.id;
        setEntryId(entry.id);
        clearBackup(null);
        createdCbRef.current(entry.id);
      }
      if (versionRef.current === version) {
        dirtyRef.current = false;
        clearBackup(entry.id);
        setStatus('saved');
      } else {
        writeBackup(entry.id, formRef.current);
        setStatus('dirty');
      }
      return true;
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof ApiError ? err.message : 'We could not save just now.');
      return false;
    } finally {
      savingRef.current -= 1;
    }
  }, []);

  const enqueue = useCallback(
    (finalize: boolean) => {
      const result = chainRef.current.then(() => runSave(finalize));
      chainRef.current = result.catch(() => undefined);
      return result;
    },
    [runSave],
  );

  const saveNow = useCallback(() => {
    clearTimeout(timerRef.current);
    return enqueue(false);
  }, [enqueue]);

  const update = useCallback(
    (patch: Partial<EditorForm>) => {
      const next = { ...formRef.current, ...patch };
      apply(next);
      dirtyRef.current = true;
      versionRef.current += 1;
      setStatus('dirty');
      writeBackup(idRef.current, next);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void enqueue(false), AUTOSAVE_DELAY_MS);
    },
    [apply, enqueue],
  );

  const finalize = useCallback(async (): Promise<Entry | null> => {
    clearTimeout(timerRef.current);
    const ok = await enqueue(true);
    return ok ? lastSavedRef.current : null;
  }, [enqueue]);

  // Load an existing entry (but not one this editor just created itself).
  useEffect(() => {
    if (!routeId) {
      if (idRef.current === null) {
        const backup = readBackup(null);
        if (backup && hasContent(backup.form)) setRecovery(backup);
      }
      return;
    }
    if (routeId === idRef.current && lastSavedRef.current) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    api.get<{ entry: Entry }>(`/entries/${routeId}`).then(
      ({ entry }) => {
        if (cancelled) return;
        idRef.current = entry.id;
        setEntryId(entry.id);
        lastSavedRef.current = entry;
        draftRef.current = entry.isDraft;
        setIsDraft(entry.isDraft);
        const loaded = fromEntry(entry);
        apply(loaded);
        const backup = readBackup(entry.id);
        if (backup && !sameForm(backup.form, loaded)) setRecovery(backup);
        else clearBackup(entry.id);
        setLoading(false);
      },
      (err: unknown) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err : new Error('Could not load this entry.'));
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [routeId, apply, loadTick]);

  // Best-effort flush if the editor goes away with unsaved changes.
  useEffect(
    () => () => {
      clearTimeout(timerRef.current);
      if (dirtyRef.current) void enqueue(false);
    },
    [enqueue],
  );

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current || savingRef.current > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  const restoreRecovery = useCallback(() => {
    if (!recovery) return;
    setRecovery(null);
    update(recovery.form);
  }, [recovery, update]);

  const discardRecovery = useCallback(() => {
    clearBackup(idRef.current);
    setRecovery(null);
  }, []);

  return {
    form,
    update,
    status,
    errorMessage,
    entryId,
    isDraft,
    loading,
    loadError,
    recovery,
    restoreRecovery,
    discardRecovery,
    saveNow,
    finalize,
    hasUnsaved: () => dirtyRef.current || savingRef.current > 0,
    onCreated: (cb) => {
      createdCbRef.current = cb;
    },
    retryLoad: () => setLoadTick((t) => t + 1),
  };
}
