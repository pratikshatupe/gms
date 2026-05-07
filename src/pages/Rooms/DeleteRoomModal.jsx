import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { useCollection, STORAGE_KEYS } from '../../store';
import {
  MOCK_ROOMS, MOCK_APPOINTMENTS, MOCK_OFFICES,
} from '../../data/mockData';
import { addAuditLog } from '../../utils/auditLogger';

/**
 * DeleteRoomModal — destructive confirmation for a single Room.
 *
 * Mirrors the Offices DeleteOfficeModal pattern:
 *   • Named modal, not browser alert.
 *   • Cascade impact line: "X upcoming appointments affected."
 *     (zero always shown as "0 upcoming appointments affected.").
 *   • Typed confirmation input — Delete stays disabled until the
 *     operator types the exact room name.
 *   • Initial focus lands on Cancel.
 *   • 800ms server-simulate before firing the success toast.
 *   • Audit log carries the full pre-delete snapshot.
 */

export default function DeleteRoomModal({ open, room, onClose, onDeleted, currentUser }) {
  const [, , , removeRoom] = useCollection(STORAGE_KEYS.ROOMS, MOCK_ROOMS);
  const [appointments]     = useCollection(STORAGE_KEYS.APPOINTMENTS, MOCK_APPOINTMENTS);
  const [offices]          = useCollection(STORAGE_KEYS.OFFICES,      MOCK_OFFICES);

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
  }, [open, room]);

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

  const office = useMemo(
    () => (offices || []).find((o) => o?.id === room?.officeId) || null,
    [offices, room],
  );

  /* Cascade impact — upcoming appointments that reference this room.
     An "upcoming" appointment is one dated today or later AND whose
     status is not cancelled/completed. */
  const upcomingCount = useMemo(() => {
    if (!room) return 0;
    const today = new Date().toISOString().slice(0, 10);
    return (appointments || []).filter((a) => {
      if (!a) return false;
      const matchesRoom =
        (a.roomId && a.roomId === room.id)
        || (a.room && (a.room === room.name || a.room === room.code));
      if (!matchesRoom) return false;
      const status = String(a.status || '').toLowerCase();
      if (status === 'cancelled' || status === 'completed' || status === 'checked-out') return false;
      const date = (a.date || '').slice(0, 10);
      return date >= today;
    }).length;
  }, [appointments, room]);

  if (!open || !room) return null;

  const expected = room.name;
  const matches  = typed.trim() === expected;

  const handleDelete = async () => {
    if (!matches || deleting) return;
    setDel(true);
    setError('');
    try {
      await new Promise((r) => setTimeout(r, 800));
      removeRoom(room.id);
      addAuditLog({
        userName:    currentUser?.name || 'Unknown',
        role:        (currentUser?.role || '').toString(),
        action:      'DELETE',
        module:      'Rooms',
        description: `Deleted room ${room.name} (${room.code})${office?.name ? ` at ${office.name}` : ''}. Snapshot: ${JSON.stringify({
          id: room.id, orgId: room.orgId, officeId: room.officeId,
          type: room.type, floor: room.floor, capacity: room.seatingCapacity,
          status: room.status,
        })}`,
        orgId:       room.orgId,
      });
      setDel(false);
      onDeleted?.(room);
    } catch (err) {
      setDel(false);
      setError('Delete failed. Please try again.');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-room-title"
      aria-describedby="delete-room-desc"
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
              <h3 id="delete-room-title" className="font-[Outfit,sans-serif] text-[16px] font-extrabold text-red-800 dark:text-red-200">
                Delete Room
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
          <p id="delete-room-desc" className="text-[13px] text-slate-700 dark:text-slate-200">
            Are you sure you want to delete room{' '}
            <strong className="text-red-700 dark:text-red-300">
              {room.name} ({room.code})
            </strong>
            {office?.name ? <> at <strong className="text-slate-700 dark:text-slate-200">{office.name}</strong></> : null}?
          </p>

          {/* Cascade banner */}
          <div className="mt-4 rounded-[10px] border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-500/30 dark:bg-amber-500/10">
            <p className="text-[12px] font-bold text-amber-800 dark:text-amber-200">
              {upcomingCount.toLocaleString('en-GB')} upcoming appointment{upcomingCount === 1 ? '' : 's'} affected.
            </p>
            {upcomingCount > 0 && (
              <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">
                Reassign or cancel these appointments before deletion to avoid orphaned bookings.
              </p>
            )}
          </div>

          {/* Typed confirmation */}
          <label htmlFor="delete-room-confirm" className="mt-4 mb-1.5 block text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400">
            Type &lsquo;{expected}&rsquo; to confirm
            <span aria-hidden="true" className="text-red-500">*</span>
          </label>
          <input
            id="delete-room-confirm"
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
              Room name does not match — check for typos.
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
            title={matches ? `Delete ${room.name}` : 'Type the room name to enable'}
            className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-red-700 bg-red-600 px-5 py-2.5 text-[13px] font-bold text-white shadow-sm transition hover:bg-red-700 hover:border-red-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {deleting && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
            {deleting ? 'Deleting…' : 'Delete Room'}
          </button>
        </div>
      </div>
    </div>
  );
}
