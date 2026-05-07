'use strict';

const ServiceRequest = require('../models/ServiceRequest');
const Office = require('../models/Office');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { getPagination, buildSort, paginate } = require('../utils/pagination');
const { buildSearchRegex } = require('../utils/helpers');
const { SERVICE_STATUS, NOTIFICATION_EVENT, ROLES } = require('../config/constants');
const notificationService = require('./notification.service');

async function ensureOfficeBelongsToOrg(officeId, organizationId) {
  const office = await Office.findOne({ _id: officeId, organizationId });
  if (!office) throw ApiError.badRequest('Office does not belong to your organization');
  return office;
}

async function ensureAssigneeValid(assignedTo, organizationId) {
  if (!assignedTo) return null;
  const user = await User.findOne({ _id: assignedTo, organizationId, isActive: true });
  if (!user) throw ApiError.badRequest('Assignee not found in your organization');
  return user;
}

async function createServiceRequest(payload, organizationId, actor) {
  await ensureOfficeBelongsToOrg(payload.officeId, organizationId);
  if (payload.assignedTo) await ensureAssigneeValid(payload.assignedTo, organizationId);

  const sr = await ServiceRequest.create({
    ...payload,
    organizationId,
    requestedBy: actor._id,
  });

  if (sr.assignedTo) {
    notificationService
      .dispatch({
        organizationId,
        officeId: sr.officeId,
        event: NOTIFICATION_EVENT.SERVICE_CREATED,
        relatedEntityType: 'ServiceRequest',
        relatedEntityId: sr._id,
        recipients: [{ channel: 'IN_APP', userId: sr.assignedTo, name: 'Service Staff' }],
        payload: { serviceId: sr._id, title: sr.title, priority: sr.priority },
      })
      .catch(() => null);
  }

  return sr;
}

async function listServiceRequests(query, organizationId, actor) {
  const { page, limit, skip } = getPagination(query);
  const sort = buildSort(query, ['createdAt', 'priority', 'status']);

  const filter = { organizationId };
  if (query.officeId) filter.officeId = query.officeId;
  if (query.category) filter.category = query.category;
  if (query.status) filter.status = query.status;
  if (query.assignedTo) filter.assignedTo = query.assignedTo;
  if (query.guestId) filter.guestId = query.guestId;

  if (actor && actor.role === ROLES.SERVICE_STAFF) {
    filter.assignedTo = actor._id;
  }

  if (query.fromDate || query.toDate) {
    filter.createdAt = {};
    if (query.fromDate) filter.createdAt.$gte = new Date(query.fromDate);
    if (query.toDate) filter.createdAt.$lte = new Date(query.toDate);
  }
  if (query.search) {
    const regex = buildSearchRegex(query.search);
    filter.$or = [{ title: regex }, { description: regex }];
  }

  const [items, total] = await Promise.all([
    ServiceRequest.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('assignedTo', 'name email')
      .populate('requestedBy', 'name email')
      .populate('guestId', 'fullName badgeNumber')
      .populate('officeId', 'name code')
      .lean(),
    ServiceRequest.countDocuments(filter),
  ]);

  return { items, meta: paginate(total, page, limit) };
}

async function getServiceRequestById(id, organizationId) {
  const sr = await ServiceRequest.findOne({ _id: id, organizationId })
    .populate('assignedTo', 'name email phone')
    .populate('requestedBy', 'name email')
    .populate('guestId', 'fullName badgeNumber phone')
    .populate('roomId', 'name code')
    .populate('officeId', 'name code city');
  if (!sr) throw ApiError.notFound('Service request not found');
  return sr;
}

async function updateServiceRequest(id, organizationId, payload) {
  if (payload.assignedTo) await ensureAssigneeValid(payload.assignedTo, organizationId);
  const sr = await ServiceRequest.findOneAndUpdate({ _id: id, organizationId }, payload, {
    new: true,
    runValidators: true,
  });
  if (!sr) throw ApiError.notFound('Service request not found');
  return sr;
}

async function assignServiceRequest(id, organizationId, assignedTo) {
  await ensureAssigneeValid(assignedTo, organizationId);
  const sr = await ServiceRequest.findOneAndUpdate(
    { _id: id, organizationId },
    { assignedTo },
    { new: true }
  );
  if (!sr) throw ApiError.notFound('Service request not found');

  notificationService
    .dispatch({
      organizationId,
      officeId: sr.officeId,
      event: NOTIFICATION_EVENT.SERVICE_UPDATED,
      relatedEntityType: 'ServiceRequest',
      relatedEntityId: sr._id,
      recipients: [{ channel: 'IN_APP', userId: assignedTo, name: 'Service Staff' }],
      payload: { serviceId: sr._id, title: sr.title, change: 'assigned' },
    })
    .catch(() => null);

  return sr;
}

async function updateStatus(id, organizationId, payload, actor) {
  const sr = await ServiceRequest.findOne({ _id: id, organizationId });
  if (!sr) throw ApiError.notFound('Service request not found');

  if (
    actor &&
    actor.role === ROLES.SERVICE_STAFF &&
    String(sr.assignedTo) !== String(actor._id)
  ) {
    throw ApiError.forbidden('You can only update requests assigned to you');
  }

  sr.status = payload.status;
  if (payload.notes) sr.notes = payload.notes;

  switch (payload.status) {
    case SERVICE_STATUS.IN_PROGRESS:
      sr.startedAt = sr.startedAt || new Date();
      break;
    case SERVICE_STATUS.COMPLETED:
      sr.completedAt = new Date();
      break;
    case SERVICE_STATUS.CANCELLED:
      sr.cancelledAt = new Date();
      sr.cancellationReason = payload.cancellationReason || 'Cancelled';
      break;
    default:
      break;
  }

  await sr.save();

  notificationService
    .dispatch({
      organizationId,
      officeId: sr.officeId,
      event: NOTIFICATION_EVENT.SERVICE_UPDATED,
      relatedEntityType: 'ServiceRequest',
      relatedEntityId: sr._id,
      recipients: [{ channel: 'IN_APP', userId: sr.requestedBy, name: 'Requester' }],
      payload: { serviceId: sr._id, title: sr.title, status: sr.status },
    })
    .catch(() => null);

  return sr;
}

module.exports = {
  createServiceRequest,
  listServiceRequests,
  getServiceRequestById,
  updateServiceRequest,
  assignServiceRequest,
  updateStatus,
};
