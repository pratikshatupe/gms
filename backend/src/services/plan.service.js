'use strict';

const Plan = require('../models/Plan');
const ApiError = require('../utils/ApiError');

/**
 * Default catalogue used when the database has no Plan rows yet — keeps
 * the public GET /plans endpoint useful for the Create Organisation
 * modal even on a clean install. The seed runs at most once per process.
 */
const DEFAULT_PLANS = [
  {
    name: 'Starter',
    code: 'STARTER',
    description: 'Perfect for small offices getting started with visitor management.',
    price: 0,
    yearlyPrice: 0,
    features: [
      'Guest Log',
      'Walk-in Check-in',
      'Basic Appointments',
      'Email Notifications',
      'Basic Reports',
    ],
    maxGuests: 50,
    maxStaff: 5,
    maxOffices: 1,
    maxStorageGb: 1,
    maxApiCallsDay: 100,
    badgeColour: '#64748B',
    sortOrder: 1,
    trialDays: 7,
  },
  {
    name: 'Professional',
    code: 'PRO',
    description: 'For growing companies that need advanced features and multi-office control.',
    price: 2999,
    yearlyPrice: 28799,
    features: [
      'Guest Management',
      'Appointments Scheduling',
      'Staff Management',
      'Multi-Office Support',
      'WhatsApp Notifications',
      'Advanced Reports',
      'Custom Branding',
      'Room Bookings',
    ],
    maxGuests: 5000,
    maxStaff: 25,
    maxOffices: 5,
    maxStorageGb: 50,
    maxApiCallsDay: 5000,
    badgeColour: '#0284C7',
    mostPopular: true,
    sortOrder: 2,
    trialDays: 14,
  },
  {
    name: 'Enterprise',
    code: 'ENT',
    description: 'Unlimited everything for large enterprises with multiple sites.',
    price: 9999,
    yearlyPrice: 95988,
    features: [
      'Unlimited Guests',
      'Unlimited Staff',
      'Unlimited Offices',
      'Single Sign-On (SSO)',
      'Dedicated Account Manager',
      'Priority Support',
      'Custom Integrations',
      'White-label',
      'API Access & Webhooks',
      'SLA Guarantee',
    ],
    maxGuests: 0,
    maxStaff: 0,
    maxOffices: 0,
    maxStorageGb: 500,
    maxApiCallsDay: 100000,
    badgeColour: '#7C3AED',
    sortOrder: 3,
    trialDays: 14,
  },
];

let seeded = false;

async function ensureSeed() {
  if (seeded) return;
  const count = await Plan.estimatedDocumentCount();
  if (count === 0) {
    await Plan.insertMany(DEFAULT_PLANS);
  }
  seeded = true;
}

async function listPlans({ includeHidden = false } = {}) {
  await ensureSeed();
  const filter = { status: 'Active' };
  if (!includeHidden) filter.visibility = 'Public';
  return Plan.find(filter).sort({ sortOrder: 1, price: 1 }).lean();
}

async function getPlanById(id) {
  const plan = await Plan.findById(id).lean();
  if (!plan) throw ApiError.notFound('Plan not found');
  return plan;
}

async function getPlanByName(name) {
  if (!name) return null;
  return Plan.findOne({ name: new RegExp(`^${name}$`, 'i') }).lean();
}

async function createPlan(payload, actor) {
  const exists = await Plan.findOne({ name: payload.name });
  if (exists) throw ApiError.conflict('Plan with that name already exists');
  return Plan.create({ ...payload, createdBy: actor ? actor._id : undefined });
}

async function updatePlan(id, payload) {
  const plan = await Plan.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
  if (!plan) throw ApiError.notFound('Plan not found');
  return plan;
}

async function archivePlan(id) {
  const plan = await Plan.findByIdAndUpdate(id, { status: 'Archived' }, { new: true });
  if (!plan) throw ApiError.notFound('Plan not found');
  return plan;
}

module.exports = {
  listPlans,
  getPlanById,
  getPlanByName,
  createPlan,
  updatePlan,
  archivePlan,
  DEFAULT_PLANS,
};
