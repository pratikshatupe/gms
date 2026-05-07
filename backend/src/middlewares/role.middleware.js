'use strict';

const ApiError = require('../utils/ApiError');
const { ROLES } = require('../config/constants');

/* Normalise role strings so comparisons accept both the canonical DB enum
 * ("SUPER_ADMIN", "DIRECTOR") and the lowercased aliases used by the demo
 * bypass / legacy tokens ("superadmin"). Underscores and hyphens are
 * stripped so "SuperAdmin", "super-admin", "SUPER_ADMIN" all collapse to
 * the same key. */
function normaliseRole(role) {
  if (!role) return '';
  return String(role).toUpperCase().replace(/[-_\s]/g, '');
}

const SUPER_ADMIN_KEYS = new Set([
  normaliseRole(ROLES.SUPER_ADMIN),
  normaliseRole('superadmin'),
]);

function authorize(...allowedRoles) {
  const allowed = new Set(allowedRoles.flat().map(normaliseRole));
  return (req, _res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication required'));
    }
    if (!allowed.has(normaliseRole(req.user.role))) {
      return next(ApiError.forbidden('You do not have permission for this action'));
    }
    return next();
  };
}

const isSuperAdmin = (req, _res, next) => {
  if (!req.user || !SUPER_ADMIN_KEYS.has(normaliseRole(req.user.role))) {
    return next(ApiError.forbidden('Super admin access required'));
  }
  return next();
};

module.exports = { authorize, isSuperAdmin, normaliseRole };
