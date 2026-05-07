import { safeGet } from './storage';
import { STORAGE_KEYS } from '../store/keys';
import { MOCK_ORGANIZATIONS } from '../data/mockData';

const ROLE_LABELS = {
  superadmin:   'Super Admin',
  super_admin:  'Super Admin',
  director:     'Director',
  manager:      'Manager',
  reception:    'Reception',
  receptionist: 'Reception',
  service:      'Service Staff',
  servicestaff: 'Service Staff',
  service_staff:'Service Staff',
  staff:        'Service Staff',
};

export const ORG_FALLBACK = 'Organization not assigned';

/** Lowercase, normalised role key. */
export function normaliseRole(role) {
  return (role || '').toString().toLowerCase().replace(/\s+/g, '');
}

/** Human-readable role label. Falls back to titlecasing the raw string. */
export function roleLabel(role) {
  const k = normaliseRole(role);
  if (ROLE_LABELS[k]) return ROLE_LABELS[k];
  if (!role) return '—';
  return role.charAt(0).toUpperCase() + role.slice(1);
}

/**
 * Resolve the active org name for the logged-in user. Reads from the
 * persisted ORGANIZATIONS collection (with the static seed as fallback)
 * and the registered-orgs table from registration. Returns
 * `ORG_FALLBACK` when nothing matches so the UI never renders blank.
 */
export function orgNameFor(user) {
  if (!user) return ORG_FALLBACK;
  const orgId = user.organisationId || user.orgId;
  if (!orgId || orgId === 'all') return user.organisationName || user.companyName || ORG_FALLBACK;

  const persisted = safeGet(STORAGE_KEYS.ORGANIZATIONS, MOCK_ORGANIZATIONS) || [];
  const registered = safeGet('cgms_registered_orgs', []) || [];
  const all = [...(Array.isArray(persisted) ? persisted : []),
               ...(Array.isArray(registered) ? registered : [])];

  const match = all.find((o) => o?.id === orgId);
  if (match?.name) return match.name;

  return user.organisationName || user.companyName || ORG_FALLBACK;
}
