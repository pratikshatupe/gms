/**
 * notificationTriggers.js — hook-based trigger API for Module 7.
 *
 * Calling `useNotificationTriggers()` inside any component yields six
 * fire* functions that (a) push a row into NotificationContext and
 * (b) console.log an email preview envelope. A production backend
 * will swap the console.log for a real mailer behind the same shape.
 *
 * Usage:
 *   const triggers = useNotificationTriggers();
 *   triggers.fireAppointmentApproved({ apt, org, hostStaff });
 *
 * Every fire function is pure-side-effect — it returns true on dispatch
 * or false on invalid input so the caller can short-circuit.
 */

import { useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  useNotifications,
  NOTIFICATION_TYPES,
} from '../context/NotificationContext';
import {
  generateAppointmentApproved,
  generateAppointmentCancelled,
  generateAppointmentCheckedOut,
  generateAppointmentReminder,
  generateWalkInArrived,
  generateVipPending,
  generateReportReady,
  generateSystemAlert,
} from './notificationEmailPreviews';
import { addAuditLog } from './auditLogger';

/* All notifications default to management roles — Service Staff only see
   rows that explicitly target their staffId (visibleNotifications enforces
   this). */
const MANAGEMENT_ROLES  = ['superadmin', 'director', 'manager', 'reception'];
const DIRECTOR_AND_MGR  = ['superadmin', 'director', 'manager'];
const DIRECTOR_ONLY     = ['superadmin', 'director'];

/**
 * Fire the actual email dispatch (and log a preview in dev). Previously
 * this was a console.log-only helper gated to DEV builds — which is why
 * production triggers like APPROVE / CANCEL / WALKIN never sent real
 * emails. We now POST the envelope to the backend dispatch endpoint
 * regardless of NODE_ENV. The send is fire-and-forget; failures are
 * logged but never block the calling flow.
 *
 * Defensive guard: only dispatch when the envelope has a recipient,
 * subject, and a plausible HTML body — otherwise we'd POST garbage to
 * the backend and the recipient would see raw source.
 */
function emailPreview(kind, envelope) {
  if (!envelope) return;
  /* Dev-only console preview, kept for debugging. */
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) {
    try {
      // eslint-disable-next-line no-console
      console.log(`[email-preview] ${kind}`, envelope);
    } catch { /* no-op */ }
  }
  if (
    !envelope.to ||
    !envelope.subject ||
    !envelope.html ||
    typeof envelope.html !== 'string' ||
    !envelope.html.includes('<')
  ) {
    return;
  }
  try {
    const base =
      (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) ||
      '/api/v1';
    fetch(`${base}/notifications/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to:      envelope.to,
        subject: envelope.subject,
        html:    envelope.html,
        text:    envelope.text || '',
      }),
    })
      .then(async (res) => {
        let body = {};
        try { body = await res.json(); } catch { /* ignore */ }
        if (!res.ok || body.success === false) {
          // eslint-disable-next-line no-console
          console.warn(`[email] ${kind} dispatch error:`, res.status, body);
        } else {
          // eslint-disable-next-line no-console
          console.info(`[email] ${kind} dispatched to ${envelope.to}`);
        }
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.warn(`[email] ${kind} network error:`, err && err.message ? err.message : err);
      });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[email] ${kind} dispatch threw synchronously:`, err);
  }
}

/**
 * Module 8 — quiet hours check. Returns true when `now` (HH:MM in the
 * user's stamped timezone, falling back to the browser tz) lies inside
 * the user's quiet window. Crosses-midnight windows handled by the
 * "start > end" branch.
 */
export function isQuietHours(prefs, now = new Date()) {
  const q = prefs?.quietHours;
  if (!q?.start || !q?.end) return false;
  let nowStr;
  try {
    const tz = q.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    /* en-GB 24h HH:MM in the requested timezone. */
    nowStr = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz,
    }).format(now);
  } catch {
    nowStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }
  const { start, end } = q;
  if (start === end) return false;
  if (start < end) return nowStr >= start && nowStr < end;
  /* Crosses midnight (e.g. 22:00 → 07:00). */
  return nowStr >= start || nowStr < end;
}

/**
 * Module 8 — read user notification prefs with sensible defaults so
 * users who never opened the Settings tab still get every notification.
 */
function getPrefs(user) {
  const p = user?.notificationPrefs || null;
  if (!p) return null;
  return p;
}

/**
 * Decide whether to fire a given (type, channel) combo. Returns
 *   { allow: true } or { allow: false, reason: string }.
 */
function gateChannel(prefs, type, channel, now = new Date()) {
  if (!prefs) return { allow: true };
  if (channel === 'email' && isQuietHours(prefs, now)) {
    return { allow: false, reason: 'quiet-hours' };
  }
  if (prefs[channel] === false) {
    return { allow: false, reason: `master-${channel}-off` };
  }
  const perType = prefs.perType?.[type];
  if (perType && perType[channel] === false) {
    return { allow: false, reason: `per-type-${channel}-off` };
  }
  return { allow: true };
}

function logSuppressed(reason, type, channel, user, orgId) {
  addAuditLog({
    userName: user?.name || 'Unknown',
    role:     (user?.role || '').toLowerCase(),
    action:   reason === 'quiet-hours' ? 'NOTIFICATION_QUIET_HOURS_SUPPRESSED' : 'NOTIFICATION_SKIPPED',
    module:   'Notifications',
    description: `Skipped ${type} (${channel}) — reason: ${reason}.`,
    orgId,
  });
}

export function useNotificationTriggers() {
  const { addNotification } = useNotifications();
  const { user } = useAuth();
  const actorName = user?.name || 'System';
  const orgId     = user?.organisationId || user?.orgId || null;
  const prefs     = getPrefs(user);

  /** Push the in-app notification only if the user's prefs allow it. */
  const pushIfAllowed = useCallback((type, payload) => {
    const gate = gateChannel(prefs, type, 'inApp');
    if (!gate.allow) {
      logSuppressed(gate.reason, type, 'inApp', user, orgId);
      return false;
    }
    addNotification(payload);
    return true;
  }, [addNotification, prefs, user, orgId]);

  /** Fire the email preview only if the user's prefs allow it
      AND we are not currently inside the user's quiet hours. */
  const sendEmailIfAllowed = useCallback((type, kind, envelope) => {
    const gate = gateChannel(prefs, type, 'email');
    if (!gate.allow) {
      logSuppressed(gate.reason, type, 'email', user, orgId);
      return false;
    }
    emailPreview(kind, envelope);
    return true;
  }, [prefs, user, orgId]);

  /** Appointment approved — visitor + host see the update; reception too. */
  const fireAppointmentApproved = useCallback((ctx = {}) => {
    const { apt, org, hostStaffId } = ctx;
    if (!apt) return false;
    pushIfAllowed(NOTIFICATION_TYPES.APPOINTMENT_APPROVED, {
      type:      NOTIFICATION_TYPES.APPOINTMENT_APPROVED,
      title:     'Appointment approved',
      message:   `${apt.visitorName || 'Visitor'}'s appointment on ${apt.date || ''} at ${apt.timeStart || ''} has been approved.`,
      actorName,
      link:      { page: 'appointments', params: { viewId: apt.id } },
      roles:     MANAGEMENT_ROLES,
      staffId:   hostStaffId || null,
      orgId:     apt.organisationId || orgId,
    });
    sendEmailIfAllowed(NOTIFICATION_TYPES.APPOINTMENT_APPROVED, 'appointment-approved',
      generateAppointmentApproved({ apt, approverName: actorName, org }));
    return true;
  }, [pushIfAllowed, sendEmailIfAllowed, actorName, orgId]);

  /** Appointment checked out — visitor thank-you + management awareness.
   *  Fired only when an appointment transitions to Completed (the
   *  "Checked Out" event in the user-facing taxonomy). NOTE: we do NOT
   *  fire any email when the appointment transitions to Checked-In —
   *  that step is silent by design. */
  const fireAppointmentCheckedOut = useCallback((ctx = {}) => {
    const { apt, org, hostStaffId } = ctx;
    if (!apt) return false;
    pushIfAllowed(NOTIFICATION_TYPES.APPOINTMENT_CHECKED_OUT, {
      type:      NOTIFICATION_TYPES.APPOINTMENT_CHECKED_OUT,
      title:     'Appointment checked out',
      message:   `${apt.visitorName || 'Visitor'} has checked out${apt.hostName ? ` after meeting ${apt.hostName}` : ''}.`,
      actorName,
      link:      { page: 'appointments', params: { viewId: apt.id } },
      roles:     MANAGEMENT_ROLES,
      staffId:   hostStaffId || null,
      orgId:     apt.organisationId || orgId,
    });
    sendEmailIfAllowed(NOTIFICATION_TYPES.APPOINTMENT_CHECKED_OUT, 'appointment-checked-out',
      generateAppointmentCheckedOut({ apt, actorName, org }));
    return true;
  }, [pushIfAllowed, sendEmailIfAllowed, actorName, orgId]);

  /** Appointment reminder — visitor only. Daily nudge driven by the
   *  reminder loop until the appointment date arrives. */
  const fireAppointmentReminder = useCallback((ctx = {}) => {
    const { apt, daysUntil, org } = ctx;
    if (!apt) return false;
    pushIfAllowed(NOTIFICATION_TYPES.APPOINTMENT_REMINDER, {
      type:      NOTIFICATION_TYPES.APPOINTMENT_REMINDER,
      title:     'Appointment reminder',
      message:   `${apt.visitorName || 'Visitor'} has an appointment ${daysUntil === 0 ? 'today' : daysUntil === 1 ? 'tomorrow' : `in ${daysUntil} days`} at ${apt.timeStart || ''}.`,
      actorName,
      link:      { page: 'appointments', params: { viewId: apt.id } },
      roles:     MANAGEMENT_ROLES,
      orgId:     apt.organisationId || orgId,
    });
    sendEmailIfAllowed(NOTIFICATION_TYPES.APPOINTMENT_REMINDER, 'appointment-reminder',
      generateAppointmentReminder({ apt, daysUntil, org }));
    return true;
  }, [pushIfAllowed, sendEmailIfAllowed, actorName, orgId]);

  /** Appointment cancelled — visitor email + management broadcast. */
  const fireAppointmentCancelled = useCallback((ctx = {}) => {
    const { apt, reason, org } = ctx;
    if (!apt) return false;
    pushIfAllowed(NOTIFICATION_TYPES.APPOINTMENT_CANCELLED, {
      type:      NOTIFICATION_TYPES.APPOINTMENT_CANCELLED,
      title:     'Appointment cancelled',
      message:   `${apt.visitorName || 'Visitor'}'s appointment on ${apt.date || ''} at ${apt.timeStart || ''} has been cancelled${reason ? ` (${reason})` : ''}.`,
      actorName,
      link:      { page: 'appointments', params: { viewId: apt.id } },
      roles:     MANAGEMENT_ROLES,
      orgId:     apt.organisationId || orgId,
    });
    sendEmailIfAllowed(NOTIFICATION_TYPES.APPOINTMENT_CANCELLED, 'appointment-cancelled',
      generateAppointmentCancelled({ apt, actorName, reason, org }));
    return true;
  }, [pushIfAllowed, sendEmailIfAllowed, actorName, orgId]);

  /** Walk-in arrived — host ping + management awareness. */
  const fireWalkInArrived = useCallback((ctx = {}) => {
    const { visitor, host, org } = ctx;
    if (!visitor) return false;
    const visitorName = visitor.name || visitor.visitorName || 'Visitor';
    const hostName    = host?.name   || '—';
    pushIfAllowed(NOTIFICATION_TYPES.WALKIN_ARRIVED, {
      type:      NOTIFICATION_TYPES.WALKIN_ARRIVED,
      title:     'Walk-in arrived',
      message:   `${visitorName} checked in to see ${hostName}.`,
      actorName,
      link:      { page: 'guest-log' },
      roles:     MANAGEMENT_ROLES,
      staffId:   host?.id || null,
      orgId:     visitor.organisationId || orgId,
    });
    sendEmailIfAllowed(NOTIFICATION_TYPES.WALKIN_ARRIVED, 'walkin-arrived',
      generateWalkInArrived({ visitor, host, org }));
    return true;
  }, [pushIfAllowed, sendEmailIfAllowed, actorName, orgId]);

  /** VIP appointment pending — Director-only ping. */
  const fireVipPending = useCallback((ctx = {}) => {
    const { apt, org, directorEmails = [] } = ctx;
    if (!apt) return false;
    pushIfAllowed(NOTIFICATION_TYPES.VIP_PENDING, {
      type:      NOTIFICATION_TYPES.VIP_PENDING,
      title:     'VIP appointment pending',
      message:   `VIP ${apt.visitorName || 'visitor'} is awaiting approval for ${apt.date || ''} at ${apt.timeStart || ''}.`,
      actorName,
      link:      { page: 'appointments', params: { viewId: apt.id } },
      roles:     DIRECTOR_ONLY,
      orgId:     apt.organisationId || orgId,
    });
    sendEmailIfAllowed(NOTIFICATION_TYPES.VIP_PENDING, 'vip-pending',
      generateVipPending({ apt, requesterName: actorName, org, directorEmails }));
    return true;
  }, [pushIfAllowed, sendEmailIfAllowed, actorName, orgId]);

  /** Report ready — requester self-service confirmation. */
  const fireReportReady = useCallback((ctx = {}) => {
    const { reportTitle, format, org, requester } = ctx;
    if (!reportTitle) return false;
    const who = requester || { name: user?.name, email: user?.email };
    pushIfAllowed(NOTIFICATION_TYPES.REPORT_READY, {
      type:      NOTIFICATION_TYPES.REPORT_READY,
      title:     'Report ready',
      message:   `Your ${reportTitle} export (${(format || 'CSV').toUpperCase()}) is ready.`,
      actorName,
      link:      { page: 'reports' },
      roles:     MANAGEMENT_ROLES,
      orgId,
    });
    sendEmailIfAllowed(NOTIFICATION_TYPES.REPORT_READY, 'report-ready',
      generateReportReady({ reportTitle, format, requester: who, org }));
    return true;
  }, [pushIfAllowed, sendEmailIfAllowed, actorName, orgId, user]);

  /** System alert — Director + Manager broadcast, critical severity. */
  const fireSystemAlert = useCallback((ctx = {}) => {
    const { title, detail, org, recipients = [] } = ctx;
    if (!title) return false;
    pushIfAllowed(NOTIFICATION_TYPES.SYSTEM_ALERT, {
      type:      NOTIFICATION_TYPES.SYSTEM_ALERT,
      title:     title,
      message:   detail ? `${title} — ${detail}` : `${title}.`,
      actorName,
      link:      ctx.link || null,
      roles:     DIRECTOR_AND_MGR,
      orgId:     ctx.orgId !== undefined ? ctx.orgId : orgId,
    });
    sendEmailIfAllowed(NOTIFICATION_TYPES.SYSTEM_ALERT, 'system-alert',
      generateSystemAlert({ title, detail, actorName, org, recipients }));
    return true;
  }, [pushIfAllowed, sendEmailIfAllowed, actorName, orgId]);

  return {
    fireAppointmentApproved,
    fireAppointmentCancelled,
    fireAppointmentCheckedOut,
    fireAppointmentReminder,
    fireWalkInArrived,
    fireVipPending,
    fireReportReady,
    fireSystemAlert,
  };
}
