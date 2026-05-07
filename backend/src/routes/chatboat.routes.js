'use strict';

const express = require('express');
const router = express.Router();

let logger;
try { logger = require('../config/logger'); } catch { logger = { error: console.error, warn: console.warn, info: console.info }; }

/* ─────────────────────────────────────────────────────────────
   Bug 5 fix: when ANTHROPIC_API_KEY is missing, return a helpful
   keyword-based fallback instead of a 500 error so the chatbot
   stays usable for demo / development. The fallback shape mirrors
   the Anthropic API response so the frontend renders it directly.
   ───────────────────────────────────────────────────────────── */
const FALLBACK_KB = [
  { match: /role|permission|admin|director|manager|reception|service/i,
    reply: 'CorpGMS supports five roles:\n- **Super Admin** — platform owner across organisations\n- **Director** — full org access\n- **Manager** — appointments, rooms, staff, day-to-day ops\n- **Reception** — walk-ins, check-in/check-out\n- **Service Staff** — pantry / facility / logistics tasks' },
  { match: /appointment|book|schedule/i,
    reply: 'To add an appointment:\n1. Open the Appointments module\n2. Click **New Appointment**\n3. Fill in guest details, host, date and time\n4. Save — the visitor receives an email confirmation' },
  { match: /walk[- ]?in|check[- ]?in/i,
    reply: 'Walk-in check-in: open the Walk-In wizard, capture the visitor photo, verify ID, then issue a badge.' },
  { match: /coupon|discount/i,
    reply: 'Super Admins create coupons under the Coupons module — set discount type (% or flat), usage limits and validity dates.' },
  { match: /report|export/i,
    reply: 'Reports → choose office/date range → export as Excel, CSV or PDF.' },
  { match: /module|feature/i,
    reply: 'Modules: Dashboard, Guest Log, Walk-In, Appointments, Rooms, Staff, Services, Offices, Coupons, Referrals, Integrations.' },
];

function buildFallbackReply(messages) {
  const last = Array.isArray(messages) && messages.length
    ? String(messages[messages.length - 1]?.content || '')
    : '';
  for (const entry of FALLBACK_KB) {
    if (entry.match.test(last)) return entry.reply;
  }
  return "Hi! I'm the CorpGMS Assistant (running in offline fallback mode — no API key configured on the server).\n\nTry asking about:\n- modules and features\n- user roles\n- appointments / walk-in check-in\n- coupons or reports";
}

/**
 * POST /api/v1/chatbot/message
 * Proxies the request to Anthropic API using the server-side API key.
 */
router.post('/message', async (req, res) => {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || apiKey.includes('replace_with')) {
      logger.warn('[chatbot] ANTHROPIC_API_KEY missing or placeholder — returning fallback response.');
      const reply = buildFallbackReply(req.body && req.body.messages);
      return res.json({
        content: [{ type: 'text', text: reply }],
        _fallback: true,
      });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(req.body),
    });

    const text = await response.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; }
    catch {
      logger.error('[chatbot] Anthropic returned non-JSON: ' + text.slice(0, 200));
      return res.status(502).json({ error: { message: 'Upstream returned non-JSON response' } });
    }

    if (!response.ok) {
      logger.error(`[chatbot] Anthropic ${response.status}: ${JSON.stringify(data).slice(0, 300)}`);
      return res.status(response.status).json(data);
    }

    return res.json(data);
  } catch (err) {
    logger.error('[chatbot] proxy error: ' + (err && err.stack ? err.stack : err));
    return res.status(500).json({ error: { message: err.message || 'Internal server error' } });
  }
});

module.exports = router;
