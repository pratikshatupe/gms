'use strict';

const Guest = require('../models/Guest');
const Office = require('../models/Office');
const Organization = require('../models/Organization');
const Appointment = require('../models/Appointment');
const ApiError = require('../utils/ApiError');
const { getPagination, buildSort, paginate } = require('../utils/pagination');
const { buildSearchRegex, generateBadgeNumber, startOfDay, endOfDay } = require('../utils/helpers');
const {
  GUEST_STATUS,
  GUEST_TYPE,
  APPOINTMENT_STATUS,
  NOTIFICATION_EVENT,
} = require('../config/constants');
const notificationService = require('./notification.service');

async function ensureOfficeBelongsToOrg(officeId, organizationId) {
  const office = await Office.findOne({ _id: officeId, organizationId });
  if (!office) throw ApiError.badRequest('Office does not belong to your organization');
  return office;
}

async function checkInGuest(payload, organizationId, actor) {
  await ensureOfficeBelongsToOrg(payload.officeId, organizationId);
  const org = await Organization.findById(organizationId).select('settings');

  let appointment = null;
  if (payload.appointmentId) {
    appointment = await Appointment.findOne({ _id: payload.appointmentId, organizationId });
    if (!appointment) throw ApiError.badRequest('Appointment not found');
    if (![APPOINTMENT_STATUS.SCHEDULED, APPOINTMENT_STATUS.CONFIRMED].includes(appointment.status)) {
      throw ApiError.badRequest('Appointment is not in a check-in eligible state');
    }
  }

  const badgePrefix = (org && org.settings && org.settings.visitorBadgePrefix) || 'V';

  const guest = await Guest.create({
    organizationId,
    officeId: payload.officeId,
    appointmentId: payload.appointmentId || null,
    type: payload.appointmentId ? GUEST_TYPE.PRE_APPOINTED : payload.type || GUEST_TYPE.WALK_IN,
    status: GUEST_STATUS.CHECKED_IN,
    badgeNumber: generateBadgeNumber(badgePrefix),
    fullName: payload.fullName,
    email: payload.email,
    phone: payload.phone,
    company: payload.company,
    designation: payload.designation,
    purpose: payload.purpose || (appointment ? appointment.purpose : undefined),
    photoUrl: payload.photoUrl,
    idVerification: payload.idVerification
      ? {
          ...payload.idVerification,
          verified: !!payload.idVerification.number,
          verifiedAt: payload.idVerification.number ? new Date() : undefined,
          verifiedBy: payload.idVerification.number && actor ? actor._id : undefined,
        }
      : undefined,
    hostUserId: payload.hostUserId || (appointment ? appointment.hostUserId : null),
    hostDepartment: payload.hostDepartment || (appointment ? appointment.hostDepartment : undefined),
    roomId: payload.roomId || (appointment ? appointment.roomId : null),
    accompanyingCount: payload.accompanyingCount || 0,
    vehicleNumber: payload.vehicleNumber,
    expectedAt: payload.expectedAt || (appointment ? appointment.scheduledAt : undefined),
    checkedInAt: new Date(),
    checkedInBy: actor ? actor._id : undefined,
    notes: payload.notes,
    createdBy: actor ? actor._id : undefined,
  });

  // Create linked service requests if provided during walk-in check-in
  // payload.serviceRequests = [{ category: 'PANTRY', description: 'Tea and coffee' }, ...]
  if (payload.serviceRequests && Array.isArray(payload.serviceRequests) && payload.serviceRequests.length > 0) {
    const ServiceRequest = require('../models/ServiceRequest');
    const srDocs = payload.serviceRequests.map((sr) => ({
      organizationId,
      officeId: payload.officeId,
      guestId: guest._id,
      category: sr.category,
      title: sr.title || sr.description || sr.category,
      description: sr.description || '',
      status: 'PENDING',
      requestedBy: actor ? actor._id : undefined,
      createdBy: actor ? actor._id : undefined,
    }));
    await ServiceRequest.insertMany(srDocs);
  }

  if (appointment) {
    appointment.status = APPOINTMENT_STATUS.COMPLETED;
    await appointment.save();
  }

  if (guest.hostUserId) {
    notificationService
      .dispatch({
        organizationId,
        officeId: guest.officeId,
        event: NOTIFICATION_EVENT.GUEST_CHECKED_IN,
        relatedEntityType: 'Guest',
        relatedEntityId: guest._id,
        recipients: [{ channel: 'IN_APP', userId: guest.hostUserId, name: 'Host' }],
        payload: { guestId: guest._id, fullName: guest.fullName, badgeNumber: guest.badgeNumber },
      })
      .catch(() => null);
  }

  return guest;
}

async function listGuests(query, organizationId) {
  const { page, limit, skip } = getPagination(query);
  const sort = buildSort(query, ['createdAt', 'checkedInAt', 'checkedOutAt', 'fullName']);

  // Bug 8 fix: super admin (organizationId=null) sees guests across ALL organisations
  const filter = {};
  if (organizationId) filter.organizationId = organizationId;
  if (query.officeId) filter.officeId = query.officeId;
  if (query.status) filter.status = query.status;
  if (query.type) filter.type = query.type;
  if (query.hostUserId) filter.hostUserId = query.hostUserId;
  if (query.fromDate || query.toDate) {
    filter.createdAt = {};
    if (query.fromDate) filter.createdAt.$gte = new Date(query.fromDate);
    if (query.toDate) filter.createdAt.$lte = new Date(query.toDate);
  }
  if (query.search) {
    const regex = buildSearchRegex(query.search);
    filter.$or = [
      { fullName: regex },
      { email: regex },
      { phone: regex },
      { company: regex },
      { badgeNumber: regex },
    ];
  }

  const [items, total] = await Promise.all([
    Guest.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('hostUserId', 'name email department')
      .populate('roomId', 'name code')
      .populate('officeId', 'name code')
      .lean(),
    Guest.countDocuments(filter),
  ]);

  return { items, meta: paginate(total, page, limit) };
}

async function getGuestById(id, organizationId) {
  const guest = await Guest.findOne({ _id: id, organizationId })
    .populate('hostUserId', 'name email department phone')
    .populate('roomId', 'name code capacity')
    .populate('officeId', 'name code city');
  if (!guest) throw ApiError.notFound('Guest not found');
  return guest;
}

async function updateGuest(id, organizationId, payload) {
  const guest = await Guest.findOneAndUpdate({ _id: id, organizationId }, payload, {
    new: true,
    runValidators: true,
  });
  if (!guest) throw ApiError.notFound('Guest not found');
  return guest;
}

async function checkOutGuest(id, organizationId, actor) {
  const guest = await Guest.findOne({ _id: id, organizationId });
  if (!guest) throw ApiError.notFound('Guest not found');
  if (guest.status === GUEST_STATUS.CHECKED_OUT) {
    throw ApiError.badRequest('Guest is already checked out');
  }

  guest.status = GUEST_STATUS.CHECKED_OUT;
  guest.checkedOutAt = new Date();
  guest.checkedOutBy = actor ? actor._id : undefined;
  await guest.save();

  if (guest.hostUserId) {
    notificationService
      .dispatch({
        organizationId,
        officeId: guest.officeId,
        event: NOTIFICATION_EVENT.GUEST_CHECKED_OUT,
        relatedEntityType: 'Guest',
        relatedEntityId: guest._id,
        recipients: [{ channel: 'IN_APP', userId: guest.hostUserId, name: 'Host' }],
        payload: { guestId: guest._id, fullName: guest.fullName, checkedOutAt: guest.checkedOutAt },
      })
      .catch(() => null);
  }

  return guest;
}

async function verifyGuestId(id, organizationId, payload, actor) {
  const guest = await Guest.findOne({ _id: id, organizationId });
  if (!guest) throw ApiError.notFound('Guest not found');

  guest.idVerification = {
    type: payload.type,
    number: payload.number,
    documentUrl: payload.documentUrl,
    verified: true,
    verifiedAt: new Date(),
    verifiedBy: actor ? actor._id : undefined,
  };
  await guest.save();
  return guest;
}

async function getActiveGuests(organizationId, officeId) {
  const filter = { organizationId, status: GUEST_STATUS.CHECKED_IN };
  if (officeId) filter.officeId = officeId;
  return Guest.find(filter)
    .sort({ checkedInAt: -1 })
    .populate('hostUserId', 'name email')
    .populate('roomId', 'name')
    .lean();
}

async function getDailyStats(organizationId, officeId, date = new Date()) {
  const start = startOfDay(date);
  const end = endOfDay(date);
  const filter = { organizationId, createdAt: { $gte: start, $lte: end } };
  if (officeId) filter.officeId = officeId;

  const [totalToday, currentlyInside, walkInsToday, checkedOutToday] = await Promise.all([
    Guest.countDocuments(filter),
    Guest.countDocuments({ ...filter, status: GUEST_STATUS.CHECKED_IN }),
    Guest.countDocuments({ ...filter, type: GUEST_TYPE.WALK_IN }),
    Guest.countDocuments({ ...filter, status: GUEST_STATUS.CHECKED_OUT }),
  ]);

  return { totalToday, currentlyInside, walkInsToday, checkedOutToday };
}

module.exports = {
  checkInGuest,
  listGuests,
  getGuestById,
  updateGuest,
  checkOutGuest,
  verifyGuestId,
  getActiveGuests,
  getDailyStats,
};