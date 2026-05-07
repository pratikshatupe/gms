'use strict';

const express = require('express');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');
const { resolveTenant, requireTenant } = require('../middlewares/tenant.middleware');
const ctrl = require('../controllers/rolePermission.controller');
const { ROLES } = require('../config/constants');

const router = express.Router();
router.use(authenticate, resolveTenant, requireTenant);

router.get('/', authorize(ROLES.SUPER_ADMIN, ROLES.DIRECTOR), ctrl.get);
router.put('/role', authorize(ROLES.SUPER_ADMIN, ROLES.DIRECTOR), ctrl.update);
router.put('/all', authorize(ROLES.SUPER_ADMIN, ROLES.DIRECTOR), ctrl.updateAll);

module.exports = router;
