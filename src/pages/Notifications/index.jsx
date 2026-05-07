import React, { useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useAppointments } from '../../context/AppointmentContext';
import {
  useNotifications,
  visibleNotifications,
  NOTIFICATION_TYPES,
} from '../../context/NotificationContext';
import { useCollection, STORAGE_KEYS } from '../../store';
import { SUPER_ADMIN_NOTIFICATIONS } from '../../data/mockData';
import { Toast, ConfirmModal } from '../../components/ui';
import { addAuditLog } from '../../utils/auditLogger';

const SEVERITY_META = {
  success:  { label: 'Success',  borderL: 'border-l-green-500',  iconBg: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',  pill: 'border-green-200 bg-green-50 text-green-700 dark:border-green-500/30 dark:bg-green-900/20 dark:text-green-300' },
  info:     { label: 'Info',     borderL: 'border-l-cyan-500',   iconBg: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300',     pill: 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-500/30 dark:bg-cyan-900/20 dark:text-cyan-300' },
  warning:  { label: 'Warning',  borderL: 'border-l-amber-500',  iconBg: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',  pill: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-900/20 dark:text-amber-300' },
  critical: { label: 'Critical', borderL: 'border-l-red-500',    iconBg: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',         pill: 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-900/20 dark:text-red-300' },
};

const TYPE_LABEL = {
  [NOTIFICATION_TYPES.APPOINTMENT_APPROVED]:  'Appointment approved',
  [NOTIFICATION_TYPES.APPOINTMENT_CANCELLED]: 'Appointment cancelled',
  [NOTIFICATION_TYPES.WALKIN_ARRIVED]:        'Walk-in arrived',
  [NOTIFICATION_TYPES.VIP_PENDING]:           'VIP pending',
  [NOTIFICATION_TYPES.REPORT_READY]:          'Report ready',
  [NOTIFICATION_TYPES.SYSTEM_ALERT]:          'System alert',
  appointment: 'Appointment',
  service:     'Service',
  'check-in':  'Check-in',
};

function bucketFor(iso) {
  if (!iso) return 'Older';
  const now = new Date();
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return 'Older';

  const startOfDay = (d) => {
    const c = new Date(d);
    c.setHours(0, 0, 0, 0);
    return c;
  };
  const today = startOfDay(now);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const startOfWeek = new Date(today);
  /* Monday-start week (en-GB convention). */
  const dow = (today.getDay() + 6) % 7;
  startOfWeek.setDate(today.getDate() - dow);
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  if (then >= today)        return 'Today';
  if (then >= yesterday)    return 'Yesterday';
  if (then >= startOfWeek)  return 'This week';
  if (then >= startOfMonth) return 'Earlier this month';
  return 'Older';
}

const BUCKET_ORDER = ['Today', 'Yesterday', 'This week', 'Earlier this month', 'Older'];

function formatTimeAgo(iso) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffSec = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.round(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.round(diffSec / 3600)}h ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

const PAGE_TO_PATH = {
  'dashboard':         '/dashboard',
  'guest-log':         '/guest-logs',
  'walkin':            '/walkin',
  'appointments':      '/appointments',
  'rooms':             '/rooms',
  'staff':             '/staff',
  'services':          '/services',
  'offices':           '/offices',
  'notifications':     '/notifications',
  'reports':           '/reports',
  'settings':          '/settings',
  'subscription':      '/subscription',
  'admin':             '/admin',
  'access-requests':   '/access-requests',
  'roles-permissions': '/roles-permissions',
  'audit-logs':        '/audit-logs',
};

function stashQueryParams(page, params) {
  if (!params || typeof window === 'undefined') return;
  const target = PAGE_TO_PATH[page];
  if (!target) return;
  try {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v != null && v !== '') qs.set(k, String(v));
    }
    const query = qs.toString();
    window.history.pushState({}, '', query ? `${target}?${query}` : target);
  } catch { /* no-op */ }
}


function SectionHeader({ title, subtitle, action }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="m-0 font-[Outfit,sans-serif] text-[20px] font-extrabold text-[#0C2340] dark:text-gray-100">{title}</h1>
        {subtitle && <p className="mt-1 text-[13px] text-slate-500 dark:text-gray-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function SeverityPill({ severity }) {
  const meta = SEVERITY_META[severity] || SEVERITY_META.info;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-[2px] text-[10px] font-extrabold uppercase tracking-wider ${meta.pill}`}>
      {meta.label}
    </span>
  );
}

function NotificationRow({ entry, onMarkRead, onClick }) {
  const meta = SEVERITY_META[entry.severity] || SEVERITY_META.info;
  return (
    <div
      onClick={() => onClick(entry)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(entry); } }}
      className={`flex cursor-pointer items-start gap-3 rounded-[14px] border border-l-4 ${meta.borderL} border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-gray-700 dark:bg-gray-900 ${entry.isRead ? 'opacity-80' : ''}`}
    >
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg ${meta.iconBg}`} aria-hidden="true">
        {entry.icon || '🔔'}
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span className="text-[14px] font-extrabold text-[#0C2340] dark:text-gray-100">{entry.title}</span>
          <SeverityPill severity={entry.severity} />
          {!entry.isRead && (
            <span className="rounded-full bg-red-600 px-[7px] py-[2px] text-[9px] font-extrabold uppercase text-white">
              New
            </span>
          )}
          <span className="ml-auto text-[11px] text-slate-500 dark:text-gray-400" title={entry.timestamp}>
            {formatTimeAgo(entry.timestamp)}
          </span>
        </div>
        <p className="mb-2 mt-0.5 text-[13px] leading-snug text-slate-700 dark:text-gray-300">{entry.message}</p>
        <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-gray-400">
          {entry.actorName && <span>By {entry.actorName}</span>}
          <span className="rounded-full bg-slate-100 px-2 py-[1px] text-[9px] font-bold uppercase tracking-wider text-slate-600 dark:bg-gray-800 dark:text-gray-400">
            {TYPE_LABEL[entry.type] || entry.type}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        {!entry.isRead && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onMarkRead(entry.id); }}
            title="Mark as read"
            className="cursor-pointer rounded-[10px] border border-green-600 bg-white px-3 py-[5px] text-[11px] font-bold text-green-600 transition hover:bg-green-50 dark:bg-gray-900 dark:hover:bg-green-900/20"
          >
            Mark Read
          </button>
        )}
      </div>
    </div>
  );
}


function OrgNotifications({ setActivePage }) {
  const { user } = useAuth();
  const { staff } = useAppointments();
  const {
    notifications,
    markAsRead,
    markAllAsRead,
    clearRead,
    clearAll,
  } = useNotifications();

  const currentStaffId = useMemo(() => {
    if (!user) return null;
    if (user.staffId) return user.staffId;
    const match = staff.find(
      (s) => s.name?.toLowerCase() === (user.name || '').toLowerCase(),
    );
    return match ? match.id : null;
  }, [user, staff]);

  const [typeFilter, setTypeFilter]         = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter]     = useState('all');

  const [toast, setToast]     = useState(null);
  const [confirm, setConfirm] = useState(null);

  const visible = useMemo(
    () => visibleNotifications(notifications, user, currentStaffId),
    [notifications, user, currentStaffId],
  );

  const filtered = useMemo(() => {
    return visible.filter((n) => {
      if (typeFilter     !== 'all' && n.type     !== typeFilter)     return false;
      if (severityFilter !== 'all' && n.severity !== severityFilter) return false;
      if (statusFilter === 'unread' && n.isRead)  return false;
      if (statusFilter === 'read'   && !n.isRead) return false;
      return true;
    });
  }, [visible, typeFilter, severityFilter, statusFilter]);

  const grouped = useMemo(() => {
    const map = new Map(BUCKET_ORDER.map((k) => [k, []]));
    for (const n of filtered) {
      const key = bucketFor(n.timestamp);
      (map.get(key) || map.get('Older')).push(n);
    }
    return BUCKET_ORDER
      .map((key) => ({ key, items: map.get(key) || [] }))
      .filter((g) => g.items.length > 0);
  }, [filtered]);

  const unreadCount = visible.filter((n) => !n.isRead).length;
  const readCount   = visible.length - unreadCount;

  const severityCounts = useMemo(() => ({
    success:  visible.filter((n) => n.severity === 'success').length,
    info:     visible.filter((n) => n.severity === 'info').length,
    warning:  visible.filter((n) => n.severity === 'warning').length,
    critical: visible.filter((n) => n.severity === 'critical').length,
  }), [visible]);

  const logAudit = (action, description) => {
    addAuditLog({
      userName: user?.name || 'Unknown',
      role:     (user?.role || '').toLowerCase(),
      action,
      module:   'Notifications',
      description,
    });
  };

  const handleMarkAll = () => {
    if (unreadCount === 0) return;
    markAllAsRead();
    setToast({ msg: 'All notifications marked as read.', type: 'success' });
    logAudit('MARK_ALL_READ', `Marked ${unreadCount} notifications as read.`);
  };

  const handleClearRead = () => {
    if (readCount === 0) return;
    setConfirm({
      kind: 'read',
      title: 'Clear read notifications?',
      message: `This will permanently remove ${readCount} read notification${readCount === 1 ? '' : 's'}. Continue?`,
    });
  };

  const handleClearAll = () => {
    if (visible.length === 0) return;
    setConfirm({
      kind: 'all',
      title: 'Clear all notifications?',
      message: `This will permanently remove ${visible.length} notification${visible.length === 1 ? '' : 's'} (both read and unread). Continue?`,
    });
  };

  const doConfirm = () => {
    if (!confirm) return;
    if (confirm.kind === 'read') {
      clearRead();
      setToast({ msg: 'Read notifications cleared.', type: 'success' });
      logAudit('NOTIFICATIONS_CLEARED_READ', `Cleared ${readCount} read notifications.`);
    } else if (confirm.kind === 'all') {
      const total = visible.length;
      clearAll();
      setToast({ msg: 'All notifications cleared.', type: 'success' });
      logAudit('NOTIFICATIONS_CLEARED_ALL', `Cleared all ${total} notifications.`);
    }
    setConfirm(null);
  };

  const handleRowClick = (entry) => {
    if (!entry.isRead) markAsRead(entry.id);
    if (entry.link?.page && setActivePage) {
      stashQueryParams(entry.link.page, entry.link.params);
      setActivePage(entry.link.page);
    }
  };

  const typeOptions = [
    ['all', 'All types'],
    [NOTIFICATION_TYPES.APPOINTMENT_APPROVED,  'Appointment approved'],
    [NOTIFICATION_TYPES.APPOINTMENT_CANCELLED, 'Appointment cancelled'],
    [NOTIFICATION_TYPES.WALKIN_ARRIVED,        'Walk-in arrived'],
    [NOTIFICATION_TYPES.VIP_PENDING,           'VIP pending'],
    [NOTIFICATION_TYPES.REPORT_READY,          'Report ready'],
    [NOTIFICATION_TYPES.SYSTEM_ALERT,          'System alert'],
  ];

  const statTiles = [
    { label: 'Total',    value: visible.length,            tone: 'border-l-sky-600 text-sky-500 dark:text-sky-400' },
    { label: 'Unread',   value: unreadCount,               tone: 'border-l-red-600 text-red-600 dark:text-red-400' },
    { label: 'Critical', value: severityCounts.critical,   tone: 'border-l-red-600 text-red-600 dark:text-red-400' },
    { label: 'Warning',  value: severityCounts.warning,    tone: 'border-l-amber-600 text-amber-600 dark:text-amber-400' },
    { label: 'Info',     value: severityCounts.info,       tone: 'border-l-cyan-600 text-cyan-600 dark:text-cyan-400' },
    { label: 'Success',  value: severityCounts.success,    tone: 'border-l-green-600 text-green-600 dark:text-green-400' },
  ];

  return (
    <div className="min-h-screen bg-sky-50/40 p-7 font-[Outfit,'Plus_Jakarta_Sans',sans-serif] dark:bg-[#050E1A]">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {confirm && (
        <ConfirmModal
          title={confirm.title}
          message={confirm.message}
          onConfirm={doConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}

      <SectionHeader
        title="Notifications & Alerts"
        subtitle={`${unreadCount} unread · ${visible.length} total · retained for 90 days (max 200).`}
        action={
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={handleMarkAll}
              disabled={unreadCount === 0}
              title="Mark every notification as read"
              className="cursor-pointer rounded-[10px] border border-sky-600 bg-white px-4 py-2 text-[13px] font-bold text-sky-500 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-900 dark:hover:bg-sky-900/20"
            >
              Mark All Read
            </button>
            <button
              type="button"
              onClick={handleClearRead}
              disabled={readCount === 0}
              title="Remove all read notifications"
              className="cursor-pointer rounded-[10px] border border-amber-600 bg-white px-4 py-2 text-[13px] font-bold text-amber-700 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-900 dark:text-amber-400 dark:hover:bg-amber-900/20"
            >
              Clear Read
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              disabled={visible.length === 0}
              title="Remove all notifications"
              className="cursor-pointer rounded-[10px] border border-red-600 bg-white px-4 py-2 text-[13px] font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-900 dark:hover:bg-red-900/20"
            >
              Clear All
            </button>
          </div>
        }
      />

      <div className="mb-6 grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        {statTiles.map((s) => (
          <div
            key={s.label}
            className={`rounded-[14px] border border-l-4 ${s.tone} border-slate-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900`}
          >
            <div className={`text-[22px] font-black ${s.tone.split(' ').filter((c) => c.startsWith('text-')).join(' ')}`}>{s.value}</div>
            <div className="mt-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="mb-5 flex flex-wrap gap-2.5">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="cursor-pointer rounded-[10px] border border-slate-200 bg-white px-3.5 py-2 text-[13px] text-slate-700 transition hover:border-sky-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
        >
          {typeOptions.map(([val, lbl]) => <option key={val} value={val}>{lbl}</option>)}
        </select>
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="cursor-pointer rounded-[10px] border border-slate-200 bg-white px-3.5 py-2 text-[13px] text-slate-700 transition hover:border-sky-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
        >
          <option value="all">All severities</option>
          <option value="critical">Critical</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
          <option value="success">Success</option>
        </select>
        <div className="flex gap-1.5">
          {['all', 'unread', 'read'].map((f) => {
            const active = statusFilter === f;
            return (
              <button
                key={f}
                type="button"
                onClick={() => setStatusFilter(f)}
                className={`cursor-pointer rounded-[10px] border px-4 py-2 text-[12px] font-bold capitalize transition ${
                  active
                    ? 'border-sky-600 bg-sky-500 text-white'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-sky-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400'
                }`}
              >
                {f}{f === 'unread' && unreadCount > 0 ? ` (${unreadCount})` : ''}
              </button>
            );
          })}
        </div>
      </div>

      {grouped.length === 0 ? (
        <div className="rounded-[14px] border border-slate-200 bg-white p-12 text-center shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-2 text-4xl" aria-hidden="true">🔔</div>
          <div className="font-bold text-[#0C2340] dark:text-gray-100">
            {visible.length === 0 ? "You're all caught up." : 'No notifications match the current filters.'}
          </div>
          <p className="mt-1.5 text-[12px] text-slate-500 dark:text-gray-400">
            {visible.length === 0
              ? 'New activity will appear here as it happens.'
              : 'Adjust the filters above to see more.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {grouped.map((g) => (
            <section key={g.key}>
              <h2 className="mb-2.5 text-[11px] font-extrabold uppercase tracking-wider text-sky-500 dark:text-sky-400">
                {g.key} <span className="font-semibold text-slate-500 dark:text-gray-400">· {g.items.length}</span>
              </h2>
              <div className="flex flex-col gap-2.5">
                {g.items.map((n) => (
                  <NotificationRow
                    key={n.id}
                    entry={n}
                    onMarkRead={markAsRead}
                    onClick={handleRowClick}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

const SA_SEVERITY_META = {
  critical: { label: 'Critical', icon: '⚠', pill: 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-900/20 dark:text-red-300', borderL: 'border-l-red-500' },
  warning:  { label: 'Warning',  icon: '!', pill: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-900/20 dark:text-amber-300', borderL: 'border-l-amber-500' },
  info:     { label: 'Info',     icon: 'i', pill: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-900/20 dark:text-blue-300', borderL: 'border-l-blue-500' },
};

const SA_TABS = ['All', 'Tenants', 'Billing', 'Security', 'Support'];

function SASeverityBadge({ severity }) {
  const s = SA_SEVERITY_META[severity] || SA_SEVERITY_META.info;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[3px] text-[10px] font-extrabold uppercase tracking-wider ${s.pill}`}>
      <span className="text-[11px]" aria-hidden="true">{s.icon}</span>
      {s.label}
    </span>
  );
}

const SA_ACTION_TONES = {
  purple: 'border-sky-600 text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/20',
  blue:   'border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20',
  green:  'border-green-600 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20',
  red:    'border-red-600 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20',
};

function saActionsFor(notif, handlers) {
  const { onResolve, onDismiss, onView, onRetry, onContact } = handlers;
  const actions = [];
  if (notif.category === 'Billing' && notif.severity === 'critical') {
    actions.push({ key: 'retry',   label: 'Retry',          tone: 'purple', onClick: () => onRetry(notif) });
    actions.push({ key: 'contact', label: 'Contact',        tone: 'blue',   onClick: () => onContact(notif) });
  } else if (notif.category === 'Support') {
    actions.push({ key: 'view',    label: 'View Ticket',    tone: 'blue',   onClick: () => onView(notif) });
  } else if (notif.category === 'Security') {
    actions.push({ key: 'resolve', label: 'Mark Resolved',  tone: 'green',  onClick: () => onResolve(notif) });
  } else {
    actions.push({ key: 'view',    label: 'View',           tone: 'purple', onClick: () => onView(notif) });
  }
  actions.push({ key: 'dismiss', label: 'Dismiss', tone: 'red', onClick: () => onDismiss(notif) });
  return actions;
}

function NotificationDetailModal({ notif, onClose }) {
  if (!notif) return null;
  const meta = SA_SEVERITY_META[notif.severity] || SA_SEVERITY_META.info;
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-[540px] rounded-[14px] bg-white p-6 shadow-2xl dark:bg-gray-900">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <SASeverityBadge severity={notif.severity} />
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400">
              {notif.category}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-gray-800"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <h3 className="mb-1 text-[16px] font-extrabold text-[#0C2340] dark:text-gray-100">
          {notif.title}
          {notif.entity && (
            <> — <span className="text-sky-500 dark:text-sky-400">{notif.entity}</span></>
          )}
        </h3>
        <p className="mb-4 text-[11px] text-slate-400 dark:text-gray-500">{notif.time || notif.timestamp}</p>

        <div className={`rounded-[10px] border border-l-4 ${meta.borderL} border-slate-100 bg-slate-50 p-4 text-[13px] leading-relaxed text-slate-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300`}>
          {notif.message || 'No additional details available.'}
        </div>

        {(notif.details || notif.metadata) && (
          <div className="mt-3 rounded-[10px] border border-slate-100 bg-white p-3 text-[12px] text-slate-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
            <pre className="whitespace-pre-wrap break-all">
              {JSON.stringify(notif.details || notif.metadata, null, 2)}
            </pre>
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-[10px] border border-slate-300 bg-white px-5 py-2 text-[13px] font-bold text-slate-600 transition hover:bg-slate-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function AnnouncementModal({ open, onClose, onSend }) {
  const [title, setTitle]           = useState('');
  const [message, setMessage]       = useState('');
  const [recipients, setRecipients] = useState('all');
  const [channels, setChannels]     = useState({ inApp: true, email: false, sms: false });
  const [schedule, setSchedule]     = useState('now');
  const [scheduleAt, setScheduleAt] = useState('');
  const [confirm, setConfirm]       = useState(false);
  const [errors, setErrors]         = useState({});

  if (!open) return null;

  const validate = () => {
    const e = {};
    if (!title.trim())              e.title = 'Title is required.';
    else if (title.length > 80)     e.title = 'Title must be 80 characters or fewer.';
    if (!message.trim())            e.message = 'Message is required.';
    else if (message.length > 500)  e.message = 'Message must be 500 characters or fewer.';
    if (!channels.inApp && !channels.email && !channels.sms) {
      e.channels = 'Please select at least one channel.';
    }
    if (schedule === 'later' && !scheduleAt) {
      e.scheduleAt = 'Please choose a send date and time.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSend = () => {
    if (!validate()) return;
    setConfirm(true);
  };

  const handleConfirm = () => {
    onSend({
      title: title.trim(),
      message: message.trim(),
      recipients,
      channels,
      schedule: schedule === 'now' ? null : scheduleAt,
    });
    setConfirm(false);
    onClose();
  };

  const recipientOptions = [
    { value: 'all',          label: 'All Organisations' },
    { value: 'tier-starter', label: 'Starter Plan Only' },
    { value: 'tier-pro',     label: 'Professional Plan Only' },
    { value: 'tier-ent',     label: 'Enterprise Plan Only' },
    { value: 'specific',     label: 'Specific Organisations' },
  ];

  const channelCount = Number(channels.inApp) + Number(channels.email) + Number(channels.sms);

  const inputCls = 'w-full rounded-[10px] border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:placeholder:text-gray-500';
  const errCls   = 'border-red-500 dark:border-red-500/60';

  return (
    <>
      {confirm && (
        <ConfirmModal
          title="Send Announcement"
          message={`This will send "${title}" to all matching organisations via ${channelCount} channel${channelCount === 1 ? '' : 's'}. Continue?`}
          confirmLabel="Continue"
          destructive={false}
          onConfirm={handleConfirm}
          onCancel={() => setConfirm(false)}
        />
      )}
      <div
        role="dialog" aria-modal="true"
        className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/40 p-4"
        onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="max-h-[88vh] w-full max-w-[640px] overflow-y-auto rounded-[14px] bg-white p-6 font-[Outfit,'Plus_Jakarta_Sans',sans-serif] shadow-2xl dark:bg-gray-900">
          <div className="mb-4">
            <h3 className="m-0 text-[18px] font-extrabold text-[#0C2340] dark:text-gray-100">📢 Send Announcement</h3>
            <p className="mt-1 text-[13px] text-slate-500 dark:text-gray-400">Broadcast a message to your tenants. Send immediately or schedule.</p>
          </div>

          <label className="mb-1.5 block text-[12px] font-bold text-slate-700 dark:text-gray-300">
            Title<span className="text-red-600">*</span>
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 80))}
            placeholder="e.g. Scheduled maintenance on 30 April"
            className={`${inputCls} ${errors.title ? errCls : ''}`}
            maxLength={80}
          />
          {errors.title && <p className="mt-1 text-[11px] text-red-600">{errors.title}</p>}
          <p className="mb-3 mt-1 text-right text-[10px] text-slate-500 dark:text-gray-400">{title.length}/80</p>

          <label className="mb-1.5 block text-[12px] font-bold text-slate-700 dark:text-gray-300">
            Message<span className="text-red-600">*</span>
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, 500))}
            placeholder="Enter the announcement body shown to tenants."
            rows={4}
            className={`${inputCls} max-h-[180px] resize-y ${errors.message ? errCls : ''}`}
            maxLength={500}
          />
          {errors.message && <p className="mt-1 text-[11px] text-red-600">{errors.message}</p>}
          <p className="mb-3 mt-1 text-right text-[10px] text-slate-500 dark:text-gray-400">{message.length}/500</p>

          <label className="mb-1.5 block text-[12px] font-bold text-slate-700 dark:text-gray-300">
            Recipients<span className="text-red-600">*</span>
          </label>
          <select
            value={recipients}
            onChange={(e) => setRecipients(e.target.value)}
            className={`${inputCls} mb-3.5`}
          >
            {recipientOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          <label className="mb-1.5 block text-[12px] font-bold text-slate-700 dark:text-gray-300">
            Channels<span className="text-red-600">*</span>
          </label>
          <div className="mb-1 text-[11px] text-slate-500 dark:text-gray-400 space-y-0.5">
            {channels.inApp  && <p>📢 In-app banner will appear in each organisation's Notifications feed.</p>}
            {channels.email  && <p>✉️  Email will be sent to all owners & users of matching organisations.</p>}
            {channels.sms    && <p>📱 SMS text will be sent to all users with a registered phone number.</p>}
          </div>
          <div className="mb-2 flex flex-wrap gap-2.5">
            {[
              ['inApp', 'In-app banner'],
              ['email', 'Email'],
              ['sms',   'SMS'],
            ].map(([key, label]) => (
              <label key={key} className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
                <input type="checkbox" checked={channels[key]} onChange={(e) => setChannels((c) => ({ ...c, [key]: e.target.checked }))} />
                {label}
              </label>
            ))}
          </div>
          {errors.channels && <p className="mb-3 text-[11px] text-red-600">{errors.channels}</p>}

          <label className="mb-1.5 mt-2 block text-[12px] font-bold text-slate-700 dark:text-gray-300">Schedule</label>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-1.5 text-[13px] text-slate-700 dark:text-gray-200">
              <input type="radio" name="schedule" checked={schedule === 'now'} onChange={() => setSchedule('now')} /> Send now
            </label>
            <label className="inline-flex items-center gap-1.5 text-[13px] text-slate-700 dark:text-gray-200">
              <input type="radio" name="schedule" checked={schedule === 'later'} onChange={() => setSchedule('later')} /> Schedule for later
            </label>
            {schedule === 'later' && (
              <input
                type="datetime-local"
                value={scheduleAt}
                onChange={(e) => setScheduleAt(e.target.value)}
                className={`rounded-[10px] border bg-white px-2.5 py-2 text-[13px] text-slate-700 dark:bg-gray-800 dark:text-gray-200 ${errors.scheduleAt ? 'border-red-500' : 'border-slate-200 dark:border-gray-700'}`}
              />
            )}
          </div>
          {errors.scheduleAt && <p className="mb-2.5 text-[11px] text-red-600">{errors.scheduleAt}</p>}

          <div className="mb-4 rounded-[10px] border border-dashed border-slate-200 bg-sky-50/50 p-3 dark:border-gray-700 dark:bg-gray-800">
            <p className="m-0 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400">In-app preview</p>
            <p className="mt-1.5 text-[13px] font-bold text-[#0C2340] dark:text-gray-100">{title || 'Your title appears here.'}</p>
            <p className="mt-0.5 text-[12px] text-slate-700 dark:text-gray-300">{message || 'Your message body appears here.'}</p>
          </div>

          <div className="flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-[10px] border border-slate-300 bg-white px-4 py-2 text-[13px] font-bold text-slate-600 transition hover:bg-slate-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSend}
              className="cursor-pointer rounded-[10px] border border-sky-600 bg-sky-500 px-4 py-2 text-[13px] font-bold text-white transition hover:bg-sky-700"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function SuperAdminNotifications() {
  const [notifs, setNotifs] = useState(() =>
    SUPER_ADMIN_NOTIFICATIONS.map((n) => ({ ...n })),
  );
  const [tab, setTab] = useState('All');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [toast, setToast] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [viewNotif, setViewNotif] = useState(null);
  const [, , , , replaceAnnouncements] = useCollection(STORAGE_KEYS.ANNOUNCEMENTS, []);
  const { user } = useAuth();

  const stats = useMemo(() => ({
    billing:  notifs.filter((n) => n.category === 'Billing' && n.status === 'Unread').length,
    newOrgs:  notifs.filter((n) => n.category === 'Tenants' && n.title?.toLowerCase().includes('new organisation')).length,
    tickets:  notifs.filter((n) => n.category === 'Support' && n.status === 'Unread').length,
  }), [notifs]);

  const criticalCount = notifs.filter((n) => n.severity === 'critical').length;

  const filtered = useMemo(() => {
    return notifs.filter((n) => {
      if (tab !== 'All' && n.category !== tab) return false;
      if (severityFilter !== 'all' && n.severity !== severityFilter) return false;
      if (statusFilter === 'unread'   && n.read) return false;
      if (statusFilter === 'actioned' && n.status !== 'Actioned') return false;
      return true;
    });
  }, [notifs, tab, severityFilter, statusFilter]);

  const applyAction = (id, patch, message, action) => {
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
    if (message) setToast({ msg: message, type: 'success' });
    if (action) {
      addAuditLog({
        userName:    user?.name || 'Super Admin',
        role:        'superadmin',
        action,
        module:      'Notifications',
        description: `${action} platform notification ${id}.`,
      });
    }
  };

  const handleResolve = (n) => applyAction(n.id, { status: 'Actioned', read: true }, 'Marked as resolved.', 'RESOLVE');
  const handleDismiss = (n) => setConfirm({ notif: n, kind: 'dismiss' });

  const handleView = (n) => {
    applyAction(n.id, { read: true }, null, 'VIEW');
    setViewNotif(n);
  };

  const handleRetry   = (n) => applyAction(n.id, { read: true, status: 'Actioned' }, 'Retry queued for billing run.', 'BILLING_RETRY');
  const handleContact = (n) => applyAction(n.id, { read: true }, 'Contact message queued to tenant admin.', 'CONTACT_TENANT');

  const doDismiss = () => {
    const n = confirm?.notif;
    if (!n) return;
    setNotifs((prev) => prev.filter((x) => x.id !== n.id));
    setConfirm(null);
    setToast({ msg: 'Notification dismissed.', type: 'success' });
    addAuditLog({
      userName:    user?.name || 'Super Admin',
      role:        'superadmin',
      action:      'DISMISS',
      module:      'Notifications',
      description: `Dismissed platform notification ${n.id}.`,
    });
  };

 
  const handleSendAnnouncement = async (payload) => {
    const record = {
      id: `ann-${Date.now()}`,
      createdAt: new Date().toISOString(),
      sentBy: user?.name || 'Super Admin',
      ...payload,
    };

    try {
      const existing = JSON.parse(localStorage.getItem(STORAGE_KEYS.ANNOUNCEMENTS) || '[]');
      const next = [record, ...(Array.isArray(existing) ? existing : [])];
      replaceAnnouncements(next);
    } catch {
      replaceAnnouncements([record]);
    }

    if (payload.channels.inApp) {
      try {
        const existingNotifs = JSON.parse(localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS) || '[]');
        const annNotif = {
          id: `ann-notif-${Date.now()}`,
          type: 'system_alert',
          severity: 'info',
          title: payload.title,
          message: payload.message,
          icon: '📢',
          timestamp: new Date().toISOString(),
          isRead: false,
          actorName: 'Super Admin',
          // No orgId filter — visible to all orgs (NotificationContext handles org isolation)
          announcementId: record.id,
          recipientFilter: payload.recipients, // 'all' | 'tier-starter' | etc.
        };
        const updatedNotifs = [annNotif, ...(Array.isArray(existingNotifs) ? existingNotifs : [])];
        localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(updatedNotifs));
      } catch (err) {
        console.error('Failed to inject in-app announcement notification:', err);
      }
    }

    if (payload.channels.email || payload.channels.sms) {
      try {
        await fetch('/api/announcements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            title: payload.title,
            message: payload.message,
            recipients: payload.recipients,
            channels: {
              email: payload.channels.email,
              sms: payload.channels.sms,
            },
            scheduleAt: payload.schedule,
          }),
        });
      } catch (err) {
        console.error('Announcement backend dispatch failed:', err);
      }
    }

    const recipientLabel = payload.recipients === 'all'
      ? 'all organisations'
      : payload.recipients.startsWith('tier-')
        ? `the ${payload.recipients.replace('tier-', '')} tier`
        : 'selected organisations';

    setToast({ msg: `Announcement sent to ${recipientLabel} successfully.`, type: 'success' });
    addAuditLog({
      userName:    user?.name || 'Super Admin',
      role:        'superadmin',
      action:      'ANNOUNCEMENT_SENT',
      module:      'Notifications',
      description: `Sent announcement "${payload.title}" to ${recipientLabel} on ${Object.entries(payload.channels).filter(([, v]) => v).map(([k]) => k).join(', ')}.`,
    });
  };

  const handlers = {
    onResolve: handleResolve,
    onDismiss: handleDismiss,
    onView:    handleView,
    onRetry:   handleRetry,
    onContact: handleContact,
  };

  const statCards = [
    { key: 'critical', label: 'Critical alerts',         value: criticalCount,  tone: 'border-l-red-600 text-red-600 dark:text-red-400',     onClick: () => { setTab('All');     setSeverityFilter('critical'); setStatusFilter('all'); } },
    { key: 'billing',  label: 'Pending billing issues',  value: stats.billing,  tone: 'border-l-amber-600 text-amber-600 dark:text-amber-400', onClick: () => { setTab('Billing'); setSeverityFilter('all');     setStatusFilter('unread'); } },
    { key: 'new',      label: 'New tenants this week',   value: stats.newOrgs,  tone: 'border-l-green-600 text-green-600 dark:text-green-400', onClick: () => { setTab('Tenants'); setSeverityFilter('all');     setStatusFilter('all'); } },
    { key: 'tickets',  label: 'Support queue',           value: stats.tickets,  tone: 'border-l-blue-600 text-blue-600 dark:text-blue-400',   onClick: () => { setTab('Support'); setSeverityFilter('all');     setStatusFilter('unread'); } },
  ];

  const filterSelectCls = 'cursor-pointer rounded-[10px] border border-slate-200 bg-white px-3.5 py-2 text-[13px] text-slate-700 transition hover:border-sky-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200';

  return (
    <div className="min-h-screen bg-sky-50/40 p-7 font-[Outfit,'Plus_Jakarta_Sans',sans-serif] dark:bg-[#050E1A]">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {confirm && confirm.kind === 'dismiss' && (
        <ConfirmModal
          title="Dismiss notification"
          message={`Are you sure you want to dismiss "${confirm.notif.title}"?`}
          onConfirm={doDismiss}
          onCancel={() => setConfirm(null)}
        />
      )}

      {viewNotif && (
        <NotificationDetailModal
          notif={viewNotif}
          onClose={() => setViewNotif(null)}
        />
      )}

      <SectionHeader
        title="Platform Notifications"
        subtitle="Tenants, billing, security, and support events across every organisation."
        action={
          <button
            type="button"
            onClick={() => setShowAnnouncement(true)}
            title="Broadcast an announcement to tenants"
            className="cursor-pointer rounded-[10px] border border-sky-600 bg-sky-500 px-4 py-2 text-[13px] font-bold text-white transition hover:bg-sky-700"
          >
            📢 Send Announcement
          </button>
        }
      />

      <div className="mb-6 grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        {statCards.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={s.onClick}
            title={`Filter by ${s.label}`}
            className={`cursor-pointer rounded-[14px] border border-l-4 ${s.tone} border-slate-200 bg-white p-4 text-left shadow-sm transition hover:shadow-md dark:border-gray-700 dark:bg-gray-900`}
          >
            <div className={`text-[28px] font-black ${s.tone.split(' ').filter((c) => c.startsWith('text-')).join(' ')}`}>{s.value}</div>
            <div className="mt-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400">{s.label}</div>
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {SA_TABS.map((label) => {
          const active = tab === label;
          return (
            <button
              key={label}
              type="button"
              onClick={() => setTab(label)}
              className={`cursor-pointer rounded-[10px] border px-4 py-2 text-[12px] font-bold transition ${
                active
                  ? 'border-sky-600 bg-sky-500 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-sky-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="mb-5 flex flex-wrap gap-2.5">
        <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} className={filterSelectCls}>
          <option value="all">All severities</option>
          <option value="critical">Critical</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={filterSelectCls}>
          <option value="all">All status</option>
          <option value="unread">Unread</option>
          <option value="actioned">Actioned</option>
        </select>
      </div>

      <div className="flex flex-col gap-3">
        {filtered.length === 0 && (
          <div className="rounded-[14px] border border-slate-200 bg-white p-12 text-center text-slate-500 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
            <div className="font-bold">No records found.</div>
          </div>
        )}
        {filtered.map((n) => {
          const meta = SA_SEVERITY_META[n.severity] || SA_SEVERITY_META.info;
          const actions = saActionsFor(n, handlers);
          return (
            <div
              key={n.id}
              className={`relative rounded-[14px] border border-l-4 ${meta.borderL} border-slate-200 bg-white p-4 pl-6 shadow-sm dark:border-gray-700 dark:bg-gray-900 ${n.read ? 'opacity-80' : ''}`}
            >
              {!n.read && (
                <span
                  aria-hidden="true"
                  title="Unread"
                  className="absolute top-1/2 -translate-y-1/2 -left-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-sky-500 dark:border-gray-900 dark:bg-sky-400"
                />
              )}
              <div className="mb-1.5 flex flex-wrap items-center gap-2.5">
                <SASeverityBadge severity={n.severity} />
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400">{n.category}</span>
                <span title={n.timestamp} className="ml-auto text-[11px] text-slate-500 dark:text-gray-400">{n.time}</span>
              </div>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-extrabold text-[#0C2340] dark:text-gray-100">
                    {n.title} — <span className="text-sky-500 dark:text-sky-400">{n.entity}</span>
                  </div>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-slate-700 dark:text-gray-300">{n.message}</p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {actions.map((a) => (
                    <button
                      key={a.key}
                      type="button"
                      title={a.label}
                      onClick={a.onClick}
                      className={`cursor-pointer rounded-[10px] border bg-white px-3 py-1.5 text-[11px] font-bold transition dark:bg-gray-900 ${SA_ACTION_TONES[a.tone] || SA_ACTION_TONES.purple}`}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <AnnouncementModal open={showAnnouncement} onClose={() => setShowAnnouncement(false)} onSend={handleSendAnnouncement} />
    </div>
  );
}

export function NotificationsPage({ setActivePage }) {
  const { user } = useAuth();
  const role = (user?.role || '').toLowerCase();
  if (role === 'superadmin') return <SuperAdminNotifications />;
  return <OrgNotifications setActivePage={setActivePage} />;
}
export default NotificationsPage;