'use strict';

const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { hashPassword, generateRandomPassword } = require('../utils/password');
const { getPagination, buildSort, paginate } = require('../utils/pagination');
const { buildSearchRegex } = require('../utils/helpers');
const { ROLES } = require('../config/constants');

async function createUser(payload, organizationId, actor) {
  if (payload.role === ROLES.SUPER_ADMIN && (!actor || actor.role !== ROLES.SUPER_ADMIN)) {
    throw ApiError.forbidden('Only super admin can create another super admin');
  }

  const existing = await User.findOne({
    organizationId: organizationId || null,
    email: payload.email.toLowerCase(),
  });
  if (existing) throw ApiError.conflict('A user with this email already exists');

  const password = payload.password || generateRandomPassword(12);

  const user = await User.create({
    organizationId: payload.role === ROLES.SUPER_ADMIN ? null : organizationId,
    officeId: payload.officeId || null,
    name: payload.name,
    email: payload.email.toLowerCase(),
    phone: payload.phone,
    designation: payload.designation,
    department: payload.department,
    role: payload.role,
    permissions: payload.permissions || [],
    assignedOffices: payload.assignedOffices || [],
    password: await hashPassword(password),
    isActive: true,
    createdBy: actor ? actor._id : undefined,
  });

  // Bug 7 fix: send staff invitation email (fire-and-forget)
  (async () => {
    try {
      const Organization = require('../models/Organization');
      const emailTemplates = require('../templates/email.templates');
      const env = require('../config/env');
      const logger = require('../config/logger');
      const notificationService = require('./notification.service');

      const org = organizationId ? await Organization.findById(organizationId).select('name slug') : null;
      const inviteLink = env.clientUrl ? `${env.clientUrl}/login?email=${encodeURIComponent(user.email)}` : null;

      const tpl = emailTemplates.STAFF_INVITE({
        name: user.name,
        email: user.email,
        role: payload.role,
        tempPassword: payload.password ? null : password,
        orgName: org?.name || 'CorpGMS',
        inviteLink,
      });

      await notificationService.sendEmail({
        to: user.email,
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
      });
      logger.info(`Staff invite email queued for ${user.email}`);
    } catch (err) {
      try { require('../config/logger').error('Staff invite email failed: ' + (err?.message || err)); } catch {}
    }
  })();

  return { user, tempPassword: payload.password ? null : password };
}

async function listUsers(query, organizationId) {
  const { page, limit, skip } = getPagination(query);
  const sort = buildSort(query, ['name', 'email', 'createdAt', 'role']);

  const filter = {};
  if (organizationId) filter.organizationId = organizationId;
  if (query.role) filter.role = query.role;
  if (query.officeId) filter.officeId = query.officeId;
  if (typeof query.isActive === 'boolean') filter.isActive = query.isActive;
  if (query.search) {
    const regex = buildSearchRegex(query.search);
    filter.$or = [{ name: regex }, { email: regex }, { department: regex }, { designation: regex }];
  }

  const [items, total] = await Promise.all([
    User.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);

  return { items, meta: paginate(total, page, limit) };
}

async function getUserById(id, organizationId) {
  const filter = organizationId ? { _id: id, organizationId } : { _id: id };
  const user = await User.findOne(filter)
    .populate('officeId', 'name code')
    .populate('assignedOffices', 'name code');
  if (!user) throw ApiError.notFound('User not found');
  return user;
}

async function updateUser(id, organizationId, payload, actor) {
  const target = await User.findOne(
    organizationId ? { _id: id, organizationId } : { _id: id }
  );
  if (!target) throw ApiError.notFound('User not found');

  if (payload.role && payload.role !== target.role) {
    if (target.role === ROLES.SUPER_ADMIN || payload.role === ROLES.SUPER_ADMIN) {
      if (!actor || actor.role !== ROLES.SUPER_ADMIN) {
        throw ApiError.forbidden('Only super admin can change super admin roles');
      }
    }
  }

  Object.assign(target, payload);
  await target.save();
  return target;
}

async function resetUserPassword(id, organizationId, newPassword) {
  const filter = organizationId ? { _id: id, organizationId } : { _id: id };
  const user = await User.findOne(filter);
  if (!user) throw ApiError.notFound('User not found');

  user.password = await hashPassword(newPassword);
  user.passwordChangedAt = new Date();
  user.refreshToken = undefined;
  await user.save();
  return user;
}

async function deactivateUser(id, organizationId) {
  const filter = organizationId ? { _id: id, organizationId } : { _id: id };
  const user = await User.findOneAndUpdate(filter, { isActive: false, refreshToken: undefined }, { new: true });
  if (!user) throw ApiError.notFound('User not found');
  return user;
}

async function activateUser(id, organizationId) {
  const filter = organizationId ? { _id: id, organizationId } : { _id: id };
  const user = await User.findOneAndUpdate(filter, { isActive: true }, { new: true });
  if (!user) throw ApiError.notFound('User not found');
  return user;
}

module.exports = {
  createUser,
  listUsers,
  getUserById,
  updateUser,
  resetUserPassword,
  deactivateUser,
  activateUser,
};
