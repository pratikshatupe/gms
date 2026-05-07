'use strict';

const asyncHandler    = require('../utils/asyncHandler');
const ApiResponse     = require('../utils/ApiResponse');
const referralService = require('../services/referral.service');

const getMyReferral = asyncHandler(async (req, res) => {
  let data = await referralService.getReferralInfo(req.user._id);
  if (!data) {
    await referralService.ensureReferralCode(req.user._id, req.user.name);
    data = await referralService.getReferralInfo(req.user._id);
  }
  return ApiResponse.success(res, { data });
});

const listAll = asyncHandler(async (req, res) => {
  const { items, meta } = await referralService.listAllReferrals(req.query);
  return ApiResponse.success(res, { data: items, meta });
});

module.exports = { getMyReferral, listAll };
