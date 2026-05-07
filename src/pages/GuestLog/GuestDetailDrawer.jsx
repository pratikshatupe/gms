import React, { useEffect, useRef } from 'react';
import {
  X, UserRound, Building2, DoorOpen, Mail, Phone, Clock3,
  BadgeCheck, Sparkles, Star, ArrowRight, AlertTriangle,
  CheckCircle2, LogIn, LogOut, Play,
} from 'lucide-react';
import {
  displayStatus, formatAppointmentTime, formatDateGB, formatDateTime,
  getTimezoneAbbr, to12hAmPm,
} from '../../utils/appointmentState';
import {
  computeDurationMins, formatDuration, maskIdNumber,
} from '../../utils/guestLogAnalytics';

/**
 * GuestDetailDrawer — read-only drawer opened when a Guest Log row
 * is clicked. Shows visitor + meeting + services + feedback + a
 * compact status timeline, all stripped of action buttons. ID
 * number is masked for privacy.
 *
 * Header button routes to the full AppointmentDetailPage when the
 * operator wants to take actions (check-out, cancel, feedback).
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

export default function GuestDetailDrawer({
  open, row, onClose, onOpenFullDetail,
}) {
  const closeBtnRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    const t = window.setTimeout(() => closeBtnRef.current?.focus(), 30);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
      window.clearTimeout(t);
    };
  }, [open, onClose]);

  if (!open || !row) return null;

  const { apt, office, host, serviceRows = [] } = row;
  const visitor = apt.visitor || {};
  const disp = displayStatus(apt);
  const terminal = apt.status === 'Cancelled' || apt.status === 'No-Show';
  const tlIndex = timelineIndexFor(apt.status);
  const tzAbbr = getTimezoneAbbr(office?.operations?.timezone);
  const duration = computeDurationMins(apt);
  const maskedId = visitor.idNumberDisplay
    ? maskIdNumber(visitor.idType, visitor.idNumberDisplay)
    : '';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="guest-detail-title"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      className="fixed inset-0 z-[9100] flex justify-end bg-black/45"
    >
      <aside
        className="flex h-full w-full max-w-[440px] flex-col bg-white shadow-2xl dark:bg-[#0A1828] sm:w-[440px]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-gradient-to-r from-sky-700 to-sky-800 px-5 py-4 text-white dark:border-[#142535]">
          <div className="min-w-0">
            <h2 id="guest-detail-title" className="font-[Outfit,sans-serif] text-[16px] font-extrabold leading-tight">
              {visitor.fullName || apt.guestName || 'Visitor'}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] opacity-90">
              <span className="font-mono font-bold">{apt.id}</span>
              {visitor.companyName && <><span aria-hidden="true">·</span><span>{visitor.companyName}</span></>}
              {apt.isWalkIn && (
                <span className="inline-flex items-center rounded-full border border-white/30 bg-white/15 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide">
                  Walk-in
                </span>
              )}
            </div>
          </div>
          <button
            ref={closeBtnRef} type="button" onClick={onClose}
            aria-label="Close drawer" title="Close"
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md bg-white/15 text-white transition hover:bg-white/25"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {/* Status + visitor type */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <StatusPill label={disp.label} tone={disp.tone} />
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-bold text-slate-600 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-300">
              {visitor.visitorType || 'Regular'}
            </span>
          </div>

          {/* Photo + masked ID */}
          {(visitor.photoDataUrl || maskedId) && (
            <div className="mb-4 flex items-start gap-3 rounded-[12px] border border-slate-200 bg-slate-50 p-3 dark:border-[#142535] dark:bg-[#071220]">
              {visitor.photoDataUrl ? (
                <img
                  src={visitor.photoDataUrl} alt="Visitor photo"
                  className="h-[72px] w-[72px] rounded-[10px] border border-slate-200 object-cover dark:border-[#142535]"
                />
              ) : (
                <div aria-hidden="true" className="flex h-[72px] w-[72px] items-center justify-center rounded-[10px] border border-slate-200 bg-sky-50 text-[11px] font-semibold text-slate-500 dark:border-[#142535] dark:bg-sky-500/15 dark:text-slate-400">
                  No Photo
                </div>
              )}
              <div className="min-w-0">
                {maskedId && (
                  <>
                    <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400">
                      {visitor.idType || 'ID'}
                    </p>
                    <p className="mt-0.5 font-mono text-[13px] font-bold text-[#0C2340] dark:text-slate-100">
                      {maskedId}
                    </p>
                    <p className="mt-1 text-[10px] text-slate-400">
                      ID number masked for privacy. Full value visible in the Appointment Detail page.
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Meeting details */}
          <Section Icon={Building2} title="Meeting">
            <Pair label="Office" value={office ? `${office.name} (${office.code})` : '—'} />
            <Pair label="Date" value={formatDateGB(apt.scheduledDate || apt.date)} />
            <Pair label="Time" value={formatAppointmentTime(apt, office)} />
            <Pair label="Timezone" value={tzAbbr || '—'} />
            <Pair label="Room" value={apt.room || '—'} Icon={DoorOpen} />
            <Pair label="Purpose" value={apt.purpose || '—'} />
          </Section>

          {/* Contact */}
          <Section Icon={UserRound} title="Contact">
            <Pair label="Contact Number" value={visitor.contactNumber || '—'} mono Icon={Phone} />
            <Pair
              label="Email ID"
              value={visitor.emailId || '—'}
              mono
              Icon={Mail}
              action={visitor.emailId
                ? <a href={`mailto:${visitor.emailId}`} className="text-[11px] font-bold text-sky-700 hover:underline dark:text-sky-300">Send email</a>
                : null}
            />
            <Pair label="Host" value={host?.fullName || host?.name || apt.host || '—'} />
            {visitor.visitorType !== 'Delivery' && Number(visitor.accompanyingCount) > 0 && (
              <Pair
                label="Accompanying"
                value={`${Number(visitor.accompanyingCount).toLocaleString('en-GB')} guest(s)`}
              />
            )}
          </Section>

          {/* Visit timeline */}
          <Section Icon={Clock3} title="Visit Timeline">
            {terminal ? (
              <TerminalBanner apt={apt} />
            ) : (
              <ol className="space-y-2">
                {TIMELINE_STEPS.map((step, i) => {
                  const done    = i < tlIndex;
                  const current = i === tlIndex;
                  const ts = i === 0 ? apt.createdAt
                           : step.status === 'Approved'    ? apt.approvedAt
                           : step.status === 'Checked-In'  ? apt.checkedInAt
                           : step.status === 'In-Progress' ? apt.startedAt
                           : step.status === 'Completed'   ? apt.checkedOutAt
                           : null;
                  return (
                    <li key={step.status} className="flex items-start gap-3">
                      <span aria-hidden="true" className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] ${done
                        ? 'border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/20 dark:text-emerald-300'
                        : current
                          ? 'border-sky-700 bg-sky-700 text-white'
                          : 'border-slate-200 bg-slate-50 text-slate-400 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-500'}`}>
                        <step.Icon size={12} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className={`text-[12px] font-bold ${current ? 'text-sky-700 dark:text-sky-300' : done ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-500 dark:text-slate-400'}`}>
                          {step.label}{current && ' · Current'}
                        </div>
                        <div className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                          {ts ? formatDateTime(ts) : 'Awaiting'}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
            {(apt.checkedInAt || apt.checkedOutAt) && (
              <div className="mt-3 grid grid-cols-2 gap-2 rounded-[10px] border border-slate-200 bg-slate-50 p-2 dark:border-[#142535] dark:bg-[#071220]">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500">Check-In</p>
                  <p className="mt-0.5 text-[12px] font-semibold text-[#0C2340] dark:text-slate-100">
                    {apt.checkedInAt ? formatDateTime(apt.checkedInAt) : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500">Check-Out</p>
                  <p className="mt-0.5 text-[12px] font-semibold text-[#0C2340] dark:text-slate-100">
                    {apt.checkedOutAt ? formatDateTime(apt.checkedOutAt) : '—'}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500">Duration</p>
                  <p className="mt-0.5 text-[12px] font-semibold text-[#0C2340] dark:text-slate-100">
                    {formatDuration(duration)}
                  </p>
                </div>
              </div>
            )}
          </Section>

          {/* Services */}
          {serviceRows.length > 0 && (
            <Section Icon={Sparkles} title="Services Availed">
              <ul className="space-y-1">
                {serviceRows.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 border-b border-slate-100 py-1 last:border-b-0 dark:border-[#142535]">
                    <span className="inline-flex items-center gap-2 text-[12px] font-semibold text-slate-700 dark:text-slate-200">
                      <span aria-hidden="true">{s.icon || '•'}</span>{s.name}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Feedback */}
          {apt.feedback && (
            <Section Icon={Star} title="Feedback">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <span key={n} aria-hidden="true" className={`text-[16px] ${n <= (apt.feedback?.rating || 0) ? 'text-amber-500' : 'text-slate-300 dark:text-slate-600'}`}>★</span>
                ))}
                <span className="ml-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  {apt.feedback.rating || 0}/5
                </span>
              </div>
              {apt.feedback.notes && (
                <p className="mt-1 text-[12px] italic text-slate-600 dark:text-slate-300">
                  &ldquo;{apt.feedback.notes}&rdquo;
                </p>
              )}
            </Section>
          )}

          {/* Audit */}
          <Section Icon={BadgeCheck} title="Audit">
            <Pair label="Created At" value={formatDateTime(apt.createdAt)} />
            <Pair label="Created By" value={apt.createdBy || '—'} />
            {apt.updatedAt && apt.updatedAt !== apt.createdAt && (
              <>
                <Pair label="Updated At" value={formatDateTime(apt.updatedAt)} />
                <Pair label="Updated By" value={apt.updatedBy || '—'} />
              </>
            )}
          </Section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-[#142535] dark:bg-[#071220]">
          <button type="button" onClick={onClose}
            className="cursor-pointer text-[12px] font-semibold text-slate-500 hover:text-sky-700 hover:underline dark:text-slate-400 dark:hover:text-sky-300">
            Close
          </button>
          {onOpenFullDetail && (
            <button type="button" onClick={onOpenFullDetail}
              className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-sky-700 bg-gradient-to-r from-sky-600 to-sky-800 px-4 py-2 text-[13px] font-bold text-white shadow-sm hover:from-sky-700 hover:to-sky-900">
              Open Full Detail <ArrowRight size={13} aria-hidden="true" />
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}

/* ── Sub-bits ───────────────────────────────────────────────────── */

function Section({ Icon, title, children }) {
  return (
    <section className="mb-4">
      <h3 className="mb-2 inline-flex items-center gap-2 font-[Outfit,sans-serif] text-[11px] font-extrabold uppercase tracking-[0.08em] text-sky-700 dark:text-sky-300">
        {Icon && <Icon size={12} aria-hidden="true" />}
        {title}
      </h3>
      <div className="rounded-[10px] border border-slate-200 bg-white px-3 py-2 dark:border-[#142535] dark:bg-[#071220]">
        {children}
      </div>
    </section>
  );
}

function Pair({ label, value, mono = false, Icon, action }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 py-1.5 last:border-b-0 dark:border-[#142535]">
      <div className="flex min-w-0 items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.05em] text-slate-500 dark:text-slate-400">
        {Icon && <Icon size={12} aria-hidden="true" />}
        {label}
      </div>
      <div className="flex min-w-0 items-center gap-2 text-right">
        <div className={`min-w-0 break-words text-[12px] ${mono ? 'font-mono' : 'font-semibold'} text-[#0C2340] dark:text-slate-100`}>
          {value}
        </div>
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

function TerminalBanner({ apt }) {
  const isCancel = apt.status === 'Cancelled';
  return (
    <div className={`rounded-[10px] border px-3 py-3 ${isCancel
      ? 'border-slate-200 bg-slate-50 dark:border-[#142535] dark:bg-[#071220]'
      : 'border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10'}`}>
      <p className={`text-[13px] font-bold ${isCancel ? 'text-slate-700 dark:text-slate-200' : 'text-red-800 dark:text-red-200'}`}>
        {isCancel ? 'Cancelled' : 'No-Show'}
      </p>
      <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-300">
        {isCancel ? (apt.cancellationReason || 'No reason recorded.') : 'The visitor did not arrive within the scheduled window.'}
      </p>
      <p className="mt-2 text-[10px] text-slate-500 dark:text-slate-400">
        {isCancel
          ? `Cancelled by ${apt.cancelledBy || '—'} on ${formatDateTime(apt.cancelledAt)}.`
          : `Marked by ${apt.noShowBy || '—'} on ${formatDateTime(apt.noShowAt)}.`}
      </p>
    </div>
  );
}

/* Silence unused-import linter. */
void to12hAmPm;
