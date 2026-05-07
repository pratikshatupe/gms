import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  CheckCircle2, AlertTriangle, Clock3, UserRound, Calendar,
  Building2, Home,
} from 'lucide-react';
import { useCollection, STORAGE_KEYS } from '../../store';
import { MOCK_APPOINTMENTS, stampLegacyAliases } from '../../data/mockAppointments';
import { MOCK_OFFICES, MOCK_STAFF, MOCK_ORGANIZATIONS } from '../../data/mockData';
import { addAuditLog } from '../../utils/auditLogger';
import { formatDateGB, formatDateTime, to12hAmPm } from '../../utils/appointmentState';
import { computeDurationMins, formatDuration } from '../../utils/guestLogAnalytics';

/**
 * GuestCheckOutPage — public self-check-out landing.
 *
 * Route: /checkout/:appointmentId/:badgeNumber  (outside ProtectedRoute)
 *
 * State machine:
 *   • Checked-In / In-Progress → transition to Completed, show
 *     thank-you page, auto-redirect to landing in 10 seconds.
 *   • Already Completed → friendly confirmation, no state change.
 *   • Cancelled        → neutral message.
 *   • No-Show          → friendly "record not found" message.
 *   • Pending / Approved (no check-in yet) → block with instructions.
 *   • Badge mismatch or appointment id not found → generic "record not
 *     found" (avoid leaking whether the id exists).
 *
 * PII shown on this page is limited to: visitor first name, host
 * first name, date, time, duration. No contact number, email, ID
 * number, or photo.
 *
 * TODO Production hardening — add rate limiting on this endpoint
 * (max 10 attempts per IP per hour) + signed JWT badge tokens
 * instead of plain badge numbers. Target production auth phase.
 */

const AUTO_REDIRECT_MS = 10000;

function useAutoRedirect(enabled, onFire) {
  useEffect(() => {
    if (!enabled) return undefined;
    const t = window.setTimeout(() => onFire?.(), AUTO_REDIRECT_MS);
    return () => window.clearTimeout(t);
  }, [enabled, onFire]);
}

export default function GuestCheckOutPage() {
  const params = useParams();
  const navigate = useNavigate();
  const appointmentId = params?.appointmentId || '';
  const badgeNumber   = params?.badgeNumber   || '';

  const [appointments, , updateAppt] = useCollection(STORAGE_KEYS.APPOINTMENTS, MOCK_APPOINTMENTS);
  const [offices] = useCollection(STORAGE_KEYS.OFFICES, MOCK_OFFICES);
  const [staff]   = useCollection(STORAGE_KEYS.STAFF,   MOCK_STAFF);
  const [orgs]    = useCollection(STORAGE_KEYS.ORGANIZATIONS, MOCK_ORGANIZATIONS);

  const [phase, setPhase]     = useState('resolving'); /* 'resolving' | 'invalid' | 'blocked' | 'already-completed' | 'cancelled' | 'noshow' | 'completed' | 'error' */
  const [blockReason, setBlockReason] = useState('');

  /* Resolve row + validate badge + run transition once per mount. */
  useEffect(() => {
    if (phase !== 'resolving') return;
    const row = (appointments || []).find((a) => a?.id === appointmentId);
    if (!row) {
      setPhase('invalid');
      return;
    }
    const stored = row.badgeNumber || '';
    if (!stored || stored !== badgeNumber) {
      setPhase('invalid');
      return;
    }
    const status = row.status;
    if (status === 'Completed') {
      setPhase('already-completed');
      return;
    }
    if (status === 'Cancelled') {
      setPhase('cancelled');
      return;
    }
    if (status === 'No-Show') {
      setPhase('noshow');
      return;
    }
    if (!['Checked-In', 'In-Progress'].includes(status)) {
      setPhase('blocked');
      setBlockReason(`This visit has not been checked in yet. Please complete check-in at reception before using self-check-out.`);
      addAuditLog({
        userName:    'Self (QR)',
        role:        'public',
        action:      'QR_CHECKOUT_BLOCKED',
        module:      'Guest Log',
        description: `QR checkout attempted for ${appointmentId} (${badgeNumber}) in status ${status}.`,
        orgId:       row.orgId,
      });
      return;
    }

    /* Happy path — transition to Completed. */
    const now = new Date().toISOString();
    const patch = stampLegacyAliases({
      ...row,
      status: 'Completed',
      checkedOutAt: now,
      checkedOutBy: 'Self (QR)',
      updatedAt:    now,
      updatedBy:    'Self (QR)',
    });
    try {
      updateAppt(row.id, patch);
      addAuditLog({
        userName:    'Self (QR)',
        role:        'public',
        action:      'QR_CHECKOUT_COMPLETED',
        module:      'Guest Log',
        description: `QR self-check-out completed for appointment ${row.id} (${row.visitor?.fullName || row.guestName || '—'}).`,
        orgId:       row.orgId,
      });
      setPhase('completed');
    } catch {
      setPhase('error');
    }
  }, [phase, appointments, appointmentId, badgeNumber, updateAppt]);

  const row = useMemo(
    () => (appointments || []).find((a) => a?.id === appointmentId) || null,
    [appointments, appointmentId],
  );
  const office = useMemo(
    () => (offices || []).find((o) => o?.id === row?.officeId) || null,
    [offices, row],
  );
  const host = useMemo(
    () => (staff || []).find((s) => s?.id === row?.hostUserId) || null,
    [staff, row],
  );
  const org = useMemo(
    () => (orgs || []).find((o) => o?.id === row?.orgId) || null,
    [orgs, row],
  );

  const goHome = () => navigate('/');
  useAutoRedirect(phase === 'completed', goHome);

  /* ── Render phases ─────────────────────────────────────────── */

  if (phase === 'resolving') {
    return <Frame><Skeleton /></Frame>;
  }

  if (phase === 'invalid') {
    return (
      <Frame>
        <Panel tone="red" Icon={AlertTriangle} title="Record not found.">
          <p>No visit record found for this badge. Please contact reception if you believe this is an error.</p>
          <HomeLink onClick={goHome} />
        </Panel>
      </Frame>
    );
  }

  if (phase === 'blocked') {
    return (
      <Frame>
        <Panel tone="amber" Icon={AlertTriangle} title="Check-in required first.">
          <p>{blockReason}</p>
          <HomeLink onClick={goHome} />
        </Panel>
      </Frame>
    );
  }

  if (phase === 'already-completed') {
    const visitorName = row?.visitor?.fullName?.split(' ')[0] || 'there';
    return (
      <Frame>
        <Panel tone="emerald" Icon={CheckCircle2} title={`All done, ${visitorName}.`}>
          <p>This visit has already been completed. Thank you for visiting!</p>
          <HomeLink onClick={goHome} />
        </Panel>
      </Frame>
    );
  }

  if (phase === 'cancelled') {
    return (
      <Frame>
        <Panel tone="slate" Icon={AlertTriangle} title="Appointment cancelled.">
          <p>This appointment was cancelled. If you have questions, please contact reception.</p>
          <HomeLink onClick={goHome} />
        </Panel>
      </Frame>
    );
  }

  if (phase === 'noshow') {
    return (
      <Frame>
        <Panel tone="red" Icon={AlertTriangle} title="Record not found.">
          <p>No visit record found for this badge. Please contact reception if you believe this is an error.</p>
          <HomeLink onClick={goHome} />
        </Panel>
      </Frame>
    );
  }

  if (phase === 'error') {
    return (
      <Frame>
        <Panel tone="red" Icon={AlertTriangle} title="Something went wrong.">
          <p>We couldn&rsquo;t complete your check-out. Please try again or contact reception.</p>
          <HomeLink onClick={goHome} />
        </Panel>
      </Frame>
    );
  }

  /* phase === 'completed' — thank-you view. */
  const visitorFirst = row?.visitor?.fullName?.split(' ')[0] || 'there';
  const hostFirst = (host?.fullName || host?.name || row?.host || '').split(' ')[0];
  const duration = computeDurationMins(row);
  const inAt = row?.checkedInAt ? formatDateTime(row.checkedInAt) : '—';
  const outAt = row?.checkedOutAt ? formatDateTime(row.checkedOutAt) : '—';

  return (
    <Frame>
      <div className="mx-auto flex max-w-xl flex-col gap-5 rounded-[16px] border border-emerald-200 bg-white p-6 shadow-md dark:border-emerald-500/30 dark:bg-[#0A1828] sm:p-8">
        <div className="flex items-start gap-4">
          <span aria-hidden="true" className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
            <CheckCircle2 size={28} />
          </span>
          <div className="min-w-0">
            <h1 className="font-[Outfit,sans-serif] text-[24px] font-extrabold leading-tight text-[#0C2340] dark:text-slate-100">
              Thank you for visiting, {visitorFirst}!
            </h1>
            <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">
              Your check-out has been recorded. Safe travels.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Stat Icon={UserRound} label="Host" value={hostFirst || '—'} />
          <Stat Icon={Building2} label="Office" value={office?.name || '—'} />
          <Stat Icon={Calendar}  label="Date"   value={formatDateGB(row.scheduledDate || row.date)} />
          <Stat Icon={Clock3}    label="Duration" value={formatDuration(duration)} />
        </div>

        <div className="rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-300">
          Checked in {inAt} · Checked out {outAt}.
        </div>

        <div className="rounded-[10px] border border-sky-200 bg-sky-50 px-3 py-3 text-[12px] dark:border-sky-400/30 dark:bg-sky-500/10">
          <p className="font-bold text-sky-800 dark:text-sky-200">
            Rate your visit (optional).
          </p>
          <p className="mt-1 text-sky-700 dark:text-sky-300">
            To submit a rating, please speak to reception or open the visitor feedback link shared in your confirmation email.
          </p>
        </div>

        <div className="flex items-center justify-between gap-3 text-[12px]">
          <button type="button" onClick={goHome}
            className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-slate-200 bg-white px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-200">
            <Home size={13} aria-hidden="true" /> Return to Home
          </button>
          <span className="text-slate-400">
            Redirecting home in 10 seconds.
          </span>
        </div>

        {org?.name && (
          <p className="text-center text-[11px] text-slate-400">
            {org.name}. CorpGMS.
          </p>
        )}
      </div>
    </Frame>
  );
}

/* ── Bits ──────────────────────────────────────────────────────── */

function Frame({ children }) {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 font-[Plus Jakarta Sans,sans-serif] dark:bg-[#050E1A]">
      <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-4">
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] bg-gradient-to-br from-sky-600 to-sky-800 font-[Outfit,sans-serif] text-[14px] font-extrabold text-white">
            G
          </span>
          <span className="font-[Outfit,sans-serif] text-[16px] font-extrabold text-[#0C2340] dark:text-slate-100">
            CorpGMS
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}

function Panel({ tone, Icon, title, children }) {
  const toneCls = {
    red:     'border-red-200 bg-white dark:border-red-500/30 dark:bg-[#0A1828]',
    amber:   'border-amber-200 bg-white dark:border-amber-500/30 dark:bg-[#0A1828]',
    emerald: 'border-emerald-200 bg-white dark:border-emerald-500/30 dark:bg-[#0A1828]',
    slate:   'border-slate-200 bg-white dark:border-[#142535] dark:bg-[#0A1828]',
  }[tone] || 'border-slate-200 bg-white dark:border-[#142535] dark:bg-[#0A1828]';
  const iconCls = {
    red:     'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
    amber:   'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
    emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
    slate:   'bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300',
  }[tone] || 'bg-slate-100 text-slate-600';
  return (
    <div className={`mx-auto w-full rounded-[16px] border p-6 shadow-sm sm:p-8 ${toneCls}`}>
      <div className="flex items-start gap-4">
        <span aria-hidden="true" className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${iconCls}`}>
          <Icon size={24} />
        </span>
        <div className="min-w-0">
          <h2 className="font-[Outfit,sans-serif] text-[20px] font-extrabold leading-tight text-[#0C2340] dark:text-slate-100">
            {title}
          </h2>
          <div className="mt-2 space-y-2 text-[13px] text-slate-600 dark:text-slate-300">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ Icon, label, value }) {
  return (
    <div className="flex items-start gap-2 rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2 dark:border-[#142535] dark:bg-[#071220]">
      <Icon size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-sky-500 dark:text-sky-300" />
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400">{label}</p>
        <p className="mt-0.5 break-words text-[13px] font-semibold text-[#0C2340] dark:text-slate-100">{value}</p>
      </div>
    </div>
  );
}

function HomeLink({ onClick }) {
  return (
    <div className="mt-3">
      <button type="button" onClick={onClick}
        className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-sky-700 bg-sky-700 px-4 py-2 text-[12px] font-bold text-white hover:bg-sky-800">
        <Home size={13} aria-hidden="true" /> Return to Home
      </button>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="w-full rounded-[16px] border border-slate-200 bg-white p-8 shadow-sm dark:border-[#142535] dark:bg-[#0A1828]">
      <div className="animate-pulse">
        <div className="mb-4 h-6 w-40 rounded bg-slate-200 dark:bg-[#142535]" />
        <div className="h-4 w-64 rounded bg-slate-100 dark:bg-[#1E1E3F]" />
      </div>
      <p className="mt-4 text-[11px] text-slate-400">Resolving your visit…</p>
    </div>
  );
}

/* Silence unused — to12hAmPm reserved for future enhancements. */
void to12hAmPm;
