'use strict';

const { PAGINATION } = require('../config/constants');

function getPagination(query = {}) {
  const page = Math.max(parseInt(query.page, 10) || PAGINATION.DEFAULT_PAGE, 1);
  const limitRaw = parseInt(query.limit, 10) || PAGINATION.DEFAULT_LIMIT;
  const limit = Math.min(Math.max(limitRaw, 1), PAGINATION.MAX_LIMIT);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

function buildSort(query = {}, allowedFields = [], defaultSort = { createdAt: -1 }) {
  if (!query.sortBy) return defaultSort;

  const sort = {};
  String(query.sortBy)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((entry) => {
      const desc = entry.startsWith('-');
      const field = desc ? entry.substring(1) : entry;
      if (allowedFields.length === 0 || allowedFields.includes(field)) {
        sort[field] = desc ? -1 : 1;
      }
    });

  return Object.keys(sort).length ? sort : defaultSort;
}

function paginate(total, page, limit) {
  const totalPages = Math.max(Math.ceil(total / limit), 1);
  return {
    total,
    page,
    limit,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

module.exports = { getPagination, buildSort, paginate };
