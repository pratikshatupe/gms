/**
 * requestValidation.js — client-side validators for the public
 * "Request Organisation Access" form and the Super Admin "Add
 * Organisation" drawer.
 *
 * All `valid: false` results MUST carry a field-specific `reason`
 * ending in a full stop, per the QA defect guide (Rule: every
 * error message ends with a full stop and is field-specific).
 *
 * British English throughout. No special characters, no whitespace
 * in placeholders, no Indian/UAE-only assumptions in shared helpers.
 */

/* Personal email domains that must be rejected for B2B onboarding. */
export const BLOCKED_EMAIL_DOMAINS = Object.freeze([
  'gmail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'rediffmail.com',
  'icloud.com',
  'aol.com',
  'live.com',
  'protonmail.com',
  'yandex.com',
  'gmx.com',
  'mail.com',
]);

/* Country code → expected mobile number length (digits only). */
export const PHONE_LENGTH_BY_COUNTRY = Object.freeze({
  IN: 10,   /* India */
  AE: 9,    /* United Arab Emirates */
  SA: 9,    /* Saudi Arabia */
  GB: 10,   /* United Kingdom — mobile (excluding leading 0) */
  US: 10,
  QA: 8,
  OM: 8,
  KW: 8,
  BH: 8,
});

/* Country code → ISO dial code, used by the country-code dropdown. */
export const DIAL_CODES = Object.freeze({
  IN: '+91',
  AE: '+971',
  SA: '+966',
  GB: '+44',
  US: '+1',
  QA: '+974',
  OM: '+968',
  KW: '+965',
  BH: '+973',
});

/* Loose RFC 5322-compatible regex. Strict enough for public B2B forms,
   not pedantic enough to reject legitimate addresses. */
const EMAIL_REGEX =
  /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

const isBlank = (value) =>
  value == null || String(value).trim().length === 0;

/* Reject strings that contain ONLY symbols/punctuation with no letters
   and no digits — used by org name / full name guards. */
const isOnlySpecial = (value) =>
  /^[^\p{L}\p{N}]+$/u.test(String(value || '').trim());

/**
 * validateBusinessEmail — rejects empty, malformed, or personal-domain
 * addresses. The `reason` is the exact text the form should surface
 * under the field; it always ends in a full stop.
 *
 *   validateBusinessEmail('rahul@gmail.com')
 *   // → { valid: false, reason: 'Please use a business email address — personal domains are not accepted.' }
 */
export function validateBusinessEmail(email) {
  if (isBlank(email)) {
    return { valid: false, reason: 'Email ID is required.' };
  }
  const trimmed = String(email).trim();
  if (trimmed.length > 254) {
    return { valid: false, reason: 'Email ID is too long.' };
  }
  if (!EMAIL_REGEX.test(trimmed)) {
    return { valid: false, reason: 'Please enter a valid email address.' };
  }
  const domain = trimmed.split('@')[1].toLowerCase();
  if (BLOCKED_EMAIL_DOMAINS.includes(domain)) {
    return {
      valid: false,
      reason:
        'Please use a business email address — personal domains are not accepted.',
    };
  }
  return { valid: true };
}

/**
 * validateGSTIndia — official 15-character GSTIN format:
 *   2 digits state code | 5 letters PAN | 4 digits PAN | 1 letter PAN
 *   1 alphanumeric entity | 'Z' | 1 alphanumeric checksum
 */
const GST_REGEX =
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{1}Z[0-9A-Z]{1}$/;

export function validateGSTIndia(gst) {
  if (isBlank(gst)) {
    return { valid: false, reason: 'GST Number is required.' };
  }
  const trimmed = String(gst).trim().toUpperCase();
  if (!GST_REGEX.test(trimmed)) {
    return {
      valid: false,
      reason: 'Please enter a valid 15-character GSTIN.',
    };
  }
  return { valid: true, normalised: trimmed };
}

/**
 * validateTradeLicenseUAE — alphanumeric, 6–15 characters. The UAE
 * does not publish a single canonical format (Dubai DED, Abu Dhabi
 * ADDED and free-zone authorities all differ), so we keep the rule
 * tolerant but block obviously invalid input.
 */
const TRADE_LICENSE_REGEX = /^[A-Z0-9-]{6,15}$/;

export function validateTradeLicenseUAE(license) {
  if (isBlank(license)) {
    return { valid: false, reason: 'Trade License Number is required.' };
  }
  const trimmed = String(license).trim().toUpperCase();
  if (!TRADE_LICENSE_REGEX.test(trimmed)) {
    return {
      valid: false,
      reason:
        'Trade License Number must be 6 to 15 alphanumeric characters.',
    };
  }
  return { valid: true, normalised: trimmed };
}

/**
 * validatePhone — country-specific length check on the digits-only
 * portion of the number. Strips spaces, hyphens and brackets before
 * counting. Does not validate the country code itself; that is owned
 * by the dropdown.
 */
export function validatePhone(phone, countryCode = 'IN') {
  if (isBlank(phone)) {
    return { valid: false, reason: 'Contact Number is required.' };
  }
  const digits = String(phone).replace(/[^0-9]/g, '');
  const expected = PHONE_LENGTH_BY_COUNTRY[countryCode] || 10;
  if (digits.length !== expected) {
    return {
      valid: false,
      reason: `Contact Number must be exactly ${expected} digits.`,
    };
  }
  return { valid: true, normalised: digits };
}

/**
 * validateOrgName — 2..100 chars, must contain at least one
 * letter or digit. Rejects empty strings, whitespace-only entries
 * and entries made entirely of punctuation.
 */
export function validateOrgName(name) {
  if (isBlank(name)) {
    return { valid: false, reason: 'Organisation Name is required.' };
  }
  const trimmed = String(name).trim();
  if (trimmed.length < 2) {
    return {
      valid: false,
      reason: 'Organisation Name must be at least 2 characters.',
    };
  }
  if (trimmed.length > 100) {
    return {
      valid: false,
      reason: 'Organisation Name must be 100 characters or fewer.',
    };
  }
  if (isOnlySpecial(trimmed)) {
    return {
      valid: false,
      reason: 'Organisation Name must include letters or numbers.',
    };
  }
  return { valid: true, normalised: trimmed };
}

/**
 * validateFullName — used by the requester / owner field. Same
 * rules as validateOrgName but with a different label for the
 * error message so the form can surface it directly.
 */
export function validateFullName(name) {
  if (isBlank(name)) {
    return { valid: false, reason: 'Full Name is required.' };
  }
  const trimmed = String(name).trim();
  if (trimmed.length < 2) {
    return {
      valid: false,
      reason: 'Full Name must be at least 2 characters.',
    };
  }
  if (trimmed.length > 80) {
    return {
      valid: false,
      reason: 'Full Name must be 80 characters or fewer.',
    };
  }
  if (isOnlySpecial(trimmed)) {
    return {
      valid: false,
      reason: 'Full Name must include letters.',
    };
  }
  return { valid: true, normalised: trimmed };
}

/**
 * validateRequired — generic "this field is required" check for
 * dropdowns and short text fields whose only rule is non-empty.
 */
export function validateRequired(value, label = 'This field') {
  if (isBlank(value)) {
    return { valid: false, reason: `${label} is required.` };
  }
  return { valid: true };
}

/**
 * generateTempPassword — 12 characters: at least one upper, one
 * lower, one digit and one symbol. The remainder are drawn from
 * the union pool then shuffled so the guaranteed character is not
 * always at the start.
 *
 * Uses crypto.getRandomValues when available so passwords aren't
 * predictable from a Math.random() seed.
 */
const PWD_UPPER  = 'ABCDEFGHJKLMNPQRSTUVWXYZ';   /* no I, O */
const PWD_LOWER  = 'abcdefghijkmnpqrstuvwxyz';   /* no l, o */
const PWD_DIGITS = '23456789';                    /* no 0, 1 */
const PWD_SYMS   = '!@#$%&*?+';

function pickFrom(pool, count = 1) {
  const out = [];
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const buf = new Uint32Array(count);
    crypto.getRandomValues(buf);
    for (let i = 0; i < count; i += 1) {
      out.push(pool[buf[i] % pool.length]);
    }
    return out;
  }
  for (let i = 0; i < count; i += 1) {
    out.push(pool[Math.floor(Math.random() * pool.length)]);
  }
  return out;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function generateTempPassword() {
  const all = PWD_UPPER + PWD_LOWER + PWD_DIGITS + PWD_SYMS;
  const required = [
    pickFrom(PWD_UPPER)[0],
    pickFrom(PWD_LOWER)[0],
    pickFrom(PWD_DIGITS)[0],
    pickFrom(PWD_SYMS)[0],
  ];
  const filler = pickFrom(all, 12 - required.length);
  return shuffle([...required, ...filler]).join('');
}

/**
 * Tiny user-agent parser — extracts a friendly browser/OS pair
 * for the metadata block on the request detail drawer. Returns
 * { browser, os } using best-guess substring matching; both
 * default to 'Unknown' if no signature matches.
 */
export function parseUserAgent(ua = '') {
  const s = String(ua || '');
  let browser = 'Unknown';
  if (/Edg\//.test(s))           browser = 'Microsoft Edge';
  else if (/Chrome\//.test(s))   browser = 'Google Chrome';
  else if (/Firefox\//.test(s))  browser = 'Mozilla Firefox';
  else if (/Safari\//.test(s))   browser = 'Safari';
  else if (/MSIE|Trident/.test(s)) browser = 'Internet Explorer';

  let os = 'Unknown';
  if (/Windows NT 10/.test(s))      os = 'Windows 10/11';
  else if (/Windows NT/.test(s))    os = 'Windows';
  else if (/Mac OS X/.test(s))      os = 'macOS';
  else if (/Android/.test(s))       os = 'Android';
  else if (/iPhone|iPad|iOS/.test(s)) os = 'iOS';
  else if (/Linux/.test(s))         os = 'Linux';

  return { browser, os };
}

/**
 * Country → currency mapping used by the AddOrgDrawer to auto-select
 * the billing currency when an org is approved.
 */
export const COUNTRY_TO_CURRENCY = Object.freeze({
  India:                  'INR',
  'United Arab Emirates': 'AED',
  'Saudi Arabia':         'SAR',
  'United Kingdom':       'GBP',
  Qatar:                  'QAR',
  Oman:                   'OMR',
  Kuwait:                 'KWD',
  Bahrain:                'BHD',
});

export const COUNTRY_TO_CODE = Object.freeze({
  India:                  'IN',
  'United Arab Emirates': 'AE',
  'Saudi Arabia':         'SA',
  'United Kingdom':       'GB',
  Qatar:                  'QA',
  Oman:                   'OM',
  Kuwait:                 'KW',
  Bahrain:                'BH',
});
