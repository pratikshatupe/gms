'use strict';

class ApiError extends Error {
  constructor(statusCode, message, details = null, isOperational = true) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Bad Request', details) {
    return new ApiError(400, message, details);
  }
  static unauthorized(message = 'Unauthorized', details) {
    return new ApiError(401, message, details);
  }
  static forbidden(message = 'Forbidden', details) {
    return new ApiError(403, message, details);
  }
  static notFound(message = 'Resource not found', details) {
    return new ApiError(404, message, details);
  }
  static conflict(message = 'Conflict', details) {
    return new ApiError(409, message, details);
  }
  static unprocessable(message = 'Unprocessable Entity', details) {
    return new ApiError(422, message, details);
  }
  static internal(message = 'Internal Server Error', details) {
    return new ApiError(500, message, details, false);
  }
}

module.exports = ApiError;
