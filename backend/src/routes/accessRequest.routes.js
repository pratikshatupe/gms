'use strict';

const express = require('express');
const { authenticate } = require('../middlewares/auth.middleware');
const { isSuperAdmin } = require('../middlewares/role.middleware');
const ctrl = require('../controllers/accessRequest.controller');

const router = express.Router();

router.post('/', ctrl.create);
router.get('/', authenticate, isSuperAdmin, ctrl.list);
router.patch('/:id/status', authenticate, isSuperAdmin, ctrl.updateStatus);

module.exports = router;
