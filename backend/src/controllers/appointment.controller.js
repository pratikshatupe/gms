'use strict';

const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const appointmentService = require('../services/appointment.service');

const create = asyncHandler(async (req, res) => {
  const appt = await appointmentService.createAppointment(req.body, req.tenant.organizationId, req.user);
  return ApiResponse.created(res, appt, 'Appointment created');
});

const list = asyncHandler(async (req, res) => {
  const { items, meta } = await appointmentService.listAppointments(req.query, req.tenant.organizationId);
  return ApiResponse.success(res, { data: items, meta });
});

const get = asyncHandler(async (req, res) => {
  const appt = await appointmentService.getAppointmentById(req.params.id, req.tenant.organizationId);
  return ApiResponse.success(res, { data: appt });
});

const update = asyncHandler(async (req, res) => {
  const appt = await appointmentService.updateAppointment(req.params.id, req.tenant.organizationId, req.body);
  return ApiResponse.success(res, { message: 'Appointment updated', data: appt });
});

const cancel = asyncHandler(async (req, res) => {
  const appt = await appointmentService.cancelAppointment(
    req.params.id,
    req.tenant.organizationId,
    req.body.reason
  );
  return ApiResponse.success(res, { message: 'Appointment cancelled', data: appt });
});

module.exports = { create, list, get, update, cancel };
