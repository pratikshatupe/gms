'use strict';

const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const organizationService = require('../services/organization.service');

const create = asyncHandler(async (req, res) => {
  const org = await organizationService.createOrganization(req.body, req.user);
  return ApiResponse.created(res, org, 'Organization created');
});

const createWithDirector = asyncHandler(async (req, res) => {
  const result = await organizationService.createOrganizationWithDirector(req.body, req.user);
  return ApiResponse.created(res, result, 'Organization and director created');
});

const list = asyncHandler(async (req, res) => {
  const { items, meta } = await organizationService.listOrganizations(req.query);
  return ApiResponse.success(res, { data: items, meta });
});

const get = asyncHandler(async (req, res) => {
  const org = await organizationService.getOrganizationById(req.params.id);
  return ApiResponse.success(res, { data: org });
});

const update = asyncHandler(async (req, res) => {
  const org = await organizationService.updateOrganization(req.params.id, req.body);
  return ApiResponse.success(res, { message: 'Organization updated', data: org });
});

const deactivate = asyncHandler(async (req, res) => {
  const org = await organizationService.deactivateOrganization(req.params.id);
  return ApiResponse.success(res, { message: 'Organization deactivated', data: org });
});

const stats = asyncHandler(async (req, res) => {
  const data = await organizationService.getStats(req.params.id);
  return ApiResponse.success(res, { data });
});

module.exports = { create, createWithDirector, list, get, update, deactivate, stats };
