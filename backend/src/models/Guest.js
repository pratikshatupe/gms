'use strict';

const mongoose = require('mongoose');
const { GUEST_STATUS, GUEST_TYPE, ID_TYPE } = require('../config/constants');

const guestSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    officeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Office',
      required: true,
      index: true,
    },
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      default: null,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(GUEST_TYPE),
      default: GUEST_TYPE.WALK_IN,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(GUEST_STATUS),
      default: GUEST_STATUS.EXPECTED,
      index: true,
    },
    badgeNumber: { type: String, trim: true, index: true },

    fullName: { type: String, required: true, trim: true, maxlength: 200 },
    email: { type: String, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true, index: true },
    company: { type: String, trim: true, index: true },
    designation: { type: String, trim: true },
    purpose: { type: String, trim: true, maxlength: 500 },
    photoUrl: { type: String, trim: true },

    idVerification: {
      type: {
        type: String,
        enum: Object.values(ID_TYPE),
        default: ID_TYPE.EMIRATES_ID,
      },
      number: { type: String, trim: true },
      documentUrl: { type: String, trim: true },
      verified: { type: Boolean, default: false },
      verifiedAt: { type: Date },
      verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },

    hostUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    hostDepartment: { type: String, trim: true },

    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', default: null },

    accompanyingCount: { type: Number, default: 0, min: 0 },
    vehicleNumber: { type: String, trim: true },

    expectedAt: { type: Date },
    checkedInAt: { type: Date, index: true },
    checkedOutAt: { type: Date },

    checkedInBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    checkedOutBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    notes: { type: String, trim: true, maxlength: 1000 },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

guestSchema.index({ organizationId: 1, officeId: 1, status: 1, createdAt: -1 });
guestSchema.index({ organizationId: 1, fullName: 'text', company: 'text', phone: 'text' });

module.exports = mongoose.model('Guest', guestSchema);
