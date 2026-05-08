'use strict';

const express = require('express');
const validate = require('../middlewares/validate.middleware');
const { authenticate } = require('../middlewares/auth.middleware');
const { authLimiter } = require('../middlewares/rateLimit.middleware');
const v = require('../validators/auth.validator');
const ctrl = require('../controllers/auth.controller');

const router = express.Router();

router.post('/login', authLimiter, validate(v.login), ctrl.login);
router.post('/refresh', authLimiter, validate(v.refresh), ctrl.refresh);
router.post('/logout', authenticate, ctrl.logout);
router.post('/change-password', authenticate, validate(v.changePassword), ctrl.changePassword);
router.get('/me', authenticate, ctrl.profile);

/* Forgot-password OTP flow — public, rate-limited like login. */
router.post('/forgot-password', authLimiter, validate(v.forgotPassword), ctrl.forgotPassword);
router.post('/verify-otp',      authLimiter, validate(v.verifyOtp),      ctrl.verifyOtp);
router.post('/reset-password',  authLimiter, validate(v.resetPassword),  ctrl.resetPassword);

module.exports = router;
