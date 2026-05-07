'use strict';

const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    transactionId: { type: String, required: true, trim: true },
    amount:        { type: Number, required: true, min: 0 },
    currency:      { type: String, default: 'INR' },
    paymentMethod: { type: String, enum: ['UPI', 'CARD', 'NETBANKING'], required: true },
    methodDetails: {
      upiId:     { type: String, trim: true, default: null },
      cardLast4: { type: String, trim: true, default: null },
      bankName:  { type: String, trim: true, default: null },
    },
    status:        { type: String, enum: ['SUCCESS', 'FAILED', 'PENDING'], default: 'SUCCESS' },
    paidAt:        { type: Date, default: Date.now },
  },
  { _id: true, timestamps: true }
);

const subscriptionSchema = new mongoose.Schema(
  {
    organisationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Plan',
      required: true,
    },
    planName:     { type: String, trim: true },
    amount:       { type: Number, default: 0, min: 0 },
    currency:     { type: String, default: 'INR' },
    billingCycle: { type: String, enum: ['monthly', 'yearly'], default: 'monthly' },
    status: {
      type: String,
      enum: ['active', 'expired', 'cancelled', 'trial', 'past_due'],
      default: 'active',
      index: true,
    },
    startDate:    { type: Date, default: Date.now },
    endDate:      { type: Date, required: true },
    autoRenew:    { type: Boolean, default: true },
    paymentMethod: { type: String, enum: ['UPI', 'CARD', 'NETBANKING', null], default: null },

    /* Ledger — every Pay Now or upgrade pushes a record here so the
       Subscription page can render Payment History without a join. */
    payments:     [paymentSchema],

    cancelledAt:  { type: Date },
    createdBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

subscriptionSchema.index({ organisationId: 1, status: 1 });

module.exports = mongoose.model('Subscription', subscriptionSchema);
