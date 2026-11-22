export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly issues: { path: string; message: string }[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const BASE = '/api/v1';
let csrfToken = '';
const unauthorizedListeners = new Set<() => void>();

export const setCsrfToken = (token: string) => {
  csrfToken = token;
};

export const onUnauthorized = (fn: () => void) => {
  unauthorizedListeners.add(fn);
  return () => {
    unauthorizedListeners.delete(fn);
  };
};

type Params = Record<string, string | number | boolean | undefined | null>;

function buildUrl(path: string, params?: Params): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
  }
  const qs = query.toString();
  return `${BASE}${path}${qs ? `?${qs}` : ''}`;
}

async function request<T>(method: string, path: string, options: { params?: Params; body?: unknown; keepalive?: boolean } = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.params), {
      method,
      credentials: 'same-origin',
      keepalive: options.keepalive,
      headers: {
        Accept: 'application/json',
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(method !== 'GET' ? { 'X-CSRF-Token': csrfToken } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'network', 'We could not reach the server. Please check your connection.');
  }
  if (response.status === 204) return undefined as T;
  const data = (await response.json().catch(() => null)) as
    | (T & { error?: { code: string; message: string; details?: { issues?: { path: string; message: string }[] } } })
    | null;
  if (!response.ok) {
    const err = data?.error;
    const error = new ApiError(response.status, err?.code ?? 'error', err?.message ?? 'Something went wrong.', err?.details?.issues ?? []);
    if (response.status === 401 && !path.startsWith('/auth/')) unauthorizedListeners.forEach((fn) => fn());
    throw error;
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, params?: Params) => request<T>('GET', path, { params }),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, { body: body ?? {} }),
  patch: <T>(path: string, body: unknown, opts: { keepalive?: boolean } = {}) => request<T>('PATCH', path, { body, ...opts }),
  del: <T = void>(path: string, body?: unknown) => request<T>('DELETE', path, { body }),
};
