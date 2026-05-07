/**
 * emailTemplates.js — pure functions that produce { to, subject, html, text }
 * envelopes for the three transactional emails fired by the access-request
 * workflow.
 *
 * Templates are split by country (India / UAE) so pricing currency, tax
 * lingo, payment provider and data-protection footer all match the buyer's
 * regulatory context. Anything else falls back to the generic envelope.
 *
 * British English in every subject and body. AM/PM is uppercase. Currency
 * is comma-separated with no space between symbol and value (₹12,490 /
 * INR 482,450) per the QA defect guide.
 *
 * No emails are actually dispatched here — the caller (AddOrgDrawer,
 * RequestDetailDrawer) console.logs the envelope as a preview and the
 * production backend will swap in a real mailer behind the same shape.
 */

const SUPPORT_EMAIL_INDIA = 'support@corpgms.in';
const SUPPORT_EMAIL_UAE   = 'support@corpgms.ae';
const WHATSAPP_INDIA      = '+91 80000 12345';
const WHATSAPP_UAE        = '+971 50 000 1234';
const LOGIN_URL           = 'https://guestm.netlify.app/login';

/* ────────────────────────────────────────────────────────────────────
 *   Helpers — currency formatting and HTML escaping.
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

function formatCurrency(amount, currency = 'INR') {
  const n = Number(amount) || 0;
  /* en-IN groups thousands the Indian way (1,00,000) for INR; en-GB keeps
     Western groupings for INR, GBP, SAR. */
  const locale = currency === 'INR' ? 'en-IN' : 'en-GB';
  const formatted = n.toLocaleString(locale, { maximumFractionDigits: 0 });
  if (currency === 'INR') return `\u20B9${formatted}`;          /* ₹12,490 */
  return `${currency}\u00A0${formatted}`;                        /* INR 482,450 — non-breaking space, still no plain space */
}

function isIndia(country)  { return /india/i.test(country || ''); }
function isUAE(country)    { return /(uae|united arab emirates|emirates)/i.test(country || ''); }

function pickRegion(country) {
  if (isIndia(country)) {
    return {
      region:        'IN',
      currency:      'INR',
      timezoneLabel: 'IST (UTC+5:30)',
      taxLabel:      'GST',
      paymentLine:   'Payments are processed securely via Razorpay or NEFT/RTGS.',
      complianceLine:
        'CorpGMS is compliant with the Digital Personal Data Protection Act, 2023 (DPDP Act).',
      supportEmail:  SUPPORT_EMAIL_INDIA,
      whatsapp:      WHATSAPP_INDIA,
    };
  }
  if (isUAE(country)) {
    return {
      region:        'AE',
      currency:      'INR',
      timezoneLabel: 'GST (UTC+4)',
      taxLabel:      'VAT',
      paymentLine:   'Payments are processed securely via Telr or Stripe.',
      complianceLine:
        'CorpGMS is compliant with UAE Federal Decree-Law No. 45 of 2021 on the Protection of Personal Data (PDPL).',
      supportEmail:  SUPPORT_EMAIL_UAE,
      whatsapp:      WHATSAPP_UAE,
    };
  }
  return {
    region:        'OTHER',
    currency:      'USD',
    timezoneLabel: 'UTC',
    taxLabel:      'Tax',
    paymentLine:   'Payments are processed securely via Stripe.',
    complianceLine:
      'CorpGMS follows GDPR-equivalent data protection standards.',
    supportEmail:  SUPPORT_EMAIL_UAE,
    whatsapp:      WHATSAPP_UAE,
  };
}

/* Shared HTML chrome — sky-gradient header, white body, soft footer.
   Inline styles only, since most enterprise mail clients strip <style>. */
function htmlShell({ heading, bodyHtml, region, supportEmail, whatsapp }) {
  return `<!doctype html>
<html lang="en-GB">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(heading)}</title>
  </head>
  <body style="margin:0;padding:0;background:#E0F2FE;font-family:'Plus Jakarta Sans',Arial,sans-serif;color:#0C2340;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#E0F2FE;padding:24px 0;">
      <tr><td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="background:#FFFFFF;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(14,165,233,0.10);">
          <tr>
            <td style="background:linear-gradient(135deg,#0EA5E9,#0D9488);padding:24px 28px;color:#FFFFFF;">
              <div style="font-family:Outfit,sans-serif;font-weight:800;font-size:18px;letter-spacing:-0.3px;">CorpGMS</div>
              <div style="font-size:12px;opacity:0.85;margin-top:2px;">Corporate Guest Management System</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <h1 style="margin:0 0 12px 0;font-family:Outfit,sans-serif;font-weight:800;font-size:22px;color:#0C2340;line-height:1.25;">${escapeHtml(heading)}</h1>
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="background:#F0F9FF;padding:18px 28px;border-top:1px solid #BAE6FD;font-size:12px;color:#6B7280;">
              <div>Need help? Email <a href="mailto:${escapeHtml(supportEmail)}" style="color:#0284C7;text-decoration:none;font-weight:600;">${escapeHtml(supportEmail)}</a> or WhatsApp <a href="https://wa.me/${escapeHtml(whatsapp.replace(/[^0-9]/g, ''))}" style="color:#0284C7;text-decoration:none;font-weight:600;">${escapeHtml(whatsapp)}</a>.</div>
              <div style="margin-top:6px;color:#9CA3AF;">© CorpGMS by 1XL Ventures Pvt. Ltd. · Region ${escapeHtml(region)} · All rights reserved.</div>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

/* ────────────────────────────────────────────────────────────────────
 *   Template overrides — Super Admin can customise the subject and
 *   body of each transactional email from Settings → Email Templates.
 *   The page persists overrides under `cgms_email_templates` and the
 *   next email picks them up automatically. Each generate*Email()
 *   function below merges its hardcoded defaults with the override.
 *
 *   Body overrides are inner HTML only; htmlShell() wraps them in the
 *   branded chrome so the recipient always sees the CorpGMS template.
 * ──────────────────────────────────────────────────────────────────── */

export const EMAIL_TEMPLATE_KEY = 'cgms_email_templates';

function loadTemplateOverride(key) {
  try {
    const raw = (typeof localStorage !== 'undefined') ? localStorage.getItem(EMAIL_TEMPLATE_KEY) : null;
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const t = parsed && parsed[key];
    if (!t) return null;
    return { subject: t.subject || null, body: t.body || null };
  } catch {
    return null;
  }
}

function fillTokens(tpl, vars) {
  return String(tpl || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, name) => {
    const v = vars[name];
    return v == null ? '' : String(v);
  });
}

/* ────────────────────────────────────────────────────────────────────
 *   1. Welcome email — fired when Super Admin creates an account.
 * ──────────────────────────────────────────────────────────────────── */

export function generateWelcomeEmail(org, owner, tempPassword, country) {
  const region = pickRegion(country || org?.country);
  const orgName     = org?.name     || 'your organisation';
  const ownerName   = owner?.fullName || owner?.name || 'there';
  const ownerEmail  = owner?.email  || '';
  const planLabel   = org?.plan     || 'Trial';
  const priceText   = org?.price ? formatCurrency(org.price, org?.currency || region.currency) : null;

  const override   = loadTemplateOverride('welcome');
  const tokenVars  = {
    ownerName,
    orgName,
    ownerEmail,
    tempPassword,
    planLabel,
    loginUrl: LOGIN_URL,
  };
  const subject = override?.subject
    ? fillTokens(override.subject, tokenVars)
    : `Welcome to CorpGMS — ${orgName} account is ready.`;

  const checklistItems = [
    'Log in using your business email and the temporary password below.',
    'Change your password immediately on first login.',
    'Add your offices, rooms and reception staff under Settings.',
    'Invite your team members and assign roles.',
    'Run a test walk-in check-in to verify badge printing and notifications.',
  ];

  const defaultBodyHtml = `
    <p style="margin:0 0 12px 0;font-size:14px;line-height:1.7;color:#374151;">Hello ${escapeHtml(ownerName)},</p>
    <p style="margin:0 0 16px 0;font-size:14px;line-height:1.7;color:#374151;">
      Your CorpGMS account for <strong style="color:#0C2340;">${escapeHtml(orgName)}</strong> is now active. You can log in straight away using the credentials below.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#E0F2FE;border:1px solid #BAE6FD;border-radius:10px;padding:14px 16px;margin:0 0 18px 0;">
      <tr><td style="font-size:12px;color:#6B7280;padding:2px 0;">Login URL</td>
          <td style="font-size:13px;color:#0C2340;font-weight:700;padding:2px 0;text-align:right;"><a href="${escapeHtml(LOGIN_URL)}" style="color:#0284C7;text-decoration:none;">${escapeHtml(LOGIN_URL)}</a></td></tr>
      <tr><td style="font-size:12px;color:#6B7280;padding:2px 0;">Email ID</td>
          <td style="font-size:13px;color:#0C2340;font-weight:700;padding:2px 0;text-align:right;">${escapeHtml(ownerEmail)}</td></tr>
      <tr><td style="font-size:12px;color:#6B7280;padding:2px 0;">Temporary Password</td>
          <td style="font-size:13px;color:#0C2340;font-weight:700;font-family:monospace;padding:2px 0;text-align:right;">${escapeHtml(tempPassword)}</td></tr>
      <tr><td style="font-size:12px;color:#6B7280;padding:2px 0;">Plan</td>
          <td style="font-size:13px;color:#0C2340;font-weight:700;padding:2px 0;text-align:right;">${escapeHtml(planLabel)}${priceText ? ` &middot; ${escapeHtml(priceText)} per month` : ''}</td></tr>
    </table>

    <p style="margin:0 0 8px 0;font-size:13px;color:#B45309;font-weight:700;">Important: change your password immediately on first login.</p>

    <h2 style="margin:18px 0 8px 0;font-family:Outfit,sans-serif;font-size:15px;color:#0C2340;">Your 5-step onboarding checklist</h2>
    <ol style="margin:0 0 16px 18px;padding:0;font-size:13px;line-height:1.8;color:#374151;">
      ${checklistItems.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
    </ol>

    <p style="margin:0 0 8px 0;font-size:12px;color:#6B7280;">${escapeHtml(region.paymentLine)} A ${escapeHtml(region.taxLabel)} invoice is generated automatically each billing cycle.</p>
    <p style="margin:0;font-size:12px;color:#6B7280;">All times shown in CorpGMS use your office timezone (default ${escapeHtml(region.timezoneLabel)}).</p>
    <p style="margin:14px 0 0 0;font-size:11px;color:#9CA3AF;">${escapeHtml(region.complianceLine)}</p>
  `;

  const bodyHtml = override?.body
    ? fillTokens(override.body, tokenVars)
    : defaultBodyHtml;

  const text = [
    `Hello ${ownerName},`,
    '',
    `Your CorpGMS account for ${orgName} is now active.`,
    '',
    `Login URL          : ${LOGIN_URL}`,
    `Email ID           : ${ownerEmail}`,
    `Temporary Password : ${tempPassword}`,
    `Plan               : ${planLabel}${priceText ? ` — ${priceText} per month` : ''}`,
    '',
    'Important: change your password immediately on first login.',
    '',
    'Your 5-step onboarding checklist:',
    ...checklistItems.map((item, idx) => `  ${idx + 1}. ${item}`),
    '',
    region.paymentLine,
    `A ${region.taxLabel} invoice is generated automatically each billing cycle.`,
    `All times shown in CorpGMS use your office timezone (default ${region.timezoneLabel}).`,
    '',
    region.complianceLine,
    '',
    `Need help? Email ${region.supportEmail} or WhatsApp ${region.whatsapp}.`,
    '',
    '— The CorpGMS Team',
  ].join('\n');

  return {
    to:      ownerEmail,
    subject,
    html:    htmlShell({ heading: `Welcome aboard, ${orgName}.`, bodyHtml, region: region.region, supportEmail: region.supportEmail, whatsapp: region.whatsapp }),
    text,
  };
}

/* ────────────────────────────────────────────────────────────────────
 *   2. Rejection email — fired when Super Admin rejects a request.
 * ──────────────────────────────────────────────────────────────────── */

export function generateRejectionEmail(request, reason) {
  const region    = pickRegion(request?.country);
  const orgName   = request?.orgName  || 'your organisation';
  const owner     = request?.ownerName || 'there';
  const to        = request?.businessEmail || '';
  const requestId = request?.id || '—';
  const cleanReason = (reason || '').toString().trim() || 'After reviewing your application we are unable to proceed at this time.';

  const override  = loadTemplateOverride('rejection');
  const tokenVars = { owner, ownerName: owner, orgName, requestId, reason: cleanReason };
  const subject   = override?.subject
    ? fillTokens(override.subject, tokenVars)
    : `Update on your CorpGMS access request (${requestId}).`;

  const defaultBodyHtml = `
    <p style="margin:0 0 12px 0;font-size:14px;line-height:1.7;color:#374151;">Hello ${escapeHtml(owner)},</p>
    <p style="margin:0 0 14px 0;font-size:14px;line-height:1.7;color:#374151;">
      Thank you for your interest in CorpGMS for <strong style="color:#0C2340;">${escapeHtml(orgName)}</strong>. We have completed our initial review of your access request <strong>${escapeHtml(requestId)}</strong>.
    </p>

    <div style="background:#FEF2F2;border:1px solid #FCA5A5;border-radius:10px;padding:14px 16px;margin:0 0 18px 0;font-size:13px;color:#7F1D1D;line-height:1.65;">
      ${escapeHtml(cleanReason)}
    </div>

    <p style="margin:0 0 12px 0;font-size:13px;line-height:1.7;color:#374151;">
      This decision is not necessarily final. If your circumstances change — for example, if your organisation grows beyond our minimum eligibility criteria or you can share additional verification — please reply to this email and we will revisit the application.
    </p>

    <p style="margin:0;font-size:12px;color:#6B7280;">${escapeHtml(region.complianceLine)}</p>
  `;

  const bodyHtml = override?.body
    ? fillTokens(override.body, tokenVars)
    : defaultBodyHtml;

  const text = [
    `Hello ${owner},`,
    '',
    `Thank you for your interest in CorpGMS for ${orgName}. We have completed our initial review of your access request ${requestId}.`,
    '',
    cleanReason,
    '',
    'This decision is not necessarily final. If your circumstances change please reply to this email and we will revisit the application.',
    '',
    `Need help? Email ${region.supportEmail} or WhatsApp ${region.whatsapp}.`,
    '',
    '— The CorpGMS Team',
  ].join('\n');

  return {
    to,
    subject,
    html: htmlShell({ heading: 'Access request update.', bodyHtml, region: region.region, supportEmail: region.supportEmail, whatsapp: region.whatsapp }),
    text,
  };
}

/* ────────────────────────────────────────────────────────────────────
 *   3. Information-request email — Super Admin asks for more detail.
 * ──────────────────────────────────────────────────────────────────── */

export function generateInfoRequestEmail(request, questions) {
  const region    = pickRegion(request?.country);
  const orgName   = request?.orgName  || 'your organisation';
  const owner     = request?.ownerName || 'there';
  const to        = request?.businessEmail || '';
  const requestId = request?.id || '—';

  const override  = loadTemplateOverride('infoRequest');
  const tokenVars = {
    owner,
    ownerName: owner,
    orgName,
    requestId,
    questions: (questions || '').toString(),
  };
  const lines     = (questions || '').toString().trim().split(/\r?\n/).filter(Boolean);
  const subject   = override?.subject
    ? fillTokens(override.subject, tokenVars)
    : `Additional information needed — CorpGMS access request (${requestId}).`;

  const defaultBodyHtml = `
    <p style="margin:0 0 12px 0;font-size:14px;line-height:1.7;color:#374151;">Hello ${escapeHtml(owner)},</p>
    <p style="margin:0 0 14px 0;font-size:14px;line-height:1.7;color:#374151;">
      Thank you for requesting CorpGMS access for <strong style="color:#0C2340;">${escapeHtml(orgName)}</strong>. Before we can complete the review of request <strong>${escapeHtml(requestId)}</strong>, we need a little more information.
    </p>

    <div style="background:#FFF7ED;border:1px solid #FED7AA;border-radius:10px;padding:14px 16px;margin:0 0 18px 0;font-size:13px;color:#7C2D12;line-height:1.65;">
      ${lines.length
        ? `<ul style="margin:0;padding-left:18px;">${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>`
        : escapeHtml(questions || 'Please reply to this email with any additional verification details available.')}
    </div>

    <p style="margin:0 0 12px 0;font-size:13px;line-height:1.7;color:#374151;">
      Please reply directly to this email — your response will be linked to your original request automatically. We aim to complete the review within one business day of receiving your reply.
    </p>

    <p style="margin:0;font-size:12px;color:#6B7280;">${escapeHtml(region.complianceLine)}</p>
  `;

  const bodyHtml = override?.body
    ? fillTokens(override.body, tokenVars)
    : defaultBodyHtml;

  const text = [
    `Hello ${owner},`,
    '',
    `Thank you for requesting CorpGMS access for ${orgName}. Before we can complete the review of request ${requestId}, we need a little more information.`,
    '',
    ...(lines.length ? lines.map((l) => `  • ${l}`) : ['  Please reply with any additional verification details available.']),
    '',
    'Please reply directly to this email — your response will be linked to your original request automatically.',
    '',
    `Need help? Email ${region.supportEmail} or WhatsApp ${region.whatsapp}.`,
    '',
    '— The CorpGMS Team',
  ].join('\n');

  return {
    to,
    subject,
    html: htmlShell({ heading: 'A few more details, please.', bodyHtml, region: region.region, supportEmail: region.supportEmail, whatsapp: region.whatsapp }),
    text,
  };
}

/* ────────────────────────────────────────────────────────────────────
 *   4. Staff invite email — fired when Director/SuperAdmin creates a
 *   new staff record with "Send invitation email" ticked.
 * ──────────────────────────────────────────────────────────────────── */

export function generateStaffInviteEmail(staff, tempPassword, org) {
  const region   = pickRegion(org?.country);
  const orgName  = org?.name || 'your organisation';
  const staffName = staff?.fullName || staff?.name || 'there';
  const to        = staff?.emailId || '';
  const roleLabel = staff?.role || 'Team Member';
  const designation = staff?.designation || '';
  const joining   = staff?.joiningDate
    ? new Date(`${staff.joiningDate}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
    : null;

  const override  = loadTemplateOverride('staffInvite');
  const tokenVars = {
    staffName,
    orgName,
    role: roleLabel,
    designation: designation || '',
    joiningDate: joining || '',
    tempPassword: tempPassword || '',
    emailId: to,
    loginUrl: LOGIN_URL,
  };
  const subject  = override?.subject
    ? fillTokens(override.subject, tokenVars)
    : `You have been invited to ${orgName} on CorpGMS.`;

  const defaultBodyHtml = `
    <p style="margin:0 0 12px 0;font-size:14px;line-height:1.7;color:#374151;">Hello ${escapeHtml(staffName)},</p>
    <p style="margin:0 0 14px 0;font-size:14px;line-height:1.7;color:#374151;">
      You have been invited to join <strong style="color:#0C2340;">${escapeHtml(orgName)}</strong> on CorpGMS as a <strong>${escapeHtml(roleLabel)}</strong>${designation ? ` (${escapeHtml(designation)})` : ''}. Your account is ready — log in using the credentials below.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#E0F2FE;border:1px solid #BAE6FD;border-radius:10px;padding:14px 16px;margin:0 0 18px 0;">
      <tr><td style="font-size:12px;color:#6B7280;padding:2px 0;">Login URL</td>
          <td style="font-size:13px;color:#0C2340;font-weight:700;padding:2px 0;text-align:right;"><a href="${escapeHtml(LOGIN_URL)}" style="color:#0284C7;text-decoration:none;">${escapeHtml(LOGIN_URL)}</a></td></tr>
      <tr><td style="font-size:12px;color:#6B7280;padding:2px 0;">Email ID</td>
          <td style="font-size:13px;color:#0C2340;font-weight:700;padding:2px 0;text-align:right;">${escapeHtml(to)}</td></tr>
      <tr><td style="font-size:12px;color:#6B7280;padding:2px 0;">Temporary Password</td>
          <td style="font-size:13px;color:#0C2340;font-weight:700;font-family:monospace;padding:2px 0;text-align:right;">${escapeHtml(tempPassword || '')}</td></tr>
      <tr><td style="font-size:12px;color:#6B7280;padding:2px 0;">Role</td>
          <td style="font-size:13px;color:#0C2340;font-weight:700;padding:2px 0;text-align:right;">${escapeHtml(roleLabel)}</td></tr>
      ${joining ? `<tr><td style="font-size:12px;color:#6B7280;padding:2px 0;">Joining Date</td>
          <td style="font-size:13px;color:#0C2340;font-weight:700;padding:2px 0;text-align:right;">${escapeHtml(joining)}</td></tr>` : ''}
    </table>

    <p style="margin:0 0 8px 0;font-size:13px;color:#B45309;font-weight:700;">Important: you will be required to change this password on first login.</p>

    <p style="margin:14px 0 8px 0;font-size:13px;color:#374151;">
      Once you log in you will land on the Dashboard. A yellow banner will remind you to update your password — please do so before continuing.
    </p>

    <p style="margin:0;font-size:12px;color:#6B7280;">${escapeHtml(region.paymentLine ? '' : '')}If you were not expecting this invitation, please reply to this email and we will remove your account.</p>
    <p style="margin:14px 0 0 0;font-size:11px;color:#9CA3AF;">${escapeHtml(region.complianceLine)}</p>
  `;

  const bodyHtml = override?.body
    ? fillTokens(override.body, tokenVars)
    : defaultBodyHtml;

  const text = [
    `Hello ${staffName},`,
    '',
    `You have been invited to join ${orgName} on CorpGMS as a ${roleLabel}${designation ? ` (${designation})` : ''}.`,
    '',
    `Login URL          : ${LOGIN_URL}`,
    `Email ID           : ${to}`,
    `Temporary Password : ${tempPassword || ''}`,
    `Role               : ${roleLabel}`,
    joining ? `Joining Date       : ${joining}` : null,
    '',
    'Important: you will be required to change this password on first login.',
    '',
    'Once logged in a yellow banner will remind you to update your password — please do so before continuing.',
    '',
    `Need help? Email ${region.supportEmail} or WhatsApp ${region.whatsapp}.`,
    '',
    region.complianceLine,
    '',
    '— The CorpGMS Team',
  ].filter(Boolean).join('\n');

  return {
    to,
    subject,
    html: htmlShell({ heading: `Welcome to ${orgName}.`, bodyHtml, region: region.region, supportEmail: region.supportEmail, whatsapp: region.whatsapp }),
    text,
  };
}

/**
 * previewEmail — convenience helper used by the UI to dispatch
 * transactional emails. It console.logs a preview AND POSTs the
 * envelope to the backend at /api/v1/notifications/dispatch which
 * triggers the real SMTP send (or the dev JSON-stream fallback if
 * SMTP credentials aren't configured). Fire-and-forget — failures
 * are logged but never block the UI.
 *
 * Usage:
 *   previewEmail(generateStaffInviteEmail(staff, tempPassword, org));
 */
const EMAIL_DISPATCH_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) ||
  '/api/v1';

export function generateAppointmentInviteEmail({ visitorName, scheduledDate, startTime, purpose, orgName, orgCountry, visitorEmail }) {
  const supportEmail = orgCountry === 'India' ? 'support@corpgms.in' : 'support@corpgms.ae';
  const whatsapp    = orgCountry === 'India' ? '+91 80000 12345' : '+971 50 000 1234';
  const region      = orgCountry === 'India' ? 'IN' : 'UAE';
  const dateStr     = `${scheduledDate || ''}${startTime ? ' at ' + startTime : ''}`.trim();

  const override   = loadTemplateOverride('appointmentInvite');
  const tokenVars  = {
    visitorName: visitorName || 'Visitor',
    scheduledDate: scheduledDate || '',
    startTime: startTime || '',
    dateTime: dateStr,
    purpose: purpose || '-',
    orgName: orgName || 'CorpGMS',
  };
  const subject = override?.subject
    ? fillTokens(override.subject, tokenVars)
    : `Appointment confirmed: ${purpose || 'Visit'} on ${scheduledDate || ''}`;

  const defaultBodyHtml = `
    <p style="margin:0 0 12px;font-size:14px;line-height:1.7;color:#374151;">
      Hello <strong style="color:#0C2340;">${escapeHtml(visitorName || 'Visitor')}</strong>,
    </p>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:#374151;">
      Your appointment has been confirmed. Here are your details:
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"
           style="width:100%;background:#F0F9FF;border-radius:10px;padding:16px 20px;margin-bottom:20px;">
      <tr>
        <td style="font-size:13px;color:#6B7280;padding:6px 0;width:130px;">Date &amp; Time</td>
        <td style="font-size:14px;color:#0C2340;font-weight:700;padding:6px 0;">${escapeHtml(dateStr)}</td>
      </tr>
      <tr>
        <td style="font-size:13px;color:#6B7280;padding:6px 0;">Purpose</td>
        <td style="font-size:14px;color:#0C2340;font-weight:700;padding:6px 0;">${escapeHtml(purpose || '-')}</td>
      </tr>
      <tr>
        <td style="font-size:13px;color:#6B7280;padding:6px 0;">Organisation</td>
        <td style="font-size:14px;color:#0C2340;font-weight:700;padding:6px 0;">${escapeHtml(orgName || 'CorpGMS')}</td>
      </tr>
    </table>
    <p style="margin:0;font-size:13px;color:#6B7280;">Please carry a valid photo ID and arrive on time.</p>`;

  const bodyHtml = override?.body
    ? fillTokens(override.body, tokenVars)
    : defaultBodyHtml;

  const envelope = {
    subject,
    html: htmlShell({ heading: 'Your appointment is confirmed', bodyHtml, region, supportEmail, whatsapp }),
    text: `Hello ${visitorName || 'Visitor'},\n\nDate & Time: ${dateStr}\nPurpose: ${purpose || '-'}\nOrg: ${orgName || 'CorpGMS'}\n\nPlease carry valid ID.\n\n— CorpGMS`,
  };
  if (visitorEmail) envelope.to = visitorEmail;
  return envelope;
}

/* ────────────────────────────────────────────────────────────────────
 *   5. Walk-in arrival email — branded confirmation that goes out to
 *   a walk-in visitor when reception captures their email at the
 *   front desk. Editable from Settings → Email Templates (key:
 *   `walkInArrival`).
 * ──────────────────────────────────────────────────────────────────── */

export function generateWalkInArrivalEmail({ visitorName, visitorEmail, orgName, officeName, orgCountry, hostName, badgeNumber }) {
  const region   = pickRegion(orgCountry);
  const override = loadTemplateOverride('walkInArrival');
  const tokenVars = {
    visitorName: visitorName || 'Visitor',
    orgName: orgName || 'CorpGMS',
    officeName: officeName || '',
    hostName: hostName || '',
    badgeNumber: badgeNumber || '',
  };
  const subject = override?.subject
    ? fillTokens(override.subject, tokenVars)
    : `Welcome to ${orgName || 'CorpGMS'} — your visit is being processed.`;

  const defaultBodyHtml = `
    <p style="margin:0 0 12px;font-size:14px;line-height:1.7;color:#374151;">
      Hello <strong style="color:#0C2340;">${escapeHtml(visitorName || 'Visitor')}</strong>,
    </p>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:#374151;">
      Thank you for visiting <strong style="color:#0C2340;">${escapeHtml(orgName || 'CorpGMS')}</strong>${officeName ? ` — ${escapeHtml(officeName)}` : ''}. Your check-in is complete.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"
           style="width:100%;background:#F0F9FF;border-radius:10px;padding:16px 20px;margin-bottom:20px;">
      ${badgeNumber ? `<tr>
        <td style="font-size:13px;color:#6B7280;padding:6px 0;width:130px;">Badge No.</td>
        <td style="font-size:14px;color:#0C2340;font-weight:700;padding:6px 0;">${escapeHtml(badgeNumber)}</td>
      </tr>` : ''}
      ${hostName ? `<tr>
        <td style="font-size:13px;color:#6B7280;padding:6px 0;">Host</td>
        <td style="font-size:14px;color:#0C2340;font-weight:700;padding:6px 0;">${escapeHtml(hostName)}</td>
      </tr>` : ''}
      <tr>
        <td style="font-size:13px;color:#6B7280;padding:6px 0;">Organisation</td>
        <td style="font-size:14px;color:#0C2340;font-weight:700;padding:6px 0;">${escapeHtml(orgName || 'CorpGMS')}</td>
      </tr>
    </table>
    <p style="margin:0;font-size:13px;color:#6B7280;">Please return your visitor badge at reception when you leave.</p>`;

  const bodyHtml = override?.body
    ? fillTokens(override.body, tokenVars)
    : defaultBodyHtml;

  return {
    to: visitorEmail || '',
    subject,
    html: htmlShell({ heading: `Welcome to ${orgName || 'CorpGMS'}`, bodyHtml, region: region.region, supportEmail: region.supportEmail, whatsapp: region.whatsapp }),
    text: `Hello ${visitorName || 'Visitor'},\n\nThank you for visiting ${orgName || 'CorpGMS'}${officeName ? ' — ' + officeName : ''}. Your check-in is complete.\n\n${badgeNumber ? 'Badge No.: ' + badgeNumber + '\n' : ''}${hostName ? 'Host: ' + hostName + '\n' : ''}\n— CorpGMS`,
  };
}

export function previewEmail(envelope) {
  if (!envelope || typeof envelope !== 'object') return;
  /* eslint-disable no-console */
  console.groupCollapsed(
    `%c[CorpGMS Email]%c → ${envelope.to || '(no recipient)'} · ${envelope.subject || ''}`,
    'color:#0EA5E9;font-weight:700;',
    'color:#374151;font-weight:500;',
  );
  console.log('Subject:', envelope.subject);
  console.log('To     :', envelope.to);
  console.log('-------- TEXT --------');
  console.log(envelope.text);
  console.log('-------- HTML --------');
  console.log(envelope.html);
  console.groupEnd();
  /* eslint-enable no-console */

  /* Bug 3+4 fix: actually dispatch the email through the backend.
     We don't await — the calling flow finishes immediately and the
     send happens in the background. */
  if (envelope.to && envelope.subject) {
    try {
      fetch(`${EMAIL_DISPATCH_BASE}/notifications/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: envelope.to,
          subject: envelope.subject,
          html: envelope.html || '',
          text: envelope.text || '',
        }),
      })
        .then(async (res) => {
          let body = {};
          try { body = await res.json(); } catch { /* ignore */ }
          if (!res.ok || body.success === false) {
            console.warn('[CorpGMS Email] dispatch returned an error:', res.status, body);
          } else if (body.skipped) {
            console.warn('[CorpGMS Email] dispatch skipped (no SMTP recipient or transport).');
          } else {
            console.info('[CorpGMS Email] dispatched via backend.');
          }
        })
        .catch((err) => {
          console.warn('[CorpGMS Email] backend dispatch network error:', err && err.message ? err.message : err);
        });
    } catch (err) {
      console.warn('[CorpGMS Email] dispatch threw synchronously:', err);
    }
  }
}
