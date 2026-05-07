'use strict';

const Joi = require('joi');
const { SERVICE_CATEGORY, SERVICE_STATUS } = require('../config/constants');

const objectId = Joi.string().hex().length(24);

const create = {
  body: Joi.object({
    officeId: objectId.required(),
    guestId: objectId.optional(),
    appointmentId: objectId.optional(),
    roomId: objectId.optional(),
    category: Joi.string().valid(...Object.values(SERVICE_CATEGORY)).required(),
    title: Joi.string().min(2).max(200).required(),
    description: Joi.string().max(1000).optional(),
    quantity: Joi.number().integer().min(1).max(500).optional(),
    priority: Joi.string().valid('LOW', 'NORMAL', 'HIGH', 'URGENT').optional(),
    assignedTo: objectId.optional(),
  }),
};

const update = {
  params: Joi.object({ id: objectId.required() }),
  body: Joi.object({
    title: Joi.string().min(2).max(200).optional(),
    description: Joi.string().max(1000).optional(),
    quantity: Joi.number().integer().min(1).max(500).optional(),
    priority: Joi.string().valid('LOW', 'NORMAL', 'HIGH', 'URGENT').optional(),
    assignedTo: objectId.optional().allow(null),
    notes: Joi.string().max(1000).optional(),
  }).min(1),
};

const updateStatus = {
  params: Joi.object({ id: objectId.required() }),
  body: Joi.object({
    status: Joi.string().valid(...Object.values(SERVICE_STATUS)).required(),
    cancellationReason: Joi.string().max(500).optional(),
    notes: Joi.string().max(1000).optional(),
  }),
};

const assign = {
  params: Joi.object({ id: objectId.required() }),
  body: Joi.object({
    assignedTo: objectId.required(),
  }),
};

const list = {
  query: Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    search: Joi.string().max(100).optional(),
    officeId: objectId.optional(),
    category: Joi.string().valid(...Object.values(SERVICE_CATEGORY)).optional(),
    status: Joi.string().valid(...Object.values(SERVICE_STATUS)).optional(),
    assignedTo: objectId.optional(),
    guestId: objectId.optional(),
    fromDate: Joi.date().optional(),
    toDate: Joi.date().optional(),
    sortBy: Joi.string().max(100).optional(),
  }),
};

const byId = {
  params: Joi.object({ id: objectId.required() }),
};

module.exports = { create, update, updateStatus, assign, list, byId };
