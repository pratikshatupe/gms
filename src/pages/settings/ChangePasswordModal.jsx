import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Eye, EyeOff, Lock, Loader2, X, Check } from 'lucide-react';
import {
  PASSWORD_RULES, passwordStrength, validateChangePassword, sha256Hex,
} from '../../utils/passwordValidation';

/**
 * ChangePasswordModal — self-serve password change used by Settings →
 * Security tab. On success, calls onSuccess({ passwordHash, passwordChangedAt }).
 * The parent is responsible for persisting the hash onto the staff record,
 * clearing mustChangePassword, and firing the audit log. That keeps this
 * component pure UI + validation.
 *
 * Props:
 *   open           — boolean
 *   onClose        — close handler
 *   onSuccess({ passwordHash, passwordChangedAt })
 *                  — called after 800ms simulated server delay on valid input
 *   currentHash    — existing passwordHash (for comparison), or null
 *   tempPassword   — legacy temp password (null once user has permanent hash)
 */

const T = {
  navy: '#0C2340', text: '#475569', muted: '#94A3B8', border: '#E2E8F0',
  purple: '#0284C7', red: '#DC2626', green: '#059669',
  font: "'Outfit', 'Plus Jakarta Sans', sans-serif",
};

export default function ChangePasswordModal({
  open, onClose, onSuccess, currentHash = null, tempPassword = null,
}) {
  const [current, setCurrent] = useState('');
  const [next, setNext]       = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow]       = useState({ current: false, next: false, confirm: false });
  const [errors, setErrors]   = useState({});
  const [saving, setSaving]   = useState(false);
  const [generalError, setGeneralError] = useState(null);
  const firstRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setCurrent(''); setNext(''); setConfirm('');
    setShow({ current: false, next: false, confirm: false });
    setErrors({}); setGeneralError(null); setSaving(false);
    const t = window.setTimeout(() => firstRef.current?.focus(), 30);
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

  const strength = useMemo(() => passwordStrength(next), [next]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    if (saving) return;
    setErrors({}); setGeneralError(null);

    const result = await validateChangePassword({ current, next, confirm, tempPassword, currentHash });
    if (!result.ok) {
      setErrors({ [result.field]: result.message });
      return;
    }

    setSaving(true);
    /* 800ms simulated server latency per project spec. */
    await new Promise((r) => setTimeout(r, 800));

    try {
      const passwordHash = await sha256Hex(next);
      const passwordChangedAt = new Date().toISOString();
      onSuccess?.({ passwordHash, passwordChangedAt });
    } catch (err) {
      setGeneralError('Unable to hash password in this browser. Please try a modern browser.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="cp-title"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose?.(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9500,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, fontFamily: T.font,
      }}>
      <form onSubmit={handleSubmit}
        style={{ width: '100%', maxWidth: 460, background: '#fff', borderRadius: 14, boxShadow: '0 24px 60px rgba(15,23,42,0.35)' }}>
        <header style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
          padding: '18px 22px', borderBottom: `1px solid ${T.border}`,
          background: 'linear-gradient(90deg, #0284C7, #0D9488)', color: '#fff',
          borderRadius: '14px 14px 0 0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <Lock size={16} aria-hidden="true" />
            </span>
            <div>
              <h3 id="cp-title" style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Change Password</h3>
              <p style={{ margin: '2px 0 0', fontSize: 12, opacity: 0.85 }}>Choose a strong password you haven't used before.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={saving}
            aria-label="Close dialog" title="Close"
            style={{ background: 'rgba(255,255,255,0.15)', border: 'none', width: 30, height: 30, borderRadius: 8, color: '#fff', cursor: 'pointer' }}>
            <X size={14} aria-hidden="true" />
          </button>
        </header>

        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <PasswordField
            id="cp-current" label="Current Password" required
            value={current} onChange={setCurrent}
            visible={show.current} onToggleVisibility={() => setShow((s) => ({ ...s, current: !s.current }))}
            inputRef={firstRef} error={errors.current} disabled={saving}
            placeholder="Enter Current Password"
          />
          <PasswordField
            id="cp-next" label="New Password" required
            value={next} onChange={setNext}
            visible={show.next} onToggleVisibility={() => setShow((s) => ({ ...s, next: !s.next }))}
            error={errors.next} disabled={saving}
            placeholder="Enter New Password"
          />

          {/* Strength meter */}
          <div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
              {[1, 2, 3, 4].map((seg) => (
                <div key={seg} style={{
                  flex: 1, height: 4, borderRadius: 2,
                  background: strength.score >= seg ? strength.colour : '#E2E8F0',
                  transition: 'background 0.15s',
                }} />
              ))}
            </div>
            <p style={{
              margin: 0, fontSize: 11, fontWeight: 700,
              color: strength.score === 0 ? T.muted : strength.colour,
            }}>
              Strength: {strength.label}
            </p>
          </div>

          {/* Rule checklist */}
          <div style={{
            background: '#F8FAFC', border: `1px solid ${T.border}`, borderRadius: 10,
            padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4,
          }}>
            {PASSWORD_RULES.map((rule) => {
              const passed = rule.test(next);
              return (
                <div key={rule.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  fontSize: 11, color: passed ? T.green : T.muted, fontWeight: 600,
                }}>
                  <span style={{
                    width: 14, height: 14, borderRadius: '50%',
                    background: passed ? `${T.green}22` : '#E2E8F0',
                    color: passed ? T.green : T.muted,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {passed ? <Check size={10} strokeWidth={3} aria-hidden="true" /> : '·'}
                  </span>
                  {rule.label}
                </div>
              );
            })}
          </div>

          <PasswordField
            id="cp-confirm" label="Confirm New Password" required
            value={confirm} onChange={setConfirm}
            visible={show.confirm} onToggleVisibility={() => setShow((s) => ({ ...s, confirm: !s.confirm }))}
            error={errors.confirm} disabled={saving}
            placeholder="Re-enter New Password"
          />

          {generalError && (
            <p role="alert" style={{ margin: 0, fontSize: 12, color: T.red, fontWeight: 600 }}>{generalError}</p>
          )}
        </div>

        <footer style={{
          display: 'flex', justifyContent: 'flex-end', gap: 10,
          padding: '14px 22px', borderTop: `1px solid ${T.border}`, background: '#F8FAFC',
          borderRadius: '0 0 14px 14px',
        }}>
          <button type="button" onClick={onClose} disabled={saving}
            style={{
              padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700,
              border: `1px solid ${T.border}`, background: '#fff', color: T.text,
              cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.55 : 1,
            }}>
            Cancel
          </button>
          <button type="submit" disabled={saving}
            style={{
              padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700,
              border: `1px solid ${T.red}`, background: T.red, color: '#fff',
              cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.55 : 1,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
            {saving && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
            {saving ? 'Changing…' : 'Change Password'}
          </button>
        </footer>
      </form>
    </div>
  );
}

function PasswordField({
  id, label, value, onChange, visible, onToggleVisibility,
  inputRef, error, disabled, placeholder, required,
}) {
  return (
    <div>
      <label htmlFor={id} style={{
        display: 'block', fontSize: 11, fontWeight: 700, color: T.muted,
        textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6,
      }}>
        {label}{required && <span style={{ color: T.red }}>*</span>}
      </label>
      <div style={{ position: 'relative' }}>
        <input ref={inputRef} id={id}
          type={visible ? 'text' : 'password'} value={value}
          onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
          disabled={disabled} autoComplete="new-password" maxLength={128}
          style={{
            width: '100%', padding: '10px 38px 10px 12px', borderRadius: 10,
            border: `1px solid ${error ? T.red : T.border}`, fontSize: 13,
            color: T.navy, background: disabled ? '#F8FAFC' : '#fff',
            outline: 'none', fontFamily: T.font,
          }}
        />
        <button type="button" onClick={onToggleVisibility}
          title={visible ? 'Hide password' : 'Show password'}
          aria-label={visible ? 'Hide password' : 'Show password'}
          style={{
            position: 'absolute', top: '50%', right: 8, transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer',
            color: T.muted, padding: 4,
          }}>
          {visible ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
      {error && (
        <p role="alert" style={{ margin: '6px 0 0', fontSize: 11, color: T.red, fontWeight: 600 }}>{error}</p>
      )}
    </div>
  );
}
