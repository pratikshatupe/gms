import { useCallback, useEffect, useMemo, useState } from 'react';
import { STORAGE_KEYS, SAME_TAB_EVENT } from './index';
import { safeGet, safeSet } from '../utils/storage';

/**
 * useOrgSettings — per-org settings hook (Module 8).
 *
 * Storage shape (ORG_SETTINGS key):
 *   { [orgId]: { ...DEFAULT_ORG_SETTINGS, ...overrides } }
 *
 * SuperAdmin cannot write to ORG_SETTINGS — they manage the platform via
 * SETTINGS / PLATFORM_SETTINGS keys. Calling the writer as SA logs a dev
 * warning and no-ops so tenant isolation is never accidentally breached.
 *
 *   const { settings, save, canWrite } = useOrgSettings(user);
 *   save({ orgName: 'ACME' });
 *
 * Cross-tab sync matches every other useCollection consumer:
 *   'cgms:storage' custom event in-tab + native 'storage' event cross-tab.
 */

/** Shape every org falls back to on first read. Keep minimal so the tabs
 *  themselves own their field-level defaults. */
export const DEFAULT_ORG_SETTINGS = Object.freeze({
  /* Organisation Profile */
  orgName:       '',
  tradingName:   '',
  logoDataUrl:   null,          /* base64; 200 KB cap enforced in the tab */
  addressLine1:  '',
  addressLine2:  '',
  city:          '',
  state:         '',
  postalCode:    '',
  country:       '',
  timezone:      'Asia/Dubai',
  currency:      'INR',
  contactEmail:  '',
  contactPhone:  '',

  /* Check-In Config */
  approvalMode:        'ReportingChain',  /* 'Any' | 'ReportingChain' | 'None' */
  approvalTimeoutHrs:  24,
  allowDoubleBook:     false,
  badgeTemplate:       'standard',        /* 'standard' | 'compact' | 'hostFirst' */
  qrTtlMinutes:        60,                /* Self-check-out QR lifetime */
  requirePhoto:        true,
  requireIdProof:      true,

  /* Audit metadata (stamped on save) */
  updatedAt: null,
  updatedBy: null,
});

function readMap() {
  const raw = safeGet(STORAGE_KEYS.ORG_SETTINGS, null);
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw;
  return {};
}

function writeMap(next) {
  safeSet(STORAGE_KEYS.ORG_SETTINGS, next || {});
  try {
    window.dispatchEvent(new CustomEvent(SAME_TAB_EVENT, { detail: { key: STORAGE_KEYS.ORG_SETTINGS } }));
  } catch { /* no-op */ }
}

/**
 * One-time migration — lift legacy tenant-shaped fields out of the global
 * SETTINGS blob into ORG_SETTINGS[user.orgId]. Idempotent: writes a
 * '__migratedFrom' marker so subsequent reads skip.
 */
const TENANT_FIELDS = [
  'orgName', 'tradingName', 'logoDataUrl', 'addressLine1', 'addressLine2',
  'city', 'state', 'postalCode', 'country', 'timezone', 'currency',
  'contactEmail', 'contactPhone',
  'approvalMode', 'approvalTimeoutHrs', 'allowDoubleBook', 'badgeTemplate',
  'qrTtlMinutes', 'requirePhoto', 'requireIdProof',
];

export function migrateLegacySettings(user) {
  if (!user?.organisationId && !user?.orgId) return 0;
  const orgId = user.organisationId || user.orgId;

  const map = readMap();
  if (map[orgId]?.__migratedFrom === 'settings.v0') return 0;

  const legacy = safeGet(STORAGE_KEYS.SETTINGS, null);
  if (!legacy || typeof legacy !== 'object') return 0;

  const lifted = {};
  let count = 0;
  for (const key of TENANT_FIELDS) {
    if (legacy[key] !== undefined) {
      lifted[key] = legacy[key];
      count += 1;
    }
  }
  if (count === 0) {
    /* Still stamp the marker so we don't re-check on every mount. */
    const next = { ...map, [orgId]: { ...(map[orgId] || {}), __migratedFrom: 'settings.v0' } };
    writeMap(next);
    return 0;
  }
  const next = {
    ...map,
    [orgId]: { ...DEFAULT_ORG_SETTINGS, ...lifted, ...(map[orgId] || {}), __migratedFrom: 'settings.v0' },
  };
  writeMap(next);
  // eslint-disable-next-line no-console
  console.log(`[Settings] Migrated ${count} org-scoped field(s) from SETTINGS to ORG_SETTINGS for ${orgId}.`);
  return count;
}

/**
 * Hook — returns settings for the user's org + a writer. Returns null for
 * SuperAdmin; calling save() as SA logs a dev warning and no-ops.
 *
 * @param {{ organisationId?: string, orgId?: string, role?: string }} user
 * @param {{ org?: any }} [extra] — optional fallback org record used to seed
 *   orgName/country/timezone/currency when ORG_SETTINGS is empty for this org.
 */
export function useOrgSettings(user, extra = {}) {
  const role  = (user?.role || '').toLowerCase();
  const orgId = user?.organisationId || user?.orgId || null;
  const isSuperAdmin = role === 'superadmin';

  const [map, setMap] = useState(() => {
    if (orgId && !isSuperAdmin) migrateLegacySettings(user);
    return readMap();
  });

  /* Cross-tab + same-tab sync. */
  useEffect(() => {
    const reload = () => setMap(readMap());
    const onSame = (e) => { if (e?.detail?.key === STORAGE_KEYS.ORG_SETTINGS) reload(); };
    const onNative = (e) => { if (e.key === STORAGE_KEYS.ORG_SETTINGS) reload(); };
    window.addEventListener(SAME_TAB_EVENT, onSame);
    window.addEventListener('storage', onNative);
    return () => {
      window.removeEventListener(SAME_TAB_EVENT, onSame);
      window.removeEventListener('storage', onNative);
    };
  }, []);

  /* Merge: defaults ← org-record seed ← persisted overrides. */
  const settings = useMemo(() => {
    if (!orgId) return null;
    const persisted = map[orgId] || {};
    const orgSeed = extra?.org || {};
    return {
      ...DEFAULT_ORG_SETTINGS,
      orgName:  orgSeed.name      || DEFAULT_ORG_SETTINGS.orgName,
      country:  orgSeed.country   || DEFAULT_ORG_SETTINGS.country,
      timezone: orgSeed.timezone  || DEFAULT_ORG_SETTINGS.timezone,
      currency: orgSeed.currency  || DEFAULT_ORG_SETTINGS.currency,
      ...persisted,
    };
  }, [map, orgId, extra?.org]);

  const canWrite = Boolean(orgId) && !isSuperAdmin;

  const save = useCallback((patch) => {
    if (isSuperAdmin) {
      // eslint-disable-next-line no-console
      console.warn('[useOrgSettings] SuperAdmin cannot write to ORG_SETTINGS. Use SuperAdminSettings / PLATFORM_SETTINGS instead.');
      return null;
    }
    if (!orgId) return null;
    const current = readMap();
    const next = {
      ...current,
      [orgId]: {
        ...DEFAULT_ORG_SETTINGS,
        ...(current[orgId] || {}),
        ...patch,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.name || user?.email || 'Unknown',
      },
    };
    writeMap(next);
    setMap(next);
    return next[orgId];
  }, [isSuperAdmin, orgId, user?.name, user?.email]);

  return { settings, save, canWrite, isSuperAdmin };
}
