'use strict';

const mongoose = require('mongoose');

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === String(id);
}

function toObjectId(id) {
  return new mongoose.Types.ObjectId(id);
}

function pick(obj, keys) {
  return keys.reduce((acc, key) => {
    if (obj && Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== undefined) {
      acc[key] = obj[key];
    }
    return acc;
  }, {});
}

function omit(obj, keys) {
  if (!obj) return obj;
  const set = new Set(keys);
  return Object.keys(obj).reduce((acc, key) => {
    if (!set.has(key)) acc[key] = obj[key];
    return acc;
  }, {});
}

function escapeRegex(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildSearchRegex(value) {
  return new RegExp(escapeRegex(value), 'i');
}

function dateOrNull(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function generateBadgeNumber(prefix = 'V') {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
    now.getDate()
  ).padStart(2, '0')}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${date}-${rand}`;
}

module.exports = {
  isValidObjectId,
  toObjectId,
  pick,
  omit,
  escapeRegex,
  buildSearchRegex,
  dateOrNull,
  startOfDay,
  endOfDay,
  generateBadgeNumber,
};
