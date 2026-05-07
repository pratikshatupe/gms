import React from 'react';

const TYPE_META = {
  appointment: { label: 'Appointment', icon: '📅', tone: 'border-blue-200 bg-blue-50 text-blue-700' },
  service:     { label: 'Service',     icon: '🛎️', tone: 'border-sky-200 bg-sky-50 text-sky-700' },
  'check-in':  { label: 'Check-in',    icon: '🚶', tone: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
};

function timeAgo(iso) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffSec = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.round(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.round(diffSec / 3600)}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
}

/**
 * Reusable notification list — used inside the Notifications page and the
 * NotificationBell dropdown. Empty state, unread highlight, click-to-read.
 */
export default function NotificationList({
  notifications,
  onItemClick,
  emptyLabel = 'No notifications yet.',
  dense = false,
}) {
  if (!notifications.length) {
    return (
      <div className="flex min-h-[160px] flex-col items-center justify-center p-6 text-center">
        <div className="mb-2 text-3xl" aria-hidden="true">🔔</div>
        <p className="text-xs text-slate-400">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-slate-100">
      {notifications.map((n) => {
        const meta = TYPE_META[n.type] || TYPE_META.appointment;
        return (
          <li
            key={n.id}
            onClick={() => onItemClick?.(n)}
            className={`flex cursor-pointer items-start gap-3 transition hover:bg-slate-50 ${
              dense ? 'px-4 py-3' : 'px-5 py-4'
            } ${n.isRead ? '' : 'bg-sky-50/40'}`}
          >
            <div className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-sm ${meta.tone}`}>
              <span aria-hidden="true">{meta.icon}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className={`text-sm leading-snug ${n.isRead ? 'text-slate-600' : 'font-semibold text-slate-800'}`}>
                {n.message}
              </p>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
                <span>{meta.label}</span>
                <span>·</span>
                <span>{timeAgo(n.timestamp)}</span>
              </div>
            </div>
            {!n.isRead && (
              <span
                aria-label="Unread"
                className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full bg-sky-500"
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}
