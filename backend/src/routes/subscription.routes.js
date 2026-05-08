'use strict';

const express = require('express');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');
const { resolveTenant, requireTenant } = require('../middlewares/tenant.middleware');
const ctrl = require('../controllers/subscription.controller');
const { ROLES } = require('../config/constants');

const router = express.Router();

/* Super-Admin platform-wide list — no tenant scope. */
router.get(
  '/admin/all',
  authenticate,
  authorize(ROLES.SUPER_ADMIN),
  ctrl.listAll,
);

/* Tenant-scoped routes. */
router.use(authenticate, resolveTenant, requireTenant);

router.get('/my',                authorize(ROLES.SUPER_ADMIN, ROLES.DIRECTOR), ctrl.get);
router.get('/payments',          authorize(ROLES.SUPER_ADMIN, ROLES.DIRECTOR, ROLES.MANAGER), ctrl.paymentHistory);
router.post('/change-plan',      authorize(ROLES.SUPER_ADMIN, ROLES.DIRECTOR), ctrl.changePlan);
router.post('/cancel',           authorize(ROLES.SUPER_ADMIN, ROLES.DIRECTOR), ctrl.cancel);
router.get('/usage',             authorize(ROLES.SUPER_ADMIN, ROLES.DIRECTOR, ROLES.MANAGER), ctrl.usage);

/* Razorpay payment lifecycle. createOrder mints the Razorpay order,
 * verifyPayment validates the HMAC signature and activates the plan.
 * Both gated to SuperAdmin / Director (the only roles that can edit
 * billing). */
router.post('/create-order',     authorize(ROLES.SUPER_ADMIN, ROLES.DIRECTOR), ctrl.createOrder);
router.post('/verify-payment',   authorize(ROLES.SUPER_ADMIN, ROLES.DIRECTOR), ctrl.verifyPayment);

module.exports = router;
