import { sendEmail } from '../utils/messaging';
import { hostEmailFor } from './appointmentCrud';

const nowIso = () => new Date().toISOString();

function makeId(prefix = 'id') {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function checkInAppointmentImpl(id, { setAppointments, setGuestLog, resolveOrgId, notify, addNotification, addLog, guard }) {
  guard('appointments', 'edit');
  setAppointments((prev) => {
    const apt = prev.find((a) => a.id === id);
    if (!apt) return prev;
    if (apt.status !== 'Approved') {
      if (apt.status === 'Pending') {
        notify('Cannot check in: appointment is still pending approval.', 'error');
      } else if (apt.status === 'Rejected') {
        notify('Cannot check in: appointment was rejected.', 'error');
      } else if (apt.status === 'Inside') {
        /* Already inside — no-op, no toast. */
      } else {
        notify(`Cannot check in: appointment is ${apt.status}.`, 'error');
      }
      return prev;
    }
    const logEntry = {
      id: makeId('gl'),
      appointmentId: apt.id,
      guestName: apt.guestName,
      company: apt.companyName,
      contactNumber: apt.contactNumber,
      host: apt.host,
      purpose: apt.purpose,
      type: 'Appointment',
      checkInTime: nowIso(),
      checkOutTime: null,
      status: 'Inside',
      orgId: apt.orgId || resolveOrgId(),
    };
    setGuestLog((log) => {
      const hasOpen = log.some((g) => g.appointmentId === id && !g.checkOutTime);
      return hasOpen ? log : [...log, logEntry];
    });
    notify(`${apt.guestName} checked in.`, 'info');
    addNotification({
      message: `Visitor checked in: ${apt.guestName}.`,
      type: 'check-in',
    });
    addLog({
      action:   'Visitor Check-in',
      module:   'Guest Log',
      metadata: { guestName: apt.guestName, type: 'Appointment' },
    });
    sendEmail({
      to:      hostEmailFor(apt.host),
      subject: `Your visitor has arrived: ${apt.guestName}`,
      message: `${apt.guestName} (${apt.companyName || 'N/A'}) just checked in at reception.`,
      meta:    { appointmentId: apt.id, kind: 'visitor-checked-in' },
    });
    return prev.map((a) => (a.id === id ? { ...a, status: 'Inside' } : a));
  });
}

export function checkOutAppointmentImpl(id, { setAppointments, setGuestLog, notify, addLog, guard }) {
  guard('guest-log', 'edit');
  setAppointments((prev) => {
    const apt = prev.find((a) => a.id === id);
    if (!apt || apt.status === 'Completed') return prev;
    setGuestLog((log) =>
      log.map((g) =>
        g.appointmentId === id && !g.checkOutTime
          ? { ...g, checkOutTime: nowIso(), status: 'Checked Out' }
          : g,
      ),
    );
    notify(`${apt.guestName} checked out.`, 'success');
    addLog({
      action:   'Visitor Check-out',
      module:   'Guest Log',
      metadata: { guestName: apt.guestName, type: 'Appointment' },
    });
    sendEmail({
      to:      hostEmailFor(apt.host),
      subject: `Visitor checked out: ${apt.guestName}`,
      message: `${apt.guestName} has left the premises. Visit is now closed.`,
      meta:    { appointmentId: apt.id, kind: 'visitor-checked-out' },
    });
    return prev.map((a) => (a.id === id ? { ...a, status: 'Completed' } : a));
  });
}

export function checkOutVisitorImpl(guestLogId, { setAppointments, setGuestLog, notify, addLog, guard }) {
  guard('guest-log', 'edit');
  let entry;
  setGuestLog((prev) => {
    entry = prev.find((g) => g.id === guestLogId);
    if (!entry || entry.checkOutTime) return prev;
    return prev.map((g) =>
      g.id === guestLogId
        ? { ...g, checkOutTime: nowIso(), status: 'Checked Out' }
        : g,
    );
  });
  if (entry && !entry.checkOutTime) {
    if (entry.appointmentId) {
      setAppointments((apts) =>
        apts.map((a) =>
          a.id === entry.appointmentId ? { ...a, status: 'Completed' } : a,
        ),
      );
    }
    notify(`${entry.guestName} checked out.`, 'success');
    addLog({
      action:   'Visitor Check-out',
      module:   'Guest Log',
      metadata: { guestName: entry.guestName, type: entry.type },
    });
  }
}

export function recordGuestResponseImpl(id, response, { setAppointments, notify, addNotification, addLog, guard }) {
  if (!['Accepted', 'Declined', 'Awaiting'].includes(response)) return;
  guard('appointments', 'edit');
  setAppointments((prev) => {
    const apt = prev.find((a) => a.id === id);
    if (!apt) return prev;
    if (apt.guestResponse === response) return prev;
    notify(`Guest response recorded: ${response}.`, response === 'Declined' ? 'warn' : 'success');
    addNotification({
      message: `${apt.guestName} ${response.toLowerCase()} the appointment.`,
      type: 'appointment',
    });
    addLog({
      action:   'Guest Response Recorded',
      module:   'Appointments',
      metadata: { guestName: apt.guestName, response },
    });
    sendEmail({
      to:      hostEmailFor(apt.host),
      subject: `Guest ${response.toLowerCase()}: ${apt.guestName}`,
      message: `${apt.guestName} has ${response.toLowerCase()} the appointment scheduled for ${apt.date} ${apt.time}.`,
      meta:    { appointmentId: apt.id, kind: 'guest-response', response },
    });
    return prev.map((a) =>
      a.id === id
        ? { ...a, guestResponse: response, guestResponseAt: nowIso() }
        : a,
    );
  });
}
