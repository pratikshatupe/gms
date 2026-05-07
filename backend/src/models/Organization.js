'use strict';

const mongoose = require('mongoose');

const organizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    legalName: { type: String, trim: true },
    industry: { type: String, trim: true },
    website: { type: String, trim: true },
    contactEmail: { type: String, lowercase: true, trim: true },
    contactPhone: { type: String, trim: true },
    address: {
      line1: { type: String, trim: true },
      line2: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      country: { type: String, trim: true },
      postalCode: { type: String, trim: true },
    },
    logoUrl: { type: String, trim: true },
    timezone: { type: String, default: 'Asia/Dubai' },
    plan: {
      type: String,
      enum: ['Starter', 'Professional', 'Enterprise'],
      default: 'Starter',
    },
    subscriptionStatus: {
      type: String,
      enum: ['ACTIVE', 'PAST_DUE', 'CANCELLED', 'TRIAL'],
      default: 'TRIAL',
    },
    billingCycle: { type: String, enum: ['monthly', 'yearly'], default: 'monthly' },
    trialEndsAt: { type: Date },
    subscriptionStartedAt: { type: Date },
    endDate: { type: Date },
    mrr: { type: Number, default: 0 },
    currency: { type: String, default: 'INR' },
    autoRenew: { type: Boolean, default: true },
    cancellationReason: { type: String },
    cancelledAt: { type: Date },
    cancellationScheduledFor: { type: Date },
    subscriptionExpiresAt: { type: Date },
    settings: {
      visitorBadgePrefix: { type: String, default: 'V' },
      enableWhatsApp: { type: Boolean, default: true },
      enableEmail: { type: Boolean, default: true },
      requireIdVerification: { type: Boolean, default: true },
      maintenanceMode: { type: Boolean, default: false },
      allowRegistrations: { type: Boolean, default: true },
      force2FA: { type: Boolean, default: false },
      auditLogging: { type: Boolean, default: true },
      defaultTimezone: { type: String, default: 'Asia/Dubai' },
      dateFormat: { type: String, default: 'DD/MM/YYYY' },
      primaryColor: { type: String, default: '#0284C7' },
      notifEmail: { type: Boolean, default: true },
      notifWhatsApp: { type: Boolean, default: false },
      notifInApp: { type: Boolean, default: true },
      notifVisitorCheckin: { type: Boolean, default: true },
      notifAppointmentReminder: { type: Boolean, default: true },
      notifServiceAlert: { type: Boolean, default: true },
    },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    /* ─── Coupon snapshot (recorded at organisation creation) ───
       The amounts are recomputed on the backend from the plan catalogue —
       the frontend never gets to set them. */
    couponCode:      { type: String, uppercase: true, trim: true, default: null },
    appliedDiscount: {
      discountType:   { type: String, enum: ['PERCENTAGE', 'FLAT', 'FREE_PLAN', null], default: null },
      discountValue:  { type: Number, default: 0 },
      discountAmount: { type: Number, default: 0 },
      planPrice:      { type: Number, default: 0 },
      finalAmount:    { type: Number, default: 0 },
      appliedAt:      { type: Date,   default: null },
    },
  },
  { timestamps: true }
);

organizationSchema.index({ name: 'text', legalName: 'text' });

module.exports = mongoose.model('Organization', organizationSchema);
