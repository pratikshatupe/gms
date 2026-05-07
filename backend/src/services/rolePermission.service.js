'use strict';

const RolePermission = require('../models/RolePermission');

async function getPermissions(organizationId) {
  const docs = await RolePermission.find({ organizationId }).lean();
  const matrix = {};
  docs.forEach((d) => { matrix[d.role] = d.permissions; });
  return matrix;
}

async function setPermissions(organizationId, role, permissions, actorId) {
  return RolePermission.findOneAndUpdate(
    { organizationId, role },
    { permissions, updatedBy: actorId },
    { upsert: true, new: true }
  );
}

async function setAllPermissions(organizationId, matrix, actorId) {
  const ops = Object.entries(matrix).map(([role, permissions]) => ({
    updateOne: {
      filter: { organizationId, role },
      update: { $set: { permissions, updatedBy: actorId } },
      upsert: true,
    },
  }));
  await RolePermission.bulkWrite(ops);
  return getPermissions(organizationId);
}

module.exports = { getPermissions, setPermissions, setAllPermissions };
