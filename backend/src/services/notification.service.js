'use strict';

const nodemailer = require('nodemailer');
const Notification = require('../models/Notification');
const env = require('../config/env');
const logger = require('../config/logger');
const { NOTIFICATION_CHANNEL, NOTIFICATION_STATUS } = require('../config/constants');
const emailTemplates = require('../templates/email.templates');
const whatsappTemplates = require('../templates/whatsapp.templates');

let mailTransporter = null;

/* When SMTP isn't configured, fall back to nodemailer's JSON
   streamTransport so the email envelope is captured (and logged)
   instead of being dropped silently. This makes the "did the email
   trigger fire?" question observable in dev without real SMTP. */
function getMailTransporter() {
  if (mailTransporter) return mailTransporter;
  if (!env.smtp.host || !env.smtp.user) {
    logger.warn('[email] SMTP credentials missing — using JSON stream fallback transport. Set SMTP_HOST/SMTP_USER/SMTP_PASSWORD in backend/.env to send real emails.');
    mailTransporter = nodemailer.createTransport({
      streamTransport: true,
      newline: 'unix',
      buffer: true,
      jsonTransport: true,
    });
    mailTransporter._isFallback = true;
    return mailTransporter;
  }
  mailTransporter = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure,
    auth: { user: env.smtp.user, pass: env.smtp.password },
  });
  /* Fire a verify in the background so a bad SMTP config is loud. */
  mailTransporter.verify().then(
    () => logger.info('[email] SMTP transport verified.'),
    (err) => logger.error('[email] SMTP verify failed: ' + (err && err.message ? err.message : err)),
  );
  return mailTransporter;
}

/**
 * sendEmail — pushes the envelope through nodemailer.
 *
 * The `html` field is forwarded VERBATIM so Gmail / Outlook render the
 * branded template instead of treating it as plain text. The text
 * fallback is a short safe message — never the HTML string itself
 * (that's what was making Gmail show the source) and never empty
 * (some MTAs flag empty text parts and drop the HTML).
 *
 * Critical contract:
 *   - `html` MUST be the rendered HTML envelope produced by
 *     emailTemplates.htmlShell() on the frontend.
 *   - `text` is a short plain-text alternative for clients that can't
 *     render HTML — it is NEVER set to the HTML string.
 *
 * Empty / non-string `html` is rejected up-front with a logged warning
 * so a misshapen payload is visible instead of silently delivering a
 * blank email.
 */
async function sendEmail({ to, subject, html, text }) {
  const transporter = getMailTransporter();
  if (!transporter) return { skipped: true };
  if (!to) {
    logger.warn('[email] sendEmail called without "to" — skipping.');
    return { skipped: true, reason: 'no-recipient' };
  }
  if (!subject || typeof subject !== 'string') {
    logger.warn('[email] sendEmail called without a string "subject" — skipping.');
    return { skipped: true, reason: 'no-subject' };
  }
  if (!html || typeof html !== 'string') {
    logger.warn(`[email] sendEmail called without an html body to=${to} — skipping. typeof html=${typeof html}`);
    return { skipped: true, reason: 'no-html' };
  }

  /* Build a sane plain-text fallback. We deliberately do NOT use the
   * HTML as the text part — that's exactly what causes Gmail to
   * display "<!doctype html>…" as the body. If the caller supplied a
   * proper text alternative use it; otherwise generate one from the
   * HTML by stripping tags / collapsing whitespace. */
  const plainText = (typeof text === 'string' && text.trim())
    ? text
    : htmlToPlainText(html)
      || 'Please view this email in an HTML-compatible email client.';

  try {
    const fromName = env.smtp.fromName || process.env.EMAIL_FROM_NAME || 'CorpGMS';
    const fromAddr = env.smtp.fromAddress || process.env.EMAIL_FROM_ADDRESS || 'no-reply@corpgms.ae';
    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromAddr}>`,
      to,
      subject,
      html,
      text: plainText,
    });
    if (transporter._isFallback) {
      logger.info(`[email-fallback] would-send to=${to} subject="${subject}" htmlLen=${html.length} (no SMTP configured)`);
    } else {
      logger.info(`[email] sent to=${to} subject="${subject}" htmlLen=${html.length} messageId=${info && info.messageId}`);
    }
    return info;
  } catch (err) {
    logger.error(`[email] sendMail failed to=${to} subject="${subject}" err=${err && err.message ? err.message : err}`);
    throw err;
  }
}

/* Strip tags and collapse whitespace so we can produce a usable
 * plain-text fallback when the caller doesn't provide one. Kept tiny
 * on purpose — for anything richer use the frontend `text` field. */
function htmlToPlainText(html) {
  if (typeof html !== 'string') return '';
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<\/?(p|div|br|tr|li|h\d)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function sendWhatsApp({ to, body }) {
  if (!env.whatsapp.apiUrl || !env.whatsapp.accessToken || !env.whatsapp.phoneNumberId) {
    logger.warn('WhatsApp credentials missing - WhatsApp sending will be skipped.');
    return { skipped: true };
  }

  const url = `${env.whatsapp.apiUrl}/${env.whatsapp.phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.whatsapp.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`WhatsApp API error ${res.status}: ${detail}`);
  }
  return res.json();
}

function buildContent(event, payload) {
  const email = emailTemplates[event] ? emailTemplates[event](payload) : null;
  const whatsapp = whatsappTemplates[event] ? whatsappTemplates[event](payload) : null;
  return { email, whatsapp };
}

/**
 * Persist + dispatch a notification for one or more recipients.
 * recipients: [{ channel, userId?, email?, phone?, name? }]
 */
async function dispatch({
  organizationId,
  officeId = null,
  event,
  recipients = [],
  payload = {},
  relatedEntityType,
  relatedEntityId,
}) {
  if (!recipients.length) return [];

  const content = buildContent(event, payload);
  const results = [];

  for (const recipient of recipients) {
    const channel = recipient.channel || NOTIFICATION_CHANNEL.IN_APP;

    let subject = '';
    let body = '';
    if (channel === NOTIFICATION_CHANNEL.EMAIL && content.email) {
      subject = content.email.subject;
      body = content.email.html;
    } else if (channel === NOTIFICATION_CHANNEL.WHATSAPP && content.whatsapp) {
      body = content.whatsapp;
    } else {
      subject = (content.email && content.email.subject) || event;
      body = (content.whatsapp || (content.email && content.email.text)) || '';
    }

    const notification = await Notification.create({
      organizationId,
      officeId,
      channel,
      event,
      recipient: {
        userId: recipient.userId,
        name: recipient.name,
        email: recipient.email,
        phone: recipient.phone,
      },
      subject,
      body,
      payload,
      relatedEntityType,
      relatedEntityId,
      status: NOTIFICATION_STATUS.PENDING,
    });

    try {
      if (channel === NOTIFICATION_CHANNEL.EMAIL && recipient.email) {
        await sendEmail({
          to: recipient.email,
          subject,
          html: body,
          text: content.email && content.email.text,
        });
        notification.status = NOTIFICATION_STATUS.SENT;
        notification.sentAt = new Date();
      } else if (channel === NOTIFICATION_CHANNEL.WHATSAPP && recipient.phone) {
        await sendWhatsApp({ to: recipient.phone, body });
        notification.status = NOTIFICATION_STATUS.SENT;
        notification.sentAt = new Date();
      } else if (channel === NOTIFICATION_CHANNEL.IN_APP) {
        notification.status = NOTIFICATION_STATUS.SENT;
        notification.sentAt = new Date();
      }
    } catch (err) {
      notification.status = NOTIFICATION_STATUS.FAILED;
      notification.lastError = err.message;
      logger.error(`Notification dispatch failed [${event}] ${err.message}`);
    } finally {
      notification.attempts += 1;
      await notification.save();
      results.push(notification);
    }
  }

  return results;
}

async function listNotifications(query, organizationId, userId) {
  const filter = { organizationId };
  if (userId) filter['recipient.userId'] = userId;
  if (query.status) filter.status = query.status;
  if (query.event) filter.event = query.event;
  if (typeof query.isRead === 'boolean') filter.isRead = query.isRead;

  const limit = Math.min(parseInt(query.limit, 10) || 50, 200);
  const items = await Notification.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
  return items;
}

async function markRead(id, organizationId, userId) {
  return Notification.findOneAndUpdate(
    { _id: id, organizationId, 'recipient.userId': userId },
    { isRead: true, readAt: new Date() },
    { new: true }
  );
}

async function markAllRead(organizationId, userId) {
  return Notification.updateMany(
    { organizationId, 'recipient.userId': userId, isRead: false },
    { isRead: true, readAt: new Date() }
  );
}

module.exports = { dispatch, listNotifications, markRead, markAllRead, sendEmail, sendWhatsApp };
