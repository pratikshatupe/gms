import React from 'react';

const STATUS_TONE = {
  Confirmed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  Cancelled: 'border-red-200 bg-red-50 text-red-700',
  Completed: 'border-slate-200 bg-slate-100 text-slate-600',
};

function StatusPill({ status }) {
  const cls = STATUS_TONE[status] || 'border-slate-200 bg-slate-100 text-slate-600';
  return (
    <span className={`inline-flex whitespace-nowrap items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${cls}`}>
      {status}
    </span>
  );
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

const iconBtn =
  'inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50';

/**
 * Reusable bookings list — responsive (cards on mobile, table on desktop).
 */
export default function BookingTable({
  rows,
  loading = false,
  onCancel,
  onDelete,
  canManage = true,
  startIndex = 0,
}) {
  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-200 border-t-sky-700" />
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center p-8 text-center">
        <div className="mb-3 text-4xl" aria-hidden="true">🏢</div>
        <h4 className="text-sm font-semibold text-slate-700">No bookings found</h4>
        <p className="mt-1 text-xs text-slate-400">Book a room to see it listed here.</p>
      </div>
    );
  }

  return (
    <>
      {/* Mobile: cards */}
      <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 md:hidden">
        {rows.map((b) => (
          <div key={b.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h4 className="truncate text-sm font-bold text-slate-800">{b.roomName}</h4>
                <p className="truncate text-xs text-slate-500">
                  {formatDate(b.date)} · {b.startTime}–{b.endTime}
                </p>
              </div>
              <StatusPill status={b.status} />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              <div>
                <dt className="text-[10px] font-bold uppercase text-slate-400">Booked By</dt>
                <dd className="mt-0.5 truncate text-slate-700">{b.bookedBy}</dd>
              </div>
              {b.purpose && (
                <div>
                  <dt className="text-[10px] font-bold uppercase text-slate-400">Purpose</dt>
                  <dd className="mt-0.5 truncate text-slate-700">{b.purpose}</dd>
                </div>
              )}
            </dl>
            {canManage && b.status === 'Confirmed' && (
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => onCancel?.(b)}
                  className={`${iconBtn} flex-1 justify-center border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100`}
                >
                  Cancel
                </button>
                {onDelete && (
                  <button
                    type="button"
                    onClick={() => onDelete(b)}
                    className={`${iconBtn} flex-1 justify-center border-red-200 bg-red-50 text-red-600 hover:bg-red-100`}
                  >
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Desktop: table */}
      <div className="hidden w-full overflow-x-auto md:block">
        <table className="w-full min-w-[900px] border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Sr. No.</th>
              <th className="px-4 py-3">Room</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Booked By</th>
              <th className="px-4 py-3">Purpose</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((b, idx) => (
              <tr key={b.id} className="hover:bg-slate-50/70">
                <td className="px-4 py-3 text-slate-500">{startIndex + idx + 1}</td>
                <td className="px-4 py-3 font-semibold text-slate-800">{b.roomName}</td>
                <td className="px-4 py-3 whitespace-nowrap text-slate-600">{formatDate(b.date)}</td>
                <td className="px-4 py-3 whitespace-nowrap text-slate-600">{b.startTime}–{b.endTime}</td>
                <td className="px-4 py-3 text-slate-600">{b.bookedBy}</td>
                <td className="px-4 py-3 text-slate-600">{b.purpose || <span className="text-slate-400">—</span>}</td>
                <td className="px-4 py-3"><StatusPill status={b.status} /></td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                    {canManage && b.status === 'Confirmed' && (
                      <button
                        type="button"
                        onClick={() => onCancel?.(b)}
                        className={`${iconBtn} border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100`}
                      >
                        Cancel
                      </button>
                    )}
                    {canManage && onDelete && (
                      <button
                        type="button"
                        onClick={() => onDelete(b)}
                        className={`${iconBtn} border-red-200 bg-red-50 text-red-600 hover:bg-red-100`}
                      >
                        Delete
                      </button>
                    )}
                    {!canManage && (
                      <span className="text-[11px] italic text-slate-400">View only</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
