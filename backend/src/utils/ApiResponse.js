'use strict';

class ApiResponse {
  static success(res, { statusCode = 200, message = 'Success', data = null, meta = null } = {}) {
    const body = { success: true, message };
    if (data !== null && data !== undefined) body.data = data;
    if (meta) body.meta = meta;
    return res.status(statusCode).json(body);
  }

  static created(res, data, message = 'Resource created') {
    return ApiResponse.success(res, { statusCode: 201, message, data });
  }

  static noContent(res) {
    return res.status(204).send();
  }
}

module.exports = ApiResponse;
