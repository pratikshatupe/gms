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

const create = {
  body: Joi.object({
    name: Joi.string().min(2).max(200).required(),
    slug: Joi.string().lowercase().trim().min(2).max(60).pattern(/^[a-z0-9-]+$/).required(),
    legalName: Joi.string().max(200).optional(),
    industry: Joi.string().max(100).optional(),
    website: Joi.string().uri().optional(),
    contactEmail: Joi.string().email().optional(),
    contactPhone: Joi.string().max(30).optional(),
    address: addressSchema.optional(),
    timezone: Joi.string().max(60).optional(),
    plan: Joi.string().valid('FREE', 'STARTER', 'PRO', 'ENTERPRISE').optional(),
    settings: Joi.object({
      visitorBadgePrefix: Joi.string().max(5).optional(),
      enableWhatsApp: Joi.boolean().optional(),
      enableEmail: Joi.boolean().optional(),
      requireIdVerification: Joi.boolean().optional(),
    }).optional(),
  }),
};

const update = {
  params: Joi.object({ id: objectId.required() }),
  body: Joi.object({
    name: Joi.string().min(2).max(200).optional(),
    legalName: Joi.string().max(200).optional(),
    industry: Joi.string().max(100).optional(),
    website: Joi.string().uri().optional(),
    contactEmail: Joi.string().email().optional(),
    contactPhone: Joi.string().max(30).optional(),
    address: addressSchema.optional(),
    timezone: Joi.string().max(60).optional(),
    plan: Joi.string().valid('FREE', 'STARTER', 'PRO', 'ENTERPRISE').optional(),
    subscriptionStatus: Joi.string().valid('ACTIVE', 'PAST_DUE', 'CANCELLED', 'TRIAL').optional(),
    subscriptionExpiresAt: Joi.date().optional(),
    isActive: Joi.boolean().optional(),
    settings: Joi.object({
      visitorBadgePrefix: Joi.string().max(5).optional(),
      enableWhatsApp: Joi.boolean().optional(),
      enableEmail: Joi.boolean().optional(),
      requireIdVerification: Joi.boolean().optional(),
    }).optional(),
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
