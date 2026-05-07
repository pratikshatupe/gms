'use strict';

const mongoose      = require('mongoose');
const asyncHandler  = require('../utils/asyncHandler');
const ApiResponse   = require('../utils/ApiResponse');
const ApiError      = require('../utils/ApiError');
const couponService = require('../services/coupon.service');

/* Coerce whatever the auth middleware put on `req.user._id` / `req.auth.userId`
 * into a value that Mongoose can store in an ObjectId-typed field. If the
 * value is already an ObjectId, return it as-is. If it's a 24-char hex
 * string, cast it. Otherwise return null so the schema simply omits the
 * `createdBy` field instead of throwing `Invalid _id: superadmin`. */
function safeObjectId(value) {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value)) {
    return new mongoose.Types.ObjectId(value);
  }
  if (typeof value === 'object' && typeof value.toString === 'function') {
    const str = value.toString();
    if (/^[a-f0-9]{24}$/i.test(str)) return new mongoose.Types.ObjectId(str);
  }
  return null;
}

const create = async (req, res) => {
  try {
    /* Lightweight server-side validation BEFORE hitting Mongoose so the
     * obvious mistakes get a single useful error message. */
    const body = req.body || {};
    if (!body.code || !String(body.code).trim()) {
      return res.status(400).json({ success: false, message: 'Coupon code is required' });
    }
    if (!body.discountType || !['PERCENTAGE', 'FLAT', 'FREE_PLAN'].includes(body.discountType)) {
      return res.status(400).json({ success: false, message: 'Invalid discount type' });
    }
    const dv = Number(body.discountValue);
    if (!Number.isFinite(dv) || dv <= 0) {
      return res.status(400).json({ success: false, message: 'Discount value must be a positive number' });
    }
    if (body.discountType === 'PERCENTAGE' && dv > 100) {
      return res.status(400).json({ success: false, message: 'Percentage discount cannot exceed 100' });
    }

    /* Resolve the actor — prefer req.auth.userId, fall back to req.user._id.
     * Either may be an ObjectId, a hex string, or the literal "superadmin"
     * (legacy demo token). safeObjectId() returns null for the literal so
     * the Coupon schema simply omits createdBy. */
    const rawActor = (req.auth && req.auth.userId) || (req.user && req.user._id) || null;
    const actorId = safeObjectId(rawActor);

    const data = await couponService.createCoupon(body, actorId);
    return res.status(201).json({
      success: true,
      message: 'Coupon created successfully',
      data,
    });
  } catch (err) {
    /* Log the real server-side error so the backend terminal shows what
     * went wrong (Mongoose validation, duplicate key, etc.). */
    try { require('../config/logger').error('Coupon create failed: ' + (err && err.stack ? err.stack : err)); } catch {}
    const statusCode = err && err.statusCode ? err.statusCode : 400;
    return res.status(statusCode).json({
      success: false,
      message: (err && err.message) || 'Failed to create coupon',
      details: (err && err.details) || null,
    });
  }
};

const list = asyncHandler(async (req, res) => {
  const { items, meta } = await couponService.listCoupons(req.query);
  return ApiResponse.success(res, { data: items, meta });
});

const toggle = asyncHandler(async (req, res) => {
  const data = await couponService.toggleCoupon(req.params.id, req.body.isActive);
  return ApiResponse.success(res, { message: 'Coupon updated', data });
});

const remove = asyncHandler(async (req, res) => {
  await couponService.deleteCoupon(req.params.id);
  return ApiResponse.success(res, { message: 'Coupon deleted' });
});

const validate = asyncHandler(async (req, res) => {
  const { code, plan, orderAmount } = req.body;
  const data = await couponService.validateCoupon(code, { plan, orderAmount });
  return ApiResponse.success(res, { data });
});

/**
 * POST /api/v1/coupons/apply  (public, rate-limited)
 *
 * Body: { couponCode, organizationSize, selectedPlan }
 *
 * Always responds with the spec envelope:
 *   { success, valid, coupon? , message? }
 *
 * Errors are NOT thrown to the global handler — they're returned as a 200
 * with `valid: false` so the frontend can render an inline message without
 * tripping fetch's "ok" check.
 */
const apply = asyncHandler(async (req, res) => {
  const { couponCode, organizationSize, selectedPlan } = req.body || {};
  try {
    const result = await couponService.applyCoupon({ couponCode, organizationSize, selectedPlan });
    return res.status(200).json({ success: true, valid: true, coupon: result.coupon });
  } catch (err) {
    if (err instanceof ApiError) {
      return res.status(200).json({
        success: false,
        valid: false,
        message: err.message || 'Invalid Coupon Code',
      });
    }
    throw err;
  }
});

/**
 * POST /api/v1/coupons/redeem  (public, rate-limited)
 *
 * Records a real usage. Re-validates server-side, then atomically increments
 * usedCount honouring the maxUses cap. Called by the signup flow once the
 * organisation has been persisted client-side. Never trust the frontend's
 * discount amount — the backend recomputes from the plan catalogue.
 */
const redeem = asyncHandler(async (req, res) => {
  const { couponCode, organizationSize, selectedPlan } = req.body || {};
  try {
    const validation = await couponService.applyCoupon({ couponCode, organizationSize, selectedPlan });
    const updated = await couponService.recordCouponUsage(couponCode);
    if (!updated) {
      return res.status(200).json({
        success: false,
        valid: false,
        message: 'Coupon usage limit reached',
      });
    }
    return res.status(200).json({
      success: true,
      valid: true,
      coupon: validation.coupon,
      usedCount: updated.usedCount,
    });
  } catch (err) {
    if (err instanceof ApiError) {
      return res.status(200).json({
        success: false,
        valid: false,
        message: err.message || 'Invalid Coupon Code',
      });
    }
    throw err;
  }
});

module.exports = { create, list, toggle, remove, validate, apply, redeem };
