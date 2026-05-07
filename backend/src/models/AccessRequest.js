'use strict';

const mongoose = require('mongoose');

const accessRequestSchema = new mongoose.Schema(
  {
    organizationName: { type: String, required: true, trim: true },
    contactName: { type: String, required: true, trim: true },
    contactEmail: { type: String, required: true, lowercase: true, trim: true },
    contactPhone: { type: String, trim: true },
    industry: { type: String, trim: true },
    country: { type: String, trim: true },
    message: { type: String, trim: true },
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected', 'InfoRequested'],
      default: 'Pending',
      index: true,
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    reviewNote: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AccessRequest', accessRequestSchema);
