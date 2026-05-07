import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { useCollection, STORAGE_KEYS } from '../../store';
import { MOCK_APPOINTMENTS, stampLegacyAliases } from '../../data/mockAppointments';
import { addAuditLog } from '../../utils/auditLogger';
import { canTransition } from '../../utils/appointmentState';
import { useNotificationTriggers } from '../../utils/notificationTriggers';

/**
 * CancelAppointmentModal — red destructive confirmation. Cancellation
 * reason is required (5–500 chars). Sets status to 'Cancelled',
 * stamps cancelledAt/By and cancellationReason, logs the audit event.
 */

export default function CancelAppointmentModal({
  open, appointmentRow, onClose, onCancelled, currentUser,
}) {
  const [, , updateAppt] = useCollection(STORAGE_KEYS.APPOINTMENTS, MOCK_APPOINTMENTS);
  const { fireAppointmentCancelled } = useNotificationTriggers();

  const [reason, setReason] = useState('');
  const [error, setError]   = useState('');
  const [saving, setSaving] = useState(false);
  const cancelBtnRef        = useRef(null);

  useEffect(() => {
    if (!open) return;
    setReason('');
    setError('');
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

  const allowed = canTransition(appointmentRow.status, 'Cancelled');
  const reasonLen = reason.trim().length;

  const handleSubmit = async () => {
    if (saving) return;
    if (!allowed) {
      setError(`Appointments in status ${appointmentRow.status} cannot be cancelled.`);
      return;
    }
    if (reasonLen < 5) {
      setError('Cancellation Reason must be at least 5 characters.');
      return;
    }
    if (reasonLen > 500) {
      setError('Cancellation Reason must be 500 characters or fewer.');
      return;
    }
    setSaving(true);
    await new Promise((r) => setTimeout(r, 800));

    const now = new Date().toISOString();
    const author = currentUser?.name || 'Unknown';
    const patch = stampLegacyAliases({
      ...appointmentRow,
      status: 'Cancelled',
      cancelledAt: now,
      cancelledBy: author,
      cancellationReason: reason.trim(),
      updatedAt: now,
      updatedBy: author,
    });
    updateAppt(appointmentRow.id, patch);

    addAuditLog({
      userName:    author,
      role:        (currentUser?.role || '').toString(),
      action:      'APPOINTMENT_CANCELLED',
      module:      'Appointments',
      description: `Cancelled appointment ${appointmentRow.id} (${appointmentRow.visitor?.fullName || appointmentRow.guestName || '—'}). Reason: ${reason.trim().slice(0, 120)}.`,
      orgId:       appointmentRow.orgId,
    });

    /* Module 7 — fire cancellation notification + email preview. */
    fireAppointmentCancelled({
      apt: {
        id:           appointmentRow.id,
        visitorName:  appointmentRow.visitor?.fullName || appointmentRow.guestName,
        visitorEmail: appointmentRow.visitor?.email   || appointmentRow.guestEmail,
        date:         appointmentRow.scheduledDate || appointmentRow.date,
        timeStart:    appointmentRow.startTime     || appointmentRow.time,
        organisationId: appointmentRow.orgId,
      },
      reason: reason.trim(),
    });

    setSaving(false);
    onCancelled?.({ ...appointmentRow, ...patch });
  };

  return (
    <div role="dialog" aria-modal="true"
      aria-labelledby="cancel-apt-title"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose?.(); }}
      className="fixed inset-0 z-[9500] flex items-center justify-center bg-black/55 p-4">
      <div className="w-full max-w-md rounded-[14px] border border-slate-200 bg-white shadow-2xl dark:border-[#142535] dark:bg-[#0A1828]">
        <div className="flex items-start justify-between gap-3 border-b border-red-200 bg-red-50 px-5 py-4 dark:border-red-500/30 dark:bg-red-500/10">
          <div className="flex items-start gap-3 min-w-0">
            <span aria-hidden="true" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300">
              <AlertTriangle size={20} />
            </span>
            <div className="min-w-0">
              <h3 id="cancel-apt-title" className="font-[Outfit,sans-serif] text-[16px] font-extrabold text-red-800 dark:text-red-200">
                Cancel Appointment
              </h3>
              <p className="mt-0.5 text-[12px] font-semibold text-red-700 dark:text-red-300">
                This action cannot be undone.
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={saving}
            aria-label="Close dialog" title="Close"
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-red-700 hover:bg-red-100 disabled:opacity-40 dark:text-red-300 dark:hover:bg-red-500/20">
            <X size={15} aria-hidden="true" />
          </button>
        </div>
        <div className="px-5 py-4">
          <p className="text-[13px] text-slate-700 dark:text-slate-200">
            Cancel appointment{' '}
            <strong className="text-red-700 dark:text-red-300">
              {appointmentRow.visitor?.fullName || appointmentRow.guestName || '—'} ({appointmentRow.id})
            </strong>?
          </p>
          <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">
            A cancellation email preview will be logged to the console. Final email delivery ships with the mailer service.
          </p>

          <label htmlFor="cancel-reason" className="mt-4 mb-1.5 block text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400">
            Cancellation Reason<span aria-hidden="true" className="text-red-500">*</span>
          </label>
          <textarea id="cancel-reason" value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 500))}
            placeholder="Enter Cancellation Reason (minimum 5 characters)"
            rows={3} maxLength={500} disabled={saving}
            className={`w-full rounded-[10px] border bg-white px-3 py-2 text-[13px] text-slate-700 outline-none transition resize-none focus:border-red-500 focus:ring-2 focus:ring-red-100 disabled:opacity-40 dark:bg-[#071220] dark:text-slate-200 ${error ? 'border-red-400 dark:border-red-500/40' : 'border-slate-200 dark:border-[#142535]'}`} />
          <p className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
            <span>{reasonLen} / 500 characters.</span>
          </p>
          {error && (
            <p role="alert" className="mt-2 text-[12px] font-semibold text-red-500">{error}</p>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-[#142535] dark:bg-[#071220]">
          <button ref={cancelBtnRef} type="button" onClick={onClose} disabled={saving}
            className="cursor-pointer rounded-[10px] border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-[#142535] dark:bg-[#0A1828] dark:text-slate-200">
            Keep Appointment
          </button>
          <button type="button" onClick={handleSubmit} disabled={saving || !allowed}
            className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-red-700 bg-red-600 px-5 py-2.5 text-[13px] font-bold text-white hover:bg-red-700 disabled:opacity-40">
            {saving && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
            {saving ? 'Cancelling…' : 'Cancel Appointment'}
          </button>
        </div>
      </div>
    </div>
  );
}
