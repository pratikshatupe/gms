'use strict';

const mongoose = require('mongoose');
const { APPOINTMENT_STATUS } = require('../config/constants');

const appointmentSchema = new mongoose.Schema(
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

    title: { type: String, required: true, trim: true, maxlength: 200 },
    purpose: { type: String, trim: true, maxlength: 500 },

    visitor: {
      fullName: { type: String, required: true, trim: true },
      email: { type: String, lowercase: true, trim: true },
      phone: { type: String, required: true, trim: true },
      company: { type: String, trim: true },
      designation: { type: String, trim: true },
    },

    hostUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    hostDepartment: { type: String, trim: true },

    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', default: null },

    scheduledAt: { type: Date, required: true, index: true },
    durationMinutes: { type: Number, required: true, min: 5, default: 30 },
    endsAt: { type: Date, required: true, index: true },

    status: {
      type: String,
      enum: Object.values(APPOINTMENT_STATUS),
      default: APPOINTMENT_STATUS.SCHEDULED,
      index: true,
    },

    requiredDocuments: {
      type: [String],
      enum: ['ID_COPY', 'AUTHORIZATION_LETTER', 'NDA', 'OTHER'],
      default: [],
    },

    // Guest confirmation tracking (doc: "Confirmation tracking to know which guests accepted or declined")
    guestConfirmationStatus: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'DECLINED'],
      default: 'PENDING',
    },
    guestConfirmedAt: { type: Date },

    notifyEmail: { type: Boolean, default: true },
    notifyWhatsApp: { type: Boolean, default: true },

    reminderSentAt: { type: Date },
    confirmedAt: { type: Date },
    cancelledAt: { type: Date },
    cancellationReason: { type: String, trim: true },

    notes: { type: String, trim: true, maxlength: 1000 },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

appointmentSchema.index({ organizationId: 1, officeId: 1, scheduledAt: 1 });
appointmentSchema.index({ organizationId: 1, status: 1, scheduledAt: 1 });

module.exports = mongoose.model('Appointment', appointmentSchema);
