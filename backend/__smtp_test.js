'use strict';
require('dotenv').config();
const env = require('./src/config/env');
const { sendEmail } = require('./src/services/notification.service');

console.log('[test] env.smtp.host =', env.smtp.host);
console.log('[test] env.smtp.user =', env.smtp.user);
console.log('[test] env.smtp.fromAddress =', env.smtp.fromAddress);

(async () => {
  try {
    const r = await sendEmail({
      to: env.smtp.user,
      subject: 'CorpGMS Test - HTML Template Check',
      html: '<h1 style="color:#6c5ce7">Test Working!</h1><p>HTML email rendered correctly.</p>',
      text: 'Test Working!',
    });
    console.log('[test] Result:', JSON.stringify(r, null, 2));
  } catch (e) {
    console.error('[test] Error:', e && e.message ? e.message : e);
    if (e && e.stack) console.error(e.stack);
    process.exitCode = 1;
  }
  /* SMTP verify runs in the background with .then() — give it a beat
   * to land in the logger before we exit. */
  setTimeout(() => process.exit(process.exitCode || 0), 3000);
})();
