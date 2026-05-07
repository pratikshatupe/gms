import React, { useMemo } from 'react';
import AppointmentCard, { StatusBadge, RSVPBadge } from './AppointmentCard';
import { APPOINTMENT_STATUSES, STAFF_LIST } from '../data/mockAppointments';

function formatDateTime(date, time) {
  if (!date || !time) return '—';
  const d = new Date(`${date}T${time}`);
  if (Number.isNaN(d.getTime())) return `${date} ${time}`;
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const iconBtn =
  'inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-semibold transition';

function EmptyState({ hasFilters }) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center p-8 text-center">
      <div className="mb-3 text-4xl" aria-hidden="true">📅</div>
      <h4 className="text-sm font-semibold text-slate-700">No records found.</h4>
      <p className="mt-1 text-xs text-slate-400">
        {hasFilters
          ? 'Try adjusting your filters or clearing search.'
          : 'Create a new appointment to get started.'}
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-[220px] items-center justify-center p-8">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-200 border-t-sky-700" />
      <span className="sr-only">Loading appointments…</span>
    </div>
  );
}

export default function AppointmentTable({
  rows,
  loading = false,
  search = '',
  onSearchChange,
  dateFilter = '',
  onDateFilterChange,
  statusFilter = 'all',
  onStatusFilterChange,
  hostFilter = 'all',
  onHostFilterChange,
  staff = STAFF_LIST,
  onView,
  onEdit,
  onDelete,
  onCheckIn,
  onCheckOut,
  onMarkNoShow,
  onApprove,
  onReject,
  onGuestResponse,
  canMutate = true,
  canApprove = false,
  canEdit,
  canDelete,
}) {
  /* Per-action defaults: when not supplied, fall back to canMutate so callers
     that only pass canMutate keep working unchanged. */
  const canEditRow   = canEdit   == null ? canMutate : canEdit;
  const canDeleteRow = canDelete == null ? canMutate : canDelete;
  const hostOptions = useMemo(() => staff.map((s) => s.name), [staff]);
  const hasFilters = Boolean(search || dateFilter || statusFilter !== 'all' || hostFilter !== 'all');

  return (
    <section className="w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 md:flex-row md:items-center md:justify-between">
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange?.(e.target.value)}
          placeholder="Search by guest, company, host, contact number…"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 md:max-w-sm"
        />
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => onDateFilterChange?.(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-sky-400"
          />
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange?.(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-sky-400"
          >
            <option value="all">All statuses</option>
            {APPOINTMENT_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={hostFilter}
            onChange={(e) => onHostFilterChange?.(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-sky-400"
          >
            <option value="all">All hosts</option>
            {hostOptions.map((h) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                onSearchChange?.('');
                onDateFilterChange?.('');
                onStatusFilterChange?.('all');
                onHostFilterChange?.('all');
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
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState hasFilters={hasFilters} />
      ) : (
        <>
          {/* Mobile / tablet: card grid. Uses `md:hidden` so it hides at ≥768px. */}
          <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 md:hidden">
            {rows.map((a) => (
              <AppointmentCard
                key={a.id}
                appointment={a}
                canMutate={canMutate}
                canEdit={canEditRow}
                canDelete={canDeleteRow}
                canApprove={canApprove}
                onView={onView}
                onEdit={onEdit}
                onDelete={onDelete}
                onCheckIn={onCheckIn}
                onCheckOut={onCheckOut}
                onMarkNoShow={onMarkNoShow}
                onApprove={onApprove}
                onReject={onReject}
                onGuestResponse={onGuestResponse}
              />
            ))}
          </div>

          {/* Desktop: full-width table with horizontal scroll fallback. */}
          <div className="hidden w-full overflow-x-auto md:block">
            <table className="w-full min-w-[900px] border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Sr. No.</th>
                  <th className="px-4 py-3">Guest Name</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Host</th>
                  <th className="px-4 py-3">Date &amp; Time</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((a, idx) => (
                  <tr key={a.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 text-slate-500">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-800">{a.guestName}</div>
                      <div className="text-[11px] text-slate-400">{a.companyName || '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{a.contactNumber || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{a.host || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDateTime(a.date, a.time)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <StatusBadge status={a.status} />
                        <RSVPBadge response={a.guestResponse} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {onGuestResponse && ['Pending', 'Approved'].includes(a.status) && a.guestResponse !== 'Accepted' && (
                          <button
                            type="button"
                            onClick={() => onGuestResponse(a, 'Accepted')}
                            className={`${iconBtn} border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50`}
                            title="Record guest acceptance"
                          >
                            Guest ✓
                          </button>
                        )}
                        {onGuestResponse && ['Pending', 'Approved'].includes(a.status) && a.guestResponse !== 'Declined' && (
                          <button
                            type="button"
                            onClick={() => onGuestResponse(a, 'Declined')}
                            className={`${iconBtn} border-red-200 bg-white text-red-600 hover:bg-red-50`}
                            title="Record guest decline"
                          >
                            Guest ✗
                          </button>
                        )}
                        {a.status === 'Pending' && canApprove && (
                          <>
                            <button
                              type="button"
                              onClick={() => onApprove?.(a)}
                              className={`${iconBtn} border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100`}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => onReject?.(a)}
                              className={`${iconBtn} border-red-200 bg-red-50 text-red-600 hover:bg-red-100`}
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {a.status === 'Approved' && canMutate && (
                          <>
                            <button
                              type="button"
                              onClick={() => onCheckIn?.(a)}
                              className={`${iconBtn} border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100`}
                            >
                              Check-in
                            </button>
                            <button
                              type="button"
                              onClick={() => onMarkNoShow?.(a)}
                              className={`${iconBtn} border-red-200 bg-red-50 text-red-600 hover:bg-red-100`}
                            >
                              No-show
                            </button>
                          </>
                        )}
                        {a.status === 'Inside' && canMutate && (
                          <button
                            type="button"
                            onClick={() => onCheckOut?.(a)}
                            className={`${iconBtn} border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}
                          >
                            Check-out
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onView?.(a)}
                          className={`${iconBtn} border-slate-200 bg-white text-slate-600 hover:bg-slate-50`}
                        >
                          View
                        </button>
                        {canEditRow && (
                          <button
                            type="button"
                            onClick={() => onEdit?.(a)}
                            className={`${iconBtn} border-slate-200 bg-white text-slate-600 hover:bg-slate-50`}
                          >
                            Edit
                          </button>
                        )}
                        {canDeleteRow && (
                          <button
                            type="button"
                            onClick={() => onDelete?.(a)}
                            className={`${iconBtn} border-red-200 bg-red-50 text-red-600 hover:bg-red-100`}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
