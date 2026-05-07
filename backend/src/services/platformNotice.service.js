'use strict';

/**
 * Platform-wide notice broadcasts (Bug 5 — Maintenance email + Bug 20 trial
 * reminders). Sends a templated email to a recipient list and records the
 * dispatch attempt in the Notification log so SuperAdmin can audit it.
 */

const User = require('../models/User');
const Organization = require('../models/Organization');
const emailTemplates = require('../templates/email.templates');
const notificationService = require('./notification.service');
const env = require('../config/env');
const logger = require('../config/logger');

async function sendMaintenanceNotice({ message, startAt, endAt, audience = 'all' }) {
  const filter = { isActive: true };
  if (audience === 'admins') {
    filter.role = { $in: ['SUPER_ADMIN', 'DIRECTOR', 'MANAGER'] };
  }
  const users = await User.find(filter).select('email name organizationId').lean();
  const platformName = env.appName || 'CorpGMS';
  const tpl = emailTemplates.MAINTENANCE_NOTICE({
    platformName,
    message,
    startAt,
    endAt,
  });

  let sent = 0;
  for (const user of users) {
    if (!user.email) continue;
    try {
      await notificationService.sendEmail({
        to: user.email,
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
      });
      sent += 1;
    } catch (err) {
      logger.error(`[maintenance-notice] failed for ${user.email}: ${err?.message || err}`);
    }
  }
  logger.info(`[maintenance-notice] sent to ${sent}/${users.length} users.`);
  return { totalUsers: users.length, sent };
}

/**
 * Bug 20 — daily trial reminder cron entry point. For every organisation in
 * TRIAL with a trialEndsAt in the future, send a "trial ends in X days"
 * email to the org's primary admin (Director, fall back to first user).
 */
async function dispatchDailyTrialReminders(today = new Date()) {
  const orgs = await Organization.find({
    subscriptionStatus: 'TRIAL',
    trialEndsAt: { $gt: today },
    isActive: true,
  }).lean();
  const platformName = env.appName || 'CorpGMS';
  const upgradeUrl = env.clientUrl ? `${env.clientUrl}/subscription` : null;

  let sent = 0;
  for (const org of orgs) {
    const admin = await User.findOne({ organizationId: org._id, isActive: true })
      .sort({ role: 1, createdAt: 1 })
      .select('email name')
      .lean();
    if (!admin?.email) continue;

    const msRemaining = new Date(org.trialEndsAt).getTime() - today.getTime();
    const daysRemaining = Math.max(1, Math.ceil(msRemaining / (24 * 60 * 60 * 1000)));

    const tpl = emailTemplates.TRIAL_REMINDER({
      platformName,
      name: admin.name,
      daysRemaining,
      trialEndsAt: org.trialEndsAt,
      upgradeUrl,
    });
    try {
      await notificationService.sendEmail({
        to: admin.email,
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
      });
      sent += 1;
    } catch (err) {
      logger.error(`[trial-reminder] failed for ${admin.email}: ${err?.message || err}`);
    }
  }
  logger.info(`[trial-reminder] dispatched ${sent}/${orgs.length} reminders.`);
  return { totalOrgs: orgs.length, sent };
}

/**
 * Bug 3 — password expiry email cron. For every active user whose
 * passwordChangedAt is older than the configured expiry, send a reset
 * notice. Idempotent within a 24-hour window via a `passwordExpiryNotifiedAt`
 * marker on the user record.
 */
async function dispatchPasswordExpiryWarnings({ expiryDays = 90, today = new Date() } = {}) {
  if (!expiryDays || expiryDays <= 0) return { sent: 0, totalCandidates: 0 };
  const cutoff = new Date(today.getTime() - expiryDays * 24 * 60 * 60 * 1000);
  const notifyCutoff = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const users = await User.find({
    isActive: true,
    $or: [
      { passwordChangedAt: { $lt: cutoff } },
      { passwordChangedAt: { $exists: false }, createdAt: { $lt: cutoff } },
    ],
    $and: [
      { $or: [
        { passwordExpiryNotifiedAt: { $exists: false } },
        { passwordExpiryNotifiedAt: { $lt: notifyCutoff } },
      ] },
    ],
  }).select('email name').lean();

  const platformName = env.appName || 'CorpGMS';
  const loginUrl = env.clientUrl ? `${env.clientUrl}/login` : null;
  let sent = 0;
  for (const user of users) {
    if (!user.email) continue;
    const tpl = emailTemplates.PASSWORD_EXPIRY_WARNING({
      platformName,
      name: user.name,
      expiryDays,
      loginUrl,
    });
    try {
      await notificationService.sendEmail({
        to: user.email,
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
      });
      await User.updateOne({ _id: user._id }, { passwordExpiryNotifiedAt: new Date() });
      sent += 1;
    } catch (err) {
      logger.error(`[password-expiry] failed for ${user.email}: ${err?.message || err}`);
    }
  }
  logger.info(`[password-expiry] notified ${sent}/${users.length} users.`);
  return { sent, totalCandidates: users.length };
}

module.exports = {
  sendMaintenanceNotice,
  dispatchDailyTrialReminders,
  dispatchPasswordExpiryWarnings,
};
