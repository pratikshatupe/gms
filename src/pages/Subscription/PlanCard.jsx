import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import { Check, X, Star, Loader2 } from 'lucide-react';
import { pricingFor, formatPrice } from '../../utils/subscriptionPricing';

/**
 * PlanCard — currency-aware plan tile used in the tenant Subscription
 * page's plan grid. Pure presentational; the parent owns click handlers
 * and "current" detection.
 *
 * Props:
 *   plan       — normalised plan object from SUBSCRIPTION_PLANS
 *   currency   — 'INR' | 'USD' | 'SAR' | 'GBP' | 'EUR'
 *   billingCycle — 'monthly' | 'yearly'
 *   isCurrent  — boolean (renders the "Current Plan" badge)
 *   isFeatured — boolean (renders the "Most Popular" ribbon)
 *   onSelect   — () => void (Change Plan button handler)
 *   loading    — boolean (spinner on CTA)
 *   ctaLabel   — override CTA text (default depends on isCurrent)
 *   disabled   — boolean (read-only Manager view)
 */

const getTokens = (dark) => ({
  navy:   dark ? '#E2EAF4' : '#0C2340',
  card:   dark ? '#0F2236' : '#ffffff',
  text:   dark ? '#94A3B8' : '#475569',
  muted:  dark ? '#64748B' : '#94A3B8',
  border: dark ? '#142535' : '#E2E8F0',
  purple: '#0284C7', amber: '#D97706', green: '#059669', red: '#DC2626',
  font:   "'Outfit', 'Plus Jakarta Sans', sans-serif",
});

export default function PlanCard({
  plan,
  currency = '₹',
  billingCycle = 'monthly',
  isCurrent = false,
  isFeatured = false,
  onSelect,
  loading = false,
  ctaLabel,
  disabled = false,
}) {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const T = getTokens(dark);

  if (!plan) return null;

  const { monthly, annual, annualPerMonth } = pricingFor(plan, currency);
  const displayPrice = billingCycle === 'yearly' ? annualPerMonth : monthly;
  const annualTotal  = annual;

  const accent = plan.color || T.purple;
  const featureRows = (plan.features || []).slice(0, 8);

  const cta = ctaLabel || (isCurrent ? 'Current Plan' : 'Change Plan');
  const ctaDisabled = disabled || isCurrent || loading;

  return (
    <article
      style={{
        position: 'relative',
        background: T.card,
        border: `2px solid ${isCurrent ? accent : T.border}`,
        borderRadius: 16,
        padding: 22,
        boxShadow: isCurrent ? `0 8px 24px ${accent}26` : '0 1px 2px rgba(15,23,42,0.04)',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        fontFamily: T.font,
        width: '100%',
        minHeight: 460,
        transition: 'box-shadow 0.18s ease',
      }}>
      {isFeatured && !isCurrent && (
        <span style={{
          position: 'absolute', top: -12, right: 16,
          background: T.amber, color: '#fff',
          fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em',
          padding: '4px 10px', borderRadius: 20,
          display: 'inline-flex', alignItems: 'center', gap: 4,
          boxShadow: '0 2px 6px rgba(217,119,6,0.4)',
        }}>
          <Star size={10} aria-hidden="true" /> Most Popular
        </span>
      )}
      {isCurrent && (
        <span style={{
          position: 'absolute', top: -12, left: 16,
          background: accent, color: '#fff',
          fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em',
          padding: '4px 10px', borderRadius: 20,
          boxShadow: `0 2px 6px ${accent}66`,
        }}>
          Current Plan
        </span>
      )}

      {/* Header */}
      <header>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: accent }}>
          {plan.name}
        </h3>
        <p style={{ margin: '6px 0 0', fontSize: 12, color: T.muted, lineHeight: 1.5, minHeight: 36 }}>
          {plan.desc || 'Plan tier description.'}
        </p>
      </header>

      {/* Price */}
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 28, fontWeight: 900, color: T.navy }}>
            {formatPrice(displayPrice, currency)}
          </span>
          <span style={{ fontSize: 13, color: T.muted, fontWeight: 600 }}>/Month</span>
        </div>
        {billingCycle === 'yearly' && annualTotal > 0 && (
          <p style={{ margin: '4px 0 0', fontSize: 11, color: T.muted }}>
            Billed {formatPrice(annualTotal, currency)} yearly.
          </p>
        )}
      </div>

      {/* Limits row */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6,
        padding: '10px 0', borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}`,
      }}>
        <Limit label="Offices"  value={plan.offices}  />
        <Limit label="Users"    value={plan.users}    />
        <Limit label="Visitors" value={plan.visitors} />
      </div>

      {/* Features */}
      <ul style={{
        listStyle: 'none', margin: 0, padding: 0,
        display: 'flex', flexDirection: 'column', gap: 6, flex: 1,
      }}>
        {featureRows.map((f, i) => (
          <li key={`${f.label}-${i}`} style={{
            display: 'flex', alignItems: 'flex-start', gap: 8,
            fontSize: 12, fontWeight: 600,
            color: f.included ? T.text : T.muted,
            opacity: f.included ? 1 : 0.7,
          }}>
            <span style={{
              width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
              background: f.included ? `${T.green}20` : (dark ? '#0C1E2E' : '#F1F5F9'),
              color: f.included ? T.green : T.muted,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              marginTop: 1,
            }}>
              {f.included
                ? <Check size={11} strokeWidth={3} aria-hidden="true" />
                : <X size={10} strokeWidth={3} aria-hidden="true" />}
            </span>
            <span>{f.label}</span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <button
        type="button"
        onClick={onSelect}
        disabled={ctaDisabled}
        title={isCurrent ? 'You are on this plan' : disabled ? 'Plan changes require Director access' : `Switch to ${plan.name}`}
        style={{
          width: '100%', padding: '11px 14px', borderRadius: 10,
          fontSize: 13, fontWeight: 800, fontFamily: T.font,
          cursor: ctaDisabled ? 'not-allowed' : 'pointer',
          border: `1px solid ${isCurrent ? accent : accent}`,
          background: isCurrent ? T.card : accent,
          color: isCurrent ? accent : '#fff',
          opacity: ctaDisabled && !isCurrent ? 0.55 : 1,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          transition: 'all 0.15s ease',
        }}>
        {loading && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
        {cta}
      </button>
    </article>
  );
}

function Limit({ label, value }) {
  const { theme } = useTheme();
  const T = getTokens(theme === 'dark');
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: T.navy }}>
        {value === 'Unlimited' ? '∞' : (value ?? '—')}
      </div>
      <div style={{
        fontSize: 9, fontWeight: 700, color: T.muted,
        textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 2,
      }}>
        {label}
      </div>
    </div>
  );
}