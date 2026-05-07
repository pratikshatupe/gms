'use strict';

const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const serviceRequestService = require('../services/serviceRequest.service');

const create = asyncHandler(async (req, res) => {
  const sr = await serviceRequestService.createServiceRequest(
    req.body,
    req.tenant.organizationId,
    req.user
  );
  return ApiResponse.created(res, sr, 'Service request created');
});

const list = asyncHandler(async (req, res) => {
  const { items, meta } = await serviceRequestService.listServiceRequests(
    req.query,
    req.tenant.organizationId,
    req.user
  );
  return ApiResponse.success(res, { data: items, meta });
});

const get = asyncHandler(async (req, res) => {
  const sr = await serviceRequestService.getServiceRequestById(req.params.id, req.tenant.organizationId);
  return ApiResponse.success(res, { data: sr });
});

const update = asyncHandler(async (req, res) => {
  const sr = await serviceRequestService.updateServiceRequest(
    req.params.id,
    req.tenant.organizationId,
    req.body
  );
  return ApiResponse.success(res, { message: 'Service request updated', data: sr });
});

const assign = asyncHandler(async (req, res) => {
  const sr = await serviceRequestService.assignServiceRequest(
    req.params.id,
    req.tenant.organizationId,
    req.body.assignedTo
  );
  return ApiResponse.success(res, { message: 'Service request assigned', data: sr });
});

const updateStatus = asyncHandler(async (req, res) => {
  const sr = await serviceRequestService.updateStatus(
    req.params.id,
    req.tenant.organizationId,
    req.body,
    req.user
  );
  return ApiResponse.success(res, { message: 'Status updated', data: sr });
});

module.exports = { create, list, get, update, assign, updateStatus };
