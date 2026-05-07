'use strict';

const mongoose = require('mongoose');

const referralUsageSchema = new mongoose.Schema(
  {
    referralId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Referral', required: true, index: true },
    referrerId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    referredUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    referredOrgId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', default: null },
    signedUpAt:     { type: Date, default: Date.now },
    convertedAt:    { type: Date, default: null },
    rewardStatus:   { type: String, enum: ['PENDING', 'EARNED', 'PAID', 'CANCELLED'], default: 'PENDING' },
    rewardAmount:   { type: Number, default: 0 },
  },
  { timestamps: true }
);

referralUsageSchema.index({ referralId: 1, referredUserId: 1 }, { unique: true });

module.exports = mongoose.model('ReferralUsage', referralUsageSchema);
