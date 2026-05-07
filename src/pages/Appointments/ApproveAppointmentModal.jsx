import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, X } from 'lucide-react';
import { useCollection, STORAGE_KEYS } from '../../store';
import { MOCK_APPOINTMENTS, stampLegacyAliases } from '../../data/mockAppointments';
import { addAuditLog } from '../../utils/auditLogger';
import { useNotificationTriggers } from '../../utils/notificationTriggers';

/**
 * ApproveAppointmentModal — purple primary confirmation (non-destructive).
 * Shown for Pending appointments when the current user is authorised
 * under `canApprove`. Optional approver notes are captured and
 * appended to the audit log.
 */

export default function ApproveAppointmentModal({
  open, appointmentRow, onClose, onApproved, currentUser,
}) {
  const [, , updateAppt] = useCollection(STORAGE_KEYS.APPOINTMENTS, MOCK_APPOINTMENTS);
  const { fireAppointmentApproved } = useNotificationTriggers();

  const [notes, setNotes]   = useState('');
  const [saving, setSaving] = useState(false);
  const cancelBtnRef        = useRef(null);

  useEffect(() => {
    if (!open) return;
    setNotes('');
    setSaving(false);
    const t = window.setTimeout(() => cancelBtnRef.current?.focus(), 30);
    return () => window.clearTimeout(t);
  }, [open, appointmentRow]);

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

  if (!open || !appointmentRow) return null;

  const handleSubmit = async () => {
    if (saving) return;
    setSaving(true);
    await new Promise((r) => setTimeout(r, 800));

    const now = new Date().toISOString();
    const author = currentUser?.name || 'Unknown';
    const patch = stampLegacyAliases({
      ...appointmentRow,
      status: 'Approved',
      approvedAt: now,
      approvedBy: author,
      updatedAt: now,
      updatedBy: author,
    });
    updateAppt(appointmentRow.id, patch);

    addAuditLog({
      userName:    author,
      role:        (currentUser?.role || '').toString(),
      action:      'APPOINTMENT_APPROVED',
      module:      'Appointments',
      description: `Approved appointment ${appointmentRow.id} (${appointmentRow.visitor?.fullName || appointmentRow.guestName || '—'})${notes.trim() ? ` — ${notes.trim().slice(0, 120)}` : ''}.`,
      orgId:       appointmentRow.orgId,
    });

    /* Module 7 — fire approval notification + email preview. */
    fireAppointmentApproved({
      apt: {
        id:           appointmentRow.id,
        visitorName:  appointmentRow.visitor?.fullName || appointmentRow.guestName,
        visitorEmail: appointmentRow.visitor?.email   || appointmentRow.guestEmail,
        hostName:     appointmentRow.hostName,
        date:         appointmentRow.scheduledDate || appointmentRow.date,
        timeStart:    appointmentRow.startTime     || appointmentRow.time,
        organisationId: appointmentRow.orgId,
      },
      hostStaffId: appointmentRow.hostUserId || appointmentRow.hostStaffId || null,
    });

    setSaving(false);
    onApproved?.({ ...appointmentRow, ...patch });
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="approve-apt-title"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose?.(); }}
      className="fixed inset-0 z-[9500] flex items-center justify-center bg-black/55 p-4">
      <div className="w-full max-w-md rounded-[14px] border border-slate-200 bg-white shadow-2xl dark:border-[#142535] dark:bg-[#0A1828]">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-gradient-to-r from-sky-700 to-sky-800 px-5 py-4 text-white dark:border-[#142535]">
          <div className="flex items-start gap-3 min-w-0">
            <span aria-hidden="true" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15">
              <CheckCircle2 size={18} />
            </span>
            <div className="min-w-0">
              <h3 id="approve-apt-title" className="font-[Outfit,sans-serif] text-[16px] font-extrabold leading-tight">
                Approve Appointment
              </h3>
              <p className="mt-0.5 text-[12px] opacity-85">
                The visitor will be notified and cleared for check-in.
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={saving}
            aria-label="Close dialog" title="Close"
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md bg-white/15 text-white hover:bg-white/25 disabled:opacity-40">
            <X size={15} aria-hidden="true" />
          </button>
        </div>
        <div className="px-5 py-4">
          <p className="text-[13px] text-slate-700 dark:text-slate-200">
            Approve appointment{' '}
            <strong className="text-sky-700 dark:text-sky-300">
              {appointmentRow.visitor?.fullName || appointmentRow.guestName || '—'} ({appointmentRow.id})
            </strong>?
          </p>
          <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">
            Scheduled for {appointmentRow.scheduledDate || appointmentRow.date || '—'} at {appointmentRow.startTime || appointmentRow.time || '—'}.
          </p>

          <label htmlFor="approve-notes" className="mt-4 mb-1.5 block text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400">
            Approver Notes (optional)
          </label>
          <textarea id="approve-notes" value={notes}
            onChange={(e) => setNotes(e.target.value.slice(0, 500))}
            placeholder="Any instructions for reception or the visitor" rows={3} maxLength={500}
            disabled={saving}
            className="w-full rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-700 outline-none transition resize-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 disabled:opacity-40 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-200" />
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-[#142535] dark:bg-[#071220]">
          <button ref={cancelBtnRef} type="button" onClick={onClose} disabled={saving}
            className="cursor-pointer rounded-[10px] border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-[#142535] dark:bg-[#0A1828] dark:text-slate-200">
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} disabled={saving}
            className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-sky-700 bg-gradient-to-r from-sky-600 to-sky-800 px-5 py-2.5 text-[13px] font-bold text-white hover:from-sky-700 hover:to-sky-900 disabled:opacity-40">
            {saving && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
            {saving ? 'Approving…' : 'Approve'}
          </button>
        </div>
      </div>
    </div>
  );
}
