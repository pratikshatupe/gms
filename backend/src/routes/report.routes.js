'use strict';

const express = require('express');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');
const { resolveTenant, requireTenant } = require('../middlewares/tenant.middleware');
const ctrl = require('../controllers/report.controller');
const { ROLES } = require('../config/constants');
const asyncHandler = require('../utils/asyncHandler');
const guestService = require('../services/guest.service');
const reportService = require('../services/report.service');
const { toExcel, toCsv } = require('../utils/exportHelpers');

const router = express.Router();

router.use(authenticate, resolveTenant, requireTenant);

const allow = authorize(ROLES.SUPER_ADMIN, ROLES.DIRECTOR, ROLES.MANAGER);

router.get('/dashboard', authorize(ROLES.SUPER_ADMIN, ROLES.DIRECTOR, ROLES.MANAGER, ROLES.RECEPTION), ctrl.dashboard);
router.get('/visitors', allow, ctrl.visitors);
router.get('/offices', allow, ctrl.offices);
router.get('/duration', allow, ctrl.duration);
router.get('/services', allow, ctrl.services);
router.get('/no-show', allow, ctrl.noShow);
router.get('/peak-hours', allow, ctrl.peakHours);
router.get('/room-utilization', allow, ctrl.roomUtilization);

// Export guest log to XLSX
router.get(
  '/export/guests/xlsx',
  authorize(ROLES.SUPER_ADMIN, ROLES.DIRECTOR, ROLES.MANAGER),
  asyncHandler(async (req, res) => {
    const { items } = await guestService.listGuests(
      { ...req.query, limit: 10000 },
      req.tenant.organizationId
    );
    const headers = [
      { label: 'Badge No.', key: 'badgeNumber', width: 18 },
      { label: 'Full Name', key: 'fullName', width: 25 },
      { label: 'Company', key: 'company', width: 22 },
      { label: 'Phone', key: 'phone', width: 18 },
      { label: 'Purpose', key: 'purpose', width: 28 },
      { label: 'Type', key: 'type', width: 16 },
      { label: 'Status', key: 'status', width: 16 },
      { label: 'Checked In At', key: 'checkedInAt', width: 22 },
      { label: 'Checked Out At', key: 'checkedOutAt', width: 22 },
    ];
    const rows = items.map((g) => ({
      badgeNumber: g.badgeNumber || '',
      fullName: g.fullName,
      company: g.company || '',
      phone: g.phone,
      purpose: g.purpose || '',
      type: g.type,
      status: g.status,
      checkedInAt: g.checkedInAt ? new Date(g.checkedInAt).toISOString() : '',
      checkedOutAt: g.checkedOutAt ? new Date(g.checkedOutAt).toISOString() : '',
    }));
    const buffer = await toExcel(headers, rows, 'Guest Log');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="guest-log.xlsx"');
    res.send(buffer);
  })
);

// Export guest log to CSV
router.get(
  '/export/guests/csv',
  authorize(ROLES.SUPER_ADMIN, ROLES.DIRECTOR, ROLES.MANAGER),
  asyncHandler(async (req, res) => {
    const { items } = await guestService.listGuests(
      { ...req.query, limit: 10000 },
      req.tenant.organizationId
    );
    const headers = [
      { label: 'Badge No.', key: 'badgeNumber' },
      { label: 'Full Name', key: 'fullName' },
      { label: 'Company', key: 'company' },
      { label: 'Phone', key: 'phone' },
      { label: 'Purpose', key: 'purpose' },
      { label: 'Type', key: 'type' },
      { label: 'Status', key: 'status' },
      { label: 'Checked In At', key: 'checkedInAt' },
      { label: 'Checked Out At', key: 'checkedOutAt' },
    ];
    const rows = items.map((g) => ({
      badgeNumber: g.badgeNumber || '',
      fullName: g.fullName,
      company: g.company || '',
      phone: g.phone,
      purpose: g.purpose || '',
      type: g.type,
      status: g.status,
      checkedInAt: g.checkedInAt ? new Date(g.checkedInAt).toISOString() : '',
      checkedOutAt: g.checkedOutAt ? new Date(g.checkedOutAt).toISOString() : '',
    }));
    const csv = toCsv(headers, rows);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="guest-log.csv"');
    res.send(csv);
  })
);

// Export visitor analytics report to XLSX
router.get(
  '/export/visitors/xlsx',
  allow,
  asyncHandler(async (req, res) => {
    const data = await reportService.visitorReport(req.query, req.tenant.organizationId);
    const headers = [
      { label: 'Date', key: 'date', width: 16 },
      { label: 'Total Visitors', key: 'total', width: 16 },
    ];
    const rows = (data.byDay || []).map((d) => ({ date: d._id, total: d.total }));
    const buffer = await toExcel(headers, rows, 'Visitor Report');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="visitor-report.xlsx"');
    res.send(buffer);
  })
);

module.exports = router;
