/**
 * walkInHelpers.js — pure utilities for the Walk-In module.
 *
 * No React imports. No data-store imports. Pure functions only so
 * the wizard, the badge component and the reception console can
 * share the same validation and formatting rules without drift.
 */

/* ── ID types ──────────────────────────────────────────────────── */

export const ID_TYPES = Object.freeze([
  'Aadhaar', 'PAN', 'Driving Licence', 'Passport', 'Emirates ID', 'Other',
]);

/** Country-aware picker — orders ID options by regional prevalence. */
export function idTypesForCountry(country) {
  const c = String(country || '').toLowerCase();
  if (c.includes('india')) {
    return ['Aadhaar', 'PAN', 'Driving Licence', 'Passport', 'Other'];
  }
  if (c.includes('united arab emirates') || c.includes('uae')) {
    return ['Emirates ID', 'Passport', 'Driving Licence', 'Other'];
  }
  return ['Passport', 'Driving Licence', 'Other'];
}

/* ── Normalisers ───────────────────────────────────────────────── */

/** Aadhaar is stored as 12 digits; spaces are stripped. */
export function normaliseAadhaar(value) {
  return String(value || '').replace(/\s+/g, '').toUpperCase();
}
export function formatAadhaar(value) {
  const d = normaliseAadhaar(value);
  if (d.length !== 12) return d;
  return `${d.slice(0, 4)} ${d.slice(4, 8)} ${d.slice(8, 12)}`;
}

/** Emirates ID is stored as 15 digits (no dashes); display inserts
 *  dashes 784-XXXX-XXXXXXX-X. */
export function normaliseEmiratesId(value) {
  return String(value || '').replace(/[-\s]+/g, '');
}
export function formatEmiratesId(value) {
  const d = normaliseEmiratesId(value);
  if (d.length !== 15) return d;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7, 14)}-${d.slice(14)}`;
}

/** PAN is uppercased. */
export function normalisePan(value) {
  return String(value || '').toUpperCase().replace(/\s+/g, '');
}

/** Passport (India format) is uppercased. */
export function normalisePassport(value) {
  return String(value || '').toUpperCase().replace(/\s+/g, '');
}

export function normaliseDrivingLicence(value) {
  return String(value || '').toUpperCase().replace(/\s+/g, '');
}

/* ── Validators ────────────────────────────────────────────────── */

const REPEATED_12 = /^(\d)\1{11}$/;

const ID_VALIDATORS = Object.freeze({
  'Aadhaar': (v) => {
    const d = normaliseAadhaar(v);
    if (!/^\d{12}$/.test(d)) return 'Aadhaar number must be 12 digits.';
    if (REPEATED_12.test(d)) return 'Aadhaar number must be 12 digits.';
    return null;
  },
  'PAN': (v) => {
    const d = normalisePan(v);
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(d)) return 'PAN number must be 10 characters in format AAAAA0000A.';
    return null;
  },
  'Driving Licence': (v) => {
    const d = normaliseDrivingLicence(v);
    if (!/^[A-Z]{2}[-\s]?[0-9]{10,14}$/.test(d)) return 'Driving Licence number format is invalid.';
    return null;
  },
  'Passport': (v, country) => {
    const d = normalisePassport(v);
    const inIndia = String(country || '').toLowerCase().includes('india');
    if (inIndia) {
      if (!/^[A-Z][0-9]{7}$/.test(d)) return 'Indian Passport number must be 1 letter followed by 7 digits.';
      return null;
    }
    if (!/^[A-Z0-9]{6,10}$/.test(d)) return 'Passport number must be 6 to 10 alphanumeric characters.';
    return null;
  },
  'Emirates ID': (v) => {
    const d = normaliseEmiratesId(v);
    if (!/^784\d{12}$/.test(d)) return 'Emirates ID must be 15 digits starting with 784.';
    return null;
  },
  'Other': (v) => {
    const d = String(v || '').trim();
    if (!/^[A-Za-z0-9 -]{3,30}$/.test(d)) return 'ID Number must be 3 to 30 alphanumeric characters.';
    return null;
  },
});

/**
 * validateIdNumber — returns null on success, error string on failure.
 *
 *   validateIdNumber('Aadhaar', '1234 5678 9012')             → null
 *   validateIdNumber('PAN',     'ABCDE1234F')                 → null
 *   validateIdNumber('Passport','A1234567', 'India')          → null
 *   validateIdNumber('Emirates ID', '784-1987-1234567-8')     → null
 */
export function validateIdNumber(type, value, country) {
  const fn = ID_VALIDATORS[type];
  if (!fn) return 'Unsupported ID type.';
  if (value == null || String(value).trim() === '') return 'ID Number is required.';
  return fn(value, country);
}

/**
 * normaliseIdPayload — given a type + raw value, return a
 * `{ idType, idNumber, idNumberDisplay }` triple. Used by the wizard
 * before calling stampLegacyAliases on the appointment payload.
 */
export function normaliseIdPayload(type, value) {
  if (!value) return { idType: type, idNumber: '', idNumberDisplay: '' };
  switch (type) {
    case 'Aadhaar': {
      const raw = normaliseAadhaar(value);
      return { idType: type, idNumber: raw, idNumberDisplay: formatAadhaar(raw) };
    }
    case 'Emirates ID': {
      const raw = normaliseEmiratesId(value);
      return { idType: type, idNumber: raw, idNumberDisplay: formatEmiratesId(raw) };
    }
    case 'PAN': {
      const raw = normalisePan(value);
      return { idType: type, idNumber: raw, idNumberDisplay: raw };
    }
    case 'Passport': {
      const raw = normalisePassport(value);
      return { idType: type, idNumber: raw, idNumberDisplay: raw };
    }
    case 'Driving Licence': {
      const raw = normaliseDrivingLicence(value);
      return { idType: type, idNumber: raw, idNumberDisplay: raw };
    }
    default: {
      const raw = String(value).trim();
      return { idType: type || 'Other', idNumber: raw, idNumberDisplay: raw };
    }
  }
}

/* ── Badge utilities ───────────────────────────────────────────── */

/**
 * generateBadgeNumber — format BDG-YYYYMMDD-HHMMSS-XXX where XXX is
 * a random 3-digit suffix to defuse same-second collisions on busy
 * reception desks.
 */
export function generateBadgeNumber(now = new Date()) {
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  const y = now.getFullYear();
  const mo = pad(now.getMonth() + 1);
  const d = pad(now.getDate());
  const h = pad(now.getHours());
  const mi = pad(now.getMinutes());
  const s = pad(now.getSeconds());
  const suffix = pad(Math.floor(Math.random() * 1000), 3);
  return `BDG-${y}${mo}${d}-${h}${mi}${s}-${suffix}`;
}

/* ── Date / time helpers ──────────────────────────────────────── */

/** Pad "HH:mm" from a Date. */
export function hhmm(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '00:00';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Add minutes to an "HH:mm", clamp to 23:59. */
export function addMinutesHhmm(hhmmStr, mins) {
  const [h, m] = String(hhmmStr || '00:00').split(':').map(Number);
  const total = Math.min(23 * 60 + 59, h * 60 + m + (Number(mins) || 0));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/* ── Photo capture helpers ───────────────────────────────────── */

/**
 * Convert a File/Blob to a base64 data URL. Used by the upload-
 * fallback path in CapturePhotoStep. Returns a Promise<string>.
 */
export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    if (!blob) { resolve(''); return; }
    const reader = new FileReader();
    reader.onload  = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read image.'));
    reader.readAsDataURL(blob);
  });
}

/**
 * isWebcamAvailable — quick feature detect for
 * navigator.mediaDevices.getUserMedia.
 */
export function isWebcamAvailable() {
  return typeof navigator !== 'undefined'
    && navigator.mediaDevices
    && typeof navigator.mediaDevices.getUserMedia === 'function';
}
