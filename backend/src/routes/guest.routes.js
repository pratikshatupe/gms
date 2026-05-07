'use strict';

const express = require('express');
const validate = require('../middlewares/validate.middleware');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');
const { resolveTenant, requireTenant } = require('../middlewares/tenant.middleware');
const v = require('../validators/guest.validator');
const ctrl = require('../controllers/guest.controller');
const { ROLES } = require('../config/constants');
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const guestService = require('../services/guest.service');

const router = express.Router();

router.use(authenticate, resolveTenant);

const receptionUp = authorize(ROLES.SUPER_ADMIN, ROLES.DIRECTOR, ROLES.MANAGER, ROLES.RECEPTION);

// Bug 8 fix: super admin can list guests across all orgs (no requireTenant on /).
// All write/check-in routes still need a tenant.
router.post('/check-in', requireTenant, receptionUp, validate(v.checkIn), ctrl.checkIn);
router.get('/', receptionUp, validate(v.list), ctrl.list);
router.get('/active', receptionUp, ctrl.active);
router.get('/stats/today', receptionUp, ctrl.dailyStats);
router.get('/:id', receptionUp, validate(v.byId), ctrl.get);
router.patch('/:id', receptionUp, validate(v.update), ctrl.update);
router.post('/:id/check-out', receptionUp, validate(v.checkOut), ctrl.checkOut);
router.post('/:id/verify-id', receptionUp, validate(v.verifyId), ctrl.verifyId);

// GET /guests/:id/badge — returns badge data for printing
router.get('/:id/badge', receptionUp, asyncHandler(async (req, res) => {
  const guest = await guestService.getGuestById(req.params.id, req.tenant.organizationId);
  const badgeData = {
    badgeNumber: guest.badgeNumber,
    fullName: guest.fullName,
    company: guest.company || '',
    purpose: guest.purpose || '',
    hostDepartment: guest.hostDepartment || '',
    checkedInAt: guest.checkedInAt,
    officeName: guest.officeId?.name || '',
    photoUrl: guest.photoUrl || null,
  };
  return ApiResponse.success(res, { data: badgeData });
}));

module.exports = router;
