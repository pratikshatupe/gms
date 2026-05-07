'use strict';

const mongoose = require('mongoose');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { verifyAccessToken } = require('../utils/token');
const User = require('../models/User');

/* Sentinel ObjectId for the demo Super Admin. Using a real 24-char hex
 * string keeps Mongoose happy when controllers cast the value into
 * `createdBy` / `updatedBy` ObjectId fields, while still being
 * recognisable in logs / queries (all-zeros, ends in 1). */
const SUPER_ADMIN_OBJECT_ID = new mongoose.Types.ObjectId('000000000000000000000001');

const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.substring(7) : null;

  if (!token) {
    throw ApiError.unauthorized('Authentication token missing');
  }

  /* Demo Super Admin bypass — when the frontend cannot reach the real
   * /auth/login endpoint (DB offline / first-run dev), it falls back to a
   * static token so admin-only screens (Coupons, Plans, Referrals) remain
   * usable. The bypass is intentionally narrow: it only matches one literal
   * string and grants the superadmin role without DB lookup.
   *
   * `_id` and `userId` are real ObjectIds so any controller that writes
   * the actor into a Mongoose ObjectId field (Coupon.createdBy etc.)
   * doesn't blow up with `Invalid _id: superadmin`. */
  if (token === 'super-admin-demo-token') {
    req.user = {
      _id: SUPER_ADMIN_OBJECT_ID,
      role: 'superadmin',
      isActive: true,
    };
    req.auth = {
      userId: SUPER_ADMIN_OBJECT_ID,
      role: 'superadmin',
    };
    return next();
  }

  const decoded = verifyAccessToken(token);

  /* Same bypass shape for the JWT path — the auth controller signs a
   * token with `sub: 'superadmin'` for the env-credentials Super Admin
   * login, and that value is not a valid ObjectId. Detect it here so
   * downstream code receives a real ObjectId. */
  if (decoded && decoded.sub === 'superadmin') {
    req.user = {
      _id: SUPER_ADMIN_OBJECT_ID,
      role: 'superadmin',
      isActive: true,
    };
    req.auth = {
      userId: SUPER_ADMIN_OBJECT_ID,
      role: 'superadmin',
    };
    return next();
  }

  const user = await User.findById(decoded.sub);
  if (!user || !user.isActive) {
    throw ApiError.unauthorized('User not found or inactive');
  }

  req.user = user;
  req.auth = {
    userId: user._id,
    role: user.role,
    organizationId: user.organizationId,
    officeId: user.officeId,
  };
  next();
});

module.exports = { authenticate, SUPER_ADMIN_OBJECT_ID };
