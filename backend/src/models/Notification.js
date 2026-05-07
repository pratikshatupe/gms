'use strict';

const mongoose = require('mongoose');
const {
  NOTIFICATION_CHANNEL,
  NOTIFICATION_STATUS,
  NOTIFICATION_EVENT,
} = require('../config/constants');

const notificationSchema = new mongoose.Schema(
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
      default: null,
      index: true,
    },
    channel: {
      type: String,
      enum: Object.values(NOTIFICATION_CHANNEL),
      required: true,
    },
    event: {
      type: String,
      enum: Object.values(NOTIFICATION_EVENT),
      required: true,
      index: true,
    },
    recipient: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      name: { type: String, trim: true },
      email: { type: String, lowercase: true, trim: true },
      phone: { type: String, trim: true },
    },
    subject: { type: String, trim: true },
    body: { type: String, trim: true },
    payload: { type: mongoose.Schema.Types.Mixed },

    relatedEntityType: { type: String, trim: true },
    relatedEntityId: { type: mongoose.Schema.Types.ObjectId },

    status: {
      type: String,
      enum: Object.values(NOTIFICATION_STATUS),
      default: NOTIFICATION_STATUS.PENDING,
      index: true,
    },
    attempts: { type: Number, default: 0 },
    lastError: { type: String, trim: true },
    sentAt: { type: Date },

    isRead: { type: Boolean, default: false },
    readAt: { type: Date },
  },
  { timestamps: true }
);

notificationSchema.index({ organizationId: 1, status: 1, createdAt: -1 });
notificationSchema.index({ 'recipient.userId': 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
