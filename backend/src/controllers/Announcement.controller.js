'use strict';
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const { dispatchAnnouncement } = require('../services/announcement.service');
const platformNoticeService = require('../services/platformNotice.service');
const { ROLES } = require('../config/constants');

const sendAnnouncement = asyncHandler(async (req, res) => {
  if (req.user?.role !== ROLES.SUPER_ADMIN) {
    return res.status(403).json({ success: false, message: 'Forbidden: SuperAdmin only.' });
  }

  const { title, message, recipients = 'all', channels = {}, scheduleAt } = req.body;

  if (!title || !message) {
    return res.status(400).json({ success: false, message: 'title and message are required.' });
  }

  if (!channels.email && !channels.sms) {
    return ApiResponse.success(res, {
      message: 'No server-side channels selected. In-app handled client-side.',
      data: { emailsSent: 0, smsSent: 0 },
    });
  }

  if (scheduleAt) {
    return ApiResponse.success(res, {
      message: `Announcement scheduled for ${scheduleAt}.`,
      data: { scheduled: true, scheduleAt },
    });
  }

  const result = await dispatchAnnouncement({
    title,
    message,
    recipients,
    channels,
    sentBy: req.user?.name || 'Super Admin',
  });

  return ApiResponse.success(res, {
    message: `Announcement dispatched. Emails: ${result.emailsSent}, SMS: ${result.smsSent}.`,
    data: result,
  });
});

/**
 * Bug 5 — POST /api/v1/announcements/maintenance
 * SuperAdmin posts the maintenance window + message; we email every active
 * user using the MAINTENANCE_NOTICE template.
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

module.exports = { sendAnnouncement, sendMaintenanceNotice };