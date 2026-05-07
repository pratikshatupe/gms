import { safeGet, safeSet } from './storage';
import { STORAGE_KEYS } from '../store/keys';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const REFERRAL_REWARD = 500;
/* Bug 12 — discount the referred organisation receives when they sign up
   with a referral code. Surfaced on the Referrals page alongside the
   referrer reward. */
export const REFEREE_DISCOUNT_PERCENT = 10;
/* Bug 12 — when this many signups have used a referral code we
   automatically rotate to a fresh code. Tracked per referrer in the
   `cgms_referrals_v1` collection. */
export const REFERRAL_ROTATE_AFTER = 10;

const REGISTERED_USERS_KEY = 'cgms_registered_users';

function randomBlock(len = 5) {
  let out = '';
  for (let i = 0; i < len; i += 1) {
    out += ALPHABET.charAt(Math.floor(Math.random() * ALPHABET.length));
  }
  return out;
}

function nameSeed(seed) {
  if (!seed) return '';
  return seed.toString().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
}

export function generateReferralCode(seed = '') {
  const prefix = nameSeed(seed) || 'USR';
  return `${prefix}-${randomBlock(5)}`;
}

export function generateUniqueReferralCode(seed, existingCodes) {
  const taken = new Set((existingCodes || []).filter(Boolean).map((c) => c.toUpperCase()));
  for (let i = 0; i < 25; i += 1) {
    const code = generateReferralCode(seed);
    if (!taken.has(code.toUpperCase())) return code;
  }
  return `${nameSeed(seed) || 'USR'}-${Date.now().toString(36).toUpperCase()}`;
}

export function getReferralFromURL(url) {
  try {
    const search = url || (typeof window !== 'undefined' ? window.location.search : '');
    const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
    const raw = params.get('ref') || params.get('referral') || '';
    return raw.trim().toUpperCase() || null;
  } catch {
    return null;
  }
}

export function buildReferralLink(code, origin) {
  const base = origin || (typeof window !== 'undefined' ? window.location.origin : '');
  return `${base}/?ref=${encodeURIComponent(code || '')}`;
}

export function getAllReferralCodes() {
  const users = safeGet(REGISTERED_USERS_KEY, []);
  return (Array.isArray(users) ? users : [])
    .map((u) => u?.referralCode)
    .filter(Boolean);
}

/**
 * Persist a referral code on a registered user record. No-op if the user
 * already has one. Returns the (possibly newly generated) code.
 */
export function ensureUserReferralCode(user) {
  if (!user || !user.id) return null;
  const users = safeGet(REGISTERED_USERS_KEY, []);
  const list = Array.isArray(users) ? users : [];
  const idx = list.findIndex((u) => u?.id === user.id);
  if (idx === -1) return user.referralCode || null;
  if (list[idx].referralCode) return list[idx].referralCode;

  const code = generateUniqueReferralCode(
    list[idx].name || list[idx].fullName || list[idx].email || 'USR',
    getAllReferralCodes(),
  );
  list[idx] = { ...list[idx], referralCode: code };
  safeSet(REGISTERED_USERS_KEY, list);
  return code;
}

export function findUserByReferralCode(code) {
  if (!code) return null;
  const norm = code.trim().toUpperCase();
  const users = safeGet(REGISTERED_USERS_KEY, []);
  return (Array.isArray(users) ? users : []).find(
    (u) => (u?.referralCode || '').toUpperCase() === norm,
  ) || null;
}

export const REFERRAL_STATUS = Object.freeze({
  PENDING:   'pending',
  CONVERTED: 'converted',
});

export function readReferrals() {
  const list = safeGet(STORAGE_KEYS.REFERRALS, []);
  return Array.isArray(list) ? list : [];
}

export function writeReferrals(list) {
  safeSet(STORAGE_KEYS.REFERRALS, Array.isArray(list) ? list : []);
}

/**
 * Bug 12 — replace the user's referral code with a freshly generated one.
 * Persists to the registered-users list (so the new code shows up on the
 * Referrals page on next render) and returns the new value. The history of
 * past codes is appended to the user record so old links remain attributable
 * even after rotation.
 */
export function rotateUserReferralCode(user) {
  if (!user || !user.id) return null;
  const users = safeGet(REGISTERED_USERS_KEY, []);
  const list = Array.isArray(users) ? users : [];
  const idx = list.findIndex((u) => u?.id === user.id);
  if (idx === -1) return null;
  const newCode = generateUniqueReferralCode(
    list[idx].name || list[idx].fullName || list[idx].email || 'USR',
    getAllReferralCodes(),
  );
  const previous = Array.isArray(list[idx].referralCodeHistory) ? list[idx].referralCodeHistory : [];
  const old = list[idx].referralCode;
  list[idx] = {
    ...list[idx],
    referralCode: newCode,
    referralCodeHistory: old ? [old, ...previous].slice(0, 10) : previous,
  };
  safeSet(REGISTERED_USERS_KEY, list);
  return newCode;
}

export function countSignupsForCode(code) {
  if (!code) return 0;
  const norm = code.toUpperCase();
  const list = readReferrals();
  return list.filter((r) => (r.referredBy || '').toUpperCase() === norm).length;
}
