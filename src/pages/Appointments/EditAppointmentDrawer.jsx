import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Toast } from '../../components/ui';
import { useCollection, STORAGE_KEYS } from '../../store';
import {
  MOCK_APPOINTMENTS, stampLegacyAliases,
} from '../../data/mockAppointments';
import {
  MOCK_ORGANIZATIONS, MOCK_OFFICES, MOCK_STAFF, MOCK_ROOMS, MOCK_SERVICES,
} from '../../data/mockData';
import { addAuditLog } from '../../utils/auditLogger';
import {
  byOrg, LOCKED_FOR_EDIT, detectRoomConflict, detectHostConflict, to12hAmPm,
} from '../../utils/appointmentState';
import { resolveCurrencyForOrg } from '../Services/AddServiceDrawer';
import {
  validateAppointmentForm, emptyAppointmentShape,
  Header, Footer, AppointmentFormBody,
} from './AddAppointmentDrawer';

/**
 * EditAppointmentDrawer — pre-hydrates all fields, blocks edits once
 * the appointment reaches Checked-In / In-Progress / Completed /
 * Cancelled / No-Show. Re-asserts id, orgId, officeId on patch so
 * tampered DOM values cannot re-parent the record.
 */

function hydrate(row) {
  if (!row) return emptyAppointmentShape();
  const base = emptyAppointmentShape();
  return {
    ...base,
    officeId:    row.officeId    || '',
    hostUserId:  row.hostUserId  || '',
    roomId:      row.roomId      || '',
    visitor: {
      ...base.visitor,
      ...(row.visitor || {}),
    },
    purpose:     row.purpose       || '',
    scheduledDate: row.scheduledDate || row.date || base.scheduledDate,
    startTime:   row.startTime     || row.time  || base.startTime,
    endTime:     row.endTime       || base.endTime,
    servicesPrebooked: Array.isArray(row.servicesPrebooked) ? [...row.servicesPrebooked] : [],
    notes:       row.notes         || '',
    invitation:  { ...base.invitation, ...(row.invitation || {}) },
  };
}

function diffSummary(before, after) {
  const lines = [];
  const keys = ['officeId', 'hostUserId', 'roomId', 'purpose', 'scheduledDate', 'startTime', 'endTime'];
  for (const k of keys) {
    if ((before?.[k] || '') !== (after?.[k] || '')) {
      lines.push(`${k}: ${before?.[k] || '—'} → ${after?.[k] || '—'}`);
    }
  }
  if ((before?.visitor?.fullName || '') !== (after?.visitor?.fullName || '')) lines.push('visitor.fullName updated');
  if (JSON.stringify((before?.servicesPrebooked || []).slice().sort()) !== JSON.stringify((after?.servicesPrebooked || []).slice().sort())) lines.push('servicesPrebooked updated');
  return lines.join('; ');
}

export default function EditAppointmentDrawer({
  open, appointmentRow, onClose, onUpdated, currentUser,
}) {
  const [appointments, , updateAppt] = useCollection(STORAGE_KEYS.APPOINTMENTS, MOCK_APPOINTMENTS);
  const [officesAll]  = useCollection(STORAGE_KEYS.OFFICES,       MOCK_OFFICES);
  const [staffAll]    = useCollection(STORAGE_KEYS.STAFF,         MOCK_STAFF);
  const [roomsAll]    = useCollection(STORAGE_KEYS.ROOMS,         MOCK_ROOMS);
  const [servicesAll] = useCollection(STORAGE_KEYS.SERVICES,      MOCK_SERVICES);
  const [orgsAll]     = useCollection(STORAGE_KEYS.ORGANIZATIONS, MOCK_ORGANIZATIONS);

  const userOffices = useMemo(
    () => byOrg(officesAll, currentUser)
      .sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [officesAll, currentUser],
  );
  const orgStaff = useMemo(() => byOrg(staffAll, currentUser), [staffAll, currentUser]);
  const orgRooms = useMemo(() => byOrg(roomsAll, currentUser), [roomsAll, currentUser]);
  const orgServices = useMemo(() => byOrg(servicesAll, currentUser), [servicesAll, currentUser]);
  const orgAppointments = useMemo(() => byOrg(appointments, currentUser), [appointments, currentUser]);
  const org = useMemo(
    () => (orgsAll || []).find((o) => o?.id === appointmentRow?.orgId) || null,
    [orgsAll, appointmentRow],
  );
  const currency = resolveCurrencyForOrg(org);

  const [form, setForm]     = useState(() => hydrate(appointmentRow));
  const [errors, setErrors] = useState({});
  const [allowDoubleBook, setAllowDouble] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast]   = useState(null);
  const closeBtnRef         = useRef(null);

  const locked = LOCKED_FOR_EDIT.has(appointmentRow?.status);

  useEffect(() => {
    if (!open) return;
    setForm(hydrate(appointmentRow));
    setErrors({});
    setSaving(false);
    setAllowDouble(false);
  }, [open, appointmentRow]);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape' && !saving) onClose?.(); };
    document.addEventListener('keydown', onKey);
    const t = window.setTimeout(() => closeBtnRef.current?.focus(), 30);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
      window.clearTimeout(t);
    };
  }, [open, saving, onClose]);

  if (!open || !appointmentRow) return null;

  const setField = (path, value) => {
    setForm((f) => {
      const next = { ...f };
      const parts = path.split('.');
      if (parts.length === 1) next[parts[0]] = value;
      else next[parts[0]] = { ...next[parts[0]], [parts[1]]: value };
      return next;
    });
    if (errors[path]) {
      setErrors((e) => { const n = { ...e }; delete n[path]; return n; });
    }
  };

  const toggleService = (svcId) => {
    setForm((f) => {
      const set = new Set(f.servicesPrebooked || []);
      if (set.has(svcId)) set.delete(svcId); else set.add(svcId);
      return { ...f, servicesPrebooked: [...set] };
    });
  };

  /* No visitor-type change post-create either — keep the flow simple. */
  const onRequestTypeChange = (newType) => {
    setField('visitor.visitorType', newType);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving || locked) return;
    const e = validateAppointmentForm(form);
    if (Object.keys(e).length) {
      setErrors(e);
      setToast({ type: 'error', msg: 'Please fix the highlighted fields and try again.' });
      return;
    }
    const roomConflicts = detectRoomConflict(form, orgAppointments, { excludeId: appointmentRow.id });
    const hostConflicts = detectHostConflict(form, orgAppointments, { excludeId: appointmentRow.id });
    if (!allowDoubleBook && (roomConflicts.length || hostConflicts.length)) {
      const nextErrors = { __conflict: true };
      if (roomConflicts.length) {
        const c = roomConflicts[0];
        const roomName = (orgRooms.find((r) => r.id === form.roomId) || {}).name || 'This room';
        nextErrors.roomId = `${roomName} is booked by ${c.visitor?.fullName || 'another visitor'} ${to12hAmPm(c.startTime)} – ${to12hAmPm(c.endTime)}.`;
      }
      if (hostConflicts.length) {
        const c = hostConflicts[0];
        const hostName = (orgStaff.find((s) => s.id === form.hostUserId) || {}).fullName || 'The host';
        nextErrors.hostUserId = `${hostName} has another meeting ${to12hAmPm(c.startTime)} – ${to12hAmPm(c.endTime)}.`;
      }
      setErrors(nextErrors);
      setToast({ type: 'error', msg: 'Scheduling conflict detected. Review the flagged fields.' });
      return;
    }

    setSaving(true);
    await new Promise((r) => setTimeout(r, 800));

    const now = new Date().toISOString();
    const author = currentUser?.name || 'Unknown';

    const patch = stampLegacyAliases({
      /* Immutable — re-assert from original record. */
      id:       appointmentRow.id,
      orgId:    appointmentRow.orgId,

      officeId:    form.officeId,
      roomId:      form.roomId || null,
      hostUserId:  form.hostUserId || null,
      visitor:     { ...form.visitor },
      purpose:     form.purpose.trim(),
      scheduledDate: form.scheduledDate,
      startTime:   form.startTime,
      endTime:     form.endTime,
      servicesPrebooked: [...(form.servicesPrebooked || [])],
      notes:       (form.notes || '').trim(),
      invitation:  { ...form.invitation },
      updatedAt:   now,
      updatedBy:   author,
    });

    updateAppt(appointmentRow.id, patch);

    const summary = diffSummary(appointmentRow, { ...appointmentRow, ...patch });
    addAuditLog({
      userName:    author,
      role:        (currentUser?.role || '').toString(),
      action:      'APPOINTMENT_UPDATED',
      module:      'Appointments',
      description: `Updated appointment ${appointmentRow.id}${summary ? ` — ${summary}` : ''}.`,
      orgId:       appointmentRow.orgId,
    });

    if (allowDoubleBook && (roomConflicts.length || hostConflicts.length)) {
      addAuditLog({
        userName:    author,
        role:        (currentUser?.role || '').toString(),
        action:      roomConflicts.length ? 'APPOINTMENT_DOUBLE_BOOKED' : 'HOST_DOUBLE_BOOKED',
        module:      'Appointments',
        description: `Double-book override on edit of ${appointmentRow.id}.`,
        orgId:       appointmentRow.orgId,
      });
    }

    setSaving(false);
    onUpdated?.({ ...appointmentRow, ...patch });
  };

  return (
    <>
      <div role="dialog" aria-modal="true"
        onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose?.(); }}
        className="fixed inset-0 z-[9100] flex justify-end bg-black/45">
        <aside className="flex h-full w-full max-w-[760px] flex-col bg-white shadow-2xl dark:bg-[#0A1828] sm:w-[760px]"
          onMouseDown={(e) => e.stopPropagation()}>
          <Header
            closeBtnRef={closeBtnRef}
            title={`Edit Appointment — ${appointmentRow.id}`}
            subtitle={locked ? `This appointment is ${appointmentRow.status} and cannot be edited.` : 'Update visitor, meeting, or service details.'}
            onClose={onClose}
            disabled={saving}
          />
          {locked ? (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-8">
                <div className="rounded-[12px] border border-amber-200 bg-amber-50 px-4 py-6 text-center dark:border-amber-500/30 dark:bg-amber-500/10">
                  <AlertTriangle size={28} aria-hidden="true" className="mx-auto mb-2 text-amber-600 dark:text-amber-400" />
                  <p className="text-[14px] font-bold text-amber-800 dark:text-amber-200">
                    Edits are locked for {appointmentRow.status} appointments.
                  </p>
                  <p className="mt-1 text-[12px] text-amber-700 dark:text-amber-300">
                    Use the detail page to record feedback, check-out, or mark no-show instead.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-[#142535] dark:bg-[#071220]">
                <button type="button" onClick={onClose}
                  className="cursor-pointer rounded-[10px] border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-[#142535] dark:bg-[#0A1828] dark:text-slate-200">
                  Close
                </button>
              </div>
            </>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
                <AppointmentFormBody
                  form={form}
                  errors={errors}
                  setField={setField}
                  onRequestTypeChange={onRequestTypeChange}
                  onToggleService={toggleService}
                  userOffices={userOffices}
                  orgStaff={orgStaff}
                  orgRooms={orgRooms}
                  orgServices={orgServices}
                  org={org}
                  currency={currency}
                  mode="edit"
                />
                {errors.__conflict && !allowDoubleBook && (
                  <div className="mt-3 rounded-[10px] border border-amber-300 bg-amber-50 px-3 py-2 dark:border-amber-500/30 dark:bg-amber-500/10">
                    <p className="text-[12px] font-bold text-amber-800 dark:text-amber-200">Scheduling conflict detected.</p>
                    <button type="button" onClick={() => { setAllowDouble(true); setErrors({}); }}
                      className="mt-2 inline-flex cursor-pointer items-center rounded-[8px] border border-sky-700 bg-sky-50 px-3 py-1 text-[11px] font-bold text-sky-700 hover:bg-sky-100 dark:border-sky-400/40 dark:bg-sky-500/15 dark:text-sky-300">
                      Proceed anyway
                    </button>
                  </div>
                )}
              </div>
              <Footer saving={saving} submitLabel="Save Changes" onCancel={onClose} />
            </form>
          )}
        </aside>
      </div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
}
