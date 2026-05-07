/**
 * appointmentState.js — pure helpers for the Appointments module.
 *
 * Covers:
 *   • Status state-machine (legal transitions, next-allowed, display pills)
 *   • Computed pills: "Upcoming" (today/tomorrow) + "Overdue" (past end-time, not Checked-In)
 *   • Approval workflow resolver (reads org.settings.checkIn)
 *   • Room + host double-booking detection
 *   • Timezone abbreviation + display formatter
 *   • Tenant-scoped byOrg helper
 *
 * No React imports — keep this file pure so Dashboard widgets, the
 * Appointments module, tests and any future backend reuse can call it.
 */

export const VISITOR_TYPES = ['Regular', 'VIP', 'Vendor', 'Delivery'];

export const APPROVAL_MODES = ['Auto', 'Host', 'Reception', 'Director'];

export const DEFAULT_CHECKIN_SETTINGS = Object.freeze({
  approvalWorkflow:        'Auto',
  approvalTimeoutMinutes:  15,
});

/* Legal stored-status values (Upcoming is NOT stored). */
export const APPOINTMENT_STATUSES_CANON = [
  'Pending', 'Approved', 'Checked-In', 'In-Progress',
  'Completed', 'Cancelled', 'No-Show',
];

/* Terminal states — conflict detection + edits use this as a gate. */
export const TERMINAL_STATUSES = new Set(['Cancelled', 'Completed', 'No-Show']);

/* Edit gate — appointments in these states are no longer editable. */
export const LOCKED_FOR_EDIT = new Set([
  'Checked-In', 'In-Progress', 'Completed', 'Cancelled', 'No-Show',
]);

/* ── State machine ──────────────────────────────────────────────── */

const TRANSITIONS = Object.freeze({
  Pending:     new Set(['Approved', 'Cancelled']),
  Approved:    new Set(['Checked-In', 'Cancelled', 'No-Show']),
  'Checked-In': new Set(['In-Progress', 'Completed']),
  'In-Progress': new Set(['Completed']),
  Completed:   new Set([]),
  Cancelled:   new Set([]),
  'No-Show':   new Set([]),
});

export function canTransition(from, to) {
  if (!from || !to) return false;
  const set = TRANSITIONS[from];
  return set ? set.has(to) : false;
}

/** Next allowed stored statuses from current. */
export function nextAllowedStates(apt) {
  const set = TRANSITIONS[apt?.status];
  return set ? [...set] : [];
}

/* ── Tenant scoping ─────────────────────────────────────────────── */

export function byOrg(records, user) {
  if (!Array.isArray(records)) return [];
  const role = String(user?.role || '').toLowerCase();
  if (role === 'superadmin') return records;
  const orgId = user?.organisationId || user?.orgId || null;
  if (!orgId) return [];
  return records.filter((r) => !r?.orgId || r.orgId === orgId);
}

/* ── Date + time helpers ────────────────────────────────────────── */

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
export function addDaysIso(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Parse scheduledDate + HH:mm into an epoch ms timestamp. Returns
 *  null for invalid input. */
export function apptEpoch(apt, which = 'start') {
  if (!apt) return null;
  const dateIso = apt.scheduledDate || apt.date;
  const t = which === 'end' ? (apt.endTime || apt.time) : (apt.startTime || apt.time);
  if (!dateIso || !t || !/^\d{2}:\d{2}$/.test(t)) return null;
  const d = new Date(`${dateIso}T${t}:00`);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

/* ── Computed pills ─────────────────────────────────────────────── */

/**
 * isUpcoming — display-only pill when status === 'Approved' AND the
 * scheduled date is today or tomorrow. Does NOT persist.
 */
export function isUpcoming(apt) {
  if (!apt || apt.status !== 'Approved') return false;
  const t = todayIso();
  const d = apt.scheduledDate || apt.date || '';
  return d === t || d === addDaysIso(1);
}

/**
 * isOverdue — display-only pill when status === 'Approved' AND end
 * time has passed. Never mutates stored data.
 */
export function isOverdue(apt) {
  if (!apt || apt.status !== 'Approved') return false;
  const end = apptEpoch(apt, 'end');
  return end != null && end < Date.now();
}

/* ── Approval workflow resolution ───────────────────────────────── */

/**
 * resolveApprovalRequired — given a draft appointment + org settings
 * + operator context, decide:
 *   • approvalRequired  — boolean
 *   • approvalMode      — which role(s) can approve ('Host' | 'Reception' | 'Director' | null)
 *   • initialStatus     — 'Pending' | 'Approved'
 *   • selfApproved      — true if the operator acts as their own approver
 *
 * Rules (per product decisions):
 *   1. Visitor type VIP → always needs Director approval. Director
 *      operator can self-approve only if they are the sole active
 *      Director in the org (lockout prevention). Otherwise Pending.
 *   2. Operator role Director + visitor not VIP → auto-approved
 *      regardless of workflow setting.
 *   3. Otherwise follow settings.approvalWorkflow:
 *        Auto     → Approved, no approver needed.
 *        Host     → Pending; host or reporting-chain or Director approves.
 *        Reception→ Pending; Reception / Manager / Director approves.
 *        Director → Pending; Director approves.
 */
export function resolveApprovalRequired({ draft, org, operator, orgStaff }) {
  const settings = (org?.settings?.checkIn) || DEFAULT_CHECKIN_SETTINGS;
  const workflow = settings.approvalWorkflow || DEFAULT_CHECKIN_SETTINGS.approvalWorkflow;
  const opRoleLower = String(operator?.role || '').toLowerCase();
  const isDirector  = opRoleLower === 'director';
  const visitorType = draft?.visitor?.visitorType;

  /* 1. VIP rule (overrides everything). */
  if (visitorType === 'VIP') {
    const activeDirectorCount = (orgStaff || []).filter(
      (s) => s?.role === 'Director'
        && String(s.status || 'Active') !== 'Inactive'
        && s?.orgId === (org?.id || operator?.organisationId),
    ).length;
    if (isDirector && activeDirectorCount === 1) {
      return {
        approvalRequired: true,
        approvalMode:     'Director',
        initialStatus:    'Approved',
        selfApproved:     true,
        selfApprovedReason: 'VIP_SELF_APPROVED_SOLE_DIRECTOR',
      };
    }
    return {
      approvalRequired: true,
      approvalMode:     'Director',
      initialStatus:    'Pending',
      selfApproved:     false,
    };
  }

  /* 2. Director operator bypass. */
  if (isDirector) {
    return {
      approvalRequired: false,
      approvalMode:     null,
      initialStatus:    'Approved',
      selfApproved:     true,
    };
  }

  /* 3. Settings-driven workflow. */
  if (workflow === 'Auto') {
    return {
      approvalRequired: false,
      approvalMode:     null,
      initialStatus:    'Approved',
      selfApproved:     false,
    };
  }

  return {
    approvalRequired: true,
    approvalMode:     workflow,       /* 'Host' | 'Reception' | 'Director' */
    initialStatus:    'Pending',
    selfApproved:     false,
  };
}

/**
 * canApprove — given an appointment in Pending state, return true if
 * the current user is allowed to approve it under the rules of its
 * approvalMode. Reporting-chain walk handles the Host-mode case.
 */
export function canApprove({ apt, user, orgStaff }) {
  if (!apt || apt.status !== 'Pending') return false;
  const opRoleLower = String(user?.role || '').toLowerCase();
  if (opRoleLower === 'superadmin') return false;   /* platform owner stays out of operational approvals */

  /* VIP always needs Director. A Director can approve ANY VIP in
     their org EXCEPT appointments they created themselves (unless
     they are the sole Director — resolveApprovalRequired already
     auto-approved that case, so this should never be Pending). */
  const isDirector = opRoleLower === 'director';
  const isVip = apt?.visitor?.visitorType === 'VIP';
  if (isVip) {
    if (!isDirector) return false;
    if (apt.createdBy === user?.name) return false; /* no self-approval of your own VIP */
    return true;
  }

  const mode = apt.approvalMode;
  if (!mode) return false;

  if (mode === 'Director') return isDirector;

  if (mode === 'Reception') {
    return ['director', 'manager', 'reception'].includes(opRoleLower);
  }

  if (mode === 'Host') {
    /* Director can approve any host-mode appointment in their org. */
    if (isDirector) return true;
    /* The named host can approve their own appointment. */
    if (apt.hostUserId && user?.staffId === apt.hostUserId) return true;
    if (apt.hostUserId && user?.id === apt.hostUserId) return true;
    /* Reporting-chain walk — walk up from the host to see if the
       current user is in the line of report. */
    const byId = new Map((orgStaff || []).map((s) => [s.id, s]));
    let cursor = apt.hostUserId;
    const seen = new Set();
    for (let i = 0; i < 20 && cursor && !seen.has(cursor); i += 1) {
      seen.add(cursor);
      const parent = byId.get(cursor)?.reportingToUserId || null;
      if (parent && (parent === user?.staffId || parent === user?.id)) return true;
      cursor = parent;
    }
    return false;
  }

  return false;
}

/* ── Double-booking detection ───────────────────────────────────── */

function rangesOverlap(startA, endA, startB, endB) {
  if (!startA || !endA || !startB || !endB) return false;
  /* [startA, endA) intersects [startB, endB). */
  return startA < endB && startB < endA;
}

/**
 * detectRoomConflict — returns an array of conflicting appointments
 * (empty if clean). A conflict means same roomId + same date + time
 * overlap + non-terminal status + different id from the draft.
 */
export function detectRoomConflict(draft, allApts = [], opts = {}) {
  const { excludeId = null } = opts;
  if (!draft?.roomId) return [];
  const aStart = apptEpoch(draft, 'start');
  const aEnd   = apptEpoch(draft, 'end');
  if (aStart == null || aEnd == null) return [];
  return (allApts || []).filter((b) => {
    if (!b || b.id === excludeId) return false;
    if (b.roomId !== draft.roomId) return false;
    if (TERMINAL_STATUSES.has(b.status)) return false;
    if ((b.scheduledDate || b.date) !== (draft.scheduledDate || draft.date)) return false;
    const bStart = apptEpoch(b, 'start');
    const bEnd   = apptEpoch(b, 'end');
    return rangesOverlap(aStart, aEnd, bStart, bEnd);
  });
}

/**
 * detectHostConflict — same-host overlap. Empty array = clean.
 */
export function detectHostConflict(draft, allApts = [], opts = {}) {
  const { excludeId = null } = opts;
  if (!draft?.hostUserId) return [];
  const aStart = apptEpoch(draft, 'start');
  const aEnd   = apptEpoch(draft, 'end');
  if (aStart == null || aEnd == null) return [];
  return (allApts || []).filter((b) => {
    if (!b || b.id === excludeId) return false;
    if (b.hostUserId !== draft.hostUserId) return false;
    if (TERMINAL_STATUSES.has(b.status)) return false;
    if ((b.scheduledDate || b.date) !== (draft.scheduledDate || draft.date)) return false;
    const bStart = apptEpoch(b, 'start');
    const bEnd   = apptEpoch(b, 'end');
    return rangesOverlap(aStart, aEnd, bStart, bEnd);
  });
}

/* ── Timezone display ──────────────────────────────────────────── */

const IANA_TO_ABBR = Object.freeze({
  'Asia/Kolkata':  'IST',
  'Asia/Dubai':    'GST',
  'Asia/Riyadh':   'AST',
  'Asia/Qatar':    'AST',
  'Asia/Muscat':   'GST',
  'Asia/Kuwait':   'AST',
  'Asia/Bahrain':  'AST',
  'Europe/London': 'BST',
  'Europe/Paris':  'CET',
  'Europe/Berlin': 'CET',
  'America/New_York':    'EST',
  'America/Chicago':     'CST',
  'America/Los_Angeles': 'PST',
  'Asia/Singapore': 'SGT',
  'Asia/Hong_Kong': 'HKT',
  'Asia/Tokyo':     'JST',
  'UTC':            'UTC',
});

export function getTimezoneAbbr(iana) {
  return IANA_TO_ABBR[iana] || iana || 'UTC';
}

/** 'HH:mm' → 'h:mm AM/PM'. Empty → '—'. */
export function to12hAmPm(hhmm) {
  if (!hhmm || !/^\d{2}:\d{2}$/.test(hhmm)) return '—';
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

/** Format an appointment's time range with the office's timezone
 *  abbreviation appended. Example: "10:00 AM – 11:00 AM IST". */
export function formatAppointmentTime(apt, office) {
  if (!apt) return '—';
  const s = to12hAmPm(apt.startTime || apt.time);
  const e = to12hAmPm(apt.endTime || '');
  const tz = getTimezoneAbbr(office?.operations?.timezone);
  if (e === '—') return `${s} ${tz}`;
  return `${s} – ${e} ${tz}`;
}

/** Format a 'YYYY-MM-DD' as DD/MM/YYYY. */
export function formatDateGB(iso) {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB');
}

/** Format an ISO timestamp for audit strips: "19/04/2026, 10:00 AM". */
export function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const datePart = d.toLocaleDateString('en-GB');
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const suffix = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${datePart}, ${h}:${m} ${suffix}`;
}

/* ── Derived display status ─────────────────────────────────────── */

/**
 * displayStatus — combines stored status with computed pills. Used
 * by list / calendar / detail views so every surface shows the same
 * label. Returns an object: { label, tone }.
 */
export function displayStatus(apt) {
  const status = apt?.status;
  if (status === 'Approved') {
    if (isOverdue(apt))  return { label: 'Overdue',  tone: 'amber' };
    if (isUpcoming(apt)) return { label: 'Upcoming', tone: 'violet' };
    return { label: 'Approved', tone: 'emerald' };
  }
  const toneByStatus = {
    Pending:       'amber',
    'Checked-In':  'blue',
    'In-Progress': 'violet',
    Completed:     'emerald',
    Cancelled:     'slate',
    'No-Show':     'red',
  };
  return { label: status || '—', tone: toneByStatus[status] || 'slate' };
}
