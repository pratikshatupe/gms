import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, X, ShieldCheck, FileText, PlusCircle, Pencil, Trash2, LogIn, LogOut, Download, FileSpreadsheet, Printer } from 'lucide-react';
import { useCollection, STORAGE_KEYS } from '../../store';
import { useRole } from '../../context/RoleContext';
import { useAuth } from '../../context/AuthContext';
import NoAccess from '../../components/NoAccess';
import { addAuditLog, AUDIT_LOGS_UPDATED_EVENT } from '../../utils/auditLogger';
import { downloadCsv, downloadXls, printToPdf } from '../../utils/exporters';
import { DataTable, DatePicker, Pagination, EmptyState, SearchableSelect } from '../../components/ui';
import PermissionChangesPanel from './PermissionChangesPanel';

/* ─── Config ────────────────────────────────────────────────────────────── */
const ACTIONS = [
  'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT',
  /* Compliance-critical verbs — recognised here so normaliseLog preserves
     them rather than collapsing to UPDATE, which would hide impersonation
     and permission-change events from filters and stats. */
  'IMPERSONATE_START', 'IMPERSONATE_END',
  'RESET', 'BILLING_RETRY', 'BILLING_RETRY_ALL', 'DATA_EXPORT',
  'SUSPEND', 'REACTIVATE',
];

const ACTION_BADGE = {
  CREATE:            'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300',
  UPDATE:            'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300',
  DELETE:            'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300',
  LOGIN:             'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/30 dark:bg-sky-500/10 dark:text-sky-300',
  LOGOUT:            'border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-500/30 dark:bg-slate-500/10 dark:text-slate-400',
  IMPERSONATE_START: 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300',
  IMPERSONATE_END:   'border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
  RESET:             'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300',
  DATA_EXPORT:       'border-indigo-200 bg-indigo-50 text-teal-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-indigo-300',
};

const ACTION_ICON = {
  CREATE:            PlusCircle,
  UPDATE:            Pencil,
  DELETE:            Trash2,
  LOGIN:             LogIn,
  LOGOUT:            LogOut,
  IMPERSONATE_START: ShieldCheck,
  IMPERSONATE_END:   ShieldCheck,
};

/* Severity classification — used for the row dot, the filter dropdown,
   and the "Critical" stat aggregate. Kept here so any consumer can
   import-and-derive instead of duplicating the rules. */
const SEVERITY = Object.freeze({
  INFO:     'info',
  WARNING:  'warning',
  CRITICAL: 'critical',
});

const CRITICAL_ACTIONS = new Set([
  'IMPERSONATE_START', 'IMPERSONATE_END',
  'DELETE', 'RESET', 'DATA_EXPORT', 'SUSPEND',
]);
const WARNING_ACTIONS = new Set([
  /* Reserved for permission-denied / rate-limit / validation events
     once those are wired into addAuditLog. Today this stays empty. */
]);

/* Returns 'info' | 'warning' | 'critical' for a given log row. RBAC matrix
   changes and any explicit "DENIED" descriptions also count as critical
   even when the action verb itself is generic. */
function severityFor(log) {
  if (!log) return SEVERITY.INFO;
  if (CRITICAL_ACTIONS.has(log.action)) return SEVERITY.CRITICAL;
  if (log.module === 'Roles & Permissions') return SEVERITY.CRITICAL;
  const desc = (log.description || '').toLowerCase();
  if (desc.includes('denied') || desc.includes('blocked') || desc.includes('failed')) return SEVERITY.WARNING;
  if (WARNING_ACTIONS.has(log.action)) return SEVERITY.WARNING;
  return SEVERITY.INFO;
}

const SEVERITY_META = {
  [SEVERITY.INFO]:     { label: 'Info',     dot: 'bg-emerald-500', ring: 'ring-emerald-200', text: 'text-emerald-700 dark:text-emerald-300' },
  [SEVERITY.WARNING]:  { label: 'Warning',  dot: 'bg-amber-500',   ring: 'ring-amber-200',   text: 'text-amber-700 dark:text-amber-300' },
  [SEVERITY.CRITICAL]: { label: 'Critical', dot: 'bg-rose-500',    ring: 'ring-rose-200',    text: 'text-rose-700 dark:text-rose-300' },
};

const ROLE_BADGE = {
  superadmin:   'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300',
  director:     'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/30 dark:bg-sky-500/10 dark:text-sky-300',
  manager:      'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-300',
  reception:    'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300',
  service:      'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
  servicestaff: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
};

const ROLE_LABEL = {
  superadmin:   'Super Admin',
  director:     'Director',
  manager:      'Manager',
  reception:    'Reception',
  service:      'Service Staff',
  servicestaff: 'Service Staff',
};

/* ─── Pure helpers ──────────────────────────────────────────────────────── */
const safeStr   = (v) => (v == null ? '' : String(v).trim());
const lower     = (v) => safeStr(v).toLowerCase();
const safeText  = (v, fallback = '—') => {
  if (v == null) return fallback;
  const s = typeof v === 'string' ? v : String(v);
  return s.trim() === '' ? fallback : s;
};

/** Normalise a log row — guards against corrupted entries from older writes. */
function normaliseLog(l) {
  if (!l || typeof l !== 'object') return null;
  const ts = typeof l.timestamp === 'number'
    ? l.timestamp
    : Number(l.timestamp) || Date.parse(l.timestamp) || 0;
  const action = ACTIONS.includes(l.action) ? l.action : (l.action ? String(l.action).toUpperCase() : 'UPDATE');
  return {
    id:          l.id != null ? String(l.id) : `log-${ts}-${Math.random().toString(36).slice(2, 8)}`,
    userName:    safeStr(l.userName) || 'System',
    role:        safeStr(l.role),
    action:      ACTIONS.includes(action) ? action : 'UPDATE',
    module:      safeStr(l.module) || 'Unknown',
    description: safeStr(l.description),
    orgId:       l.orgId || null,
    timestamp:   Number.isFinite(ts) ? ts : 0,
  };
}

/* DD/MM/YYYY, HH:MM AM/PM — per QA spec. Avoids `toLocaleString` because
   that defaults to the browser's locale (US gives "Apr 19, 2026"), which
   the audit-log compliance review explicitly rejects. */
function formatTimestamp(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '—';
  const dd  = String(d.getDate()).padStart(2, '0');
  const mm  = String(d.getMonth() + 1).padStart(2, '0');
  const yy  = d.getFullYear();
  const h24 = d.getHours();
  const hh  = String(h24 % 12 || 12).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const ampm = h24 >= 12 ? 'PM' : 'AM';
  return `${dd}/${mm}/${yy}, ${hh}:${min} ${ampm}`;
}

/* Same DD/MM/YYYY shape but with seconds — used in the row-detail modal
   (Fix 6) where compliance review wants second-level precision. */
function formatTimestampLong(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '—';
  const dd  = String(d.getDate()).padStart(2, '0');
  const mm  = String(d.getMonth() + 1).padStart(2, '0');
  const yy  = d.getFullYear();
  const h24 = d.getHours();
  const hh  = String(h24 % 12 || 12).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const sec = String(d.getSeconds()).padStart(2, '0');
  const ampm = h24 >= 12 ? 'PM' : 'AM';
  return `${dd}/${mm}/${yy} ${hh}:${min}:${sec} ${ampm}`;
}

/* ─── UI atoms ──────────────────────────────────────────────────────────── */
function ActionBadge({ action }) {
  const cls  = ACTION_BADGE[action] || ACTION_BADGE.UPDATE;
  const Icon = ACTION_ICON[action]   || Pencil;
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${cls}`}>
      <Icon size={11} aria-hidden="true" />
      {action}
    </span>
  );
}

function RoleBadge({ role }) {
  const key = lower(role);
  if (!key) return <span className="text-[11px] text-slate-400">—</span>;
  const cls = ROLE_BADGE[key] || 'border-slate-200 bg-slate-100 text-slate-500';
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${cls}`}>
      {ROLE_LABEL[key] || role}
    </span>
  );
}

function ModulePill({ module }) {
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[11px] font-semibold text-sky-700 dark:border-sky-400/30 dark:bg-sky-500/10 dark:text-sky-300">
      {safeText(module)}
    </span>
  );
}

function StatCard({ label, value, tone, Icon, onClick, title }) {
  const toneCls = {
    violet:  'border-sky-100 bg-sky-50 text-sky-700 dark:border-sky-400/20 dark:bg-sky-500/10 dark:text-sky-300',
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-600 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300',
    blue:    'border-blue-100 bg-blue-50 text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300',
    amber:   'border-amber-100 bg-amber-50 text-amber-600 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300',
    rose:    'border-rose-100 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300',
    indigo:  'border-indigo-100 bg-indigo-50 text-teal-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-indigo-300',
  }[tone];
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      title={title}
      className={`block w-full text-left rounded-[14px] border ${toneCls} p-4 shadow-sm transition ${onClick ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' : ''}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[28px] font-black leading-none font-['Outfit',sans-serif]">{value}</p>
          <p className="mt-1.5 text-[12px] font-semibold text-slate-500 dark:text-slate-400">{label}</p>
        </div>
        {Icon && <Icon size={18} aria-hidden="true" className="opacity-70" />}
      </div>
    </Tag>
  );
}

/** Detail modal shown on row click. Reads enriched fields if present
 *  (ip / userAgent / sessionId / before / after / relatedRecords) and
 *  falls back to "Not captured" placeholders for legacy entries. */
function LogDetailModal({ log, onClose }) {
  /* Close on Esc — parity with the rest of the app's modals. */
  useEffect(() => {
    if (!log) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [log, onClose]);

  if (!log) return null;
  const sev  = severityFor(log);
  const meta = SEVERITY_META[sev];
  const notCaptured = <span className="italic text-slate-400 dark:text-slate-500">Not captured</span>;
  const before = log.before || log.beforeState || null;
  const after  = log.after  || log.afterState  || null;

  const Row = ({ label, children }) => (
    <div className="grid grid-cols-[120px_1fr] gap-x-3 border-t border-slate-100 py-2 first:border-t-0 dark:border-[#142535]">
      <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="text-[13px] text-slate-700 dark:text-slate-200">{children}</dd>
    </div>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="audit-detail-title"
      className="fixed inset-0 z-[9100] flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div className="max-h-[90vh] w-full max-w-[640px] overflow-y-auto rounded-[14px] border border-slate-200 bg-white p-5 shadow-2xl sm:p-6 dark:border-[#142535] dark:bg-[#0A1828]">
        <header className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 id="audit-detail-title" className="m-0 text-[16px] font-extrabold text-[#0C2340] font-['Outfit',sans-serif] dark:text-slate-100">
              Audit Entry
            </h3>
            <p className="mt-0.5 text-[12px] text-slate-500 dark:text-slate-400">
              ID: <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] dark:bg-[#071220]">{log.id}</code>
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${meta.text}`}
            title={`${meta.label} severity`}
          >
            <span className={`inline-block h-2 w-2 rounded-full ${meta.dot}`} aria-hidden="true" />
            {meta.label}
          </span>
        </header>

        <dl className="rounded-[10px] border border-slate-200 px-3 dark:border-[#142535]">
          <Row label="Timestamp">{formatTimestampLong(log.timestamp)}</Row>
          <Row label="User">{safeText(log.userName)}</Row>
          <Row label="Role"><RoleBadge role={log.role} /></Row>
          <Row label="Action"><ActionBadge action={log.action} /></Row>
          <Row label="Module"><ModulePill module={log.module} /></Row>
          <Row label="Description">{safeText(log.description)}</Row>
          <Row label="Organisation">{log.orgId || notCaptured}</Row>
          <Row label="IP Address">{log.ip || log.ipAddress || notCaptured}</Row>
          <Row label="User Agent">{log.userAgent || notCaptured}</Row>
          <Row label="Session ID">{log.sessionId ? <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] dark:bg-[#071220]">{log.sessionId}</code> : notCaptured}</Row>
        </dl>

        {(before || after) && (
          <section className="mt-4">
            <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Before / After</h4>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <pre className="max-h-48 overflow-auto rounded-[8px] border border-slate-200 bg-slate-50 p-2 text-[11px] text-slate-700 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-200">
                {before ? JSON.stringify(before, null, 2) : 'Not captured'}
              </pre>
              <pre className="max-h-48 overflow-auto rounded-[8px] border border-slate-200 bg-slate-50 p-2 text-[11px] text-slate-700 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-200">
                {after ? JSON.stringify(after, null, 2) : 'Not captured'}
              </pre>
            </div>
          </section>
        )}

        {Array.isArray(log.relatedRecords) && log.relatedRecords.length > 0 && (
          <section className="mt-4">
            <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Related Records</h4>
            <ul className="space-y-1 text-[12px] text-sky-700 dark:text-sky-300">
              {log.relatedRecords.map((r, i) => (
                <li key={i}>{r.label || r.id || JSON.stringify(r)}</li>
              ))}
            </ul>
          </section>
        )}

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-[10px] border border-slate-200 bg-white px-4 py-2 text-[13px] font-bold text-slate-700 transition hover:bg-slate-50 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-200 dark:hover:bg-[#1E1E3F]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/** Mini-modal opened by clicking a user name in any audit row. Shows
 *  the user's role, total event count from the visible log set, and
 *  the latest five events with timestamp + action. A "Filter to this
 *  user" CTA applies the user filter so the table narrows accordingly. */
function UserSummaryModal({ userName, logs, onClose, onFilterToUser }) {
  useEffect(() => {
    if (!userName) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [userName, onClose]);

  if (!userName) return null;
  const userLogs = logs.filter((l) => l.userName === userName);
  const role = userLogs[0]?.role || '';
  const recent = [...userLogs].sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="audit-user-title"
      className="fixed inset-0 z-[9100] flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div className="max-h-[80vh] w-full max-w-[440px] overflow-y-auto rounded-[14px] border border-slate-200 bg-white p-5 shadow-2xl dark:border-[#142535] dark:bg-[#0A1828]">
        <header className="mb-3">
          <h3 id="audit-user-title" className="m-0 text-[16px] font-extrabold text-[#0C2340] font-['Outfit',sans-serif] dark:text-slate-100">
            {userName}
          </h3>
          <div className="mt-1 flex items-center gap-2">
            <RoleBadge role={role} />
            <span className="text-[12px] text-slate-500 dark:text-slate-400">
              {userLogs.length} event{userLogs.length === 1 ? '' : 's'} in current view
            </span>
          </div>
        </header>

        <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Last {recent.length} action{recent.length === 1 ? '' : 's'}
        </h4>
        {recent.length === 0 ? (
          <p className="text-[12px] italic text-slate-400">No events recorded.</p>
        ) : (
          <ul className="space-y-2">
            {recent.map((l) => (
              <li key={l.id} className="rounded-[8px] border border-slate-200 px-3 py-2 dark:border-[#142535]">
                <div className="flex items-center justify-between gap-2">
                  <ActionBadge action={l.action} />
                  <span className="text-[11px] text-slate-400">{formatTimestamp(l.timestamp)}</span>
                </div>
                <div className="mt-1.5 text-[12px] text-slate-700 dark:text-slate-200">
                  <span className="font-semibold">{l.module}</span> · {safeText(l.description)}
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-5 flex justify-between gap-2">
          <button
            type="button"
            onClick={() => { onFilterToUser?.(userName); onClose?.(); }}
            className="cursor-pointer rounded-[10px] border border-sky-200 bg-sky-50 px-3 py-2 text-[12px] font-bold text-sky-700 transition hover:bg-sky-100 dark:border-sky-400/30 dark:bg-sky-500/10 dark:text-sky-300 dark:hover:bg-sky-500/20"
          >
            Filter to this user
          </button>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-[10px] border border-slate-200 bg-white px-4 py-2 text-[12px] font-bold text-slate-700 transition hover:bg-slate-50 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-200 dark:hover:bg-[#1E1E3F]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function LogCard({ log }) {
  return (
    <article className="flex h-full flex-col rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-[#142535] dark:bg-[#0A1828]">
      <header className="flex flex-wrap items-center gap-1.5">
        <ActionBadge action={log.action} />
        <ModulePill module={log.module} />
      </header>
      <p className="mt-3 text-[13px] font-semibold text-[#0C2340] dark:text-slate-100">
        {safeText(log.description)}
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[12px] text-slate-600 dark:text-slate-300">
        <div>
          <dt className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500">User</dt>
          <dd className="mt-0.5 truncate font-semibold">{safeText(log.userName)}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500">Role</dt>
          <dd className="mt-0.5"><RoleBadge role={log.role} /></dd>
        </div>
        <div className="col-span-2">
          <dt className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500">Time</dt>
          <dd className="mt-0.5 break-words leading-snug">{formatTimestamp(log.timestamp)}</dd>
        </div>
      </dl>
    </article>
  );
}

/* ─── Main component ───────────────────────────────────────────────────── */
export default function AuditLogsPage({ setActivePage }) {
  /* Data layer — reactive, cross-tab-synced array. READ-ONLY by design:
     only add/replace helpers are destructured out, nothing in the UI exposes
     them. Writes happen via `addAuditLog` in utils/auditLogger.js. */
  const [rawLogs] = useCollection(STORAGE_KEYS.AUDIT_LOGS, []);

  /* RBAC gate. Defense-in-depth — App.jsx also gates the route. */
  const { hasPermission } = useRole();
  const { user } = useAuth();
  const canView = hasPermission('audit-logs', 'view');
  const role = (user?.role || '').toLowerCase();
  const isSuperAdmin = role === 'superadmin';
  const isDirector   = role === 'director';
  const myOrg = user?.organisationId || user?.orgId || null;

  /* Tab: activity logs vs permission changes. Permission Changes tab is only
     offered to Super Admin and Directors per spec. Initial value honours
     ?tab=rbac so deep-links from the Roles & Permissions page land on the
     right tab; the param is harmless for users without RBAC tab access (the
     conditional render below falls back to nothing). */
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'rbac' && isDirector
    ? 'rbac'
    : 'activity';
  const [tab, setTab] = useState(initialTab);

  /* Custom event bridge: `addAuditLog` dispatches AUDIT_LOGS_UPDATED_EVENT
     in addition to `cgms:storage`. Most consumers only need the latter, but
     we listen for both here so the page stays in sync even if another tab
     wrote via legacy code that only dispatched the audit event. */
  const [, bump] = useState(0);
  useEffect(() => {
    const onUpdate = () => bump((n) => n + 1);
    window.addEventListener(AUDIT_LOGS_UPDATED_EVENT, onUpdate);
    window.addEventListener('storage', onUpdate);
    return () => {
      window.removeEventListener(AUDIT_LOGS_UPDATED_EVENT, onUpdate);
      window.removeEventListener('storage', onUpdate);
    };
  }, []);

  /* Live updates — currently a 30s tick that bumps the render counter so
     relative timestamps stay fresh and any future remote-polling hook
     drops in here. Cross-tab sync already happens via the storage event
     above, so toggling this off doesn't lose new entries from other
     tabs — it just stops the periodic re-render of the page. */
  const [liveUpdates, setLiveUpdates] = useState(true);
  const [lastTickAt, setLastTickAt] = useState(() => Date.now());
  useEffect(() => {
    if (!liveUpdates) return undefined;
    const id = window.setInterval(() => {
      bump((n) => n + 1);
      setLastTickAt(Date.now());
    }, 30_000);
    return () => window.clearInterval(id);
  }, [liveUpdates]);

  /* ─── Filters ────────────────────────────────────────────────────── */
  const [search, setSearch]           = useState('');
  const [actionFilter, setAction]     = useState('all');
  const [moduleFilter, setModule]     = useState('all');
  const [userFilter, setUserFilter]   = useState('all');
  const [severityFilter, setSeverity] = useState('all');
  const [dateFrom, setDateFrom]       = useState('');
  const [dateTo, setDateTo]           = useState('');
  const [page, setPage]               = useState(1);
  const [perPage, setPerPage]         = useState(20);

  /* Module 6 deep-link — accept ?from=YYYY-MM-DD&to=YYYY-MM-DD so
     the Reports "Audit Report" tile can route here with a pre-set
     window. Runs once on mount; values are validated as ISO dates
     before being applied. Non-breaking when params are absent. */
  useEffect(() => {
    const isoRe = /^\d{4}-\d{2}-\d{2}$/;
    const fromQ = searchParams.get('from');
    const toQ   = searchParams.get('to');
    if (fromQ && isoRe.test(fromQ)) setDateFrom(fromQ);
    if (toQ   && isoRe.test(toQ))   setDateTo(toQ);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Quick-range presets — Today / 7 days / 30 days. Each one writes to
     dateFrom + dateTo (inclusive on both ends). Computed in local time
     so "Today" always matches the user's day, not UTC. */
  const applyPreset = useCallback((days) => {
    const fmt = (d) => {
      const yy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yy}-${mm}-${dd}`;
    };
    const today = new Date();
    const from  = new Date(today);
    from.setDate(today.getDate() - (days - 1));
    setDateFrom(fmt(from));
    setDateTo(fmt(today));
  }, []);
  const clearDateRange = useCallback(() => { setDateFrom(''); setDateTo(''); }, []);

  /* ─── Derived data (useMemo — perf per spec) ─────────────────────── */
  const logs = useMemo(() => {
    const normalised = Array.isArray(rawLogs)
      ? rawLogs.map(normaliseLog).filter(Boolean)
      : [];
    /* Org scope: Super Admin → all; everyone else → strict log.orgId match
       (per spec). Legacy rows that lack an orgId are hidden from tenant
       users to prevent cross-tenant leakage of pre-migration data. */
    if (isSuperAdmin) return normalised;
    if (!myOrg) return []; /* fail closed */
    return normalised.filter((l) => l.orgId === myOrg);
  }, [rawLogs, isSuperAdmin, myOrg]);

  /* Sorted: latest first. */
  const sorted = useMemo(
    () => [...logs].sort((a, b) => b.timestamp - a.timestamp),
    [logs],
  );

  const moduleOptions = useMemo(() => {
    const set = new Set(logs.map((l) => l.module).filter(Boolean));
    return [{ value: 'all', label: 'All modules' }, ...Array.from(set).sort().map((m) => ({ value: m, label: m }))];
  }, [logs]);

  const userOptions = useMemo(() => {
    const set = new Set(logs.map((l) => l.userName).filter(Boolean));
    return [{ value: 'all', label: 'All users' }, ...Array.from(set).sort().map((u) => ({ value: u, label: u }))];
  }, [logs]);

  const actionOptions = useMemo(
    () => [{ value: 'all', label: 'All actions' }, ...ACTIONS.map((a) => ({ value: a, label: a }))],
    [],
  );

  /* Date range bounds in epoch ms — computed once per filter change so the
     hot loop below stays cheap. Both ends inclusive: dateTo runs to the
     END of that day (23:59:59.999) so the same date in From and To
     captures everything that day. */
  const fromMs = useMemo(() => (dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null), [dateFrom]);
  const toMs   = useMemo(() => (dateTo   ? new Date(`${dateTo}T23:59:59.999`).getTime() : null), [dateTo]);

  const filtered = useMemo(() => {
    const q = lower(search);
    return sorted.filter((l) => {
      if (actionFilter !== 'all' && l.action !== actionFilter) return false;
      if (moduleFilter !== 'all' && l.module !== moduleFilter) return false;
      if (userFilter   !== 'all' && l.userName !== userFilter) return false;
      if (severityFilter !== 'all' && severityFor(l) !== severityFilter) return false;
      if (fromMs != null && l.timestamp < fromMs) return false;
      if (toMs   != null && l.timestamp > toMs)   return false;
      if (!q) return true;
      return (
        lower(l.userName).includes(q) ||
        lower(l.description).includes(q) ||
        lower(l.module).includes(q) ||
        lower(l.action).includes(q) ||
        lower(l.role).includes(q)
      );
    });
  }, [sorted, actionFilter, moduleFilter, userFilter, severityFilter, fromMs, toMs, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paginated  = useMemo(
    () => filtered.slice((page - 1) * perPage, page * perPage),
    [filtered, page, perPage],
  );

  useEffect(() => { setPage(1); }, [search, actionFilter, moduleFilter, userFilter, severityFilter, dateFrom, dateTo]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  /* Six-card stat grid: Total / Today / This Week — then the
     compliance-relevant trio: Logins / Impersonations / Permission Changes.
     Counts are all derived from `logs` (not `filtered`) so they show the
     true volume regardless of what's currently filtered on screen.
     "Today" and "This Week" use local-time day boundaries so a midnight
     log near a TZ shift can't drift between buckets. */
  const stats = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const weekStart  = new Date(todayStart); weekStart.setDate(todayStart.getDate() - 6);
    const todayMs = todayStart.getTime();
    const weekMs  = weekStart.getTime();

    let today = 0, week = 0, logins = 0, impersonations = 0, permChanges = 0;
    for (const l of logs) {
      if (l.timestamp >= todayMs) today++;
      if (l.timestamp >= weekMs)  week++;
      if (l.action === 'LOGIN')              logins++;
      if (l.action === 'IMPERSONATE_START')  impersonations++;
      if (l.module  === 'Roles & Permissions') permChanges++;
    }
    return { total: logs.length, today, week, logins, impersonations, permChanges };
  }, [logs]);

  /* Selected log opens the detail modal — stays in component state so the
     modal closes on Esc and on backdrop click. */
  const [selectedLog, setSelectedLog] = useState(null);
  /* Selected user opens the user-summary popover (Fix 7). Tracked
     separately so opening the user popover from inside a row doesn't
     also trigger the row-detail modal. */
  const [selectedUser, setSelectedUser] = useState(null);
  /* Selected row IDs for bulk operations (Fix 10). Set, not array, for
     O(1) lookup during render. */
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const toggleSelected = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);
  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  /* Lightweight toast for export feedback. Auto-dismisses after 2.4s. */
  const [toast, setToast] = useState(null);
  const showToast = useCallback((msg, kind = 'success') => {
    setToast({ msg, kind });
    window.setTimeout(() => setToast(null), 2400);
  }, []);

  /* Build the CSV/XLS/PDF row shape from the currently filtered logs.
     Uses the same DD/MM/YYYY formatter as the table so the exported file
     matches the on-screen display exactly. */
  const buildExportRows = useCallback(() => filtered.map((l, idx) => ({
    'Sr.':         (idx + 1),
    'Date & Time': formatTimestampLong(l.timestamp),
    'User':        safeText(l.userName),
    'Role':        ROLE_LABEL[lower(l.role)] || l.role || '—',
    'Action':      l.action,
    'Module':      l.module,
    'Description': safeText(l.description),
    'Org ID':      l.orgId || '—',
  })), [filtered]);

  const exportFilename = useCallback(() => {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = d.getFullYear();
    return `audit-logs_${dd}-${mm}-${yy}`;
  }, []);

  const recordExport = useCallback((format, count) => {
    addAuditLog({
      userName:    user?.name || 'System',
      role:        user?.role || '',
      action:      'UPDATE',
      module:      'Audit Logs',
      description: `Exported ${count} audit log entr${count === 1 ? 'y' : 'ies'} as ${format}.`,
    });
  }, [user]);

  const handleExportCsv = useCallback(() => {
    const rows = buildExportRows();
    if (rows.length === 0) { showToast('No logs to export. Adjust filters first.', 'error'); return; }
    downloadCsv(exportFilename(), rows);
    recordExport('CSV', rows.length);
    showToast('Audit logs exported to CSV successfully.');
  }, [buildExportRows, exportFilename, recordExport, showToast]);

  const handleExportXls = useCallback(() => {
    const rows = buildExportRows();
    if (rows.length === 0) { showToast('No logs to export. Adjust filters first.', 'error'); return; }
    downloadXls(exportFilename(), rows, { title: 'Audit Logs' });
    recordExport('Excel', rows.length);
    showToast('Audit logs exported to Excel successfully.');
  }, [buildExportRows, exportFilename, recordExport, showToast]);

  const handleExportPdf = useCallback(() => {
    const rows = buildExportRows();
    if (rows.length === 0) { showToast('No logs to export. Adjust filters first.', 'error'); return; }
    printToPdf(rows, { title: 'Audit Logs', subtitle: `${rows.length} entr${rows.length === 1 ? 'y' : 'ies'}`, filename: exportFilename() });
    recordExport('PDF', rows.length);
    showToast('Audit logs exported to PDF successfully.');
  }, [buildExportRows, exportFilename, recordExport, showToast]);

  /* Bulk export — operates on the currently checked rows, not the
     filtered slice. Reuses the same row shape so the export looks
     identical to a "filtered" export of the same set. */
  const buildSelectedExportRows = useCallback(() => {
    const set = selectedIds;
    const out = [];
    let n = 0;
    for (const l of filtered) {
      if (!set.has(l.id)) continue;
      n += 1;
      out.push({
        'Sr.':         n,
        'Date & Time': formatTimestampLong(l.timestamp),
        'User':        safeText(l.userName),
        'Role':        ROLE_LABEL[lower(l.role)] || l.role || '—',
        'Action':      l.action,
        'Module':      l.module,
        'Description': safeText(l.description),
        'Org ID':      l.orgId || '—',
      });
    }
    return out;
  }, [filtered, selectedIds]);

  const handleBulkExport = useCallback((format) => {
    const rows = buildSelectedExportRows();
    if (rows.length === 0) { showToast('No rows selected.', 'error'); return; }
    const fname = `${exportFilename()}_selected`;
    if (format === 'csv') downloadCsv(fname, rows);
    if (format === 'xls') downloadXls(fname, rows, { title: 'Audit Logs (Selected)' });
    if (format === 'pdf') printToPdf(rows, { title: 'Audit Logs (Selected)', subtitle: `${rows.length} entr${rows.length === 1 ? 'y' : 'ies'}`, filename: fname });
    recordExport(format.toUpperCase(), rows.length);
    showToast(`${rows.length} selected log${rows.length === 1 ? '' : 's'} exported to ${format.toUpperCase()}.`);
  }, [buildSelectedExportRows, exportFilename, recordExport, showToast]);

  const handleArchiveSelected = useCallback(() => {
    /* Archive is a no-backend stub — record the intent in the audit log
       so reviewers know the operator initiated it. Real cold-storage
       move lands once the backend exposes an archive bucket. */
    const count = selectedIds.size;
    if (count === 0) { showToast('No rows selected.', 'error'); return; }
    addAuditLog({
      userName:    user?.name || 'System',
      role:        user?.role || '',
      action:      'UPDATE',
      module:      'Audit Logs',
      description: `Queued ${count} audit log entr${count === 1 ? 'y' : 'ies'} for archival.`,
    });
    showToast(`${count} log${count === 1 ? '' : 's'} queued for archival.`);
    clearSelection();
  }, [selectedIds, user, showToast, clearSelection]);

  const handleSearch = useCallback((next) => { setSearch(next); setPage(1); }, []);
  const hasFilters = Boolean(
    search || actionFilter !== 'all' || moduleFilter !== 'all' ||
    userFilter !== 'all' || severityFilter !== 'all' || dateFrom || dateTo,
  );
  const clearFilters = useCallback(() => {
    setSearch(''); setAction('all'); setModule('all'); setUserFilter('all');
    setSeverity('all'); setDateFrom(''); setDateTo('');
  }, []);

  const severityOptions = useMemo(() => ([
    { value: 'all',                label: 'All severities' },
    { value: SEVERITY.CRITICAL,    label: 'Critical' },
    { value: SEVERITY.WARNING,     label: 'Warning' },
    { value: SEVERITY.INFO,        label: 'Info' },
  ]), []);

  /* ─── Table columns ──────────────────────────────────────────────── */
  /* Header check-all state for the visible page. Indeterminate when
     some-but-not-all rows on this page are selected. */
  const visiblePageIds = useMemo(() => paginated.map((l) => l.id), [paginated]);
  const allVisibleSelected = visiblePageIds.length > 0 && visiblePageIds.every((id) => selectedIds.has(id));
  const someVisibleSelected = visiblePageIds.some((id) => selectedIds.has(id));
  const toggleAllVisible = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const id of visiblePageIds) next.delete(id);
      } else {
        for (const id of visiblePageIds) next.add(id);
      }
      return next;
    });
  }, [allVisibleSelected, visiblePageIds]);

  const columns = useMemo(() => [
    {
      key: 'select',
      header: (
        <input
          type="checkbox"
          aria-label="Select all visible logs"
          checked={allVisibleSelected}
          ref={(el) => { if (el) el.indeterminate = !allVisibleSelected && someVisibleSelected; }}
          onChange={toggleAllVisible}
          onClick={(e) => e.stopPropagation()}
          className="h-3.5 w-3.5 cursor-pointer accent-sky-600"
        />
      ),
      width: '36px',
      nowrap: true,
      render: (row) => (
        <input
          type="checkbox"
          aria-label={`Select log ${row.id}`}
          checked={selectedIds.has(row.id)}
          onChange={() => toggleSelected(row.id)}
          onClick={(e) => e.stopPropagation()}
          className="h-3.5 w-3.5 cursor-pointer accent-sky-600"
        />
      ),
    },
    {
      key: 'severity',
      header: '',
      width: '32px',
      nowrap: true,
      render: (row) => {
        const sev  = severityFor(row);
        const meta = SEVERITY_META[sev];
        return (
          <span
            title={`${meta.label} severity`}
            aria-label={`${meta.label} severity`}
            className={`inline-block h-2.5 w-2.5 rounded-full ring-2 ${meta.dot} ${meta.ring}`}
          />
        );
      },
    },
    {
      key: 'sr',
      header: 'Sr.',
      width: '64px',
      nowrap: true,
      render: (_row, idx) => (
        <span className="font-semibold text-slate-400 dark:text-slate-500">
          {(page - 1) * perPage + idx + 1}
        </span>
      ),
    },
    {
      key: 'user',
      header: 'User',
      nowrap: true,
      cellClassName: 'py-3',
      render: (row) => (
        <div className="min-w-0">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setSelectedUser(row.userName); }}
            title={`Open quick summary for ${safeText(row.userName)}`}
            className="truncate cursor-pointer text-left text-[13px] font-bold text-[#0C2340] underline-offset-2 transition hover:text-sky-700 hover:underline dark:text-slate-100 dark:hover:text-sky-300"
          >
            {safeText(row.userName)}
          </button>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      nowrap: true,
      cellClassName: 'py-3',
      render: (row) => <RoleBadge role={row.role} />,
    },
    {
      key: 'action',
      header: 'Action',
      nowrap: true,
      cellClassName: 'py-3',
      render: (row) => <ActionBadge action={row.action} />,
    },
    {
      key: 'module',
      header: 'Module',
      nowrap: true,
      cellClassName: 'py-3',
      render: (row) => <ModulePill module={row.module} />,
    },
    {
      key: 'description',
      header: 'Description',
      cellClassName: 'py-3 text-slate-700 dark:text-slate-200',
      render: (row) => (
        <span className="text-[13px]">{safeText(row.description)}</span>
      ),
    },
    {
      key: 'timestamp',
      header: 'Date & Time',
      cellClassName: 'py-3 text-slate-500 dark:text-slate-400 text-[12px] min-w-[120px] max-w-[160px] break-words',
      render: (row) => (
        <span className="block leading-snug">{formatTimestamp(row.timestamp)}</span>
      ),
    },
  ], [page, perPage, allVisibleSelected, someVisibleSelected, selectedIds, toggleAllVisible, toggleSelected]);

  if (!canView) {
    return (
      <NoAccess
        module="Audit Logs"
        onGoBack={setActivePage ? () => setActivePage('dashboard') : undefined}
      />
    );
  }

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-slate-50 px-4 py-6 sm:px-6 lg:px-8 dark:bg-[#050E1A]">
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={[
            'fixed right-6 top-20 z-[9999] max-w-sm rounded-[10px] px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg',
            toast.kind === 'error' ? 'bg-rose-600' : 'bg-emerald-600',
          ].join(' ')}
        >
          {toast.msg}
        </div>
      )}
      <div className="mx-auto w-full max-w-7xl min-w-0 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="break-words text-[20px] font-extrabold text-[#0C2340] font-['Outfit',sans-serif] dark:text-slate-100">
              Audit Logs
            </h2>
            <p className="mt-0.5 text-[13px] text-slate-400 dark:text-slate-500">
              Track all system activities{isSuperAdmin ? ' across every organisation.' : ' within your organisation.'}
            </p>
          </div>
 
          <button
            type="button"
            onClick={() => setLiveUpdates((v) => !v)}
            aria-pressed={liveUpdates}
            title={liveUpdates ? 'Live updates on — refreshing every 30s' : 'Live updates paused — click to resume'}
            className={`inline-flex cursor-pointer items-center gap-2 rounded-[10px] border px-3 py-1.5 text-[12px] font-bold transition ${
              liveUpdates
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
                : 'border-slate-200 bg-white text-slate-500 dark:border-[#142535] dark:bg-[#0A1828] dark:text-slate-400'
            }`}
          >
            <span
              aria-hidden="true"
              className={`inline-block h-2 w-2 rounded-full ${liveUpdates ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}
            />
            {liveUpdates ? 'LIVE' : 'Paused'}
            <span className="ml-1 text-[10px] font-semibold opacity-70">
              {liveUpdates ? 'updated ' + formatTimestamp(lastTickAt).split(', ')[1] : ''}
            </span>
          </button>
        </div>

        {isDirector && (
          <div
            role="tablist"
            aria-label="Audit log views"
            className="flex w-full flex-wrap items-center gap-2 rounded-[12px] border border-slate-200 bg-white p-1 shadow-sm dark:border-[#142535] dark:bg-[#0A1828]"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'activity'}
              onClick={() => setTab('activity')}
              className={[
                'cursor-pointer rounded-[10px] px-4 py-2 text-[13px] font-semibold transition',
                tab === 'activity'
                  ? 'bg-sky-500 text-white shadow'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[#1E1E3F]',
              ].join(' ')}
            >
              Activity
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'rbac'}
              onClick={() => setTab('rbac')}
              className={[
                'cursor-pointer rounded-[10px] px-4 py-2 text-[13px] font-semibold transition',
                tab === 'rbac'
                  ? 'bg-sky-500 text-white shadow'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[#1E1E3F]',
              ].join(' ')}
            >
              Permission Changes
            </button>
          </div>
        )}

        {tab === 'rbac' && isDirector ? (
          <PermissionChangesPanel user={user} />
        ) : null}

        {tab === 'activity' && <>

   
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="mr-auto text-[12px] font-semibold text-slate-500 dark:text-slate-400">
            Export {filtered.length} filtered entr{filtered.length === 1 ? 'y' : 'ies'}
          </span>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filtered.length === 0}
            title={filtered.length === 0 ? 'No logs match the current filters.' : 'Download the filtered logs as CSV'}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-[12px] font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#142535] dark:bg-[#0A1828] dark:text-slate-200 dark:hover:bg-[#1E1E3F]"
          >
            <Download size={13} aria-hidden="true" /> Export CSV
          </button>
          <button
            type="button"
            onClick={handleExportXls}
            disabled={filtered.length === 0}
            title={filtered.length === 0 ? 'No logs match the current filters.' : 'Download the filtered logs as Excel'}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-[10px] border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20"
          >
            <FileSpreadsheet size={13} aria-hidden="true" /> Export Excel
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={filtered.length === 0}
            title={filtered.length === 0 ? 'No logs match the current filters.' : 'Open a print-ready window — choose Save as PDF'}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-[10px] border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-bold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20"
          >
            <Printer size={13} aria-hidden="true" /> Export PDF
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard
            label="Total Logs" value={stats.total} tone="violet" Icon={FileText}
            title="Show every audit log entry visible to you"
            onClick={clearFilters}
          />
          <StatCard
            label="Today" value={stats.today} tone="blue" Icon={ShieldCheck}
            title="Filter to entries from today (00:00 onwards)"
            onClick={() => { applyPreset(1); setAction('all'); setModule('all'); setUserFilter('all'); setSearch(''); }}
          />
          <StatCard
            label="This Week" value={stats.week} tone="emerald" Icon={ShieldCheck}
            title="Filter to entries from the last 7 days"
            onClick={() => { applyPreset(7); setAction('all'); setModule('all'); setUserFilter('all'); setSearch(''); }}
          />
          <StatCard
            label="Logins" value={stats.logins} tone="indigo" Icon={LogIn}
            title="Filter to LOGIN events (sign-ins across all users)"
            onClick={() => { setAction('LOGIN'); setModule('all'); setUserFilter('all'); setSearch(''); clearDateRange(); }}
          />
          <StatCard
            label="Impersonations" value={stats.impersonations} tone="amber" Icon={ShieldCheck}
            title="Filter to IMPERSONATE_START events — compliance-critical"
            onClick={() => { setAction('IMPERSONATE_START'); setModule('all'); setUserFilter('all'); setSearch(''); clearDateRange(); }}
          />
          <StatCard
            label="Permission Changes" value={stats.permChanges} tone="rose" Icon={ShieldCheck}
            title="Filter to RBAC events under Roles & Permissions"
            onClick={() => { setAction('all'); setModule('Roles & Permissions'); setUserFilter('all'); setSearch(''); clearDateRange(); }}
          />
        </div>

        <div className="rounded-[14px] border border-slate-200 bg-white p-3 shadow-sm dark:border-[#142535] dark:bg-[#0A1828]">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="relative lg:col-span-2">
              <Search
                size={14}
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search by user, description, or action…"
                aria-label="Search audit logs"
                className="w-full rounded-[10px] border border-slate-200 bg-white py-2 pl-9 pr-9 text-[13px] text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-200 dark:focus:ring-sky-500/20"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => handleSearch('')}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-[#1E1E3F] dark:hover:text-slate-200"
                >
                  <X size={13} aria-hidden="true" />
                </button>
              )}
            </div>

            <SearchableSelect
              value={actionFilter}
              onChange={(v) => setAction(v)}
              options={actionOptions}
              placeholder="Filter by action"
            />

            <SearchableSelect
              value={moduleFilter}
              onChange={(v) => setModule(v)}
              options={moduleOptions}
              placeholder="Filter by module"
            />

            <SearchableSelect
              value={userFilter}
              onChange={(v) => setUserFilter(v)}
              options={userOptions}
              placeholder="Filter by user"
            />

            <SearchableSelect
              value={severityFilter}
              onChange={(v) => setSeverity(v)}
              options={severityOptions}
              placeholder="Filter by severity"
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">From</span>
              <div className="w-[160px]">
                <DatePicker
                  value={dateFrom}
                  onChange={(iso) => setDateFrom(iso)}
                  max={dateTo || undefined}
                  aria-label="From date"
                />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">To</span>
              <div className="w-[160px]">
                <DatePicker
                  value={dateTo}
                  onChange={(iso) => setDateTo(iso)}
                  min={dateFrom || undefined}
                  aria-label="To date"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => applyPreset(1)}
                title="Just today"
                className="cursor-pointer rounded-[8px] border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-300 dark:hover:bg-sky-500/10 dark:hover:text-sky-300"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => applyPreset(7)}
                title="Last 7 days including today"
                className="cursor-pointer rounded-[8px] border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-300 dark:hover:bg-sky-500/10 dark:hover:text-sky-300"
              >
                7 days
              </button>
              <button
                type="button"
                onClick={() => applyPreset(30)}
                title="Last 30 days including today"
                className="cursor-pointer rounded-[8px] border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-300 dark:hover:bg-sky-500/10 dark:hover:text-sky-300"
              >
                30 days
              </button>
              {(dateFrom || dateTo) && (
                <button
                  type="button"
                  onClick={clearDateRange}
                  title="Clear the date range"
                  className="cursor-pointer rounded-[8px] border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500 transition hover:bg-slate-50 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-300 dark:hover:bg-[#1E1E3F]"
                >
                  Clear
                </button>
              )}
            </div>
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="cursor-pointer rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-200 dark:hover:bg-[#1E1E3F]"
              >
                Clear filters
              </button>
            )}
            <span className="ml-auto text-[11px] font-semibold text-slate-400 dark:text-slate-500">
              Showing {filtered.length} of {logs.length}
            </span>
          </div>
        </div>

        {selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-[12px] border border-sky-200 bg-sky-50 px-3 py-2 dark:border-sky-400/30 dark:bg-sky-500/10">
            <span className="text-[12px] font-bold text-sky-700 dark:text-sky-300">
              {selectedIds.size} selected
            </span>
            <button
              type="button"
              onClick={() => handleBulkExport('csv')}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 transition hover:bg-slate-50 dark:border-[#142535] dark:bg-[#0A1828] dark:text-slate-200 dark:hover:bg-[#1E1E3F]"
            >
              <Download size={11} aria-hidden="true" /> Export CSV
            </button>
            <button
              type="button"
              onClick={() => handleBulkExport('xls')}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] border border-emerald-200 bg-white px-2.5 py-1 text-[11px] font-bold text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-500/30 dark:bg-[#0A1828] dark:text-emerald-300 dark:hover:bg-emerald-500/10"
            >
              <FileSpreadsheet size={11} aria-hidden="true" /> Export Excel
            </button>
            <button
              type="button"
              onClick={() => handleBulkExport('pdf')}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] border border-rose-200 bg-white px-2.5 py-1 text-[11px] font-bold text-rose-700 transition hover:bg-rose-50 dark:border-rose-500/30 dark:bg-[#0A1828] dark:text-rose-300 dark:hover:bg-rose-500/10"
            >
              <Printer size={11} aria-hidden="true" /> Export PDF
            </button>
            <button
              type="button"
              onClick={handleArchiveSelected}
              title="Queue selected entries for cold-storage archive (stub — records intent only)"
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] border border-amber-200 bg-white px-2.5 py-1 text-[11px] font-bold text-amber-700 transition hover:bg-amber-50 dark:border-amber-500/30 dark:bg-[#0A1828] dark:text-amber-300 dark:hover:bg-amber-500/10"
            >
              Archive
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="ml-auto cursor-pointer rounded-[8px] border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500 transition hover:bg-slate-50 dark:border-[#142535] dark:bg-[#0A1828] dark:text-slate-400 dark:hover:bg-[#1E1E3F]"
            >
              Clear selection
            </button>
          </div>
        )}

        <div className="mt-2 hidden w-full min-w-0 max-w-full lg:block">
          <DataTable
            className="w-full min-w-0 max-w-full shadow-md"
            columns={columns}
            rows={paginated}
            getRowKey={(row) => row.id}
            page={page}
            perPage={perPage}
            total={filtered.length}
            onPageChange={setPage}
            onPerPageChange={setPerPage}
            onRowClick={(row) => setSelectedLog(row)}
            emptyState={
              <EmptyState
                message={hasFilters ? 'No matching logs' : 'No activity yet'}
                description={
                  hasFilters
                    ? 'Try adjusting filters or search.'
                    : 'System actions will appear here as they happen.'
                }
              />
            }
          />
        </div>

        <section
          aria-label="Audit log entries"
          className="mt-2 w-full min-w-0 max-w-full overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-md lg:hidden dark:border-[#142535] dark:bg-[#0A1828]"
        >
          {paginated.length === 0 ? (
            <EmptyState
              message={hasFilters ? 'No matching logs' : 'No activity yet'}
              description={
                hasFilters
                  ? 'Try adjusting filters or search.'
                  : 'System actions will appear here as they happen.'
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
              {paginated.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setSelectedLog(l)}
                  className="text-left focus:outline-none focus:ring-2 focus:ring-sky-500/30 rounded-[14px]"
                >
                  <LogCard log={l} />
                </button>
              ))}
            </div>
          )}

          {paginated.length > 0 && (
            <Pagination
              page={page}
              perPage={perPage}
              total={filtered.length}
              onPageChange={setPage}
              onPerPageChange={(n) => { setPerPage(n); setPage(1); }}
            />
          )}
        </section>
        </>}
      </div>

      <LogDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />
      <UserSummaryModal
        userName={selectedUser}
        logs={logs}
        onClose={() => setSelectedUser(null)}
        onFilterToUser={(name) => { setUserFilter(name); setPage(1); }}
      />
    </div>
  );
}