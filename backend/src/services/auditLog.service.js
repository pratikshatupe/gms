'use strict';

const AuditLog = require('../models/AuditLog');
const { getPagination, buildSort, paginate } = require('../utils/pagination');

async function createLog({ organizationId, actorId, actorRole, action, entityType, entityId, metadata, ipAddress, userAgent }) {
  return AuditLog.create({ organizationId, actorId, actorRole, action, entityType, entityId, metadata, ipAddress, userAgent });
}

async function listLogs(query, organizationId) {
  const { page, limit, skip } = getPagination(query);
  const sort = buildSort(query, ['createdAt', 'action']);
  const filter = {};
  if (organizationId) filter.organizationId = organizationId;
  if (query.action) filter.action = query.action;
  if (query.actorRole) filter.actorRole = query.actorRole;
  if (query.entityType) filter.entityType = query.entityType;
  if (query.fromDate || query.toDate) {
    filter.createdAt = {};
    if (query.fromDate) filter.createdAt.$gte = new Date(query.fromDate);
    if (query.toDate) filter.createdAt.$lte = new Date(query.toDate);
  }
  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort(sort).skip(skip).limit(limit)
      .populate('actorId', 'name email role').lean(),
    AuditLog.countDocuments(filter),
  ]);
  return { items, meta: paginate(total, page, limit) };
}

module.exports = { createLog, listLogs };
