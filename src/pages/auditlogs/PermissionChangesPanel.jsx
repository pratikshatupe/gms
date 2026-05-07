import React, { useEffect, useMemo, useState } from 'react';
import { Search, X, Eye } from 'lucide-react';
import {
  RBAC_AUDIT_EVENT,
  filterRbacLogsForUser,
  formatRbacTimestamp,
  readRbacAuditLogs,
} from '../../utils/rbacAuditLogger';
import { ACTIONS, MODULES, ROLES } from '../../utils/defaultPermissions';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

const roleLabel = (key) => ROLES.find((r) => r.key === key)?.label || key || '—';
const moduleLabel = (key) => MODULES.find((m) => m.key === key)?.label || key;

const lower = (v) => (v == null ? '' : String(v)).toLowerCase();

/* ─── Side-by-side diff renderer ─────────────────────────────────────── */

function cellStyle(value) {
  return value ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300'
               : 'bg-slate-100 text-slate-500 dark:bg-slate-500/10 dark:text-slate-400';
}

function MatrixSnapshot({ title, row }) {
  return (
    <div className="flex-1 min-w-0 rounded-[12px] border border-slate-200 bg-white p-3 dark:border-[#142535] dark:bg-[#071220]">
      <div className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {title}
      </div>
      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[320px] text-[12px]">
          <thead>
            <tr className="border-b border-slate-200 dark:border-[#142535]">
              <th className="px-2 py-1.5 text-left font-semibold text-slate-500 dark:text-slate-400">Module</th>
              {ACTIONS.map((a) => (
                <th key={a} className="px-2 py-1.5 text-center font-semibold capitalize text-slate-500 dark:text-slate-400">
                  {a}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MODULES.map((m) => {
              const r = row?.[m.key] || {};
              return (
                <tr key={m.key} className="border-b border-slate-100 last:border-b-0 dark:border-[#1E1C42]">
                  <td className="px-2 py-1.5 font-medium text-slate-700 dark:text-slate-200">{m.label}</td>
                  {ACTIONS.map((a) => (
                    <td key={a} className="px-2 py-1.5 text-center">
                      <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold ${cellStyle(r[a])}`}>
                        {r[a] ? 'YES' : 'NO'}
                      </span>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ChangesSummary({ changes }) {
  if (!changes || changes.length === 0) {
    return (
      <div className="rounded-[10px] border border-slate-200 bg-slate-50 p-3 text-[12px] text-slate-500 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-400">
        No cell-level changes recorded.
      </div>
    );
  }
  return (
    <div className="rounded-[10px] border border-slate-200 bg-white dark:border-[#142535] dark:bg-[#071220]">
      <div className="border-b border-slate-200 px-3 py-2 text-[11px] font-extrabold uppercase tracking-wide text-slate-400 dark:border-[#142535] dark:text-slate-500">
        Changes ({changes.length})
      </div>
      <ul className="max-h-56 divide-y divide-slate-100 overflow-y-auto dark:divide-[#1E1C42]">
        {changes.map((c, i) => (
          <li key={i} className="flex items-center justify-between gap-3 px-3 py-2 text-[12px]">
            <div className="min-w-0 truncate">
              <span className="font-semibold text-slate-700 dark:text-slate-200">{moduleLabel(c.moduleKey)}</span>
              <span className="ml-2 text-slate-500 dark:text-slate-400">· {c.action}</span>
            </div>
            <div className="flex items-center gap-1 whitespace-nowrap">
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${cellStyle(c.before)}`}>
                {c.before ? 'YES' : 'NO'}
              </span>
              <span className="text-slate-400">→</span>
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${cellStyle(c.after)}`}>
                {c.after ? 'YES' : 'NO'}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DetailsModal({ log, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!log) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="rbac-details-title"
      onClick={onClose}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-2xl dark:border-[#142535] dark:bg-[#0A1828]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 p-4 dark:border-[#142535]">
          <div className="min-w-0">
            <h3 id="rbac-details-title" className="text-[16px] font-extrabold text-[#0C2340] dark:text-slate-100">
              Permission Changes — {roleLabel(log.targetRole)}
            </h3>
            <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">
              Changed by <strong>{log.changedBy || 'System'}</strong>
              {log.changedByRole ? <span className="text-slate-400"> ({log.changedByRole})</span> : null}
              {' · '}
              {formatRbacTimestamp(log.timestamp)}
              {log.orgId ? <span className="text-slate-400"> · org {log.orgId}</span> : null}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-[#1E1E3F] dark:hover:text-slate-200"
          >
            <X size={18} />
          </button>
        </header>

        <div className="overflow-y-auto p-4">
          <ChangesSummary changes={log.changes} />

          <div className="mt-4 flex flex-col gap-3 lg:flex-row">
            <MatrixSnapshot title="Before" row={log.beforePermissions} />
            <MatrixSnapshot title="After"  row={log.afterPermissions} />
          </div>
        </div>

        <footer className="flex justify-end gap-2 border-t border-slate-200 p-3 dark:border-[#142535]">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[10px] border border-slate-200 bg-white px-4 py-2 text-[13px] font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-200 dark:hover:bg-[#1E1E3F]"
          >
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}

/* ─── Main panel ─────────────────────────────────────────────────────── */

export default function PermissionChangesPanel({ user }) {
  const [allLogs, setAllLogs] = useState(() => readRbacAuditLogs());
  const [search,   setSearch]   = useState('');
  const [page,     setPage]     = useState(1);
  const [perPage,  setPerPage]  = useState(10);
  const [selected, setSelected] = useState(null);

  /* Live sync — pick up new rows as soon as Roles & Permissions saves. */
  useEffect(() => {
    const refresh = () => setAllLogs(readRbacAuditLogs());
    const onStorage = (e) => { if (e.key === 'rbac_audit_logs.v1') refresh(); };
    window.addEventListener(RBAC_AUDIT_EVENT, refresh);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(RBAC_AUDIT_EVENT, refresh);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  /* Org scoping — Super Admin sees all; Director sees own-org rows only. */
  const scoped = useMemo(() => filterRbacLogsForUser(allLogs, user), [allLogs, user]);

  const filtered = useMemo(() => {
    const q = lower(search).trim();
    if (!q) return scoped;
    return scoped.filter((l) =>
      lower(l.changedBy).includes(q) ||
      lower(l.changedByRole).includes(q) ||
      lower(roleLabel(l.targetRole)).includes(q) ||
      lower(l.targetRole).includes(q) ||
      lower(l.orgId).includes(q) ||
      lower(formatRbacTimestamp(l.timestamp)).includes(q),
    );
  }, [scoped, search]);

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)),
    [filtered],
  );

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const paged = useMemo(
    () => sorted.slice((page - 1) * perPage, page * perPage),
    [sorted, page, perPage],
  );

  useEffect(() => { setPage(1); }, [search, perPage]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  return (
    <section
      aria-label="Permission Changes"
      className="w-full min-w-0 max-w-full rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm dark:border-[#142535] dark:bg-[#0A1828]"
    >
      <header className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-[16px] font-extrabold text-[#0C2340] dark:text-slate-100">
            Permission Changes
          </h3>
          <p className="text-[12px] text-slate-500 dark:text-slate-400">
            Every save in Roles & Permissions is logged with a before-and-after snapshot.
          </p>
        </div>

        <div className="relative w-full sm:max-w-xs">
          <Search
            size={14}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by role, user, date…"
            aria-label="Search permission changes"
            className="w-full rounded-[10px] border border-slate-200 bg-white py-2 pl-9 pr-9 text-[13px] text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-200 dark:focus:ring-sky-500/20"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-[#1E1E3F] dark:hover:text-slate-200"
            >
              <X size={13} aria-hidden="true" />
            </button>
          )}
        </div>
      </header>

      {/* Desktop table */}
      <div className="hidden lg:block w-full">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left dark:border-[#142535] dark:bg-[#071220]">
              <th className="px-3 py-2 text-[11px] font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400" style={{ width: 64 }}>
                Sr. No.
              </th>
              <th className="px-3 py-2 text-[11px] font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Role Modified
              </th>
              <th className="px-3 py-2 text-[11px] font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Changed By
              </th>
              <th className="px-3 py-2 text-[11px] font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Date &amp; Time
              </th>
              <th className="px-3 py-2 text-[11px] font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400" style={{ width: 140 }}>
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-10 text-center text-[13px] text-slate-500 dark:text-slate-400">
                  No records found.
                </td>
              </tr>
            ) : paged.map((log, idx) => (
              <tr
                key={log.id}
                className="border-b border-slate-100 hover:bg-slate-50 dark:border-[#1E1C42] dark:hover:bg-[#1E1E3F]"
              >
                <td className="px-3 py-2 text-[12px] font-semibold text-slate-400 dark:text-slate-500">
                  {(page - 1) * perPage + idx + 1}
                </td>
                <td className="px-3 py-2 text-[13px] font-semibold text-[#0C2340] dark:text-slate-100">
                  {roleLabel(log.targetRole)}
                </td>
                <td className="px-3 py-2 text-[13px] text-slate-700 dark:text-slate-200">
                  <div className="truncate font-semibold">{log.changedBy || 'System'}</div>
                  {log.changedByRole && (
                    <div className="text-[11px] text-slate-400">{log.changedByRole}</div>
                  )}
                </td>
                <td className="px-3 py-2 text-[12px] text-slate-500 dark:text-slate-400">
                  {formatRbacTimestamp(log.timestamp)}
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setSelected(log)}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-[10px] border border-sky-200 bg-sky-50 px-3 py-1.5 text-[12px] font-bold text-sky-700 transition hover:bg-sky-100 dark:border-sky-400/30 dark:bg-sky-500/10 dark:text-sky-300 dark:hover:bg-sky-500/20"
                  >
                    <Eye size={13} aria-hidden="true" />
                    View Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile / tablet card view */}
      <div className="block lg:hidden">
        {paged.length === 0 ? (
          <div className="px-3 py-10 text-center text-[13px] text-slate-500 dark:text-slate-400">No records found.</div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-[#1E1C42]">
            {paged.map((log, idx) => (
              <div key={log.id} className="px-4 py-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0">
                    <div className="font-bold text-[14px] text-[#0C2340] dark:text-slate-100">{roleLabel(log.targetRole)}</div>
                    <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{formatRbacTimestamp(log.timestamp)}</div>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 flex-shrink-0">#{(page - 1) * perPage + idx + 1}</span>
                </div>
                <div className="mb-3">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-0.5">Changed By</div>
                  <div className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">{log.changedBy || 'System'}</div>
                  {log.changedByRole && <div className="text-[11px] text-slate-400 dark:text-slate-500">{log.changedByRole}</div>}
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(log)}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-[10px] border border-sky-200 bg-sky-50 px-3 py-1.5 text-[12px] font-bold text-sky-700 transition hover:bg-sky-100 dark:border-sky-400/30 dark:bg-sky-500/10 dark:text-sky-300 dark:hover:bg-sky-500/20"
                >
                  <Eye size={13} aria-hidden="true" />
                  View Details
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {total > 0 && (
        <footer className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-[12px] text-slate-500 dark:text-slate-400">
            Showing <strong>{(page - 1) * perPage + 1}</strong>–
            <strong>{Math.min(page * perPage, total)}</strong> of <strong>{total}</strong>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-[12px] text-slate-500 dark:text-slate-400">
              Rows per page
              <select
                value={perPage}
                onChange={(e) => setPerPage(Number(e.target.value))}
                className="ml-2 cursor-pointer rounded-[8px] border border-slate-200 bg-white px-2 py-1 text-[12px] text-slate-700 outline-none focus:border-sky-400 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-200"
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="cursor-pointer rounded-[8px] border border-slate-200 bg-white px-3 py-1 text-[12px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-200 dark:hover:bg-[#1E1E3F]"
              >
                Previous
              </button>
              <span className="px-2 text-[12px] text-slate-500 dark:text-slate-400">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="cursor-pointer rounded-[8px] border border-slate-200 bg-white px-3 py-1 text-[12px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-200 dark:hover:bg-[#1E1E3F]"
              >
                Next
              </button>
            </div>
          </div>
        </footer>
      )}

      {selected && <DetailsModal log={selected} onClose={() => setSelected(null)} />}
    </section>
  );
}
