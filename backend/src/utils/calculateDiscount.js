'use strict';

/**
 * Plan-price catalogue (INR/month). Mirrors the front-end PLANS_REG so the
 * backend can recompute discounts for a plan id without depending on the
 * frontend payload — never trust client-supplied amounts.
 */
const PLAN_PRICES = Object.freeze({
  Starter:      1999,
  Professional: 4999,
  Enterprise:   8999,
  starter:      1999,
  professional: 4999,
  enterprise:   8999,
});

function planPriceFor(planId) {
  if (planId === undefined || planId === null) return 0;
  if (typeof planId === 'number') return planId;
  return PLAN_PRICES[String(planId)] || 0;
}

/**
 * Apply a coupon to a plan price. Pure function — does NOT touch the DB and
 * does NOT mutate the coupon. Returns:
 *   { discountAmount, finalAmount, freePlan }
 *
 * Recognised discount types:
 *   PERCENTAGE → discountValue interpreted as a 0–100 percent of price
 *   FLAT / FIXED → discountValue is a money amount, capped to the price
 *   FREE_PLAN → makes the plan free for the configured period
 */
function calculateDiscount(planPrice, coupon) {
  const price = Math.max(0, Number(planPrice) || 0);
  if (!coupon) return { discountAmount: 0, finalAmount: price, freePlan: false };

  const value = Number(coupon.discountValue) || 0;
  const type  = (coupon.discountType || '').toString().toUpperCase();

  let discountAmount = 0;
  let freePlan = false;

  switch (type) {
    case 'PERCENTAGE':
      discountAmount = Math.round((value / 100) * price);
      if (coupon.maxDiscountAmount) {
        discountAmount = Math.min(discountAmount, Number(coupon.maxDiscountAmount));
      }
      break;
    case 'FLAT':
    case 'FIXED':
      discountAmount = Math.min(value, price);
      break;
    case 'FREE_PLAN':
      discountAmount = price;
      freePlan = true;
      break;
    default:
      discountAmount = 0;
  }

  return {
    discountAmount,
    finalAmount: Math.max(0, price - discountAmount),
    freePlan,
  };
}

module.exports = { calculateDiscount, planPriceFor, PLAN_PRICES };
