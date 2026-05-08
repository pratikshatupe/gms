'use strict';

const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const subscriptionService = require('../services/subscription.service');

const get = asyncHandler(async (req, res) => {
  const data = await subscriptionService.getSubscription(req.tenant.organizationId);
  return ApiResponse.success(res, { data });
});

const changePlan = asyncHandler(async (req, res) => {
  const result = await subscriptionService.changePlan(
    req.tenant.organizationId,
    req.body,
    req.user
  );
  return ApiResponse.success(res, {
    message: 'Plan updated',
    data: result.subscription,
    organization: result.organization,
  });
});

const cancel = asyncHandler(async (req, res) => {
  const data = await subscriptionService.cancelSubscription(req.tenant.organizationId, req.body);
  return ApiResponse.success(res, { message: 'Subscription cancelled', data });
});

const usage = asyncHandler(async (req, res) => {
  const data = await subscriptionService.getUsage(req.tenant.organizationId);
  return ApiResponse.success(res, { data });
});

const paymentHistory = asyncHandler(async (req, res) => {
  const data = await subscriptionService.listPaymentHistory(req.tenant.organizationId);
  return ApiResponse.success(res, { data });
});

/**
 * Super-Admin Subscriptions overview — every org, optional plan/status
 * filters. Mounted under /subscriptions/admin/all.
 */
const listAll = asyncHandler(async (req, res) => {
  const data = await subscriptionService.listAll(req.query);
  return ApiResponse.success(res, { data });
});

/**
 * POST /subscriptions/create-order — request a Razorpay order for the
 * tenant's chosen plan + billing cycle. Returns { orderId, amount,
 * currency, keyId } for the frontend to launch Razorpay Checkout.
 */
const createOrder = asyncHandler(async (req, res) => {
  const data = await subscriptionService.createRazorpayOrder(
    req.tenant.organizationId,
    req.body,
  );
  return ApiResponse.success(res, {
    message: 'Razorpay order created',
    data,
  });
});

/**
 * POST /subscriptions/verify-payment — verify the HMAC signature
 * Razorpay returned to the client and, on success, rotate the
 * Subscription + Organization records to the new plan.
 */
const verifyPayment = asyncHandler(async (req, res) => {
  const result = await subscriptionService.verifyAndActivate(
    req.tenant.organizationId,
    req.body,
    req.user,
  );
  return ApiResponse.success(res, {
    message:      'Payment verified and plan activated',
    data:         result.subscription,
    organization: result.organization,
  });
});

module.exports = {
  get, changePlan, cancel, usage, paymentHistory, listAll,
  createOrder, verifyPayment,
};
