'use strict';

const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const userService = require('../services/user.service');

const create = asyncHandler(async (req, res) => {
  const result = await userService.createUser(req.body, req.tenant.organizationId, req.user);
  return ApiResponse.created(res, result, 'User created');
});

const list = asyncHandler(async (req, res) => {
  const { items, meta } = await userService.listUsers(req.query, req.tenant.organizationId);
  return ApiResponse.success(res, { data: items, meta });
});

const get = asyncHandler(async (req, res) => {
  const user = await userService.getUserById(req.params.id, req.tenant.organizationId);
  return ApiResponse.success(res, { data: user });
});

const update = asyncHandler(async (req, res) => {
  const user = await userService.updateUser(req.params.id, req.tenant.organizationId, req.body, req.user);
  return ApiResponse.success(res, { message: 'User updated', data: user });
});

const resetPassword = asyncHandler(async (req, res) => {
  await userService.resetUserPassword(req.params.id, req.tenant.organizationId, req.body.newPassword);
  return ApiResponse.success(res, { message: 'Password reset' });
});

const deactivate = asyncHandler(async (req, res) => {
  const user = await userService.deactivateUser(req.params.id, req.tenant.organizationId);
  return ApiResponse.success(res, { message: 'User deactivated', data: user });
});

const activate = asyncHandler(async (req, res) => {
  const user = await userService.activateUser(req.params.id, req.tenant.organizationId);
  return ApiResponse.success(res, { message: 'User activated', data: user });
});

module.exports = { create, list, get, update, resetPassword, deactivate, activate };
