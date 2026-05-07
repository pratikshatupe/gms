'use strict';

const express = require('express');
const { authenticate } = require('../middlewares/auth.middleware');
const { resolveTenant, requireTenant } = require('../middlewares/tenant.middleware');
const ctrl = require('../controllers/notification.controller');

const router = express.Router();

/**
 * Public, lightweight email dispatch — used by every frontend flow that
 * calls previewEmail() (appointment confirmation, staff invite, welcome
 * to new org, access-request rejection / info-request).
 *
 * Kept public on purpose so the invite-creation flows can fire emails
 * without the user being logged in to a tenant context.
 */
router.post('/dispatch', ctrl.dispatch);

router.use(authenticate, resolveTenant, requireTenant);

router.get('/', ctrl.list);
router.post('/read-all', ctrl.markAllRead);
router.post('/:id/read', ctrl.markRead);

module.exports = router;
