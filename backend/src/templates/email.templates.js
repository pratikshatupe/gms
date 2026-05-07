'use strict';

let _EmailTemplateModel = null;
function getEmailTemplateModel() {
  if (_EmailTemplateModel) return _EmailTemplateModel;
  try {
    _EmailTemplateModel = require('../models/EmailTemplate');
  } catch {
    _EmailTemplateModel = null;
  }
  return _EmailTemplateModel;
}

/**
 * loadDbTemplate(key) — fetch the user-customised template for `key` from
 * the EmailTemplate collection. Returns `{ subject, body }` (or null when
 * nothing has been saved yet so the caller falls through to the
 * hard-coded default). Failures are swallowed: we never want a notification
 * dispatch to crash because the templates table is unavailable.
 */
async function loadDbTemplate(key) {
  const Model = getEmailTemplateModel();
  if (!Model) return null;
  try {
    const row = await Model.findOne({ key }).lean();
    if (!row) return null;
    if (!row.subject && !row.body) return null;
    return { subject: row.subject || '', body: row.body || '' };
  } catch {
    return null;
  }
}

/**
 * fillTokens(template, vars) — replace `{{token}}` placeholders in the
 * supplied string with values from `vars`. Unknown tokens are left
 * untouched so the recipient sees the placeholder rather than an empty
 * gap (helps debugging template authoring).
 */
function fillTokens(template, vars) {
  if (typeof template !== 'string' || !template) return template || '';
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, name) => {
    if (vars && Object.prototype.hasOwnProperty.call(vars, name) && vars[name] != null) {
      return String(vars[name]);
    }
    return `{{${name}}}`;
  });
}

function formatDate(d) {
  try {
    return new Date(d).toLocaleString('en-GB', { hour12: false });
  } catch {
    return String(d);
  }
}

/**
 * wrap() — Produces a fully Gmail/Outlook/Apple-Mail-compatible HTML email.
 * Uses table-based layout (required for Outlook), inline CSS only,
 * proper DOCTYPE + <head> with charset and viewport meta tags.
 */
function wrap(title, contentHtml) {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${title}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f0f2f5;font-family:Arial,Helvetica,sans-serif;">

  <!-- Outer wrapper table -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background-color:#f0f2f5;padding:32px 0;">
    <tr>
      <td align="center">

        <!-- Card table — max 600px -->
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
               style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;
                      overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- ===== HEADER ===== -->
          <tr>
            <td align="center"
                style="background:linear-gradient(135deg,#6c5ce7 0%,#4f46e5 50%,#0284c7 100%);
                       padding:36px 40px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center">
                    <!-- Logo mark -->
                    <div style="display:inline-block;background:rgba(255,255,255,0.18);
                                border-radius:16px;padding:10px 18px;margin-bottom:14px;">
                      <span style="font-size:22px;font-weight:800;color:#ffffff;
                                   letter-spacing:1px;font-family:Arial,Helvetica,sans-serif;">
                        Corp<span style="color:#c4b5fd;">GMS</span>
                      </span>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;
                               letter-spacing:0.3px;font-family:Arial,Helvetica,sans-serif;">
                      ${title}
                    </h1>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ===== BODY ===== -->
          <tr>
            <td style="padding:36px 40px 24px;color:#1e293b;font-size:15px;line-height:1.7;
                       font-family:Arial,Helvetica,sans-serif;">
              ${contentHtml}
            </td>
          </tr>

          <!-- ===== DIVIDER ===== -->
          <tr>
            <td style="padding:0 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="border-top:1px solid #e2e8f0;font-size:0;">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ===== FOOTER ===== -->
          <tr>
            <td align="center" style="padding:20px 40px 32px;">
              <p style="margin:0 0 4px;font-size:12px;color:#94a3b8;
                        font-family:Arial,Helvetica,sans-serif;">
                Sent by <strong style="color:#6c5ce7;">CorpGMS</strong>
                &nbsp;&middot;&nbsp; Corporate Guest Management System
              </p>
              <p style="margin:0;font-size:11px;color:#cbd5e1;
                        font-family:Arial,Helvetica,sans-serif;">
                This is an automated message. Please do not reply to this email.
              </p>
            </td>
          </tr>

        </table>
        <!-- /Card table -->

      </td>
    </tr>
  </table>
  <!-- /Outer wrapper -->

</body>
</html>`;
}

/* ─── Reusable inner-content helpers ─────────────────────────────────────── */

/** A styled info-row: label + value */
function infoRow(label, value) {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
         style="margin:6px 0;">
    <tr>
      <td width="140" style="font-size:13px;color:#64748b;font-weight:600;
                              vertical-align:top;padding:8px 12px 8px 0;
                              font-family:Arial,Helvetica,sans-serif;">
        ${label}
      </td>
      <td style="font-size:14px;color:#1e293b;font-weight:500;
                 vertical-align:top;padding:8px 12px;
                 background:#f8fafc;border-radius:6px;
                 font-family:Arial,Helvetica,sans-serif;">
        ${value}
      </td>
    </tr>
  </table>`;
}

/** A full-width CTA button */
function ctaButton(href, label, color) {
  const bg = color || '#6c5ce7';
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0"
         style="margin:20px 0;">
    <tr>
      <td align="left"
          style="background:${bg};border-radius:8px;">
        <a href="${href}"
           style="display:inline-block;padding:12px 28px;font-size:14px;
                  font-weight:700;color:#ffffff;text-decoration:none;
                  font-family:Arial,Helvetica,sans-serif;letter-spacing:0.3px;">
          ${label}
        </a>
      </td>
    </tr>
  </table>`;
}

/* ─── Email event templates ───────────────────────────────────────────────── */

module.exports = {
  APPOINTMENT_CREATED: async (p) => {
    const override = await loadDbTemplate('appointmentInvite');
    const tokenVars = {
      visitorName:   p.visitorName || '',
      scheduledDate: p.scheduledAt ? new Date(p.scheduledAt).toLocaleDateString('en-GB') : '',
      dateTime:      formatDate(p.scheduledAt),
      purpose:       p.purpose || p.title || '-',
      orgName:       p.officeName || '',
    };
    const subject = override?.subject
      ? fillTokens(override.subject, tokenVars)
      : `Appointment confirmed: ${p.title || 'Visit'}`;
    const bodyHtml = override?.body
      ? fillTokens(override.body, tokenVars)
      : `<p style="margin:0 0 20px;">Hello,</p>
       <p style="margin:0 0 20px;">Your appointment has been successfully scheduled. Here are the details:</p>
       ${infoRow('Title', `<strong>${p.title || '-'}</strong>`)}
       ${infoRow('Date &amp; Time', `<strong>${formatDate(p.scheduledAt)}</strong>`)}
       <p style="margin:20px 0 0;font-size:13px;color:#64748b;">
         Please arrive on time and carry a valid ID.
       </p>`;
    return {
      subject,
      html: wrap('Your appointment is scheduled', bodyHtml),
      text: `Appointment scheduled for ${formatDate(p.scheduledAt)} - ${p.title || ''}`,
    };
  },

  APPOINTMENT_REMINDER: (p) => ({
    subject: `Reminder: upcoming appointment at ${formatDate(p.scheduledAt)}`,
    html: wrap(
      'Appointment reminder',
      `<p style="margin:0 0 20px;">Hello,</p>
       <p style="margin:0 0 20px;">This is a friendly reminder about your upcoming appointment:</p>
       ${infoRow('Title', `<strong>${p.title || '-'}</strong>`)}
       ${infoRow('Date &amp; Time', `<strong>${formatDate(p.scheduledAt)}</strong>`)}
       <p style="margin:20px 0 0;font-size:13px;color:#64748b;">
         Please arrive on time and carry a valid ID.
       </p>`
    ),
    text: `Reminder: appointment ${p.title || ''} at ${formatDate(p.scheduledAt)}`,
  }),

  APPOINTMENT_CANCELLED: (p) => ({
    subject: 'Your appointment has been cancelled',
    html: wrap(
      'Appointment cancelled',
      `<p style="margin:0 0 20px;">Hello,</p>
       <p style="margin:0 0 20px;">We regret to inform you that your appointment has been cancelled.</p>
       ${infoRow('Reason', p.reason || 'Not specified')}
       <p style="margin:20px 0 0;font-size:13px;color:#64748b;">
         If you have any questions, please contact us directly.
       </p>`
    ),
    text: `Appointment cancelled. Reason: ${p.reason || 'Not specified'}`,
  }),

  GUEST_CHECKED_IN: (p) => ({
    subject: `Visitor arrived: ${p.fullName}`,
    html: wrap(
      'Your visitor has arrived',
      `<p style="margin:0 0 20px;">Hello,</p>
       <p style="margin:0 0 20px;">Your visitor has just checked in at the reception.</p>
       ${infoRow('Visitor', `<strong>${p.fullName}</strong>`)}
       ${infoRow('Badge No.', `<strong>${p.badgeNumber || '-'}</strong>`)}
       <p style="margin:20px 0 0;font-size:13px;color:#64748b;">
         Please head to the reception to greet your guest.
       </p>`
    ),
    text: `Visitor ${p.fullName} checked in. Badge ${p.badgeNumber || '-'}`,
  }),

  GUEST_CHECKED_OUT: (p) => ({
    subject: `Visitor checked out: ${p.fullName}`,
    html: wrap(
      'Visitor checked out',
      `<p style="margin:0 0 20px;">Hello,</p>
       <p style="margin:0 0 20px;">Your visitor has checked out.</p>
       ${infoRow('Visitor', `<strong>${p.fullName}</strong>`)}
       ${infoRow('Checked out at', `<strong>${formatDate(p.checkedOutAt)}</strong>`)}
      `
    ),
    text: `Visitor ${p.fullName} checked out at ${formatDate(p.checkedOutAt)}`,
  }),

  SERVICE_CREATED: (p) => ({
    subject: `New service request: ${p.title}`,
    html: wrap(
      'New service request assigned',
      `<p style="margin:0 0 20px;">Hello,</p>
       <p style="margin:0 0 20px;">A new service request has been assigned to you.</p>
       ${infoRow('Title', `<strong>${p.title}</strong>`)}
       ${infoRow('Priority', `<strong>${p.priority || 'NORMAL'}</strong>`)}
       <p style="margin:20px 0 0;font-size:13px;color:#64748b;">
         Please log in to CorpGMS to view and action this request.
       </p>`
    ),
    text: `New service request: ${p.title} (priority ${p.priority || 'NORMAL'})`,
  }),

  STAFF_INVITE: (p) => ({
    subject: `You've been invited to join ${p.orgName || 'our organisation'} on CorpGMS`,
    html: wrap(
      `Welcome to ${p.orgName || 'CorpGMS'}`,
      `<p style="margin:0 0 20px;">Hello ${p.name || ''},</p>
       <p style="margin:0 0 20px;">
         You have been invited to join <strong>${p.orgName || 'CorpGMS'}</strong>
         as a <strong>${p.role || 'team member'}</strong>.
         Use the credentials below to sign in and set up your account:
       </p>
       ${infoRow('Email', p.email)}
       ${infoRow('Temporary Password', `<code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;">${p.tempPassword || '(set by admin)'}</code>`)}
       ${p.inviteLink ? ctaButton(p.inviteLink, 'Accept Invitation', '#6c5ce7') : ''}
       <p style="margin:20px 0 0;font-size:13px;color:#64748b;">
         Please change your password after your first login.
       </p>`
    ),
    text: `You've been invited to join ${p.orgName || 'CorpGMS'} as ${p.role || 'a team member'}. Email: ${p.email} | Temporary password: ${p.tempPassword || '(set by admin)'}`,
  }),

  OFFICE_CREATED: (p) => ({
    subject: `Welcome — your office "${p.officeName}" is ready on ${p.platformName || 'CorpGMS'}`,
    html: wrap(
      `Welcome to ${p.orgName || 'CorpGMS'}`,
      `<p style="margin:0 0 20px;">Hello ${p.contactName || ''},</p>
       <p style="margin:0 0 20px;">
         A new office has been set up for you on <strong>${p.platformName || 'CorpGMS'}</strong>.
         Use the credentials below to sign in and finish your setup.
       </p>
       ${infoRow('Office', `<strong>${p.officeName}</strong>`)}
       ${infoRow('Office Code', p.officeCode)}
       ${infoRow('City', p.city || '-')}
       ${infoRow('Email', p.email)}
       ${infoRow('Temporary Password', `<code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;">${p.tempPassword}</code>`)}
       ${p.loginUrl ? ctaButton(p.loginUrl, 'Sign In to CorpGMS', '#0284c7') : ''}
       <p style="margin:20px 0 0;font-size:13px;color:#64748b;">
         Please change your password after your first sign-in.
       </p>`
    ),
    text: `New office "${p.officeName}" set up on ${p.platformName || 'CorpGMS'}. Sign in with ${p.email} / ${p.tempPassword} and change your password.`,
  }),

  PASSWORD_EXPIRY_WARNING: (p) => ({
    subject: `Your ${p.platformName || 'CorpGMS'} password has expired — please reset it`,
    html: wrap(
      'Password expired',
      `<p style="margin:0 0 20px;">Hello ${p.name || ''},</p>
       <p style="margin:0 0 20px;">
         Your password has not been changed for <strong>${p.expiryDays} days</strong>
         and has now expired in line with your organisation's security policy.
       </p>
       <p style="margin:0 0 20px;">
         Please sign in and choose a new password to continue using
         <strong>${p.platformName || 'CorpGMS'}</strong>.
       </p>
       ${p.loginUrl ? ctaButton(p.loginUrl, 'Reset Password', '#0284c7') : ''}`
    ),
    text: `Your ${p.platformName || 'CorpGMS'} password has expired. Please sign in and reset it.`,
  }),

  MAINTENANCE_NOTICE: (p) => ({
    subject: `Scheduled maintenance on ${p.platformName || 'CorpGMS'}`,
    html: wrap(
      'Scheduled maintenance',
      `<p style="margin:0 0 20px;">Hello,</p>
       <p style="margin:0 0 20px;">${p.message || 'We will be performing scheduled maintenance.'}</p>
       ${infoRow('Start', `<strong>${formatDate(p.startAt)}</strong>`)}
       ${infoRow('End', `<strong>${formatDate(p.endAt)}</strong>`)}
       <p style="margin:20px 0 0;font-size:13px;color:#64748b;">
         The platform may be temporarily unavailable during this window.
         We apologise for any inconvenience.
       </p>`
    ),
    text: `Scheduled maintenance on ${p.platformName || 'CorpGMS'} from ${formatDate(p.startAt)} to ${formatDate(p.endAt)}. ${p.message || ''}`,
  }),

  TRIAL_REMINDER: (p) => ({
    subject: `Your free trial ends in ${p.daysRemaining} day${p.daysRemaining === 1 ? '' : 's'}`,
    html: wrap(
      'Trial reminder',
      `<p style="margin:0 0 20px;">Hello ${p.name || ''},</p>
       <p style="margin:0 0 20px;">
         Your free trial of <strong>${p.platformName || 'CorpGMS'}</strong> ends in
         <strong>${p.daysRemaining} day${p.daysRemaining === 1 ? '' : 's'}</strong>
         on <strong>${formatDate(p.trialEndsAt)}</strong>.
       </p>
       <p style="margin:0 0 20px;">
         To continue without interruption, please choose a plan and complete your subscription.
       </p>
       ${p.upgradeUrl ? ctaButton(p.upgradeUrl, 'Upgrade Now', '#0284c7') : ''}`
    ),
    text: `Your ${p.platformName || 'CorpGMS'} free trial ends in ${p.daysRemaining} day${p.daysRemaining === 1 ? '' : 's'}. Upgrade to keep your access.`,
  }),

  APPOINTMENT_INVITATION: async (p) => {
    const override = await loadDbTemplate('appointmentInvite');
    const tokenVars = {
      visitorName:   p.visitorName || '',
      scheduledDate: p.scheduledAt ? new Date(p.scheduledAt).toLocaleDateString('en-GB') : '',
      dateTime:      formatDate(p.scheduledAt),
      purpose:       p.purpose || p.title || '-',
      orgName:       p.officeName || '',
    };
    const subject = override?.subject
      ? fillTokens(override.subject, tokenVars)
      : `Visit invitation: ${p.title || 'Appointment'} at ${p.officeName || 'our office'}`;
    const bodyHtml = override?.body
      ? fillTokens(override.body, tokenVars)
      : `<p style="margin:0 0 20px;">Hello ${p.visitorName || ''},</p>
       <p style="margin:0 0 20px;">
         <strong>${p.hostName || 'Your host'}</strong> has scheduled a visit for you.
         Here are the details:
       </p>
       ${infoRow('Date &amp; Time', `<strong>${formatDate(p.scheduledAt)}</strong>`)}
       ${infoRow('Office', p.officeName || '-')}
       ${infoRow('Address', p.officeAddress || '-')}
       ${infoRow('Purpose', p.purpose || p.title || '-')}
       ${p.instructions ? infoRow('Instructions', p.instructions) : ''}
       <p style="margin:20px 0 0;font-size:13px;color:#64748b;">
         Please arrive on time and carry a valid photo ID.
       </p>`;
    return {
      subject,
      html: wrap('You are invited', bodyHtml),
      text: `Appointment at ${formatDate(p.scheduledAt)}`,
    };
  },

  CHECK_IN_VISITOR: (p) => ({
    subject: `Check-in confirmed at ${p.officeName || 'our office'}`,
    html: wrap(
      'You are checked in',
      `<p style="margin:0 0 20px;">Hello ${p.visitorName || ''},</p>
       <p style="margin:0 0 20px;">You have been successfully checked in. Welcome!</p>
       ${infoRow('Office', `<strong>${p.officeName || '-'}</strong>`)}
       ${infoRow('Checked in at', `<strong>${formatDate(p.checkedInAt)}</strong>`)}
       ${infoRow('Host', `<strong>${p.hostName || '-'}</strong>`)}
       ${infoRow('Badge No.', `<strong>${p.badgeNumber || '-'}</strong>`)}
       <p style="margin:20px 0 0;font-size:13px;color:#64748b;">
         Your host has been notified of your arrival.
       </p>`
    ),
    text: `Check-in confirmed at ${p.officeName || ''} on ${formatDate(p.checkedInAt)}. Badge ${p.badgeNumber || '-'}.`,
  }),

  CHECK_IN_HOST: (p) => ({
    subject: `Your guest ${p.visitorName} has arrived`,
    html: wrap(
      'Your guest has arrived',
      `<p style="margin:0 0 20px;">Hello ${p.hostName || ''},</p>
       <p style="margin:0 0 20px;">Your guest has checked in and is waiting at reception.</p>
       ${infoRow('Guest', `<strong>${p.visitorName}</strong>`)}
       ${infoRow('Office', `<strong>${p.officeName || '-'}</strong>`)}
       ${infoRow('Appointment', p.title || '-')}
       ${infoRow('Badge No.', `<strong>${p.badgeNumber || '-'}</strong>`)}
       <p style="margin:20px 0 0;font-size:13px;color:#64748b;">
         Please head to reception to greet your guest.
       </p>`
    ),
    text: `Your guest ${p.visitorName} has arrived at ${p.officeName || ''}.`,
  }),

  SERVICE_UPDATED: (p) => ({
    subject: `Service request updated: ${p.title}`,
    html: wrap(
      'Service request status updated',
      `<p style="margin:0 0 20px;">Hello,</p>
       <p style="margin:0 0 20px;">A service request you are associated with has been updated.</p>
       ${infoRow('Title', `<strong>${p.title}</strong>`)}
       ${infoRow('Status', `<strong>${p.status || p.change || 'Updated'}</strong>`)}
       <p style="margin:20px 0 0;font-size:13px;color:#64748b;">
         Log in to CorpGMS to view the full details.
       </p>`
    ),
    text: `Service request ${p.title} - ${p.status || p.change || 'updated'}`,
  }),
};
