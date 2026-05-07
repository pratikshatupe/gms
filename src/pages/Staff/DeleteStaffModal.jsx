import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { useCollection, STORAGE_KEYS } from '../../store';
import {
  MOCK_STAFF, MOCK_APPOINTMENTS, MOCK_SERVICES,
} from '../../data/mockData';
import { addAuditLog } from '../../utils/auditLogger';

/**
 * DeleteStaffModal — destructive confirmation for a single Staff row.
 *
 * Cascade banner shows three counts:
 *   1. Open appointments hosted by this staff.
 *   2. Services whose assignedStaffIds array contains this user.
 *   3. Direct reports (other staff whose reportingToUserId matches).
 *
 * Per product decision (Ambiguity 7): warn-but-allow. Typed
 * confirmation is required. After delete, orphaned references will
 * show "Unknown Staff" in the UI — the Appointments module will add
 * inline reassignment UI on top of this modal.
 */

/*
 * TODO — Module 3 Appointments and future modules.
 * When Appointments module ships, replace the warn-only cascade below
 * with inline reassignment UI. Specifically:
 *   • For the N open appointments row, add a dropdown labelled
 *     "Transfer appointments to" populated with other active staff
 *     in the same office, same org. On confirm, bulk-update those
 *     appointments with the new hostUserId, then proceed with delete.
 *   • For the N services assigned row, when Service-to-Staff
 *     assignment ships as a feature (not part of Module 1 scope),
 *     add a dropdown "Reassign services to" with the same scoping.
 *     On confirm, bulk-update assignedStaffIds arrays, then proceed
 *     with delete.
 *   • For the N direct reports row, add a dropdown "Reassign reports
 *     to" with active Managers and Directors in the same org. On
 *     confirm, bulk-update reportingToUserId fields on those staff,
 *     then proceed with delete.
 *   • Keep warn-only path as fallback when the dropdowns have no
 *     eligible targets (e.g. last staff in office).
 *   • If any reassignment dropdown is empty AND counts are greater
 *     than zero, block the delete entirely with the message:
 *     "Please reassign open work before removing this staff member.
 *     No eligible replacements available."
 *   • Audit log must capture the reassignments made, not just the
 *     delete.
 */

export default function DeleteStaffModal({ open, staffRow, onClose, onDeleted, currentUser }) {
  const [staffAll, , , removeStaff] = useCollection(STORAGE_KEYS.STAFF,        MOCK_STAFF);
  const [appointments]              = useCollection(STORAGE_KEYS.APPOINTMENTS, MOCK_APPOINTMENTS);
  const [services]                  = useCollection(STORAGE_KEYS.SERVICES,     MOCK_SERVICES);

  const [typed, setTyped]  = useState('');
  const [deleting, setDel] = useState(false);
  const [error, setError]  = useState('');
  const cancelBtnRef       = useRef(null);

  useEffect(() => {
    if (!open) return;
    setTyped('');
    setError('');
    setDel(false);
    const t = window.setTimeout(() => cancelBtnRef.current?.focus(), 30);
    return () => window.clearTimeout(t);
  }, [open, staffRow]);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape' && !deleting) onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, deleting, onClose]);

  const cascade = useMemo(() => {
    if (!staffRow) return { appts: 0, services: 0, reports: 0 };
    const today = new Date().toISOString().slice(0, 10);
    const apptCount = (appointments || []).filter((a) => {
      if (!a) return false;
      const matchesHost =
        (a.hostUserId && a.hostUserId === staffRow.id)
        || (a.host && (a.host === staffRow.fullName || a.host === staffRow.name));
      if (!matchesHost) return false;
      const status = String(a.status || '').toLowerCase();
      if (status === 'cancelled' || status === 'completed' || status === 'checked-out' || status === 'no-show') return false;
      const date = (a.date || '').slice(0, 10);
      return !date || date >= today;
    }).length;

    const svcCount = (services || []).filter(
      (s) => s && Array.isArray(s.assignedStaffIds) && s.assignedStaffIds.includes(staffRow.id),
    ).length;

    const reportCount = (staffAll || []).filter(
      (s) => s && s.id !== staffRow.id && s.reportingToUserId === staffRow.id,
    ).length;

    return { appts: apptCount, services: svcCount, reports: reportCount };
  }, [appointments, services, staffAll, staffRow]);

  if (!open || !staffRow) return null;

  const expected = staffRow.fullName || staffRow.name || '';
  const matches  = typed.trim() === expected;
  const totalCascade = cascade.appts + cascade.services + cascade.reports;

  const handleDelete = async () => {
    if (!matches || deleting) return;
    setDel(true);
    setError('');
    try {
      await new Promise((r) => setTimeout(r, 800));
      removeStaff(staffRow.id);
      addAuditLog({
        userName:    currentUser?.name || 'Unknown',
        role:        (currentUser?.role || '').toString(),
        action:      'DELETE',
        module:      'Staff',
        description: `Deleted staff ${expected} (${staffRow.employeeId || staffRow.id}). Cascade: ${cascade.appts} appointments, ${cascade.services} services, ${cascade.reports} reports. Snapshot: ${JSON.stringify({
          id: staffRow.id, orgId: staffRow.orgId, officeId: staffRow.officeId,
          role: staffRow.role, emailId: staffRow.emailId,
          employeeId: staffRow.employeeId, accessStatus: staffRow.accessStatus,
        })}`,
        orgId:       staffRow.orgId,
      });
      setDel(false);
      onDeleted?.(staffRow);
    } catch (err) {
      setDel(false);
      setError('Delete failed. Please try again.');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-staff-title"
      aria-describedby="delete-staff-desc"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !deleting) onClose?.(); }}
      className="fixed inset-0 z-[9500] flex items-center justify-center bg-black/55 p-4"
    >
      <div className="w-full max-w-md rounded-[14px] border border-slate-200 bg-white shadow-2xl dark:border-[#142535] dark:bg-[#0A1828]">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-red-200 bg-red-50 px-5 py-4 dark:border-red-500/30 dark:bg-red-500/10">
          <div className="flex items-start gap-3 min-w-0">
            <span aria-hidden="true" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300">
              <AlertTriangle size={20} />
            </span>
            <div className="min-w-0">
              <h3 id="delete-staff-title" className="font-[Outfit,sans-serif] text-[16px] font-extrabold text-red-800 dark:text-red-200">
                Delete Staff
              </h3>
              <p className="mt-0.5 text-[12px] font-semibold text-red-700 dark:text-red-300">
                This action cannot be undone.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            aria-label="Close dialog"
            title="Close"
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-red-300 dark:hover:bg-red-500/20"
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          <p id="delete-staff-desc" className="text-[13px] text-slate-700 dark:text-slate-200">
            Are you sure you want to delete staff{' '}
            <strong className="text-red-700 dark:text-red-300">
              {expected} ({staffRow.employeeId || '—'})
            </strong>?
          </p>
          <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">
            Role: {staffRow.role || '—'}.
          </p>

          {/* Cascade */}
          <div className="mt-4 rounded-[10px] border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-500/30 dark:bg-amber-500/10">
            <p className="text-[12px] font-bold text-amber-800 dark:text-amber-200">
              Cascade impact.
            </p>
            <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
              <CascadePill label="Appointments" count={cascade.appts} />
              <CascadePill label="Services"     count={cascade.services} />
              <CascadePill label="Reports"      count={cascade.reports} />
            </dl>
            <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-300">
              {totalCascade === 0
                ? 'No linked records — this staff can be removed cleanly.'
                : `Deleting ${expected} will orphan the records above. They will remain in the system but show "Unknown Staff" as the host/assignee.`}
            </p>
          </div>

          <label htmlFor="delete-staff-confirm" className="mt-4 mb-1.5 block text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400">
            Type &lsquo;{expected}&rsquo; to confirm
            <span aria-hidden="true" className="text-red-500">*</span>
          </label>
          <input
            id="delete-staff-confirm"
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={`Type ${expected} to enable delete`}
            maxLength={100}
            disabled={deleting}
            aria-invalid={typed.length > 0 && !matches}
            className={`w-full rounded-[10px] border bg-white px-3 py-2 text-[13px] text-slate-700 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100 disabled:opacity-40 dark:bg-[#071220] dark:text-slate-200 ${
              typed.length > 0 && !matches
                ? 'border-red-400 dark:border-red-500/40'
                : 'border-slate-200 dark:border-[#142535]'
            }`}
          />
          {typed.length > 0 && !matches && (
            <p role="alert" className="mt-1 text-[11px] font-semibold text-red-500">
              Staff name does not match — check for typos.
            </p>
          )}
          {error && (
            <p role="alert" className="mt-2 text-[12px] font-semibold text-red-500">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-[#142535] dark:bg-[#071220]">
          <button
            ref={cancelBtnRef}
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="cursor-pointer rounded-[10px] border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#142535] dark:bg-[#0A1828] dark:text-slate-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!matches || deleting}
            title={matches ? `Delete ${expected}` : 'Type the full name to enable'}
            className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-red-700 bg-red-600 px-5 py-2.5 text-[13px] font-bold text-white shadow-sm transition hover:bg-red-700 hover:border-red-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {deleting && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
            {deleting ? 'Deleting…' : 'Delete Staff'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CascadePill({ label, count }) {
  const has = count > 0;
  return (
    <div
      className={`rounded-[8px] border px-2 py-1.5 ${has
        ? 'border-amber-300 bg-white text-amber-800 dark:border-amber-500/40 dark:bg-[#071220] dark:text-amber-300'
        : 'border-slate-200 bg-white text-slate-400 dark:border-[#142535] dark:bg-[#071220]'}`}
    >
      <div className="text-[11px] font-bold uppercase tracking-wide">{label}</div>
      <div className="mt-0.5 font-[Outfit,sans-serif] text-[18px] font-extrabold">
        {Number(count).toLocaleString('en-GB')}
      </div>
    </div>
  );
}
