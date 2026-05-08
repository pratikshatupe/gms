'use strict';

const crypto = require('crypto');
const User = require('../models/User');
const Organization = require('../models/Organization');
const ApiError = require('../utils/ApiError');
const { hashPassword, comparePassword } = require('../utils/password');
const { generateAuthTokens, verifyRefreshToken } = require('../utils/token');
const { ROLES } = require('../config/constants');
const env = require('../config/env');
const logger = require('../config/logger');
const notificationService = require('./notification.service');
const emailTemplates = require('../templates/email.templates');

/* Forgot-password OTP policy. 6-digit numeric, 10-minute TTL. */
const OTP_TTL_MINUTES = 10;
const OTP_LENGTH      = 6;

function generateNumericOtp(length = OTP_LENGTH) {
  const min = 10 ** (length - 1);
  const max = 10 ** length - 1;
  // Cryptographically strong 6-digit code (no leading zeros below `min`).
  const buf = crypto.randomBytes(4).readUInt32BE(0);
  return String(min + (buf % (max - min + 1)));
}

function hashOtp(otp) {
  return crypto.createHash('sha256').update(String(otp)).digest('hex');
}

/* Bug 3 — login policy defaults; can be overridden by env so a Super Admin
   can tighten lockout without redeploying. */
const MAX_LOGIN_ATTEMPTS = Number(process.env.MAX_LOGIN_ATTEMPTS) || 5;
const LOCKOUT_MINUTES    = Number(process.env.LOCKOUT_MINUTES)    || 30;

async function login({ email, password, organizationSlug }) {
  const query = { email: email.toLowerCase() };

  if (organizationSlug) {
    const org = await Organization.findOne({ slug: organizationSlug.toLowerCase(), isActive: true });
    if (!org) throw ApiError.unauthorized('Invalid credentials.');
    query.organizationId = org._id;
  }

  /* The User schema has a UNIQUE index on (organizationId, email), so the same
     email may legitimately exist in multiple tenants. `findOne({email})` returns
     whichever Mongo orders first, which produced spurious 401s when valid creds
     belonged to a different tenant. When no organizationSlug is supplied we
     fetch every match and pick the one whose password verifies. */
  const candidates = organizationSlug
    ? await User.find(query).select('+password').populate('organizationId', 'name slug isActive')
    : await User.find({ email: email.toLowerCase() }).select('+password').populate('organizationId', 'name slug isActive');

  if (!candidates.length) throw ApiError.unauthorized('Invalid credentials.');

  const isSelectable = (u) => {
    if (!u.isActive) return false;
    if (u.lockedUntil && u.lockedUntil > new Date()) return false;
    if (u.role !== ROLES.SUPER_ADMIN && u.organizationId && u.organizationId.isActive === false) return false;
    return true;
  };

  let user = null;
  for (const candidate of candidates) {
    if (!isSelectable(candidate)) continue;
    if (candidate.password && await comparePassword(password, candidate.password)) {
      user = candidate;
      break;
    }
  }

  if (!user) {
    /* Surface the precise failure reason against the deterministic first
       candidate so account-state errors (disabled / locked / org disabled)
       still take precedence over a generic Invalid credentials. */
    const probe = candidates[0];
    if (!probe.isActive) throw ApiError.forbidden('Account is disabled.');
    if (probe.lockedUntil && probe.lockedUntil > new Date()) {
      const minutes = Math.ceil((probe.lockedUntil.getTime() - Date.now()) / 60000);
      throw ApiError.forbidden(`Account is temporarily locked. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`);
    }
    if (
      probe.role !== ROLES.SUPER_ADMIN &&
      probe.organizationId &&
      probe.organizationId.isActive === false
    ) {
      throw ApiError.forbidden('Organization is disabled.');
    }

    /* Increment failure counter on the deterministic first candidate so
       lockout still works under the multi-tenant shadow-account scenario. */
    probe.failedLoginAttempts = (probe.failedLoginAttempts || 0) + 1;
    if (probe.failedLoginAttempts >= MAX_LOGIN_ATTEMPTS) {
      probe.lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
      probe.failedLoginAttempts = 0;
      await probe.save();
      throw ApiError.forbidden(`Too many failed attempts. Account locked for ${LOCKOUT_MINUTES} minutes.`);
    }
    await probe.save();
    throw ApiError.unauthorized('Invalid credentials.');
  }

  /* Reset on success. */
  user.failedLoginAttempts = 0;
  user.lockedUntil = undefined;

  const tokens = generateAuthTokens(user);
  user.refreshToken = tokens.refreshToken;
  user.lastLoginAt = new Date();
  // Auto-create referral code for every user on first login
  const referralService = require('./referral.service');
  referralService.ensureReferralCode(user._id, user.name).catch(() => {});
  await user.save();

  const safe = user.toJSON();
  return { user: safe, tokens };
}

async function refresh(refreshToken) {
  if (!refreshToken) throw ApiError.unauthorized('Refresh token required');

  const decoded = verifyRefreshToken(refreshToken);
  const user = await User.findById(decoded.sub).select('+refreshToken');
  if (!user || !user.isActive) throw ApiError.unauthorized('Invalid session');
  if (user.refreshToken !== refreshToken) throw ApiError.unauthorized('Invalid session');

  const tokens = generateAuthTokens(user);
  user.refreshToken = tokens.refreshToken;
  await user.save();

  return tokens;
}

async function logout(userId) {
  await User.updateOne({ _id: userId }, { $unset: { refreshToken: 1 } });
}

async function changePassword(userId, currentPassword, newPassword) {
  const user = await User.findById(userId).select('+password');
  if (!user) throw ApiError.notFound('User not found');

  const ok = await comparePassword(currentPassword, user.password);
  if (!ok) throw ApiError.badRequest('Current password is incorrect');

  user.password = await hashPassword(newPassword);
  user.passwordChangedAt = new Date();
  user.refreshToken = undefined;
  await user.save();
}

async function getProfile(userId) {
  const user = await User.findById(userId)
    .populate('organizationId', 'name slug logoUrl plan')
    .populate('officeId', 'name code city country');
  if (!user) throw ApiError.notFound('User not found');
  return user;
}

/**
 * Look up a user by email, ignoring tenant. We deliberately respond with
 * the same envelope whether or not the user exists, to avoid leaking
 * which addresses are registered. The OTP is only generated + emailed
 * when the user actually exists.
 */
async function _findUserByEmail(email) {
  const norm = String(email || '').toLowerCase().trim();
  if (!norm) return null;
  // Same multi-tenant tie-breaking as login: pick the first active match.
  const candidates = await User.find({ email: norm });
  return candidates.find((u) => u.isActive) || candidates[0] || null;
}

async function forgotPassword({ email }) {
  const normEmail = String(email || '').toLowerCase().trim();
  /* Internal-only logs. The HTTP response below is identical for the
   * "user exists" and "user does not exist" branches so the caller
   * cannot enumerate accounts. Operators get the truth in the server
   * log so debugging is possible. */
  logger.info(`[AUTH] Forgot password requested for: ${normEmail || '(empty)'}`);

  const user = await _findUserByEmail(normEmail);
  const userExists = Boolean(user);
  const userActive = Boolean(user && user.isActive);
  logger.info(`[AUTH] User found for forgot password: ${userExists} (active=${userActive})`);

  if (!userExists || !userActive) {
    /* Anti-enumeration: return the same generic envelope the
     * controller emits. Nothing about the OTP/email path runs. */
    return { success: true };
  }

  const otp = generateNumericOtp();
  user.resetOtp       = hashOtp(otp);
  user.resetOtpExpiry = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
  await user.save();
  /* Never log the OTP value or its hash. We log length + expiry only
   * so a regression (e.g. expiry not persisted) is visible. */
  logger.info(`[AUTH] OTP saved with expiry: ${user.resetOtpExpiry.toISOString()} (length=${OTP_LENGTH}, ttlMinutes=${OTP_TTL_MINUTES})`);

  try {
    const tpl = emailTemplates.PASSWORD_RESET_OTP({
      name: user.name,
      email: user.email,
      otp,
      expiresInMinutes: OTP_TTL_MINUTES,
      platformName: env.smtp.fromName || 'CorpGMS',
    });
    const result = await notificationService.sendEmail({
      to: user.email,
      subject: tpl.subject,
      html:    tpl.html,
      text:    tpl.text,
    });
    /* sendEmail can also resolve to { skipped: true, reason } when the
     * payload was malformed or no transporter was available. Treat that
     * as a hard failure for the password-reset path so the user gets a
     * clear error instead of "OTP sent" with nothing in their inbox. */
    if (result && result.skipped) {
      logger.error(`[EMAIL] Password reset OTP email NOT sent to: ${user.email} (skipped reason=${result.reason})`);
      throw ApiError.internal('Could not send the OTP email. Please try again in a moment.');
    }
    logger.info(`[EMAIL] Password reset OTP email sent to: ${user.email}`);
  } catch (err) {
    if (err && err.statusCode) throw err; // already an ApiError
    logger.error(`[EMAIL] Password reset OTP send failed for ${user.email}: ${err && err.message ? err.message : err}`);
    if (err && err.stack) logger.error(err.stack);
    // Surface a real error here — if the OTP can't be delivered, the
    // user has no path forward, and silently succeeding would be worse.
    throw ApiError.internal('Could not send the OTP email. Please try again in a moment.');
  }

  return { success: true };
}

async function _verifyOtpInternal(user, otp) {
  if (!user || !user.resetOtp || !user.resetOtpExpiry) {
    throw ApiError.badRequest('No OTP request is active. Please request a new code.');
  }
  if (user.resetOtpExpiry.getTime() < Date.now()) {
    throw ApiError.badRequest('OTP has expired. Please request a new code.');
  }
  const incoming = hashOtp(String(otp || '').trim());
  if (incoming !== user.resetOtp) {
    throw ApiError.badRequest('Incorrect OTP. Please try again.');
  }
}

async function verifyOtp({ email, otp }) {
  const normEmail = String(email || '').toLowerCase().trim();
  logger.info(`[AUTH] Verify OTP requested for: ${normEmail}`);
  const user = await _findUserByEmail(normEmail);
  if (!user) {
    logger.warn(`[AUTH] Verify OTP: no user for ${normEmail}`);
    throw ApiError.badRequest('Incorrect OTP. Please try again.');
  }
  // Need the hidden fields explicitly because they're select:false.
  const u = await User.findById(user._id).select('+resetOtp +resetOtpExpiry');
  await _verifyOtpInternal(u, otp);
  logger.info(`[AUTH] OTP verified for: ${normEmail}`);
  return { success: true };
}

async function resetPassword({ email, otp, newPassword }) {
  const normEmail = String(email || '').toLowerCase().trim();
  logger.info(`[AUTH] Reset password requested for: ${normEmail}`);
  if (!newPassword || String(newPassword).length < 8) {
    throw ApiError.badRequest('Password must be at least 8 characters.');
  }
  const user = await _findUserByEmail(normEmail);
  if (!user) {
    logger.warn(`[AUTH] Reset password: no user for ${normEmail}`);
    throw ApiError.badRequest('Incorrect OTP. Please try again.');
  }

  const u = await User.findById(user._id).select('+resetOtp +resetOtpExpiry +password');
  await _verifyOtpInternal(u, otp);

  u.password            = await hashPassword(newPassword);
  u.passwordChangedAt   = new Date();
  u.resetOtp            = undefined;
  u.resetOtpExpiry      = undefined;
  u.refreshToken        = undefined;
  u.failedLoginAttempts = 0;
  u.lockedUntil         = undefined;
  await u.save();
  logger.info(`[AUTH] Password reset successful for: ${normEmail}`);

  return { success: true };
}

module.exports = {
  login,
  refresh,
  logout,
  changePassword,
  getProfile,
  forgotPassword,
  verifyOtp,
  resetPassword,
};
