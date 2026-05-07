'use strict';

const mongoose = require('mongoose');
const { ROOM_STATUS, ROOM_TYPE } = require('../config/constants');

const roomSchema = new mongoose.Schema(
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
    name: { type: String, required: true, trim: true, maxlength: 150 },
    code: { type: String, trim: true, uppercase: true, maxlength: 20 },
    type: {
      type: String,
      enum: Object.values(ROOM_TYPE),
      default: ROOM_TYPE.MEETING,
      index: true,
    },
    capacity: { type: Number, required: true, min: 1 },
    floor: { type: String, trim: true },
    location: { type: String, trim: true },
    amenities: { type: [String], default: [] },
    status: {
      type: String,
      enum: Object.values(ROOM_STATUS),
      default: ROOM_STATUS.AVAILABLE,
      index: true,
    },
    isActive: { type: Boolean, default: true },
    notes: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

roomSchema.index({ organizationId: 1, officeId: 1, name: 1 }, { unique: true });
roomSchema.index({ organizationId: 1, status: 1 });

module.exports = mongoose.model('Room', roomSchema);
