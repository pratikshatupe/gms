'use strict';

const mongoose = require('mongoose');

const ANNOUNCEMENT_TYPE = ['info', 'warning', 'urgent'];

const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    message: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ANNOUNCEMENT_TYPE,
      default: 'info',
      index: true,
    },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

announcementSchema.index({ isActive: 1, createdAt: -1 });

module.exports = mongoose.model('Announcement', announcementSchema);
