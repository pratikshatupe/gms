'use strict';

const Joi = require('joi');
const { ROLE_LIST } = require('../config/constants');

const objectId = Joi.string().hex().length(24);

const create = {
  body: Joi.object({
    name: Joi.string().min(2).max(150).required(),
    email: Joi.string().email().required(),
    phone: Joi.string().max(30).optional(),
    designation: Joi.string().max(100).optional(),
    department: Joi.string().max(100).optional(),
    password: Joi.string().min(8).max(128).optional(),
    role: Joi.string()
      .valid(...ROLE_LIST)
      .required(),
    officeId: objectId.optional().allow(null, ''),
    assignedOffices: Joi.array().items(objectId).optional(),
    permissions: Joi.array().items(Joi.string().max(60)).optional(),
  }),
};

const update = {
  params: Joi.object({ id: objectId.required() }),
  body: Joi.object({
    name: Joi.string().min(2).max(150).optional(),
    phone: Joi.string().max(30).optional(),
    designation: Joi.string().max(100).optional(),
    department: Joi.string().max(100).optional(),
    role: Joi.string().valid(...ROLE_LIST).optional(),
    officeId: objectId.optional().allow(null, ''),
    assignedOffices: Joi.array().items(objectId).optional(),
    permissions: Joi.array().items(Joi.string().max(60)).optional(),
    isActive: Joi.boolean().optional(),
    avatarUrl: Joi.string().uri().optional(),
  }).min(1),
};

const resetPassword = {
  params: Joi.object({ id: objectId.required() }),
  body: Joi.object({
    newPassword: Joi.string().min(8).max(128).required(),
  }),
};

const list = {
  query: Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    search: Joi.string().max(100).optional(),
    role: Joi.string().valid(...ROLE_LIST).optional(),
    officeId: objectId.optional(),
    isActive: Joi.boolean().optional(),
    sortBy: Joi.string().max(100).optional(),
  }),
};

const byId = {
  params: Joi.object({ id: objectId.required() }),
};

module.exports = { create, update, resetPassword, list, byId };
