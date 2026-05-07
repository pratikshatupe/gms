'use strict';

const Office = require('../models/Office');
const Organization = require('../models/Organization');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { getPagination, buildSort, paginate } = require('../utils/pagination');
const { buildSearchRegex } = require('../utils/helpers');
const { hashPassword, generateRandomPassword } = require('../utils/password');
const emailTemplates = require('../templates/email.templates');
const notificationService = require('./notification.service');
const env = require('../config/env');
const logger = require('../config/logger');
const { ROLES } = require('../config/constants');

async function createOffice(payload, organizationId, actor) {
  const exists = await Office.findOne({ organizationId, code: payload.code.toUpperCase() });
  if (exists) throw ApiError.conflict('Office code already exists in this organization');

  const office = await Office.create({
    ...payload,
    organizationId,
    createdBy: actor ? actor._id : undefined,
  });

  /* Bug 17 — when an office is created with a contact email, provision a
     manager user (or reuse the existing one), generate a temporary password
     and email the welcome instructions. Fire-and-forget so a failing SMTP
     doesn't break office creation; the email service has its own
     stream-fallback transport for dev. */
  (async () => {
    try {
      if (!office.contactEmail) return;
      const org = await Organization.findById(organizationId).select('name slug');
      const platformName = env.appName || 'CorpGMS';
      const loginUrl = env.clientUrl ? `${env.clientUrl}/login?email=${encodeURIComponent(office.contactEmail)}` : null;

      let manager = await User.findOne({
        organizationId,
        email: office.contactEmail.toLowerCase(),
      });

      let tempPassword = null;
      if (!manager) {
        tempPassword = generateRandomPassword(12);
        manager = await User.create({
          organizationId,
          officeId: office._id,
          name: payload.contactName || `${office.name} Manager`,
          email: office.contactEmail.toLowerCase(),
          phone: office.contactPhone,
          role: ROLES.MANAGER,
          assignedOffices: [office._id],
          password: await hashPassword(tempPassword),
          isActive: true,
          createdBy: actor ? actor._id : undefined,
        });
      } else if (!manager.officeId) {
        manager.officeId = office._id;
        if (!manager.assignedOffices?.length) manager.assignedOffices = [office._id];
        await manager.save();
      }

      const tpl = emailTemplates.OFFICE_CREATED({
        platformName,
        orgName: org?.name || platformName,
        contactName: payload.contactName || manager.name,
        officeName: office.name,
        officeCode: office.code,
        city: office.city,
        email: manager.email,
        tempPassword: tempPassword || '(use your existing password)',
        loginUrl,
      });

      await notificationService.sendEmail({
        to: manager.email,
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
      });
      logger.info(`[office] welcome email queued for ${manager.email} (office=${office.code})`);
    } catch (err) {
      logger.error('[office] welcome email failed: ' + (err?.message || err));
    }
  })();

  return office;
}

async function listOffices(query, organizationId) {
  const { page, limit, skip } = getPagination(query);
  const sort = buildSort(query, ['name', 'code', 'createdAt']);

  const filter = { organizationId };
  if (query.search) {
    const regex = buildSearchRegex(query.search);
    filter.$or = [{ name: regex }, { code: regex }, { city: regex }, { country: regex }];
  }
  if (typeof query.isActive === 'boolean') filter.isActive = query.isActive;

  const [items, total] = await Promise.all([
    Office.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    Office.countDocuments(filter),
  ]);

  return { items, meta: paginate(total, page, limit) };
}

async function getOfficeById(id, organizationId) {
  const office = await Office.findOne({ _id: id, organizationId });
  if (!office) throw ApiError.notFound('Office not found');
  return office;
}

async function updateOffice(id, organizationId, payload) {
  if (payload.code) {
    const exists = await Office.findOne({
      organizationId,
      code: payload.code.toUpperCase(),
      _id: { $ne: id },
    });
    if (exists) throw ApiError.conflict('Office code already exists in this organization');
  }
  const office = await Office.findOneAndUpdate({ _id: id, organizationId }, payload, {
    new: true,
    runValidators: true,
  });
  if (!office) throw ApiError.notFound('Office not found');
  return office;
}

async function deactivateOffice(id, organizationId) {
  const office = await Office.findOneAndUpdate(
    { _id: id, organizationId },
    { isActive: false },
    { new: true }
  );
  if (!office) throw ApiError.notFound('Office not found');
  return office;
}

module.exports = {
  createOffice,
  listOffices,
  getOfficeById,
  updateOffice,
  deactivateOffice,
};
