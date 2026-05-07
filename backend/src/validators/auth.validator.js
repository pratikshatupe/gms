'use strict';

const Joi = require('joi');
const { ROLE_LIST } = require('../config/constants');

const objectId = Joi.string().hex().length(24);

/* Login validator
 *
 * Password is min(6) so the demo Super Admin credentials
 * (admin@example.com / admin123, superadmin@corpgms.com / 123456)
 * pass through. `register` and `changePassword` keep min(8) since
 * those are real account-creation flows that must enforce a stronger
 * minimum. */
const login = {
  body: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).max(128).required(),
    organizationSlug: Joi.string().lowercase().trim().optional(),
  }),
};

const refresh = {
  body: Joi.object({
    refreshToken: Joi.string().required(),
  }),
};

const changePassword = {
  body: Joi.object({
    currentPassword: Joi.string().min(6).required(),
    newPassword: Joi.string().min(8).max(128).required(),
  }),
};

const register = {
  body: Joi.object({
    name: Joi.string().min(2).max(150).required(),
    email: Joi.string().email().required(),
    phone: Joi.string().trim().max(30).optional(),
    password: Joi.string().min(8).max(128).required(),
    role: Joi.string()
      .valid(...ROLE_LIST)
      .required(),
    organizationId: objectId.optional(),
    officeId: objectId.optional(),
    designation: Joi.string().max(100).optional(),
    department: Joi.string().max(100).optional(),
  }),
};

module.exports = { login, refresh, changePassword, register };
