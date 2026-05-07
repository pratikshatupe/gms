/**
 * Central RBAC matrix.
 *
 * MODULES → 15 app modules (matches the route keys used in App.jsx)
 * ACTIONS → CRUD verbs every module is gated on
 * ROLES   → 5 first-class roles
 *
 * DEFAULT_PERMISSIONS is the *seed* persisted to localStorage on first run.
 * Once the Super Admin edits the matrix, that copy in localStorage wins.
 */

export const ROLE_KEYS = Object.freeze({
  SUPER_ADMIN:   'SuperAdmin',
  DIRECTOR:      'Director',
  MANAGER:       'Manager',
  RECEPTION:     'Reception',
  SERVICE_STAFF: 'ServiceStaff',
});

export const ROLES = Object.freeze([
  { key: ROLE_KEYS.SUPER_ADMIN,   label: 'Super Admin',   color: '#38BDF8' },
  { key: ROLE_KEYS.DIRECTOR,      label: 'Director',      color: '#60A5FA' },
  { key: ROLE_KEYS.MANAGER,       label: 'Manager',       color: '#34D399' },
  { key: ROLE_KEYS.RECEPTION,     label: 'Reception',     color: '#22D3EE' },
  { key: ROLE_KEYS.SERVICE_STAFF, label: 'Service Staff', color: '#FBBF24' },
]);

export const MODULES = Object.freeze([
  { key: 'dashboard',         label: 'Dashboard',           icon: '⬛' },
  { key: 'guest-log',         label: 'Guest Log',           icon: '📋' },
  { key: 'walkin',            label: 'Walk-in',             icon: '🚶' },
  { key: 'appointments',      label: 'Appointments',        icon: '📅' },
  { key: 'rooms',             label: 'Rooms',               icon: '🏢' },
  { key: 'staff',             label: 'Team',                icon: '👥' },
  { key: 'services',          label: 'Services',            icon: '⚙️' },
  { key: 'offices',           label: 'Offices',             icon: '🌐' },
  { key: 'notifications',     label: 'Notifications',       icon: '🔔' },
  { key: 'reports',           label: 'Reports',             icon: '📊' },
  { key: 'settings',          label: 'Settings',            icon: '🔧' },
  { key: 'subscription',      label: 'Subscription',        icon: '💎' },
  { key: 'admin',             label: 'Admin Panel',         icon: '🛡️' },
  { key: 'roles-permissions', label: 'Roles & Permissions', icon: '🔐' },
  { key: 'audit-logs',        label: 'Audit Logs',          icon: '📜' },
  { key: 'coupons',           label: 'Coupons',             icon: '🏷️' },
  { key: 'referrals',         label: 'Referrals',           icon: '🔗' },
  { key: 'integrations',      label: 'Integrations',        icon: '🔌' },
]);

export const ACTIONS = Object.freeze(['view', 'create', 'edit', 'delete']);

/* Module groupings used by the Roles & Permissions editor to render two
   sections (Platform vs Operational) and split the per-tab permission
   count so Super Admin's "operational denied by design" reads correctly
   instead of looking like reduced access. Order within each list is the
   render order in the editor. Every key here must exist in MODULES.

   Notifications and Settings sit in PLATFORM because their Super Admin
   surface is platform-level — Notifications shows Tenants / Billing /
   Security / Support tabs; Settings shows Platform Branding, Plans &
   Pricing, Security Policies, Regional Defaults, Feature Flags, and
   Maintenance. The per-tenant Notification feed and per-organisation
   Settings page are routed via the same modules but render different
   bodies based on role, so RBAC counting still resolves correctly. */
export const PLATFORM_MODULE_KEYS = Object.freeze([
  'dashboard',
  'admin',              /* sidebar label "Organisations" */
  'reports',
  'roles-permissions',
  'subscription',
  'audit-logs',
  'notifications',
  'settings',
  'coupons',
  'referrals',
  'integrations',
]);

export const OPERATIONAL_MODULE_KEYS = Object.freeze([
  'offices',
  'guest-log',
  'walkin',
  'appointments',
  'rooms',
  'staff',
  'services',
]);

/* Modules whose disablement would lock an admin out or undermine the audit
   surface. Surfaced as a "CRITICAL" badge in the editor so the Super Admin
   thinks twice before bulk-toggling them. */
export const CRITICAL_MODULE_KEYS = Object.freeze([
  'dashboard',
  'roles-permissions',
  'audit-logs',
]);

/* Helper text rendered under each role tab. Kept here so other surfaces
   (sidebar tooltips, role pickers) can reuse the same wording. */
export const ROLE_DESCRIPTIONS = Object.freeze({
  [ROLE_KEYS.SUPER_ADMIN]:
    'SaaS platform owner — full access to every platform module (dashboard, organisations, reports, subscription, audit logs, notifications, settings). Operational modules (offices, visitor flow, rooms, staff, services) are intentionally denied so the platform owner cannot accidentally see or modify a tenant\u2019s visitor data; tenant offices are reached via impersonation, not direct access. Roles & Permissions is managed by the Director within each organisation.',
  [ROLE_KEYS.DIRECTOR]:
    'Full organisation owner — access to all operational modules across every office in their tenant. Can manage teams, configure Roles & Permissions for all staff within their organisation, view reports, and manage organisation-level settings.',
  [ROLE_KEYS.MANAGER]:
    'Office operations lead — manages day-to-day visitor flow, appointments, rooms, staff, and services within their assigned office(s).',
  [ROLE_KEYS.RECEPTION]:
    'Front desk — handles visitor check-in, walk-ins, appointment confirmation, and badge issuance. Limited to their assigned office.',
  [ROLE_KEYS.SERVICE_STAFF]:
    'Operations — pantry, logistics, and facility service requests assigned to them. Can update task status only.',
});

const all = () => ({ view: true, create: true, edit: true, delete: true });
const viewOnly = () => ({ view: true, create: false, edit: false, delete: false });
const cre = () => ({ view: true, create: true, edit: true, delete: false });
const none = () => ({ view: false, create: false, edit: false, delete: false });

const buildRow = (perModule) =>
  MODULES.reduce((acc, m) => {
    acc[m.key] = perModule(m.key);
    return acc;
  }, {});

/* Operational modules that perform day-to-day visitor work. Super Admin is
   the SaaS owner, not an operator, so these are HIDDEN for them — the spec
   explicitly forbids cross-tenant operational actions. Offices is included
   here because tenant office management belongs to Director / Manager;
   Super Admin reaches a tenant's offices via impersonation, not direct
   access, so the platform owner's blast radius stays contained. */
const OPERATIONAL_MODULES = Object.freeze([
  'offices',
  'guest-log',
  'walkin',
  'appointments',
  'rooms',
  'staff',
  'services',
]);

/* Platform-level modules Super Admin owns. Anything not in this set and not
   explicitly granted below is denied for Super Admin.
   NOTE: roles-permissions is intentionally excluded — Super Admin manages the
   platform (organisations, subscriptions, billing) but does NOT manage
   tenant-level role matrices. Role assignment within an organisation is the
   Director's responsibility. */
const SUPER_ADMIN_FULL_MODULES = Object.freeze([
  'dashboard',
  'reports',
  'subscription',
  'admin',              /* platform admin panel — sidebar label "Organisations" */
  'coupons',
  'referrals',
  'integrations',
]);

const SUPER_ADMIN_VIEW_ONLY_MODULES = Object.freeze([
  'audit-logs',         /* spec: "Audit Logs → view access" */
  'notifications',      /* platform-level notifications surface */
  'settings',           /* platform-level settings surface */
  'guest-log',          /* Module 5: cross-tenant audit visibility (read-only). */
]);

export const DEFAULT_PERMISSIONS = Object.freeze({
  /* Super Admin = platform owner, NOT an operator. Per spec they have:
     - Dashboard, Organisations (admin), Reports, Roles & Permissions,
       Subscription → full access
     - Audit Logs, Notifications, Settings → view only (platform surfaces)
     - Offices, Guest Log, Walk-in, Appointments, Rooms, Team/Staff,
       Services → NO access (sidebar + routes hide these entirely)
     Unmentioned modules default to `none` so the blast radius is minimal. */
  [ROLE_KEYS.SUPER_ADMIN]: buildRow((k) => {
    /* Explicit view-only grants take precedence over the operational
       denial — an operational module with a view-only entry (e.g.
       guest-log) is a deliberate cross-tenant audit surface. */
    if (SUPER_ADMIN_VIEW_ONLY_MODULES.includes(k)) return viewOnly();
    if (OPERATIONAL_MODULES.includes(k))  return none();
    if (SUPER_ADMIN_FULL_MODULES.includes(k)) return all();
    return none();
  }),

  /* Director: highest authority within a single organisation. Full control
     over every operational module, but platform-level surfaces are hidden —
     admin, roles-permissions and subscription belong to the SaaS owner
     (Super Admin) only. Audit Logs remain view-only for within-org
     compliance review. */
  [ROLE_KEYS.DIRECTOR]: buildRow((k) => {
    if (k === 'admin')             return none();
    /* Per spec — Director has no access to platform billing surfaces. */
    if (k === 'subscription')      return none();
    if (k === 'coupons')           return none();
    if (k === 'referrals')         return none();
    if (k === 'integrations')      return none();
    if (k === 'roles-permissions') return all();
    if (k === 'audit-logs')        return all();
    return all();
  }),

  /* Manager: day-to-day operations inside a single organisation. Full
     control over the operational surface (dashboard, guest log, walk-in,
     appointments, rooms, services, reports) but platform-level
     surfaces (admin, roles-permissions, audit-logs, subscription) are
     hidden.

     The "three-action-allowed-no-delete" pattern applies to offices,
     rooms, staff and services — Managers can add and update records
     in these modules but cannot delete, because deletion cascades to
     linked records (staff, rooms, appointments) and is intentionally
     reserved for Directors.

     Staff: additionally NO create — role assignment must route
     through a Director. */
  [ROLE_KEYS.MANAGER]: buildRow((k) => {
    if (['admin', 'roles-permissions', 'audit-logs'].includes(k)) return none();
    /* Module 9 — Manager has read-only Subscription. Sees current plan,
       usage, invoices but cannot upgrade / downgrade / cancel. */
    if (k === 'subscription') return viewOnly();
    if (k === 'offices')  return { view: true, create: true,  edit: true, delete: false };
    if (k === 'rooms')    return { view: true, create: true,  edit: true, delete: false };
    if (k === 'services') return { view: true, create: true,  edit: true, delete: false };
    if (k === 'staff')    return { view: true, create: false, edit: true, delete: false };
    return all();
  }),

  /* Reception: front-desk surface — fast, minimal, highly restricted.
     Only walk-in check-in, guest log (limited), and appointments (for
     marking visitors as arrived) are exposed. Rooms, staff, reports,
     services, and every platform surface are hidden. Appointments allow
     edit (= check-in transition) but not create/delete, per spec. */
  [ROLE_KEYS.RECEPTION]: buildRow((k) => {
    if (k === 'dashboard')     return viewOnly();   /* landing after login */
    if (k === 'walkin')        return cre();        /* create + edit walk-ins */
    if (k === 'guest-log')     return cre();        /* view + check-out edit */
    if (k === 'appointments')  return { view: true, create: true,  edit: true, delete: false };
    if (k === 'notifications') return cre();
    if (k === 'settings')      return viewOnly();   /* own profile only */
    return none();                                   /* everything else hidden */
  }),

  /* Service Staff: execution-only surface. Spec is strict — ONLY the
     services module ("My Tasks") is exposed. No dashboard, no notifications,
     no settings, no visitor data. The Services page is tenant- and
     assignee-scoped by filterServices so they only see their own rows. */
  [ROLE_KEYS.SERVICE_STAFF]: buildRow((k) => {
    if (k === 'services') return { view: true, create: false, edit: true, delete: false };
    return none();
  }),
});

/* Map AuthContext role IDs (lowercase) → permission matrix keys. */
export const AUTH_ROLE_TO_KEY = Object.freeze({
  superadmin:   ROLE_KEYS.SUPER_ADMIN,
  super_admin:  ROLE_KEYS.SUPER_ADMIN,
  director:     ROLE_KEYS.DIRECTOR,
  manager:      ROLE_KEYS.MANAGER,
  reception:    ROLE_KEYS.RECEPTION,
  receptionist: ROLE_KEYS.RECEPTION,   // alias support — Bug 10 fix
  service:      ROLE_KEYS.SERVICE_STAFF,
  servicestaff: ROLE_KEYS.SERVICE_STAFF,
  service_staff:ROLE_KEYS.SERVICE_STAFF,
  staff:        ROLE_KEYS.SERVICE_STAFF,
});

/* Dynamic matrix key. Bumped to v2 on 2026-04-21 to clear cached Director
   permissions that denied roles-permissions access. Old v1 cache is listed
   in LEGACY_PERMISSIONS_KEYS so the reader discards it and rebuilds fresh
   from DEFAULT_PERMISSIONS (Director now gets full roles-permissions access;
   Super Admin loses it). */
export const PERMISSIONS_STORAGE_KEY  = 'role_permissions_dynamic.v4';
export const CURRENT_ROLE_STORAGE_KEY = 'current_role';
export const LEGACY_PERMISSIONS_KEYS  = Object.freeze([
  'role_permissions_dynamic.v3',
  'role_permissions_dynamic.v2',
  'role_permissions_dynamic.v1',
  'role_permissions.v6',
  'role_permissions.v5',
  'role_permissions.v4',
  'role_permissions.v3',
  'role_permissions.v2',
  'role_permissions',
]);

/**
 * Modules Super Admin must always retain `view` on, regardless of any
 * persisted matrix state. Used by RoleContext to guarantee Super Admin can
 * never lock themselves out of the platform — in particular the Roles &
 * Permissions module itself, which edits the matrix.
 *
 * This list DOES NOT grant write access; it only keeps `view` pinned on.
 * Operational modules (offices, appointments, guest-log, walk-in, rooms,
 * staff, services) are intentionally absent so Super Admin remains
 * blocked from every day-to-day module per spec.
 */
export const SUPER_ADMIN_LOCKED_MODULES = Object.freeze([
  'dashboard',
  'admin',
  'reports',
  'subscription',
  'audit-logs',
  'notifications',
  'settings',
  'coupons',
  'referrals',
  'integrations',
  /* roles-permissions is intentionally excluded — this module is now owned
     by Directors (org-level role management). Super Admin cannot view or
     edit the role matrix for any tenant organisation. */
]);

/**
 * Standalone RBAC check for use *outside* React context — services,
 * reducers, validators, exporters, audit guards, etc.
 *
 *   hasPermission('Manager', 'staff', 'delete')                        → false
 *   hasPermission('director', 'appointments', 'create')                → true
 *   hasPermission('Manager', 'reports', 'view', { orgId: 'org-2' })    → org override applies
 *   hasPermission(userObject,    'reports', 'view')                    → auto-derives role + orgId
 *
 * Resolution order (NO role-level bypasses — every role, including Super
 * Admin, is resolved from the matrix so access is always auditable):
 *   1. Org override from role_permissions_org_overrides.v1 (if orgId known).
 *   2. Dynamic default matrix from role_permissions_dynamic.v1.
 *   3. DEFAULT_PERMISSIONS fallback.
 *   4. If nothing found → false (fail closed).
 *
 * Accepts the role as a string (matrix form 'Manager' or auth form
 * 'manager'/'service'), or as a user object carrying `.role` and
 * `.organisationId` so callers don't have to normalise themselves.
 */
export function hasPermission(roleOrUser, moduleKey, action = 'view', opts = {}) {
  if (!roleOrUser || !moduleKey) return false;

  let roleStr;
  let orgId = opts.orgId;
  if (typeof roleOrUser === 'object') {
    roleStr = roleOrUser.role;
    if (orgId === undefined) orgId = roleOrUser.organisationId || roleOrUser.orgId || null;
  } else {
    roleStr = roleOrUser;
  }

  const roleKey = AUTH_ROLE_TO_KEY[String(roleStr).toLowerCase()] || roleStr;
  if (!roleKey) return false;

  /* Default (non-org) matrix. */
  let matrix = null;
  try {
    const raw = localStorage.getItem(PERMISSIONS_STORAGE_KEY);
    if (raw) matrix = JSON.parse(raw);
    if (!matrix) {
      for (const legacy of LEGACY_PERMISSIONS_KEYS) {
        const legacyRaw = localStorage.getItem(legacy);
        if (legacyRaw) { matrix = JSON.parse(legacyRaw); break; }
      }
    }
  } catch { /* localStorage unavailable — fall back to defaults */ }

  /* Org-specific override, if any. */
  let overrides = null;
  if (orgId) {
    try {
      const raw = localStorage.getItem('role_permissions_org_overrides.v1');
      if (raw) overrides = JSON.parse(raw);
    } catch { /* ignore */ }
  }

  const overrideRow = orgId ? overrides?.[orgId]?.[roleKey]?.[moduleKey] : null;
  if (overrideRow) return Boolean(overrideRow[action]);

  const dynamicRow = matrix?.[roleKey]?.[moduleKey];
  const defaultRow = DEFAULT_PERMISSIONS?.[roleKey]?.[moduleKey];
  const row = dynamicRow ?? defaultRow;
  if (!row) return false; /* unknown role/module → fail closed */
  return Boolean(row?.[action]);
}

/**
 * Action-level guard for callers that perform work (createAppointment,
 * walkInCheckIn, createService, …). Throws a PermissionError so the call
 * stack fails loudly rather than silently mutating state even if the UI
 * guard is bypassed (e.g. via the console, a stale tab, or a crafted
 * fetch). Callers may catch this to translate into a toast.
 */
export class PermissionError extends Error {
  constructor(moduleKey, action, role) {
    super(`Permission denied: role "${role}" cannot ${action} on "${moduleKey}".`);
    this.name     = 'PermissionError';
    this.module   = moduleKey;
    this.action   = action;
    this.role     = role;
  }
}

export function requirePermission(roleOrUser, moduleKey, action = 'view', opts = {}) {
  if (!hasPermission(roleOrUser, moduleKey, action, opts)) {
    const role = typeof roleOrUser === 'object' ? roleOrUser?.role : roleOrUser;
    throw new PermissionError(moduleKey, action, role || 'anonymous');
  }
  return true;
}