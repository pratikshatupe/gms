'use strict';

const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');
const env = require('../config/env');
const logger = require('../config/logger');

function normalizeError(err) {
  if (err instanceof ApiError) return err;

  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return ApiError.unprocessable('Validation failed', details);
  }

  if (err instanceof mongoose.Error.CastError) {
    return ApiError.badRequest(`Invalid ${err.path}: ${err.value}`);
  }

  if (err && err.code === 11000) {
    const fields = Object.keys(err.keyValue || {});
    return ApiError.conflict(`Duplicate value for: ${fields.join(', ')}`, err.keyValue);
  }

  if (err && (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError')) {
    return ApiError.unauthorized('Invalid or expired token');
  }

  return new ApiError(err.statusCode || 500, err.message || 'Internal Server Error', null, false);
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  const apiError = normalizeError(err);

  if (apiError.statusCode >= 500) {
    logger.error(`${req.method} ${req.originalUrl} - ${apiError.message}`, {
      stack: err.stack,
      details: apiError.details,
    });
  } else {
    logger.warn(`${req.method} ${req.originalUrl} - ${apiError.statusCode} ${apiError.message}`);
  }

  const body = {
    success: false,
    message: apiError.message,
  };
  if (apiError.details) body.details = apiError.details;
  if (!env.isProd && err.stack) body.stack = err.stack;

  res.status(apiError.statusCode).json(body);
}

module.exports = errorHandler;
