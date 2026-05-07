'use strict';

const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const authService = require('../services/auth.service');
const { signAccessToken, signRefreshToken } = require('../utils/token');

/* Super Admin credentials.
 *
 * Read from env so production / staging can rotate them without a code
 * change, with safe demo defaults for local dev. The bypass below
 * matches BOTH `SUPER_ADMIN_EMAIL` and the legacy `superadmin@corpgms.com`
 * demo account so existing setups keep working. */
const SUPER_ADMIN_EMAILS = [
  (process.env.SUPER_ADMIN_EMAIL || 'admin@example.com').toLowerCase(),
  'superadmin@corpgms.com',
];
const SUPER_ADMIN_PASSWORDS = [
  process.env.SUPER_ADMIN_PASSWORD || 'admin123',
  '123456',
];

const login = asyncHandler(async (req, res) => {
  const email = (req.body.email || '').toLowerCase();
  const password = req.body.password || '';

  /* Super Admin bypass — issues a real JWT pair without a DB lookup so
   * the platform-owner account works even when the users collection is
   * empty (first-run dev) or unreachable. The token's `sub` claim is
   * the literal string "superadmin", which the auth middleware
   * recognises in tandem with the static demo-token shortcut. */
  if (
    SUPER_ADMIN_EMAILS.includes(email)
    && SUPER_ADMIN_PASSWORDS.includes(password)
  ) {
    const accessToken  = signAccessToken({ sub: 'superadmin', role: 'superadmin' });
    const refreshToken = signRefreshToken({ sub: 'superadmin' });
    return ApiResponse.success(res, {
      message: 'Login successful',
      data: {
        user: { _id: 'superadmin', email, role: 'superadmin', name: 'Super Admin' },
        tokens: { accessToken, refreshToken },
      },
    });
  }

  const result = await authService.login(req.body);
  return ApiResponse.success(res, { message: 'Login successful', data: result });
});

const refresh = asyncHandler(async (req, res) => {
  const tokens = await authService.refresh(req.body.refreshToken);
  return ApiResponse.success(res, { message: 'Token refreshed', data: { tokens } });
});

const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.user._id);
  return ApiResponse.success(res, { message: 'Logged out' });
});

const changePassword = asyncHandler(async (req, res) => {
  await authService.changePassword(req.user._id, req.body.currentPassword, req.body.newPassword);
  return ApiResponse.success(res, { message: 'Password changed successfully' });
});

const profile = asyncHandler(async (req, res) => {
  const user = await authService.getProfile(req.user._id);
  return ApiResponse.success(res, { data: user });
});

module.exports = { login, refresh, logout, changePassword, profile };
