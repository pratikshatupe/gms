'use strict';

const express = require('express');
const validate = require('../middlewares/validate.middleware');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');
const { resolveTenant, requireTenant } = require('../middlewares/tenant.middleware');
const v = require('../validators/serviceRequest.validator');
const ctrl = require('../controllers/serviceRequest.controller');
const { ROLES } = require('../config/constants');

const router = express.Router();

router.use(authenticate, resolveTenant, requireTenant);

const allRoles = authorize(
  ROLES.SUPER_ADMIN,
  ROLES.DIRECTOR,
  ROLES.MANAGER,
  ROLES.RECEPTION,
  ROLES.SERVICE_STAFF
);

router.post('/', allRoles, validate(v.create), ctrl.create);
router.get('/', allRoles, validate(v.list), ctrl.list);
router.get('/:id', allRoles, validate(v.byId), ctrl.get);
router.patch(
  '/:id',
  authorize(ROLES.SUPER_ADMIN, ROLES.DIRECTOR, ROLES.MANAGER),
  validate(v.update),
  ctrl.update
);
router.post(
  '/:id/assign',
  authorize(ROLES.SUPER_ADMIN, ROLES.DIRECTOR, ROLES.MANAGER, ROLES.RECEPTION),
  validate(v.assign),
  ctrl.assign
);
router.patch('/:id/status', allRoles, validate(v.updateStatus), ctrl.updateStatus);

module.exports = router;
