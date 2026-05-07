import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';

/**
 * CancelSubscriptionModal — destructive cancellation flow (Module 9).
 *
 * Required reason text (5–500 chars). Optional "cancel at end of cycle"
 * radio (default true) so the team retains paid-for access. Audit-logged
 * via the parent `onConfirm({ reason, immediate, scheduledFor })`.
 */

const T = {
  navy: '#0C2340', text: '#475569', muted: '#94A3B8', border: '#E2E8F0',
  red: '#DC2626', amber: '#B45309',
  font: "'Outfit', 'Plus Jakarta Sans', sans-serif",
};

const REASON_PRESETS = [
  'Too expensive for our team size.',
  'Missing features we need.',
  'Switching to a different provider.',
  'Project paused / company restructuring.',
  'Other.',
];

export default function CancelSubscriptionModal({
  open, planName, currentCycleEnd, onClose, onConfirm,
}) {
  const [reason, setReason]       = useState('');
  const [preset, setPreset]       = useState('');
  const [timing, setTiming]       = useState('endOfCycle'); /* 'endOfCycle' | 'immediate' */
  const [error, setError]         = useState('');
  const [saving, setSaving]       = useState(false);
  const reasonRef                 = useRef(null);

  useEffect(() => {
    if (!open) return;
    setReason(''); setPreset(''); setTiming('endOfCycle');
    setError(''); setSaving(false);
    const t = window.setTimeout(() => reasonRef.current?.focus(), 30);
    return () => window.clearTimeout(t);
  }, [open]);

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

  if (!open) return null;

  const trimmed = reason.trim();
  const charCount = reason.length;

  const handlePreset = (val) => {
    setPreset(val);
    if (val !== 'Other.') setReason(val);
    else setReason('');
  };

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    if (saving) return;
    if (trimmed.length < 5) {
      setError('Cancellation Reason must be at least 5 characters.');
      return;
    }
    if (trimmed.length > 500) {
      setError('Cancellation Reason must be 500 characters or fewer.');
      return;
    }
    setError('');
    setSaving(true);
    await new Promise((r) => setTimeout(r, 800));

    onConfirm?.({
      reason: trimmed,
      immediate: timing === 'immediate',
      scheduledFor: timing === 'endOfCycle' ? currentCycleEnd : null,
    });
    setSaving(false);
  };

  const cycleEndLabel = currentCycleEnd
    ? new Date(currentCycleEnd).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'the end of your current billing cycle';

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="cancel-sub-title"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose?.(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9500,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, fontFamily: T.font,
      }}>
      <form onSubmit={handleSubmit}
        style={{
          width: '100%', maxWidth: 500, background: '#fff', borderRadius: 14,
          boxShadow: '0 24px 60px rgba(15,23,42,0.35)', maxHeight: '92vh', overflowY: 'auto',
        }}>
        {/* Header */}
        <header style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12,
          padding: '18px 22px', borderBottom: `1px solid ${T.border}`,
          background: 'linear-gradient(90deg, #DC2626, #B91C1C)', color: '#fff',
          borderRadius: '14px 14px 0 0',
        }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', minWidth: 0 }}>
            <span style={{
              width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
              background: 'rgba(255,255,255,0.18)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <AlertTriangle size={16} aria-hidden="true" />
            </span>
            <div>
              <h3 id="cancel-sub-title" style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Cancel Subscription</h3>
              <p style={{ margin: '2px 0 0', fontSize: 12, opacity: 0.9 }}>
                You're cancelling the <strong>{planName || '—'}</strong> plan. We hate to see you go.
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={saving}
            aria-label="Close dialog" title="Close"
            style={{
              background: 'rgba(255,255,255,0.18)', border: 'none',
              width: 30, height: 30, borderRadius: 8, color: '#fff', cursor: 'pointer',
              flexShrink: 0,
            }}>
            <X size={14} aria-hidden="true" />
          </button>
        </header>

        {/* Body */}
        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Timing radio */}
          <div>
            <div style={{
              fontSize: 11, fontWeight: 700, color: T.muted,
              textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8,
            }}>
              When should the cancellation take effect?
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <TimingRow value="endOfCycle" current={timing} onChange={setTiming}
                title={`At the end of current cycle (${cycleEndLabel})`}
                desc="Your team keeps using paid features until the renewal date. Recommended."
              />
              <TimingRow value="immediate" current={timing} onChange={setTiming}
                title="Immediately"
                desc="Plan downgrades to the free tier on confirmation. Outstanding access is forfeited."
              />
            </div>
          </div>

          {/* Reason presets */}
          <div>
            <div style={{
              fontSize: 11, fontWeight: 700, color: T.muted,
              textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8,
            }}>
              Tell us why <span style={{ color: T.red }}>*</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {REASON_PRESETS.map((p) => {
                const active = preset === p;
                return (
                  <button key={p} type="button" onClick={() => handlePreset(p)}
                    style={{
                      padding: '6px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                      border: `1px solid ${active ? T.red : T.border}`,
                      background: active ? '#FEF2F2' : '#fff',
                      color: active ? T.red : T.text,
                      cursor: 'pointer', fontFamily: T.font,
                    }}>
                    {p.replace(/\.$/, '')}
                  </button>
                );
              })}
            </div>
            <textarea ref={reasonRef}
              value={reason}
              onChange={(e) => { setReason(e.target.value.slice(0, 500)); if (error) setError(''); }}
              placeholder="Enter Cancellation Reason (minimum 5 characters)"
              rows={3} maxLength={500} disabled={saving}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 10,
                border: `1px solid ${error ? T.red : T.border}`, fontSize: 13,
                color: T.navy, background: '#fff', outline: 'none',
                fontFamily: T.font, resize: 'vertical', maxHeight: 180,
              }}
            />
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginTop: 4, fontSize: 11, color: T.muted,
            }}>
              <span>{charCount} / 500 characters.</span>
              {error && <span role="alert" style={{ color: T.red, fontWeight: 700 }}>{error}</span>}
            </div>
          </div>

          {/* Loss warning */}
          <div style={{
            background: '#FEF2F2', border: `1px solid #FCA5A5`, borderRadius: 10,
            padding: 12, fontSize: 12, color: T.red, lineHeight: 1.55,
          }}>
            <strong>What you'll lose:</strong> access to your team's appointment history, custom branding,
            advanced reports and email integrations. Your data is retained for 30 days in case you change your mind.
          </div>
        </div>

        {/* Footer */}
        <footer style={{
          display: 'flex', justifyContent: 'flex-end', gap: 10,
          padding: '14px 22px', borderTop: `1px solid ${T.border}`, background: '#F8FAFC',
          borderRadius: '0 0 14px 14px',
        }}>
          <button type="button" onClick={onClose} disabled={saving}
            style={{
              padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700,
              border: `1px solid ${T.border}`, background: '#fff', color: T.text,
              cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.55 : 1,
            }}>
            Keep My Subscription
          </button>
          <button type="submit" disabled={saving}
            style={{
              padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700,
              border: `1px solid ${T.red}`, background: T.red, color: '#fff',
              cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.55 : 1,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
            {saving && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
            {saving ? 'Cancelling…' : 'Confirm Cancellation'}
          </button>
        </footer>
      </form>
    </div>
  );
}

function TimingRow({ value, current, onChange, title, desc }) {
  const active = current === value;
  return (
    <label style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '10px 12px', borderRadius: 10,
      border: `1.5px solid ${active ? T.red : T.border}`,
      background: active ? '#FEF2F2' : '#fff',
      cursor: 'pointer',
    }}>
      <input type="radio" name="cancel-timing" value={value}
        checked={active} onChange={() => onChange(value)}
        style={{ marginTop: 3 }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.navy }}>{title}</div>
        <p style={{ margin: '3px 0 0', fontSize: 11, color: T.muted }}>{desc}</p>
      </div>
    </label>
  );
}
