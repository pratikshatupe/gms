'use strict';
const express = require('express');
const { authenticate } = require('../middlewares/auth.middleware');
const ctrl = require('../controllers/announcement.controller');

const router = express.Router();

router.use(authenticate);

router.post('/',            ctrl.sendAnnouncement);
router.post('/maintenance', ctrl.sendMaintenanceNotice);

module.exports = router;