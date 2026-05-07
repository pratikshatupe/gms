import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Loader2, X, AlertTriangle, CreditCard, ShieldCheck, Users } from 'lucide-react';
import {
  pricingFor, formatPrice, gatewayFor, planLimit, findOverLimits, makeTxnId,
} from '../../utils/subscriptionPricing';

/**
 * ChangePlanModal — switch plan flow (Module 9 Decision 10).
 *
 * Three modes:
 *   - Upgrade   → payment stub fires → plan updates immediately
 *   - Downgrade → overage check first; if no overages, schedule message,
 *                 plan still updates immediately for mock simplicity
 *   - Same plan, billing cycle change → no payment, just cycle update
 *
 * Hard-block downgrade with overages (Decision 7): renders a Cancel-only
 * modal with metric list + "View staff list" footer link.
 */

const T = {
  navy: '#0C2340', text: '#475569', muted: '#94A3B8', border: '#E2E8F0',
  purple: '#0284C7', amber: '#D97706', green: '#059669', red: '#DC2626',
  font: "'Outfit', 'Plus Jakarta Sans', sans-serif",
};

const PLAN_TIER = ['Starter', 'Professional', 'Enterprise'];

function classifyChange(currentPlan, nextPlan, currentCycle, nextCycle) {
  if (currentPlan === nextPlan) {
    return currentCycle === nextCycle ? 'noop' : 'cycle';
  }
  const i = PLAN_TIER.indexOf(currentPlan);
  const j = PLAN_TIER.indexOf(nextPlan);
  if (i < 0 || j < 0) return 'change';
  return j > i ? 'upgrade' : 'downgrade';
}

export default function ChangePlanModal({
  open,
  currentPlan,        /* normalised plan object */
  nextPlan,           /* normalised plan object the user picked */
  currentCycle = 'monthly',
  defaultCycle = 'monthly',
  currency = '₹',
  usage,              /* from computeUsage() — used for downgrade overage check */
  org,
  onClose,
  onConfirm,          /* ({ plan, cycle, kind, txnId, scheduledFor }) => void */
  onNavigateStaff,    /* () => void — invoked from the overage modal footer */
}) {
  const [cycle, setCycle]   = useState(defaultCycle);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) { setCycle(defaultCycle); setSaving(false); } }, [open, defaultCycle]);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape' && !saving) onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, saving, onClose]);

  const kind = useMemo(
    () => classifyChange(currentPlan?.name, nextPlan?.name, currentCycle, cycle),
    [currentPlan?.name, nextPlan?.name, currentCycle, cycle],
  );

  /* Module 9 Decision 7 — block downgrade if any usage exceeds the
     proposed plan's limits. Render a Cancel-only modal. */
  const overLimits = useMemo(() => {
    if (kind !== 'downgrade' || !nextPlan || !usage) return [];
    return findOverLimits(nextPlan, usage);
  }, [kind, nextPlan, usage]);

  if (!open || !nextPlan) return null;

  const currentPricing = currentPlan ? pricingFor(currentPlan, currency) : null;
  const nextPricing    = pricingFor(nextPlan, currency);
  const periodAmount   = cycle === 'yearly' ? nextPricing.annual : nextPricing.monthly;
  const gateway        = gatewayFor(currency);

  /* ── Downgrade-blocked branch ── */
  if (overLimits.length > 0) {
    return (
      <Backdrop onClose={onClose}>
        <div style={modalStyle({ width: 460 })}>
          <Header
            tone="red"
            title={`Cannot downgrade to ${nextPlan.name}`}
            subtitle="Your current usage exceeds this plan's limits."
            onClose={onClose}
          />
          <div style={{ padding: '18px 22px' }}>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: T.text, lineHeight: 1.55 }}>
              Please reduce your usage or select a higher plan before downgrading.
            </p>
            <ul style={{ margin: 0, padding: '0 0 0 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {overLimits.map((o) => (
                <li key={o.key} style={{ fontSize: 13, fontWeight: 700, color: T.red }}>
                  {o.label}: {o.used} / {o.limit}{' '}
                  <AlertTriangle size={12} aria-hidden="true" style={{ verticalAlign: '-2px' }} />
                </li>
              ))}
            </ul>
            {onNavigateStaff && (
              <button type="button" onClick={onNavigateStaff}
                style={{
                  marginTop: 14, background: 'none', border: 'none', padding: 0,
                  color: T.purple, fontWeight: 700, fontSize: 12,
                  cursor: 'pointer', textDecoration: 'underline', fontFamily: T.font,
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}>
                <Users size={12} aria-hidden="true" /> View staff list →
              </button>
            )}
          </div>
          <Footer>
            <button type="button" onClick={onClose} style={btn(T.muted, true)}>Cancel</button>
          </Footer>
        </div>
      </Backdrop>
    );
  }

  /* ── Standard upgrade / downgrade / cycle-change branch ── */

  const handleConfirm = async () => {
    if (saving || kind === 'noop') return;
    setSaving(true);
    await new Promise((r) => setTimeout(r, 800));

    const txnId = kind === 'upgrade' ? makeTxnId() : null;
    if (txnId) {
      // eslint-disable-next-line no-console
      console.log('[payment-stub]', {
        orgId:    org?.id,
        plan:     nextPlan.name,
        cycle,
        amount:   periodAmount,
        currency,
        gateway,
        txnId,
      });
    }

    /* Downgrade scheduling: tell the caller when it would take effect.
       For mock simplicity the caller flips org.plan immediately anyway. */
    let scheduledFor = null;
    if (kind === 'downgrade' && org?.endDate) {
      scheduledFor = org.endDate;
    }

    onConfirm?.({ plan: nextPlan, cycle, kind, txnId, scheduledFor });
    setSaving(false);
  };

  const ctaLabel = saving
    ? 'Processing…'
    : kind === 'upgrade'   ? `Pay ${formatPrice(periodAmount, currency)} & Upgrade`
    : kind === 'downgrade' ? 'Schedule Downgrade'
    : kind === 'cycle'     ? 'Update Billing Cycle'
    : 'Confirm';

  const tone = kind === 'downgrade' ? 'amber' : 'purple';

  return (
    <Backdrop onClose={onClose}>
      <div style={modalStyle({ width: 540 })}>
        <Header
          tone={tone}
          title={
            kind === 'upgrade'   ? `Upgrade to ${nextPlan.name}`
          : kind === 'downgrade' ? `Downgrade to ${nextPlan.name}`
          : kind === 'cycle'     ? `Switch to ${cycle === 'yearly' ? 'Annual' : 'Monthly'} billing`
          : `Change to ${nextPlan.name}`
          }
          subtitle={
            kind === 'upgrade'   ? 'New features unlock immediately. You will be charged the prorated difference.'
          : kind === 'downgrade' ? 'Downgrade takes effect at the end of your current billing cycle.'
          : kind === 'cycle'     ? 'Pricing updates from your next renewal.'
          : 'Plan switch.'
          }
          onClose={onClose}
        />

        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Comparison row */}
          {currentPlan && currentPlan.name !== nextPlan.name && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
              background: '#F8FAFC', border: `1px solid ${T.border}`, borderRadius: 12, padding: 14,
            }}>
              <Side label="Current" plan={currentPlan} pricing={currentPricing} cycle={currentCycle} currency={currency} />
              <ArrowRight size={20} aria-hidden="true" style={{ color: T.muted, flexShrink: 0 }} />
              <Side label="New" plan={nextPlan} pricing={nextPricing} cycle={cycle} currency={currency} />
            </div>
          )}

          {/* Cycle toggle */}
          <div>
            <div style={{
              fontSize: 11, fontWeight: 700, color: T.muted,
              textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6,
            }}>
              Billing Cycle
            </div>
            <div role="tablist" aria-label="Billing cycle"
              style={{ display: 'inline-flex', gap: 4, padding: 4, background: '#F1F5F9', borderRadius: 10 }}>
              {[
                { key: 'monthly', label: 'Monthly' },
                { key: 'yearly',  label: nextPricing.savingsPct ? `Annually (save ${nextPricing.savingsPct}%)` : 'Annually' },
              ].map((opt) => {
                const active = cycle === opt.key;
                return (
                  <button key={opt.key} type="button" role="tab" aria-selected={active}
                    onClick={() => setCycle(opt.key)}
                    style={{
                      padding: '7px 14px', borderRadius: 8,
                      fontSize: 12, fontWeight: 700, fontFamily: T.font,
                      cursor: 'pointer',
                      background: active ? T.purple : 'transparent',
                      color:      active ? '#fff'   : T.text,
                      border: 'none',
                    }}>
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Total */}
          <div style={{
            background: '#F0F9FF', border: `1px solid #BAE6FD`, borderRadius: 12, padding: 14,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                  {cycle === 'yearly' ? 'Billed annually' : 'Billed monthly'}
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color: T.navy, lineHeight: 1.1, marginTop: 4 }}>
                  {formatPrice(periodAmount, currency)}
                </div>
                {cycle === 'yearly' && (
                  <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
                    Equivalent to {formatPrice(nextPricing.annualPerMonth, currency)} per Month.
                  </div>
                )}
              </div>
              {kind === 'upgrade' && (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4,
                }}>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    fontSize: 10, fontWeight: 800, color: T.muted,
                    textTransform: 'uppercase', letterSpacing: '.06em',
                  }}>
                    <CreditCard size={11} aria-hidden="true" /> Powered by {gateway}
                  </div>
                  <div style={{
                    background: '#F1F5F9', color: T.muted,
                    fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 6,
                  }}>
                    [{gateway} Logo]
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Indicative-pricing banner */}
          <p style={{
            margin: 0, fontSize: 11, color: T.muted, lineHeight: 1.5,
            display: 'flex', gap: 6, alignItems: 'flex-start',
          }}>
            <ShieldCheck size={12} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
            Indicative pricing — actual invoice billed in your contracted currency at production rates.
          </p>

          {/* TODO — replace mock multiplier + payment stub with live FX rates +
              real Razorpay/Telr/Stripe SDK in production finance phase. */}
        </div>

        <Footer>
          <button type="button" onClick={onClose} disabled={saving} style={btn(T.muted, true, saving)}>
            Cancel
          </button>
          <button type="button" onClick={handleConfirm}
            disabled={saving || kind === 'noop'}
            style={{ ...btn(T.purple, false, saving || kind === 'noop'), display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {saving && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
            {ctaLabel}
          </button>
        </Footer>
      </div>
    </Backdrop>
  );
}

/* ─── Sub-renderers ──────────────────────────────────────── */

function Side({ label, plan, pricing, cycle, currency }) {
  const v = cycle === 'yearly' ? pricing.annualPerMonth : pricing.monthly;
  return (
    <div style={{ minWidth: 0, flex: 1 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 800, color: T.navy, marginTop: 2 }}>{plan.name}</div>
      <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
        {formatPrice(v, currency)}/Month · {cycle === 'yearly' ? 'Annual' : 'Monthly'}
      </div>
    </div>
  );
}

/* ─── Layout helpers ──────────────────────────────────────── */

function Backdrop({ onClose, children }) {
  return (
    <div role="dialog" aria-modal="true"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9500,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, fontFamily: T.font,
      }}>
      {children}
    </div>
  );
}

function modalStyle({ width }) {
  return {
    width: '100%', maxWidth: width, background: '#fff',
    borderRadius: 14, boxShadow: '0 24px 60px rgba(15,23,42,0.35)',
    maxHeight: '92vh', overflowY: 'auto',
  };
}

function Header({ tone = 'purple', title, subtitle, onClose }) {
  const colours = {
    purple: 'linear-gradient(90deg, #0284C7, #0D9488)',
    amber:  'linear-gradient(90deg, #D97706, #B45309)',
    red:    'linear-gradient(90deg, #DC2626, #B91C1C)',
  };
  return (
    <header style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12,
      padding: '18px 22px', borderBottom: `1px solid ${T.border}`,
      background: colours[tone] || colours.purple, color: '#fff',
      borderRadius: '14px 14px 0 0',
    }}>
      <div>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{title}</h3>
        {subtitle && <p style={{ margin: '4px 0 0', fontSize: 12, opacity: 0.9 }}>{subtitle}</p>}
      </div>
      <button type="button" onClick={onClose}
        aria-label="Close dialog" title="Close"
        style={{
          background: 'rgba(255,255,255,0.18)', border: 'none',
          width: 30, height: 30, borderRadius: 8, color: '#fff', cursor: 'pointer',
          flexShrink: 0,
        }}>
        <X size={14} aria-hidden="true" />
      </button>
    </header>
  );
}

function Footer({ children }) {
  return (
    <footer style={{
      display: 'flex', justifyContent: 'flex-end', gap: 10,
      padding: '14px 22px', borderTop: `1px solid ${T.border}`, background: '#F8FAFC',
      borderRadius: '0 0 14px 14px',
    }}>{children}</footer>
  );
}

function btn(color = T.purple, outline = false, disabled = false) {
  return {
    padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: T.font,
    border: `1px solid ${color}`,
    background: outline ? '#fff' : color, color: outline ? color : '#fff',
    opacity: disabled ? 0.55 : 1, transition: 'all .15s ease',
  };
}
