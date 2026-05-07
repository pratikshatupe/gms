/**
 * Organisation-level RBAC overrides.
 *
 * Conceptual shape (spec requirement):
 *   permissions = {
 *     role: {
 *       default:      { [moduleKey]: { view, create, edit, delete } },
 *       orgOverrides: { [orgId]: { [moduleKey]: { view, create, edit, delete } } }
 *     }
 *   }
 *
 * To keep the existing editor's flat per-role persistence intact, we store
 * the `default` half under the existing key (`role_permissions_dynamic.v1`,
 * handled by RoleContext) and the `orgOverrides` half under a separate key
 * here (`role_permissions_org_overrides.v1`). The resolver assembles them
 * on demand.
 *
 * Resolution rules (NO role-level bypass — every role, including Super
 * Admin, resolves from the matrix so access is always auditable):
 *   1. If orgOverrides[orgId][role][moduleKey] exists, use it.
 *   2. Else fall back to the role's `default` row.
 *   3. Else fall back to DEFAULT_PERMISSIONS.
 *   4. Else return `none` (fail closed).
 */

import {
  DEFAULT_PERMISSIONS,
  ROLE_KEYS,
} from './defaultPermissions';

export const ORG_OVERRIDES_STORAGE_KEY = 'role_permissions_org_overrides.v1';
export const ORG_OVERRIDES_EVENT       = 'rbac:org-overrides-updated';

export function readOrgOverrides() {
  try {
    const raw = localStorage.getItem(ORG_OVERRIDES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function writeOrgOverrides(next) {
  try {
    localStorage.setItem(ORG_OVERRIDES_STORAGE_KEY, JSON.stringify(next || {}));
    window.dispatchEvent(new Event(ORG_OVERRIDES_EVENT));
  } catch { /* quota / disabled — non-fatal */ }
}

/**
 * Resolve the {view,create,edit,delete} row for (role, orgId, moduleKey),
 * honouring the layered cascade described in the header comment.
 *
 *   resolveRow({ role: 'Manager', orgId: 'org-2', moduleKey: 'reports',
 *                defaultsByRole, orgOverrides })
 *     → { view: true, create: false, edit: true, delete: false }
 *
 * `defaultsByRole` is the flat per-role matrix the existing editor saves
 * (i.e. RoleContext's `permissions` state). When it's absent, DEFAULT_PERMISSIONS
 * is used as the last-resort fallback so the app never renders from an
 * empty row.
 */
export function resolveRow({ role, orgId, moduleKey, defaultsByRole, orgOverrides }) {
  const empty = { view: false, create: false, edit: false, delete: false };
  if (!role || !moduleKey) return empty;

  /* Super Admin org overrides are allowed but the defaults for Super Admin
     are strictly platform-only per defaultPermissions.js — the resolver no
     longer hard-codes full access. This keeps access auditable and
     prevents operational-module leakage. */

  const override = orgId
    ? orgOverrides?.[orgId]?.[role]?.[moduleKey]
    : null;
  if (override) return { ...empty, ...override };

  const fromDefaults = defaultsByRole?.[role]?.[moduleKey];
  if (fromDefaults) return fromDefaults;

  return DEFAULT_PERMISSIONS?.[role]?.[moduleKey] || empty;
}

/** Programmatic setter — intentionally tiny so future UI can drive it. */
export function setOrgOverride(orgId, role, moduleKey, action, value) {
  if (!orgId || !role || !moduleKey) return;
  const next = readOrgOverrides();
  if (!next[orgId]) next[orgId] = {};
  if (!next[orgId][role]) next[orgId][role] = {};
  if (!next[orgId][role][moduleKey]) {
    next[orgId][role][moduleKey] = { view: false, create: false, edit: false, delete: false };
  }
  next[orgId][role][moduleKey][action] = Boolean(value);
  writeOrgOverrides(next);
}

/** Clear all overrides for an org (e.g. tenant offboarding). */
export function clearOrgOverrides(orgId) {
  const next = readOrgOverrides();
  if (orgId in next) {
    delete next[orgId];
    writeOrgOverrides(next);
  }
}

/**
 * Build the full conceptual `{ [role]: { default, orgOverrides } }` shape
 * from the two separately-persisted halves. Handy for exports, audit
 * snapshots, and admin UIs that want to reason about the whole matrix.
 */
export function assembleUnifiedMatrix(defaultsByRole) {
  const overrides = readOrgOverrides();
  const out = {};
  for (const role of Object.values(ROLE_KEYS)) {
    const perOrg = {};
    for (const [orgId, byRole] of Object.entries(overrides || {})) {
      if (byRole?.[role]) perOrg[orgId] = byRole[role];
    }
    out[role] = {
      default:      defaultsByRole?.[role] || DEFAULT_PERMISSIONS[role],
      orgOverrides: perOrg,
    };
  }
  return out;
}
