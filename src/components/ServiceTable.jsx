import React, { useMemo } from 'react';
import ServiceCard, { ServiceStatusBadge } from './ServiceCard';
import { SERVICE_STATUSES } from '../data/mockServices';

function formatTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

/* Matches the Appointments table button class — same shape, padding, label
   size — for visual consistency across list pages. */
const iconBtn =
  'inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-2.5 py-1 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50';

/**
 * Per-row predicates from `src/utils/servicePermissions.js`:
 *   canStartRow(service)    → true when the logged-in user may start it
 *   canCompleteRow(service) → true when the logged-in user may complete it
 *
 * Button visibility is delegated to these — no role logic lives here.
 */
export default function ServiceTable({
  rows,
  loading = false,
  search = '',
  onSearchChange,
  statusFilter = 'all',
  onStatusFilterChange,
  onStart,
  onComplete,
  onEdit,
  onDelete,
  canStartRow = () => false,
  canCompleteRow = () => false,
  canEdit = false,
  canDelete = false,
  largeActions = false,
}) {
  const hasFilters = Boolean(search || statusFilter !== 'all');

  const empty = useMemo(() => rows.length === 0, [rows]);

  return (
    <section className="w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 md:flex-row md:items-center md:justify-between">
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange?.(e.target.value)}
          placeholder="Search by visitor, service, staff…"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 md:max-w-sm"
        />
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange?.(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-sky-400"
          >
            <option value="all">All statuses</option>
            {SERVICE_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                onSearchChange?.('');
                onStatusFilterChange?.('all');
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex min-h-[220px] items-center justify-center p-8">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-200 border-t-sky-700" />
        </div>
      ) : empty ? (
        <div className="flex min-h-[220px] flex-col items-center justify-center p-8 text-center">
          <div className="mb-3 text-4xl" aria-hidden="true">🛎️</div>
          <h4 className="text-sm font-semibold text-slate-700">No records found.</h4>
          <p className="mt-1 text-xs text-slate-400">
            {hasFilters ? 'Try adjusting your filters.' : 'Create a service request to get started.'}
          </p>
        </div>
      ) : (
        <>
          {/* Cards — always shown on mobile; also shown on desktop when the
              caller requests large actions (Service Staff), so the execution
              surface stays simple and touch-friendly at every breakpoint. */}
          <div className={`grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 ${largeActions ? '' : 'md:hidden'}`}>
            {rows.map((s) => (
              <ServiceCard
                key={s.id}
                service={s}
                canStart={canStartRow(s)}
                canComplete={canCompleteRow(s)}
                canEdit={canEdit}
                canDelete={canDelete}
                onStart={onStart}
                onComplete={onComplete}
                onEdit={onEdit}
                onDelete={onDelete}
                largeActions={largeActions}
              />
            ))}
          </div>

          {/* Desktop: dense table (hidden when largeActions is on). */}
          <div className={`hidden w-full overflow-x-auto ${largeActions ? '' : 'md:block'}`}>
            <table className="w-full min-w-[1000px] border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Sr. No.</th>
                  <th className="px-4 py-3">Visitor</th>
                  <th className="px-4 py-3">Service Type</th>
                  <th className="px-4 py-3">Assigned Staff</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Completed</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((s, idx) => {
                  const mayStart      = canStartRow(s);
                  const mayComplete   = canCompleteRow(s);
                  const showAnyAction = mayStart || mayComplete || canEdit || canDelete;
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 text-slate-500">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800">{s.visitorName}</div>
                        {s.notes && (
                          <div className="max-w-[220px] truncate text-[11px] text-slate-400">
                            {s.notes}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{s.serviceType}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center whitespace-nowrap rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[11px] font-semibold text-sky-700">
                          {s.assignedStaff || 'Unassigned'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatTime(s.createdAt)}</td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {s.completedAt ? formatTime(s.completedAt) : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3"><ServiceStatusBadge status={s.status} /></td>
                      <td className="px-4 py-3 min-w-[200px]">
                        {/* Same pattern as AppointmentTable — items on one row,
                           wrap only if the viewport forces it. min-w on the cell
                           guarantees buttons are never clipped or hidden. */}
                        <div className="flex flex-wrap items-center justify-end gap-1.5 whitespace-nowrap">
                          {mayStart && (
                            <button
                              type="button"
                              onClick={() => onStart?.(s)}
                              className={`${iconBtn} border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100`}
                            >
                              Start
                            </button>
                          )}
                          {mayComplete && (
                            <button
                              type="button"
                              onClick={() => onComplete?.(s)}
                              className={`${iconBtn} border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100`}
                            >
                              Complete
                            </button>
                          )}
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => onEdit?.(s)}
                              className={`${iconBtn} border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}
                            >
                              Edit
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => onDelete?.(s)}
                              className={`${iconBtn} border-red-200 bg-red-50 text-red-600 hover:bg-red-100`}
                            >
                              Delete
                            </button>
                          )}
                          {!showAnyAction && (
                            <span className="text-[11px] italic text-slate-400">
                              View only
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
