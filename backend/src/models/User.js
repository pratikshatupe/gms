'use strict';

const mongoose = require('mongoose');
const { ROLE_LIST, ROLES } = require('../config/constants');

const userSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      default: null,
      index: true,
    },
    officeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Office',
      default: null,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 150 },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      maxlength: 200,
    },
    phone: { type: String, trim: true },
    designation: { type: String, trim: true },
    department: { type: String, trim: true },
    avatarUrl: { type: String, trim: true },
    password: { type: String, required: true, select: false, minlength: 8 },
    role: {
      type: String,
      enum: ROLE_LIST,
      required: true,
      default: ROLES.RECEPTION,
      index: true,
    },
    permissions: {
      type: [String],
      default: [],
    },
    assignedOffices: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Office',
      },
    ],
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
    refreshToken: { type: String, select: false },
    passwordChangedAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    referralCode:          { type: String, uppercase: true, trim: true, index: true, sparse: true },
    referredByCode:        { type: String, uppercase: true, trim: true },
    referredByUserId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    referralRewardBalance: { type: Number, default: 0 },

    /* Bug 3 — security policy enforcement fields. */
    passwordExpiryNotifiedAt: { type: Date },
    failedLoginAttempts:      { type: Number, default: 0 },
    lockedUntil:              { type: Date },
    twoFASecret:              { type: String, select: false },
    twoFAEnabled:             { type: Boolean, default: false },
  },
  { timestamps: true }
);

userSchema.index({ organizationId: 1, email: 1 }, { unique: true });
userSchema.index({ role: 1, isActive: 1 });

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.password;
    delete ret.refreshToken;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
