'use strict';

const express = require('express');
const validate = require('../middlewares/validate.middleware');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize, isSuperAdmin } = require('../middlewares/role.middleware');
const v = require('../validators/organization.validator');
const ctrl = require('../controllers/organization.controller');
const { ROLES } = require('../config/constants');
const Organization = require('../models/Organization');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.use(authenticate);

router.post('/', isSuperAdmin, validate(v.create), ctrl.create);
router.post('/with-director', isSuperAdmin, ctrl.createWithDirector);
router.get('/', isSuperAdmin, validate(v.list), ctrl.list);

router.get('/:id', authorize(ROLES.SUPER_ADMIN, ROLES.DIRECTOR), validate(v.byId), ctrl.get);
router.patch('/:id', authorize(ROLES.SUPER_ADMIN, ROLES.DIRECTOR), validate(v.update), ctrl.update);
router.delete('/:id', isSuperAdmin, validate(v.byId), ctrl.deactivate);
router.get('/:id/stats', authorize(ROLES.SUPER_ADMIN, ROLES.DIRECTOR), validate(v.byId), ctrl.stats);

router.get(
  '/:id/settings',
  authorize(ROLES.SUPER_ADMIN, ROLES.DIRECTOR, ROLES.MANAGER),
  validate(v.byId),
  asyncHandler(async (req, res) => {
    const org = await Organization.findById(req.params.id).select('settings');
    if (!org) throw ApiError.notFound('Organization not found');
    return ApiResponse.success(res, { data: org.settings });
  })
);

router.patch(
  '/:id/settings',
  authorize(ROLES.SUPER_ADMIN, ROLES.DIRECTOR),
  validate(v.byId),
  asyncHandler(async (req, res) => {
    const update = Object.fromEntries(
      Object.entries(req.body).map(([k, val]) => [`settings.${k}`, val])
    );
    const org = await Organization.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true, runValidators: true }
    ).select('settings');
    if (!org) throw ApiError.notFound('Organization not found');
    return ApiResponse.success(res, { message: 'Settings updated', data: org.settings });
  })
);

module.exports = router;
