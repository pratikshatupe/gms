import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import { Users, Building2, CalendarDays, HardDrive, AlertTriangle } from 'lucide-react';
import { planLimit, formatLimit, findOverLimits, nextPlanUp } from '../../utils/subscriptionPricing';

/**
 * UsageMeters — Module 9.
 *
 * Renders 4 progress bars (Staff / Offices / Appointments / Storage) +
 * an optional over-limit warning banner with an "Upgrade to {next}" CTA.
 *
 * Bar colour transitions:
 *   <70% → green   70-90% → amber   >90% or over limit → red
 */

const getTokens = (dark) => ({
  navy:   dark ? '#E2EAF4' : '#0C2340',
  card:   dark ? '#0F2236' : '#ffffff',
  text:   dark ? '#94A3B8' : '#475569',
  muted:  dark ? '#64748B' : '#94A3B8',
  border: dark ? '#142535' : '#E2E8F0',
  track:  dark ? '#1E3A50' : '#F1F5F9',
  purple: '#0284C7', amber: '#D97706', green: '#059669', red: '#DC2626',
  font:   "'Outfit', 'Plus Jakarta Sans', sans-serif",
});

function meterColour(T, pct) {
  if (pct >= 100) return T.red;
  if (pct >= 90) return T.red;
  if (pct >= 70) return T.amber;
  return T.green;
}

function Meter({ Icon, label, used, limit, suffix }) {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const T = getTokens(dark);
  const isInfinite = !Number.isFinite(limit);
  const pct = isInfinite ? 0 : Math.min(100, (used / Math.max(1, limit)) * 100);
  const colour = isInfinite ? T.green : meterColour(T, pct);
  const overLimit = !isInfinite && used > limit;

  return (
    <div style={{
      background: T.card,
      border: `1px solid ${T.border}`,
      borderRadius: 12,
      padding: 14,
      display: 'flex', flexDirection: 'column', gap: 8,
      fontFamily: T.font,
    }}
    title={`${used} of ${isInfinite ? 'Unlimited' : limit}${suffix ? ` ${suffix}` : ''} — ${isInfinite ? 'no cap' : Math.round(pct) + '% used'}`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
          background: `${colour}18`, color: colour,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {Icon && <Icon size={14} aria-hidden="true" />}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: T.muted,
            textTransform: 'uppercase', letterSpacing: '.06em',
          }}>
            {label}
          </div>
          <div style={{
            fontSize: 13, fontWeight: 800, color: overLimit ? T.red : T.navy,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {formatLimit(used, limit)}{suffix ? ` ${suffix}` : ''}
            {overLimit && (
              <AlertTriangle size={12} aria-hidden="true" style={{ color: T.red }} />
            )}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{
        height: 6, borderRadius: 3, background: T.track, overflow: 'hidden',
      }}>
        <div style={{
          width: isInfinite ? '0%' : `${pct}%`,
          height: '100%', background: colour, transition: 'width 0.25s ease, background 0.25s ease',
        }} />
      </div>
    </div>
  );
}

export default function UsageMeters({ plan, usage, onUpgrade }) {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const T = getTokens(dark);
  const overLimits = findOverLimits(plan, usage);
  const nextPlan   = nextPlanUp(plan?.name);
  const showWarning = overLimits.length > 0;

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 14, fontFamily: T.font }}>
      <header>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: T.navy }}>Usage</h2>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: T.muted }}>
          Live usage against your <strong style={{ color: T.navy }}>{plan?.name || '—'}</strong> plan limits.
        </p>
      </header>

      <div style={{
        display: 'grid', gap: 12,
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
      }}>
        <Meter Icon={Users}        label="Staff"                  used={usage.staffCount}            limit={planLimit(plan, 'users')} />
        <Meter Icon={Building2}    label="Offices"                used={usage.officesCount}          limit={planLimit(plan, 'offices')} />
        <Meter Icon={CalendarDays} label="Appointments this month" used={usage.appointmentsThisMonth} limit={planLimit(plan, 'visitors')} />
        <Meter Icon={HardDrive}    label="Storage"                used={usage.storageUsedMb}         limit={usage.storageTotalMb} suffix="MB" />
      </div>

      {showWarning && (
        <div role="alert" style={{
          background: dark ? '#450A0A' : '#FEF2F2', border: `1px solid #FCA5A5`,
          color: T.red, padding: '12px 14px', borderRadius: 12,
          display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap',
        }}>
          <AlertTriangle size={16} aria-hidden="true" style={{ marginTop: 2, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 800 }}>
              You have exceeded your {plan?.name} plan limits on {overLimits.map((o) => o.label.toLowerCase()).join(', ')}.
            </p>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 12, fontWeight: 600, color: T.text }}>
              {overLimits.map((o) => (
                <li key={o.key}>{o.label}: {o.used} / {o.limit}.</li>
              ))}
            </ul>
            {nextPlan && (
              <p style={{ margin: '8px 0 0', fontSize: 12, color: T.text }}>
                Upgrade to <strong style={{ color: T.purple }}>{nextPlan.name}</strong> to remove these limits.
              </p>
            )}
          </div>
          {nextPlan && onUpgrade && (
            <button
              type="button"
              onClick={() => onUpgrade(nextPlan.name)}
              style={{
                padding: '8px 14px', borderRadius: 10,
                fontSize: 12, fontWeight: 800, fontFamily: T.font,
                background: T.purple, color: '#fff', border: `1px solid ${T.purple}`,
                cursor: 'pointer', flexShrink: 0,
              }}
              title={`Upgrade to ${nextPlan.name}`}>
              Upgrade to {nextPlan.name}
            </button>
          )}
        </div>
      )}
    </section>
  );
}