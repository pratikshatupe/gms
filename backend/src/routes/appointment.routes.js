'use strict';

const express = require('express');
const validate = require('../middlewares/validate.middleware');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');
const { resolveTenant, requireTenant } = require('../middlewares/tenant.middleware');
const v = require('../validators/appointment.validator');
const ctrl = require('../controllers/appointment.controller');
const { ROLES } = require('../config/constants');
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const appointmentService = require('../services/appointment.service');

const router = express.Router();

router.use(authenticate, resolveTenant, requireTenant);

const allReadable = authorize(
  ROLES.SUPER_ADMIN,
  ROLES.DIRECTOR,
  ROLES.MANAGER,
  ROLES.RECEPTION
);
const writable = authorize(ROLES.SUPER_ADMIN, ROLES.DIRECTOR, ROLES.MANAGER, ROLES.RECEPTION);

router.post('/', writable, validate(v.create), ctrl.create);
router.get('/', allReadable, validate(v.list), ctrl.list);
router.get('/:id', allReadable, validate(v.byId), ctrl.get);
router.patch('/:id', writable, validate(v.update), ctrl.update);
router.post('/:id/cancel', writable, validate(v.cancel), ctrl.cancel);

// POST /appointments/:id/confirm — guest confirms or declines
router.post('/:id/confirm', writable, asyncHandler(async (req, res) => {
  const { status } = req.body; // 'ACCEPTED' or 'DECLINED'
  const appt = await appointmentService.getAppointmentById(req.params.id, req.tenant.organizationId);
  appt.guestConfirmationStatus = status;
  appt.guestConfirmedAt = new Date();
  await appt.save();
  return ApiResponse.success(res, { message: `Appointment ${status.toLowerCase()}`, data: appt });
}));

module.exports = router;
