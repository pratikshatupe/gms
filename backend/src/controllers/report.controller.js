'use strict';

const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const reportService = require('../services/report.service');

const dashboard = asyncHandler(async (req, res) => {
  const data = await reportService.dashboard(req.tenant.organizationId, req.query.officeId);
  return ApiResponse.success(res, { data });
});

const visitors = asyncHandler(async (req, res) => {
  const data = await reportService.visitorReport(req.query, req.tenant.organizationId);
  return ApiResponse.success(res, { data });
});

const offices = asyncHandler(async (req, res) => {
  const data = await reportService.officeReport(req.query, req.tenant.organizationId);
  return ApiResponse.success(res, { data });
});

const duration = asyncHandler(async (req, res) => {
  const data = await reportService.durationReport(req.query, req.tenant.organizationId);
  return ApiResponse.success(res, { data });
});

const services = asyncHandler(async (req, res) => {
  const data = await reportService.serviceReport(req.query, req.tenant.organizationId);
  return ApiResponse.success(res, { data });
});

const noShow = asyncHandler(async (req, res) => {
  const data = await reportService.noShowReport(req.query, req.tenant.organizationId);
  return ApiResponse.success(res, { data });
});

const peakHours = asyncHandler(async (req, res) => {
  const data = await reportService.peakHoursReport(req.query, req.tenant.organizationId);
  return ApiResponse.success(res, { data });
});

const roomUtilization = asyncHandler(async (req, res) => {
  const data = await reportService.roomUtilizationReport(req.query, req.tenant.organizationId);
  return ApiResponse.success(res, { data });
});

module.exports = { dashboard, visitors, offices, duration, services, noShow, peakHours, roomUtilization };
