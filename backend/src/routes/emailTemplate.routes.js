'use strict';

const express = require('express');
const EmailTemplate = require('../models/EmailTemplate');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

/**
 * GET /api/v1/email-templates
 * Returns the persisted custom templates as a map keyed by template key:
 *   { templates: { appointmentInvite: { subject, body }, ... } }
 *
 * Kept public so the EmailTemplates settings page can sync without
 * requiring a tenant context — content is non-sensitive (no secrets,
 * just HTML/subjects).
 */
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const items = await EmailTemplate.find().lean();
    const templates = {};
    for (const it of items) {
      templates[it.key] = { subject: it.subject || '', body: it.body || '' };
    }
    res.json({ success: true, data: { templates } });
  }),
);

/**
 * PUT /api/v1/email-templates
 * Body: { templates: { [key]: { subject, body } } }
 * Upserts every entry. Missing keys are left untouched (no destructive
 * full-replacement) so partial updates from the frontend do not wipe
 * other rows.
 */
router.put(
  '/',
  asyncHandler(async (req, res) => {
    const incoming = (req.body && req.body.templates) || {};
    const ops = Object.entries(incoming).map(([key, val]) => ({
      updateOne: {
        filter: { key },
        update: {
          $set: {
            key,
            subject: (val && val.subject) || '',
            body:    (val && val.body)    || '',
          },
        },
        upsert: true,
      },
    }));

    if (ops.length) {
      await EmailTemplate.bulkWrite(ops);
    }

    const items = await EmailTemplate.find().lean();
    const templates = {};
    for (const it of items) {
      templates[it.key] = { subject: it.subject || '', body: it.body || '' };
    }
    res.json({ success: true, data: { templates } });
  }),
);

module.exports = router;
