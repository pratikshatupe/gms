'use strict';

const cron = require('node-cron');
const logger = require('../config/logger');
const platformNoticeService = require('../services/platformNotice.service');

/**
 * Bug 3 — daily password expiry email cron.
 * Bug 20 — daily trial reminder email cron.
 *
 * Both run once a day at 06:00 UTC. Use `runPasswordExpiryTick` /
 * `runTrialReminderTick` to trigger them on demand from a controller / test.
 */
async function runPasswordExpiryTick() {
  try {
    /* The configured expiry days live in the SuperAdmin platform settings;
       we read it from the env override or fall back to 90 (the default the
       UI ships with). For SaaS-tenant overrides, the cron can be extended to
       group by org and use the per-org setting. */
    const expiryDays = Number(process.env.PASSWORD_EXPIRY_DAYS) || 90;
    await platformNoticeService.dispatchPasswordExpiryWarnings({ expiryDays });
  } catch (err) {
    logger.error(`Password expiry job failed: ${err.message}`);
  }
}

async function runTrialReminderTick() {
  try {
    await platformNoticeService.dispatchDailyTrialReminders();
  } catch (err) {
    logger.error(`Trial reminder job failed: ${err.message}`);
  }
}

function startPlatformJobs() {
  cron.schedule('0 6 * * *', runPasswordExpiryTick, { timezone: 'UTC' });
  cron.schedule('0 7 * * *', runTrialReminderTick,  { timezone: 'UTC' });
  logger.info('Platform jobs scheduled (password expiry + trial reminders, daily 06:00/07:00 UTC).');
}

module.exports = { startPlatformJobs, runPasswordExpiryTick, runTrialReminderTick };
