'use strict';

const rateLimit = require('express-rate-limit');
const env = require('../config/env');

const apiLimiter = rateLimit({
  windowMs: env.security.rateLimitWindowMs,
  max: env.security.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.',
  },
});

/**
 * Coupon-apply limiter — narrow per-IP cap on the public coupon validation
 * endpoint so a script can't brute-force-enumerate codes during signup.
 * 30 attempts per 10 minutes is generous for a real user retrying typos
 * but tight enough to make automated probing pointless.
 */
const couponApplyLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    valid: false,
    message: 'Too many coupon attempts, please try again in a few minutes.',
  },
});

module.exports = { apiLimiter, authLimiter, couponApplyLimiter };
