'use strict';

const express = require('express');

const auth            = require('./auth.routes');
const organizations   = require('./organization.routes');
const offices         = require('./office.routes');
const users           = require('./user.routes');
const guests          = require('./guest.routes');
const appointments    = require('./appointment.routes');
const rooms           = require('./room.routes');
const services        = require('./serviceRequest.routes');
const notifications   = require('./notification.routes');
const reports         = require('./report.routes');
const auditLogs       = require('./auditLog.routes');
const subscriptions   = require('./subscription.routes');
const rolePermissions = require('./rolePermission.routes');
const accessRequests  = require('./accessRequest.routes');
const uploads         = require('./upload.routes');
const coupons         = require('./coupon.routes');
const referrals       = require('./referral.routes');
const chatbot         = require('./chatboat.routes');
const announcements   = require('./Announcement.routes');
const plans           = require('./plan.routes');
const emailTemplates  = require('./emailTemplate.routes');

const router = express.Router();

/**
 * Bug 7 fix: GET /api/v1 used to fall through to notFound because the
 * router only defined sub-paths (/auth, /coupons, etc.) and never the
 * root. Hitting the bare prefix is the most common smoke-test, so we
 * register an index handler that returns the API metadata + a list of
 * mounted resources.
 */
router.get('/', (_req, res) =>
  res.json({
    success: true,
    name: 'Corporate Guest Management System API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date(),
    endpoints: [
      'auth', 'organizations', 'offices', 'users', 'guests', 'appointments',
      'rooms', 'service-requests', 'notifications', 'reports', 'audit-logs',
      'subscriptions', 'plans', 'role-permissions', 'access-requests', 'upload',
      'coupons', 'referrals', 'chatbot', 'health',
    ],
  })
);

router.get('/health', (_req, res) =>
  res.json({ success: true, status: 'ok', timestamp: new Date() })
);

router.use('/auth',             auth);
router.use('/organizations',    organizations);
router.use('/offices',          offices);
router.use('/users',            users);
router.use('/guests',           guests);
router.use('/appointments',     appointments);
router.use('/rooms',            rooms);
router.use('/service-requests', services);
router.use('/notifications',    notifications);
router.use('/reports',          reports);
router.use('/audit-logs',       auditLogs);
router.use('/subscriptions',    subscriptions);
router.use('/plans',            plans);
router.use('/role-permissions', rolePermissions);
router.use('/access-requests',  accessRequests);
router.use('/upload',           uploads);
router.use('/coupons',          coupons);
router.use('/referrals',        referrals);
router.use('/chatbot',          chatbot);
router.use('/announcements',    announcements);
router.use('/email-templates',  emailTemplates);

module.exports = router;
