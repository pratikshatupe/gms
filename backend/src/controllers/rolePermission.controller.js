'use strict';

const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const rolePermissionService = require('../services/rolePermission.service');

const get = asyncHandler(async (req, res) => {
  const data = await rolePermissionService.getPermissions(req.tenant.organizationId);
  return ApiResponse.success(res, { data });
});

const update = asyncHandler(async (req, res) => {
  const { role, permissions } = req.body;
  const data = await rolePermissionService.setPermissions(
    req.tenant.organizationId, role, permissions, req.user._id
  );
  return ApiResponse.success(res, { message: 'Permissions updated', data });
});

const updateAll = asyncHandler(async (req, res) => {
  const data = await rolePermissionService.setAllPermissions(
    req.tenant.organizationId, req.body.matrix, req.user._id
  );
  return ApiResponse.success(res, { message: 'All permissions updated', data });
});

module.exports = { get, update, updateAll };
