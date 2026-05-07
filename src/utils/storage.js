/**
 * Centralised localStorage + date helpers.
 * All modules should use these — never call localStorage.* directly.
 */

export function safeGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null || raw === undefined) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch (err) {
    console.warn(`[storage] Failed to parse "${key}":`, err.message);
    return fallback;
  }
}

export function safeSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.warn(`[storage] Failed to write "${key}":`, err.message);
    return false;
  }
}

export function safeRemove(key) {
  try { localStorage.removeItem(key); } catch {}
}

/** ISO timestamp for `createdAt` fields. Single source of truth. */
export const isoNow = () => new Date().toISOString();

/** YYYY-MM-DD for today — used for date-only comparisons. */
export const todayISO = () => new Date().toISOString().slice(0, 10);

/** Returns true if an ISO timestamp is on today's date. */
export function isToday(iso) {
  if (!iso || typeof iso !== 'string') return false;
  try { return iso.slice(0, 10) === todayISO(); } catch { return false; }
}

/** DD/MM/YYYY display. Accepts ISO or returns input unchanged on failure. */
export function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/** HH:MM AM/PM display. */
export function formatTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d
    .toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    .toUpperCase();
}
