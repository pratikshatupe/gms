/**
 * Appointment reminder dispatcher.
 *
 * Runs from a 60-second interval (wired in App.jsx). Each tick scans the
 * persisted appointments list for upcoming slots and fires a DAILY
 * reminder email to the visitor — once per calendar day per appointment
 * — until the appointment date arrives. Once the visitor checks in (or
 * the appointment is cancelled / completed / no-show) reminders stop.
 *
 * Dedupe: every appointment grows a `lastReminderDate` field set to the
 * `YYYY-MM-DD` (in local time) of the last reminder fire. The next tick
 * only fires when today's date differs from that marker, so a 60-second
 * tick can run all day without spamming the recipient. Cleared on every
 * tick that changes state.
 *
 * Side effects per fire:
 *   a) in-app notification (via NotificationContext, written to storage
 *      so the bell badge picks it up regardless of which page is open)
 *   b) audit log entry (addAuditLog)
 *   c) real email via /api/v1/notifications/dispatch (previewEmail)
 */
'use strict';

import { STORAGE_KEYS } from '../store';
import { safeGet, safeSet } from './storage';
import { readNotifications, writeNotifications } from './notificationSync';
import { addAuditLog } from './auditLogger';
import { previewEmail } from './emailTemplates';
import { generateAppointmentReminder } from './notificationEmailPreviews';

/* Skippable statuses — only Pending and Approved appointments still
 * need reminders. Once the visitor has checked in (Checked-In /
 * In-Progress) or the appointment is in a terminal state (Completed /
 * Cancelled / No-Show / Rejected), no further reminders should fire. */
const ACTIVE_STATUSES = new Set([
  'pending', 'approved', 'confirmed',
]);

/** Local-time YYYY-MM-DD so the dedupe key matches what the user sees. */
function todayLocalDate(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseAppointmentDateLocal(appt) {
  if (!appt || typeof appt !== 'object') return null;
  const day = typeof appt.scheduledDate === 'string' ? appt.scheduledDate.slice(0, 10)
    : typeof appt.date === 'string' ? appt.date.slice(0, 10)
    : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const [y, m, d] = day.split('-').map(Number);
  /* Construct in local time at midnight so date math doesn't drift
   * across timezones. */
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function daysBetween(fromDate, toDate) {
  const ms = 24 * 60 * 60 * 1000;
  const a = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate()).getTime();
  const b = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate()).getTime();
  return Math.round((b - a) / ms);
}

function guestLabel(appt) {
  return appt?.visitor?.fullName
    || appt?.guestName
    || appt?.visitorName
    || appt?.guest
    || 'Guest';
}

function hostLabel(appt) {
  return appt?.hostName || appt?.host || 'Host';
}

function visitorEmail(appt) {
  return appt?.visitor?.emailId
    || appt?.visitor?.email
    || appt?.guestEmail
    || appt?.visitorEmail
    || '';
}

function findOrgFor(appt) {
  const orgs = safeGet(STORAGE_KEYS.ORGANIZATIONS, []) || [];
  if (!Array.isArray(orgs)) return null;
  const orgRef = appt?.orgId || appt?.organisationId || null;
  if (!orgRef) return null;
  return orgs.find((o) => o?.id === orgRef) || null;
}

function buildReminderNotification(appt, daysUntil) {
  const who = guestLabel(appt);
  const host = hostLabel(appt);
  const when = daysUntil === 0 ? 'today'
    : daysUntil === 1 ? 'tomorrow'
    : `in ${daysUntil} days`;
  return {
    id:        `reminder-${appt.id}-${todayLocalDate()}`,
    title:     `Appointment reminder — ${when}`,
    message:   `${who} has an appointment with ${host} ${when} (${appt.scheduledDate || appt.date} at ${appt.startTime || appt.time || ''}).`,
    type:      'appointment_reminder',
    /* Surfaced to everyone who can see org-level notifications; the
     * notificationSync filter handles tenant isolation downstream. */
    roles:     ['director', 'manager', 'reception'],
    orgId:     appt.orgId || null,
    timestamp: new Date().toISOString(),
    isRead:    false,
    meta:      { appointmentId: appt.id, daysUntil },
  };
}

/**
 * Send the actual visitor email. Fire-and-forget — backend dispatch
 * failures are logged inside previewEmail and never block the loop.
 */
function dispatchReminderEmail(appt, daysUntil) {
  const to = visitorEmail(appt);
  if (!to) return;
  const org = findOrgFor(appt);
  const envelope = generateAppointmentReminder({
    apt: {
      id:           appt.id,
      visitorName:  guestLabel(appt),
      visitorEmail: to,
      hostName:     hostLabel(appt),
      date:         appt.scheduledDate || appt.date || '',
      timeStart:    appt.startTime     || appt.time || '',
    },
    daysUntil,
    org,
  });
  try {
    previewEmail({ ...envelope, to });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[reminders] previewEmail threw synchronously:', err?.message || err);
  }
}

/**
 * Scan, fire, persist. Returns the number of reminders fired on this
 * tick. The caller (interval) ignores the return value; tests use it.
 */
export function dispatchAppointmentReminders(now = new Date()) {
  const appointments = safeGet(STORAGE_KEYS.APPOINTMENTS, null);
  if (!Array.isArray(appointments) || appointments.length === 0) return 0;

  const today = typeof now === 'number' ? new Date(now) : now;
  const todayKey = todayLocalDate(today);
  let fired = 0;
  let changed = false;
  const notifications = readNotifications();

  const nextList = appointments.map((appt) => {
    const status = String(appt?.status || '').toLowerCase();
    if (!ACTIVE_STATUSES.has(status)) return appt;

    const apptDate = parseAppointmentDateLocal(appt);
    if (!apptDate) return appt;

    const daysUntil = daysBetween(today, apptDate);
    /* Only remind for upcoming appointments (today or future). The
     * minute the date passes we stop sending — no spam. */
    if (daysUntil < 0) return appt;

    /* One reminder per calendar day. */
    if (appt.lastReminderDate === todayKey) return appt;

    /* 1) in-app notification */
    notifications.unshift(buildReminderNotification(appt, daysUntil));
    /* 2) audit log */
    addAuditLog({
      userName:    'system',
      role:        'system',
      action:      'APPOINTMENT_REMINDER_SENT',
      module:      'Appointments',
      description: `Sent daily reminder for appointment ${appt.id} (${guestLabel(appt)} → ${hostLabel(appt)}) — ${daysUntil === 0 ? 'today' : daysUntil === 1 ? 'tomorrow' : `in ${daysUntil} days`}.`,
      orgId:       appt.orgId || null,
    });
    /* 3) real visitor email */
    dispatchReminderEmail(appt, daysUntil);

    fired += 1;
    changed = true;
    return { ...appt, lastReminderDate: todayKey };
  });

  if (fired > 0) {
    writeNotifications(notifications);
  }
  if (changed) {
    safeSet(STORAGE_KEYS.APPOINTMENTS, nextList);
  }
  return fired;
}

/** Start the 60-second dispatcher. Returns a teardown function so React
 *  effects can cancel cleanly on unmount. Safe to call multiple times
 *  (each call returns its own teardown). */
export function startAppointmentReminderLoop(intervalMs = 60_000) {
  /* Fire once on start so a stale window (tab resumed after minutes/hours
   * asleep) doesn't have to wait another tick to catch up. */
  try { dispatchAppointmentReminders(); } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[reminders] initial tick failed:', err?.message);
  }
  const handle = setInterval(() => {
    try { dispatchAppointmentReminders(); } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[reminders] tick failed:', err?.message);
    }
  }, intervalMs);
  return () => clearInterval(handle);
}
