import React from 'react';

const STATUS_BADGE = {
  Pending:   'border-amber-200 bg-amber-50 text-amber-700',
  Approved:  'border-emerald-200 bg-emerald-50 text-emerald-700',
  Rejected:  'border-red-200 bg-red-50 text-red-700',
  Expected:  'border-amber-200 bg-amber-50 text-amber-700',
  Inside:    'border-emerald-200 bg-emerald-50 text-emerald-700',
  Completed: 'border-slate-200 bg-slate-100 text-slate-600',
  'No-show': 'border-red-200 bg-red-50 text-red-700',
};

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

export function StatusBadge({ status }) {
  const cls = STATUS_BADGE[status] || 'border-slate-200 bg-slate-100 text-slate-500';
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${cls}`}>
      {status}
    </span>
  );
}

const RSVP_BADGE = {
  Accepted: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  Declined: 'border-red-200 bg-red-50 text-red-700',
  Awaiting: 'border-slate-200 bg-slate-50 text-slate-500',
};

export function RSVPBadge({ response }) {
  const effective = response || 'Awaiting';
  const cls = RSVP_BADGE[effective] || RSVP_BADGE.Awaiting;
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-bold ${cls}`}>
      RSVP: {effective}
    </span>
  );
}

const actionBtn =
  'inline-flex flex-1 items-center justify-center rounded-lg border px-3 py-1.5 text-xs font-semibold transition';

export default function AppointmentCard({
  appointment: a,
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
  const canEditRow   = canEdit   == null ? canMutate : canEdit;
  const canDeleteRow = canDelete == null ? canMutate : canDelete;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="truncate text-sm font-bold text-slate-800">{a.guestName}</h4>
          <p className="truncate text-xs text-slate-500">{a.companyName || '—'}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusBadge status={a.status} />
          <RSVPBadge response={a.guestResponse} />
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Contact</dt>
          <dd className="mt-0.5 truncate text-slate-700">{a.contactNumber || '—'}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Host</dt>
          <dd className="mt-0.5 truncate text-slate-700">{a.host || '—'}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Date &amp; Time</dt>
          <dd className="mt-0.5 text-slate-700">{formatDateTime(a.date, a.time)}</dd>
        </div>
        {a.purpose && (
          <div className="col-span-2">
            <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Purpose</dt>
            <dd className="mt-0.5 text-slate-700">{a.purpose}</dd>
          </div>
        )}
        {Array.isArray(a.documentRequirements) && a.documentRequirements.length > 0 && (
          <div className="col-span-2">
            <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Required Docs</dt>
            <dd className="mt-1 flex flex-wrap gap-1">
              {a.documentRequirements.map((doc) => (
                <span
                  key={doc}
                  className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700"
                >
                  {doc}
                </span>
              ))}
            </dd>
          </div>
        )}
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        {onGuestResponse && ['Pending', 'Approved'].includes(a.status) && a.guestResponse !== 'Accepted' && (
          <button
            type="button"
            onClick={() => onGuestResponse(a, 'Accepted')}
            className={`${actionBtn} border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50`}
            title="Record that the guest has accepted the appointment"
          >
            Guest Accepted
          </button>
        )}
        {onGuestResponse && ['Pending', 'Approved'].includes(a.status) && a.guestResponse !== 'Declined' && (
          <button
            type="button"
            onClick={() => onGuestResponse(a, 'Declined')}
            className={`${actionBtn} border-red-200 bg-white text-red-600 hover:bg-red-50`}
            title="Record that the guest has declined the appointment"
          >
            Guest Declined
          </button>
        )}
        {a.status === 'Pending' && canApprove && (
          <>
            <button
              type="button"
              onClick={() => onApprove?.(a)}
              className={`${actionBtn} border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100`}
            >
              Approve
            </button>
            <button
              type="button"
              onClick={() => onReject?.(a)}
              className={`${actionBtn} border-red-200 bg-red-50 text-red-600 hover:bg-red-100`}
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
              className={`${actionBtn} border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100`}
            >
              Check-in
            </button>
            <button
              type="button"
              onClick={() => onMarkNoShow?.(a)}
              className={`${actionBtn} border-red-200 bg-red-50 text-red-600 hover:bg-red-100`}
            >
              No-show
            </button>
          </>
        )}
        {a.status === 'Inside' && canMutate && (
          <button
            type="button"
            onClick={() => onCheckOut?.(a)}
            className={`${actionBtn} border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}
          >
            Check-out
          </button>
        )}
        <button
          type="button"
          onClick={() => onView?.(a)}
          className={`${actionBtn} border-slate-200 bg-white text-slate-600 hover:bg-slate-50`}
        >
          View
        </button>
        {canEditRow && (
          <button
            type="button"
            onClick={() => onEdit?.(a)}
            className={`${actionBtn} border-slate-200 bg-white text-slate-600 hover:bg-slate-50`}
          >
            Edit
          </button>
        )}
        {canDeleteRow && (
          <button
            type="button"
            onClick={() => onDelete?.(a)}
            className={`${actionBtn} border-red-200 bg-red-50 text-red-600 hover:bg-red-100`}
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
