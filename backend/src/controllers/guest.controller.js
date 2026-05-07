'use strict';

const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const guestService = require('../services/guest.service');

const checkIn = asyncHandler(async (req, res) => {
  const guest = await guestService.checkInGuest(req.body, req.tenant.organizationId, req.user);
  return ApiResponse.created(res, guest, 'Guest checked in');
});

const list = asyncHandler(async (req, res) => {
  const { items, meta } = await guestService.listGuests(req.query, req.tenant.organizationId);
  return ApiResponse.success(res, { data: items, meta });
});

const get = asyncHandler(async (req, res) => {
  const guest = await guestService.getGuestById(req.params.id, req.tenant.organizationId);
  return ApiResponse.success(res, { data: guest });
});

const update = asyncHandler(async (req, res) => {
  const guest = await guestService.updateGuest(req.params.id, req.tenant.organizationId, req.body);
  return ApiResponse.success(res, { message: 'Guest updated', data: guest });
});

const checkOut = asyncHandler(async (req, res) => {
  const guest = await guestService.checkOutGuest(req.params.id, req.tenant.organizationId, req.user);
  return ApiResponse.success(res, { message: 'Guest checked out', data: guest });
});

const verifyId = asyncHandler(async (req, res) => {
  const guest = await guestService.verifyGuestId(req.params.id, req.tenant.organizationId, req.body, req.user);
  return ApiResponse.success(res, { message: 'ID verified', data: guest });
});

const active = asyncHandler(async (req, res) => {
  const items = await guestService.getActiveGuests(req.tenant.organizationId, req.query.officeId);
  return ApiResponse.success(res, { data: items });
});

const dailyStats = asyncHandler(async (req, res) => {
  const data = await guestService.getDailyStats(
    req.tenant.organizationId,
    req.query.officeId,
    req.query.date
  );
  return ApiResponse.success(res, { data });
});

module.exports = { checkIn, list, get, update, checkOut, verifyId, active, dailyStats };
