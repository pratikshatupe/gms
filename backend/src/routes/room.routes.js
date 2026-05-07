'use strict';

const express = require('express');
const validate = require('../middlewares/validate.middleware');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');
const { resolveTenant, requireTenant } = require('../middlewares/tenant.middleware');
const v = require('../validators/room.validator');
const ctrl = require('../controllers/room.controller');
const { ROLES } = require('../config/constants');

const router = express.Router();

router.use(authenticate, resolveTenant, requireTenant);

const readable = authorize(
  ROLES.SUPER_ADMIN,
  ROLES.DIRECTOR,
  ROLES.MANAGER,
  ROLES.RECEPTION,
  ROLES.SERVICE_STAFF
);
const writable = authorize(ROLES.SUPER_ADMIN, ROLES.DIRECTOR, ROLES.MANAGER);

router.post('/', writable, validate(v.create), ctrl.create);
router.get('/', readable, validate(v.list), ctrl.list);
router.get('/availability', readable, validate(v.availability), ctrl.availability);
router.get('/:id', readable, validate(v.byId), ctrl.get);
router.patch('/:id', writable, validate(v.update), ctrl.update);
router.patch('/:id/status', writable, validate(v.updateStatus), ctrl.updateStatus);
router.delete('/:id', writable, validate(v.byId), ctrl.remove);

module.exports = router;
