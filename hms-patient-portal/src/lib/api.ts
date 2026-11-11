const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export interface ApiError {
  message: string;
  statusCode: number;
}

function getStoredAuth() {
  return {
    tenantSlug: localStorage.getItem('tenantSlug') || '',
    token: localStorage.getItem('patientAccessToken') || '',
  };
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { tenantSlug, token } = getStoredAuth();
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(tenantSlug ? { 'X-Tenant-Slug': tenantSlug } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      message = body.message || message;
    } catch {
      /* not JSON */
    }
    const error: ApiError = { message: Array.isArray(message) ? message.join(', ') : message, statusCode: response.status };
    throw error;
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  get: <T,>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T,>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
};

export function setTenantSlug(slug: string) {
  localStorage.setItem('tenantSlug', slug);
}
export function setPatientToken(token: string) {
  localStorage.setItem('patientAccessToken', token);
}
export function clearPatientAuth() {
  localStorage.removeItem('patientAccessToken');
}
export function isPatientAuthenticated(): boolean {
  return Boolean(getStoredAuth().token);
}
