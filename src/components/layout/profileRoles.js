/**
 * Role helpers for the profile dropdown / modal.
 *
 * The product spec talks about 5 roles (SuperAdmin, Admin, Manager, Staff,
 * Viewer) but the existing codebase uses (superadmin, director, manager,
 * reception, service). We accept both naming schemes so the helpers work
 * regardless of which set of identifiers a future build uses.
 */

const norm = (r) => (r || '').toString().trim().toLowerCase();

const SUPERADMIN = new Set(['superadmin', 'super-admin', 'super_admin']);
const ADMIN      = new Set(['admin', 'director']);
const MANAGER    = new Set(['manager']);
const STAFF      = new Set(['staff', 'reception', 'service']);
const VIEWER     = new Set(['viewer']);

export const isSuperAdmin = (r) => SUPERADMIN.has(norm(r));
export const isAdmin      = (r) => ADMIN.has(norm(r));
export const isManager    = (r) => MANAGER.has(norm(r));
export const isStaff      = (r) => STAFF.has(norm(r));
export const isViewer     = (r) => VIEWER.has(norm(r));

export const ROLE_LABELS = {
  superadmin: 'Super Admin',
  admin:      'Admin',
  director:   'Admin',
  manager:    'Manager',
  reception:  'Staff',
  service:    'Staff',
  staff:      'Staff',
  viewer:     'Viewer',
};

export const ROLE_COLORS = {
  superadmin: '#38BDF8',
  admin:      '#60A5FA',
  director:   '#60A5FA',
  manager:    '#34D399',
  reception:  '#22D3EE',
  service:    '#FBBF24',
  staff:      '#FBBF24',
  viewer:     '#94A3B8',
};

export const roleLabel = (r) => ROLE_LABELS[norm(r)] || 'Member';
export const roleColor = (r) => ROLE_COLORS[norm(r)] || '#38BDF8';

/**
 * Permission matrix for the profile dropdown / modal.
 *   canEditProfile     — name/email/phone/password fields are editable
 *   canChangePassword  — "Change Password" menu item is shown
 *   canViewProfile     — every authenticated role can view their own profile
 *
 * Spec: SuperAdmin/Admin → full; Manager/Staff → View Profile + Logout;
 * Viewer → View Profile (read-only) + Logout.
 */
export function profilePermissions(role) {
  const elevated = isSuperAdmin(role) || isAdmin(role);
  return {
    canViewProfile:    true,
    canEditProfile:    elevated,
    canChangePassword: elevated,
    isReadOnly:        !elevated,
  };
}
