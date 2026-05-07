'use strict';

const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const planService = require('../services/plan.service');

/**
 * Public GET /api/v1/plans — used by the Landing page Registration modal
 * to populate the "Choose Plan" step. Returns features, limits and
 * description so the frontend can render a full detail panel without
 * a second round-trip per plan.
 */
const list = asyncHandler(async (_req, res) => {
  const data = await planService.listPlans();
  return ApiResponse.success(res, { data });
});

const get = asyncHandler(async (req, res) => {
  const data = await planService.getPlanById(req.params.id);
  return ApiResponse.success(res, { data });
});

const create = asyncHandler(async (req, res) => {
  const data = await planService.createPlan(req.body, req.user);
  return ApiResponse.created(res, data, 'Plan created');
});

const update = asyncHandler(async (req, res) => {
  const data = await planService.updatePlan(req.params.id, req.body);
  return ApiResponse.success(res, { message: 'Plan updated', data });
});

const archive = asyncHandler(async (req, res) => {
  const data = await planService.archivePlan(req.params.id);
  return ApiResponse.success(res, { message: 'Plan archived', data });
});

module.exports = { list, get, create, update, archive };
