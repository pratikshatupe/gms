import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

/**
 * NotificationContext — single source of truth for the notification log.
 * Persisted to localStorage so badge counts survive refreshes.
 *
 * Module 7 additions:
 *   - severity:   'success' | 'info' | 'warning' | 'critical'
 *   - icon:       emoji (defaults per type — see DEFAULT_ICON_FOR_TYPE)
 *   - link:       { page, params } for click-to-navigate; optional
 *   - actorName:  "John Doe" — displayed alongside the message
 *   - retention:  200-row cap + 90-day prune enforced on every write and on
 *                 hydrate, so the store never grows unbounded.
 *
 * Notification shape:
 *   {
 *     id,
 *     title:       string   — short label
 *     message:     string   — body text (with trailing full stop per spec)
 *     type:        string   — 'appointment_approved' | 'appointment_cancelled'
 *                           | 'walkin_arrived' | 'vip_pending' | 'report_ready'
 *                           | 'system_alert' — plus legacy 'appointment' /
 *                             'service' / 'check-in' kept for backward compat.
 *     severity:    'success' | 'info' | 'warning' | 'critical'
 *     icon:        emoji string
 *     link:        { page: string, params?: object } | null
 *     actorName:   string | null
 *     roles:       string[] — roles allowed to see it (lowercase).
 *                            Empty array → visible to everyone.
 *     staffId?:    string   — Service Staff targeting.
 *     orgId:       string | null — null ⇒ platform broadcast (SuperAdmin only).
 *     timestamp:   ISO string
 *     isRead:      boolean
 *   }
 */

const NotificationContext = createContext(null);
export const NOTIFICATIONS_STORAGE_KEY = 'cgms.notifications.v1';
export const NOTIFICATIONS_SYNC_EVENT  = 'notifications-updated';
const STORAGE_KEY = NOTIFICATIONS_STORAGE_KEY;

/* Retention policy — Module 7 Decision 4. */
export const NOTIFICATION_MAX_ROWS   = 200;
export const NOTIFICATION_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000; /* 90 days */

/* Canonical trigger types — Module 7 Decision 2. */
export const NOTIFICATION_TYPES = Object.freeze({
  APPOINTMENT_APPROVED:  'appointment_approved',
  APPOINTMENT_CANCELLED: 'appointment_cancelled',
  WALKIN_ARRIVED:        'walkin_arrived',
  VIP_PENDING:           'vip_pending',
  REPORT_READY:          'report_ready',
  SYSTEM_ALERT:          'system_alert',
});

const DEFAULT_ICON_FOR_TYPE = {
  appointment_approved:  '✅',
  appointment_cancelled: '❌',
  walkin_arrived:        '🚶',
  vip_pending:           '⭐',
  report_ready:          '📊',
  system_alert:          '🚨',
  /* Legacy — kept so pre-Module-7 rows still render with a sensible glyph. */
  appointment: '📅',
  service:     '☕',
  'check-in':  '✅',
};

const DEFAULT_SEVERITY_FOR_TYPE = {
  appointment_approved:  'success',
  appointment_cancelled: 'warning',
  walkin_arrived:        'info',
  vip_pending:           'warning',
  report_ready:          'info',
  system_alert:          'critical',
  appointment: 'info',
  service:     'info',
  'check-in':  'info',
};

const TYPE_TITLES = {
  appointment_approved:  'Appointment approved',
  appointment_cancelled: 'Appointment cancelled',
  walkin_arrived:        'Walk-in arrived',
  vip_pending:           'VIP appointment pending',
  report_ready:          'Report ready',
  system_alert:          'System alert',
  appointment:           'Appointment update',
  service:               'Service update',
  'check-in':            'Visitor check-in',
};

const ALL_MANAGEMENT_ROLES = ['superadmin', 'director', 'manager', 'reception'];

/**
 * Resolve the orgId to stamp on a notification at create-time. Callers may
 * pass one in explicitly; otherwise we fall back to the currently-logged-in
 * user. Super Admin writes are allowed without an orgId so platform-level
 * broadcasts (e.g. subscription updates) can reach every tenant.
 */
function currentUserOrgId() {
  try {
    const raw = localStorage.getItem('cgms_user');
    const u = raw ? JSON.parse(raw) : null;
    return u?.organisationId || u?.orgId || null;
  } catch {
    return null;
  }
}

function makeId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `ntf-${crypto.randomUUID()}`;
  }
  return `ntf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/* Migrate legacy entries (read → isRead, plus fill defaults for new fields)
   so cached data keeps working after Module 7 ships. */
function migrate(entry) {
  if (!entry) return null;
  const isRead = typeof entry.isRead === 'boolean'
    ? entry.isRead
    : Boolean(entry.read);
  const type = entry.type || 'appointment';
  return {
    ...entry,
    isRead,
    read: undefined,
    severity:  entry.severity  || DEFAULT_SEVERITY_FOR_TYPE[type] || 'info',
    icon:      entry.icon      || DEFAULT_ICON_FOR_TYPE[type]     || '🔔',
    link:      entry.link      || null,
    actorName: entry.actorName || null,
  };
}

/**
 * Enforce the 200-row cap + 90-day TTL. Applied on every write so the store
 * can't grow unbounded. Returns a new array — never mutates the input.
 */
function applyRetention(list) {
  if (!Array.isArray(list) || list.length === 0) return [];
  const cutoff = Date.now() - NOTIFICATION_MAX_AGE_MS;
  const pruned = list.filter((n) => {
    const t = n.timestamp ? new Date(n.timestamp).getTime() : NaN;
    if (Number.isNaN(t)) return true; /* keep rows without a parseable stamp */
    return t >= cutoff;
  });
  if (pruned.length <= NOTIFICATION_MAX_ROWS) return pruned;
  /* Drop oldest rows beyond the cap. Input is assumed newest-first. */
  return pruned.slice(0, NOTIFICATION_MAX_ROWS);
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return applyRetention(parsed.map(migrate).filter(Boolean));
  } catch {
    return [];
  }
}

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState(loadFromStorage);

  /* Persist on every change. React state is the source of truth in-tab, so
     every consumer that reads from useNotifications() re-renders automatically;
     no synthetic event is needed for our own writes. */
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
    } catch {
      /* Out of quota or disabled — non-fatal. */
    }
  }, [notifications]);

  /* Same-tab sync for writes that bypass the context. */
  useEffect(() => {
    const onExternal = () => setNotifications(loadFromStorage());
    window.addEventListener(NOTIFICATIONS_SYNC_EVENT, onExternal);
    return () => window.removeEventListener(NOTIFICATIONS_SYNC_EVENT, onExternal);
  }, []);

  /* Cross-tab sync — the native storage event fires only in OTHER tabs. */
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== STORAGE_KEY) return;
      try {
        const parsed = e.newValue ? JSON.parse(e.newValue) : [];
        setNotifications(
          Array.isArray(parsed)
            ? applyRetention(parsed.map(migrate).filter(Boolean))
            : [],
        );
      } catch {
        /* bad JSON — ignore */
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  /** Push a new notification. Every row is stamped with an orgId derived
   *  from the caller's choice → the currently-logged-in user → null.
   *  A null orgId is treated as a platform-wide broadcast and only Super
   *  Admins see it after org filtering (see visibleNotifications). */
  const addNotification = useCallback((input) => {
    if (!input || !input.message) return null;
    const type = input.type || 'appointment';
    const entry = {
      id:        makeId(),
      title:     input.title || TYPE_TITLES[type] || 'Notification',
      message:   input.message,
      type,
      severity:  input.severity  || DEFAULT_SEVERITY_FOR_TYPE[type] || 'info',
      icon:      input.icon      || DEFAULT_ICON_FOR_TYPE[type]     || '🔔',
      link:      input.link      || null,
      actorName: input.actorName || null,
      roles:     Array.isArray(input.roles) && input.roles.length
        ? input.roles.map((r) => r.toLowerCase())
        : ALL_MANAGEMENT_ROLES,
      staffId:   input.staffId || null,
      orgId:     input.orgId !== undefined ? input.orgId : currentUserOrgId(),
      timestamp: new Date().toISOString(),
      isRead:    false,
    };
    setNotifications((prev) => applyRetention([entry, ...prev]));
    return entry;
  }, []);

  const markAsRead = useCallback((id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) =>
      prev.some((n) => !n.isRead)
        ? prev.map((n) => ({ ...n, isRead: true }))
        : prev,
    );
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  /** Module 7 Decision 4 — clear only rows the user has already read. */
  const clearRead = useCallback(() => {
    setNotifications((prev) => prev.filter((n) => !n.isRead));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  /* Derived count — cheap, memoized, and exposed so consumers never
     reimplement the filter expression (which is how Sidebar/Topbar drift). */
  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications],
  );

  const value = useMemo(() => ({
    notifications,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    removeNotification,
    deleteNotification: removeNotification,
    clearRead,
    clearAll,
  }), [notifications, unreadCount, addNotification, markAsRead, markAllAsRead, removeNotification, clearRead, clearAll]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotifications must be used inside <NotificationProvider>');
  }
  return ctx;
}

/**
 * Filter notifications by what the given user is allowed to see.
 *
 *   1. ORG ISOLATION (primary) — user.organisationId === n.orgId. Super
 *      Admin bypasses this gate. A notification without an orgId is treated
 *      as a platform broadcast and is only surfaced to Super Admin to avoid
 *      accidental cross-tenant leakage of legacy rows.
 *   2. ROLE VISIBILITY — the notification's `roles` list must include the
 *      viewer's role (empty list = visible to all roles within the org).
 *   3. STAFF TARGETING — Service Staff only see rows whose staffId matches
 *      theirs, even after the org + role gates pass.
 */
export function visibleNotifications(notifications, user, currentStaffId) {
  const role = (user?.role || '').toLowerCase();
  const myOrg = user?.organisationId || user?.orgId || null;

  return (notifications || []).filter((n) => {
    /* Org gate. */
    if (role !== 'superadmin') {
      if (!myOrg) return false;           /* fail closed — unknown org */
      if (!n.orgId) return false;         /* legacy/global broadcasts hidden from tenants */
      if (n.orgId !== myOrg) return false;
    }

    /* Role + staff gates. */
    if (role === 'service') {
      return n.staffId && n.staffId === currentStaffId;
    }
    if (!n.roles || n.roles.length === 0) return true;
    return n.roles.includes(role);
  });
}

/**
 * Unified unread-count hook. Both Sidebar and Topbar call this so the
 * expression can never drift between them.
 */
export function useUnreadCount(user, currentStaffId) {
  const { notifications, unreadCount } = useNotifications();
  return useMemo(() => {
    const role = (user?.role || '').toLowerCase();
    if (role === 'superadmin') return unreadCount;
    return visibleNotifications(notifications, user, currentStaffId)
      .filter((n) => !n.isRead).length;
  }, [notifications, unreadCount, user, currentStaffId]);
}

/* Public helpers — exposed so pages that don't consume the context still
   get consistent defaults (e.g. the trigger hook stamping an icon when the
   caller omits one). */
export function iconForType(type) {
  return DEFAULT_ICON_FOR_TYPE[type] || '🔔';
}
export function severityForType(type) {
  return DEFAULT_SEVERITY_FOR_TYPE[type] || 'info';
}
export function titleForType(type) {
  return TYPE_TITLES[type] || 'Notification';
}
