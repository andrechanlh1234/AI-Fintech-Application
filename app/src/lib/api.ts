// Client for the local backend (see /backend) — real accounts, real
// per-account data sync, and real receipt OCR. All calls degrade
// gracefully by throwing a plain Error with a user-readable message;
// callers decide how to surface that (inline form error, fallback to
// manual entry, etc.) rather than this module ever touching UI state.
import type { SyncPayload } from '../store/initialState';

// When opened as localhost/127.0.0.1 (this machine), talk to the backend on
// 127.0.0.1 explicitly — on this machine "localhost" resolves to ::1 first,
// where an unrelated process already listens on port 8000, so the ambiguous
// hostname would silently hit the wrong server. When opened via a LAN IP
// (e.g. a phone on the same network hitting this machine for real device
// testing), the backend is reachable at that same IP, port 8000.
const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE = (import.meta as unknown as { env?: { VITE_API_BASE?: string } }).env?.VITE_API_BASE
  || (isLocalHost ? 'http://127.0.0.1:8000' : `http://${window.location.hostname}:8000`);

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

export async function forgotPassword(email: string): Promise<void> {
  await request('/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
}

// The password-reset email now carries a 6-digit code (no link), so this
// works from the installed app with no deep-linking. On success the
// backend signs the user straight in — same {token,user} shape as login.
export async function resetPassword(email: string, code: string, newPassword: string): Promise<AuthUser> {
  const data = await request<{ token: string; user: AuthUser }>('/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code, new_password: newPassword }),
  });
  setToken(data.token);
  return data.user;
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

export interface ScannedLineItem {
  description: string;
  amount: number;
  category: string;
  taxDeductible: boolean;
  confidence: number;
}

export interface ScannedReceiptResult {
  vendor: string;
  date: string | null;
  total: number | null;
  lineItems: ScannedLineItem[];
  confidence: number;
  taxAmount: number | null;
  taxRate: number | null;
  serviceChargeAmount: number | null;
  serviceChargeRate: number | null;
  /** One of "Cash" | "Credit Card" | "E-wallet" | "Transfer", or null if the
   * scan couldn't tell how it was paid. */
  paymentMethod: string | null;
}

export async function scanReceiptImage(file: File): Promise<ScannedReceiptResult> {
  const form = new FormData();
  form.append('file', file);
  return request<ScannedReceiptResult>('/receipts/scan', { method: 'POST', body: form });
}

export interface ScannedStatementRecord {
  source: string;
  vendor: string;
  date: string | null;
  amount: number;
  category: string;
  relief_tag: string | null;
  confidence: number;
}

// Real line items parsed from an uploaded CSV/PDF bank or e-wallet statement
// (pipeline/statement_parser.py) — the caller turns these into pending
// review items (accept/reject), same as a scanned receipt. Nothing is
// written to the user's real transactions until they accept one.
export async function uploadStatement(file: File): Promise<{ records: ScannedStatementRecord[] }> {
  const form = new FormData();
  form.append('file', file);
  return request<{ records: ScannedStatementRecord[] }>('/statements/scan', { method: 'POST', body: form });
}

export interface AiChatResponse {
  reply: string | null;
  source: 'groq' | 'gemini' | 'canned';
}

// `source: "canned"` means the backend has no AI provider key configured
// (or the call failed) — the caller should fall back to the client-side
// canned reply generator (aiCraftReply in lib/seedData.ts), same as if
// this request throws outright (network error, backend not running).
//
// `history` and `context` ground the reply in what's actually true: history
// is the prior turns of this conversation (so the model has continuity),
// context is a real-data snapshot (net worth, budget, tax, subscriptions —
// see selectAiContext) so a question like "what's my net worth" gets the
// real figure instead of the model guessing one.
export async function requestAiReply(
  message: string,
  history: { from: 'user' | 'ai'; text: string }[] = [],
  context: unknown = null,
): Promise<AiChatResponse> {
  return request<AiChatResponse>('/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history, context }),
  });
}
