'use strict';

const env = require('./config/env');
const logger = require('./config/logger');
const app = require('./app');
const { connectDB, disconnectDB } = require('./config/db');
const { startReminderJob } = require('./jobs/reminder.job');
const { startPlatformJobs } = require('./jobs/platform.job');
const { hashPassword } = require('./utils/password');
const User = require('./models/User');
const { ROLES } = require('./config/constants');
const { seedCoupons } = require('./services/seedCoupons.service');
const { resetTransporter, verifySmtp } = require('./services/notification.service');

async function ensureSuperAdmin() {
  const exists = await User.findOne({ role: ROLES.SUPER_ADMIN, email: env.superAdmin.email.toLowerCase() });
  if (exists) return;
  await User.create({
    name: env.superAdmin.name,
    email: env.superAdmin.email.toLowerCase(),
    password: await hashPassword(env.superAdmin.password),
    role: ROLES.SUPER_ADMIN,
    organizationId: null,
    isActive: true,
  });
  logger.info(`Super admin seeded: ${env.superAdmin.email}`);
}

async function bootstrap() {
  await connectDB();
  await ensureSuperAdmin();
  await seedCoupons();

  /* Bug 3 fix — clear any cached SMTP transporter from a previous boot
   * (test runs, hot reload, dev nodemon restarts) so the next sendMail
   * call re-creates the transporter against the freshly loaded env.
   * Idempotent: a no-op when nothing has been cached yet. */
  resetTransporter();

  /* Probe SMTP at boot so a bad Gmail App Password / wrong host shows
   * up in the server log immediately, instead of only when the first
   * forgot-password request arrives. verifySmtp() never throws — it
   * logs the result and we move on. */
  await verifySmtp();

  if (env.isProd || process.env.ENABLE_CRON === 'true') {
    startReminderJob();
    startPlatformJobs();
  }

  const server = app.listen(env.port, () => {
    logger.info(`${env.appName} listening on http://localhost:${env.port}${env.apiPrefix}`);
  });

  const shutdown = async (signal) => {
    logger.info(`${signal} received - shutting down gracefully`);
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 15000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled rejection: ${reason && reason.stack ? reason.stack : reason}`);
});
process.on('uncaughtException', (err) => {
  logger.error(`Uncaught exception: ${err.stack || err.message}`);
  process.exit(1);
});

bootstrap().catch((err) => {
  logger.error(`Bootstrap failed: ${err.message}`);
  process.exit(1);
});
