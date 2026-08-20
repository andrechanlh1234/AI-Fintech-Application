// Client for the local backend (see /backend) — real accounts, real
// per-account data sync, and real receipt OCR. All calls degrade
// gracefully by throwing a plain Error with a user-readable message;
// callers decide how to surface that (inline form error, fallback to
// manual entry, etc.) rather than this module ever touching UI state.
import type { SyncPayload } from '../store/initialState';

// Explicitly 127.0.0.1, not "localhost" — on this machine "localhost"
// resolves to ::1 first, where an unrelated process already listens on
// port 8000, so the ambiguous hostname would silently hit the wrong server.
const API_BASE = (import.meta as unknown as { env?: { VITE_API_BASE?: string } }).env?.VITE_API_BASE
  || 'http://127.0.0.1:8000';

const TOKEN_KEY = 'cukai_v7_token';

export interface AuthUser { id: string; email: string }

export function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* ignore */ }
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(API_BASE + path, opts);
  } catch {
    throw new Error("Can't reach the server — is it running?");
  }
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.detail) message = body.detail;
    } catch { /* non-JSON error body */ }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function signup(email: string, password: string): Promise<AuthUser> {
  const data = await request<{ token: string; user: AuthUser }>('/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  setToken(data.token);
  return data.user;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const data = await request<{ token: string; user: AuthUser }>('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  setToken(data.token);
  return data.user;
}

export function logout() {
  setToken(null);
}

export function googleLoginUrl(): string {
  return API_BASE + '/auth/google/login';
}

// The Google OAuth callback (backend/google_oauth.py) can't hand the SPA
// a token directly — it redirects the browser instead, with the token in
// the URL. Called once on mount; returns true if it found and stored one.
export function captureOAuthTokenFromUrl(): boolean {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('oauth_token');
  if (!token) return false;
  setToken(token);
  params.delete('oauth_token');
  params.delete('oauth_error');
  const query = params.toString();
  window.history.replaceState({}, '', window.location.pathname + (query ? `?${query}` : '') + window.location.hash);
  return true;
}

export async function fetchMe(): Promise<AuthUser> {
  return request<AuthUser>('/auth/me', { headers: authHeaders() });
}

export async function fetchRemoteState(): Promise<Partial<SyncPayload> | null> {
  const data = await request<{ state: Partial<SyncPayload> | null }>('/state', { headers: authHeaders() });
  return data.state;
}

export async function pushRemoteState(payload: SyncPayload): Promise<void> {
  if (!getToken()) return;
  await request('/state', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ state: payload }),
  });
}

export interface ScannedReceipt {
  vendor: string;
  date: string | null;
  amount: number;
  category: string;
  relief_tag: string | null;
  confidence: number;
}

export async function scanReceiptImage(file: File): Promise<ScannedReceipt> {
  const form = new FormData();
  form.append('file', file);
  return request<ScannedReceipt>('/receipts/scan', { method: 'POST', body: form });
}
