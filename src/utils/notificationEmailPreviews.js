/**
 * notificationEmailPreviews.js — stub email generators for Module 7.
 *
 * Pattern mirrors emailTemplates.js: every function returns a
 * { to, subject, html, text } envelope. No email is actually dispatched —
 * useNotificationTriggers() console.logs the envelope as a preview and a
 * production mailer will swap in behind the same shape.
 *
 * British English. AM/PM uppercase. Full stops on every sentence.
 * Trigger taxonomy (Module 7 Decision 2):
 *   appointment_approved  — Approved visitor / host CC
 *   appointment_cancelled — Cancelled visitor
 *   walkin_arrived        — Host ping
 *   vip_pending           — Director ping
 *   report_ready          — Requester (self-service download reminder)
 *   system_alert          — Director / Manager broadcast
 */

const SUPPORT_EMAIL_INDIA = 'support@corpgms.in';
const SUPPORT_EMAIL_UAE   = 'support@corpgms.ae';
const BRAND_NAME          = 'CorpGMS';

/* ────────────────────────────────────────────────────────────────────
 *   Shared helpers — kept small; mirror emailTemplates.js conventions.
 * ──────────────────────────────────────────────────────────────────── */

function escapeHtml(value) {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isIndia(country) { return /india/i.test(country || ''); }
function isUAE(country)   { return /(uae|united arab emirates|emirates)/i.test(country || ''); }

/** Select regional block (support email, timezone label) based on
 *  organisation country. Defaults to UAE for unknown values since the
 *  flagship tenant is UAE-based. */
export function pickRegion(country) {
  if (isIndia(country)) {
    return {
      region:        'IN',
      supportEmail:  SUPPORT_EMAIL_INDIA,
      timezoneLabel: 'IST (UTC+5:30)',
    };
  }
  if (isUAE(country)) {
    return {
      region:        'AE',
      supportEmail:  SUPPORT_EMAIL_UAE,
      timezoneLabel: 'GST (UTC+4:00)',
    };
  }
  return {
    region:        'AE',
    supportEmail:  SUPPORT_EMAIL_UAE,
    timezoneLabel: 'GST (UTC+4:00)',
  };
}

/** Render a branded HTML envelope around a body snippet. */
export function htmlShell({ subject, bodyHtml, supportEmail }) {
  return `<!doctype html>
<html lang="en-GB">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="font-family:'Outfit',Arial,sans-serif;background:#F0F9FF;padding:24px;color:#0C2340;">
  <table role="presentation" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background:#fff;border-radius:14px;padding:28px;box-shadow:0 2px 8px rgba(15,23,42,.06);">
    <tr><td>
      <h2 style="margin:0 0 12px;font-family:'Outfit',sans-serif;color:#0C2340;font-size:18px;">${escapeHtml(subject)}</h2>
      ${bodyHtml}
      <hr style="border:none;border-top:1px solid #E2E8F0;margin:22px 0 14px;" />
      <p style="font-size:11px;color:#94A3B8;margin:0;">
        ${BRAND_NAME} · For help, contact <a href="mailto:${escapeHtml(supportEmail)}" style="color:#0284C7;text-decoration:none;">${escapeHtml(supportEmail)}</a>.
      </p>
    </td></tr>
  </table>
</body>
</html>`;
}

/** Render a plain-text fallback for non-HTML clients. */
export function plainTextShell({ subject, lines, supportEmail }) {
  return [
    subject,
    ''.padEnd(subject.length, '='),
    '',
    ...lines,
    '',
    `— ${BRAND_NAME}`,
    `For help, contact ${supportEmail}.`,
  ].join('\n');
}

/* ────────────────────────────────────────────────────────────────────
 *   Per-trigger generators.
 *   Every function receives a context object with the minimum fields
 *   needed to render. Callers stamp extras (actorName, orgName) so
 *   the preview still makes sense in the console log.
 * ──────────────────────────────────────────────────────────────────── */

/** Appointment approved → visitor (optionally host). */
export function generateAppointmentApproved({ apt, approverName, org }) {
  const region      = pickRegion(org?.country);
  const visitorName = apt?.visitorName || 'Visitor';
  const hostName    = apt?.hostName    || '—';
  const dateLabel   = apt?.date || '';
  const timeLabel   = apt?.timeStart || '';
  const orgName     = org?.name || BRAND_NAME;
  const subject     = `Your appointment with ${orgName} has been approved.`;
  const bodyHtml = `
    <p style="margin:0 0 10px;">Dear ${escapeHtml(visitorName)},</p>
    <p style="margin:0 0 10px;">Your appointment with <strong>${escapeHtml(hostName)}</strong> on
    <strong>${escapeHtml(dateLabel)}</strong> at <strong>${escapeHtml(timeLabel)}</strong>
    (${escapeHtml(region.timezoneLabel)}) has been approved by ${escapeHtml(approverName || 'our team')}.</p>
    <p style="margin:0 0 10px;">Please arrive 5 minutes early with a valid photo ID for check-in.</p>
  `;
  return {
    to:       apt?.visitorEmail || '',
    subject,
    html:     htmlShell({ subject, bodyHtml, supportEmail: region.supportEmail }),
    text:     plainTextShell({
      subject,
      lines: [
        `Dear ${visitorName},`,
        ``,
        `Your appointment with ${hostName} on ${dateLabel} at ${timeLabel} (${region.timezoneLabel}) has been approved by ${approverName || 'our team'}.`,
        ``,
        `Please arrive 5 minutes early with a valid photo ID for check-in.`,
      ],
      supportEmail: region.supportEmail,
    }),
  };
}

/** Appointment cancelled → visitor. */
export function generateAppointmentCancelled({ apt, actorName, reason, org }) {
  const region      = pickRegion(org?.country);
  const visitorName = apt?.visitorName || 'Visitor';
  const dateLabel   = apt?.date || '';
  const timeLabel   = apt?.timeStart || '';
  const orgName     = org?.name || BRAND_NAME;
  const subject     = `Your appointment with ${orgName} has been cancelled.`;
  const reasonLine  = reason
    ? `<p style="margin:0 0 10px;">Reason: <em>${escapeHtml(reason)}</em>.</p>`
    : '';
  const bodyHtml = `
    <p style="margin:0 0 10px;">Dear ${escapeHtml(visitorName)},</p>
    <p style="margin:0 0 10px;">We regret to inform you that your appointment scheduled for
    <strong>${escapeHtml(dateLabel)}</strong> at <strong>${escapeHtml(timeLabel)}</strong>
    has been cancelled by ${escapeHtml(actorName || 'our team')}.</p>
    ${reasonLine}
    <p style="margin:0 0 10px;">If you would like to reschedule, please reply to this email or contact us directly.</p>
  `;
  return {
    to:      apt?.visitorEmail || '',
    subject,
    html:    htmlShell({ subject, bodyHtml, supportEmail: region.supportEmail }),
    text:    plainTextShell({
      subject,
      lines: [
        `Dear ${visitorName},`,
        ``,
        `We regret to inform you that your appointment scheduled for ${dateLabel} at ${timeLabel} has been cancelled by ${actorName || 'our team'}.`,
        reason ? `Reason: ${reason}.` : '',
        ``,
        `If you would like to reschedule, please reply to this email or contact us directly.`,
      ].filter(Boolean),
      supportEmail: region.supportEmail,
    }),
  };
}

/** Walk-in arrived → host ping. */
export function generateWalkInArrived({ visitor, host, org }) {
  const region      = pickRegion(org?.country);
  const hostName    = host?.name       || 'Host';
  const visitorName = visitor?.name    || 'Visitor';
  const company     = visitor?.company || '';
  const purpose     = visitor?.purpose || '';
  const arrivalTime = visitor?.arrivedAt || new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();
  const subject     = `Your visitor ${visitorName} has arrived.`;
  const bodyHtml = `
    <p style="margin:0 0 10px;">Hello ${escapeHtml(hostName)},</p>
    <p style="margin:0 0 10px;"><strong>${escapeHtml(visitorName)}</strong>${company ? ` from <strong>${escapeHtml(company)}</strong>` : ''} has checked in at reception at <strong>${escapeHtml(arrivalTime)}</strong> (${escapeHtml(region.timezoneLabel)}).</p>
    ${purpose ? `<p style="margin:0 0 10px;">Purpose: <em>${escapeHtml(purpose)}</em>.</p>` : ''}
    <p style="margin:0 0 10px;">Please head to reception to greet your visitor.</p>
  `;
  return {
    to:   host?.email || '',
    subject,
    html: htmlShell({ subject, bodyHtml, supportEmail: region.supportEmail }),
    text: plainTextShell({
      subject,
      lines: [
        `Hello ${hostName},`,
        ``,
        `${visitorName}${company ? ` from ${company}` : ''} has checked in at reception at ${arrivalTime} (${region.timezoneLabel}).`,
        purpose ? `Purpose: ${purpose}.` : '',
        ``,
        `Please head to reception to greet your visitor.`,
      ].filter(Boolean),
      supportEmail: region.supportEmail,
    }),
  };
}

/** VIP pending → Directors. */
export function generateVipPending({ apt, requesterName, org, directorEmails = [] }) {
  const region      = pickRegion(org?.country);
  const visitorName = apt?.visitorName || 'VIP Visitor';
  const dateLabel   = apt?.date || '';
  const timeLabel   = apt?.timeStart || '';
  const subject     = `VIP appointment pending approval — ${visitorName}.`;
  const bodyHtml = `
    <p style="margin:0 0 10px;">A VIP appointment has been requested and is awaiting your approval.</p>
    <ul style="margin:0 0 10px;padding-left:18px;">
      <li><strong>Visitor:</strong> ${escapeHtml(visitorName)}</li>
      <li><strong>Date:</strong> ${escapeHtml(dateLabel)} at ${escapeHtml(timeLabel)} (${escapeHtml(region.timezoneLabel)})</li>
      <li><strong>Requested by:</strong> ${escapeHtml(requesterName || '—')}</li>
    </ul>
    <p style="margin:0 0 10px;">Please review it in the Appointments module before the scheduled time.</p>
  `;
  return {
    to:   directorEmails.join(', ') || '',
    subject,
    html: htmlShell({ subject, bodyHtml, supportEmail: region.supportEmail }),
    text: plainTextShell({
      subject,
      lines: [
        `A VIP appointment has been requested and is awaiting your approval.`,
        ``,
        `Visitor: ${visitorName}`,
        `Date: ${dateLabel} at ${timeLabel} (${region.timezoneLabel})`,
        `Requested by: ${requesterName || '—'}`,
        ``,
        `Please review it in the Appointments module before the scheduled time.`,
      ],
      supportEmail: region.supportEmail,
    }),
  };
}

/** Report ready → requester. */
export function generateReportReady({ reportTitle, format, requester, org }) {
  const region     = pickRegion(org?.country);
  const subject    = `Your ${reportTitle} report is ready.`;
  const formatLbl  = (format || 'CSV').toUpperCase();
  const bodyHtml = `
    <p style="margin:0 0 10px;">Hello ${escapeHtml(requester?.name || '')},</p>
    <p style="margin:0 0 10px;">Your <strong>${escapeHtml(reportTitle)}</strong> export (${escapeHtml(formatLbl)}) has been generated successfully and downloaded to your device.</p>
    <p style="margin:0 0 10px;">If the download did not start, open the Reports module and re-run the export.</p>
  `;
  return {
    to:   requester?.email || '',
    subject,
    html: htmlShell({ subject, bodyHtml, supportEmail: region.supportEmail }),
    text: plainTextShell({
      subject,
      lines: [
        `Hello ${requester?.name || ''},`,
        ``,
        `Your ${reportTitle} export (${formatLbl}) has been generated successfully and downloaded to your device.`,
        ``,
        `If the download did not start, open the Reports module and re-run the export.`,
      ],
      supportEmail: region.supportEmail,
    }),
  };
}

/** System alert → Directors + Managers. */
export function generateSystemAlert({ title, detail, actorName, org, recipients = [] }) {
  const region   = pickRegion(org?.country);
  const subject  = `System alert: ${title}.`;
  const bodyHtml = `
    <p style="margin:0 0 10px;">A system alert has been raised.</p>
    <p style="margin:0 0 10px;"><strong>${escapeHtml(title)}</strong></p>
    ${detail ? `<p style="margin:0 0 10px;">${escapeHtml(detail)}</p>` : ''}
    ${actorName ? `<p style="margin:0 0 10px;">Raised by: ${escapeHtml(actorName)}.</p>` : ''}
    <p style="margin:0 0 10px;">Please investigate in the appropriate module.</p>
  `;
  return {
    to:   recipients.join(', ') || '',
    subject,
    html: htmlShell({ subject, bodyHtml, supportEmail: region.supportEmail }),
    text: plainTextShell({
      subject,
      lines: [
        `A system alert has been raised.`,
        ``,
        `${title}`,
        detail || '',
        actorName ? `Raised by: ${actorName}.` : '',
        ``,
        `Please investigate in the appropriate module.`,
      ].filter(Boolean),
      supportEmail: region.supportEmail,
    }),
  };
}
