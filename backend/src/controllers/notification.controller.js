'use strict';

const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const notificationService = require('../services/notification.service');

let logger;
try { logger = require('../config/logger'); } catch { logger = { error: console.error, warn: console.warn, info: console.info }; }

const list = asyncHandler(async (req, res) => {
  const items = await notificationService.listNotifications(
    req.query,
    req.tenant.organizationId,
    req.user._id
  );
  return ApiResponse.success(res, { data: items });
});

const markRead = asyncHandler(async (req, res) => {
  const item = await notificationService.markRead(
    req.params.id,
    req.tenant.organizationId,
    req.user._id
  );
  return ApiResponse.success(res, { message: 'Marked as read', data: item });
});

const markAllRead = asyncHandler(async (req, res) => {
  const result = await notificationService.markAllRead(req.tenant.organizationId, req.user._id);
  return ApiResponse.success(res, { message: 'All marked as read', data: { modified: result.modifiedCount } });
});

/**
 * POST /api/v1/notifications/dispatch
 *
 * Lightweight email-dispatch endpoint used by the frontend after
 * creating an appointment, inviting a staff member, sending a welcome
 * to a new organisation, etc. The frontend builds the full branded
 * HTML envelope via emailTemplates.js (which uses htmlShell) and
 * forwards it here for the actual SMTP send.
 *
 * Public on purpose so an unauthenticated invite-creation flow can
 * still trigger emails. Errors are returned as 200 with success:false
 * to keep the UI flow non-blocking.
 *
 * Critical contract:
 *   req.body = { to, subject, html, text }
 *   - `html` is the rendered branded template (htmlShell output).
 *     This MUST be passed straight through as `html:` so nodemailer
 *     sets Content-Type: text/html — otherwise Gmail shows the raw
 *     HTML source as plain text.
 *   - `text` is the plain-text alternative ONLY. Never set it to the
 *     HTML string.
 */
const dispatch = async (req, res) => {
  try {
    const body = req.body || {};
    const to      = body.to;
    const subject = body.subject;
    const html    = body.html;
    const text    = body.text;

    if (!to || typeof to !== 'string') {
      return res.status(400).json({ success: false, message: '"to" (recipient email) is required' });
    }
    if (!subject || typeof subject !== 'string') {
      return res.status(400).json({ success: false, message: '"subject" is required' });
    }
    if (!html || typeof html !== 'string' || !html.includes('<')) {
      logger.warn(`[notifications/dispatch] html is empty or not valid HTML after sanitization — refusing. to=${to} typeof html=${typeof html} preview=${String(html).slice(0, 100)}`);
      return res.status(400).json({
        success: false,
        message: '"html" body is required and must be valid HTML. It may have been stripped by a security middleware.',
      });
    }

    /* Forward html (and text fallback) explicitly. The service layer
     * also guards against text === html and empty text so the
     * recipient never sees raw HTML in their inbox. */
    const result = await notificationService.sendEmail({
      to,
      subject,
      html,
      text: text || 'Please view this email in an HTML-compatible email client.',
    });

    return res.json({
      success: true,
      skipped: Boolean(result && result.skipped),
      info: result,
    });
  } catch (err) {
    logger.error('[notifications/dispatch] failed: ' + (err && err.message ? err.message : err));
    return res.status(200).json({ success: false, message: err.message || 'Email dispatch failed' });
  }
};

module.exports = { list, markRead, markAllRead, dispatch };
