import React from 'react';

const STATUS_BADGE = {
  Pending:       'border-amber-200 bg-amber-50 text-amber-700',
  'In Progress': 'border-blue-200 bg-blue-50 text-blue-700',
  Completed:     'border-emerald-200 bg-emerald-50 text-emerald-700',
};

export function ServiceStatusBadge({ status }) {
  const cls = STATUS_BADGE[status] || 'border-slate-200 bg-slate-100 text-slate-500';
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${cls}`}>
      {status}
    </span>
  );
}

function formatTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

/* Matches AppointmentCard button — flex-1 so any combination of visible
   actions splits the width evenly. */
const btn =
  'inline-flex flex-1 items-center justify-center whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50';

/* Larger variant for Service Staff's execution-focused UI — bigger touch
   target, bolder type. Used on the primary Start / Complete actions. */
const btnLg =
  'inline-flex flex-1 items-center justify-center whitespace-nowrap rounded-xl border-2 px-4 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50';

export default function ServiceCard({
  service: s,
  onStart,
  onComplete,
  onEdit,
  onDelete,
  canStart = false,
  canComplete = false,
  canEdit = false,
  canDelete = false,
  largeActions = false,
}) {
  const showAnyAction = canStart || canComplete || canEdit || canDelete;
  const primaryBtn = largeActions ? btnLg : btn;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="truncate text-sm font-bold text-slate-800">{s.serviceType}</h4>
          <p className="truncate text-xs text-slate-500">
            Assigned: {s.assignedStaff || '—'}
          </p>
        </div>
        <ServiceStatusBadge status={s.status} />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Visitor</dt>
          <dd className="mt-0.5 truncate text-slate-700">{s.visitorName}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Created</dt>
          <dd className="mt-0.5 text-slate-700">{formatTime(s.createdAt)}</dd>
        </div>
        {s.startedAt && (
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Started</dt>
            <dd className="mt-0.5 text-slate-700">{formatTime(s.startedAt)}</dd>
          </div>
        )}
        {s.completedAt && (
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Completed</dt>
            <dd className="mt-0.5 text-slate-700">{formatTime(s.completedAt)}</dd>
          </div>
        )}
        {s.notes && (
          <div className="col-span-2">
            <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Notes</dt>
            <dd className="mt-0.5 text-slate-700">{s.notes}</dd>
          </div>
        )}
      </dl>
      {showAnyAction && (
        <div className="mt-4 flex flex-wrap gap-2">
          {canStart && (
            <button
              type="button"
              onClick={() => onStart?.(s)}
              className={`${primaryBtn} border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100`}
            >
              ▶ Start Task
            </button>
          )}
          {canComplete && (
            <button
              type="button"
              onClick={() => onComplete?.(s)}
              className={`${primaryBtn} border-emerald-300 bg-emerald-500 text-white hover:bg-emerald-600`}
            >
              ✓ Mark Complete
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={() => onEdit?.(s)}
              className={`${btn} border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}
            >
              Edit
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={() => onDelete?.(s)}
              className={`${btn} border-red-200 bg-red-50 text-red-600 hover:bg-red-100`}
            >
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
