'use strict';

const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const roomService = require('../services/room.service');

const create = asyncHandler(async (req, res) => {
  const room = await roomService.createRoom(req.body, req.tenant.organizationId, req.user);
  return ApiResponse.created(res, room, 'Room created');
});

const list = asyncHandler(async (req, res) => {
  const { items, meta } = await roomService.listRooms(req.query, req.tenant.organizationId);
  return ApiResponse.success(res, { data: items, meta });
});

const get = asyncHandler(async (req, res) => {
  const room = await roomService.getRoomById(req.params.id, req.tenant.organizationId);
  return ApiResponse.success(res, { data: room });
});

const update = asyncHandler(async (req, res) => {
  const room = await roomService.updateRoom(req.params.id, req.tenant.organizationId, req.body);
  return ApiResponse.success(res, { message: 'Room updated', data: room });
});

const updateStatus = asyncHandler(async (req, res) => {
  const room = await roomService.updateRoomStatus(req.params.id, req.tenant.organizationId, req.body.status);
  return ApiResponse.success(res, { message: 'Room status updated', data: room });
});

const remove = asyncHandler(async (req, res) => {
  const room = await roomService.deleteRoom(req.params.id, req.tenant.organizationId);
  return ApiResponse.success(res, { message: 'Room removed', data: room });
});

const availability = asyncHandler(async (req, res) => {
  const data = await roomService.getAvailability(req.query, req.tenant.organizationId);
  return ApiResponse.success(res, { data });
});

module.exports = { create, list, get, update, updateStatus, remove, availability };
