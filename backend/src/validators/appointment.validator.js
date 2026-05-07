'use strict';

const Joi = require('joi');
const { APPOINTMENT_STATUS } = require('../config/constants');

const objectId = Joi.string().hex().length(24);

const visitorSchema = Joi.object({
  fullName: Joi.string().min(2).max(200).required(),
  email: Joi.string().email().optional(),
  phone: Joi.string().min(5).max(30).required(),
  company: Joi.string().max(150).optional(),
  designation: Joi.string().max(100).optional(),
});

const create = {
  body: Joi.object({
    officeId: objectId.required(),
    title: Joi.string().min(2).max(200).required(),
    purpose: Joi.string().max(500).optional(),
    visitor: visitorSchema.required(),
    hostUserId: objectId.required(),
    hostDepartment: Joi.string().max(100).optional(),
    roomId: objectId.optional(),
    scheduledAt: Joi.date().greater('now').required(),
    durationMinutes: Joi.number().integer().min(5).max(720).default(30),
    requiredDocuments: Joi.array().items(Joi.string().max(60)).optional(),
    notifyEmail: Joi.boolean().optional(),
    notifyWhatsApp: Joi.boolean().optional(),
    notes: Joi.string().max(1000).optional(),
  }),
};

const update = {
  params: Joi.object({ id: objectId.required() }),
  body: Joi.object({
    title: Joi.string().min(2).max(200).optional(),
    purpose: Joi.string().max(500).optional(),
    visitor: visitorSchema.optional(),
    hostUserId: objectId.optional(),
    hostDepartment: Joi.string().max(100).optional(),
    roomId: objectId.optional().allow(null),
    scheduledAt: Joi.date().optional(),
    durationMinutes: Joi.number().integer().min(5).max(720).optional(),
    requiredDocuments: Joi.array().items(Joi.string().max(60)).optional(),
    notifyEmail: Joi.boolean().optional(),
    notifyWhatsApp: Joi.boolean().optional(),
    notes: Joi.string().max(1000).optional(),
    status: Joi.string().valid(...Object.values(APPOINTMENT_STATUS)).optional(),
  }).min(1),
};

const cancel = {
  params: Joi.object({ id: objectId.required() }),
  body: Joi.object({
    reason: Joi.string().max(500).optional(),
  }),
};

const list = {
  query: Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    search: Joi.string().max(100).optional(),
    officeId: objectId.optional(),
    hostUserId: objectId.optional(),
    status: Joi.string().valid(...Object.values(APPOINTMENT_STATUS)).optional(),
    fromDate: Joi.date().optional(),
    toDate: Joi.date().optional(),
    sortBy: Joi.string().max(100).optional(),
  }),
};

const byId = {
  params: Joi.object({ id: objectId.required() }),
};

module.exports = { create, update, cancel, list, byId };
