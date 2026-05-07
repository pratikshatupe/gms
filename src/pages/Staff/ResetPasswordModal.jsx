import React, { useEffect, useRef, useState } from 'react';
import { Loader2, X, KeyRound } from 'lucide-react';
import { useCollection, STORAGE_KEYS } from '../../store';
import { MOCK_STAFF } from '../../data/mockData';
import { addAuditLog } from '../../utils/auditLogger';
import { generateTempPassword } from '../../utils/requestValidation';
import { TempPasswordReveal } from './AddStaffDrawer';

/**
 * ResetPasswordModal — regenerate a staff member's temp password.
 *
 * Purple primary (not red destructive) — this is a recovery action,
 * not a destructive one. After confirm:
 *
 *   1. mustChangePassword → true (regardless of prior state).
 *   2. accessStatus → 'Pending' if previously 'Active'; unchanged
 *      if 'Invited' or 'Inactive'.
 *   3. tempPassword regenerated via generateTempPassword().
 *   4. Session-invalidation hook placeholder for Module 12.
 *
 * Then the TempPasswordReveal screen shows the new password once
 * with a forced-acknowledgement button. Audit log carries the
 * before/after access status but NOT the password plaintext.
 *
 * Self-reset for Director is blocked upstream (the button is
 * disabled on their own StaffDetailPage); this modal assumes the
 * target is not the operator. SuperAdmin self-reset adds a current-
 * password speed-bump before regen.
 */

export default function ResetPasswordModal({
  open, staffRow, onClose, onReset, currentUser,
}) {
  const [, , updateStaff] = useCollection(STORAGE_KEYS.STAFF, MOCK_STAFF);

  const [stage, setStage] = useState('confirm');  /* 'confirm' | 'reveal' */
  const [saving, setSaving] = useState(false);
  const [reveal, setReveal] = useState(null);
  const [superSpeedBump, setSpeedBump] = useState('');
  const cancelBtnRef = useRef(null);

  const isSuperSelfReset = Boolean(
    staffRow
    && currentUser
    && staffRow.id === currentUser.id
    && String(currentUser.role || '').toLowerCase() === 'superadmin',
  );

  useEffect(() => {
    if (!open) return;
    setStage('confirm');
    setSaving(false);
    setReveal(null);
    setSpeedBump('');
    const t = window.setTimeout(() => cancelBtnRef.current?.focus(), 30);
    return () => window.clearTimeout(t);
  }, [open, staffRow]);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      /* Esc only closes from the confirm stage — reveal stage is
         intentionally non-dismissable until acknowledged. */
      if (e.key === 'Escape' && !saving && stage === 'confirm') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, saving, stage, onClose]);

  if (!open || !staffRow) return null;

  const handleReset = async () => {
    if (saving) return;
    if (isSuperSelfReset && superSpeedBump.trim().length === 0) {
      return;
    }
    setSaving(true);
    await new Promise((r) => setTimeout(r, 800));

    const newPwd = generateTempPassword();
    const previousAccessStatus = staffRow.accessStatus || 'Active';
    const nextAccess = previousAccessStatus === 'Active' ? 'Pending' : previousAccessStatus;
    const now = new Date().toISOString();
    const author = currentUser?.name || 'Unknown';

    updateStaff(staffRow.id, {
      tempPassword: newPwd,
      mustChangePassword: true,
      accessStatus: nextAccess,
      updatedAt: now,
      updatedBy: author,
    });

    /* Placeholder for session invalidation — real implementation in
       Module 12 (Login / token management). */

    addAuditLog({
      userName:    author,
      role:        (currentUser?.role || '').toString(),
      action:      'PASSWORD_RESET',
      module:      'Staff',
      description: `Password reset for ${staffRow.fullName || staffRow.name} (${staffRow.employeeId}). Previous access: ${previousAccessStatus}; new: ${nextAccess}.`,
      orgId:       staffRow.orgId,
    });

    setSaving(false);
    setReveal({ tempPassword: newPwd });
    setStage('reveal');
  };

  if (stage === 'reveal' && reveal) {
    return (
      <TempPasswordReveal
        title="New Temporary Password Generated"
        intro={`Share this password with ${staffRow.fullName || staffRow.name} via a secure channel (WhatsApp, in-person, encrypted email). They must change it on their next login.`}
        emailId={staffRow.emailId}
        tempPassword={reveal.tempPassword}
        onDone={() => {
          onReset?.(staffRow, reveal.tempPassword);
        }}
      />
    );
  }

  const displayName = staffRow.fullName || staffRow.name || 'this staff member';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-pwd-title"
      aria-describedby="reset-pwd-desc"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose?.(); }}
      className="fixed inset-0 z-[9500] flex items-center justify-center bg-black/55 p-4"
    >
      <div className="w-full max-w-md rounded-[14px] border border-slate-200 bg-white shadow-2xl dark:border-[#142535] dark:bg-[#0A1828]">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-gradient-to-r from-sky-700 to-sky-800 px-5 py-4 text-white dark:border-[#142535]">
          <div className="flex items-start gap-3 min-w-0">
            <span aria-hidden="true" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-white">
              <KeyRound size={18} />
            </span>
            <div className="min-w-0">
              <h3 id="reset-pwd-title" className="font-[Outfit,sans-serif] text-[16px] font-extrabold leading-tight">
                Reset Password for {displayName}?
              </h3>
              <p className="mt-0.5 text-[12px] opacity-85">
                Recovery action — not destructive.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close dialog"
            title="Close"
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md bg-white/15 text-white transition hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>

        <div id="reset-pwd-desc" className="px-5 py-4">
          <p className="text-[13px] text-slate-700 dark:text-slate-200">
            A new temporary password will be generated. The current password will stop working immediately.
          </p>
          <p className="mt-2 text-[13px] text-slate-700 dark:text-slate-200">
            <strong>{displayName}</strong> will be required to change this password on their next login. They will also see a yellow banner on their dashboard until the password is updated.
          </p>

          {isSuperSelfReset && (
            <div className="mt-4 rounded-[10px] border border-amber-300 bg-amber-50 px-3 py-3 dark:border-amber-500/40 dark:bg-amber-500/10">
              <label htmlFor="super-speed-bump" className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.06em] text-amber-800 dark:text-amber-300">
                Confirm your current password
                <span aria-hidden="true" className="text-red-500">*</span>
              </label>
              <input
                id="super-speed-bump"
                type="password"
                value={superSpeedBump}
                onChange={(e) => setSpeedBump(e.target.value)}
                placeholder="Enter your current password"
                maxLength={100}
                className="w-full rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-700 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-200"
              />
              <p className="mt-1.5 text-[11px] text-amber-700 dark:text-amber-300">
                Required when resetting your own password as Super Admin.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-[#142535] dark:bg-[#071220]">
          <button
            ref={cancelBtnRef}
            type="button"
            onClick={onClose}
            disabled={saving}
            className="cursor-pointer rounded-[10px] border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#142535] dark:bg-[#0A1828] dark:text-slate-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={saving || (isSuperSelfReset && !superSpeedBump.trim())}
            title="Reset password"
            className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-sky-700 bg-gradient-to-r from-sky-600 to-sky-800 px-5 py-2.5 text-[13px] font-bold text-white shadow-sm transition hover:from-sky-700 hover:to-sky-900 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
            {saving ? 'Resetting…' : 'Reset Password'}
          </button>
        </div>
      </div>
    </div>
  );
}
