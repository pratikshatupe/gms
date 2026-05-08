'use strict';

const mongoose = require('mongoose');

const Announcement = require('../models/Announcement');
const UserAnnouncement = require('../models/UserAnnouncement');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const env = require('../config/env');
const logger = require('../config/logger');
const { ROLES } = require('../config/constants');
const { normaliseRole } = require('../middlewares/role.middleware');
const notificationService = require('./notification.service');
const emailTemplates = require('../templates/email.templates');

/* Canonical Super Admin key — matches the form `normaliseRole` produces.
 * Comparing against this lets us accept every legitimate spelling of the
 * Super Admin role (`SUPER_ADMIN`, `superadmin`, `super-admin`, `SuperAdmin`)
 * without diverging from the single source of truth in `config/constants`. */
const SUPER_ADMIN_KEY = normaliseRole(ROLES.SUPER_ADMIN);
const isSuperAdminRole = (role) => normaliseRole(role) === SUPER_ADMIN_KEY;

/**
 * Resolve the recipient spec down to a list of User documents the
 * announcement should be delivered to.
 *
 * Spec shape:
 *   { type: 'all_organisations' | 'organisation' | 'role' | 'specific_users',
 *     organisationIds?: [ObjectId], roles?: [String], userIds?: [ObjectId] }
 */
async function resolveRecipientUsers(spec = {}) {
  const filter = { isActive: true };
  const type = spec.type || 'all_organisations';

  if (type === 'organisation') {
    if (!Array.isArray(spec.organisationIds) || spec.organisationIds.length === 0) {
      throw ApiError.badRequest('organisationIds are required when recipients.type is "organisation".');
    }
    filter.organizationId = { $in: spec.organisationIds };
  } else if (type === 'role') {
    if (!Array.isArray(spec.roles) || spec.roles.length === 0) {
      throw ApiError.badRequest('roles are required when recipients.type is "role".');
    }
    filter.role = { $in: spec.roles };
  } else if (type === 'specific_users') {
    if (!Array.isArray(spec.userIds) || spec.userIds.length === 0) {
      throw ApiError.badRequest('userIds are required when recipients.type is "specific_users".');
    }
    filter._id = { $in: spec.userIds };
  } else {
    /* 'all_organisations' — every active user except Super Admins. */
    filter.role = { $ne: ROLES.SUPER_ADMIN };
  }

  return User.find(filter).select('_id name email role organizationId').lean();
}

/* Send the announcement email to a single user; failures are caught so
 * the caller can mark the per-user delivery row without aborting the
 * whole batch. */
async function sendOneAnnouncementEmail(announcement, user) {
  if (!user.email) return { ok: false, error: 'no email on user record' };
  try {
    const tpl = emailTemplates.ANNOUNCEMENT({
      title:         announcement.title,
      body:          announcement.body,
      type:          announcement.type,
      sender:        announcement.createdByName || 'Administrator',
      orgName:       env.smtp.fromName || 'CorpGMS',
      loginUrl:      env.clientUrl,
      recipientName: user.name || '',
    });
    const result = await notificationService.sendEmail({
      to: user.email,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
    });
    if (result && result.skipped) return { ok: false, error: result.reason || 'email skipped' };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message || 'email failed' };
  }
}

/**
 * Create + dispatch an announcement.
 *   - Persists the parent Announcement document.
 *   - Resolves recipients and inserts one UserAnnouncement row per user.
 *   - When channels.email is true, sends emails sequentially via the
 *     existing nodemailer-backed notification.service.sendEmail.
 *   - SMS is intentionally never sent (Phase 1: not implemented).
 *   - Schedule-for-later is rejected at the API contract level.
 *
 * Returns { announcement, summary } so the caller can show delivery
 * counts in the UI.
 */
async function createAnnouncement(payload, sender) {
  if (!sender) throw ApiError.unauthorized('Authentication required');
  if (!isSuperAdminRole(sender.role)) {
    throw ApiError.forbidden('Only Super Admin can send announcements.');
  }

  const title = (payload.title || '').trim();
  const body  = (payload.body || payload.message || '').trim();
  if (!title) throw ApiError.badRequest('Title is required.');
  if (!body)  throw ApiError.badRequest('Message is required.');
  if (title.length > 200)  throw ApiError.badRequest('Title must be 200 characters or fewer.');
  if (body.length  > 5000) throw ApiError.badRequest('Message must be 5000 characters or fewer.');

  const recipientsSpec = payload.recipients || { type: 'all_organisations' };
  const channels = {
    inApp: payload.channels?.inApp !== false,
    email: payload.channels?.email === true,
    sms:   payload.channels?.sms   === true, /* persisted for audit, never delivered */
  };
  const schedule = {
    sendNow:     payload.schedule?.sendNow !== false,
    scheduledAt: payload.schedule?.scheduledAt || null,
  };

  /* Phase 1 limitations enforced server-side too, so this contract
   * holds even if a future client forgets to disable the UI controls. */
  if (!schedule.sendNow || schedule.scheduledAt) {
    throw ApiError.badRequest(
      'Scheduled announcements are not yet supported. Set schedule.sendNow = true.'
    );
  }

  const users = await resolveRecipientUsers(recipientsSpec);

  const announcement = await Announcement.create({
    title,
    body,
    type:     payload.type || 'info',
    recipients: {
      type:            recipientsSpec.type || 'all_organisations',
      organisationIds: Array.isArray(recipientsSpec.organisationIds) ? recipientsSpec.organisationIds : [],
      roles:           Array.isArray(recipientsSpec.roles)           ? recipientsSpec.roles           : [],
      userIds:         Array.isArray(recipientsSpec.userIds)         ? recipientsSpec.userIds         : [],
    },
    channels,
    schedule: { sendNow: true, scheduledAt: null },
    status:   'sent',
    createdBy: sender._id,
    createdByName: sender.name || sender.email || 'Super Admin',
  });

  /* Per-user state rows. ordered:false so a single duplicate or bad row
   * doesn't poison the rest of the batch. */
  if (users.length > 0) {
    const rows = users.map((u) => ({
      announcementId: announcement._id,
      userId:         u._id,
      organisationId: u.organizationId || null,
      read: false,
      dismissed: false,
      deliveredEmail: false,
      emailStatus: channels.email ? 'sent' : 'not_selected',
    }));
    try {
      await UserAnnouncement.insertMany(rows, { ordered: false });
    } catch (err) {
      logger.warn(`[announcement] partial UserAnnouncement insert: ${err.message}`);
    }
  }

  let emailsSent = 0;
  let emailsFailed = 0;
  if (channels.email && users.length > 0) {
    /* Sequential to play nice with low-tier SMTP rate limits. Move to a
     * queue / worker for high-volume installs. */
    for (const u of users) {
      const result = await sendOneAnnouncementEmail(announcement, u);
      if (result.ok) {
        emailsSent++;
        await UserAnnouncement.updateOne(
          { announcementId: announcement._id, userId: u._id },
          { $set: { deliveredEmail: true, emailStatus: 'sent' } }
        ).catch(() => {});
      } else {
        emailsFailed++;
        logger.warn(`[announcement] email to ${u.email} failed: ${result.error}`);
        await UserAnnouncement.updateOne(
          { announcementId: announcement._id, userId: u._id },
          { $set: { deliveredEmail: false, emailStatus: 'failed', emailError: result.error } }
        ).catch(() => {});
      }
    }
  }

  announcement.deliverySummary = {
    totalRecipients: users.length,
    emailsSent,
    emailsFailed,
    lastError: undefined,
  };
  if (channels.email && users.length > 0 && emailsSent === 0) {
    announcement.status = 'failed';
    announcement.deliverySummary.lastError =
      'All emails failed to send. Check SMTP configuration in backend/.env.';
  }
  await announcement.save();

  return {
    announcement: announcement.toObject(),
    summary: {
      totalRecipients: users.length,
      emailsSent,
      emailsFailed,
      smsSkipped: channels.sms ? users.length : 0,
      smsReason:  channels.sms ? 'SMS integration pending — channel disabled.' : undefined,
    },
  };
}

/**
 * Return announcements visible to the given user, including their own
 * read/dismissed flags. Excludes already-dismissed rows by default.
 *
 * Super Admin gets a superset: every announcement they (or anyone)
 * created is included so the delivery dashboard has data, even if
 * there's no UserAnnouncement row for the SA themselves.
 */
async function listForUser(user, { includeDismissed = false, limit = 100 } = {}) {
  if (!user) return [];
  const isSuperAdmin = isSuperAdminRole(user.role);

  const userRowFilter = { userId: user._id };
  if (!includeDismissed) userRowFilter.dismissed = { $ne: true };

  const userRows = await UserAnnouncement
    .find(userRowFilter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  const announcementMap = new Map();
  if (userRows.length > 0) {
    const ids = userRows.map((r) => r.announcementId);
    const docs = await Announcement.find({ _id: { $in: ids }, isActive: true }).lean();
    for (const d of docs) announcementMap.set(String(d._id), d);
  }

  const visible = userRows
    .map((r) => {
      const a = announcementMap.get(String(r.announcementId));
      if (!a) return null;
      return {
        id:            String(a._id),
        title:         a.title,
        body:          a.body,
        type:          a.type,
        channels:      a.channels,
        recipients:    a.recipients,
        createdAt:     a.createdAt,
        createdByName: a.createdByName,
        read:          Boolean(r.read),
        dismissed:     Boolean(r.dismissed),
        emailStatus:   r.emailStatus || 'not_selected',
      };
    })
    .filter(Boolean);

  if (isSuperAdmin) {
    const ownDocs = await Announcement.find({ isActive: true })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    const seen = new Set(visible.map((v) => v.id));
    for (const a of ownDocs) {
      if (seen.has(String(a._id))) continue;
      visible.unshift({
        id:              String(a._id),
        title:           a.title,
        body:            a.body,
        type:            a.type,
        channels:        a.channels,
        recipients:      a.recipients,
        createdAt:       a.createdAt,
        createdByName:   a.createdByName,
        read:            true,    /* SA implicitly read their own outgoing message */
        dismissed:       false,
        emailStatus:     'not_selected',
        deliverySummary: a.deliverySummary || null,
      });
    }
  }

  return visible.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function dismissForUser(announcementId, user) {
  if (!user) throw ApiError.unauthorized('Authentication required');
  if (!mongoose.isValidObjectId(announcementId)) {
    throw ApiError.badRequest('Invalid announcement id.');
  }
  return UserAnnouncement.findOneAndUpdate(
    { announcementId, userId: user._id },
    { $set: {
        dismissed: true,
        dismissedAt: new Date(),
        read: true,
        readAt: new Date(),
    } },
    { new: true, upsert: true }
  );
}

async function markReadForUser(announcementId, user) {
  if (!user) throw ApiError.unauthorized('Authentication required');
  if (!mongoose.isValidObjectId(announcementId)) {
    throw ApiError.badRequest('Invalid announcement id.');
  }
  return UserAnnouncement.findOneAndUpdate(
    { announcementId, userId: user._id },
    { $set: { read: true, readAt: new Date() } },
    { new: true, upsert: true }
  );
}

async function deleteAnnouncementGlobal(announcementId, requester) {
  if (!requester || !isSuperAdminRole(requester.role)) {
    throw ApiError.forbidden('Only Super Admin can delete announcements globally.');
  }
  if (!mongoose.isValidObjectId(announcementId)) {
    throw ApiError.badRequest('Invalid announcement id.');
  }
  const removed = await Announcement.findByIdAndDelete(announcementId);
  if (!removed) throw ApiError.notFound('Announcement not found.');
  await UserAnnouncement.deleteMany({ announcementId });
  return removed;
}

async function listAllForSuperAdmin(query = {}) {
  const limit = Math.min(parseInt(query.limit, 10) || 100, 500);
  const filter = { isActive: true };
  if (query.status) filter.status = query.status;
  return Announcement.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
}

module.exports = {
  createAnnouncement,
  listForUser,
  listAllForSuperAdmin,
  dismissForUser,
  markReadForUser,
  deleteAnnouncementGlobal,
  resolveRecipientUsers,
  /* Legacy alias kept so the old controller line
   *   const { dispatchAnnouncement } = require('../services/announcement.service');
   * does not crash if anything still imports it. */
  dispatchAnnouncement: createAnnouncement,
};
