import {
  NOTIFICATIONS_STORAGE_KEY,
  NOTIFICATIONS_SYNC_EVENT,
} from '../context/NotificationContext';

/**
 * External helpers for code paths that can't reach the React context
 * (e.g. non-component utilities, one-off scripts, legacy callers).
 *
 * Inside React components ALWAYS prefer useNotifications() — the context
 * already re-renders every consumer on state change.
 *
 * These helpers keep the same-tab + cross-tab story intact:
 *   - writeNotifications() persists to localStorage and dispatches
 *     NOTIFICATIONS_SYNC_EVENT so the active NotificationProvider
 *     pulls the change back into React state.
 *   - The native `storage` event handles other tabs automatically.
 */

export function readNotifications() {
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeNotifications(next) {
  try {
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota or disabled — non-fatal */
  }
  window.dispatchEvent(new Event(NOTIFICATIONS_SYNC_EVENT));
}

export function updateNotifications(updater) {
  const current = readNotifications();
  const next = typeof updater === 'function' ? updater(current) : updater;
  writeNotifications(next);
  return next;
}

/* Shared unread helper for non-React callers (analytics, exports). */
export const unreadCount = (notifications) =>
  (notifications || []).filter((n) => !n.isRead).length;

/* Shared RBAC filter — identical rules to visibleNotifications in the
   context (org isolation + role + staff gating). Kept here so non-React
   code doesn't need to import from a .jsx file. */
export function getVisibleNotifications(notifications, user, currentStaffId) {
  const role = (user?.role || '').toLowerCase();
  const myOrg = user?.organisationId || user?.orgId || null;
  return (notifications || []).filter((n) => {
    if (role !== 'superadmin') {
      if (!myOrg)              return false;
      if (!n.orgId)            return false;
      if (n.orgId !== myOrg)   return false;
    }
    if (role === 'service') {
      return n.staffId && n.staffId === currentStaffId;
    }
    if (!n.roles || n.roles.length === 0) return true;
    return n.roles.includes(role);
  });
}
