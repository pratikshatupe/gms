'use strict';

const express = require('express');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');
const { resolveTenant } = require('../middlewares/tenant.middleware');
const ctrl = require('../controllers/auditLog.controller');
const { ROLES } = require('../config/constants');

const router = express.Router();
router.use(authenticate, resolveTenant);

router.post('/', authorize(ROLES.SUPER_ADMIN, ROLES.DIRECTOR, ROLES.MANAGER), ctrl.create);
router.get('/', authorize(ROLES.SUPER_ADMIN, ROLES.DIRECTOR, ROLES.MANAGER), ctrl.list);

module.exports = router;
