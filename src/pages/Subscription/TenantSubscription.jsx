import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Sparkles, CreditCard, Settings as SettingsIcon, Download, AlertTriangle,
  CheckCircle2, Clock, X, Receipt, ChevronLeft, ChevronRight, Loader2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useRole } from '../../context/RoleContext';
import { useCollection, STORAGE_KEYS, useOrgSettings } from '../../store';
import {
  MOCK_ORGANIZATIONS, MOCK_APPOINTMENTS, MOCK_STAFF, MOCK_OFFICES, SUBSCRIPTION_PLANS,
} from '../../data/mockData';
import { Toast } from '../../components/ui';
import { useTheme } from '../../context/ThemeContext';
import { addAuditLog } from '../../utils/auditLogger';
import { useNotificationTriggers } from '../../utils/notificationTriggers';
import { byOrg } from '../../utils/appointmentState';
import {
  pricingFor, formatPrice, computeUsage, findOverLimits, gatewayFor, makeTxnId,
} from '../../utils/subscriptionPricing';
import { markReferralConverted } from '../../api/referralsApi';
import { apiFetch, getAccessToken } from '../../api/http';
import PlanCard from './PlanCard';
import UsageMeters from './UsageMeters';
import ChangePlanModal from './ChangePlanModal';
import CancelSubscriptionModal from './CancelSubscriptionModal';

/* Demo/staff localStorage roles bypass the backend API and read the org
 * from MOCK_ORGANIZATIONS as before. Real backend-authenticated users
 * (Director, Manager, SuperAdmin etc.) hit GET /subscriptions/my. */
const LOCAL_ONLY_ROLES = new Set(['demo', 'staff']);

/** Map a Subscription document from the backend into the org-shaped
 *  object the existing TenantSubscription render path expects. Keeps
 *  the rest of the component unchanged. */
function subscriptionToOrg(sub, user) {
  if (!sub) return null;
  const rawOrg = sub.organisationId;
  const orgId = (rawOrg && typeof rawOrg === 'object')
    ? (rawOrg._id || rawOrg.id || '')
    : (rawOrg || user?.organisationId || user?.orgId || '');

  const apiStatus = String(sub.status || '').toLowerCase();
  const status =
    apiStatus === 'trial'     ? 'Trial' :
    apiStatus === 'cancelled' ? 'Cancelled' :
    apiStatus === 'past_due'  ? 'Past Due' :
                                'Active';

  return {
    id:                    String(orgId || ''),
    name:                  user?.organisationName || user?.organizationName || (rawOrg && typeof rawOrg === 'object' ? rawOrg.name : '') || '',
    location:              user?.organisationLocation || '',
    plan:                  sub.planName || 'Starter',
    billingCycle:          sub.billingCycle === 'yearly' ? 'yearly' : 'monthly',
    status,
    currency:              sub.currency || 'INR',
    startDate:             sub.startDate || null,
    subscriptionStartedAt: sub.startDate || null,
    endDate:               sub.endDate || null,
    autoRenew:             sub.autoRenew !== false,
    trialEndsAt:           status === 'Trial' ? sub.endDate : null,
    mrr:                   sub.billingCycle === 'yearly'
                             ? Math.round((Number(sub.amount) || 0) / 12)
                             : (Number(sub.amount) || 0),
    subscriptionTier:      sub.planName || 'Starter',
  };
}

/**
 * TenantSubscription — Director / Manager view of the org's own
 * subscription. SuperAdmin never reaches here (short-circuit in
 * pages/Subscription/index.jsx).
 *
 * Sections (top → bottom):
 *   1. Sticky trial-expiry banner  (only when org.status === 'Trial')
 *   2. Trial Status card           (only when on trial)
 *   3. Current Plan summary        (with monthly/annual cycle controls + cancel)
 *   4. Plan grid                   (Starter / Professional / Enterprise)
 *   5. Usage meters                (Staff / Offices / Appointments / Storage)
 *   6. Invoice history             (paginated 10/20/50 per page)
 */


const DAY_MS = 24 * 60 * 60 * 1000;

/** Synthesise invoice history inline so we don't import the helper —
 *  keeps this file self-contained and the helper free to evolve. */
function makeInvoices(org, plan, currency, now = Date.now()) {
  if (!org || !plan) return [];
  const cycle = org.billingCycle === 'yearly' ? 'yearly' : 'monthly';
  const { monthly, annual } = pricingFor(plan, currency);
  const periodAmount = cycle === 'yearly' ? annual : monthly;
  const incrementMs = (cycle === 'yearly' ? 365 : 30) * DAY_MS;
  const startMs = new Date(org.subscriptionStartedAt || org.startDate || (now - 6 * 30 * DAY_MS)).getTime();
  if (Number.isNaN(startMs)) return [];

  const stamp = (d) => {
    const dt = new Date(d);
    return `${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, '0')}${String(dt.getDate()).padStart(2, '0')}`;
  };
  const orgFrag = (org.id || 'ORG').replace(/[^A-Z0-9]/gi, '').slice(-4).toUpperCase() || 'ORG';

  const out = [];
  let cursor = startMs;
  while (cursor <= now) {
    out.push({
      id:           `INV-${stamp(cursor)}-${orgFrag}`,
      date:         new Date(cursor).toISOString(),
      plan:         plan.name,
      amount:       periodAmount,
      currency,
      status:       'Paid',
      paidAt:       new Date(cursor + DAY_MS).toISOString(),
    });
    cursor += incrementMs;
  }
  out.push({
    id:     `INV-${stamp(cursor)}-${orgFrag}`,
    date:   new Date(cursor).toISOString(),
    plan:   plan.name,
    amount: periodAmount,
    currency,
    status: 'Due',
  });
  return out.reverse();
}

export default function TenantSubscription({ setActivePage }) {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const T = {
    bg:     dark ? '#0A1828' : '#F0F9FF',
    card:   dark ? '#0F2236' : '#ffffff',
    border: dark ? '#142535' : '#E2E8F0',
    navy:   dark ? '#E2EAF4' : '#0C2340',
    text:   dark ? '#94A3B8' : '#475569',
    muted:  dark ? '#64748B' : '#94A3B8',
    purple: '#0284C7',
    amber:  '#D97706',
    green:  '#059669',
    red:    '#DC2626',
    font:   "'Outfit', 'Plus Jakarta Sans', sans-serif",
  };
  const card = (extra = {}) => ({
    background: T.card, border: `1px solid ${T.border}`, borderRadius: 14,
    boxShadow: '0 1px 2px rgba(15,23,42,0.04)', padding: 22, ...extra,
  });
  const btn = (color = T.purple, outline = false, disabled = false) => ({
    padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: T.font,
    border: `1px solid ${color}`,
    background: outline ? T.card : color, color: outline ? color : '#fff',
    opacity: disabled ? 0.5 : 1, transition: 'all .15s ease',
  });

  const { user } = useAuth();
  const { hasPermission } = useRole();
  const { fireSystemAlert } = useNotificationTriggers();
  const canEdit = hasPermission('subscription', 'edit');

  const [orgsAll,     , patchOrg] = useCollection(STORAGE_KEYS.ORGANIZATIONS, MOCK_ORGANIZATIONS);
  const [appointments]            = useCollection(STORAGE_KEYS.APPOINTMENTS,  MOCK_APPOINTMENTS);
  const [staffAll]                = useCollection(STORAGE_KEYS.STAFF,         MOCK_STAFF);
  const [officesAll]              = useCollection(STORAGE_KEYS.OFFICES,       MOCK_OFFICES);
  const [customPlans]             = useCollection(STORAGE_KEYS.SUBSCRIPTION_PLANS, []);
  const [allSubscriptions]        = useCollection(STORAGE_KEYS.SUBSCRIPTIONS, []);

  const orgId = user?.organisationId || user?.orgId;

  /* Decide which path resolves the current org's subscription:
   *   - Demo / staff localStorage users keep the legacy MOCK_ORGANIZATIONS
   *     lookup so the offline demo flow continues to work.
   *   - Backend-authenticated users (anyone with a JWT in
   *     cgms_access_token) fetch GET /api/v1/subscriptions/my, which is
   *     authorised for SuperAdmin and Director server-side. */
  const userRoleKey = String(user?.role || '').toLowerCase();
  const hasBackendToken = typeof window !== 'undefined' && Boolean(getAccessToken());
  const useBackendApi = hasBackendToken && !LOCAL_ONLY_ROLES.has(userRoleKey);

  const [apiSub,     setApiSub]     = useState(null);
  const [apiLoading, setApiLoading] = useState(useBackendApi);
  const [apiError,   setApiError]   = useState(null);
  const [reloadKey,  setReloadKey]  = useState(0);
  const triggerReload = useCallback(() => {
    setApiError(null);
    setApiLoading(true);
    setReloadKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!useBackendApi) {
      setApiSub(null);
      setApiLoading(false);
      setApiError(null);
      return;
    }

    let cancelled = false;
    setApiLoading(true);
    setApiError(null);

    apiFetch('/subscriptions/my')
      .then(async (res) => {
        const text = await res.text();
        let body = null;
        try { body = text ? JSON.parse(text) : null; } catch { body = null; }
        if (cancelled) return;
        if (res.status === 404) {
          setApiSub(null);
          return;
        }
        if (!res.ok) {
          const msg = body?.message || body?.error?.message || `Request failed (${res.status}).`;
          throw new Error(msg);
        }
        const sub = body?.data ?? body ?? null;
        setApiSub(sub && typeof sub === 'object' ? sub : null);
      })
      .catch((err) => {
        if (cancelled) return;
        setApiSub(null);
        setApiError(err?.message || 'Failed to load subscription.');
      })
      .finally(() => {
        if (!cancelled) setApiLoading(false);
      });

    return () => { cancelled = true; };
  }, [useBackendApi, reloadKey]);

  const apiOrg = useMemo(() => subscriptionToOrg(apiSub, user), [apiSub, user]);
  const localOrg = useMemo(
    () => (orgsAll || []).find((o) => o?.id === orgId) || null,
    [orgsAll, orgId],
  );
  const org = useBackendApi ? apiOrg : localOrg;
  const { settings: orgSettings } = useOrgSettings(user, { org });
  const currency = orgSettings?.currency || org?.currency || 'INR';

  /* Per-user UI preference for cycle display (Decision 9). */
  const initialCycle = (() => {
    const saved = (typeof window !== 'undefined') && localStorage.getItem('cgms.subscriptionViewCycle');
    if (saved === 'yearly' || saved === 'monthly') return saved;
    return org?.billingCycle === 'yearly' ? 'yearly' : 'monthly';
  })();
  const [viewCycle, setViewCycle] = useState(initialCycle);
  useEffect(() => {
    try { localStorage.setItem('cgms.subscriptionViewCycle', viewCycle); } catch { /* no-op */ }
  }, [viewCycle]);

  /* Merge default plans with SA-created custom plans (read-only here). */
  const mergedPlans = useMemo(() => {
    const customByName = new Map((customPlans || []).map((p) => [p.name, p]));
    return SUBSCRIPTION_PLANS.map((p) => customByName.get(p.name) || p);
  }, [customPlans]);

  const currentPlan = useMemo(
    () => mergedPlans.find((p) => p.name === org?.plan) || mergedPlans.find((p) => p.name === 'Professional'),
    [mergedPlans, org?.plan],
  );

  /* Org-scoped usage. */
  const usage = useMemo(() => computeUsage({
    appointments: byOrg(appointments, user),
    staff:        byOrg(staffAll,     user),
    offices:      byOrg(officesAll,   user),
  }), [appointments, staffAll, officesAll, user]);

  /* Trial tracking. */
  const isTrial = String(org?.status || '').toLowerCase() === 'trial';
  const trialDaysLeft = useMemo(() => {
    if (!isTrial) return null;
    const ts = org?.trialEndsAt ? new Date(org.trialEndsAt).getTime() : null;
    if (!ts || Number.isNaN(ts)) return Number(org?.trialDaysLeft) || null;
    return Math.max(0, Math.ceil((ts - Date.now()) / DAY_MS));
  }, [isTrial, org?.trialEndsAt, org?.trialDaysLeft]);

  const [trialBannerDismissed, setTrialBannerDismissed] = useState(false);

  /* Modals + toasts. */
  const [changeTarget, setChangeTarget] = useState(null);  /* nextPlan object */
  const [showCancel,   setShowCancel]   = useState(false);
  const [toast, setToast] = useState(null);
  const showToast = (msg, type = 'success') => setToast({ msg, type });

  /* Invoice pagination. We also pull receipts saved during the
     Create-Organisation Pay Now step so the very first payment shows up
     immediately in the payment history below. */
  const invoices = useMemo(() => {
    const synthesised = makeInvoices(org, currentPlan, currency);
    const orgSubs = (allSubscriptions || []).filter((s) => s.organisationId === org?.id);
    const realPayments = [];
    for (const s of orgSubs) {
      for (const p of s.payments || []) {
        realPayments.push({
          id:           p.transactionId || p.id || `RCPT-${s.id}-${realPayments.length + 1}`,
          date:         p.paidAt || s.startDate,
          plan:         s.planName || currentPlan?.name || '',
          amount:       Number(p.amount) || 0,
          currency:     p.currency || s.currency || currency,
          status:       p.status === 'SUCCESS' ? 'Paid' : (p.status || 'Paid'),
          paidAt:       p.paidAt,
          paymentMethod: p.paymentMethod,
        });
      }
    }
    /* Real receipts first (newest), then synthesised history (filling
       the timeline back). De-dupe by id. */
    const merged = [...realPayments, ...synthesised];
    const seen = new Set();
    return merged
      .filter((inv) => {
        if (seen.has(inv.id)) return false;
        seen.add(inv.id);
        return true;
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [org, currentPlan, currency, allSubscriptions]);
  const [page, setPage]       = useState(1);
  const [perPage, setPerPage] = useState(10);
  const totalPages = Math.max(1, Math.ceil(invoices.length / perPage));
  const pagedInvoices = useMemo(() => {
    const start = (page - 1) * perPage;
    return invoices.slice(start, start + perPage);
  }, [invoices, page, perPage]);

  /* Fire SUBSCRIPTION_OVER_LIMIT audit on first render when over limits. */
  const overLimits = useMemo(
    () => findOverLimits(currentPlan, usage),
    [currentPlan, usage],
  );
  const overFiredRef = React.useRef(false);
  useEffect(() => {
    if (overLimits.length === 0 || overFiredRef.current) return;
    overFiredRef.current = true;
    addAuditLog({
      userName:    user?.name || 'Unknown',
      role:        (user?.role || '').toLowerCase(),
      action:      'SUBSCRIPTION_OVER_LIMIT',
      module:      'Subscription',
      description: `Over-limit on ${overLimits.map((o) => `${o.label} (${o.used}/${o.limit})`).join(', ')}.`,
      orgId,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overLimits.length]);

  if (useBackendApi && apiLoading) {
    return (
      <div style={{ padding: 28, background: T.bg, minHeight: '100vh', fontFamily: T.font }}>
        <div style={{
          ...card({ textAlign: 'center', padding: 40 }),
          color: T.text,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
        }}>
          <Loader2 size={28} aria-hidden="true" style={{ color: T.purple, animation: 'spin 1s linear infinite' }} />
          <div style={{ fontSize: 13, fontWeight: 600 }}>Loading your subscription…</div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (useBackendApi && apiError) {
    return (
      <div style={{ padding: 28, background: T.bg, minHeight: '100vh', fontFamily: T.font }}>
        <div style={{
          ...card({ textAlign: 'center', padding: 40 }),
          color: T.text,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
        }}>
          <AlertTriangle size={28} aria-hidden="true" style={{ color: T.red }} />
          <div style={{ fontSize: 14, fontWeight: 700, color: T.navy }}>Couldn’t load subscription</div>
          <div style={{ fontSize: 12, color: T.muted, maxWidth: 420 }}>{apiError}</div>
          <button type="button" onClick={triggerReload} style={btn(T.purple)}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!org) {
    return (
      <div style={{ padding: 28, background: T.bg, minHeight: '100vh', fontFamily: T.font }}>
        <div style={{ ...card({ textAlign: 'center', padding: 40 }), color: T.muted }}>
          Subscription requires a logged-in tenant user with an active organisation.
        </div>
      </div>
    );
  }

  const handlePlanCardSelect = (plan) => {
    if (!canEdit) {
      showToast('Plan changes require Director access.', 'info');
      return;
    }
    setChangeTarget(plan);
  };

  const handleConfirmChange = ({ plan, cycle, kind, txnId, scheduledFor }) => {
    const oldPlan = org.plan;
    const oldCycle = org.billingCycle;

    /* Stamp on the org record. Even for downgrades we update immediately
       per Decision 10's mock-simplicity note; a production system would
       defer until the cycle ends. */
    patchOrg(org.id, {
      ...org,
      plan: plan.name,
      billingCycle: cycle,
      mrr: pricingFor(plan, 'INR').monthly, /* keep MRR field in INR for SA dashboard */
      subscriptionTier: plan.name,
    });

    /* Audit. */
    if (oldCycle !== cycle) {
      addAuditLog({
        userName:    user?.name || 'Unknown',
        role:        (user?.role || '').toLowerCase(),
        action:      'SUBSCRIPTION_BILLING_CYCLE_CHANGED',
        module:      'Subscription',
        description: `Billing cycle changed from ${oldCycle || 'monthly'} to ${cycle}.`,
        orgId: org.id,
      });
    }
    if (oldPlan !== plan.name) {
      addAuditLog({
        userName:    user?.name || 'Unknown',
        role:        (user?.role || '').toLowerCase(),
        action:      'SUBSCRIPTION_PLAN_CHANGED',
        module:      'Subscription',
        description: `Plan changed from ${oldPlan || '—'} to ${plan.name} (${cycle}).${scheduledFor ? ` Scheduled for ${new Date(scheduledFor).toLocaleDateString('en-IN')}.` : ''}`,
        orgId: org.id,
      });
    }
    if (txnId) {
      addAuditLog({
        userName:    user?.name || 'Unknown',
        role:        (user?.role || '').toLowerCase(),
        action:      'PAYMENT_PROCESSED_STUB',
        module:      'Subscription',
        description: `${gatewayFor(currency)} stub payment ${txnId} for ${plan.name} (${cycle}).`,
        orgId: org.id,
      });

      // Convert any pending referral attached to this user — fires only on a
      // real money-moving event (upgrade → txnId), so trial→paid flips count
      // but cycle changes / downgrades do not.
      if (user?.id) markReferralConverted(user.id);
    }

    /* Module 7 — broadcast a system alert so the org Notifications tab
       picks up the change. fireSystemAlert respects user prefs +
       quiet hours from Module 8. */
    fireSystemAlert({
      title:  kind === 'upgrade' ? `Plan upgraded to ${plan.name}` : kind === 'downgrade' ? `Plan downgrade scheduled to ${plan.name}` : `Plan switched to ${plan.name}`,
      detail: `Billing cycle: ${cycle === 'yearly' ? 'Annual' : 'Monthly'}. Actor: ${user?.name || 'Unknown'}.`,
      org,
      link:   { page: 'subscription' },
    });

    setChangeTarget(null);

    /* Razorpay upgrade verified server-side — pull the fresh
     * Subscription doc from the backend so the page reflects the
     * authoritative plan, period, and payment ledger. Demo / staff
     * sessions (no backend token) skip this; their state was already
     * patched into MOCK_ORGANIZATIONS above. */
    if (kind === 'upgrade' && txnId && useBackendApi) {
      triggerReload();
    }

    if (kind === 'upgrade') {
      showToast(`Payment of ${formatPrice(cycle === 'yearly' ? pricingFor(plan, currency).annual : pricingFor(plan, currency).monthly, currency)} processed via ${gatewayFor(currency)}. Confirmation email sent.`, 'success');
    } else if (kind === 'downgrade') {
      showToast(`Downgrade to ${plan.name} scheduled for ${scheduledFor ? new Date(scheduledFor).toLocaleDateString('en-IN') : 'end of cycle'}.`, 'success');
    } else if (kind === 'cycle') {
      showToast(`Billing cycle updated to ${cycle === 'yearly' ? 'Annual' : 'Monthly'}.`, 'success');
    } else {
      showToast('Plan updated successfully.', 'success');
    }
  };

  const handleCancelConfirm = ({ reason, immediate, scheduledFor }) => {
    patchOrg(org.id, {
      ...org,
      status:             immediate ? 'Cancelled' : org.status,
      autoRenew:          false,
      cancellationReason: reason,
      cancelledAt:        new Date().toISOString(),
      cancellationScheduledFor: scheduledFor,
    });
    addAuditLog({
      userName:    user?.name || 'Unknown',
      role:        (user?.role || '').toLowerCase(),
      action:      'SUBSCRIPTION_CANCELLED',
      module:      'Subscription',
      description: `Cancelled subscription. Effective: ${immediate ? 'immediately' : `end of cycle (${scheduledFor ? new Date(scheduledFor).toLocaleDateString('en-IN') : '—'})`}. Reason: ${reason.slice(0, 140)}.`,
      orgId: org.id,
    });
    fireSystemAlert({
      title: 'Subscription cancelled',
      detail: `${user?.name || 'A team member'} cancelled the ${org.plan} plan. Effective ${immediate ? 'immediately' : 'end of cycle'}.`,
      org,
      link: { page: 'subscription' },
    });
    setShowCancel(false);
    showToast(immediate ? 'Subscription cancelled.' : 'Cancellation scheduled successfully.', 'success');
  };

  // Bug 17 fix: actually trigger a file download instead of stub.
  // Generates a printable HTML invoice and saves as .html (browser-friendly).
  const handleDownloadInvoice = (invoice) => {
    try {
      const safe = (v) => String(v ?? '').replace(/[<>]/g, '');
      const dateStr = new Date(invoice.date || Date.now()).toLocaleDateString();
      const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Invoice ${safe(invoice.id)}</title>
<style>
body{font-family:Arial,sans-serif;color:#0f172a;padding:32px;max-width:720px;margin:0 auto;background:#fff}
h1{color:#5a4bd1;margin:0 0 4px}
.muted{color:#64748b;font-size:13px}
table{width:100%;border-collapse:collapse;margin-top:24px}
th,td{padding:10px 8px;border-bottom:1px solid #e2e8f0;text-align:left;font-size:13px}
th{background:#f4f7fc;color:#475569;font-size:11px;text-transform:uppercase;letter-spacing:.06em}
.totals{margin-top:24px;padding:16px;background:#f4f7fc;border-radius:8px}
.totals .row{display:flex;justify-content:space-between;font-size:14px;padding:4px 0}
.totals .row.grand{font-weight:800;font-size:16px;color:#5a4bd1;border-top:1px solid #e2e8f0;margin-top:8px;padding-top:10px}
</style></head><body>
<h1>CorpGMS Invoice</h1>
<p class="muted">Invoice ${safe(invoice.id)} · ${safe(dateStr)}</p>
<p><strong>${safe(org?.name || '')}</strong><br/>${safe(org?.location || '')}</p>
<table>
  <thead><tr><th>Description</th><th>Plan</th><th style="text-align:right">Amount</th></tr></thead>
  <tbody>
    <tr><td>Subscription · ${safe(invoice.plan || currentPlan?.name || '')}</td><td>${safe(invoice.plan || '')}</td><td style="text-align:right">${formatPrice(invoice.amount, invoice.currency)}</td></tr>
  </tbody>
</table>
<div class="totals">
  <div class="row"><span>Status</span><span>${safe(invoice.status || 'Paid')}</span></div>
  <div class="row grand"><span>Total</span><span>${formatPrice(invoice.amount, invoice.currency)}</span></div>
</div>
<p class="muted" style="margin-top:32px">Thank you for using CorpGMS.</p>
</body></html>`;

      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${invoice.id}.html`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);

      addAuditLog({
        userName:    user?.name || 'Unknown',
        role:        (user?.role || '').toLowerCase(),
        action:      'INVOICE_DOWNLOADED',
        module:      'Subscription',
        description: `Downloaded invoice ${invoice.id} (${formatPrice(invoice.amount, invoice.currency)}).`,
        orgId: org.id,
      });
      showToast(`Invoice ${invoice.id} downloaded.`, 'success');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Invoice download failed', err);
      showToast('Failed to download invoice. Please try again.', 'error');
    }
  };

  const handleNavigateStaff = () => {
    setChangeTarget(null);
    setActivePage?.('staff');
  };

  const goToProfileTab = () => {
    if (typeof window !== 'undefined') {
      try {
        const url = new URL(window.location.href);
        url.pathname = '/settings';
        url.searchParams.set('tab', 'profile');
        window.history.pushState({}, '', url);
      } catch { /* no-op */ }
    }
    setActivePage?.('settings');
  };

  return (
    <div style={{ padding: 28, background: T.bg, minHeight: '100vh', fontFamily: T.font }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

        {/* Header */}
        <header>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: T.navy }}>Subscription</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: T.muted }}>
            Manage your plan, monitor usage, and review invoice history.
          </p>
        </header>

        {/* Sticky trial-expiry banner */}
        {isTrial && trialDaysLeft != null && !trialBannerDismissed && (
          <div role="status" style={{
            display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap',
            background: dark ? '#451A03' : '#FFFBEB', border: `1px solid #FDE68A`,
            color: T.amber, padding: '10px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={14} aria-hidden="true" />
              Your trial ends on {org.trialEndsAt ? new Date(org.trialEndsAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'soon'}. Upgrade now to keep all features.
            </div>
            <button type="button" onClick={() => setTrialBannerDismissed(true)} aria-label="Dismiss banner" title="Dismiss"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.amber }}>
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Trial Status card */}
        {isTrial && (
          <section style={{
            ...card({ padding: 22, background: 'linear-gradient(135deg, #0284C7 0%, #0D9488 100%)', color: '#fff', border: 'none' }),
            display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 10px', borderRadius: 20, background: 'rgba(255,255,255,0.18)', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                  <Sparkles size={11} aria-hidden="true" /> Free Trial
                </div>
                <h2 style={{ margin: '10px 0 0', fontSize: 22, fontWeight: 900 }}>
                  {trialDaysLeft} {trialDaysLeft === 1 ? 'day' : 'days'} remaining
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: 13, opacity: 0.9, maxWidth: 540 }}>
                  Pick a plan now and your team keeps every feature without interruption.
                </p>
              </div>
              <button type="button" onClick={() => canEdit && setChangeTarget(mergedPlans.find((p) => p.name === 'Professional'))}
                disabled={!canEdit}
                style={{
                  padding: '11px 22px', borderRadius: 10, fontSize: 13, fontWeight: 800,
                  background: T.card, color: T.purple, border: 'none',
                  cursor: canEdit ? 'pointer' : 'not-allowed', opacity: canEdit ? 1 : 0.55,
                }}>
                Upgrade Now
              </button>
            </div>
          </section>
        )}

        {/* Manager read-only banner */}
        {!canEdit && (
          <div role="status" style={{
            background: dark ? '#451A03' : '#FFFBEB', border: `1px solid #FDE68A`, color: T.amber,
            padding: '10px 14px', borderRadius: 10, fontSize: 12, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <AlertTriangle size={14} aria-hidden="true" />
            You can view subscription details. Plan changes are restricted to Directors.
          </div>
        )}

        {/* Current Plan summary */}
        <section style={card()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', minWidth: 0 }}>
              <span style={{
                width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                background: `${T.purple}18`, color: T.purple,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <CreditCard size={20} aria-hidden="true" />
              </span>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                  Current Plan
                </div>
                <h2 style={{ margin: '2px 0 0', fontSize: 18, fontWeight: 800, color: T.navy }}>
                  {currentPlan?.name || '—'} · {(org.billingCycle === 'yearly' ? 'Annual' : 'Monthly')}
                </h2>
                {currentPlan && (
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: T.text }}>
                    {formatPrice(org.billingCycle === 'yearly' ? pricingFor(currentPlan, currency).annualPerMonth : pricingFor(currentPlan, currency).monthly, currency)}
                    /Month · Renews on {org.endDate ? new Date(org.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                  </p>
                )}
                <p style={{ margin: '6px 0 0', fontSize: 11, color: T.muted, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  Pricing displayed in {currency} based on your Organisation Profile.
                  <button type="button" onClick={goToProfileTab}
                    style={{ background: 'none', border: 'none', padding: 0, color: T.purple, fontWeight: 700, cursor: 'pointer', fontFamily: T.font, fontSize: 11, textDecoration: 'underline' }}>
                    Change in Settings <SettingsIcon size={10} aria-hidden="true" />
                  </button>
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => {
                  if (!canEdit) return;
                  /* Pick the next plan up the price ladder if available; otherwise
                     fall back to the Professional default. */
                  const sorted = [...mergedPlans].sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
                  const idx = sorted.findIndex((p) => p.name === currentPlan?.name);
                  const next = (idx >= 0 && idx < sorted.length - 1)
                    ? sorted[idx + 1]
                    : (mergedPlans.find((p) => p.name === 'Professional') || sorted[sorted.length - 1] || sorted[0]);
                  if (next) setChangeTarget(next);
                }}
                disabled={!canEdit || org.status === 'Cancelled'}
                style={btn(T.purple, false, !canEdit || org.status === 'Cancelled')}
                title="Upgrade to the next available plan">
                Upgrade Plan
              </button>
              <button type="button" onClick={() => setShowCancel(true)} disabled={!canEdit || org.status === 'Cancelled'}
                style={btn(T.red, true, !canEdit || org.status === 'Cancelled')}
                title="Cancel your subscription">
                Cancel Subscription
              </button>
            </div>
          </div>
        </section>

        {/* Plan grid + cycle toggle */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: T.navy }}>Plans</h2>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: T.muted }}>
                Indicative pricing — actual invoice billed in your contracted currency at production rates.
              </p>
            </div>
            <div role="tablist" aria-label="Billing cycle"
              style={{ display: 'inline-flex', gap: 4, padding: 4, background: T.card, border: `1px solid ${T.border}`, borderRadius: 10 }}>
              <CycleBtn label="Monthly" active={viewCycle === 'monthly'} onClick={() => setViewCycle('monthly')} />
              <CycleBtn
                label={`Annually${pricingFor(mergedPlans[1] || mergedPlans[0], currency).savingsPct ? ` (Save ${pricingFor(mergedPlans[1] || mergedPlans[0], currency).savingsPct}%)` : ''}`}
                active={viewCycle === 'yearly'}
                onClick={() => setViewCycle('yearly')}
              />
            </div>
          </header>

          <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {mergedPlans.map((p) => (
              <PlanCard key={p.name}
                plan={p}
                currency={currency}
                billingCycle={viewCycle}
                isCurrent={p.name === currentPlan?.name}
                isFeatured={p.featured}
                disabled={!canEdit}
                onSelect={() => handlePlanCardSelect(p)}
              />
            ))}
          </div>
        </section>

        {/* Usage meters */}
        <section style={card()}>
          <UsageMeters
            plan={currentPlan}
            usage={usage}
            onUpgrade={canEdit ? (nextName) => {
              const target = mergedPlans.find((p) => p.name === nextName);
              if (target) setChangeTarget(target);
            } : undefined}
          />
        </section>

        {/* Invoice history */}
        <section style={card()}>
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: T.navy, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Receipt size={16} aria-hidden="true" /> Invoice History
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: T.muted }}>
                {invoices.length} invoice{invoices.length === 1 ? '' : 's'} on file.
              </p>
            </div>
            <select value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
              style={{
                padding: '8px 10px', borderRadius: 10, border: `1px solid ${T.border}`,
                fontSize: 12, fontWeight: 600, background: T.card, color: T.navy, fontFamily: T.font,
              }}
              title="Rows per page">
              <option value={10}>10 per page</option>
              <option value={20}>20 per page</option>
              <option value={50}>50 per page</option>
            </select>
          </header>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 480, borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                  {['Invoice No.', 'Date', 'Plan', 'Amount', 'Method', 'Status', 'Actions'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 8px', fontSize: 10, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagedInvoices.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: T.muted }}>No invoices yet.</td></tr>
                )}
                {pagedInvoices.map((inv) => (
                  <tr key={inv.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td style={{ padding: '10px 8px', fontFamily: 'monospace', fontWeight: 700, color: T.navy, fontSize: 12 }}>{inv.id}</td>
                    <td style={{ padding: '10px 8px', color: T.text }}>
                      {new Date(inv.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td style={{ padding: '10px 8px', color: T.text }}>{inv.plan}</td>
                    <td style={{ padding: '10px 8px', fontWeight: 700, color: T.navy }}>{formatPrice(inv.amount, inv.currency)}</td>
                    <td style={{ padding: '10px 8px', color: T.text, fontSize: 11, fontWeight: 600 }}>
                      {inv.paymentMethod
                        ? (inv.paymentMethod === 'UPI' ? 'UPI'
                          : inv.paymentMethod === 'CARD' ? 'Card'
                          : inv.paymentMethod === 'NETBANKING' ? 'Net Banking'
                          : inv.paymentMethod)
                        : '—'}
                    </td>
                    <td style={{ padding: '10px 8px' }}>
                      <StatusPill status={inv.status} />
                    </td>
                    <td style={{ padding: '10px 8px' }}>
                      {inv.status === 'Paid' ? (
                        <button type="button" onClick={() => handleDownloadInvoice(inv)}
                          title="Download invoice"
                          style={{
                            padding: '5px 10px', borderRadius: 8,
                            border: `1px solid ${T.purple}`, background: T.card, color: T.purple,
                            fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: T.font,
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                          }}>
                          <Download size={11} aria-hidden="true" /> Download
                        </button>
                      ) : (
                        <span style={{ fontSize: 11, color: T.muted, fontStyle: 'italic' }}>Pending payment</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginTop: 12 }}>
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                style={pagBtnStyle(T, page === 1)} title="Previous page">
                <ChevronLeft size={14} aria-hidden="true" />
              </button>
              <span style={{ fontSize: 12, color: T.text, fontWeight: 600 }}>Page {page} of {totalPages}</span>
              <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                style={pagBtnStyle(T, page === totalPages)} title="Next page">
                <ChevronRight size={14} aria-hidden="true" />
              </button>
            </div>
          )}
        </section>
      </div>

      {/* Modals */}
      <ChangePlanModal
        open={Boolean(changeTarget)}
        currentPlan={currentPlan}
        nextPlan={changeTarget}
        currentCycle={org.billingCycle || 'monthly'}
        defaultCycle={viewCycle}
        currency={currency}
        usage={usage}
        org={org}
        onClose={() => setChangeTarget(null)}
        onConfirm={handleConfirmChange}
        onNavigateStaff={handleNavigateStaff}
      />

      <CancelSubscriptionModal
        open={showCancel}
        planName={currentPlan?.name}
        currentCycleEnd={org.endDate}
        onClose={() => setShowCancel(false)}
        onConfirm={handleCancelConfirm}
      />
    </div>
  );
}

function CycleBtn({ label, active, onClick }) {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const T = {
    purple: '#0284C7', text: dark ? '#94A3B8' : '#475569',
    font: "'Outfit', 'Plus Jakarta Sans', sans-serif",
  };
  return (
    <button type="button" onClick={onClick} role="tab" aria-selected={active}
      style={{
        padding: '7px 14px', borderRadius: 8,
        fontSize: 12, fontWeight: 700, fontFamily: T.font,
        cursor: 'pointer', whiteSpace: 'nowrap',
        background: active ? T.purple : 'transparent',
        color:      active ? '#fff'   : T.text,
        border: 'none',
      }}>
      {label}
    </button>
  );
}

function StatusPill({ status }) {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const T = { green: '#059669', amber: '#D97706' };
  const isPaid = status === 'Paid';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 9px', borderRadius: 20,
      border: `1px solid ${isPaid ? '#A7F3D0' : '#FDE68A'}`,
      background: isPaid ? (dark ? '#064E3B' : '#ECFDF5') : (dark ? '#78350F' : '#FFFBEB'),
      color: isPaid ? T.green : T.amber,
      fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em',
    }}>
      {isPaid ? <CheckCircle2 size={10} aria-hidden="true" /> : <Clock size={10} aria-hidden="true" />}
      {status}
    </span>
  );
}

function pagBtnStyle(T, disabled) {
  return {
    width: 32, height: 32, borderRadius: 8,
    border: `1px solid ${T.border}`, background: T.card,
    color: disabled ? T.muted : T.navy,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.55 : 1,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  };
}