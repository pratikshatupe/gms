/**
 * validators.js — canonical, project-wide form validation primitives.
 *
 * Phase 2 specification implemented here:
 *   Name:      letters + spaces (also . ' -), 2–50 chars
 *   Email:     valid format; lowercase + trim before save; no spaces
 *   Phone:     10 digits Indian, starts 6/7/8/9, blocks repeated/sequential fakes
 *   Password:  8+, upper + lower + digit + special
 *   Org name:  2–100 chars, alphanumeric + & . - _ space
 *   Address:   5–250 chars
 *   Payment:   card 13–19 digits (Luhn), cardholder letters + spaces,
 *              expiry MM/YY (not in past), CVV exactly 3 digits
 *
 * Convention for new validators:
 *   - Return `''` (empty string) when the value is valid.
 *   - Return `'<error message>'` when invalid.
 *
 * The empty-string-means-valid convention lets callers do:
 *
 *     const err = validateEmail(email);
 *     if (err) errors.email = err;
 *
 * Sanitisers (`sanitizeEmail`, `formatCardNumber`, `formatExpiry`, …)
 * are exported so callers can clean input inside `onChange` WITHOUT
 * losing focus or resetting the form value.
 *
 * Legacy exports kept for back-compat:
 *   - `validatePhone(value)`  → boolean — exactly 10 digits
 *   - `PHONE_ERROR_MSG`       → "Please enter a valid Contact Number."
 *   These are still consumed by AppointmentForm.jsx and WalkInForm.jsx.
 */

/* ─────────────────────────────────────────────────────────────────────
 * Legacy boolean phone validator — preserved so existing imports in
 * AppointmentForm.jsx and WalkInForm.jsx keep working unchanged.
 * Prefer `validatePhoneIndian` for new code.
 * ───────────────────────────────────────────────────────────────────── */
export function validatePhone(phone) {
  return /^[0-9]{10}$/.test(String(phone ?? '').trim());
}
export const PHONE_ERROR_MSG = 'Please enter a valid Contact Number.';

/* ─── Names ────────────────────────────────────────────────────────── */

const NAME_REGEX = /^[A-Za-z][A-Za-z\s.'-]*$/;

export function validateName(value, { label = 'Name', min = 2, max = 50, required = true } = {}) {
  const v = (value || '').trim();
  if (!v) return required ? `${label} is required.` : '';
  if (v.length < min) return `${label} must be at least ${min} characters.`;
  if (v.length > max) return `${label} must be ${max} characters or fewer.`;
  if (!NAME_REGEX.test(v)) {
    return `${label} can only contain letters, spaces, dots, hyphens, and apostrophes.`;
  }
  return '';
}

/* ─── Email ────────────────────────────────────────────────────────── */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Strip whitespace and force lowercase. Use this in `onChange` before
 *  setState if you want the saved value to be normalised. */
export function sanitizeEmail(value) {
  return String(value || '').replace(/\s+/g, '').toLowerCase();
}

export function validateEmail(value, { label = 'Email', required = true } = {}) {
  const v = String(value || '').trim();
  if (!v) return required ? `${label} is required.` : '';
  if (/\s/.test(v)) return `${label} cannot contain spaces.`;
  if (!EMAIL_REGEX.test(v)) return `Please enter a valid ${label.toLowerCase()}.`;
  if (v.length > 200) return `${label} is too long.`;
  return '';
}

/* ─── Phone (Indian-strict) ────────────────────────────────────────── */

/* Repeated/sequential fakes that must never be accepted. */
const FAKE_PHONES = new Set([
  '0000000000', '1111111111', '2222222222', '3333333333', '4444444444',
  '5555555555', '6666666666', '7777777777', '8888888888', '9999999999',
  '1234567890', '0987654321', '9876543210',
]);

/** Strip everything except digits and cap at 10. */
export function sanitizePhoneIndian(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 10);
}

/**
 * Indian-strict validation: exactly 10 digits, starts with 6/7/8/9,
 * not a known repeated/sequential fake.
 */
export function validatePhoneIndian(value, { label = 'Phone number', required = true } = {}) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return required ? `${label} is required.` : '';
  if (digits.length !== 10) return `${label} must be exactly 10 digits.`;
  if (!/^[6-9]/.test(digits)) return `${label} must start with 6, 7, 8, or 9.`;
  if (FAKE_PHONES.has(digits)) return `${label} looks invalid. Please enter a real number.`;
  return '';
}

/**
 * Country-aware fallback for forms that capture a country and support
 * international numbers (Add Office, Registration). Indian numbers go
 * through the strict path; non-Indian numbers fall back to a 7–15-digit
 * range so existing UAE/international entries don't break.
 */
export function validatePhoneByCountry(value, country, { label = 'Phone number', required = true } = {}) {
  const isIndia = String(country || '').toLowerCase().includes('india')
    || String(country || '').toUpperCase() === 'IN';
  if (isIndia) return validatePhoneIndian(value, { label, required });
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return required ? `${label} is required.` : '';
  if (digits.length < 7 || digits.length > 15) {
    return `${label} must be between 7 and 15 digits.`;
  }
  return '';
}

/* ─── Password (strict spec) ───────────────────────────────────────── */

export const PASSWORD_MIN_LENGTH = 8;

export function validatePasswordStrict(value, { label = 'Password' } = {}) {
  const v = String(value || '');
  if (!v) return `${label} is required.`;
  if (v.length < PASSWORD_MIN_LENGTH) {
    return `${label} must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (!/[A-Z]/.test(v)) return `${label} must contain at least one uppercase letter.`;
  if (!/[a-z]/.test(v)) return `${label} must contain at least one lowercase letter.`;
  if (!/\d/.test(v))    return `${label} must contain at least one number.`;
  if (!/[^A-Za-z0-9]/.test(v)) {
    return `${label} must contain at least one special character.`;
  }
  return '';
}

/* ─── Organisation name ────────────────────────────────────────────── */

const ORG_NAME_REGEX = /^[A-Za-z0-9 &._-]+$/;

export function validateOrgName(value, { label = 'Organisation name', min = 2, max = 100 } = {}) {
  const v = (value || '').trim();
  if (!v) return `${label} is required.`;
  if (v.length < min) return `${label} must be at least ${min} characters.`;
  if (v.length > max) return `${label} must be ${max} characters or fewer.`;
  if (!ORG_NAME_REGEX.test(v)) {
    return `${label} can only contain letters, numbers, spaces, and the symbols & . - _`;
  }
  return '';
}

/* ─── Address ──────────────────────────────────────────────────────── */

export function validateAddress(value, { label = 'Address', min = 5, max = 250, required = true } = {}) {
  const v = (value || '').trim();
  if (!v) return required ? `${label} is required.` : '';
  if (v.length < min) return `${label} must be at least ${min} characters.`;
  if (v.length > max) return `${label} must be ${max} characters or fewer.`;
  return '';
}

/* ─── Payment card (demo form) ─────────────────────────────────────── */

/** Format the digits into "1234 5678 9012 3456" groups. Use in onChange. */
export function formatCardNumber(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 19);
  return digits.replace(/(.{4})/g, '$1 ').trim();
}

/** Strip non-digits and cap at 19 — useful for the raw card input. */
export function sanitizeCardNumber(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 19);
}

/** Standard Luhn checksum. */
function luhnValid(cardDigits) {
  const digits = String(cardDigits || '').replace(/\D/g, '');
  if (digits.length < 13) return false;
  let sum = 0;
  let alternate = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits.charAt(i), 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

export function validateCardNumber(value, { label = 'Card number' } = {}) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return `${label} is required.`;
  if (digits.length < 13 || digits.length > 19) {
    return `${label} must be between 13 and 19 digits.`;
  }
  if (!luhnValid(digits)) return `${label} is invalid. Please double-check the digits.`;
  return '';
}

const CARDHOLDER_REGEX = /^[A-Za-z][A-Za-z\s.'-]*$/;

export function validateCardholderName(value, { label = 'Cardholder name' } = {}) {
  const v = (value || '').trim();
  if (!v) return `${label} is required.`;
  if (v.length < 2)  return `${label} must be at least 2 characters.`;
  if (v.length > 60) return `${label} must be 60 characters or fewer.`;
  if (!CARDHOLDER_REGEX.test(v)) {
    return `${label} can only contain letters and spaces.`;
  }
  return '';
}

/** Format raw input into "MM/YY" — used in onChange. */
export function formatExpiry(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 4);
  if (digits.length < 3) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

export function validateExpiry(value, { label = 'Expiry' } = {}) {
  const v = String(value || '').trim();
  if (!v) return `${label} is required.`;
  if (!/^\d{2}\/\d{2}$/.test(v)) return `${label} must be in MM/YY format.`;
  const [mmStr, yyStr] = v.split('/');
  const mm = parseInt(mmStr, 10);
  const yy = parseInt(yyStr, 10);
  if (mm < 1 || mm > 12) return `${label} month must be between 01 and 12.`;
  /* Cards expire at the end of the stated month, so compare against
   * the current calendar month/year. */
  const now = new Date();
  const currentYY = now.getFullYear() % 100;
  const currentMM = now.getMonth() + 1;
  if (yy < currentYY || (yy === currentYY && mm < currentMM)) {
    return `${label} cannot be in the past.`;
  }
  if (yy > currentYY + 20) return `Please re-check the expiry year.`;
  return '';
}

export function sanitizeCvv(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 3);
}

export function validateCvv(value, { label = 'CVV' } = {}) {
  const v = String(value || '');
  if (!v) return `${label} is required.`;
  if (!/^\d{3}$/.test(v)) return `${label} must be exactly 3 digits.`;
  return '';
}

/* ─── Generic helpers ──────────────────────────────────────────────── */

/**
 * Run multiple validators against a value and return the first error
 * (or '' if every check passes). Lets callers compose ad-hoc rules:
 *
 *   const err = firstError(name, [
 *     (v) => validateName(v),
 *     (v) => v === reservedName ? 'Reserved name' : '',
 *   ]);
 */
export function firstError(value, validators = []) {
  for (const fn of validators) {
    const err = fn(value);
    if (err) return err;
  }
  return '';
}

/** True when the supplied errors object has any non-empty entry. */
export function hasErrors(errors) {
  if (!errors || typeof errors !== 'object') return false;
  return Object.values(errors).some((v) => Boolean(v));
}
