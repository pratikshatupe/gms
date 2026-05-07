'use strict';

const mongoose = require('mongoose');

const officeSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 150 },
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 20 },
    city: { type: String, trim: true },
    country: { type: String, trim: true },
    address: {
      line1: { type: String, trim: true },
      line2: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      country: { type: String, trim: true },
      postalCode: { type: String, trim: true },
    },
    timezone: { type: String, default: 'Asia/Dubai' },
    contactPhone: { type: String, trim: true },
    contactEmail: { type: String, lowercase: true, trim: true },
    workingHours: {
      open: { type: String, default: '09:00' },
      close: { type: String, default: '18:00' },
      workingDays: {
        type: [Number],
        default: [0, 1, 2, 3, 4],
        validate: (arr) => arr.every((n) => n >= 0 && n <= 6),
      },
    },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

officeSchema.index({ organizationId: 1, code: 1 }, { unique: true });
officeSchema.index({ organizationId: 1, name: 1 });

module.exports = mongoose.model('Office', officeSchema);
