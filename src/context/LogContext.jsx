import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAuth } from './AuthContext';

/**
 * LogContext — global audit trail.
 *
 * Log shape:
 *   {
 *     id,
 *     action:           string   — e.g. "Service Created"
 *     module:           string   — e.g. "Services"
 *     performedBy:      string   — user name (or "System" if unauthenticated)
 *     performedByRole:  string   — normalised lowercase role
 *     timestamp:        ISO string,
 *     metadata:         object   — free-form extra context (visitor name, etc.)
 *   }
 *
 * Persisted to localStorage; capped at MAX_LOGS newest entries so the store
 * can't grow without bound.
 */

const LogContext = createContext(null);
const STORAGE_KEY = 'cgms.auditLogs.v1';
const MAX_LOGS = 1000;

function makeId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `log-${crypto.randomUUID()}`;
  }
  return `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadLogs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function LogProvider({ children }) {
  const [logs, setLogs] = useState(loadLogs);
  /* Current actor lives in a ref so updating it doesn't re-render the tree.
     A tiny <LogActorSync /> mirrors AuthContext into this ref. */
  const actorRef = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
    } catch {
      /* Quota or private mode — non-fatal. */
    }
  }, [logs]);

  const setActor = useCallback((user) => {
    actorRef.current = user
      ? { name: user.name || 'Unknown', role: (user.role || '').toLowerCase() }
      : null;
  }, []);

  const addLog = useCallback((entry) => {
    if (!entry || !entry.action || !entry.module) return null;
    const actor = actorRef.current;
    const row = {
      id:              makeId(),
      action:          entry.action,
      module:          entry.module,
      performedBy:     actor?.name || 'System',
      performedByRole: actor?.role || '',
      timestamp:       new Date().toISOString(),
      metadata:        entry.metadata || {},
    };
    setLogs((prev) => [row, ...prev].slice(0, MAX_LOGS));
    return row;
  }, []);

  const clearLogs = useCallback(() => setLogs([]), []);

  const value = useMemo(
    () => ({ logs, addLog, clearLogs, setActor }),
    [logs, addLog, clearLogs, setActor],
  );

  return <LogContext.Provider value={value}>{children}</LogContext.Provider>;
}

export function useLog() {
  const ctx = useContext(LogContext);
  if (!ctx) {
    throw new Error('useLog must be used inside <LogProvider>');
  }
  return ctx;
}

/**
 * Drop-in component that pushes the currently logged-in user into the log
 * context's actor ref. Place it anywhere that sits inside both AuthProvider
 * and LogProvider — it renders nothing.
 */
export function LogActorSync() {
  const { user } = useAuth();
  const { setActor } = useLog();
  useEffect(() => { setActor(user); }, [user, setActor]);
  return null;
}
