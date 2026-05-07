import React, { useMemo, useState } from 'react';
import {
  ArrowLeft, Calendar, UserRound, Mail, Phone, Building2, DoorOpen,
  Sparkles, CheckCircle2, XCircle, LogIn, LogOut, Play, Pencil,
  BadgeCheck, Star, AlertTriangle, Printer, Send,
} from 'lucide-react';
import { useCollection, STORAGE_KEYS } from '../../store';
import { MOCK_APPOINTMENTS, stampLegacyAliases } from '../../data/mockAppointments';
import {
  MOCK_ORGANIZATIONS, MOCK_OFFICES, MOCK_STAFF, MOCK_ROOMS, MOCK_SERVICES,
} from '../../data/mockData';
import { addAuditLog } from '../../utils/auditLogger';
import { Toast } from '../../components/ui';
import {
  canTransition, nextAllowedStates, canApprove, displayStatus,
  isUpcoming, isOverdue, to12hAmPm, formatAppointmentTime,
  formatDateGB, formatDateTime, getTimezoneAbbr,
} from '../../utils/appointmentState';
import {
  resolveCurrencyForOrg, formatServicePrice,
} from '../Services/AddServiceDrawer';
import CancelAppointmentModal from './CancelAppointmentModal';
import ApproveAppointmentModal from './ApproveAppointmentModal';
import VisitorBadge, { badgeFromAppointment } from '../../components/VisitorBadge';

/**
 * AppointmentDetailPage — full timeline view for a single appointment.
 *
 * Left 40%: Visitor / Meeting / Services / Host cards.
 * Right 60%: Status timeline + Quick Actions + Audit strip.
 * Bottom (when status === 'Completed'): Feedback card with star rating.
 *
 * Quick Actions surface the next-allowed state transitions driven by
 * appointmentState.nextAllowedStates / canTransition / canApprove.
 * Actions that don't apply to the current status are hidden, not
 * disabled — keeps the UI clean and drives operators down the legal
 * state machine path.
 */

const TIMELINE_STEPS = [
  { status: 'Pending',     label: 'Pending',     Icon: AlertTriangle },
  { status: 'Approved',    label: 'Approved',    Icon: CheckCircle2 },
  { status: 'Checked-In',  label: 'Checked-In',  Icon: LogIn },
  { status: 'In-Progress', label: 'In-Progress', Icon: Play },
  { status: 'Completed',   label: 'Completed',   Icon: LogOut },
];

function timelineIndexFor(status) {
  if (status === 'Cancelled' || status === 'No-Show') return -1;
  return TIMELINE_STEPS.findIndex((s) => s.status === status);
}

export default function AppointmentDetailPage({
  appointmentRow, onBack, onEdit, canEdit, currentUser,
}) {
  const [, , updateAppt] = useCollection(STORAGE_KEYS.APPOINTMENTS, MOCK_APPOINTMENTS);
  const [officesAll]  = useCollection(STORAGE_KEYS.OFFICES, MOCK_OFFICES);
  const [staffAll]    = useCollection(STORAGE_KEYS.STAFF,   MOCK_STAFF);
  const [roomsAll]    = useCollection(STORAGE_KEYS.ROOMS,   MOCK_ROOMS);
  const [servicesAll] = useCollection(STORAGE_KEYS.SERVICES,MOCK_SERVICES);
  const [orgsAll]     = useCollection(STORAGE_KEYS.ORGANIZATIONS, MOCK_ORGANIZATIONS);

  const [showCancel, setCancel]   = useState(false);
  const [showApprove, setApprove] = useState(false);
  const [toast, setToast]         = useState(null);
  const [badgeRow, setBadgeRow]   = useState(null);
  const [resendOpen, setResendOpen] = useState(false);
  const showToast = (msg, type = 'success') => setToast({ msg, type });

  const office   = useMemo(() => (officesAll  || []).find((o) => o?.id === appointmentRow?.officeId) || null, [officesAll,  appointmentRow]);
  const host     = useMemo(() => (staffAll    || []).find((s) => s?.id === appointmentRow?.hostUserId) || null, [staffAll,   appointmentRow]);
  const room     = useMemo(() => (roomsAll    || []).find((r) => r?.id === appointmentRow?.roomId) || null, [roomsAll,   appointmentRow]);
  const services = useMemo(() => {
    const ids = appointmentRow?.servicesPrebooked || [];
    return ids.map((id) => (servicesAll || []).find((s) => s?.id === id)).filter(Boolean);
  }, [servicesAll, appointmentRow]);
  const org = useMemo(() => (orgsAll || []).find((o) => o?.id === appointmentRow?.orgId) || null, [orgsAll, appointmentRow]);
  const currency = resolveCurrencyForOrg(org);

  if (!appointmentRow) {
    return (
      <div className="px-4 py-8 sm:px-6">
        <p className="text-[13px] text-slate-500">Appointment not found.</p>
      </div>
    );
  }

  const status     = appointmentRow.status;
  const disp       = displayStatus(appointmentRow);
  const terminal   = status === 'Cancelled' || status === 'No-Show';
  const tlIndex    = timelineIndexFor(status);
  const isVip      = appointmentRow.visitor?.visitorType === 'VIP';
  const canOp      = String(currentUser?.role || '').toLowerCase();
  const canAct     = canOp !== 'superadmin';   /* SuperAdmin read-only on tenant operations */
  const approveOk  = status === 'Pending' && canAct && canApprove({
    apt: appointmentRow, user: currentUser, orgStaff: staffAll,
  });

  const allowed = new Set(nextAllowedStates(appointmentRow));

  /* ── State transitions ──────────────────────────────────────── */

  const doPatch = async (patch, auditAction, description) => {
    await new Promise((r) => setTimeout(r, 800));
    const now = new Date().toISOString();
    const author = currentUser?.name || 'Unknown';
    const next = stampLegacyAliases({
      ...appointmentRow,
      ...patch,
      updatedAt: now,
      updatedBy: author,
    });
    updateAppt(appointmentRow.id, next);
    addAuditLog({
      userName:    author,
      role:        canOp,
      action:      auditAction,
      module:      'Appointments',
      description,
      orgId:       appointmentRow.orgId,
    });
    return next;
  };

  const handleCheckIn = async () => {
    if (!allowed.has('Checked-In')) return;
    const now = new Date().toISOString();
    await doPatch(
      { status: 'Checked-In', checkedInAt: now, checkedInBy: currentUser?.name || 'Unknown' },
      'APPOINTMENT_CHECKED_IN',
      `Checked in ${appointmentRow.visitor?.fullName || appointmentRow.guestName || '—'} for appointment ${appointmentRow.id}.`,
    );
    showToast(`${appointmentRow.visitor?.fullName || 'Visitor'} checked in successfully.`);
  };

  const handleStartMeeting = async () => {
    if (!allowed.has('In-Progress')) return;
    const now = new Date().toISOString();
    await doPatch(
      { status: 'In-Progress', startedAt: now, startedBy: currentUser?.name || 'Unknown' },
      'APPOINTMENT_STARTED',
      `Started meeting for appointment ${appointmentRow.id}.`,
    );
    showToast('Meeting started successfully.');
  };

  const handleCheckOut = async () => {
    if (!allowed.has('Completed')) return;
    const now = new Date().toISOString();
    await doPatch(
      { status: 'Completed', checkedOutAt: now, checkedOutBy: currentUser?.name || 'Unknown' },
      'APPOINTMENT_CHECKED_OUT',
      `Checked out ${appointmentRow.visitor?.fullName || appointmentRow.guestName || '—'} for appointment ${appointmentRow.id}.`,
    );
    showToast(`${appointmentRow.visitor?.fullName || 'Visitor'} checked out successfully.`);
  };

  const handleMarkNoShow = async () => {
    if (!canTransition(status, 'No-Show')) return;
    if (!isOverdue(appointmentRow)) {
      showToast('This appointment is not yet overdue.', 'info');
      return;
    }
    const now = new Date().toISOString();
    await doPatch(
      { status: 'No-Show', noShowAt: now, noShowBy: currentUser?.name || 'Unknown' },
      'APPOINTMENT_NOSHOW',
      `Marked appointment ${appointmentRow.id} as No-Show.`,
    );
    showToast('Appointment marked as No-Show.');
  };

  return (
    <div className="w-full min-w-0">
      {/* Top bar */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <button type="button" onClick={onBack} title="Back to Appointments"
            className="mb-2 inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-[#142535] dark:bg-[#0A1828] dark:text-slate-300">
            <ArrowLeft size={13} aria-hidden="true" /> Back to Appointments
          </button>
          <h1 className="font-[Outfit,sans-serif] text-[22px] font-extrabold leading-tight text-[#0C2340] dark:text-slate-100">
            {appointmentRow.visitor?.fullName || appointmentRow.guestName || '—'}
            {isVip && <span className="ml-2 inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">⭐ VIP</span>}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-slate-500 dark:text-slate-400">
            <span className="font-mono font-bold text-slate-700 dark:text-slate-200">{appointmentRow.id}</span>
            <span aria-hidden="true">·</span>
            <span>{formatDateGB(appointmentRow.scheduledDate || appointmentRow.date)}</span>
            <span aria-hidden="true">·</span>
            <span>{formatAppointmentTime(appointmentRow, office)}</span>
            <span aria-hidden="true">·</span>
            <StatusPill label={disp.label} tone={disp.tone} />
          </div>
        </div>
        {canEdit && !terminal && (
          <button type="button" onClick={onEdit} title="Edit this appointment"
            className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-sky-700 bg-gradient-to-r from-sky-600 to-sky-800 px-4 py-2 text-[13px] font-bold text-white hover:from-sky-700 hover:to-sky-900">
            <Pencil size={13} aria-hidden="true" /> Edit
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* LEFT 40% */}
        <div className="flex flex-col gap-4">
          <Card Icon={UserRound} title="Visitor">
            <Pair label="Full Name" value={appointmentRow.visitor?.fullName || '—'} />
            <Pair label="Visitor Type" value={appointmentRow.visitor?.visitorType || '—'} />
            <Pair label="Email ID" value={appointmentRow.visitor?.emailId || '—'} mono Icon={Mail}
                  action={appointmentRow.visitor?.emailId ? <a href={`mailto:${appointmentRow.visitor.emailId}`} className="text-[11px] font-bold text-sky-700 hover:underline dark:text-sky-300">Send email</a> : null} />
            <Pair label="Contact Number" value={appointmentRow.visitor?.contactNumber || '—'} mono Icon={Phone} />
            <Pair label="Company" value={appointmentRow.visitor?.companyName || '—'} />
            <Pair label="Designation" value={appointmentRow.visitor?.designation || '—'} />
            {appointmentRow.visitor?.visitorType !== 'Delivery' && (
              <Pair label="Accompanying" value={Number(appointmentRow.visitor?.accompanyingCount || 0).toLocaleString('en-GB')} />
            )}
          </Card>

          <Card Icon={Calendar} title="Meeting">
            <Pair label="Office" value={office ? `${office.name} (${office.code})` : '—'} Icon={Building2} />
            <Pair label="Date" value={formatDateGB(appointmentRow.scheduledDate || appointmentRow.date)} />
            <Pair label="Time" value={formatAppointmentTime(appointmentRow, office)} />
            <Pair label="Timezone" value={getTimezoneAbbr(office?.operations?.timezone)} />
            {appointmentRow.visitor?.visitorType !== 'Delivery' && (
              <Pair label="Room" value={room ? `${room.name} · seats ${room.seatingCapacity}` : '—'} Icon={DoorOpen} />
            )}
            <Pair label="Purpose" value={appointmentRow.purpose || '—'} />
            {appointmentRow.notes && <Pair label="Notes" value={appointmentRow.notes} />}
          </Card>

          {services.length > 0 && (
            <Card Icon={Sparkles} title="Services">
              <ul className="space-y-1.5">
                {services.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 border-b border-slate-100 py-1 last:border-b-0 dark:border-[#142535]">
                    <span className="inline-flex items-center gap-2 text-[12px] font-semibold text-slate-700 dark:text-slate-200">
                      <span aria-hidden="true">{s.icon || '•'}</span>{s.name}
                    </span>
                    <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      {s.chargeable ? formatServicePrice(s.price, currency) : 'Free'}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card Icon={UserRound} title="Host">
            <Pair label="Name" value={host ? (host.fullName || host.name) : (appointmentRow.host || '—')} />
            <Pair label="Role" value={host?.role || '—'} />
            <Pair label="Email ID" value={host?.emailId || '—'} mono Icon={Mail} />
          </Card>
        </div>

        {/* RIGHT 60% */}
        <div className="flex flex-col gap-4">
          {/* Status timeline */}
          <div className="rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm dark:border-[#142535] dark:bg-[#0A1828]">
            <h3 className="mb-4 font-[Outfit,sans-serif] text-[13px] font-extrabold uppercase tracking-[0.08em] text-sky-700 dark:text-sky-300">
              Timeline
            </h3>
            {terminal ? (
              <TerminalBanner row={appointmentRow} />
            ) : (
              <ol className="space-y-3">
                {TIMELINE_STEPS.map((step, i) => {
                  const done = i < tlIndex;
                  const current = i === tlIndex;
                  const pending = i > tlIndex;
                  const ts = i === 0 ? appointmentRow.createdAt
                           : step.status === 'Approved'    ? appointmentRow.approvedAt
                           : step.status === 'Checked-In'  ? appointmentRow.checkedInAt
                           : step.status === 'In-Progress' ? appointmentRow.startedAt
                           : step.status === 'Completed'   ? appointmentRow.checkedOutAt
                           : null;
                  return (
                    <li key={step.status} className="flex items-start gap-3">
                      <span aria-hidden="true" className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${done
                        ? 'border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/20 dark:text-emerald-300'
                        : current
                          ? 'border-sky-700 bg-sky-700 text-white shadow-sm'
                          : 'border-slate-200 bg-slate-50 text-slate-400 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-500'}`}>
                        <step.Icon size={14} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className={`text-[13px] font-bold ${current ? 'text-sky-700 dark:text-sky-300' : done ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-500 dark:text-slate-400'}`}>
                          {step.label}{current && ' · Current'}
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                          {ts ? formatDateTime(ts) : (pending ? 'Awaiting' : '—')}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          {/* Quick actions */}
          <div className="rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm dark:border-[#142535] dark:bg-[#0A1828]">
            <h3 className="mb-3 font-[Outfit,sans-serif] text-[13px] font-extrabold uppercase tracking-[0.08em] text-sky-700 dark:text-sky-300">
              Quick Actions
            </h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {approveOk && (
                <ActionBtn Icon={CheckCircle2} tone="violet" label="Approve" onClick={() => setApprove(true)} />
              )}
              {canAct && allowed.has('Checked-In') && (
                <ActionBtn Icon={LogIn} tone="emerald" label="Check In" onClick={handleCheckIn} />
              )}
              {canAct && allowed.has('In-Progress') && (
                <ActionBtn Icon={Play} tone="blue" label="Start Meeting" onClick={handleStartMeeting} />
              )}
              {canAct && allowed.has('Completed') && (
                <ActionBtn Icon={LogOut} tone="emerald" label="Check Out" onClick={handleCheckOut} />
              )}
              {canAct && canTransition(status, 'Cancelled') && (
                <ActionBtn Icon={XCircle} tone="red" label="Cancel Appointment" onClick={() => setCancel(true)} />
              )}
              {canAct && isOverdue(appointmentRow) && canTransition(status, 'No-Show') && (
                <ActionBtn Icon={AlertTriangle} tone="amber" label="Mark as No-Show" onClick={handleMarkNoShow} />
              )}
              <ActionBtn Icon={Printer} tone="slate" label="Print Badge" onClick={() => setBadgeRow(appointmentRow)} />
              {appointmentRow.visitor?.emailId && (
                <ActionBtn Icon={Send} tone="slate" label="Resend Invite" onClick={() => setResendOpen(true)} />
              )}
            </div>
            {!canAct && (
              <p className="mt-3 rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-500 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-400">
                Super Admin view is read-only for tenant operations. Use impersonation to act on appointments.
              </p>
            )}
          </div>

          {/* Feedback (Completed only) */}
          {status === 'Completed' && (
            <FeedbackCard
              appointmentRow={appointmentRow}
              services={services}
              currentUser={currentUser}
              onSaved={() => showToast('Feedback saved successfully.')}
            />
          )}

          <div className="rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm dark:border-[#142535] dark:bg-[#0A1828]">
            <h3 className="mb-3 inline-flex items-center gap-2 font-[Outfit,sans-serif] text-[13px] font-extrabold uppercase tracking-[0.08em] text-sky-700 dark:text-sky-300">
              <BadgeCheck size={13} aria-hidden="true" /> Audit
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Pair label="Created At" value={formatDateTime(appointmentRow.createdAt)} />
              <Pair label="Created By" value={appointmentRow.createdBy || '—'} />
              <Pair label="Updated At" value={formatDateTime(appointmentRow.updatedAt)} />
              <Pair label="Updated By" value={appointmentRow.updatedBy || '—'} />
              {appointmentRow.approvalRequired && (
                <>
                  <Pair label="Approval Mode" value={appointmentRow.approvalMode || '—'} />
                  <Pair label="Approved By" value={appointmentRow.approvedBy || '—'} />
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {showCancel && (
        <CancelAppointmentModal open appointmentRow={appointmentRow} currentUser={currentUser}
          onClose={() => setCancel(false)}
          onCancelled={() => { setCancel(false); showToast('Appointment cancelled successfully.'); }} />
      )}
      {showApprove && (
        <ApproveAppointmentModal open appointmentRow={appointmentRow} currentUser={currentUser}
          onClose={() => setApprove(false)}
          onApproved={() => { setApprove(false); showToast('Appointment approved successfully.'); }} />
      )}
      {badgeRow && (
        <VisitorBadge
          open
          badge={badgeFromAppointment({ appointment: badgeRow, org, office, host, room })}
          onClose={() => setBadgeRow(null)}
          onPrinted={() => {
            addAuditLog({
              userName: currentUser?.name || 'Unknown',
              role: canOp,
              action: 'PRINT',
              module: 'Guest Log',
              description: `Printed badge for appointment ${appointmentRow.id}.`,
              orgId: appointmentRow.orgId,
            });
            showToast('Badge sent to printer.');
            setBadgeRow(null);
          }}
        />
      )}
      {resendOpen && (
        <ResendInviteModal
          appointmentRow={appointmentRow}
          onClose={() => setResendOpen(false)}
          onSent={() => {
            addAuditLog({
              userName: currentUser?.name || 'Unknown',
              role: canOp,
              action: 'EMAIL',
              module: 'Appointments',
              description: `Resent invite to ${appointmentRow.visitor?.emailId} for appointment ${appointmentRow.id}.`,
              orgId: appointmentRow.orgId,
            });
            setResendOpen(false);
            showToast('Invite email sent successfully.');
          }}
        />
      )}
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

/* ── Feedback card ──────────────────────────────────────────────── */

function FeedbackCard({ appointmentRow, services, currentUser, onSaved }) {
  const [, , updateAppt] = useCollection(STORAGE_KEYS.APPOINTMENTS, MOCK_APPOINTMENTS);
  const existing = appointmentRow.feedback;
  const locked   = Boolean(existing?.ratedAt);
  const [rating, setRating] = useState(existing?.rating || 0);
  const [notes, setNotes]   = useState(existing?.notes || '');
  const [availed, setAvailed] = useState(existing?.servicesAvailed || (services.map((s) => s.id)));
  const [saving, setSaving] = useState(false);

  const canEditFeedback = !locked || ['director', 'manager', 'reception'].includes(String(currentUser?.role || '').toLowerCase());

  const toggle = (id) => {
    setAvailed((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));
  };

  const save = async () => {
    if (saving || rating < 1) return;
    setSaving(true);
    await new Promise((r) => setTimeout(r, 800));
    const now = new Date().toISOString();
    const author = currentUser?.name || 'Unknown';
    const patch = stampLegacyAliases({
      ...appointmentRow,
      feedback: {
        rating, notes: (notes || '').trim(), servicesAvailed: [...availed],
        ratedAt: now, ratedBy: author,
      },
      updatedAt: now, updatedBy: author,
    });
    updateAppt(appointmentRow.id, patch);
    addAuditLog({
      userName:    author,
      role:        (currentUser?.role || '').toString(),
      action:      locked ? 'FEEDBACK_UPDATED' : 'FEEDBACK_RECORDED',
      module:      'Appointments',
      description: `Feedback ${locked ? 'updated' : 'recorded'} for ${appointmentRow.id} — ${rating} star${rating === 1 ? '' : 's'}.`,
      orgId:       appointmentRow.orgId,
    });
    setSaving(false);
    onSaved?.();
  };

  return (
    <div className="rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm dark:border-[#142535] dark:bg-[#0A1828]">
      <h3 className="mb-3 inline-flex items-center gap-2 font-[Outfit,sans-serif] text-[13px] font-extrabold uppercase tracking-[0.08em] text-sky-700 dark:text-sky-300">
        <Star size={13} aria-hidden="true" /> Feedback
      </h3>
      <div className="mb-3">
        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400">Rating</p>
        <div role="radiogroup" aria-label="Rating" className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={rating === n}
              disabled={!canEditFeedback}
              onClick={() => setRating(n)} title={`${n} star${n === 1 ? '' : 's'}`}
              className={`inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-[8px] border transition ${n <= rating
                ? 'border-amber-400 bg-amber-50 text-amber-600 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300'
                : 'border-slate-200 bg-white text-slate-300 hover:text-amber-500 dark:border-[#142535] dark:bg-[#071220]'} disabled:cursor-not-allowed disabled:opacity-40`}>
              ★
            </button>
          ))}
        </div>
      </div>
      {services.length > 0 && (
        <div className="mb-3">
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400">Services Availed</p>
          <div className="flex flex-wrap gap-2">
            {services.map((s) => {
              const checked = availed.includes(s.id);
              return (
                <label key={s.id} className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${checked
                  ? 'border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-400/40 dark:bg-sky-500/15 dark:text-sky-200'
                  : 'border-slate-200 bg-white text-slate-600 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-300'} ${!canEditFeedback ? 'cursor-not-allowed opacity-60' : ''}`}>
                  <input type="checkbox" checked={checked} disabled={!canEditFeedback}
                    onChange={() => toggle(s.id)}
                    className="h-3 w-3 cursor-pointer accent-sky-600" />
                  <span aria-hidden="true">{s.icon || '•'}</span>{s.name}
                </label>
              );
            })}
          </div>
        </div>
      )}
      <label className="block text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400 mb-1.5">Notes (optional)</label>
      <textarea value={notes} onChange={(e) => setNotes(e.target.value.slice(0, 500))}
        disabled={!canEditFeedback}
        placeholder="Record any notes from the visit" rows={2} maxLength={500}
        className="w-full rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-700 outline-none transition resize-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 disabled:opacity-40 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-200" />
      <p className="mt-1 text-[11px] text-slate-400">{notes.length} / 500 characters.</p>
      <div className="mt-3 flex justify-end">
        <button type="button" onClick={save} disabled={saving || rating < 1 || !canEditFeedback}
          className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-sky-700 bg-sky-700 px-4 py-2 text-[12px] font-bold text-white hover:bg-sky-800 disabled:opacity-40">
          {saving ? 'Saving…' : locked ? 'Update Feedback' : 'Save Feedback'}
        </button>
      </div>
    </div>
  );
}

/* ── Presentational bits ───────────────────────────────────────── */

function Card({ Icon, title, children }) {
  return (
    <div className="rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm dark:border-[#142535] dark:bg-[#0A1828]">
      <h3 className="mb-3 inline-flex items-center gap-2 font-[Outfit,sans-serif] text-[13px] font-extrabold uppercase tracking-[0.08em] text-sky-700 dark:text-sky-300">
        {Icon && <Icon size={13} aria-hidden="true" />}{title}
      </h3>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Pair({ label, value, mono = false, Icon, action }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 py-1.5 last:border-b-0 dark:border-[#142535]">
      <div className="flex min-w-0 items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.05em] text-slate-500 dark:text-slate-400">
        {Icon && <Icon size={12} aria-hidden="true" />}{label}
      </div>
      <div className="flex min-w-0 items-center gap-2 text-right">
        <div className={`min-w-0 break-words text-[13px] ${mono ? 'font-mono' : 'font-semibold'} text-[#0C2340] dark:text-slate-100`}>{value}</div>
        {action}
      </div>
    </div>
  );
}

function StatusPill({ label, tone }) {
  const cls = {
    amber:   'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
    violet:  'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/30 dark:bg-sky-500/10 dark:text-sky-300',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300',
    blue:    'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300',
    red:     'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300',
    slate:   'border-slate-200 bg-slate-100 text-slate-500 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-400',
  }[tone] || 'border-slate-200 bg-slate-100 text-slate-500';
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${cls}`}><span aria-hidden="true">●</span>{label}</span>;
}

function ActionBtn({ Icon, label, tone, onClick }) {
  const cls = {
    violet:  'border-sky-700 bg-gradient-to-r from-sky-600 to-sky-800 text-white hover:from-sky-700 hover:to-sky-900',
    emerald: 'border-emerald-700 bg-emerald-600 text-white hover:bg-emerald-700',
    blue:    'border-blue-700 bg-blue-600 text-white hover:bg-blue-700',
    red:     'border-red-200 bg-red-50 text-red-600 hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300',
    amber:   'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
    slate:   'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-300',
  }[tone] || 'border-slate-200 bg-white text-slate-700';
  return (
    <button type="button" onClick={onClick} title={label}
      className={`inline-flex cursor-pointer items-center gap-2 rounded-[10px] border px-3 py-2 text-[12px] font-bold transition ${cls}`}>
      <Icon size={14} aria-hidden="true" />{label}
    </button>
  );
}

/* ── Resend Invite Modal ────────────────────────────────────────── */

function ResendInviteModal({ appointmentRow, onClose, onSent }) {
  const visitor = appointmentRow?.visitor || {};
  const email = visitor.emailId || '';
  const [sending, setSending] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  React.useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSend = async () => {
    setSending(true);
    await new Promise((r) => setTimeout(r, 1200));
    /* Real implementation: POST /api/appointments/:id/resend-invite */
    /* For now: open mailto as fallback so the button is functional */
    const subject = encodeURIComponent(`Your Visit Invitation — ${appointmentRow.id}`);
    const body = encodeURIComponent(
      `Dear ${visitor.fullName || 'Visitor'},\n\nThis is a reminder of your scheduled appointment:\n\nID: ${appointmentRow.id}\nDate: ${appointmentRow.scheduledDate || appointmentRow.date || '—'}\nTime: ${appointmentRow.startTime || '—'} – ${appointmentRow.endTime || '—'}\n\nPlease present this email or your appointment ID upon arrival.\n\nThank you.`
    );
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank');
    setSending(false);
    setSent(true);
    setTimeout(() => { onSent?.(); }, 800);
  };

  return (
    <div
      role="dialog" aria-modal="true" aria-labelledby="resend-invite-title"
      className="fixed inset-0 z-[9200] flex items-center justify-center bg-black/45 px-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div className="w-full max-w-[420px] rounded-[14px] border border-slate-200 bg-white p-6 shadow-2xl dark:border-[#142535] dark:bg-[#0A1828]">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-50 dark:bg-sky-500/10">
            <Send size={18} className="text-sky-700 dark:text-sky-300" aria-hidden="true" />
          </div>
          <div>
            <h2 id="resend-invite-title" className="font-[Outfit,sans-serif] text-[16px] font-extrabold text-[#0C2340] dark:text-slate-100">
              Resend Invite
            </h2>
            <p className="text-[12px] text-slate-500 dark:text-slate-400">Send appointment confirmation email</p>
          </div>
        </div>

        <div className="mb-4 rounded-[10px] border border-slate-100 bg-slate-50 p-3 dark:border-[#142535] dark:bg-[#071220]">
          <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400 mb-1">Sending to</p>
          <p className="text-[13px] font-semibold text-[#0C2340] dark:text-slate-100 break-all">{email}</p>
          <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-1">
            {visitor.fullName || '—'} · Appointment {appointmentRow.id}
          </p>
        </div>

        {sent ? (
          <div className="flex items-center gap-2 rounded-[10px] border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[13px] font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
            <CheckCircle2 size={16} aria-hidden="true" /> Email client opened. Invite sent!
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose}
              className="cursor-pointer rounded-[10px] border border-slate-200 bg-white px-4 py-2 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-[#142535] dark:bg-[#0A1828] dark:text-slate-200">
              Cancel
            </button>
            <button type="button" onClick={handleSend} disabled={sending}
              className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-sky-700 bg-gradient-to-r from-sky-600 to-sky-800 px-5 py-2 text-[13px] font-bold text-white hover:from-sky-700 hover:to-sky-900 disabled:opacity-60">
              {sending ? 'Sending…' : <><Send size={13} aria-hidden="true" /> Send Invite</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Terminal banner ────────────────────────────────────────────── */

function TerminalBanner({ row }) {
  const isCancel = row.status === 'Cancelled';
  return (
    <div className={`rounded-[10px] border px-3 py-3 ${isCancel
      ? 'border-slate-200 bg-slate-50 dark:border-[#142535] dark:bg-[#071220]'
      : 'border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10'}`}>
      <p className={`text-[13px] font-bold ${isCancel ? 'text-slate-700 dark:text-slate-200' : 'text-red-800 dark:text-red-200'}`}>
        {isCancel ? 'Cancelled' : 'No-Show'}
      </p>
      <p className="mt-1 text-[12px] text-slate-600 dark:text-slate-300">
        {isCancel ? (row.cancellationReason || 'No reason recorded.') : 'The visitor did not arrive within the scheduled window.'}
      </p>
      <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
        {isCancel
          ? `Cancelled by ${row.cancelledBy || '—'} on ${formatDateTime(row.cancelledAt)}.`
          : `Marked by ${row.noShowBy || '—'} on ${formatDateTime(row.noShowAt)}.`}
      </p>
    </div>
  );
}