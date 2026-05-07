'use strict';

const mongoose = require('mongoose');
const Guest = require('../models/Guest');
const Appointment = require('../models/Appointment');
const ServiceRequest = require('../models/ServiceRequest');
const Office = require('../models/Office');
const Room = require('../models/Room');
const { GUEST_STATUS, GUEST_TYPE, APPOINTMENT_STATUS, SERVICE_STATUS } = require('../config/constants');

function dateRange(query) {
  const to = query.toDate ? new Date(query.toDate) : new Date();
  const from = query.fromDate
    ? new Date(query.fromDate)
    : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { from, to };
}

async function dashboard(organizationId, officeId) {
  const orgId = new mongoose.Types.ObjectId(organizationId);
  const baseGuest = { organizationId: orgId };
  const baseAppt = { organizationId: orgId };
  const baseSr = { organizationId: orgId };
  if (officeId) {
    baseGuest.officeId = new mongoose.Types.ObjectId(officeId);
    baseAppt.officeId = new mongoose.Types.ObjectId(officeId);
    baseSr.officeId = new mongoose.Types.ObjectId(officeId);
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const todayGuestFilter = { ...baseGuest, createdAt: { $gte: startOfDay, $lte: endOfDay } };

  const [
    totalToday,
    currentlyInside,
    walkInsToday,
    upcomingAppointments,
    pendingServices,
    activeRooms,
    totalRooms,
  ] = await Promise.all([
    Guest.countDocuments(todayGuestFilter),
    Guest.countDocuments({ ...baseGuest, status: GUEST_STATUS.CHECKED_IN }),
    Guest.countDocuments({ ...todayGuestFilter, type: GUEST_TYPE.WALK_IN }),
    Appointment.countDocuments({
      ...baseAppt,
      status: { $in: [APPOINTMENT_STATUS.SCHEDULED, APPOINTMENT_STATUS.CONFIRMED] },
      scheduledAt: { $gte: new Date(), $lte: endOfDay },
    }),
    ServiceRequest.countDocuments({
      ...baseSr,
      status: { $in: [SERVICE_STATUS.PENDING, SERVICE_STATUS.IN_PROGRESS] },
    }),
    Room.countDocuments({ organizationId: orgId, ...(officeId ? { officeId: new mongoose.Types.ObjectId(officeId) } : {}), status: 'OCCUPIED' }),
    Room.countDocuments({ organizationId: orgId, ...(officeId ? { officeId: new mongoose.Types.ObjectId(officeId) } : {}), isActive: true }),
  ]);

  return {
    totalToday,
    currentlyInside,
    walkInsToday,
    upcomingAppointments,
    pendingServices,
    rooms: { active: activeRooms, total: totalRooms },
  };
}

async function visitorReport(query, organizationId) {
  const { from, to } = dateRange(query);
  const orgId = new mongoose.Types.ObjectId(organizationId);

  const match = { organizationId: orgId, createdAt: { $gte: from, $lte: to } };
  if (query.officeId) match.officeId = new mongoose.Types.ObjectId(query.officeId);

  const [byDay, byType, byStatus, topHosts, topCompanies] = await Promise.all([
    Guest.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          total: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Guest.aggregate([
      { $match: match },
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]),
    Guest.aggregate([
      { $match: match },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Guest.aggregate([
      { $match: { ...match, hostUserId: { $ne: null } } },
      { $group: { _id: '$hostUserId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'host' } },
      { $unwind: { path: '$host', preserveNullAndEmptyArrays: true } },
      { $project: { _id: 1, count: 1, name: '$host.name', email: '$host.email' } },
    ]),
    Guest.aggregate([
      { $match: { ...match, company: { $ne: null, $ne: '' } } },
      { $group: { _id: '$company', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
  ]);

  return { range: { from, to }, byDay, byType, byStatus, topHosts, topCompanies };
}

async function officeReport(query, organizationId) {
  const { from, to } = dateRange(query);
  const orgId = new mongoose.Types.ObjectId(organizationId);

  const offices = await Office.find({ organizationId: orgId, isActive: true }).lean();

  const counts = await Guest.aggregate([
    { $match: { organizationId: orgId, createdAt: { $gte: from, $lte: to } } },
    { $group: { _id: '$officeId', total: { $sum: 1 } } },
  ]);

  const map = counts.reduce((acc, c) => ({ ...acc, [String(c._id)]: c.total }), {});

  return {
    range: { from, to },
    offices: offices.map((o) => ({
      _id: o._id,
      name: o.name,
      code: o.code,
      city: o.city,
      country: o.country,
      visitors: map[String(o._id)] || 0,
    })),
  };
}

async function durationReport(query, organizationId) {
  const { from, to } = dateRange(query);
  const orgId = new mongoose.Types.ObjectId(organizationId);

  const match = {
    organizationId: orgId,
    status: GUEST_STATUS.CHECKED_OUT,
    checkedInAt: { $ne: null },
    checkedOutAt: { $ne: null },
    createdAt: { $gte: from, $lte: to },
  };
  if (query.officeId) match.officeId = new mongoose.Types.ObjectId(query.officeId);

  const result = await Guest.aggregate([
    { $match: match },
    {
      $project: {
        durationMinutes: {
          $divide: [{ $subtract: ['$checkedOutAt', '$checkedInAt'] }, 1000 * 60],
        },
      },
    },
    {
      $group: {
        _id: null,
        avg: { $avg: '$durationMinutes' },
        min: { $min: '$durationMinutes' },
        max: { $max: '$durationMinutes' },
        count: { $sum: 1 },
      },
    },
  ]);

  const stats = result[0] || { avg: 0, min: 0, max: 0, count: 0 };
  return { range: { from, to }, ...stats };
}

async function serviceReport(query, organizationId) {
  const { from, to } = dateRange(query);
  const orgId = new mongoose.Types.ObjectId(organizationId);

  const match = { organizationId: orgId, createdAt: { $gte: from, $lte: to } };
  if (query.officeId) match.officeId = new mongoose.Types.ObjectId(query.officeId);

  const [byCategory, byStatus, avgResponseTime] = await Promise.all([
    ServiceRequest.aggregate([
      { $match: match },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]),
    ServiceRequest.aggregate([
      { $match: match },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    ServiceRequest.aggregate([
      { $match: { ...match, completedAt: { $ne: null } } },
      {
        $project: {
          minutes: {
            $divide: [{ $subtract: ['$completedAt', '$createdAt'] }, 1000 * 60],
          },
        },
      },
      { $group: { _id: null, avgMinutes: { $avg: '$minutes' }, count: { $sum: 1 } } },
    ]),
  ]);

  return {
    range: { from, to },
    byCategory,
    byStatus,
    avgResponseTime: avgResponseTime[0] || { avgMinutes: 0, count: 0 },
  };
}

async function noShowReport(query, organizationId) {
  const { from, to } = dateRange(query);
  const orgId = new mongoose.Types.ObjectId(organizationId);

  const match = { organizationId: orgId, scheduledAt: { $gte: from, $lte: to } };
  if (query.officeId) match.officeId = new mongoose.Types.ObjectId(query.officeId);

  const [noShows, cancellations, completed, total] = await Promise.all([
    Appointment.countDocuments({ ...match, status: APPOINTMENT_STATUS.NO_SHOW }),
    Appointment.countDocuments({ ...match, status: APPOINTMENT_STATUS.CANCELLED }),
    Appointment.countDocuments({ ...match, status: APPOINTMENT_STATUS.COMPLETED }),
    Appointment.countDocuments(match),
  ]);

  return { range: { from, to }, total, noShows, cancellations, completed };
}

async function peakHoursReport(query, organizationId) {
  const { from, to } = dateRange(query);
  const orgId = new mongoose.Types.ObjectId(organizationId);
  const match = { organizationId: orgId, checkedInAt: { $ne: null }, createdAt: { $gte: from, $lte: to } };
  if (query.officeId) match.officeId = new mongoose.Types.ObjectId(query.officeId);

  const [byHour, byDayOfWeek] = await Promise.all([
    Guest.aggregate([
      { $match: match },
      { $group: { _id: { $hour: '$checkedInAt' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      { $project: { hour: '$_id', count: 1, _id: 0 } },
    ]),
    Guest.aggregate([
      { $match: match },
      { $group: { _id: { $dayOfWeek: '$checkedInAt' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      { $project: { dayOfWeek: '$_id', count: 1, _id: 0 } },
    ]),
  ]);

  return { range: { from, to }, byHour, byDayOfWeek };
}

async function roomUtilizationReport(query, organizationId) {
  const { from, to } = dateRange(query);
  const orgId = new mongoose.Types.ObjectId(organizationId);

  const rooms = await Room.find({
    organizationId: orgId,
    isActive: true,
    ...(query.officeId ? { officeId: new mongoose.Types.ObjectId(query.officeId) } : {}),
  }).lean();

  const bookings = await Appointment.aggregate([
    {
      $match: {
        organizationId: orgId,
        roomId: { $ne: null },
        scheduledAt: { $gte: from, $lte: to },
        status: { $nin: ['CANCELLED'] },
      },
    },
    {
      $group: {
        _id: '$roomId',
        totalBookings: { $sum: 1 },
        totalMinutes: { $sum: '$durationMinutes' },
      },
    },
  ]);

  const bookingMap = bookings.reduce((acc, b) => {
    acc[String(b._id)] = b;
    return acc;
  }, {});

  const totalDays = Math.max(1, Math.ceil((to - from) / (1000 * 60 * 60 * 24)));
  const workingHoursPerDay = 8;
  const availableMinutesPerRoom = totalDays * workingHoursPerDay * 60;

  return {
    range: { from, to },
    rooms: rooms.map((r) => {
      const b = bookingMap[String(r._id)] || { totalBookings: 0, totalMinutes: 0 };
      const utilizationPct = availableMinutesPerRoom > 0
        ? Math.round((b.totalMinutes / availableMinutesPerRoom) * 100)
        : 0;
      return {
        _id: r._id,
        name: r.name,
        code: r.code,
        type: r.type,
        capacity: r.capacity,
        officeId: r.officeId,
        totalBookings: b.totalBookings,
        totalMinutes: b.totalMinutes,
        utilizationPct,
      };
    }),
  };
}

module.exports = {
  dashboard,
  visitorReport,
  officeReport,
  durationReport,
  serviceReport,
  noShowReport,
  peakHoursReport,
  roomUtilizationReport,
};
