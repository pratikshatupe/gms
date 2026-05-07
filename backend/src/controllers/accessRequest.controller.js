'use strict';

const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const accessRequestService = require('../services/accessRequest.service');

const create = asyncHandler(async (req, res) => {
  const item = await accessRequestService.createRequest(req.body);
  return ApiResponse.created(res, item, 'Access request submitted');
});

const list = asyncHandler(async (req, res) => {
  const { items, meta } = await accessRequestService.listRequests(req.query);
  return ApiResponse.success(res, { data: items, meta });
});

const updateStatus = asyncHandler(async (req, res) => {
  const item = await accessRequestService.updateStatus(
    req.params.id, req.body, req.user._id
  );
  return ApiResponse.success(res, { message: 'Status updated', data: item });
});

module.exports = { create, list, updateStatus };
