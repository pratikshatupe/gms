'use strict';

const express = require('express');
const validate = require('../middlewares/validate.middleware');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');
const { resolveTenant, requireTenant } = require('../middlewares/tenant.middleware');
const v = require('../validators/user.validator');
const ctrl = require('../controllers/user.controller');
const { ROLES } = require('../config/constants');

const router = express.Router();

router.use(authenticate, resolveTenant, requireTenant);

const adminOnly = authorize(ROLES.DIRECTOR, ROLES.MANAGER, ROLES.SUPER_ADMIN);

router.post('/', adminOnly, validate(v.create), ctrl.create);
router.get('/', adminOnly, validate(v.list), ctrl.list);
router.get('/:id', adminOnly, validate(v.byId), ctrl.get);
router.patch('/:id', adminOnly, validate(v.update), ctrl.update);
router.post('/:id/reset-password', adminOnly, validate(v.resetPassword), ctrl.resetPassword);
router.post('/:id/deactivate', adminOnly, validate(v.byId), ctrl.deactivate);
router.post('/:id/activate', adminOnly, validate(v.byId), ctrl.activate);

module.exports = router;
