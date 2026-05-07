/**
 * RBAC Audit Logger — dedicated persistence for permission-change events.
 *
 * Every save in the Roles & Permissions editor produces one log per role
 * whose matrix actually differs from the previous state. Each row includes:
 *
 *   {
 *     id,
 *     changedBy:          string  — display name of the actor
 *     changedByRole:      string  — role string of the actor (e.g. 'superadmin')
 *     targetRole:         string  — ROLE_KEYS member whose matrix changed
 *     beforePermissions:  object  — snapshot BEFORE the change (just that role's row)
 *     afterPermissions:   object  — snapshot AFTER the change (just that role's row)
 *     changes:            array   — diff cells, each { moduleKey, action, before, after }
 *     orgId:              string  — organisation the actor belongs to, if any
 *     timestamp:          number  — epoch ms; display via formatRbacTimestamp()
 *   }
 *
 * Capped at MAX_LOGS newest rows so the store can't grow without bound.
 *
 * Why a separate store?
 *   The generic audit logger in ./auditLogger.js tracks user-visible domain
 *   actions (CREATE/UPDATE/DELETE on visitors/rooms/etc). Permission changes
 *   carry a much larger payload (two JSON snapshots), have no module/action
 *   verb that fits the CRUD badge set, and need a different UI (side-by-side
 *   diff). Keeping them on their own key also means a tenant can wipe one
 *   log stream without losing the other.
 */

import { STORAGE_KEYS } from '../store/keys';

export const RBAC_AUDIT_LOGS_KEY   = 'rbac_audit_logs.v1';
export const RBAC_AUDIT_EVENT      = 'rbac-audit-logs-updated';
const MAX_LOGS = 500;

function makeId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `rbac-${crypto.randomUUID()}`;
  }
  return `rbac-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function safeRead() {
  try {
    const raw = localStorage.getItem(RBAC_AUDIT_LOGS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safeWrite(list) {
  try {
    localStorage.setItem(RBAC_AUDIT_LOGS_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

function broadcast() {
  try {
    window.dispatchEvent(new Event(RBAC_AUDIT_EVENT));
  } catch { /* no-op in jsdom / SSR */ }
}

/**
 * Read the currently logged-in user for the actor fields. We don't take a
 * dependency on AuthContext here because this helper needs to be callable
 * from non-component code paths too.
 */
export function getCurrentUserSnapshot() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.USER);
    if (!raw) return { name: 'System', role: '', orgId: null };
    const u = JSON.parse(raw) || {};
    return {
      name:  u.name || u.label || 'System',
      role:  (u.role || '').toString(),
      orgId: u.organisationId || u.orgId || null,
    };
  } catch {
    return { name: 'System', role: '', orgId: null };
  }
}

export function readRbacAuditLogs() {
  return safeRead();
}

/**
 * Diff a role's before/after matrix row-by-row.
 * Returns every cell whose boolean value changed.
 *
 *   diffRoleMatrix({rooms:{view:true}}, {rooms:{view:false}}, MODULES, ACTIONS)
 *     → [{ moduleKey:'rooms', action:'view', before:true, after:false }]
 */
export function diffRoleMatrix(before, after, modules, actions) {
  const changes = [];
  for (const m of modules || []) {
    const key = m.key || m;
    for (const a of actions || []) {
      const b = Boolean(before?.[key]?.[a]);
      const x = Boolean(after?.[key]?.[a]);
      if (b !== x) changes.push({ moduleKey: key, action: a, before: b, after: x });
    }
  }
  return changes;
}

/**
 * Append a permission-change log. Silently no-ops if storage is unavailable.
 * Returns the row that was written (or null on failure).
 */
export function addRbacAuditLog(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const actor = getCurrentUserSnapshot();

  const row = {
    id: makeId(),
    changedBy:          entry.changedBy         || actor.name,
    changedByRole:      entry.changedByRole     || actor.role,
    targetRole:         entry.targetRole        || '',
    beforePermissions:  entry.beforePermissions || {},
    afterPermissions:   entry.afterPermissions  || {},
    changes:            Array.isArray(entry.changes) ? entry.changes : [],
    orgId:              entry.orgId !== undefined ? entry.orgId : actor.orgId,
    timestamp:          typeof entry.timestamp === 'number' ? entry.timestamp : Date.now(),
  };

  const next = [row, ...safeRead()].slice(0, MAX_LOGS);
  safeWrite(next);
  broadcast();
  return row;
}

/** Write many rows in one batch (one per changed role). */
export function addRbacAuditLogs(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return [];
  const actor = getCurrentUserSnapshot();
  const rows = entries.map((entry) => ({
    id: makeId(),
    changedBy:         entry.changedBy         || actor.name,
    changedByRole:     entry.changedByRole     || actor.role,
    targetRole:        entry.targetRole        || '',
    beforePermissions: entry.beforePermissions || {},
    afterPermissions:  entry.afterPermissions  || {},
    changes:           Array.isArray(entry.changes) ? entry.changes : [],
    orgId:             entry.orgId !== undefined ? entry.orgId : actor.orgId,
    timestamp:         typeof entry.timestamp === 'number' ? entry.timestamp : Date.now(),
  }));
  const next = [...rows, ...safeRead()].slice(0, MAX_LOGS);
  safeWrite(next);
  broadcast();
  return rows;
}

/** Scope logs by org for Director-level visibility.
 *    Super Admin → every row.
 *    Director / others → rows matching their orgId OR rows with no orgId
 *      (Super Admin global changes have no orgId, but should be visible
 *       to Directors since those changes affect their org's roles too). */
export function filterRbacLogsForUser(logs, user) {
  if (!Array.isArray(logs)) return [];
  const role = (user?.role || '').toString().toLowerCase();
  if (role === 'superadmin') return logs;
  const myOrg = user?.organisationId || user?.orgId || null;
  if (!myOrg) return []; /* fail closed */
  return logs.filter((l) => l.orgId === myOrg || !l.orgId);
}

/**
 * Render epoch ms as "DD/MM/YYYY HH:MM" in 24-hour form — the exact format
 * the spec asks for on every log row.
 */
export function formatRbacTimestamp(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '—';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}