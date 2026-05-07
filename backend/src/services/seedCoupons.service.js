'use strict';

const Coupon = require('../models/Coupon');
const logger = require('../config/logger');

const SEED_COUPONS = [
  {
    code: 'WELCOME20',
    description: '20% off any plan — first organisation only',
    discountType: 'PERCENTAGE',
    discountValue: 20,
    allowedPlans: [],
    allowedOrganizationSizes: [],
    maxUses: 500,
    isActive: true,
  },
  {
    code: 'STARTFREE',
    description: 'Free Starter plan for the first month',
    discountType: 'FREE_PLAN',
    discountValue: 100,
    allowedPlans: ['Starter', 'starter'],
    allowedOrganizationSizes: [],
    maxUses: 100,
    isActive: true,
  },
  {
    code: 'FLAT500',
    description: '₹500 flat off any paid plan',
    discountType: 'FLAT',
    discountValue: 500,
    allowedPlans: [],
    allowedOrganizationSizes: [],
    maxUses: null,
    isActive: true,
  },
];

async function seedCoupons() {
  for (const seed of SEED_COUPONS) {
    const exists = await Coupon.findOne({ code: seed.code });
    if (exists) continue;
    await Coupon.create(seed);
    logger.info(`Seeded coupon: ${seed.code}`);
  }
}

module.exports = { seedCoupons, SEED_COUPONS };
