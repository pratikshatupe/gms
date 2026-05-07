'use strict';

const express          = require('express');
const { authenticate } = require('../middlewares/auth.middleware');
const { isSuperAdmin } = require('../middlewares/role.middleware');
const ctrl             = require('../controllers/referral.controller');

const router = express.Router();
router.use(authenticate);

router.get('/my',  ctrl.getMyReferral);
router.get('/all', isSuperAdmin, ctrl.listAll);

module.exports = router;
