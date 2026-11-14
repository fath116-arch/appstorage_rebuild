/**
 * Shared HTTP Client & Auth Token Manager
 * Single source of truth for Bearer token fallback and fetch requests.
 */

const TOKEN_STORAGE_KEY = 'fieldops_token';

// Token fallback for browser contexts where third-party iframe cookies are restricted
let authToken: string | null = null;
try {
  authToken = localStorage.getItem(TOKEN_STORAGE_KEY);
} catch {
  authToken = null;
}

export function getAuthToken(): string | null {
  return authToken;
}

export function setAuthToken(token: string | null): void {
  authToken = token;
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage access errors in restricted iframe contexts
  }
}

export function clearAuthToken(): void {
  setAuthToken(null);
}

export function getAuthHeaders(customHeaders: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...customHeaders
  };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  return headers;
}

export interface RequestJsonOptions extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>;
  skipAuth?: boolean;
}

export async function requestJson<T = Record<string, unknown>>(
  url: string,
  options: RequestJsonOptions = {}
): Promise<{ ok: boolean; status: number; data: T }> {
  const { headers: customHeaders = {}, skipAuth = false, credentials = 'include', ...rest } = options;

  const headers: Record<string, string> = skipAuth
    ? { 'Content-Type': 'application/json', ...customHeaders }
    : getAuthHeaders(customHeaders);

  const res = await fetch(url, {
    ...rest,
    headers,
    credentials
  });

  const data = (await res.json().catch(() => ({}))) as T;
  return { ok: res.ok, status: res.status, data };
}

export async function apiFetch<T = Record<string, unknown>>(
  url: string,
  options: RequestJsonOptions = {},
  fallbackError: string = 'Permintaan ke server gagal.'
): Promise<T> {
  const { ok, data } = await requestJson<T & { message?: string }>(url, options);
  if (!ok) {
    throw new Error(data?.message || fallbackError);
  }
  return data;
}
