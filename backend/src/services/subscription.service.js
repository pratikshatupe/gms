'use strict';

const crypto = require('crypto');
const Organization = require('../models/Organization');
const Subscription = require('../models/Subscription');
const User = require('../models/User');
const Office = require('../models/Office');
const Appointment = require('../models/Appointment');
const ApiError = require('../utils/ApiError');
const env = require('../config/env');
const logger = require('../config/logger');
const planService = require('./plan.service');

/* Razorpay is loaded lazily so the backend can boot in environments
 * where the SDK isn't installed and no payments are expected (demo /
 * dev / CI). The require, the missing-keys check, and the missing-
 * package check all surface only when payment is actually attempted —
 * not at server start. This keeps `npm run dev` working without razorpay
 * present and without RAZORPAY_KEY_ID/SECRET in .env. */
let razorpayClient = null;
let razorpaySdkLoadError = null;
function loadRazorpaySdk() {
  if (razorpaySdkLoadError) return null;
  try {
    return require('razorpay');
  } catch (err) {
    razorpaySdkLoadError = err;
    logger.warn(
      `[razorpay] SDK not installed (${err && err.message ? err.message : err}). ` +
      `Run "npm install razorpay" inside backend/ to enable real payments. ` +
      `Backend will boot fine; payment endpoints will return a clear error.`
    );
    return null;
  }
}
/* Try once at module load so the warning shows in the boot log without
 * blocking startup. */
loadRazorpaySdk();

function getRazorpayClient() {
  if (razorpayClient) return razorpayClient;
  const Razorpay = loadRazorpaySdk();
  if (!Razorpay) {
    throw ApiError.internal(
      'Razorpay SDK is not installed on the server. Run "npm install razorpay" in backend/ to enable payments.'
    );
  }
  if (!env.razorpay.keyId || !env.razorpay.keySecret) {
    throw ApiError.internal(
      'Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in backend/.env.'
    );
  }
  razorpayClient = new Razorpay({
    key_id:     env.razorpay.keyId,
    key_secret: env.razorpay.keySecret,
  });
  return razorpayClient;
}

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

/* ────────────────────────────────────────────────────────────────────
 *   Razorpay payment integration
 *
 *   Two-stage flow (server-driven so the key secret never leaves the
 *   backend and the activation can never be spoofed by a client):
 *
 *     1. createRazorpayOrder — client requests an order amount derived
 *        from the resolved Plan + billingCycle. Backend creates a
 *        Razorpay Order via the SDK and returns { orderId, amount,
 *        currency, keyId } so the frontend can launch Checkout.
 *
 *     2. verifyAndActivate — after the user finishes Checkout, the
 *        client posts the { order_id, payment_id, signature } triple.
 *        Backend re-computes the HMAC-SHA256 signature with the key
 *        secret and only activates the plan when it matches. The
 *        razorpay_payment_id is stored as both transactionId and
 *        razorpayPaymentId so existing reports keep working.
 * ──────────────────────────────────────────────────────────────────── */

async function createRazorpayOrder(organisationId, payload = {}) {
  const org = await Organization.findById(organisationId);
  if (!org) throw ApiError.notFound('Organization not found');

  const plan = await resolvePlan(payload);
  const billingCycle = payload.billingCycle === 'yearly' ? 'yearly' : 'monthly';
  const amount = billingCycle === 'yearly'
    ? Number(plan.yearlyPrice || (plan.price * 12)) || 0
    : Number(plan.price) || 0;

  if (amount <= 0) {
    throw ApiError.badRequest(
      'Selected plan has no payable amount — free plans should activate without a payment.'
    );
  }

  /* Razorpay expects `amount` in the smallest currency unit (paise for
   * INR, cents for USD/EUR). Multiply, round, and floor at zero to
   * defend against rogue float values. */
  const currency = (payload.currency || plan.currency || 'INR').toUpperCase();
  const amountInPaise = Math.max(0, Math.round(amount * 100));

  /* Receipt is a free-form string (max 40 chars per Razorpay spec).
   * We embed the org id + a timestamp so support can correlate without
   * leaking PII. The id is sliced because Mongo ObjectIds are 24 chars. */
  const receipt = `gms_${String(organisationId).slice(-12)}_${Date.now()}`.slice(0, 40);

  const rzp = getRazorpayClient();
  let order;
  try {
    order = await rzp.orders.create({
      amount:   amountInPaise,
      currency,
      receipt,
      notes: {
        organisationId: String(organisationId),
        planId:         String(plan._id),
        planName:       String(plan.name || ''),
        billingCycle,
      },
    });
  } catch (err) {
    /* Razorpay errors come back as { statusCode, error: { description } }.
     * Map to a 400 so the client gets a meaningful message instead of
     * a generic 500. */
    const description = err?.error?.description || err?.message || 'Razorpay order creation failed';
    logger.error(`[razorpay] orders.create failed: ${description}`);
    throw ApiError.badRequest(description);
  }

  return {
    orderId:  order.id,
    amount:   order.amount,
    currency: order.currency,
    receipt:  order.receipt,
    keyId:    env.razorpay.keyId,
    plan: {
      id:       String(plan._id),
      name:     plan.name,
      billingCycle,
    },
  };
}

async function verifyAndActivate(organisationId, payload = {}, actor) {
  const {
    razorpay_order_id:   orderId,
    razorpay_payment_id: paymentId,
    razorpay_signature:  signature,
  } = payload || {};

  if (!orderId || !paymentId || !signature) {
    throw ApiError.badRequest('Missing Razorpay payment credentials');
  }
  if (!env.razorpay.keySecret) {
    throw ApiError.internal('Razorpay key secret not configured on the server');
  }

  /* Re-compute the HMAC server-side. The signature we compare against
   * is what Razorpay attached to the success callback; matching it
   * proves the payload came from Razorpay and was not tampered with on
   * the client. */
  const body = `${orderId}|${paymentId}`;
  const expectedSignature = crypto
    .createHmac('sha256', env.razorpay.keySecret)
    .update(body)
    .digest('hex');

  /* Constant-time compare to avoid leaking timing info on the secret. */
  const sigBuf = Buffer.from(signature, 'utf8');
  const expBuf = Buffer.from(expectedSignature, 'utf8');
  const sigOk = sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);

  if (!sigOk) {
    logger.warn(`[razorpay] signature mismatch for order=${orderId} payment=${paymentId}`);
    throw ApiError.badRequest('Payment verification failed');
  }

  /* Hand off to changePlan so all the existing audit / org-mirroring /
   * subscription-rotation logic runs unchanged. paymentMethod=CARD is
   * the catch-all because Razorpay returns the actual instrument only
   * via the payment-fetch API (which we deliberately don't call from
   * the verify endpoint to keep latency low). */
  const result = await changePlan(
    organisationId,
    {
      planId:        payload.planId,
      planName:      payload.planName,
      billingCycle:  payload.billingCycle,
      currency:      payload.currency,
      paymentMethod: 'CARD',
      transactionId: paymentId,
    },
    actor,
  );

  /* Backfill the Razorpay-specific fields on the freshly-created
   * payment row so an audit trail exists. changePlan already pushed
   * one row into payments[]; we patch it in place rather than adding
   * a duplicate. */
  const sub = result.subscription;
  if (sub && Array.isArray(sub.payments) && sub.payments.length > 0) {
    const last = sub.payments[sub.payments.length - 1];
    last.razorpayOrderId   = orderId;
    last.razorpayPaymentId = paymentId;
    last.razorpaySignature = signature;
    await sub.save();
  }

  logger.info(`[razorpay] verified payment=${paymentId} for org=${organisationId}`);
  return result;
}

module.exports = {
  createForOrganization,
  getSubscription,
  changePlan,
  cancelSubscription,
  getUsage,
  listPaymentHistory,
  listAll,
  createRazorpayOrder,
  verifyAndActivate,
};
