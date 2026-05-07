import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { useCollection, STORAGE_KEYS } from '../../store';
import {
  MOCK_OFFICES, MOCK_APPOINTMENTS, MOCK_STAFF, MOCK_ROOMS,
} from '../../data/mockData';
import { addAuditLog } from '../../utils/auditLogger';

/**
 * DeleteOfficeModal — destructive confirmation. Shows a cascade
 * impact summary (staff / rooms / appointments that reference the
 * office) and requires the operator to type the exact office name
 * before the Delete button activates.
 *
 * Per the QA defect guide:
 *   • Descriptive modal (not browser confirm), names the exact item.
 *   • Delete button is red and disabled until the typed name matches.
 *   • Success toast fires only after the server-simulate completes.
 *   • Every message ends in a full stop.
 */

export default function DeleteOfficeModal({
  open, office, onClose, onDeleted, currentUser,
}) {
  const [, , , removeOffice] = useCollection(STORAGE_KEYS.OFFICES, MOCK_OFFICES);
  const [appointments] = useCollection(STORAGE_KEYS.APPOINTMENTS, MOCK_APPOINTMENTS);
  const [staff]        = useCollection(STORAGE_KEYS.STAFF,        MOCK_STAFF);
  const [rooms]        = useCollection(STORAGE_KEYS.ROOMS,        MOCK_ROOMS);

  const [typed, setTyped]     = useState('');
  const [deleting, setDel]    = useState(false);
  const [error, setError]     = useState('');
  const inputRef              = useRef(null);
  const cancelBtnRef          = useRef(null);

  /* Clear state on open. QA rule: closing + reopening clears previous errors. */
  useEffect(() => {
    if (!open) return;
    setTyped('');
    setError('');
    setDel(false);
    const t = window.setTimeout(() => {
      /* Focus goes to Cancel first — destructive dialogs should never
         focus the destructive control by default. */
      cancelBtnRef.current?.focus();
    }, 30);
    return () => window.clearTimeout(t);
  }, [open, office]);

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

  /* Cascade impact — rows that reference the office via officeId or
     a matching `office` name field. Counted once per collection so
     the operator sees exactly what would be orphaned. */
  const cascade = useMemo(() => {
    if (!office) return { staff: 0, rooms: 0, appointments: 0 };
    const matches = (r) =>
      (r?.officeId && r.officeId === office.id)
      || (r?.office && r.office === office.name);
    return {
      staff:        (staff        || []).filter(matches).length,
      rooms:        (rooms        || []).filter(matches).length,
      appointments: (appointments || []).filter(matches).length,
    };
  }, [office, staff, rooms, appointments]);

  if (!open || !office) return null;

  const expected = office.name;
  const matches  = typed.trim() === expected;

  const handleDelete = async () => {
    if (!matches || deleting) return;
    setDel(true);
    setError('');
    try {
      await new Promise((r) => setTimeout(r, 800));
      removeOffice(office.id);
      addAuditLog({
        userName:    currentUser?.name || 'Unknown',
        role:        (currentUser?.role || '').toString(),
        action:      'DELETE',
        module:      'Offices',
        description: `Deleted office ${office.name} (${office.code}).`,
        orgId:       office.orgId,
      });
      setDel(false);
      onDeleted?.(office);
    } catch (err) {
      setDel(false);
      setError('Delete failed. Please try again.');
    }
  };

  const totalCascade = cascade.staff + cascade.rooms + cascade.appointments;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-office-title"
      aria-describedby="delete-office-desc"
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
              <h3 id="delete-office-title" className="font-[Outfit,sans-serif] text-[16px] font-extrabold text-red-800 dark:text-red-200">
                Delete Office
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
          <p id="delete-office-desc" className="text-[13px] text-slate-700 dark:text-slate-200">
            Are you sure you want to delete office{' '}
            <strong className="text-red-700 dark:text-red-300">
              {office.name} ({office.code})
            </strong>?
          </p>

          {/* Cascade summary — single-sentence format matching the QA script. */}
          <div className="mt-4 rounded-[10px] border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
            <p className="text-[12px] font-bold text-amber-800 dark:text-amber-200">
              {totalCascade === 0
                ? 'No linked records found — this office can be deleted cleanly.'
                : `${cascade.staff} staff, ${cascade.rooms} rooms, ${cascade.appointments} appointments affected.`}
            </p>
            <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
              <CascadePill label="Staff"        count={cascade.staff} />
              <CascadePill label="Rooms"        count={cascade.rooms} />
              <CascadePill label="Appointments" count={cascade.appointments} />
            </dl>
            {totalCascade > 0 && (
              <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-300">
                Reassign or archive these records before deletion to avoid orphaned data.
              </p>
            )}
          </div>

          {/* Typed confirmation — label spells out the expected name. */}
          <label htmlFor="delete-office-confirm" className="mt-4 mb-1.5 block text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400">
            Type &lsquo;{expected}&rsquo; to confirm
            <span aria-hidden="true" className="text-red-500">*</span>
          </label>
          <input
            ref={inputRef}
            id="delete-office-confirm"
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
              Office name does not match — check for typos.
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
            title={matches ? `Delete ${office.name}` : 'Type the office name to enable'}
            className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-red-700 bg-red-600 px-5 py-2.5 text-[13px] font-bold text-white shadow-sm transition hover:bg-red-700 hover:border-red-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {deleting && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
            {deleting ? 'Deleting…' : 'Delete Office'}
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
      <div className="mt-0.5 font-[Outfit,sans-serif] text-[18px] font-extrabold">{count}</div>
    </div>
  );
}
