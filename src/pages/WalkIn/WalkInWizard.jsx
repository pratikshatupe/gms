import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X, ChevronLeft, ChevronRight, Loader2, CheckCircle2,
} from 'lucide-react';
import { Toast } from '../../components/ui';
import { useCollection, STORAGE_KEYS } from '../../store';
import {
  MOCK_APPOINTMENTS, stampLegacyAliases,
} from '../../data/mockAppointments';
import {
  MOCK_OFFICES, MOCK_STAFF, MOCK_ROOMS, MOCK_ORGANIZATIONS,
} from '../../data/mockData';
import { addAuditLog } from '../../utils/auditLogger';
import { useNotificationTriggers } from '../../utils/notificationTriggers';
import {
  byOrg, detectRoomConflict, todayIso as aptTodayIso, to12hAmPm,
} from '../../utils/appointmentState';
import {
  generateBadgeNumber, hhmm, addMinutesHhmm,
} from '../../utils/walkInHelpers';
import VerifyDetailsStep, { validateStep1 } from './VerifyDetailsStep';
import CapturePhotoStep from './CapturePhotoStep';
import IdProofStep, { validateStep3 } from './IdProofStep';
import VisitorBadge, { badgeFromAppointment } from '../../components/VisitorBadge';


export const STEPS = Object.freeze([
  { key: 'verify',  label: 'Verify Details' },
  { key: 'photo',   label: 'Capture Photo' },
  { key: 'id',      label: 'ID Proof' },
]);

const WALKIN_DEFAULT_MINS = 60;

function emptyWalkInShape() {
  const now = new Date();
  const start = hhmm(now);
  const end   = addMinutesHhmm(start, WALKIN_DEFAULT_MINS);
  return {
    officeId: '', hostUserId: '', roomId: '',
    visitor: {
      fullName: '', emailId: '', contactNumber: '', companyName: '',
      designation: '', visitorType: 'Regular',
      accompanyingCount: 0,
      photoDataUrl: '',
      idType: '', idNumber: '', idNumberDisplay: '',
      idImageDataUrl: '',
    },
    purpose: '',
    scheduledDate: aptTodayIso(),
    startTime: start, endTime: end,
    servicesPrebooked: [],
    notes: '',
  };
}

export default function WalkInWizard({
  open, onClose, onCheckedIn, currentUser,
}) {
  const [appointments, addAppt] = useCollection(STORAGE_KEYS.APPOINTMENTS, MOCK_APPOINTMENTS);
  const { fireWalkInArrived }   = useNotificationTriggers();
  const [officesAll] = useCollection(STORAGE_KEYS.OFFICES,       MOCK_OFFICES);
  const [staffAll]   = useCollection(STORAGE_KEYS.STAFF,         MOCK_STAFF);
  const [roomsAll]   = useCollection(STORAGE_KEYS.ROOMS,         MOCK_ROOMS);
  const [orgsAll]    = useCollection(STORAGE_KEYS.ORGANIZATIONS, MOCK_ORGANIZATIONS);
  const orgId = currentUser?.organisationId || currentUser?.orgId || null;

  const userOffices = useMemo(
    () => byOrg(officesAll, currentUser)
      .filter((o) => String(o?.status || 'Active') !== 'Inactive')
      .sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [officesAll, currentUser],
  );
  const orgStaff = useMemo(() => byOrg(staffAll, currentUser), [staffAll, currentUser]);
  const orgRooms = useMemo(() => byOrg(roomsAll, currentUser), [roomsAll, currentUser]);
  const orgAppointments = useMemo(() => byOrg(appointments, currentUser), [appointments, currentUser]);
  const org = useMemo(() => (orgsAll || []).find((o) => o?.id === orgId) || null, [orgsAll, orgId]);

  const [stepIndex, setStep] = useState(0);
  const [form, setForm]      = useState(() => {
    const base = emptyWalkInShape();
   
    const sessionOffice = currentUser?.officeId;
    if (sessionOffice && sessionOffice !== 'all'
        && userOffices.some((o) => o?.id === sessionOffice)) {
      base.officeId = sessionOffice;
    } else if (userOffices.length === 1) {
      base.officeId = userOffices[0].id;
    }
    return base;
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast]   = useState(null);
  const [createdAppt, setCreated] = useState(null);
  const [badgeOpen, setBadgeOpen] = useState(false);
  const closeBtnRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const base = emptyWalkInShape();
    const sessionOffice = currentUser?.officeId;
    if (sessionOffice && sessionOffice !== 'all'
        && userOffices.some((o) => o?.id === sessionOffice)) {
      base.officeId = sessionOffice;
    } else if (userOffices.length === 1) {
      base.officeId = userOffices[0].id;
    }
    setForm(base);
    setErrors({});
    setStep(0);
    setSaving(false);
    setCreated(null);
    setBadgeOpen(false);
  }, [open, userOffices, currentUser]);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape' && !saving && !badgeOpen) onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, saving, badgeOpen, onClose]);

  if (!open) return null;

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

  const onRequestTypeChange = (newType) => {
    setForm((f) => ({
      ...f,
      visitor: { ...f.visitor, visitorType: newType },
      ...(newType === 'Delivery'
        ? { hostUserId: '', roomId: '', servicesPrebooked: [] }
        : {}),
    }));
  };

  const currentOffice = userOffices.find((o) => o?.id === form.officeId);
  const currentRoom   = (orgRooms || []).find((r) => r?.id === form.roomId) || null;

  const roomConflict = useMemo(() => {
    if (!form.roomId) return null;
    const conflicts = detectRoomConflict(form, orgAppointments);
    if (!conflicts.length) return null;
    const c = conflicts[0];
    return {
      roomName:            currentRoom?.name,
      conflictingVisitor:  c.visitor?.fullName || c.guestName || 'another visitor',
      startTime:           c.startTime,
      endTime:             c.endTime,
      conflictId:          c.id,
    };
  }, [form, orgAppointments, currentRoom]);

  const goBack = () => {
    if (stepIndex === 0) onClose?.();
    else setStep((i) => Math.max(0, i - 1));
  };

  const goNext = () => {
    if (stepIndex === 0) {
      const e = validateStep1(form);
      if (!form.officeId) e.officeId = 'Office is required.';
      if (Object.keys(e).length) {
        setErrors(e);
        setToast({ type: 'error', msg: 'Please fix the highlighted fields and try again.' });
        return;
      }
    }
    if (stepIndex === 2) {
      return;
    }
    setErrors({});
    setStep((i) => Math.min(STEPS.length - 1, i + 1));
  };

  const handleCheckIn = async () => {
    if (saving) return;
    const step3Err = validateStep3(form, org?.country);
    if (step3Err) {
      setErrors(step3Err);
      setToast({ type: 'error', msg: 'Please fix the highlighted fields or skip this step.' });
      return;
    }
    setSaving(true);
    setErrors({});
    await new Promise((r) => setTimeout(r, 800));

    const nextSeq = (appointments || [])
      .map((a) => Number(String(a?.id || '').replace(/\D/g, '')))
      .filter((n) => Number.isFinite(n))
      .reduce((a, b) => Math.max(a, b), 0) + 1;
    const id = `APT-${String(nextSeq).padStart(5, '0')}`;
    const badgeNumber = generateBadgeNumber();
    const now = new Date().toISOString();
    const author = currentUser?.name || 'Reception';

    const record = stampLegacyAliases({
      id,
      orgId,
      officeId:   form.officeId,
      roomId:     form.roomId || null,
      hostUserId: form.hostUserId || null,
      visitor:    { ...form.visitor },
      purpose:    form.purpose.trim(),
      scheduledDate: form.scheduledDate,
      startTime:  form.startTime,
      endTime:    form.endTime,
      servicesPrebooked: [],
      notes:      (form.notes || '').trim(),
      invitation: { sendEmail: false, includeQRCode: true, smsReminder: false },
      status:     'Checked-In',
      approvalRequired: false,
      approvalMode:     null,
      approvedAt: now,
      approvedBy: 'System (walk-in)',
      checkedInAt: now,
      checkedInBy: author,
      checkedOutAt: null, checkedOutBy: null,
      startedAt: null, startedBy: null,
      cancelledAt: null, cancelledBy: null, cancellationReason: null,
      noShowAt: null, noShowBy: null,
      feedback: null,
      isWalkIn:    true,
      isRecurring: false,
      badgeNumber,
      createdAt: now, createdBy: author,
      updatedAt: now, updatedBy: author,
    }, orgStaff);

    addAppt(record);

    addAuditLog({
      userName:    author,
      role:        (currentUser?.role || '').toString(),
      action:      'WALKIN_CREATED',
      module:      'Walk-In',
      description: `Checked in walk-in visitor ${record.visitor.fullName} at ${currentOffice?.name || form.officeId}. Badge ${badgeNumber}.`,
      orgId,
    });

    if (form.visitor?.photoDataUrl) {
      addAuditLog({
        userName: author, role: (currentUser?.role || '').toString(),
        action: 'PHOTO_CAPTURED', module: 'Walk-In',
        description: `Photo captured for walk-in ${id}.`,
        orgId,
      });
    }
    if (form.visitor?.idType && form.visitor?.idNumber) {
      addAuditLog({
        userName: author, role: (currentUser?.role || '').toString(),
        action: 'ID_CAPTURED', module: 'Walk-In',
        description: `${form.visitor.idType} captured for walk-in ${id}.`,
        orgId,
      });
    }
    if (roomConflict) {
      addAuditLog({
        userName: author, role: (currentUser?.role || '').toString(),
        action: 'WALKIN_ROOM_CONFLICT', module: 'Walk-In',
        description: `Walk-in ${id} assigned to room ${currentRoom?.name || form.roomId} despite conflict with ${roomConflict.conflictId}.`,
        orgId,
      });
    }

    const hostStaff = (orgStaff || []).find((s) => s?.id === form.hostUserId);
    fireWalkInArrived({
      visitor: {
        name:     record.visitor.fullName,
        company:  record.visitor.company,
        purpose:  record.purpose,
        arrivedAt: to12hAmPm(record.startTime),
        organisationId: orgId,
      },
      host: hostStaff
        ? { id: hostStaff.id, name: hostStaff.name, email: hostStaff.email }
        : null,
      org,
    });

    setCreated(record);
    setSaving(false);
    setBadgeOpen(true);
  };

  const stepTitle  = STEPS[stepIndex]?.label;
  const isLastStep = stepIndex === STEPS.length - 1;

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="walkin-title"
        onMouseDown={(e) => { if (e.target === e.currentTarget && !saving && !badgeOpen) onClose?.(); }}
        className="fixed inset-0 z-[9100] flex justify-end bg-black/45"
      >
        <aside
          className="flex h-full w-full max-w-[760px] flex-col bg-white shadow-2xl dark:bg-[#0A1828] sm:w-[760px]"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="border-b border-slate-200 bg-gradient-to-r from-sky-700 to-sky-800 px-5 py-4 text-white dark:border-[#142535]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 id="walkin-title" className="font-[Outfit,sans-serif] text-[16px] font-extrabold leading-tight">
                  Walk-In Check-In
                </h2>
                <p className="mt-0.5 text-[12px] opacity-85">
                  Step {stepIndex + 1} of {STEPS.length} · {stepTitle}
                </p>
              </div>
              <button
                ref={closeBtnRef} type="button" onClick={onClose} disabled={saving}
                aria-label="Cancel walk-in" title="Cancel"
                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md bg-white/15 text-white transition hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-40">
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            <div role="progressbar"
              aria-valuemin={0} aria-valuemax={STEPS.length} aria-valuenow={stepIndex + 1}
              className="mt-3 flex items-center gap-2">
              {STEPS.map((s, i) => {
                const done    = i < stepIndex;
                const current = i === stepIndex;
                return (
                  <div key={s.key} className="flex min-w-0 flex-1 items-center gap-2">
                    <span
                      aria-hidden="true"
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-extrabold ${done
                        ? 'bg-emerald-500 text-white'
                        : current
                          ? 'bg-white text-sky-800'
                          : 'bg-white/20 text-white/70'}`}>
                      {done ? '✓' : i + 1}
                    </span>
                    <span className={`truncate text-[11px] font-semibold ${current ? 'text-white' : 'text-white/70'}`}>
                      {s.label}
                    </span>
                    {i < STEPS.length - 1 && (
                      <span aria-hidden="true" className={`h-[2px] flex-1 rounded-full ${done ? 'bg-emerald-400' : 'bg-white/20'}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            {stepIndex === 0 && (
              <VerifyDetailsStep
                form={form} errors={errors} setField={setField}
                onRequestTypeChange={onRequestTypeChange}
                orgStaff={orgStaff} orgRooms={orgRooms} office={currentOffice}
                roomConflict={roomConflict}
                userOffices={userOffices}
              />
            )}
            {stepIndex === 1 && (
              <CapturePhotoStep form={form} setField={setField} />
            )}
            {stepIndex === 2 && (
              <IdProofStep form={form} setField={setField} orgCountry={org?.country} />
            )}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-[#142535] dark:bg-[#071220]">
            <button type="button" onClick={goBack} disabled={saving}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-[10px] border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40 dark:border-[#142535] dark:bg-[#0A1828] dark:text-slate-200">
              {stepIndex === 0 ? 'Cancel' : <><ChevronLeft size={14} aria-hidden="true" /> Back</>}
            </button>
            {isLastStep ? (
              <button type="button" onClick={handleCheckIn} disabled={saving}
                className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-emerald-700 bg-emerald-600 px-5 py-2.5 text-[13px] font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-40">
                {saving ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <CheckCircle2 size={14} aria-hidden="true" />}
                {saving ? 'Checking in…' : 'Check In'}
              </button>
            ) : (
              <button type="button" onClick={goNext} disabled={saving}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-[10px] border border-sky-700 bg-gradient-to-r from-sky-600 to-sky-800 px-5 py-2.5 text-[13px] font-bold text-white shadow-sm hover:from-sky-700 hover:to-sky-900 disabled:opacity-40">
                Next <ChevronRight size={14} aria-hidden="true" />
              </button>
            )}
          </div>
        </aside>
      </div>

      {badgeOpen && createdAppt && (
        <VisitorBadge
          open
          badge={badgeFromAppointment({
            appointment: createdAppt,
            org,
            office: currentOffice,
            host: (orgStaff || []).find((s) => s?.id === createdAppt.hostUserId),
            room: (orgRooms || []).find((r) => r?.id === createdAppt.roomId),
          })}
          onClose={() => {
            setBadgeOpen(false);
            onCheckedIn?.(createdAppt);
          }}
          onPrinted={() => {
            addAuditLog({
              userName:    currentUser?.name || 'Reception',
              role:        (currentUser?.role || '').toString(),
              action:      'BADGE_PRINTED',
              module:      'Walk-In',
              description: `Badge printed for walk-in ${createdAppt.id}.`,
              orgId:       createdAppt.orgId,
            });
          }}
        />
      )}

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
}

