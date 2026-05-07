'use strict';

const ApiError = require('../utils/ApiError');
const { ROLES } = require('../config/constants');

function authorize(...allowedRoles) {
  const allowed = new Set(allowedRoles.flat());
  return (req, _res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication required'));
    }
    if (!allowed.has(req.user.role)) {
      return next(ApiError.forbidden('You do not have permission for this action'));
    }
    return next();
  };
}

const isSuperAdmin = (req, _res, next) => {
  if (!req.user || req.user.role !== ROLES.SUPER_ADMIN) {
    return next(ApiError.forbidden('Super admin access required'));
  }
  return next();
};

module.exports = { authorize, isSuperAdmin };
