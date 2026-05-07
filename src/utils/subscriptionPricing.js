/**
 * subscriptionPricing.js — currency, usage and invoice helpers (Module 9).
 *
 * SUBSCRIPTION_PLANS (mockData) is an INR base. We multiply at display
 * time so plan definitions stay single-currency. Customers see prices in
 * the org's currency (Module 8 sets `org.currency`).
 *
 * TODO (production finance) — replace hardcoded multipliers with live FX
 * rates via ExchangeRate API or fixed contract rates per customer. Target
 * the production finance integration phase.
 */

import { SUBSCRIPTION_PLANS } from '../data/mockData';

/* INR is the base. Mock multipliers — flag for production. */
export const FX_MULTIPLIERS = Object.freeze({
  INR: 1.0,
  INR: 22.0,
  SAR: 1.0,   /* pegged */
  GBP: 0.21,
  USD: 0.27,
  EUR: 0.25,
});

const SYMBOLS = Object.freeze({
  INR: '₹',
  INR: '\u20B9',  /* ₹ */
  SAR: 'SAR ',
  GBP: '\u00A3',  /* £ */
  USD: '$',
  EUR: '\u20AC',  /* € */
});

const LOCALE_FOR = Object.freeze({
  INR: 'en-IN',
  INR: 'en-IN',
  SAR: 'en-GB',
  GBP: 'en-GB',
  USD: 'en-US',
  EUR: 'en-GB',
});

/** Convert an INR base amount to the requested currency. */
export function convertFromAed(aedAmount, currency = 'INR') {
  const n = Number(aedAmount) || 0;
  const mult = FX_MULTIPLIERS[currency] ?? 1;
  return Math.round(n * mult);
}

/**
 * Format a numeric price for display.
 *
 *   formatPrice(4999, 'INR')  → "₹4,999"
 *   formatPrice(625, 'GBP')   → "£625"
 */
export function formatPrice(amount, currency = 'INR') {
  const n = Number(amount) || 0;
  const locale = LOCALE_FOR[currency] || 'en-IN';
  const symbol = SYMBOLS[currency] || `${currency} `;
  const formatted = n.toLocaleString(locale, { maximumFractionDigits: 0 });
  return `${symbol}${formatted}`;
}

/**
 * Resolve a single plan's pricing in the requested currency.
 */
export function pricingFor(plan, currency = 'INR') {
  if (!plan) return { monthly: 0, annual: 0, savingsPct: 0 };
  const monthlyAed = Number(plan.price) || 0;
  const yearlyMonthlyAed = Number(plan.yearlyPrice) || 0;
  const monthly = convertFromAed(monthlyAed, currency);
  const annualPerMonth = convertFromAed(yearlyMonthlyAed, currency);
  const annual = annualPerMonth * 12;
  const fullYear = monthly * 12;
  const savingsPct = fullYear > 0 && annual > 0 && annual < fullYear
    ? Math.round(((fullYear - annual) / fullYear) * 100)
    : 0;
  return { monthly, annual, annualPerMonth, savingsPct };
}

/**
 * Currency-aware payment-gateway routing — Module 9 Decision 4.
 *   INR → Razorpay
 *   INR / SAR → Telr
 *   GBP / USD / EUR → Stripe
 */
export function gatewayFor(currency = 'INR') {
  if (currency === 'INR') return 'Razorpay';
  if (currency === 'INR' || currency === 'SAR') return 'Telr';
  return 'Stripe';
}

/**
 * Walk the plan list looking for the next-up plan above `currentPlan`.
 * Used by over-limit warnings ("Upgrade to Professional").
 */
export function nextPlanUp(currentPlanName, plans = SUBSCRIPTION_PLANS) {
  const order = ['Starter', 'Professional', 'Enterprise'];
  const idx = order.indexOf(currentPlanName);
  if (idx < 0 || idx === order.length - 1) return null;
  const nextName = order[idx + 1];
  return plans.find((p) => p.name === nextName) || null;
}

/* ────────────────────────────────────────────────────────────────────
 *   Usage aggregation
 * ──────────────────────────────────────────────────────────────────── */

/** True when the appointment falls inside the current calendar month. */
function isInCurrentMonth(iso) {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

/**
 * Compute live usage for the given org. All inputs are already org-scoped
 * by the caller (TenantSubscription runs `byOrg` first).
 *
 * Returns:
 *   { staffCount, officesCount, appointmentsThisMonth, walkInsThisMonth,
 *     storageUsedMb, storageTotalMb }
 *
 * Storage is mocked — see the TODO comment.
 */
export function computeUsage({ appointments = [], staff = [], offices = [], storageQuotaMb = 5000 } = {}) {
  /* TODO (production storage) — replace mock storage formula with real
     file-size aggregation from actual uploads (visitor photos, logos,
     badge prints). Target when backend file storage ships. */
  const appsThisMonth = appointments.filter((a) => isInCurrentMonth(a?.scheduledDate || a?.date));
  return {
    staffCount:             staff.length,
    officesCount:           offices.length,
    appointmentsThisMonth:  appsThisMonth.length,
    walkInsThisMonth:       appsThisMonth.filter((a) => a?.isWalkIn).length,
    storageUsedMb:          Math.round((staff.length * 0.5 + appointments.length * 0.02) * 100) / 100,
    storageTotalMb:         storageQuotaMb,
  };
}

/**
 * Convert a plan limit field (which can be a number or "Unlimited" string)
 * into a numeric ceiling. Returns Infinity for unlimited tiers so percent
 * calculations safely return 0.
 */
export function planLimit(plan, key) {
  const v = plan?.[key];
  if (v === 'Unlimited' || v == null) return Infinity;
  const n = Number(v);
  return Number.isFinite(n) ? n : Infinity;
}

/**
 * Detect which limits a tenant has breached. Returns array of { key, used,
 * limit, label } for any metric where used > limit.
 */
export function findOverLimits(plan, usage) {
  const checks = [
    { key: 'users',    used: usage.staffCount,            label: 'Staff' },
    { key: 'offices',  used: usage.officesCount,          label: 'Offices' },
    { key: 'visitors', used: usage.appointmentsThisMonth, label: 'Appointments this month' },
  ];
  const out = [];
  for (const c of checks) {
    const limit = planLimit(plan, c.key);
    if (Number.isFinite(limit) && c.used > limit) {
      out.push({ key: c.key, used: c.used, limit, label: c.label });
    }
  }
  return out;
}

/* ────────────────────────────────────────────────────────────────────
 *   Invoice synthesis (Module 9 Decision 5)
 * ──────────────────────────────────────────────────────────────────── */

const DAY_MS = 24 * 60 * 60 * 1000;

function makeInvoiceId(orgId, dateMs) {
  const d = new Date(dateMs);
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const orgFrag = (orgId || 'ORG').replace(/[^A-Z0-9]/gi, '').slice(-4).toUpperCase() || 'ORG';
  return `INV-${stamp}-${orgFrag}`;
}

/**
 * Walk forward from `subscriptionStartedAt` in `billingCycle` increments
 * to today, emitting one Paid invoice per cycle plus one upcoming Due
 * invoice for the next cycle.
 *
 * In-memory only — never persisted. Re-derived on every render so a
 * currency or plan change updates the list immediately.
 */
export function synthesiseInvoices({ org, plan, currency = 'INR', now = Date.now() }) {
  if (!org || !plan) return [];
  const cycle = org.billingCycle === 'yearly' ? 'yearly' : 'monthly';
  const monthlyAed = Number(plan.price) || 0;
  const yearlyTotalAed = (Number(plan.yearlyPrice) || 0) * 12;
  const periodAed = cycle === 'yearly' ? yearlyTotalAed : monthlyAed;
  const periodAmount = convertFromAed(periodAed, currency);
  const incrementMs = (cycle === 'yearly' ? 365 : 30) * DAY_MS;

  const startMs = new Date(org.subscriptionStartedAt || org.startDate || (now - 6 * 30 * DAY_MS)).getTime();
  if (Number.isNaN(startMs)) return [];

  const invoices = [];
  let cursor = startMs;
  while (cursor <= now) {
    invoices.push({
      id:            makeInvoiceId(org.id, cursor),
      date:          new Date(cursor).toISOString(),
      plan:          plan.name,
      amount:        periodAmount,
      currency,
      status:        'Paid',
      paidAt:        new Date(cursor + DAY_MS).toISOString(),
      paymentMethod: 'Mock Gateway',
    });
    cursor += incrementMs;
  }

  /* One upcoming Due row at the next renewal date. */
  invoices.push({
    id:            makeInvoiceId(org.id, cursor),
    date:          new Date(cursor).toISOString(),
    plan:          plan.name,
    amount:        periodAmount,
    currency,
    status:        'Due',
    paidAt:        null,
    paymentMethod: null,
  });

  /* Newest first for display. */
  return invoices.reverse();
}

/* ────────────────────────────────────────────────────────────────────
 *   Mock payment helpers
 * ──────────────────────────────────────────────────────────────────── */

/** Generate a mock transaction id matching PAY-YYYYMMDD-HHMMSS-XXXX. */
export function makeTxnId(now = new Date()) {
  const d = now;
  const stamp =
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}` +
    `-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `PAY-${stamp}-${rand}`;
}

/** Format a count like 12 / 25 with optional Unlimited fallback. */
export function formatLimit(used, limit) {
  if (!Number.isFinite(limit)) return `${used} / Unlimited`;
  return `${used} / ${limit}`;
}
