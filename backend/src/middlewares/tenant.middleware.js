'use strict';

const ApiError = require('../utils/ApiError');
const { ROLES } = require('../config/constants');

/**
 * Resolves the organization scope of the request and binds it to req.tenant.
 * - SUPER_ADMIN may operate cross-organization. They MAY pass `organizationId`
 *   via header `x-organization-id` or query/body to scope a request.
 * - All other roles are strictly scoped to their own organization.
 */
const resolveTenant = (req, _res, next) => {
  if (!req.user) return next(ApiError.unauthorized());

  const role = req.user.role;

  if (role === ROLES.SUPER_ADMIN) {
    const headerOrg = req.headers['x-organization-id'];
    const queryOrg = req.query.organizationId;
    const bodyOrg = req.body && req.body.organizationId;
    const orgId = headerOrg || queryOrg || bodyOrg || null;
    req.tenant = { organizationId: orgId };
    return next();
  }

  if (!req.user.organizationId) {
    return next(ApiError.forbidden('User has no organization assigned'));
  }

  req.tenant = { organizationId: req.user.organizationId };
  return next();
};

/**
 * Forces an organization to be present on the request — used by routes that
 * cannot operate platform-wide.
 */
const requireTenant = (req, _res, next) => {
  if (!req.tenant || !req.tenant.organizationId) {
    return next(ApiError.badRequest('organizationId is required for this operation'));
  }
  return next();
};

module.exports = { resolveTenant, requireTenant };
