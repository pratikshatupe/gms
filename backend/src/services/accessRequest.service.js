'use strict';

const AccessRequest = require('../models/AccessRequest');
const ApiError = require('../utils/ApiError');
const { getPagination, buildSort, paginate } = require('../utils/pagination');

async function createRequest(payload) {
  return AccessRequest.create(payload);
}

async function listRequests(query) {
  const { page, limit, skip } = getPagination(query);
  const sort = buildSort(query, ['createdAt', 'status']);
  const filter = {};
  if (query.status) filter.status = query.status;
  const [items, total] = await Promise.all([
    AccessRequest.find(filter).sort(sort).skip(skip).limit(limit)
      .populate('reviewedBy', 'name email').lean(),
    AccessRequest.countDocuments(filter),
  ]);
  return { items, meta: paginate(total, page, limit) };
}

async function updateStatus(id, { status, reviewNote }, actorId) {
  const request = await AccessRequest.findById(id);
  if (!request) throw ApiError.notFound('Access request not found');
  request.status = status;
  request.reviewNote = reviewNote;
  request.reviewedBy = actorId;
  request.reviewedAt = new Date();
  await request.save();
  return request;
}

module.exports = { createRequest, listRequests, updateStatus };
