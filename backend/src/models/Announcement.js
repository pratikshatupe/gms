'use strict';

const mongoose = require('mongoose');
const { ROLE_LIST } = require('../config/constants');

const RECIPIENT_TYPE = ['all_organisations', 'organisation', 'role', 'specific_users'];
const ANNOUNCEMENT_STATUS = ['sent', 'scheduled', 'failed'];
const ANNOUNCEMENT_TYPE = ['info', 'warning', 'urgent'];

const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    body:  { type: String, required: true, trim: true, maxlength: 5000 },

    type: { type: String, enum: ANNOUNCEMENT_TYPE, default: 'info', index: true },
    isActive: { type: Boolean, default: true, index: true },

    recipients: {
      type: {
        type: String,
        enum: RECIPIENT_TYPE,
        default: 'all_organisations',
      },
      organisationIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Organization' }],
      roles: [{ type: String, enum: ROLE_LIST }],
      userIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    },
    channels: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: false },
      sms:   { type: Boolean, default: false },
    },
    schedule: {
      sendNow:     { type: Boolean, default: true },
      scheduledAt: { type: Date,    default: null },
    },

    status: {
      type: String,
      enum: ANNOUNCEMENT_STATUS,
      default: 'sent',
      index: true,
    },
    deliverySummary: {
      totalRecipients: { type: Number, default: 0 },
      emailsSent:      { type: Number, default: 0 },
      emailsFailed:    { type: Number, default: 0 },
      lastError:       { type: String, trim: true },
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    createdByName: { type: String, trim: true },
  },
  { timestamps: true }
);

announcementSchema.pre('validate', function aliasMessageToBody(next) {
  if (!this.body && this._raw && this._raw.message) this.body = this._raw.message;
  next();
});

announcementSchema.index({ isActive: 1, createdAt: -1 });

const Announcement = mongoose.model('Announcement', announcementSchema);
Announcement.RECIPIENT_TYPE = RECIPIENT_TYPE;
Announcement.ANNOUNCEMENT_STATUS = ANNOUNCEMENT_STATUS;
Announcement.ANNOUNCEMENT_TYPE = ANNOUNCEMENT_TYPE;

module.exports = Announcement;
