/**
 * Super-Admin impersonation helpers.
 *
 * Lets the SaaS owner temporarily "log in as" a Director of a tenant
 * organisation to reproduce a bug or walk a customer through a fix.
 * The original Super Admin session is stashed in sessionStorage so a
 * browser refresh doesn't strand the operator inside the tenant's
 * view — the banner's "End Impersonation" action restores it.
 *
 * Every start AND stop writes an audit log entry. A real backend would
 * enforce this server-side; the frontend stub keeps the same shape so
 * the audit trail survives when the backend lands.
 */

import { STORAGE_KEYS } from '../store';
import { addAuditLog } from './auditLogger';

const BACKUP_KEY     = 'cgms_superadmin_backup';
const START_TIME_KEY = 'cgms_impersonation_started_at';

/** Is a Super Admin currently impersonating someone? */
export function isImpersonating() {
  try {
    return Boolean(sessionStorage.getItem(BACKUP_KEY));
  } catch {
    return false;
  }
}

/** Read the saved Super Admin snapshot (or null). */
export function readBackup() {
  try {
    const raw = sessionStorage.getItem(BACKUP_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Milliseconds since the current impersonation started (0 if none). */
export function impersonationDurationMs() {
  try {
    const started = Number(sessionStorage.getItem(START_TIME_KEY));
    if (!Number.isFinite(started) || started === 0) return 0;
    return Math.max(0, Date.now() - started);
  } catch {
    return 0;
  }
}

/**
 * Start impersonating a target user inside a target organisation.
 *
 *   @param {Object}  options
 *   @param {Object}  options.operator  current Super Admin user record
 *   @param {Object}  options.org       target organisation row
 *   @param {Object}  options.target    { id, name, email, role }
 *
 * Returns the new session user record that callers should feed into
 * AuthContext.login() so the app re-renders as the tenant Director.
 */
export function startImpersonation({ operator, org, target }) {
  if (!operator || !org || !target) return null;
  /* Never start twice — the backup can only hold one snapshot. */
  if (isImpersonating()) return null;

  const snapshot = {
    savedAt: new Date().toISOString(),
    user:    operator,
    orgId:   org.id,
    orgName: org.name,
  };
  try {
    sessionStorage.setItem(BACKUP_KEY, JSON.stringify(snapshot));
    sessionStorage.setItem(START_TIME_KEY, String(Date.now()));
  } catch {
    /* Session storage full / disabled — let the caller decide how to
     * surface this. Returning null signals failure. */
    return null;
  }

  const nextUser = {
    id:              target.id || `dir-${org.id}`,
    name:            target.name  || 'Director',
    email:           target.email || `director@${(org.name || 'org').toLowerCase().replace(/\s+/g, '')}.com`,
    role:            (target.role || 'director').toLowerCase(),
    organisationId:  org.id,
    officeId:        'all',
    /* Flag is read by the banner component so the UI can warn the
     * operator persistently that they're inside a tenant. */
    impersonatedBy:  operator.name || 'Super Admin',
    impersonatedFromRole: operator.role || 'superadmin',
  };

  /* Swap the persisted session too so a refresh keeps the impersonation
   * active until End Impersonation is clicked. */
  try {
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(nextUser));
  } catch {}

  addAuditLog({
    userName:    operator.name || 'Super Admin',
    role:        operator.role || 'superadmin',
    action:      'IMPERSONATE_START',
    module:      'Organisations',
    description: `${operator.name || 'Super Admin'} started impersonating ${nextUser.name} (${nextUser.role}) at ${org.name}.`,
    orgId:       org.id,
  });

  return nextUser;
}

/**
 * End the current impersonation and return the Super Admin user
 * record so the caller can restore the session via AuthContext.login.
 * Returns null if no impersonation was in progress.
 */
export function endImpersonation(currentUser) {
  const backup = readBackup();
  if (!backup) return null;

  const durationMs = impersonationDurationMs();
  try {
    sessionStorage.removeItem(BACKUP_KEY);
    sessionStorage.removeItem(START_TIME_KEY);
  } catch {}

  /* Restore the Super Admin user into localStorage so the session
   * survives refresh. */
  try {
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(backup.user));
  } catch {}

  addAuditLog({
    userName:    backup.user?.name || 'Super Admin',
    role:        backup.user?.role || 'superadmin',
    action:      'IMPERSONATE_END',
    module:      'Organisations',
    description: `Ended impersonation of ${currentUser?.name || 'tenant user'} at ${backup.orgName || 'organisation'} after ${Math.round(durationMs / 1000)}s.`,
    orgId:       backup.orgId,
  });

  return backup.user;
}
