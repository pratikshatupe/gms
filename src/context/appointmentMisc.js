import { notifyVia, sendEmail } from '../utils/messaging';
import { hostEmailFor, guestEmailFor } from './appointmentCrud';

const nowIso = () => new Date().toISOString();

function makeId(prefix = 'id') {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const REMINDER_WINDOWS = [
  { id: '24h', minutes: 24 * 60, label: '24 hours' },
  { id: '1h',  minutes: 60,      label: '1 hour' },
];
export const REMINDER_SENT_KEY = 'cgms.appointmentReminders.sent.v1';

export function loadSentReminders() {
  try {
    const raw = localStorage.getItem(REMINDER_SENT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

export function saveSentReminders(set) {
  try {
    localStorage.setItem(REMINDER_SENT_KEY, JSON.stringify([...set]));
  } catch {
    /* non-fatal */
  }
}

export function runReminderCheck(appointments, addLog) {
  const now = Date.now();
  const sent = loadSentReminders();
  let changed = false;
  appointments.forEach((apt) => {
    if (!['Pending', 'Approved'].includes(apt.status)) return;
    if (!apt.date || !apt.time) return;
    const whenTs = new Date(`${apt.date}T${apt.time}`).getTime();
    if (!Number.isFinite(whenTs) || whenTs <= now) return;
    const minutesUntil = (whenTs - now) / 60_000;
    REMINDER_WINDOWS.forEach((w) => {
      if (minutesUntil > w.minutes) return;
      const key = `${apt.id}:${w.id}`;
      if (sent.has(key)) return;
      sent.add(key);
      changed = true;
      const when = `${apt.date} at ${apt.time}`;
      notifyVia(['email', 'whatsapp'], {
        to:      apt.contactNumber || guestEmailFor(apt.guestName, apt.companyName),
        subject: `Reminder: your appointment in ${w.label}`,
        message: `Hi ${apt.guestName}, this is a reminder about your appointment with ${apt.host} on ${when}. Please bring a valid ID${apt.documentRequirements?.length ? ` and: ${apt.documentRequirements.join(', ')}` : ''}.`,
        meta:    { appointmentId: apt.id, kind: 'reminder', window: w.id },
      });
      sendEmail({
        to:      hostEmailFor(apt.host),
        subject: `Reminder: ${apt.guestName} visiting in ${w.label}`,
        message: `${apt.guestName} (${apt.companyName || 'N/A'}) is scheduled to visit you on ${when}. Purpose: ${apt.purpose || '—'}.`,
        meta:    { appointmentId: apt.id, kind: 'reminder', window: w.id },
      });
      addLog({
        action:   'Reminder Sent',
        module:   'Appointments',
        metadata: { guestName: apt.guestName, window: w.label },
      });
    });
  });
  if (changed) saveSentReminders(sent);
}

export function walkInCheckInImpl(form, { setGuestLog, resolveOrgId, notify, addNotification, addLog, guard }) {
  guard('walkin', 'create');
  const entry = {
    id: makeId('gl'),
    appointmentId: null,
    guestName:     form.guestName,
    company:       form.companyName,
    contactNumber: form.contactNumber,
    host:          form.host,
    purpose:       form.purpose,
    idType:        form.idType || '',
    idNumber:      form.idNumber || '',
    photoDataUrl:  form.photoDataUrl || '',
    type:          'Walk-in',
    checkInTime:   nowIso(),
    checkOutTime:  null,
    status:        'Inside',
    orgId:         form.orgId || resolveOrgId(),
  };
  setGuestLog((prev) => [...prev, entry]);
  notify('Walk-in visitor checked in successfully.', 'success');
  addNotification({
    message: `Walk-in checked in: ${entry.guestName}.`,
    type: 'check-in',
  });
  addLog({
    action:   'Walk-in Check-in',
    module:   'Walk-in',
    metadata: { guestName: entry.guestName, host: entry.host, purpose: entry.purpose },
  });
  sendEmail({
    to:      hostEmailFor(entry.host),
    subject: `Walk-in visitor for you: ${entry.guestName}`,
    message: `${entry.guestName} (${entry.company || 'N/A'}) has walked in and is waiting at reception. Purpose: ${entry.purpose || '—'}.`,
    meta:    { guestLogId: entry.id, kind: 'walk-in' },
  });
  return entry;
}

export function markNoShowImpl(id, { setAppointments, notify, addLog, guard }) {
  guard('appointments', 'edit');
  setAppointments((prev) => {
    const apt = prev.find((a) => a.id === id);
    if (!apt) return prev;
    notify(`Marked ${apt.guestName} as No-show.`, 'warn');
    addLog({
      action:   'Marked No-show',
      module:   'Appointments',
      metadata: { guestName: apt.guestName },
    });
    return prev.map((a) => (a.id === id ? { ...a, status: 'No-show' } : a));
  });
}

export function computeMetrics({ appointments, guestLog, services, rooms, bookings }) {
  const today = new Date().toISOString().slice(0, 10);
  const now = Date.now();
  const upcomingSoon = appointments.filter((a) => {
    if (!['Pending', 'Approved'].includes(a.status) || !a.date || !a.time) return false;
    const when = new Date(`${a.date}T${a.time}`).getTime();
    const diffMin = (when - now) / 60_000;
    return diffMin >= 0 && diffMin <= 60;
  });
  return {
    total:        appointments.length,
    pending:      appointments.filter((a) => a.status === 'Pending').length,
    approved:     appointments.filter((a) => a.status === 'Approved').length,
    rejected:     appointments.filter((a) => a.status === 'Rejected').length,
    inside:       guestLog.filter((g) => g.status === 'Inside').length,
    completed:    appointments.filter((a) => a.status === 'Completed').length,
    noShow:       appointments.filter((a) => a.status === 'No-show').length,
    todayCount:   appointments.filter((a) => a.date === today).length,
    upcomingSoon: upcomingSoon.length,
    walkIns:      guestLog.filter((g) => g.type === 'Walk-in').length,
    services: {
      total:       services.length,
      pending:     services.filter((s) => s.status === 'Pending').length,
      inProgress:  services.filter((s) => s.status === 'In Progress').length,
      completed:   services.filter((s) => s.status === 'Completed').length,
    },
    rooms: {
      total:          rooms.length,
      available:      rooms.filter((r) => r.status === 'Available').length,
      maintenance:    rooms.filter((r) => r.status === 'Under Maintenance').length,
    },
    bookings: {
      total:       bookings.length,
      today:       bookings.filter((b) => b.date === today && b.status !== 'Cancelled').length,
      upcoming:    bookings.filter((b) => b.date > today && b.status !== 'Cancelled').length,
      cancelled:   bookings.filter((b) => b.status === 'Cancelled').length,
    },
  };
}
