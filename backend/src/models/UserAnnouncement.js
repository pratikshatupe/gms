'use strict';

const mongoose = require('mongoose');

/**
 * Per-user state for an Announcement. One row per (announcement, user)
 * pair. Used to:
 *   • track who an announcement was delivered to (in-app + email),
 *   • record when each user read or dismissed it,
 *   • record per-user email delivery outcome.
 *
 * Dismissing here is local to the user — the parent Announcement doc is
 * NOT removed. Only Super Admin's `deleteAnnouncementGlobal` removes the
 * Announcement and cascades a `deleteMany` over this collection.
 */
const userAnnouncementSchema = new mongoose.Schema(
  {
    announcementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Announcement',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    organisationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      default: null,
      index: true,
    },

    read: { type: Boolean, default: false },
    readAt: { type: Date },
    dismissed: { type: Boolean, default: false, index: true },
    dismissedAt: { type: Date },

    deliveredEmail: { type: Boolean, default: false },
    emailStatus: {
      type: String,
      enum: ['sent', 'failed', 'not_selected'],
      default: 'not_selected',
    },
    emailError: { type: String, trim: true },
  },
  { timestamps: true }
);

userAnnouncementSchema.index({ announcementId: 1, userId: 1 }, { unique: true });
userAnnouncementSchema.index({ userId: 1, dismissed: 1, createdAt: -1 });

module.exports = mongoose.model('UserAnnouncement', userAnnouncementSchema);
