'use strict';

const Organization = require('../models/Organization');
const Subscription = require('../models/Subscription');
const User = require('../models/User');
const Office = require('../models/Office');
const Appointment = require('../models/Appointment');
const ApiError = require('../utils/ApiError');
const planService = require('./plan.service');

const DAY_MS = 24 * 60 * 60 * 1000;

function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function periodEnd(start, billingCycle) {
  const months = billingCycle === 'yearly' ? 12 : 1;
  return addMonths(start, months);
}

function genTxnId() {
  return `TXN-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function methodDetailsFor(paymentMethod, payload) {
  if (paymentMethod === 'UPI')        return { upiId: payload.upiId || null };
  if (paymentMethod === 'CARD')       return { cardLast4: payload.cardNumber ? String(payload.cardNumber).slice(-4) : null };
  if (paymentMethod === 'NETBANKING') return { bankName: payload.bankName || null };
  return {};
}

/**
 * Resolve the plan being subscribed to. Accepts either a Mongo _id, a
 * plan name (e.g. "Professional") or a code. Used by both Create Org
 * and Change Plan flows so the frontend can pass whichever it has.
 */
async function resolvePlan({ planId, planName, planCode }) {
  let plan = null;
  if (planId) {
    try { plan = await planService.getPlanById(planId); } catch { plan = null; }
  }
  if (!plan && (planName || planCode)) {
    plan = await planService.getPlanByName(planName || planCode);
  }
  if (!plan) {
    const list = await planService.listPlans();
    plan = list.find((p) => p.name === planName) || list[0];
  }
  if (!plan) throw ApiError.badRequest('Selected plan is invalid');
  return plan;
}

/**
 * Create the initial subscription record for a freshly-provisioned org.
 * Called from organization.service.createOrganization{,WithDirector}.
 * When a paymentMethod is provided, an initial payment row is inserted
 * so the Subscription page renders the receipt immediately.
 */
async function createForOrganization(organisationId, payload = {}, actor) {
  const plan = await resolvePlan(payload);
  const billingCycle = payload.billingCycle === 'yearly' ? 'yearly' : 'monthly';
  const start = new Date();
  const end = periodEnd(start, billingCycle);
  const amount = billingCycle === 'yearly'
    ? Number(plan.yearlyPrice || (plan.price * 12)) || 0
    : Number(plan.price) || 0;

  const sub = await Subscription.create({
    organisationId,
    planId: plan._id,
    planName: plan.name,
    amount,
    currency: payload.currency || plan.currency || 'INR',
    billingCycle,
    status: amount === 0 ? 'trial' : 'active',
    startDate: start,
    endDate: end,
    autoRenew: true,
    paymentMethod: payload.paymentMethod || null,
    payments: payload.paymentMethod && amount > 0
      ? [{
          transactionId: payload.transactionId || genTxnId(),
          amount,
          currency:      payload.currency || plan.currency || 'INR',
          paymentMethod: payload.paymentMethod,
          methodDetails: methodDetailsFor(payload.paymentMethod, payload),
          status:        'SUCCESS',
          paidAt:        new Date(),
        }]
      : [],
    createdBy: actor ? actor._id : undefined,
  });

  /* Mirror summary fields onto the Organization record so the SuperAdmin
     org-list table doesn't need to join. */
  await Organization.findByIdAndUpdate(organisationId, {
    plan: plan.name,
    billingCycle,
    subscriptionStatus: amount === 0 ? 'TRIAL' : 'ACTIVE',
    subscriptionStartedAt: start,
    endDate: end,
    mrr: billingCycle === 'yearly' ? Math.round(amount / 12) : amount,
  }).catch(() => { /* org may not exist in some seeds — non-fatal */ });

  return sub;
}

async function getActiveByOrg(organisationId) {
  return Subscription.findOne({
    organisationId,
    status: { $in: ['active', 'trial', 'past_due'] },
  }).sort({ createdAt: -1 });
}

async function getSubscription(organisationId) {
  const sub = await getActiveByOrg(organisationId);
  if (sub) return sub;

  /* Back-compat: legacy orgs without a Subscription row. Synthesise one
     from the Organization record so the UI still has something to show. */
  const org = await Organization.findById(organisationId).lean();
  if (!org) throw ApiError.notFound('Organization not found');
  return {
    organisationId,
    planName:      org.plan || 'Starter',
    amount:        Number(org.mrr) || 0,
    currency:      org.currency || 'INR',
    billingCycle:  org.billingCycle || 'monthly',
    status:        (org.subscriptionStatus || 'active').toLowerCase(),
    startDate:     org.subscriptionStartedAt,
    endDate:       org.endDate,
    autoRenew:     org.autoRenew !== false,
    payments:      [],
  };
}

async function listPaymentHistory(organisationId) {
  const subs = await Subscription.find({ organisationId })
    .select('planName amount currency billingCycle status startDate endDate payments createdAt')
    .sort({ createdAt: -1 });
  const out = [];
  for (const s of subs) {
    for (const p of s.payments || []) {
      out.push({
        subscriptionId: s._id,
        planName:       s.planName,
        billingCycle:   s.billingCycle,
        ...p.toObject(),
      });
    }
  }
  return out.sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt));
}

async function changePlan(organisationId, payload = {}, actor) {
  const org = await Organization.findById(organisationId);
  if (!org) throw ApiError.notFound('Organization not found');

  const plan = await resolvePlan(payload);
  const billingCycle = payload.billingCycle === 'yearly' ? 'yearly' : (org.billingCycle || 'monthly');
  const amount = billingCycle === 'yearly'
    ? Number(plan.yearlyPrice || (plan.price * 12)) || 0
    : Number(plan.price) || 0;

  /* Close the existing active subscription. */
  const current = await getActiveByOrg(organisationId);
  if (current) {
    current.status = 'cancelled';
    current.cancelledAt = new Date();
    await current.save();
  }

  const start = new Date();
  const end = periodEnd(start, billingCycle);

  const next = await Subscription.create({
    organisationId,
    planId: plan._id,
    planName: plan.name,
    amount,
    currency: payload.currency || plan.currency || 'INR',
    billingCycle,
    status: amount === 0 ? 'trial' : 'active',
    startDate: start,
    endDate: end,
    paymentMethod: payload.paymentMethod || null,
    payments: payload.paymentMethod && amount > 0 ? [{
      transactionId: payload.transactionId || genTxnId(),
      amount,
      currency:      payload.currency || plan.currency || 'INR',
      paymentMethod: payload.paymentMethod,
      methodDetails: methodDetailsFor(payload.paymentMethod, payload),
      status:        'SUCCESS',
      paidAt:        new Date(),
    }] : [],
    createdBy: actor ? actor._id : undefined,
  });

  org.plan = plan.name;
  org.billingCycle = billingCycle;
  org.subscriptionStatus = amount === 0 ? 'TRIAL' : 'ACTIVE';
  org.subscriptionStartedAt = org.subscriptionStartedAt || start;
  org.endDate = end;
  org.mrr = billingCycle === 'yearly' ? Math.round(amount / 12) : amount;
  await org.save();

  return { subscription: next, organization: org };
}

async function cancelSubscription(organisationId, { reason, immediate } = {}) {
  const sub = await getActiveByOrg(organisationId);
  if (!sub) throw ApiError.notFound('No active subscription');
  if (immediate) {
    sub.status = 'cancelled';
    sub.cancelledAt = new Date();
  } else {
    sub.autoRenew = false;
  }
  await sub.save();

  await Organization.findByIdAndUpdate(organisationId, {
    autoRenew: false,
    cancellationReason: reason,
    cancelledAt: new Date(),
    ...(immediate ? { subscriptionStatus: 'CANCELLED' } : {}),
  });

  return sub;
}

async function getUsage(organisationId) {
  const [staffCount, officeCount, appointmentCount] = await Promise.all([
    User.countDocuments({ organizationId: organisationId, isActive: true }),
    Office.countDocuments({ organizationId: organisationId, isActive: true }),
    Appointment.countDocuments({ organizationId: organisationId }),
  ]);
  return { staff: staffCount, offices: officeCount, appointments: appointmentCount };
}

/**
 * Super-Admin: list every subscription (with optional plan/status
 * filters) for the platform-wide subscriptions console.
 */
async function listAll({ plan, status, organisationId } = {}) {
  const filter = {};
  if (plan) filter.planName = plan;
  if (status) filter.status = status;
  if (organisationId) filter.organisationId = organisationId;
  return Subscription.find(filter)
    .populate('organisationId', 'name slug country plan currency')
    .sort({ createdAt: -1 })
    .lean();
}

module.exports = {
  createForOrganization,
  getSubscription,
  changePlan,
  cancelSubscription,
  getUsage,
  listPaymentHistory,
  listAll,
};
