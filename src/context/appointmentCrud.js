import { notifyVia, sendEmail } from '../utils/messaging';

const slugify = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');

export const hostEmailFor  = (name) => (name ? `${slugify(name)}@company.example` : '');
export const guestEmailFor = (name, company) =>
  name
    ? `${slugify(name)}@${slugify(company) || 'guest'}.example`
    : '';

const nowIso = () => new Date().toISOString();

function makeId(prefix = 'id') {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/* Every function below takes a `deps` bag of setters/helpers from the provider
   so the context file stays a thin wiring layer while the heavy logic lives
   here. Behavior is identical to the previous inline callbacks. */

export function createAppointmentImpl(form, { setAppointments, resolveOrgId, notify, addNotification, addLog, guard }) {
  guard('appointments', 'create');
  const next = {
    id: makeId('apt'),
    status: 'Pending',
    ...form,
    orgId: form.orgId || resolveOrgId(),
  };
  setAppointments((prev) => [...prev, next]);
  notify('Appointment created — waiting for approval.', 'success');
  addNotification({
    message: `New appointment for ${next.guestName} — awaiting approval.`,
    type: 'appointment',
  });
  addLog({
    action:   'Appointment Created',
    module:   'Appointments',
    metadata: { guestName: next.guestName, date: next.date, time: next.time, orgId: next.orgId },
  });
  const when = `${next.date} ${next.time}`;
  notifyVia(['email', 'whatsapp'], {
    to:      next.contactNumber || guestEmailFor(next.guestName, next.companyName),
    subject: 'Appointment request received',
    message: `Hi ${next.guestName}, we've received your appointment request with ${next.host} on ${when}. You'll hear back once it's approved.`,
    meta:    { appointmentId: next.id, kind: 'appointment-created' },
  });
  sendEmail({
    to:      hostEmailFor(next.host),
    subject: `New appointment request: ${next.guestName}`,
    message: `${next.guestName} (${next.companyName || 'N/A'}) requested an appointment on ${when}. Purpose: ${next.purpose || '—'}.`,
    meta:    { appointmentId: next.id, kind: 'appointment-created' },
  });
  return next;
}

export function updateAppointmentImpl(id, patch, { setAppointments, notify, addLog, guard }) {
  guard('appointments', 'edit');
  setAppointments((prev) => {
    const apt = prev.find((a) => a.id === id);
    if (apt) {
      addLog({
        action:   'Appointment Updated',
        module:   'Appointments',
        metadata: { guestName: apt.guestName },
      });
    }
    return prev.map((a) => (a.id === id ? { ...a, ...patch } : a));
  });
  notify('Appointment updated successfully.', 'success');
}

export function approveAppointmentImpl(id, { setAppointments, notify, addNotification, addLog, guard }) {
  guard('appointments', 'edit');
  setAppointments((prev) => {
    const apt = prev.find((a) => a.id === id);
    if (!apt || apt.status !== 'Pending') return prev;
    addNotification({
      message: `Appointment approved: ${apt.guestName}.`,
      type: 'appointment',
    });
    addLog({
      action:   'Appointment Approved',
      module:   'Appointments',
      metadata: { guestName: apt.guestName },
    });
    const when = `${apt.date} ${apt.time}`;
    notifyVia(['email', 'whatsapp'], {
      to:      apt.contactNumber || guestEmailFor(apt.guestName, apt.companyName),
      subject: 'Your appointment is confirmed',
      message: `Hi ${apt.guestName}, your appointment with ${apt.host} on ${when} has been confirmed. Please bring a valid ID.`,
      meta:    { appointmentId: apt.id, kind: 'appointment-approved' },
    });
    return prev.map((a) => (a.id === id ? { ...a, status: 'Approved' } : a));
  });
  notify('Appointment approved successfully', 'success');
}

export function rejectAppointmentImpl(id, { setAppointments, notify, addNotification, addLog, guard }) {
  guard('appointments', 'edit');
  setAppointments((prev) => {
    const apt = prev.find((a) => a.id === id);
    if (!apt || apt.status !== 'Pending') return prev;
    addNotification({
      message: `Appointment rejected: ${apt.guestName}.`,
      type: 'appointment',
    });
    addLog({
      action:   'Appointment Rejected',
      module:   'Appointments',
      metadata: { guestName: apt.guestName },
    });
    return prev.map((a) => (a.id === id ? { ...a, status: 'Rejected' } : a));
  });
  notify('Appointment rejected', 'warn');
}

export function deleteAppointmentImpl(id, { setAppointments, setGuestLog, notify, addLog, guard }) {
  guard('appointments', 'delete');
  setAppointments((prev) => {
    const apt = prev.find((a) => a.id === id);
    if (apt) {
      addLog({
        action:   'Appointment Deleted',
        module:   'Appointments',
        metadata: { guestName: apt.guestName },
      });
    }
    return prev.filter((a) => a.id !== id);
  });
  setGuestLog((prev) => prev.filter((g) => g.appointmentId !== id));
  notify('Appointment deleted.', 'success');
}
