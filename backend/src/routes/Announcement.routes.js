'use strict';

const express = require('express');
const { authenticate } = require('../middlewares/auth.middleware');
const ctrl = require('../controllers/announcement.controller');

const router = express.Router();

/* All routes require an authenticated user. Role checks are performed
 * inside the service layer so they live next to the data access. */
router.use(authenticate);

/* List announcements visible to the current user (any role). */
router.get('/my',                ctrl.listMine);

/* Per-user actions: dismiss / mark-read. Per-user only — never global. */
router.patch('/:id/dismiss',     ctrl.dismiss);
router.patch('/:id/read',        ctrl.markRead);

/* Super-Admin only: create a new announcement. */
router.post('/',                 ctrl.create);

/* Super-Admin only: list every announcement (delivery dashboard). */
router.get('/',                  ctrl.listAll);

/* Super-Admin only: globally delete an announcement. */
router.delete('/:id',            ctrl.remove);

/* Maintenance notice (SA only) — kept from the previous implementation. */
router.post('/maintenance',      ctrl.sendMaintenanceNotice);

module.exports = router;
