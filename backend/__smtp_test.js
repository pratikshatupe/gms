'use strict';
/**
 * SMTP smoke-test — DEV ONLY.
 *
 *   node __smtp_test.js [recipient@example.com]
 *
 * Confirms env loading, runs transporter.verify(), and sends a test
 * password-reset OTP email. Defaults to the SMTP_USER inbox so it is
 * always safe to run without arguments. Never expose this as an HTTP
 * endpoint — it is intentionally just a CLI helper.
 */
require('dotenv').config();
const env = require('./src/config/env');
const {
  sendEmail,
  verifySmtp,
  smtpConfigStatus,
} = require('./src/services/notification.service');
const emailTemplates = require('./src/templates/email.templates');

const recipient = (process.argv[2] || env.smtp.user || '').trim();

(async () => {
  const cfg = smtpConfigStatus();
  console.log('[smtp-test] config:', JSON.stringify(cfg, null, 2));
  if (!cfg.isConfigured) {
    console.error('[smtp-test] SMTP not fully configured — set SMTP_HOST, SMTP_USER, SMTP_PASSWORD in backend/.env.');
    process.exit(2);
  }
  if (!recipient) {
    console.error('[smtp-test] No recipient. Pass one as argv: node __smtp_test.js you@example.com');
    process.exit(2);
  }

  const verifyResult = await verifySmtp();
  if (!verifyResult.ok) {
    console.error('[smtp-test] Verify failed:', verifyResult);
    process.exit(1);
  }

  const tpl = emailTemplates.PASSWORD_RESET_OTP({
    name: 'Tester',
    email: recipient,
    otp: '123456',
    expiresInMinutes: 10,
    platformName: env.smtp.fromName || 'CorpGMS',
  });

  try {
    const r = await sendEmail({
      to: recipient,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
    });
    console.log('[smtp-test] sendEmail result:', JSON.stringify(r, null, 2));
    console.log('[smtp-test] Done. Check inbox + spam for', recipient);
    process.exit(0);
  } catch (e) {
    console.error('[smtp-test] sendEmail threw:', e && e.message ? e.message : e);
    if (e && e.stack) console.error(e.stack);
    process.exit(1);
  }
})();
