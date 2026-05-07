/**
 * Appointment reminder dispatcher.
 *
 * Runs from a 60-second interval (wired in App.jsx). Each tick scans the
 * persisted appointments list for upcoming slots and fires reminder
 * notifications at the 24-hour and 1-hour marks.
 *
 * Dedupe: every appointment grows a `remindersFired` array (subset of
 * ['24h', '1h']) so the same milestone never fires twice, even across
 * reloads. The list is written back to localStorage on every tick that
 * changes state.
 *
 * Side effects per fire:
 *   a) in-app notification (via notificationSync.writeNotifications)
 *   b) audit log entry (addAuditLog)
 *   c) console.log stub for email / WhatsApp / SMS (real channels are
 *      backend work — this is the seam a backend call will replace).
 */

import { STORAGE_KEYS } from '../store';
import { safeGet, safeSet } from './storage';
import { readNotifications, writeNotifications } from './notificationSync';
import { addAuditLog } from './auditLogger';

const MS_PER_MIN = 60 * 1000;
const MS_PER_HOUR = 60 * MS_PER_MIN;

/* Firing windows — each milestone fires if `now` is within ±2 minutes
 * of the target offset. Wider than the 60 s tick so a slow tab wake-up
 * (throttled by the browser when backgrounded) still lands the reminder. */
const MILESTONES = [
  { id: '24h', leadMs: 24 * MS_PER_HOUR, label: '24 hours', toleranceMs: 2 * MS_PER_MIN },
  { id: '1h',  leadMs: 1  * MS_PER_HOUR, label: '1 hour',   toleranceMs: 2 * MS_PER_MIN },
];

/** Skippable statuses — don't remind guests of cancelled or completed visits. */
const ACTIVE_STATUSES = new Set([
  'pending', 'approved', 'confirmed',
  /* Inside / Completed / No-show / Rejected / Cancelled → no reminder. */
]);

function parseStartMs(appt) {
  if (!appt || typeof appt !== 'object') return NaN;
  const day = typeof appt.date === 'string' ? appt.date.slice(0, 10) : '';
  const time = typeof appt.time === 'string' ? appt.time : '';
  if (!day || !/^\d{1,2}:\d{2}$/.test(time)) return NaN;
  const [h, m] = time.split(':').map(Number);
  const iso = `${day}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : NaN;
}

function milestoneIsDue(startMs, now, milestone) {
  const target = startMs - milestone.leadMs;
  /* Fire if we're within the tolerance window. This catches the tick on
   * which the window opens AND the next tick if the first one missed,
   * but won't fire forever (the dedupe array still guards it). */
  return Math.abs(now - target) <= milestone.toleranceMs;
}

function guestLabel(appt) {
  return (
    appt.guestName ||
    appt.visitorName ||
    appt.guest ||
    'Guest'
  );
}

function hostLabel(appt) {
  return appt.host || appt.hostName || 'Host';
}

function buildReminderNotification(appt, milestone) {
  const who = guestLabel(appt);
  const host = hostLabel(appt);
  return {
    id:        `reminder-${appt.id}-${milestone.id}-${Date.now()}`,
    title:     `Appointment reminder — ${milestone.label}`,
    message:   `${who} has an appointment with ${host} in ${milestone.label.toLowerCase()} (${appt.date} at ${appt.time}).`,
    type:      'appointment',
    /* Surfaced to everyone who can see org-level notifications; the
     * notificationSync filter handles tenant isolation downstream. */
    roles:     ['director', 'manager', 'reception'],
    orgId:     appt.orgId || null,
    timestamp: new Date().toISOString(),
    isRead:    false,
    meta:      { appointmentId: appt.id, milestone: milestone.id },
  };
}

/** Console-log stub for the email / WhatsApp / SMS channels — a real
 *  backend hook replaces this with fetch/SDK calls. Kept loud at info
 *  level so it's easy to spot during QA. */
function dispatchExternalChannels(appt, milestone) {
  const who = guestLabel(appt);
  const host = hostLabel(appt);
  const slot = `${appt.date} at ${appt.time}`;
  /* eslint-disable no-console */
  console.info(`[reminders] email → host(${host}): appointment with ${who} in ${milestone.label} (${slot})`);
  console.info(`[reminders] whatsapp → host(${host}): reminder in ${milestone.label} for ${who}`);
  console.info(`[reminders] sms → guest(${who}): reminder for your appointment in ${milestone.label} at ${slot}`);
  /* eslint-enable no-console */
}

/**
 * Scan, fire, persist. Returns the number of reminders fired on this tick
 * (primarily useful for tests / manual triggers — the interval caller
 * ignores the return value).
 */
export function dispatchAppointmentReminders(now = Date.now()) {
  const appointments = safeGet(STORAGE_KEYS.APPOINTMENTS, null);
  if (!Array.isArray(appointments) || appointments.length === 0) return 0;

  let fired = 0;
  let changed = false;
  const notifications = readNotifications();

  const nextList = appointments.map((appt) => {
    const status = String(appt?.status || '').toLowerCase();
    if (!ACTIVE_STATUSES.has(status)) return appt;

    const startMs = parseStartMs(appt);
    if (!Number.isFinite(startMs) || startMs <= now) return appt;

    const alreadyFired = Array.isArray(appt.remindersFired) ? appt.remindersFired : [];
    let mutated = false;
    let next = appt;

    for (const m of MILESTONES) {
      if (alreadyFired.includes(m.id)) continue;
      if (!milestoneIsDue(startMs, now, m)) continue;

      /* 1) in-app notification */
      notifications.unshift(buildReminderNotification(appt, m));
      /* 2) audit log */
      addAuditLog({
        userName:    'system',
        role:        'system',
        action:      'REMINDER',
        module:      'Appointments',
        description: `Sent ${m.label} reminder for appointment ${appt.id} (${guestLabel(appt)} → ${hostLabel(appt)}).`,
        orgId:       appt.orgId || null,
      });
      /* 3) external channel stubs */
      dispatchExternalChannels(appt, m);

      next = { ...next, remindersFired: [...(next.remindersFired || []), m.id] };
      mutated = true;
      fired += 1;
    }

    if (mutated) changed = true;
    return next;
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
    console.warn('[reminders] initial tick failed:', err?.message);
  }
  const handle = setInterval(() => {
    try { dispatchAppointmentReminders(); } catch (err) {
      console.warn('[reminders] tick failed:', err?.message);
    }
  }, intervalMs);
  return () => clearInterval(handle);
}
