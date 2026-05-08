'use strict';

const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const announcementService = require('../services/announcement.service');
const platformNoticeService = require('../services/platformNotice.service');
const { ROLES } = require('../config/constants');

/**
 * POST /api/v1/announcements
 * Super Admin only. Persist the announcement, fan it out to per-user
 * notification rows, and dispatch emails when channels.email is true.
 */
const create = asyncHandler(async (req, res) => {
  const result = await announcementService.createAnnouncement(req.body, req.user);
  const sentTo = result.summary.totalRecipients;
  return ApiResponse.success(res, {
    message: `Announcement sent to ${sentTo} user${sentTo === 1 ? '' : 's'}.`,
    data: result.announcement,
    summary: result.summary,
  });
});

/**
 * GET /api/v1/announcements/my
 * Any authenticated user. Returns announcements visible to the caller
 * with their own read/dismissed flags. Already-dismissed rows excluded
 * unless ?includeDismissed=true.
 */
const listMine = asyncHandler(async (req, res) => {
  const includeDismissed = String(req.query.includeDismissed || '').toLowerCase() === 'true';
  const data = await announcementService.listForUser(req.user, { includeDismissed });
  return ApiResponse.success(res, { data });
});

/**
 * GET /api/v1/announcements
 * Super Admin only. Full announcement log + delivery summaries.
 */
const listAll = asyncHandler(async (req, res) => {
  if (req.user?.role !== ROLES.SUPER_ADMIN) {
    return res.status(403).json({ success: false, message: 'Forbidden: SuperAdmin only.' });
  }
  const data = await announcementService.listAllForSuperAdmin(req.query);
  return ApiResponse.success(res, { data });
});

/**
 * PATCH /api/v1/announcements/:id/dismiss
 * Any authenticated user — dismisses the announcement for THIS user
 * only. Does not delete the underlying Announcement document.
 */
const dismiss = asyncHandler(async (req, res) => {
  await announcementService.dismissForUser(req.params.id, req.user);
  return ApiResponse.success(res, { message: 'Announcement dismissed.' });
});

const markRead = asyncHandler(async (req, res) => {
  await announcementService.markReadForUser(req.params.id, req.user);
  return ApiResponse.success(res, { message: 'Announcement marked as read.' });
});

/**
 * DELETE /api/v1/announcements/:id
 * Super Admin only. Removes the announcement globally — every user's
 * notification feed is cleared via cascade on UserAnnouncement.
 */
const remove = asyncHandler(async (req, res) => {
  await announcementService.deleteAnnouncementGlobal(req.params.id, req.user);
  return ApiResponse.success(res, { message: 'Announcement deleted globally.' });
});

/**
 * POST /api/v1/announcements/maintenance — kept from the previous
 * implementation so existing flows keep working.
 */
const sendMaintenanceNotice = asyncHandler(async (req, res) => {
  if (req.user?.role !== ROLES.SUPER_ADMIN) {
    return res.status(403).json({ success: false, message: 'Forbidden: SuperAdmin only.' });
  }
  const { message, startAt, endAt, audience = 'all' } = req.body || {};
  if (!message) return res.status(400).json({ success: false, message: 'message is required.' });
  const result = await platformNoticeService.sendMaintenanceNotice({ message, startAt, endAt, audience });
  return ApiResponse.success(res, {
    message: `Maintenance notice dispatched to ${result.sent} of ${result.totalUsers} users.`,
    data: result,
  });
});

module.exports = {
  create,
  listMine,
  listAll,
  dismiss,
  markRead,
  remove,
  sendMaintenanceNotice,
  /* Backwards-compat alias for older routes that referenced this name. */
  sendAnnouncement: create,
};
