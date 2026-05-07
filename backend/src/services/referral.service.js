'use strict';

const Referral      = require('../models/Referral');
const ReferralUsage = require('../models/ReferralUsage');
const User          = require('../models/User');
const ApiError      = require('../utils/ApiError');

function generateCode(name = '') {
  const prefix = name.replace(/[^A-Z0-9]/gi, '').substring(0, 4).toUpperCase() || 'REF';
  const rand   = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `${prefix}${rand}`;
}

async function ensureReferralCode(userId, userName) {
  const existing = await Referral.findOne({ referrerId: userId });
  if (existing) return existing;

  let code;
  let attempts = 0;
  do {
    code = generateCode(userName);
    attempts++;
  } while ((await Referral.exists({ referralCode: code })) && attempts < 10);

  const referral = await Referral.create({ referrerId: userId, referralCode: code });

  await User.findByIdAndUpdate(userId, { referralCode: code });

  return referral;
}

async function getReferralInfo(userId) {
  const referral = await Referral.findOne({ referrerId: userId }).lean();
  if (!referral) return null;

  const usages = await ReferralUsage.find({ referrerId: userId })
    .populate('referredUserId', 'name email createdAt')
    .sort({ createdAt: -1 })
    .lean();

  return { ...referral, usages };
}

async function recordReferralSignup(referralCode, referredUserId, referredOrgId) {
  if (!referralCode) return null;

  const referral = await Referral.findOne({
    referralCode: referralCode.toUpperCase().trim(),
    isActive: true,
  });
  if (!referral) return null;

  if (String(referral.referrerId) === String(referredUserId)) return null;

  const exists = await ReferralUsage.findOne({ referralId: referral._id, referredUserId });
  if (exists) return null;

  const usage = await ReferralUsage.create({
    referralId:     referral._id,
    referrerId:     referral.referrerId,
    referredUserId,
    referredOrgId:  referredOrgId || null,
  });

  await Referral.findByIdAndUpdate(referral._id, { $inc: { totalSignups: 1 } });
  await User.findByIdAndUpdate(referredUserId, {
    referredByCode:   referralCode.toUpperCase().trim(),
    referredByUserId: referral.referrerId,
  });

  return usage;
}

async function convertReferral(referredUserId) {
  const usage = await ReferralUsage.findOne({
    referredUserId,
    convertedAt: null,
    rewardStatus: 'PENDING',
  }).populate('referralId');

  if (!usage) return null;

  const referral = usage.referralId;

  let rewardAmount = referral.rewardValue;
  if (referral.rewardType === 'PERCENTAGE') {
    rewardAmount = Math.round((referral.rewardValue / 100) * 1000);
  }

  usage.convertedAt  = new Date();
  usage.rewardStatus = 'EARNED';
  usage.rewardAmount = rewardAmount;
  await usage.save();

  await User.findByIdAndUpdate(referral.referrerId, {
    $inc: { referralRewardBalance: rewardAmount },
  });

  await Referral.findByIdAndUpdate(referral._id, {
    $inc: { totalConverted: 1, totalRewardEarned: rewardAmount },
  });

  return usage;
}

async function listAllReferrals(query) {
  const page  = Math.max(1, parseInt(query.page, 10)  || 1);
  const limit = Math.min(100, parseInt(query.limit, 10) || 20);
  const skip  = (page - 1) * limit;

  const [items, total] = await Promise.all([
    Referral.find({})
      .populate('referrerId', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Referral.countDocuments(),
  ]);

  return { items, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
}

module.exports = {
  ensureReferralCode,
  getReferralInfo,
  recordReferralSignup,
  convertReferral,
  listAllReferrals,
};
