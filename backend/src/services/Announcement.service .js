'use strict';

const nodemailer = require('nodemailer');
const Organization = require('../models/Organization');
const User = require('../models/User');
const env = require('../config/env');
const logger = require('../config/logger');

let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;
  if (!env.smtp.host || !env.smtp.user) {
    logger.warn('[announcement] SMTP credentials missing – email dispatch skipped.');
    return null;
  }
  _transporter = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure,
    auth: { user: env.smtp.user, pass: env.smtp.password },
  });
  return _transporter;
}


async function sendSms({ to, body }) {
  if (!env.whatsapp.apiUrl || !env.whatsapp.accessToken || !env.whatsapp.phoneNumberId) {
    logger.warn('[announcement] WhatsApp / SMS credentials missing – SMS dispatch skipped.');
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


function buildOrgFilter(recipients) {
  if (!recipients || recipients === 'all') return { isActive: true };

  const TIER_MAP = {
    'tier-starter': 'STARTER',
    'tier-pro':     'PRO',
    'tier-ent':     'ENTERPRISE',
  };

  const plan = TIER_MAP[recipients];
  if (plan) return { isActive: true, plan };

  return { isActive: true };
}


function buildEmailHtml({ title, message, orgName }) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:#0284c7;padding:28px 32px;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:800;letter-spacing:-0.3px;">
                📢 Platform Announcement
              </h1>
              ${orgName ? `<p style="margin:6px 0 0;color:#bae6fd;font-size:13px;">For: ${orgName}</p>` : ''}
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 12px;font-size:18px;color:#0c2340;font-weight:700;">${title}</h2>
              <p style="margin:0;font-size:14px;line-height:1.7;color:#334155;">${message}</p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;padding:18px 32px;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:11px;color:#94a3b8;">
                This message was sent by the CorpGMS platform administration team.
                Please do not reply to this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}


/**
 * dispatchAnnouncement
 *
 * @param {object} opts
 * @param {string}  opts.title       - Announcement title
 * @param {string}  opts.message     - Announcement message body
 * @param {string}  opts.recipients  - 'all' | 'tier-starter' | 'tier-pro' | 'tier-ent' | 'specific'
 * @param {object}  opts.channels    - { email: boolean, sms: boolean }
 * @param {string=} opts.scheduleAt  - ISO datetime string for scheduled send (optional)
 * @param {string=} opts.sentBy      - Name of the super admin who sent it
 *
 * @returns {Promise<{ emailsSent: number, smsSent: number, errors: string[] }>}
 */
async function dispatchAnnouncement({ title, message, recipients, channels, sentBy }) {
  const summary = { emailsSent: 0, smsSent: 0, errors: [] };

  if (!channels.email && !channels.sms) {
    return summary;
  }

  const orgFilter = buildOrgFilter(recipients);
  const orgs = await Organization.find(orgFilter).select('_id name').lean();

  if (!orgs.length) {
    logger.info('[announcement] No matching organisations found for recipients filter:', recipients);
    return summary;
  }

  const orgIds = orgs.map((o) => o._id);

  const users = await User.find({
    organizationId: { $in: orgIds },
    isActive: true,
  }).select('name email phone organizationId').lean();

  if (!users.length) {
    logger.info('[announcement] No active users found in matching organisations.');
    return summary;
  }

  const orgNameMap = {};
  for (const org of orgs) orgNameMap[String(org._id)] = org.name;

  const transporter = channels.email ? getTransporter() : null;

  for (const u of users) {
    const orgName = orgNameMap[String(u.organizationId)] || '';

    if (channels.email && u.email) {
      try {
        if (transporter) {
          await transporter.sendMail({
            from: `"${env.smtp.fromName}" <${env.smtp.fromAddress}>`,
            to: u.email,
            subject: `[CorpGMS] ${title}`,
            html: buildEmailHtml({ title, message, orgName }),
            text: `${title}\n\n${message}\n\n— CorpGMS Platform`,
          });
          summary.emailsSent += 1;
        }
      } catch (err) {
        const errMsg = `Email to ${u.email} failed: ${err.message}`;
        logger.error('[announcement]', errMsg);
        summary.errors.push(errMsg);
      }
    }

    if (channels.sms && u.phone) {
      try {
        await sendSms({
          to: u.phone,
          body: `[CorpGMS] ${title}\n\n${message}`,
        });
        summary.smsSent += 1;
      } catch (err) {
        const errMsg = `SMS to ${u.phone} failed: ${err.message}`;
        logger.error('[announcement]', errMsg);
        summary.errors.push(errMsg);
      }
    }
  }

  logger.info(
    `[announcement] "${title}" — emails: ${summary.emailsSent}, sms: ${summary.smsSent}, errors: ${summary.errors.length}`,
  );

  return summary;
}

module.exports = { dispatchAnnouncement };