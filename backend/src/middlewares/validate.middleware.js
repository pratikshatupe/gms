'use strict';

const ApiError = require('../utils/ApiError');

const SOURCES = ['body', 'query', 'params'];

function validate(schemas = {}) {
  return (req, _res, next) => {
    const errors = [];

    for (const source of SOURCES) {
      if (!schemas[source]) continue;
      const { value, error } = schemas[source].validate(req[source], {
        abortEarly: false,
        stripUnknown: true,
        convert: true,
      });
      if (error) {
        error.details.forEach((d) => {
          errors.push({
            source,
            field: d.path.join('.'),
            message: d.message.replace(/['"]/g, ''),
          });
        });
      } else {
        req[source] = value;
      }
    }

    if (errors.length) {
      return next(ApiError.unprocessable('Validation failed', errors));
    }
    return next();
  };
}

module.exports = validate;
