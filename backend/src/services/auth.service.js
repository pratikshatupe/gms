'use strict';

const User = require('../models/User');
const Organization = require('../models/Organization');
const ApiError = require('../utils/ApiError');
const { hashPassword, comparePassword } = require('../utils/password');
const { generateAuthTokens, verifyRefreshToken } = require('../utils/token');
const { ROLES } = require('../config/constants');

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

  const user = await User.findOne(query).select('+password').populate('organizationId', 'name slug isActive');
  if (!user) throw ApiError.unauthorized('Invalid credentials.');
  if (!user.isActive) throw ApiError.forbidden('Account is disabled.');

  /* Bug 3 — lockout: refuse the login while the lock window is in effect. */
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    throw ApiError.forbidden(`Account is temporarily locked. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`);
  }

  if (
    user.role !== ROLES.SUPER_ADMIN &&
    user.organizationId &&
    user.organizationId.isActive === false
  ) {
    throw ApiError.forbidden('Organization is disabled.');
  }

  const ok = await comparePassword(password, user.password);
  if (!ok) {
    /* Bug 3 — increment failure counter; lock after MAX_LOGIN_ATTEMPTS. */
    user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
    if (user.failedLoginAttempts >= MAX_LOGIN_ATTEMPTS) {
      user.lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
      user.failedLoginAttempts = 0;
      await user.save();
      throw ApiError.forbidden(`Too many failed attempts. Account locked for ${LOCKOUT_MINUTES} minutes.`);
    }
    await user.save();
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

module.exports = { login, refresh, logout, changePassword, getProfile };
