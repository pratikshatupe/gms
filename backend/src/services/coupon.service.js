'use strict';

const Coupon = require('../models/Coupon');
const ApiError = require('../utils/ApiError');
const { getPagination, buildSort, paginate } = require('../utils/pagination');
const { calculateDiscount, planPriceFor } = require('../utils/calculateDiscount');

const normaliseCode = (code) => String(code || '').toUpperCase().trim();

async function createCoupon(payload, actorId) {
  const code = normaliseCode(payload.code);
  if (!code) throw ApiError.badRequest('Coupon code is required');
  const exists = await Coupon.findOne({ code });
  if (exists) throw ApiError.conflict('Coupon code already exists');
  return Coupon.create({ ...payload, code, createdBy: actorId });
}

async function listCoupons(query) {
  const { page, limit, skip } = getPagination(query);
  const sort = buildSort(query, ['createdAt', 'code', 'usedCount']);
  const filter = {};
  if (query.isActive !== undefined) filter.isActive = query.isActive === 'true';
  const [items, total] = await Promise.all([
    Coupon.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    Coupon.countDocuments(filter),
  ]);
  return { items, meta: paginate(total, page, limit) };
}

async function toggleCoupon(id, isActive) {
  const coupon = await Coupon.findByIdAndUpdate(id, { isActive }, { new: true });
  if (!coupon) throw ApiError.notFound('Coupon not found');
  return coupon;
}

async function deleteCoupon(id) {
  const coupon = await Coupon.findByIdAndDelete(id);
  if (!coupon) throw ApiError.notFound('Coupon not found');
  return { deleted: true };
}

/**
 * Existing legacy validation flow used by the in-app subscription page.
 * Kept untouched so any existing UI continues to work.
 */
async function validateCoupon(code, { plan, orderAmount }) {
  const coupon = await Coupon.findOne({ code: normaliseCode(code) });
  if (!coupon) throw ApiError.notFound('Invalid coupon code');
  if (!coupon.isValid) throw ApiError.badRequest('Coupon is expired or no longer valid');

  const allowed = coupon.effectiveAllowedPlans;
  if (allowed.length > 0 && !allowed.includes(plan)) {
    throw ApiError.badRequest(`This coupon is not valid for the ${plan} plan`);
  }
  if (orderAmount < coupon.minOrderAmount) {
    throw ApiError.badRequest(`Minimum order amount is ₹${coupon.minOrderAmount}`);
  }

  const { discountAmount, finalAmount } = calculateDiscount(orderAmount, coupon);

  return {
    valid: true,
    couponId: coupon._id,
    code: coupon.code,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    discountAmount,
    finalAmount,
    description: coupon.description,
  };
}

/**
 * Public coupon-apply for the Create Organization signup flow. Spec shape:
 *
 *   request:  { couponCode, organizationSize, selectedPlan }
 *   success:  { success, valid, coupon: { code, discountType, discountValue, message,
 *                                          discountAmount, finalAmount, planPrice } }
 *   error:    throws ApiError so the controller can shape the error envelope
 *
 * Does NOT touch usedCount — that only happens during real organisation
 * creation (`recordCouponUsage`). The plan price comes from the server
 * catalogue, never from the client.
 */
async function applyCoupon({ couponCode, organizationSize, selectedPlan, skipValidation = false }) {
  const code = normaliseCode(couponCode);
  if (!code) throw ApiError.badRequest('Coupon code is required');

  const coupon = await Coupon.findOne({ code });
  if (!coupon) throw ApiError.notFound('Invalid Coupon Code');
  /* `skipValidation` is set when the org-creation flow re-resolves a
   * coupon snapshot it already validated at /apply time. Re-running the
   * isValid check there spuriously rejected coupons whose `usedCount`
   * had since hit `maxUses`, even though the redemption was for the
   * very same applicant. Plan / org-size gating is still enforced. */
  if (!skipValidation && !coupon.isValid) {
    throw ApiError.badRequest('Coupon is expired or no longer valid');
  }
  if (skipValidation && !coupon.isActive) {
    throw ApiError.badRequest('Coupon is no longer active');
  }

  const allowedPlans = coupon.effectiveAllowedPlans;
  if (allowedPlans.length > 0 && selectedPlan && !allowedPlans.includes(selectedPlan)) {
    throw ApiError.badRequest(`This coupon is not valid for the ${selectedPlan} plan`);
  }
  if (
    coupon.allowedOrganizationSizes &&
    coupon.allowedOrganizationSizes.length > 0 &&
    organizationSize &&
    !coupon.allowedOrganizationSizes.includes(organizationSize)
  ) {
    throw ApiError.badRequest(`This coupon is not valid for ${organizationSize} organisations`);
  }

  const planPrice = planPriceFor(selectedPlan);
  const { discountAmount, finalAmount, freePlan } = calculateDiscount(planPrice, coupon);

  let message = '';
  if (coupon.discountType === 'PERCENTAGE') message = `${coupon.discountValue}% off applied`;
  else if (coupon.discountType === 'FREE_PLAN') message = 'Free plan unlocked';
  else message = `₹${coupon.discountValue} flat discount applied`;

  return {
    valid: true,
    coupon: {
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      message,
      planPrice,
      discountAmount,
      finalAmount,
      freePlan,
      description: coupon.description || null,
    },
  };
}

/**
 * Atomically increment usedCount, refusing the redemption if another caller
 * has already exhausted the cap. Idempotent on impossible races. Called
 * once an organisation has actually been persisted with this coupon.
 */
async function recordCouponUsage(code) {
  const norm = normaliseCode(code);
  if (!norm) return null;
  const coupon = await Coupon.findOne({ code: norm });
  if (!coupon) return null;

  const cap = coupon.effectiveMaxUses;
  if (cap !== null && cap !== undefined) {
    const result = await Coupon.findOneAndUpdate(
      { code: norm, $expr: { $lt: ['$usedCount', cap] } },
      { $inc: { usedCount: 1 } },
      { new: true }
    );
    return result;
  }
  return Coupon.findOneAndUpdate({ code: norm }, { $inc: { usedCount: 1 } }, { new: true });
}

async function markCouponUsed(couponId) {
  await Coupon.findByIdAndUpdate(couponId, { $inc: { usedCount: 1 } });
}

module.exports = {
  createCoupon,
  listCoupons,
  toggleCoupon,
  deleteCoupon,
  validateCoupon,
  applyCoupon,
  recordCouponUsage,
  markCouponUsed,
};
