'use strict';

const express = require('express');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');
const ctrl = require('../controllers/plan.controller');
const { ROLES } = require('../config/constants');

const router = express.Router();

/* PUBLIC — Create Organisation modal "Choose Plan" step needs this
   before the user has an account. No tenant resolution required. */
router.get('/', ctrl.list);
router.get('/:id', ctrl.get);

/* SUPER ADMIN management endpoints. */
router.post('/',         authenticate, authorize(ROLES.SUPER_ADMIN), ctrl.create);
router.patch('/:id',     authenticate, authorize(ROLES.SUPER_ADMIN), ctrl.update);
router.delete('/:id',    authenticate, authorize(ROLES.SUPER_ADMIN), ctrl.archive);

module.exports = router;
