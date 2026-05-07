import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Eye, EyeOff, Lock, Mail, Phone, ShieldCheck, User as UserIcon, X } from 'lucide-react';
import { roleColor, roleLabel } from './profileRoles';

/**
 * ProfileModal — view + (conditionally) edit the signed-in user's profile.
 *
 * Props:
 *   open       — boolean
 *   user       — current user object from AuthContext
 *   canEdit    — true → fields are editable + Save button is shown
 *   onClose    — () => void  (also fires on Esc / backdrop click)
 *   onSave     — (patch) => void | Promise<void>  (called only when canEdit)
 *   mode       — 'view' | 'password'  (password mode jumps straight to pw fields)
 */
export default function ProfileModal({
  open,
  user,
  canEdit = false,
  onClose,
  onSave,
  mode = 'view',
}) {
  const closeBtnRef = useRef(null);
  const previouslyFocused = useRef(null);

  const initial = useMemo(
    () => ({
      name:  user?.name  || '',
      email: user?.email || '',
      phone: user?.phone || '',
      password: '',
      newPassword: '',
    }),
    [user],
  );

  const [form, setForm] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  /* Reset form whenever the modal opens or the user changes. */
  useEffect(() => {
    if (!open) return;
    setForm(initial);
    setEditing(canEdit && mode === 'password');
    setShowPw(false);
    setSaving(false);
    setError('');
  }, [open, initial, canEdit, mode]);

  /* Focus + scroll lock + Esc handling — same pattern as ConfirmModal. */
  useEffect(() => {
    if (!open) return undefined;
    previouslyFocused.current = document.activeElement;
    const t = window.setTimeout(() => closeBtnRef.current?.focus(), 0);

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose?.();
      }
    };
    document.addEventListener('keydown', onKey);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      if (previouslyFocused.current instanceof HTMLElement) {
        previouslyFocused.current.focus();
      }
    };
  }, [open, onClose]);

  const handleBackdrop = useCallback(
    (e) => { if (e.target === e.currentTarget) onClose?.(); },
    [onClose],
  );

  const update = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSave = async () => {
    if (!canEdit) return;
    setError('');

    if (!form.name.trim()) { setError('Name is required.'); return; }
    if (!/^\S+@\S+\.\S+$/.test(form.email)) { setError('Please enter a valid Email ID.'); return; }
    if (form.newPassword && form.newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    if (form.newPassword && form.password && form.newPassword === form.password) {
      setError('New Password must be different from Current Password.');
      return;
    }

    const patch = {
      name:  form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
    };
    if (form.newPassword) patch.password = form.newPassword;

    try {
      setSaving(true);
      await onSave?.(patch);
      setEditing(false);
      setForm((f) => ({ ...f, password: '', newPassword: '' }));
    } catch (err) {
      setError(err?.message || 'Could not save profile.');
    } finally {
      setSaving(false);
    }
  };

  if (!open || !user) return null;

  const role = user.role;
  const badgeColor = roleColor(role);
  const initials = (user.name || 'U')
    .split(' ').filter(Boolean).slice(0, 2)
    .map((p) => p[0]?.toUpperCase()).join('') || 'U';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-modal-title"
      onMouseDown={handleBackdrop}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 animate-[fadeIn_0.15s_ease-out]"
    >
      <div className="w-full max-w-md overflow-hidden rounded-[16px] border border-slate-200 bg-white shadow-2xl dark:border-[#142535] dark:bg-[#0A1828]">
        {/* Header */}
        <div className="relative bg-gradient-to-br from-[#0284C7] to-[#0EA5E9] px-6 pt-6 pb-10 text-white">
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label="Close profile"
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <X size={16} />
          </button>
          <h2
            id="profile-modal-title"
            className="text-[15px] font-extrabold tracking-wide font-['Outfit',sans-serif]"
          >
            {editing ? 'Edit Profile' : 'My Profile'}
          </h2>
          <p className="mt-1 text-[12px] text-white/70">
            {editing ? 'Update your account information.' : 'Your account information.'}
          </p>
        </div>

        {/* Avatar overlap */}
        <div className="relative -mt-8 px-6">
          <div className="flex items-end gap-3">
            <div
              aria-hidden="true"
              className="flex h-16 w-16 items-center justify-center rounded-2xl border-4 border-white bg-[#0C2340] text-[18px] font-extrabold text-white shadow-md font-['Outfit',sans-serif] dark:border-[#0A1828]"
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1 pb-1">
              <div className="truncate text-[15px] font-bold text-slate-900 dark:text-slate-100">
                {user.name || 'Unnamed user'}
              </div>
              <div
                className="mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white"
                style={{ background: badgeColor }}
              >
                <ShieldCheck size={10} aria-hidden="true" />
                {roleLabel(role)}
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 pb-5 pt-5">
          {error && (
            <div
              role="alert"
              className="mb-3 rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
            >
              {error}
            </div>
          )}

          <div className="space-y-3">
            <Field
              label="Full Name"
              icon={<UserIcon size={14} />}
              value={form.name}
              onChange={update('name')}
              editing={editing}
              placeholder="Your name"
              maxLength={100}
            />
            <Field
              label="Email ID"
              icon={<Mail size={14} />}
              type="email"
              value={form.email}
              onChange={update('email')}
              editing={editing}
              placeholder="Enter Email ID"
              maxLength={100}
            />
            <Field
              label="Contact Number"
              icon={<Phone size={14} />}
              type="tel"
              value={form.phone}
              onChange={update('phone')}
              editing={editing}
              placeholder="Enter Contact Number"
              maxLength={20}
            />

            {/* Password section */}
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Password
              </label>
              <div className="flex items-center gap-2 rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2 dark:border-[#142535] dark:bg-[#071220]">
                <Lock size={14} className="text-slate-400" aria-hidden="true" />
                {editing ? (
                  <>
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={form.newPassword}
                      onChange={update('newPassword')}
                      placeholder="Leave blank to keep current"
                      autoComplete="new-password"
                      maxLength={128}
                      className="flex-1 bg-transparent text-[13px] text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      title={showPw ? 'Hide password' : 'View password'}
                      aria-label={showPw ? 'Hide password' : 'View password'}
                      className="text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </>
                ) : (
                  <span className="flex-1 select-none font-mono text-[14px] tracking-[0.3em] text-slate-700 dark:text-slate-300">
                    ••••••••
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-6 py-3 dark:border-[#142535] dark:bg-[#071220]">
          {!canEdit && (
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Read-only — contact an admin to change details.
            </span>
          )}
          {canEdit && !editing && (
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              You have permission to edit this profile.
            </span>
          )}
          {canEdit && editing && <span />}

          <div className="flex gap-2">
            {canEdit && editing ? (
              <>
                <button
                  type="button"
                  onClick={() => { setEditing(false); setForm(initial); setError(''); }}
                  disabled={saving}
                  className="rounded-[10px] border border-slate-200 bg-white px-4 py-2 text-[12px] font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40 disabled:opacity-60 dark:border-[#142535] dark:bg-[#0A1828] dark:text-slate-200 dark:hover:bg-[#1E1E3F]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-[10px] border border-sky-700 bg-sky-700 px-4 py-2 text-[12px] font-bold text-white transition hover:bg-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40 disabled:opacity-60"
                >
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-[10px] border border-slate-200 bg-white px-4 py-2 text-[12px] font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40 dark:border-[#142535] dark:bg-[#0A1828] dark:text-slate-200 dark:hover:bg-[#1E1E3F]"
                >
                  Close
                </button>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="rounded-[10px] border border-sky-700 bg-sky-700 px-4 py-2 text-[12px] font-bold text-white transition hover:bg-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40"
                  >
                    Edit Profile
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, icon, value, onChange, editing, type = 'text', placeholder, maxLength }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </label>
      <div className="flex items-center gap-2 rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2 dark:border-[#142535] dark:bg-[#071220]">
        <span className="text-slate-400" aria-hidden="true">{icon}</span>
        {editing ? (
          <input
            type={type}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            maxLength={maxLength}
            className="flex-1 bg-transparent text-[13px] text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
          />
        ) : (
          <span className="flex-1 truncate text-[13px] text-slate-700 dark:text-slate-200">
            {value || <span className="text-slate-400">—</span>}
          </span>
        )}
      </div>
    </div>
  );
}
