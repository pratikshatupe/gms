'use strict';

const Room = require('../models/Room');
const Appointment = require('../models/Appointment');
const Office = require('../models/Office');
const ApiError = require('../utils/ApiError');
const { getPagination, buildSort, paginate } = require('../utils/pagination');
const { buildSearchRegex } = require('../utils/helpers');
const { APPOINTMENT_STATUS, ROOM_STATUS } = require('../config/constants');

async function ensureOfficeBelongsToOrg(officeId, organizationId) {
  const office = await Office.findOne({ _id: officeId, organizationId });
  if (!office) throw ApiError.badRequest('Office does not belong to your organization');
  return office;
}

async function createRoom(payload, organizationId, actor) {
  await ensureOfficeBelongsToOrg(payload.officeId, organizationId);

  const exists = await Room.findOne({
    organizationId,
    officeId: payload.officeId,
    name: payload.name,
  });
  if (exists) throw ApiError.conflict('Room name already exists in this office');

  return Room.create({
    ...payload,
    organizationId,
    createdBy: actor ? actor._id : undefined,
  });
}

async function listRooms(query, organizationId) {
  const { page, limit, skip } = getPagination(query);
  const sort = buildSort(query, ['name', 'capacity', 'type', 'status', 'createdAt']);

  const filter = { organizationId };
  if (query.officeId) filter.officeId = query.officeId;
  if (query.type) filter.type = query.type;
  if (query.status) filter.status = query.status;
  if (typeof query.isActive === 'boolean') filter.isActive = query.isActive;
  if (query.minCapacity) filter.capacity = { $gte: query.minCapacity };
  if (query.search) {
    const regex = buildSearchRegex(query.search);
    filter.$or = [{ name: regex }, { code: regex }, { location: regex }];
  }

  const [items, total] = await Promise.all([
    Room.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    Room.countDocuments(filter),
  ]);

  return { items, meta: paginate(total, page, limit) };
}

async function getRoomById(id, organizationId) {
  const room = await Room.findOne({ _id: id, organizationId });
  if (!room) throw ApiError.notFound('Room not found');
  return room;
}

async function updateRoom(id, organizationId, payload) {
  const room = await Room.findOneAndUpdate({ _id: id, organizationId }, payload, {
    new: true,
    runValidators: true,
  });
  if (!room) throw ApiError.notFound('Room not found');
  return room;
}

async function updateRoomStatus(id, organizationId, status) {
  return updateRoom(id, organizationId, { status });
}

async function deleteRoom(id, organizationId) {
  const room = await Room.findOneAndUpdate(
    { _id: id, organizationId },
    { isActive: false, status: ROOM_STATUS.MAINTENANCE },
    { new: true }
  );
  if (!room) throw ApiError.notFound('Room not found');
  return room;
}

async function getAvailability(query, organizationId) {
  const { officeId, fromDate, toDate, minCapacity } = query;
  const from = new Date(fromDate);
  const to = new Date(toDate);

  const roomFilter = {
    organizationId,
    officeId,
    isActive: true,
    status: { $ne: ROOM_STATUS.MAINTENANCE },
  };
  if (minCapacity) roomFilter.capacity = { $gte: minCapacity };

  const rooms = await Room.find(roomFilter).lean();
  if (!rooms.length) return [];

  const roomIds = rooms.map((r) => r._id);
  const conflicts = await Appointment.find({
    organizationId,
    officeId,
    roomId: { $in: roomIds },
    status: { $nin: [APPOINTMENT_STATUS.CANCELLED, APPOINTMENT_STATUS.COMPLETED, APPOINTMENT_STATUS.NO_SHOW] },
    scheduledAt: { $lt: to },
    endsAt: { $gt: from },
  }).select('roomId scheduledAt endsAt status').lean();

  const conflictMap = conflicts.reduce((acc, c) => {
    const key = String(c.roomId);
    if (!acc[key]) acc[key] = [];
    acc[key].push({ from: c.scheduledAt, to: c.endsAt, status: c.status });
    return acc;
  }, {});

  return rooms.map((r) => ({
    ...r,
    isAvailable: !conflictMap[String(r._id)],
    conflicts: conflictMap[String(r._id)] || [],
  }));
}

module.exports = {
  createRoom,
  listRooms,
  getRoomById,
  updateRoom,
  updateRoomStatus,
  deleteRoom,
  getAvailability,
};
