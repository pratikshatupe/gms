'use strict';

const express = require('express');
const validate = require('../middlewares/validate.middleware');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');
const { resolveTenant, requireTenant } = require('../middlewares/tenant.middleware');
const v = require('../validators/office.validator');
const ctrl = require('../controllers/office.controller');
const { ROLES } = require('../config/constants');

const router = express.Router();

router.use(authenticate, resolveTenant, requireTenant);

router.post('/', authorize(ROLES.DIRECTOR, ROLES.SUPER_ADMIN), validate(v.create), ctrl.create);
router.get('/', authorize(ROLES.SUPER_ADMIN, ROLES.DIRECTOR, ROLES.MANAGER, ROLES.RECEPTION), validate(v.list), ctrl.list);
router.get('/:id', authorize(ROLES.SUPER_ADMIN, ROLES.DIRECTOR, ROLES.MANAGER, ROLES.RECEPTION), validate(v.byId), ctrl.get);
router.patch('/:id', authorize(ROLES.DIRECTOR, ROLES.SUPER_ADMIN), validate(v.update), ctrl.update);
router.delete('/:id', authorize(ROLES.DIRECTOR, ROLES.SUPER_ADMIN), validate(v.byId), ctrl.deactivate);

module.exports = router;
