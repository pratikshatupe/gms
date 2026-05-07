'use strict';

const mongoose = require('mongoose');

const planSchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, trim: true, unique: true, maxlength: 80 },
    code:        { type: String, trim: true, uppercase: true, index: true },
    description: { type: String, trim: true, default: '' },

    /* Catalogue pricing — both monthly and yearly are stored so the
       frontend can flip cycles without recalculating tax/discounts. */
    price:        { type: Number, required: true, default: 0, min: 0 },
    yearlyPrice:  { type: Number, default: 0, min: 0 },
    currency:     { type: String, default: 'INR' },
    billingCycle: { type: String, enum: ['monthly', 'yearly'], default: 'monthly' },

    /* Module / feature catalogue. Stored as plain strings so the frontend
       can render them in any order without a separate i18n table. */
    features:   [{ type: String, trim: true }],

    /* Hard limits enforced by the org-scope middlewares + dashboards. */
    maxGuests:  { type: Number, default: 0, min: 0 },
    maxStaff:   { type: Number, default: 0, min: 0 },
    maxOffices: { type: Number, default: 0, min: 0 },
    maxStorageGb:   { type: Number, default: 0, min: 0 },
    maxApiCallsDay: { type: Number, default: 0, min: 0 },

    /* Display + lifecycle. */
    badgeColour: { type: String, default: '#0284C7' },
    mostPopular: { type: Boolean, default: false },
    visibility:  { type: String, enum: ['Public', 'Hidden'], default: 'Public' },
    status:      { type: String, enum: ['Active', 'Draft', 'Archived'], default: 'Active' },
    trialDays:   { type: Number, default: 14, min: 0, max: 90 },
    sortOrder:   { type: Number, default: 0 },

    createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

planSchema.index({ status: 1, visibility: 1, sortOrder: 1 });

module.exports = mongoose.model('Plan', planSchema);
