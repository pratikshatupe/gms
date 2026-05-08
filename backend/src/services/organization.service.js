'use strict';

const Organization = require('../models/Organization');
const User = require('../models/User');
const Office = require('../models/Office');
const ApiError = require('../utils/ApiError');
const { hashPassword, generateRandomPassword } = require('../utils/password');
const { getPagination, buildSort, paginate } = require('../utils/pagination');
const { buildSearchRegex } = require('../utils/helpers');
const { ROLES } = require('../config/constants');
const couponService = require('./coupon.service');
const subscriptionService = require('./subscription.service');
const env = require('../config/env');
const logger = require('../config/logger');
const notificationService = require('./notification.service');
const emailTemplates = require('../templates/email.templates');

/**
 * Send a WELCOME email after a new organisation / director / user is
 * provisioned. Wrapped in try/catch and resolves on its own — SMTP
 * failures must NEVER block account creation. The actual outbound
 * delivery flows through the existing nodemailer-backed
 * notification.service.sendEmail, which falls back to a JSON-stream
 * transport when SMTP creds are missing (so the envelope still appears
 * in the boot log even in dev).
 */
async function sendWelcomeEmailSafe({ to, name, orgName, role, tempPassword }) {
  if (!to) return;
  try {
    const tpl = emailTemplates.WELCOME({
      name,
      email: to,
      orgName,
      role,
      tempPassword,
      platformName: env.smtp.fromName || 'CorpGMS',
      loginUrl: env.clientUrl ? `${env.clientUrl}/login` : null,
    });
    await notificationService.sendEmail({
      to,
      subject: tpl.subject,
      html:    tpl.html,
      text:    tpl.text,
    });
    logger.info(`[welcome-email] queued for ${to}`);
  } catch (err) {
    logger.error('[welcome-email] failed: ' + (err?.message || err));
  }
}

/**
 * Resolve a coupon snapshot to embed on the organisation record.
 * - If no coupon code supplied → returns nulls.
 * - If supplied → re-validates server-side against the plan catalogue.
 * - On failure → throws so the org-create transaction aborts and the user
 *   gets a clear error rather than an org saved with a fake discount.
 */
async function resolveCouponSnapshot({ couponCode, plan, organizationSize }) {
  if (!couponCode) return { couponCode: null, appliedDiscount: null };
  const result = await couponService.applyCoupon({
    couponCode,
    selectedPlan: plan,
    organizationSize,
  });
  return {
    couponCode: result.coupon.code,
    appliedDiscount: {
      discountType:   result.coupon.discountType,
      discountValue:  result.coupon.discountValue,
      discountAmount: result.coupon.discountAmount,
      planPrice:      result.coupon.planPrice,
      finalAmount:    result.coupon.finalAmount,
      appliedAt:      new Date(),
    },
  };
}

/**
 * After the Organization document is saved, create the matching
 * Subscription row. Failure to create the subscription must NOT prevent
 * the org from being usable — log and continue, the SA dashboard can
 * reconcile missing subs later.
 */
async function provisionSubscription(orgId, payload, actor) {
  try {
    return await subscriptionService.createForOrganization(orgId, {
      planId:        payload.planId,
      planName:      payload.plan,
      planCode:      payload.planCode,
      billingCycle:  payload.billingCycle,
      currency:      payload.currency,
      paymentMethod: payload.paymentMethod || null,
      transactionId: payload.transactionId,
      upiId:         payload.upiId,
      cardNumber:    payload.cardNumber,
      bankName:      payload.bankName,
    }, actor);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Subscription provisioning failed for org', orgId, err.message);
    return null;
  }
}

async function createOrganization(payload, actor) {
  const exists = await Organization.findOne({ slug: payload.slug });
  if (exists) throw ApiError.conflict('Organization slug already in use');

  const couponSnap = await resolveCouponSnapshot({
    couponCode: payload.couponCode,
    plan: payload.plan,
    organizationSize: payload.organizationSize,
  });

  const org = await Organization.create({
    ...payload,
    ...couponSnap,
    createdBy: actor ? actor._id : undefined,
  });

  if (couponSnap.couponCode) {
    await couponService.recordCouponUsage(couponSnap.couponCode);
  }

  const subscription = await provisionSubscription(org._id, payload, actor);

  /* Welcome email — fired after the org is fully provisioned. Address
   * comes from the contactEmail field on the org record (no director
   * was created in this branch). Non-blocking on SMTP failure. */
  if (org.contactEmail) {
    sendWelcomeEmailSafe({
      to: org.contactEmail,
      name: org.legalName || org.name || '',
      orgName: org.name,
    });
  }

  return { ...org.toObject(), subscription };
}

async function createOrganizationWithDirector(payload, actor) {
  const { director, ...orgPayload } = payload;
  if (!director || !director.email) {
    throw ApiError.badRequest('Director account details are required');
  }

  const existsOrg = await Organization.findOne({ slug: orgPayload.slug });
  if (existsOrg) throw ApiError.conflict('Organization slug already in use');

  const couponSnap = await resolveCouponSnapshot({
    couponCode: orgPayload.couponCode,
    plan: orgPayload.plan,
    organizationSize: orgPayload.organizationSize,
  });

  const org = await Organization.create({
    ...orgPayload,
    ...couponSnap,
    createdBy: actor ? actor._id : undefined,
  });

  const tempPassword = director.password || generateRandomPassword(12);

  const user = await User.create({
    organizationId: org._id,
    name: director.name,
    email: director.email.toLowerCase(),
    phone: director.phone,
    role: ROLES.DIRECTOR,
    password: await hashPassword(tempPassword),
    isActive: true,
    createdBy: actor ? actor._id : undefined,
  });

  if (couponSnap.couponCode) {
    await couponService.recordCouponUsage(couponSnap.couponCode);
  }

  const subscription = await provisionSubscription(org._id, orgPayload, actor);

  /* Welcome email to the new director. Non-blocking on SMTP failure. */
  sendWelcomeEmailSafe({
    to: user.email,
    name: user.name,
    orgName: org.name,
    role: ROLES.DIRECTOR,
    tempPassword: director.password ? null : tempPassword,
  });

  return { organization: org, director: user, tempPassword, subscription };
}

async function listOrganizations(query) {
  const { page, limit, skip } = getPagination(query);
  const sort = buildSort(query, ['name', 'createdAt', 'plan']);

  const filter = {};
  if (query.search) {
    const regex = buildSearchRegex(query.search);
    filter.$or = [{ name: regex }, { slug: regex }, { legalName: regex }];
  }
  if (typeof query.isActive === 'boolean') filter.isActive = query.isActive;

  const [items, total] = await Promise.all([
    Organization.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    Organization.countDocuments(filter),
  ]);

  return { items, meta: paginate(total, page, limit) };
}

async function getOrganizationById(id) {
  const org = await Organization.findById(id);
  if (!org) throw ApiError.notFound('Organization not found');
  return org;
}

async function updateOrganization(id, payload) {
  const org = await Organization.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true,
  });
  if (!org) throw ApiError.notFound('Organization not found');
  return org;
}

async function deactivateOrganization(id) {
  const org = await Organization.findByIdAndUpdate(
    id,
    { isActive: false, subscriptionStatus: 'CANCELLED' },
    { new: true }
  );
  if (!org) throw ApiError.notFound('Organization not found');
  return org;
}

async function getStats(organizationId) {
  const [users, offices] = await Promise.all([
    User.countDocuments({ organizationId, isActive: true }),
    Office.countDocuments({ organizationId, isActive: true }),
  ]);
  return { users, offices };
}

module.exports = {
  createOrganization,
  createOrganizationWithDirector,
  listOrganizations,
  getOrganizationById,
  updateOrganization,
  deactivateOrganization,
  getStats,
};
