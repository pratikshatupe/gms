'use strict';

const mongoose = require('mongoose');

const rolePermissionSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    role: { type: String, required: true, trim: true },
    permissions: { type: mongoose.Schema.Types.Mixed, default: {} },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

rolePermissionSchema.index({ organizationId: 1, role: 1 }, { unique: true });

module.exports = mongoose.model('RolePermission', rolePermissionSchema);
