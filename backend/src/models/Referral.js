'use strict';

const mongoose = require('mongoose');

const referralSchema = new mongoose.Schema(
  {
    referrerId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    referralCode:      { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    rewardType:        { type: String, enum: ['PERCENTAGE', 'FLAT', 'CREDITS'], default: 'FLAT' },
    rewardValue:       { type: Number, default: 500 },
    totalSignups:      { type: Number, default: 0 },
    totalConverted:    { type: Number, default: 0 },
    totalRewardEarned: { type: Number, default: 0 },
    isActive:          { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Referral', referralSchema);
