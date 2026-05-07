'use strict';

const Joi = require('joi');

const objectId = Joi.string().hex().length(24);

const addressSchema = Joi.object({
  line1: Joi.string().max(200).allow(''),
  line2: Joi.string().max(200).allow(''),
  city: Joi.string().max(100).allow(''),
  state: Joi.string().max(100).allow(''),
  country: Joi.string().max(100).allow(''),
  postalCode: Joi.string().max(20).allow(''),
});

const workingHoursSchema = Joi.object({
  open: Joi.string().pattern(/^\d{2}:\d{2}$/).optional(),
  close: Joi.string().pattern(/^\d{2}:\d{2}$/).optional(),
  workingDays: Joi.array().items(Joi.number().integer().min(0).max(6)).optional(),
});

const create = {
  body: Joi.object({
    name: Joi.string().min(2).max(150).required(),
    code: Joi.string().min(2).max(20).uppercase().required(),
    city: Joi.string().max(100).optional(),
    country: Joi.string().max(100).optional(),
    address: addressSchema.optional(),
    timezone: Joi.string().max(60).optional(),
    contactPhone: Joi.string().max(30).optional(),
    contactEmail: Joi.string().email().optional(),
    workingHours: workingHoursSchema.optional(),
  }),
};

const update = {
  params: Joi.object({ id: objectId.required() }),
  body: Joi.object({
    name: Joi.string().min(2).max(150).optional(),
    code: Joi.string().min(2).max(20).uppercase().optional(),
    city: Joi.string().max(100).optional(),
    country: Joi.string().max(100).optional(),
    address: addressSchema.optional(),
    timezone: Joi.string().max(60).optional(),
    contactPhone: Joi.string().max(30).optional(),
    contactEmail: Joi.string().email().optional(),
    workingHours: workingHoursSchema.optional(),
    isActive: Joi.boolean().optional(),
  }).min(1),
};

const list = {
  query: Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    search: Joi.string().max(100).optional(),
    isActive: Joi.boolean().optional(),
    sortBy: Joi.string().max(100).optional(),
  }),
};

const byId = {
  params: Joi.object({ id: objectId.required() }),
};

module.exports = { create, update, list, byId };
