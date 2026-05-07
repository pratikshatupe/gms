import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAppointments } from '../context/AppointmentContext';
import {
  useNotifications,
  useUnreadCount,
  visibleNotifications,
} from '../context/NotificationContext';

/**
 * NotificationBell — reusable bell + dropdown (Module 7 Decision 6).
 *
 *   variant = 'dark'  — navy topbar styling for the bell button (default).
 *   variant = 'light' — white-card styling for embed elsewhere.
 *
 * The dropdown PANEL itself always honours the global Tailwind dark mode
 * (toggled by ThemeContext via the .dark class on <html>) regardless of
 * variant — so the same dropdown works on both light and dark pages.
 *
 * Click behaviour (Module 7 Decision 9):
 *   - Clicking a row auto-marks it read BEFORE navigation.
 *   - If row has a `link = { page, params }`, navigate via setActivePage and
 *     stash query params on window.history so deep-link handlers
 *     (Appointments, Guest Log, Audit Logs) can pre-fill filters.
 *   - Header "Mark all read" clears unread for every visible row.
 *   - Badge caps at "99+" and dropdown max-height is 400px per spec.
 */

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

export default function NotificationBell({
  user,
  setActivePage,
  isMobile = false,
  variant = 'dark',
}) {
  const { notifications, markAsRead, markAllAsRead } = useNotifications();
  const { staff } = useAppointments();

  const currentStaffId = useMemo(() => {
    if (!user) return null;
    if (user.staffId) return user.staffId;
    const match = staff.find(
      (s) => s.name?.toLowerCase() === (user.name || '').toLowerCase(),
    );
    return match ? match.id : null;
  }, [user, staff]);

  const notifs = useMemo(() => {
    const visible = visibleNotifications(notifications, user, currentStaffId);
    return visible.slice(0, 50).map((n) => ({
      id:        n.id,
      icon:      n.icon || '🔔',
      title:     n.title,
      message:   n.message,
      actorName: n.actorName,
      link:      n.link,
      severity:  n.severity,
      time:      formatTimeAgo(n.timestamp),
      read:      n.isRead,
    }));
  }, [notifications, user, currentStaffId]);

  const unreadCount = useUnreadCount(user, currentStaffId);

  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const handleKey = (e) => { if (e.key === 'Escape' && !open === false) setOpen(false); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const badgeLabel = unreadCount > 99 ? '99+' : String(unreadCount);

  const handleRowClick = (row) => {
    /* Auto-mark BEFORE navigation so badge flips instantly. */
    if (!row.read) markAsRead(row.id);
    if (row.link && row.link.page) {
      stashQueryParams(row.link.page, row.link.params);
      setActivePage?.(row.link.page);
      setOpen(false);
    }
  };

  const handleViewAll = () => {
    setOpen(false);
    setActivePage?.('notifications');
  };

  const isDark = variant !== 'light';

  /* Button sits on the navy topbar (light variant) or a white card
     (light embedded variant). The button styling does NOT respond to
     global dark mode — only to the `variant` prop. */
  const buttonClass = isDark
    ? 'bg-sky-700/15 border-sky-400/25 text-white hover:border-sky-400/40'
    : 'bg-sky-50 border-slate-200 text-sky-700 hover:border-sky-300 dark:bg-gray-800 dark:border-gray-700 dark:text-sky-300 dark:hover:border-sky-400/40';

  const badgeRingClass = isDark ? 'border-[#0f172a]' : 'border-white dark:border-gray-900';

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Notifications"
        aria-label="Notifications"
        aria-expanded={open}
        className={`relative inline-flex h-9 w-9 items-center justify-center rounded-[9px] border text-[15px] transition cursor-pointer ${buttonClass}`}
      >
        🔔
        {unreadCount > 0 && (
          <span
            aria-label={`${badgeLabel} unread`}
            className={`absolute -right-[3px] -top-[3px] inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-[10px] border-2 bg-red-600 px-1 text-[9px] font-bold text-white leading-none ${badgeRingClass}`}
            style={{ animation: 'nb-pop 0.35s ease' }}
          >
            {badgeLabel}
          </span>
        )}
      </button>

      <style>{`
        @keyframes nb-slide { from { opacity:0; transform: translateY(-6px); } to { opacity:1; transform: translateY(0); } }
        @keyframes nb-pop   { 0% { transform: scale(0); opacity:0; } 60% { transform: scale(1.2); } 100% { transform: scale(1); opacity:1; } }
      `}</style>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className={`z-[300] overflow-hidden rounded-[14px] border bg-white border-slate-200 shadow-2xl dark:bg-gray-900 dark:border-gray-700 ${isMobile ? '' : 'absolute top-11 w-[min(380px,90vw)]'}`}
          style={isMobile
            ? { position: 'fixed', top: '60px', left: '8px', right: '8px', width: 'auto', maxWidth: '100%', animation: 'nb-slide 0.18s ease' }
            : { right: 0, animation: 'nb-slide 0.18s ease' }}
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-gray-700 px-4 py-3.5">
            <div className="flex items-center gap-2">
              <span className="font-[Outfit,sans-serif] text-[13px] font-bold text-[#0f172a] dark:text-gray-100">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="rounded-[10px] bg-red-600 px-[7px] py-[2px] text-[10px] font-bold text-white">
                  {badgeLabel} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  title="Mark all as read"
                  className="cursor-pointer border-none bg-transparent p-0 text-[11px] font-semibold text-sky-500 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300"
                >
                  Mark all read
                </button>
              )}
              <button
                type="button"
                onClick={handleViewAll}
                className="cursor-pointer border-none bg-transparent p-0 text-[11px] font-semibold text-sky-500 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300"
              >
                View All
              </button>
            </div>
          </div>

          {/* List — 400px max height per Decision 6. */}
          <div className="max-h-[400px] overflow-y-auto">
            {notifs.length === 0 ? (
              <div className="px-7 py-7 text-center text-[13px] text-slate-400 dark:text-gray-500">
                No notifications yet.
              </div>
            ) : notifs.slice(0, 12).map((n, i) => {
              const isLast = i === Math.min(notifs.length, 12) - 1;
              return (
                <div
                  key={n.id}
                  onClick={() => handleRowClick(n)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRowClick(n); } }}
                  className={`flex cursor-pointer items-start gap-2.5 px-4 py-2.5 transition ${
                    !isLast ? 'border-b border-slate-100 dark:border-gray-800' : ''
                  } ${
                    !n.read
                      ? 'bg-sky-50/60 border-l-2 border-l-sky-500 dark:bg-sky-500/10'
                      : 'border-l-2 border-l-transparent hover:bg-slate-50 dark:hover:bg-gray-800/60'
                  }`}
                >
                  <span className="mt-px shrink-0 text-base" aria-hidden="true">{n.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className={`mb-0.5 truncate text-[12px] font-bold ${
                      n.read ? 'text-slate-500 dark:text-gray-500' : 'text-[#0f172a] dark:text-gray-100'
                    }`}>
                      {n.title}
                    </div>
                    <div className={`mb-0.5 text-[12px] leading-snug ${
                      n.read ? 'text-slate-500 dark:text-gray-500' : 'text-slate-700 dark:text-gray-300'
                    }`}>
                      {n.message}
                    </div>
                    <div className="flex gap-1 text-[10px] text-slate-400 dark:text-gray-500">
                      {n.actorName && <><span>{n.actorName}</span><span>·</span></>}
                      <span>{n.time}</span>
                    </div>
                  </div>
                  {!n.read && (
                    <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500 dark:bg-sky-400" aria-hidden="true" />
                  )}
                </div>
              );
            })}
          </div>

          <div className="border-t border-slate-200 dark:border-gray-700 px-4 py-2.5">
            <button
              type="button"
              onClick={handleViewAll}
              className="w-full cursor-pointer rounded-lg border border-slate-200 bg-transparent px-2 py-2 text-center text-[12px] font-semibold text-slate-600 transition hover:bg-sky-50 hover:text-sky-700 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-sky-500/10 dark:hover:text-sky-300"
            >
              View all notifications →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}