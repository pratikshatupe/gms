import { SAME_TAB_EVENT } from '../store/useCollection';
import { STORAGE_KEYS } from '../store/keys';
import {
  REFERRAL_REWARD,
  REFERRAL_STATUS,
  buildReferralLink,
  ensureUserReferralCode,
  findUserByReferralCode,
  generateUniqueReferralCode,
  getAllReferralCodes,
  readReferrals,
  writeReferrals,
} from '../utils/referrals';

function broadcast() {
  try {
    window.dispatchEvent(new CustomEvent(SAME_TAB_EVENT, { detail: { key: STORAGE_KEYS.REFERRALS } }));
  } catch { /* ignore */ }
}

function makeId() {
  return `ref_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Record a new signup that came in through a referral link.
 * Idempotent on (referredUserId): if a record already exists, returns it as-is.
 */
export function createReferralOnSignup({ referredUserId, referredBy, reward = REFERRAL_REWARD }) {
  if (!referredUserId || !referredBy) return null;
  const code = referredBy.toString().toUpperCase();
  const existing = readReferrals().find((r) => r.referredUserId === referredUserId);
  if (existing) return existing;

  const referrer = findUserByReferralCode(code);
  if (!referrer) return null; // unknown code — silently drop

  const record = {
    id: makeId(),
    referredUserId,
    referredBy: code,
    referrerUserId: referrer.id,
    status: REFERRAL_STATUS.PENDING,
    reward,
    createdAt: new Date().toISOString(),
    convertedAt: null,
  };
  const next = [record, ...readReferrals()];
  writeReferrals(next);
  broadcast();
  return record;
}

/**
 * Mark every PENDING referral for this user as CONVERTED.
 * Called when the referred user completes their first subscription/payment.
 * Returns the converted records.
 */
export function markReferralConverted(referredUserId) {
  if (!referredUserId) return [];
  const list = readReferrals();
  const now = new Date().toISOString();
  let changed = false;
  const next = list.map((r) => {
    if (r.referredUserId === referredUserId && r.status === REFERRAL_STATUS.PENDING) {
      changed = true;
      return { ...r, status: REFERRAL_STATUS.CONVERTED, convertedAt: now };
    }
    return r;
  });
  if (!changed) return [];
  writeReferrals(next);
  broadcast();
  return next.filter((r) => r.referredUserId === referredUserId && r.status === REFERRAL_STATUS.CONVERTED);
}

/**
 * Stats + history for a referrer (by their referral code).
 * Joins each record back to the registered-user list so the table shows real names.
 */
export function getReferralSummary(code) {
  if (!code) {
    return {
      code: null,
      link: '',
      reward: REFERRAL_REWARD,
      totalSignups: 0,
      totalConverted: 0,
      pendingRewards: 0,
      totalEarned: 0,
      history: [],
    };
  }
  const norm = code.toUpperCase();
  const all = readReferrals().filter((r) => (r.referredBy || '').toUpperCase() === norm);
  const registered = JSON.parse(localStorage.getItem('cgms_registered_users') || '[]');
  const userById = Object.fromEntries((registered || []).map((u) => [u.id, u]));

  const history = all
    .slice()
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    .map((r) => {
      const u = userById[r.referredUserId] || {};
      return {
        ...r,
        userName:  u.name || u.fullName || u.email || 'New User',
        userEmail: u.email || u.emailId || '',
      };
    });

  const totalConverted = all.filter((r) => r.status === REFERRAL_STATUS.CONVERTED).length;
  const pendingRewards = all.filter((r) => r.status === REFERRAL_STATUS.PENDING).length;
  const totalEarned    = totalConverted * REFERRAL_REWARD;

  return {
    code: norm,
    link: buildReferralLink(norm),
    reward: REFERRAL_REWARD,
    totalSignups: all.length,
    totalConverted,
    pendingRewards,
    totalEarned,
    history,
  };
}

/** Make sure the supplied user has a referral code (creating one if needed). */
export function ensureCodeForUser(user) {
  if (!user) return null;
  const persisted = ensureUserReferralCode(user);
  if (persisted) return persisted;
  // User isn't in the registered list (e.g. demo seed accounts).
  return generateUniqueReferralCode(
    user.name || user.fullName || user.email || 'USR',
    getAllReferralCodes(),
  );
}

export { REFERRAL_REWARD, REFERRAL_STATUS };
