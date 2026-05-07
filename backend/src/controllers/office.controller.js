'use strict';

const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const officeService = require('../services/office.service');

const create = asyncHandler(async (req, res) => {
  const office = await officeService.createOffice(req.body, req.tenant.organizationId, req.user);
  return ApiResponse.created(res, office, 'Office created');
});

const list = asyncHandler(async (req, res) => {
  const { items, meta } = await officeService.listOffices(req.query, req.tenant.organizationId);
  return ApiResponse.success(res, { data: items, meta });
});

const get = asyncHandler(async (req, res) => {
  const office = await officeService.getOfficeById(req.params.id, req.tenant.organizationId);
  return ApiResponse.success(res, { data: office });
});

const update = asyncHandler(async (req, res) => {
  const office = await officeService.updateOffice(req.params.id, req.tenant.organizationId, req.body);
  return ApiResponse.success(res, { message: 'Office updated', data: office });
});

const deactivate = asyncHandler(async (req, res) => {
  const office = await officeService.deactivateOffice(req.params.id, req.tenant.organizationId);
  return ApiResponse.success(res, { message: 'Office deactivated', data: office });
});

module.exports = { create, list, get, update, deactivate };
