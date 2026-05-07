'use strict';

const Appointment = require('../models/Appointment');
const Office = require('../models/Office');
const User = require('../models/User');
const Room = require('../models/Room');
const ApiError = require('../utils/ApiError');
const { getPagination, buildSort, paginate } = require('../utils/pagination');
const { buildSearchRegex } = require('../utils/helpers');
const { APPOINTMENT_STATUS, NOTIFICATION_EVENT } = require('../config/constants');
const notificationService = require('./notification.service');

async function ensureOfficeBelongsToOrg(officeId, organizationId) {
  const office = await Office.findOne({ _id: officeId, organizationId });
  if (!office) throw ApiError.badRequest('Office does not belong to your organization');
  return office;
}

async function ensureHostBelongsToOrg(hostUserId, organizationId) {
  const host = await User.findOne({ _id: hostUserId, organizationId, isActive: true });
  if (!host) throw ApiError.badRequest('Host user not found in your organization');
  return host;
}

async function ensureRoomAvailable(roomId, organizationId, officeId, scheduledAt, endsAt, excludeId) {
  if (!roomId) return null;
  const room = await Room.findOne({ _id: roomId, organizationId, officeId, isActive: true });
  if (!room) throw ApiError.badRequest('Room not found in this office');

  const conflictFilter = {
    organizationId,
    roomId,
    status: {
      $nin: [APPOINTMENT_STATUS.CANCELLED, APPOINTMENT_STATUS.COMPLETED, APPOINTMENT_STATUS.NO_SHOW],
    },
    scheduledAt: { $lt: endsAt },
    endsAt: { $gt: scheduledAt },
  };
  if (excludeId) conflictFilter._id = { $ne: excludeId };

  const conflict = await Appointment.findOne(conflictFilter).lean();
  if (conflict) throw ApiError.conflict('Room is already booked for the requested time');
  return room;
}

async function createAppointment(payload, organizationId, actor) {
  await ensureOfficeBelongsToOrg(payload.officeId, organizationId);
  const host = await ensureHostBelongsToOrg(payload.hostUserId, organizationId);

  const scheduledAt = new Date(payload.scheduledAt);
  const endsAt = new Date(scheduledAt.getTime() + payload.durationMinutes * 60 * 1000);

  await ensureRoomAvailable(payload.roomId, organizationId, payload.officeId, scheduledAt, endsAt);

  const appointment = await Appointment.create({
    ...payload,
    scheduledAt,
    endsAt,
    organizationId,
    hostDepartment: payload.hostDepartment || host.department,
    createdBy: actor ? actor._id : undefined,
  });

  // Email/WhatsApp default to ON unless explicitly set to false (Bug 6 fix)
  const wantsEmail    = payload.notifyEmail    !== false;
  const wantsWhatsApp = payload.notifyWhatsApp !== false;

  /* Bug 14 — send the visitor a richer invitation email containing host,
     office, address, purpose and any host instructions. The host still
     gets the legacy APPOINTMENT_CREATED confirmation. */
  const office = await Office.findById(payload.officeId).select('name code address city');
  const officeAddress = office?.address
    ? [office.address.line1, office.address.line2, office.address.city, office.address.country, office.address.postalCode].filter(Boolean).join(', ')
    : office?.city || '';

  if (wantsEmail && payload.visitor?.email) {
    notificationService
      .dispatch({
        organizationId,
        officeId: payload.officeId,
        event: NOTIFICATION_EVENT.APPOINTMENT_INVITATION,
        relatedEntityType: 'Appointment',
        relatedEntityId: appointment._id,
        recipients: [
          { channel: 'EMAIL', email: payload.visitor.email, name: payload.visitor.fullName },
        ],
        payload: {
          appointmentId: appointment._id,
          title: appointment.title,
          scheduledAt,
          visitorName: payload.visitor.fullName,
          hostName: host.name,
          officeName: office?.name,
          officeAddress,
          purpose: appointment.purpose || appointment.title,
          instructions: appointment.notes,
        },
      })
      .catch((err) => {
        try { require('../config/logger').error('Appointment invitation email failed: ' + (err?.message || err)); } catch {}
      });
  }

  notificationService
    .dispatch({
      organizationId,
      officeId: payload.officeId,
      event: NOTIFICATION_EVENT.APPOINTMENT_CREATED,
      relatedEntityType: 'Appointment',
      relatedEntityId: appointment._id,
      recipients: [
        wantsWhatsApp && payload.visitor?.phone
          ? { channel: 'WHATSAPP', phone: payload.visitor.phone, name: payload.visitor.fullName }
          : null,
        host.email ? { channel: 'EMAIL', userId: host._id, email: host.email, name: host.name } : null,
      ].filter(Boolean),
      payload: { appointmentId: appointment._id, title: appointment.title, scheduledAt },
    })
    .catch((err) => {
      try { require('../config/logger').error('Appointment confirmation email failed: ' + (err?.message || err)); } catch {}
    });

  return appointment;
}

/**
 * Bug 15 — emit visitor + host emails when an appointment is checked in.
 * Called by the appointment update endpoint when status flips to a
 * checked-in equivalent, and by an explicit /check-in route below.
 */
async function fireCheckInNotifications(appointment) {
  const office = await Office.findById(appointment.officeId).select('name code');
  const host = appointment.hostUserId
    ? await User.findById(appointment.hostUserId).select('name email')
    : null;
  const visitorEmail = appointment.visitor?.email;
  const visitorName  = appointment.visitor?.fullName;
  const badgeNumber  = appointment.badgeNumber || '-';
  const checkedInAt  = appointment.checkedInAt || new Date();

  const tasks = [];
  if (visitorEmail) {
    tasks.push(
      notificationService.dispatch({
        organizationId: appointment.organizationId,
        officeId: appointment.officeId,
        event: NOTIFICATION_EVENT.CHECK_IN_VISITOR,
        relatedEntityType: 'Appointment',
        relatedEntityId: appointment._id,
        recipients: [{ channel: 'EMAIL', email: visitorEmail, name: visitorName }],
        payload: {
          visitorName,
          hostName: host?.name,
          officeName: office?.name,
          checkedInAt,
          badgeNumber,
          title: appointment.title,
        },
      }),
    );
  }
  if (host?.email) {
    tasks.push(
      notificationService.dispatch({
        organizationId: appointment.organizationId,
        officeId: appointment.officeId,
        event: NOTIFICATION_EVENT.CHECK_IN_HOST,
        relatedEntityType: 'Appointment',
        relatedEntityId: appointment._id,
        recipients: [{ channel: 'EMAIL', userId: host._id, email: host.email, name: host.name }],
        payload: {
          visitorName,
          hostName: host.name,
          officeName: office?.name,
          title: appointment.title,
          badgeNumber,
        },
      }),
    );
  }
  await Promise.allSettled(tasks);
}

async function checkInAppointment(id, organizationId, payload = {}) {
  const appointment = await Appointment.findOne({ _id: id, organizationId });
  if (!appointment) throw ApiError.notFound('Appointment not found.');
  appointment.status = APPOINTMENT_STATUS.CONFIRMED;
  appointment.checkedInAt = new Date();
  if (payload.badgeNumber) appointment.badgeNumber = payload.badgeNumber;
  await appointment.save();
  fireCheckInNotifications(appointment).catch(() => null);
  return appointment;
}

async function listAppointments(query, organizationId) {
  const { page, limit, skip } = getPagination(query);
  const sort = buildSort(query, ['scheduledAt', 'createdAt', 'status']);

  const filter = { organizationId };
  if (query.officeId) filter.officeId = query.officeId;
  if (query.hostUserId) filter.hostUserId = query.hostUserId;
  if (query.status) filter.status = query.status;
  if (query.fromDate || query.toDate) {
    filter.scheduledAt = {};
    if (query.fromDate) filter.scheduledAt.$gte = new Date(query.fromDate);
    if (query.toDate) filter.scheduledAt.$lte = new Date(query.toDate);
  }
  if (query.search) {
    const regex = buildSearchRegex(query.search);
    filter.$or = [
      { title: regex },
      { 'visitor.fullName': regex },
      { 'visitor.company': regex },
      { 'visitor.email': regex },
      { 'visitor.phone': regex },
    ];
  }

  const [items, total] = await Promise.all([
    Appointment.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('hostUserId', 'name email department')
      .populate('roomId', 'name code capacity')
      .populate('officeId', 'name code')
      .lean(),
    Appointment.countDocuments(filter),
  ]);

  return { items, meta: paginate(total, page, limit) };
}

async function getAppointmentById(id, organizationId) {
  const appointment = await Appointment.findOne({ _id: id, organizationId })
    .populate('hostUserId', 'name email department phone')
    .populate('roomId', 'name code capacity')
    .populate('officeId', 'name code city');
  if (!appointment) throw ApiError.notFound('Appointment not found');
  return appointment;
}

async function updateAppointment(id, organizationId, payload) {
  const appointment = await Appointment.findOne({ _id: id, organizationId });
  if (!appointment) throw ApiError.notFound('Appointment not found');

  let scheduledAt = appointment.scheduledAt;
  let durationMinutes = appointment.durationMinutes;

  if (payload.scheduledAt) scheduledAt = new Date(payload.scheduledAt);
  if (payload.durationMinutes) durationMinutes = payload.durationMinutes;

  const endsAt = new Date(scheduledAt.getTime() + durationMinutes * 60 * 1000);

  if (payload.hostUserId && String(payload.hostUserId) !== String(appointment.hostUserId)) {
    await ensureHostBelongsToOrg(payload.hostUserId, organizationId);
  }

  const targetRoom = payload.roomId !== undefined ? payload.roomId : appointment.roomId;
  if (targetRoom) {
    await ensureRoomAvailable(targetRoom, organizationId, appointment.officeId, scheduledAt, endsAt, id);
  }

  Object.assign(appointment, payload, { scheduledAt, endsAt });

  if (payload.status === APPOINTMENT_STATUS.CONFIRMED) appointment.confirmedAt = new Date();
  if (payload.status === APPOINTMENT_STATUS.CANCELLED) appointment.cancelledAt = new Date();

  /* Bug 15 — when an external caller flips status to CONFIRMED with a
     checked-in marker (badgeNumber or checkedInAt) we treat this as an
     arrival event and fire the visitor + host emails. */
  const isCheckIn = (
    payload.checkedInAt
    || payload.badgeNumber
    || (payload.status === APPOINTMENT_STATUS.CONFIRMED && !appointment.checkedInAt)
  );
  if (isCheckIn) {
    appointment.checkedInAt = appointment.checkedInAt || new Date();
  }

  await appointment.save();

  if (isCheckIn) {
    fireCheckInNotifications(appointment).catch(() => null);
  }
  return appointment;
}

async function cancelAppointment(id, organizationId, reason) {
  const appointment = await Appointment.findOne({ _id: id, organizationId });
  if (!appointment) throw ApiError.notFound('Appointment not found');
  if (appointment.status === APPOINTMENT_STATUS.CANCELLED) {
    throw ApiError.badRequest('Appointment is already cancelled');
  }

  appointment.status = APPOINTMENT_STATUS.CANCELLED;
  appointment.cancelledAt = new Date();
  appointment.cancellationReason = reason || 'Cancelled by user';
  await appointment.save();

  notificationService
    .dispatch({
      organizationId,
      officeId: appointment.officeId,
      event: NOTIFICATION_EVENT.APPOINTMENT_CANCELLED,
      relatedEntityType: 'Appointment',
      relatedEntityId: appointment._id,
      recipients: [
        appointment.visitor.email
          ? { channel: 'EMAIL', email: appointment.visitor.email, name: appointment.visitor.fullName }
          : null,
        appointment.visitor.phone
          ? { channel: 'WHATSAPP', phone: appointment.visitor.phone, name: appointment.visitor.fullName }
          : null,
      ].filter(Boolean),
      payload: { appointmentId: appointment._id, reason: appointment.cancellationReason },
    })
    .catch(() => null);

  return appointment;
}

async function getUpcomingForReminders(now = new Date(), windowMinutes = 60) {
  const windowEnd = new Date(now.getTime() + windowMinutes * 60 * 1000);
  return Appointment.find({
    status: { $in: [APPOINTMENT_STATUS.SCHEDULED, APPOINTMENT_STATUS.CONFIRMED] },
    reminderSentAt: { $exists: false },
    scheduledAt: { $gte: now, $lte: windowEnd },
  });
}

async function markReminderSent(id) {
  return Appointment.updateOne({ _id: id }, { reminderSentAt: new Date() });
}

module.exports = {
  createAppointment,
  listAppointments,
  getAppointmentById,
  updateAppointment,
  cancelAppointment,
  checkInAppointment,
  fireCheckInNotifications,
  getUpcomingForReminders,
  markReminderSent,
};
