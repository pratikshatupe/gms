'use strict';

const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: 30,
      index: true,
    },
    description: { type: String, trim: true, maxlength: 200 },

    /* PERCENTAGE → percent off; FLAT/FIXED → amount off; FREE_PLAN → makes
       the plan free. Spec uses lowercase aliases; we store uppercase. */
    discountType: {
      type: String,
      enum: ['PERCENTAGE', 'FLAT', 'FREE_PLAN'],
      required: true,
    },
    discountValue: { type: Number, required: true, min: 0 },

    /* Plan / org-size gating. Empty array = no restriction. Both the legacy
       (`applicablePlans`, `usageLimit`) and the spec (`allowedPlans`,
       `maxUses`) names are kept so existing rows keep working — the
       validation layer reads whichever is populated. */
    applicablePlans:          { type: [String], default: [] },
    allowedPlans:             { type: [String], default: [] },
    allowedOrganizationSizes: { type: [String], default: [] },

    minOrderAmount:    { type: Number, default: 0 },
    maxDiscountAmount: { type: Number, default: null },

    usageLimit: { type: Number, default: null },
    maxUses:    { type: Number, default: null },
    usedCount:  { type: Number, default: 0 },

    validFrom:  { type: Date, default: Date.now },
    validUntil: { type: Date, default: null },

    isActive:  { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

couponSchema.virtual('effectiveAllowedPlans').get(function () {
  return (this.allowedPlans && this.allowedPlans.length) ? this.allowedPlans : this.applicablePlans;
});
couponSchema.virtual('effectiveMaxUses').get(function () {
  return this.maxUses != null ? this.maxUses : this.usageLimit;
});

couponSchema.virtual('isValid').get(function () {
  if (!this.isActive) return false;
  /* Compare epoch ms explicitly so a `validUntil` saved without a
   * timezone marker is interpreted consistently regardless of the
   * server's local TZ. Previously a `new Date()` vs `Date` object
   * comparison could fire up to ~5.5h early when the server ran in UTC
   * but the coupon was authored in IST. */
  const nowMs = Date.now();
  if (this.validFrom && nowMs < new Date(this.validFrom).getTime()) return false;
  if (this.validUntil && nowMs > new Date(this.validUntil).getTime()) return false;
  const cap = this.effectiveMaxUses;
  if (cap !== null && cap !== undefined && this.usedCount >= cap) return false;
  return true;
});

module.exports = mongoose.model('Coupon', couponSchema);
