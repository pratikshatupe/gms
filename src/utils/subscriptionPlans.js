/**
 * Subscription-plan store helpers.
 *
 * Plans come from two places:
 *   1. `SUBSCRIPTION_PLANS` in data/mockData — baked-in defaults (Starter / Pro / Enterprise)
 *   2. Custom plans created by a Super Admin via the Subscription page — kept in
 *      localStorage under STORAGE_KEYS.SUBSCRIPTION_PLANS
 *
 * `getAllPlans()` returns both merged, custom plans win on name collision so a
 * Super Admin can override Starter pricing without editing code.
 */
import { SUBSCRIPTION_PLANS as DEFAULT_PLANS } from '../data/mockData';
import { safeGet } from './storage';
import { STORAGE_KEYS } from '../store';

export const PLAN_STATUS = Object.freeze(['Active', 'Inactive']);

/** UUID-ish fallback that works in old browsers / SSR. */
export function makePlanId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `plan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Normalise a raw plan object so downstream code can trust every field. */
export function normalisePlan(p) {
  if (!p || typeof p !== 'object') return null;
  const name = (p.name || '').toString().trim();
  if (!name) return null;
  const features = Array.isArray(p.features)
    ? p.features
        .map((f) =>
          typeof f === 'string'
            ? { label: f.trim(), included: true }
            : { label: (f?.label || '').toString().trim(), included: f?.included !== false },
        )
        .filter((f) => f.label)
    : [];
  return {
    id: p.id ?? makePlanId(),
    name,
    price:        Number.isFinite(Number(p.price))       ? Number(p.price)       : 0,
    yearlyPrice:  Number.isFinite(Number(p.yearlyPrice)) ? Number(p.yearlyPrice) : 0,
    users:        p.users ?? 0,
    status:       PLAN_STATUS.includes(p.status) ? p.status : 'Active',
    custom:       Boolean(p.custom),
    features,
    desc:         (p.desc || '').toString(),
    color:        (p.color || '#0284C7').toString(),
    createdAt:    p.createdAt || new Date().toISOString(),
    createdBy:    (p.createdBy || 'system').toString(),
  };
}

/** Load custom (user-created) plans only. */
export function loadCustomPlans() {
  const raw = safeGet(STORAGE_KEYS.SUBSCRIPTION_PLANS, []);
  if (!Array.isArray(raw)) return [];
  return raw.map(normalisePlan).filter(Boolean);
}

/**
 * Return defaults + custom plans merged by name.
 * Custom plans win so a Super Admin override takes precedence.
 */
export function getAllPlans() {
  const custom = loadCustomPlans();
  const customByName = new Map(custom.map((p) => [p.name, p]));
  const base = (DEFAULT_PLANS || []).map((p) =>
    normalisePlan({ ...p, custom: false }),
  ).filter(Boolean);

  const merged = base.map((p) => customByName.get(p.name) || p);
  /* Append customs whose names don't collide with a default. */
  for (const c of custom) {
    if (!base.some((b) => b.name === c.name)) merged.push(c);
  }
  return merged;
}

/** Only plans currently marked Active — used by the Change Plan dropdown. */
export function getActivePlans() {
  return getAllPlans().filter((p) => p.status === 'Active');
}
