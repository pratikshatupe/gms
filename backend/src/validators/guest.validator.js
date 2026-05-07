'use strict';

const Joi = require('joi');
const { GUEST_STATUS, GUEST_TYPE, ID_TYPE } = require('../config/constants');

const objectId = Joi.string().hex().length(24);

const idSchema = Joi.object({
  type: Joi.string().valid(...Object.values(ID_TYPE)).optional(),
  number: Joi.string().max(50).optional(),
  documentUrl: Joi.string().uri().optional(),
});

const checkIn = {
  body: Joi.object({
    officeId: objectId.required(),
    appointmentId: objectId.optional(),
    type: Joi.string().valid(...Object.values(GUEST_TYPE)).optional(),
    fullName: Joi.string().min(2).max(200).required(),
    email: Joi.string().email().optional(),
    phone: Joi.string().min(5).max(30).required(),
    company: Joi.string().max(150).optional(),
    designation: Joi.string().max(100).optional(),
    purpose: Joi.string().max(500).optional(),
    photoUrl: Joi.string().uri().optional(),
    idVerification: idSchema.optional(),
    hostUserId: objectId.optional(),
    hostDepartment: Joi.string().max(100).optional(),
    roomId: objectId.optional(),
    accompanyingCount: Joi.number().integer().min(0).max(50).optional(),
    vehicleNumber: Joi.string().max(30).optional(),
    expectedAt: Joi.date().optional(),
    notes: Joi.string().max(1000).optional(),
  }),
};

const update = {
  params: Joi.object({ id: objectId.required() }),
  body: Joi.object({
    fullName: Joi.string().min(2).max(200).optional(),
    email: Joi.string().email().optional(),
    phone: Joi.string().min(5).max(30).optional(),
    company: Joi.string().max(150).optional(),
    designation: Joi.string().max(100).optional(),
    purpose: Joi.string().max(500).optional(),
    photoUrl: Joi.string().uri().optional(),
    idVerification: idSchema.optional(),
    hostUserId: objectId.optional(),
    hostDepartment: Joi.string().max(100).optional(),
    roomId: objectId.optional().allow(null),
    accompanyingCount: Joi.number().integer().min(0).max(50).optional(),
    vehicleNumber: Joi.string().max(30).optional(),
    notes: Joi.string().max(1000).optional(),
    status: Joi.string().valid(...Object.values(GUEST_STATUS)).optional(),
  }).min(1),
};

const checkOut = {
  params: Joi.object({ id: objectId.required() }),
};

const verifyId = {
  params: Joi.object({ id: objectId.required() }),
  body: Joi.object({
    type: Joi.string().valid(...Object.values(ID_TYPE)).required(),
    number: Joi.string().max(50).required(),
    documentUrl: Joi.string().uri().optional(),
  }),
};

const list = {
  query: Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    search: Joi.string().max(100).optional(),
    officeId: objectId.optional(),
    status: Joi.string().valid(...Object.values(GUEST_STATUS)).optional(),
    type: Joi.string().valid(...Object.values(GUEST_TYPE)).optional(),
    hostUserId: objectId.optional(),
    fromDate: Joi.date().optional(),
    toDate: Joi.date().optional(),
    sortBy: Joi.string().max(100).optional(),
  }),
};

const byId = {
  params: Joi.object({ id: objectId.required() }),
};

module.exports = { checkIn, update, checkOut, verifyId, list, byId };
