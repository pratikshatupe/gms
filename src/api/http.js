/**
 * Thin HTTP wrapper that automatically attaches the Bearer access token (if
 * present) and refreshes it once on a 401 using the stored refresh token.
 *
 * Tokens are written to localStorage by the Login flow when a real backend
 * login succeeds. When only the demo localStorage user exists (no backend
 * login), the token is absent and protected calls will fail loudly with the
 * server's 401 message — that is the correct behaviour for a demo session
 * that never authenticated against the API.
 */
const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

export const TOKEN_KEYS = Object.freeze({
  ACCESS:  'cgms_access_token',
  REFRESH: 'cgms_refresh_token',
});

export function getAccessToken() {
  try { return localStorage.getItem(TOKEN_KEYS.ACCESS) || ''; } catch { return ''; }
}

export function getRefreshToken() {
  try { return localStorage.getItem(TOKEN_KEYS.REFRESH) || ''; } catch { return ''; }
}

export function setAuthTokens(tokens) {
  if (!tokens) return;
  try {
    if (tokens.accessToken)  localStorage.setItem(TOKEN_KEYS.ACCESS,  tokens.accessToken);
    if (tokens.refreshToken) localStorage.setItem(TOKEN_KEYS.REFRESH, tokens.refreshToken);
  } catch { /* quota / private-mode — ignore */ }
}

export function clearAuthTokens() {
  try {
    localStorage.removeItem(TOKEN_KEYS.ACCESS);
    localStorage.removeItem(TOKEN_KEYS.REFRESH);
  } catch { /* ignore */ }
}

async function doRefresh() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const json = await res.json();
    const tokens = json?.data?.tokens || json?.tokens;
    if (!tokens?.accessToken) return false;
    setAuthTokens(tokens);
    return true;
  } catch { return false; }
}

/**
 * Authenticated fetch — attaches Bearer token and retries once on 401 after a
 * successful refresh. Returns the raw `Response` so callers can inspect status
 * codes; use `apiJson` for the most common JSON-in/JSON-out path.
 */
export async function apiFetch(path, init = {}) {
  const headers = new Headers(init.headers || {});
  const token = getAccessToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (init.body && !headers.has('Content-Type') && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  let res = await fetch(url, { ...init, headers });
  if (res.status === 401 && token) {
    const refreshed = await doRefresh();
    if (refreshed) {
      headers.set('Authorization', `Bearer ${getAccessToken()}`);
      res = await fetch(url, { ...init, headers });
    }
  }
  return res;
}

export async function apiJson(path, init = {}) {
  const res = await apiFetch(path, init);
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { /* keep null */ }
  if (!res.ok) {
    const message = body?.message || body?.error?.message || `Request failed (${res.status}).`;
    const err = new Error(message);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

/**
 * Backend login — called from the Login page in addition to the demo
 * localStorage flow. On success the tokens are persisted so subsequent
 * authenticated calls (Coupons, Referrals, Subscriptions admin) work.
 * Failures are swallowed so the demo flow continues to work without a
 * running backend.
 */
export async function backendLogin({ email, password }) {
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const tokens = json?.data?.tokens;
    if (tokens?.accessToken) setAuthTokens(tokens);
    return json?.data || null;
  } catch { return null; }
}

export const API = API_BASE;
