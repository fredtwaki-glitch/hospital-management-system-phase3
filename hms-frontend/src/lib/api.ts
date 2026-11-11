
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export interface ApiError {
  message: string;
  statusCode: number;
  isNetworkError?: boolean;
}

function getStoredAuth() {
  const tenantSlug = localStorage.getItem('tenantSlug') || '';
  const token = localStorage.getItem('accessToken') || '';
  return { tenantSlug, token };
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { tenantSlug, token } = getStoredAuth();

  let response: Response;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(tenantSlug ? { 'X-Tenant-Slug': tenantSlug } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    const error: ApiError = {
      message: 'No connection to the server',
      statusCode: 0,
      isNetworkError: true,
    };
    throw error;
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;

    try {
      const body = await response.json();
      message = body.message || message;
    } catch {
      // Keep the default error message.
    }

    const error: ApiError = {
      message: Array.isArray(message) ? message.join(', ') : message,
      statusCode: response.status,
    };
    throw error;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  get: <T,>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T,>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  patch: <T,>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PATCH',
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
};

/**
 * The api client throws plain ApiError objects (not Error instances), so
 * `err instanceof Error` is always false for API failures. Use this instead
 * to get the server's actual message (e.g. "Unknown tenant: x") on screen.
 */
export function errorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

export function setAuth(tenantSlug: string, token: string) {
  localStorage.setItem('tenantSlug', tenantSlug);
  localStorage.setItem('accessToken', token);
}

export function clearAuth() {
  localStorage.removeItem('tenantSlug');
  localStorage.removeItem('accessToken');
  localStorage.removeItem('staffUser');
}

export function isAuthenticated(): boolean {
  return Boolean(getStoredAuth().token);
}
