'use strict';

const cron = require('node-cron');
const logger = require('../config/logger');
const appointmentService = require('../services/appointment.service');
const notificationService = require('../services/notification.service');
const User = require('../models/User');
const { NOTIFICATION_EVENT, NOTIFICATION_CHANNEL } = require('../config/constants');

async function runReminderTick() {
  try {
    const upcoming = await appointmentService.getUpcomingForReminders(new Date(), 60);
    if (!upcoming.length) return;

    for (const appt of upcoming) {
      const host = await User.findById(appt.hostUserId).select('name email phone');
      const recipients = [];

      if (appt.notifyEmail && appt.visitor.email) {
        recipients.push({
          channel: NOTIFICATION_CHANNEL.EMAIL,
          email: appt.visitor.email,
          name: appt.visitor.fullName,
        });
      }
      if (appt.notifyWhatsApp && appt.visitor.phone) {
        recipients.push({
          channel: NOTIFICATION_CHANNEL.WHATSAPP,
          phone: appt.visitor.phone,
          name: appt.visitor.fullName,
        });
      }
      if (host && host.email) {
        recipients.push({
          channel: NOTIFICATION_CHANNEL.EMAIL,
          userId: host._id,
          email: host.email,
          name: host.name,
        });
      }

      if (recipients.length) {
        await notificationService.dispatch({
          organizationId: appt.organizationId,
          officeId: appt.officeId,
          event: NOTIFICATION_EVENT.APPOINTMENT_REMINDER,
          relatedEntityType: 'Appointment',
          relatedEntityId: appt._id,
          recipients,
          payload: {
            appointmentId: appt._id,
            title: appt.title,
            scheduledAt: appt.scheduledAt,
          },
        });
      }
      await appointmentService.markReminderSent(appt._id);
    }

    logger.info(`Reminder job dispatched ${upcoming.length} appointment reminder(s)`);
  } catch (err) {
    logger.error(`Reminder job failed: ${err.message}`);
  }
}

function startReminderJob() {
  cron.schedule('*/10 * * * *', runReminderTick, { timezone: 'UTC' });
  logger.info('Appointment reminder cron scheduled (every 10 minutes)');
}

module.exports = { startReminderJob, runReminderTick };
