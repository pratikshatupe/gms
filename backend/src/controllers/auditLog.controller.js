'use strict';

const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const auditLogService = require('../services/auditLog.service');

const create = asyncHandler(async (req, res) => {
  const log = await auditLogService.createLog({
    ...req.body,
    organizationId: req.tenant?.organizationId,
    actorId: req.user?._id,
    actorRole: req.user?.role,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });
  return ApiResponse.created(res, log, 'Audit log created');
});

const list = asyncHandler(async (req, res) => {
  const { items, meta } = await auditLogService.listLogs(req.query, req.tenant?.organizationId);
  return ApiResponse.success(res, { data: items, meta });
});

module.exports = { create, list };
