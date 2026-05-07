/**
 * Frontend-only messaging stub — simulates sending email / WhatsApp messages
 * without a backend. Each "delivery" is logged to localStorage and printed to
 * the console so QA and the user can verify what *would* have been sent.
 *
 * Swap these functions out for real API calls once a backend exists.
 *
 *   sendEmail({ to, subject, message, meta }) → Promise<Delivery>
 *   sendWhatsApp({ to, message, meta })       → Promise<Delivery>
 *   notifyVia(channels, payload)              → Promise<Delivery[]>
 *
 * Delivery shape:
 *   { id, channel: 'email' | 'whatsapp', to, subject?, message, status,
 *     meta, queuedAt, sentAt }
 */

export const MESSAGE_LOG_KEY = 'cgms.messageLog.v1';
export const MESSAGE_LOG_EVENT = 'messages-updated';

const MAX_LOG_ENTRIES = 200;

function makeId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `msg-${crypto.randomUUID()}`;
  }
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function readMessageLog() {
  try {
    const raw = localStorage.getItem(MESSAGE_LOG_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeMessageLog(next) {
  try {
    const trimmed = next.slice(0, MAX_LOG_ENTRIES);
    localStorage.setItem(MESSAGE_LOG_KEY, JSON.stringify(trimmed));
    window.dispatchEvent(new Event(MESSAGE_LOG_EVENT));
  } catch {
    /* quota or disabled — non-fatal */
  }
}

function recordDelivery(entry) {
  const current = readMessageLog();
  writeMessageLog([entry, ...current]);
}

function simulateLatency() {
  return 250 + Math.floor(Math.random() * 300);
}

function send(channel, payload) {
  return new Promise((resolve) => {
    const entry = {
      id:       makeId(),
      channel,
      to:       payload?.to || '',
      subject:  payload?.subject || '',
      message:  payload?.message || '',
      meta:     payload?.meta || {},
      status:   'queued',
      queuedAt: new Date().toISOString(),
      sentAt:   null,
    };
    setTimeout(() => {
      entry.status = 'sent';
      entry.sentAt = new Date().toISOString();
      recordDelivery(entry);
      /* eslint-disable no-console */
      if (typeof console !== 'undefined' && console.info) {
        console.info(
          `[${channel.toUpperCase()} STUB] → ${entry.to || '(unknown)'}`,
          entry.subject ? `· ${entry.subject}` : '',
          '\n',
          entry.message,
        );
      }
      /* eslint-enable no-console */
      resolve(entry);
    }, simulateLatency());
  });
}

export function sendEmail(payload) {
  return send('email', payload);
}

export function sendWhatsApp(payload) {
  return send('whatsapp', payload);
}

/**
 * Fan out a payload to one or more channels.
 *   channels — ['email'] | ['whatsapp'] | ['email','whatsapp']
 *   payload  — { to, subject, message, meta }
 */
export function notifyVia(channels, payload) {
  const list = Array.isArray(channels) ? channels : [channels];
  return Promise.all(
    list.map((c) => (c === 'whatsapp' ? sendWhatsApp(payload) : sendEmail(payload))),
  );
}

export function clearMessageLog() {
  writeMessageLog([]);
}
