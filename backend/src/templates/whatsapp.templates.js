'use strict';

function fmt(d) {
  try {
    return new Date(d).toLocaleString('en-GB', { hour12: false });
  } catch {
    return String(d);
  }
}

module.exports = {
  APPOINTMENT_CREATED: (p) =>
    `Hello, your appointment "${p.title || ''}" is scheduled for ${fmt(p.scheduledAt)}. Please arrive on time and carry a valid ID.`,

  APPOINTMENT_REMINDER: (p) =>
    `Reminder: your appointment "${p.title || ''}" is at ${fmt(p.scheduledAt)}.`,

  APPOINTMENT_CANCELLED: (p) =>
    `Your appointment has been cancelled. Reason: ${p.reason || 'Not specified'}.`,

  GUEST_CHECKED_IN: (p) =>
    `Visitor ${p.fullName} has checked in. Badge: ${p.badgeNumber || '-'}.`,

  GUEST_CHECKED_OUT: (p) =>
    `Visitor ${p.fullName} has checked out at ${fmt(p.checkedOutAt)}.`,

  SERVICE_CREATED: (p) =>
    `New service request assigned: ${p.title} (priority ${p.priority || 'NORMAL'}).`,

  SERVICE_UPDATED: (p) =>
    `Service request "${p.title}" status: ${p.status || p.change || 'updated'}.`,
};
