'use strict';

const Joi = require('joi');
const { ROOM_STATUS, ROOM_TYPE } = require('../config/constants');

const objectId = Joi.string().hex().length(24);

const create = {
  body: Joi.object({
    officeId: objectId.required(),
    name: Joi.string().min(2).max(150).required(),
    code: Joi.string().max(20).uppercase().optional(),
    type: Joi.string().valid(...Object.values(ROOM_TYPE)).optional(),
    capacity: Joi.number().integer().min(1).max(1000).required(),
    floor: Joi.string().max(20).optional(),
    location: Joi.string().max(150).optional(),
    amenities: Joi.array().items(Joi.string().max(60)).optional(),
    status: Joi.string().valid(...Object.values(ROOM_STATUS)).optional(),
    notes: Joi.string().max(500).optional(),
  }),
};

const update = {
  params: Joi.object({ id: objectId.required() }),
  body: Joi.object({
    name: Joi.string().min(2).max(150).optional(),
    code: Joi.string().max(20).uppercase().optional(),
    type: Joi.string().valid(...Object.values(ROOM_TYPE)).optional(),
    capacity: Joi.number().integer().min(1).max(1000).optional(),
    floor: Joi.string().max(20).optional(),
    location: Joi.string().max(150).optional(),
    amenities: Joi.array().items(Joi.string().max(60)).optional(),
    status: Joi.string().valid(...Object.values(ROOM_STATUS)).optional(),
    isActive: Joi.boolean().optional(),
    notes: Joi.string().max(500).optional(),
  }).min(1),
};

const updateStatus = {
  params: Joi.object({ id: objectId.required() }),
  body: Joi.object({
    status: Joi.string().valid(...Object.values(ROOM_STATUS)).required(),
  }),
};

const list = {
  query: Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    search: Joi.string().max(100).optional(),
    officeId: objectId.optional(),
    type: Joi.string().valid(...Object.values(ROOM_TYPE)).optional(),
    status: Joi.string().valid(...Object.values(ROOM_STATUS)).optional(),
    isActive: Joi.boolean().optional(),
    minCapacity: Joi.number().integer().min(1).optional(),
    sortBy: Joi.string().max(100).optional(),
  }),
};

const availability = {
  query: Joi.object({
    officeId: objectId.required(),
    fromDate: Joi.date().required(),
    toDate: Joi.date().greater(Joi.ref('fromDate')).required(),
    minCapacity: Joi.number().integer().min(1).optional(),
  }),
};

const byId = {
  params: Joi.object({ id: objectId.required() }),
};

module.exports = { create, update, updateStatus, list, availability, byId };
