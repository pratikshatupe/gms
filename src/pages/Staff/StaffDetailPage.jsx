import React, { useMemo, useState } from 'react';
import {
  ArrowLeft, UserRound, Mail, Phone, Briefcase, Shield, Building2,
  Calendar, KeyRound, Pencil, BadgeCheck, Users, Clock3, Activity,
  MailPlus, UserCog, RefreshCcw,
} from 'lucide-react';
import { useCollection, STORAGE_KEYS } from '../../store';
import { MOCK_STAFF, MOCK_OFFICES } from '../../data/mockData';
import { Toast } from '../../components/ui';
import ResetPasswordModal from './ResetPasswordModal';

/**
 * StaffDetailPage — Overview tab full + 3 placeholder tabs.
 *
 * Layout (Overview):
 *   Left 40%: Personal / Employment / Access cards.
 *   Right 60%: 4 stat cards + Quick Actions row + Audit strip.
 *
 * Quick Actions:
 *   • Resend Invite — emits a toast preview (real email in Module 12).
 *   • Reset Password — opens ResetPasswordModal.
 *   • Change Role — a link back to the list page's edit drawer.
 *
 * Self-reset (Director viewing their own detail page) surfaces the
 * Reset Password button as disabled with the tooltip:
 *   "To reset your own password, use Settings → Security."
 * The disabled click shows a toast directing them to Module 11.
 */

const TABS = [
  { key: 'overview',    label: 'Overview',     Icon: UserRound },
  { key: 'appointments',label: 'Appointments', Icon: Calendar  },
  { key: 'services',    label: 'Services',     Icon: Activity  },
  { key: 'activity',    label: 'Activity',     Icon: Clock3    },
];

export default function StaffDetailPage({
  staffRow, onBack, onEdit, canEdit, currentUser,
}) {
  const [tab, setTab]     = useState('overview');
  const [resetOpen, setResetOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [officesAll] = useCollection(STORAGE_KEYS.OFFICES, MOCK_OFFICES);
  const [staffAll]   = useCollection(STORAGE_KEYS.STAFF,   MOCK_STAFF);

  const showToast = (msg, type = 'success') => setToast({ msg, type });

  const office = useMemo(
    () => (officesAll || []).find((o) => o?.id === staffRow?.officeId) || null,
    [officesAll, staffRow],
  );
  const manager = useMemo(
    () => (staffAll || []).find((s) => s?.id === staffRow?.reportingToUserId) || null,
    [staffAll, staffRow],
  );
  const directReports = useMemo(
    () => (staffAll || []).filter((s) => s && s.reportingToUserId === staffRow?.id),
    [staffAll, staffRow],
  );

  if (!staffRow) {
    return (
      <div className="px-4 py-8 sm:px-6">
        <p className="text-[13px] text-slate-500">Staff not found.</p>
      </div>
    );
  }

  const isSelf = currentUser?.id === staffRow.id;
  const selfResetNote = isSelf
    ? 'To reset your own password, use Settings → Security.'
    : null;

  return (
    <div className="w-full min-w-0">
      {/* Top bar */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <button
            type="button"
            onClick={onBack}
            title="Back to Staff"
            className="mb-2 inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-[#142535] dark:bg-[#0A1828] dark:text-slate-300"
          >
            <ArrowLeft size={13} aria-hidden="true" />
            Back to Staff
          </button>
          <h1 className="font-[Outfit,sans-serif] text-[22px] font-extrabold leading-tight text-[#0C2340] dark:text-slate-100">
            {staffRow.fullName || staffRow.name}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-slate-500 dark:text-slate-400">
            <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
              {staffRow.employeeId || '—'}
            </span>
            <span aria-hidden="true">·</span>
            <span>{staffRow.designation || '—'}</span>
            <span aria-hidden="true">·</span>
            <RolePill role={staffRow.role} />
            <span aria-hidden="true">·</span>
            <AccessStatusPill status={staffRow.accessStatus} />
          </div>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={onEdit}
            title="Edit this staff member"
            className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-sky-700 bg-gradient-to-r from-sky-600 to-sky-800 px-4 py-2 text-[13px] font-bold text-white shadow-sm transition hover:from-sky-700 hover:to-sky-900"
          >
            <Pencil size={13} aria-hidden="true" />
            Edit Staff
          </button>
        )}
      </div>

      {/* Tabs */}
      <div role="tablist" aria-label="Staff tabs" className="mb-4 flex flex-wrap gap-1 rounded-[12px] border border-slate-200 bg-white p-1 shadow-sm dark:border-[#142535] dark:bg-[#0A1828]">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.key)}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-[12px] font-semibold transition ${active
                ? 'bg-sky-700 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-[#1E1E3F]'}`}
            >
              <t.Icon size={13} aria-hidden="true" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'overview' && (
        <OverviewTab
          staffRow={staffRow}
          office={office}
          manager={manager}
          directReportsCount={directReports.length}
          canEdit={canEdit}
          isSelf={isSelf}
          selfResetNote={selfResetNote}
          onEdit={onEdit}
          onResendInvite={() => showToast(`Invitation email preview logged to console for ${staffRow.fullName || staffRow.name}.`)}
          onResetPassword={() => {
            if (isSelf) {
              showToast('Self-service password reset ships in Module 11.', 'info');
              return;
            }
            setResetOpen(true);
          }}
        />
      )}
      {tab === 'appointments' && <ComingSoon Icon={Calendar}   title="Appointments coming soon." subtitle="The Appointments module will list every visit hosted by this staff member, with statuses and feedback." />}
      {tab === 'services'     && <ComingSoon Icon={Activity}   title="Services coming soon."    subtitle="Once Service-to-Staff assignments go live, this tab will show which services this member delivers." />}
      {tab === 'activity'     && <ComingSoon Icon={Clock3}     title="Activity coming soon."    subtitle="Recent logins, permission changes and audit events will appear here." />}

      {resetOpen && (
        <ResetPasswordModal
          open
          staffRow={staffRow}
          currentUser={currentUser}
          onClose={() => setResetOpen(false)}
          onReset={() => {
            setResetOpen(false);
            showToast(`Password reset for ${staffRow.fullName || staffRow.name}.`);
          }}
        />
      )}

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 *   Overview tab
 * ═══════════════════════════════════════════════════════════════════ */

function OverviewTab({
  staffRow, office, manager, directReportsCount, canEdit,
  isSelf, selfResetNote, onEdit, onResendInvite, onResetPassword,
}) {
  const stats = [
    { key: 'appointments', label: 'Appointments Hosted', value: 0, Icon: Calendar, tone: 'violet' },
    { key: 'services',     label: 'Services Assigned',   value: 0, Icon: Activity, tone: 'blue'   },
    { key: 'reports',      label: 'Direct Reports',      value: directReportsCount, Icon: Users, tone: 'emerald' },
    { key: 'active',       label: 'Active Days',         value: 0, Icon: Clock3, tone: 'amber' },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div className="flex flex-col gap-4">
        <Card Icon={UserRound} title="Personal">
          <Pair label="Full Name" value={staffRow.fullName || staffRow.name || '—'} />
          <Pair label="Date of Birth" value={formatDate(staffRow.dateOfBirth)} />
          <Pair label="Gender" value={staffRow.gender || '—'} />
          <Pair label="Contact Number" value={staffRow.contactNumber || '—'} mono Icon={Phone} />
          <Pair label="Email ID" value={staffRow.emailId || '—'} mono Icon={Mail}
                action={staffRow.emailId ? (
                  <a href={`mailto:${staffRow.emailId}`} className="text-[11px] font-bold text-sky-700 hover:underline dark:text-sky-300">Send email</a>
                ) : null} />
        </Card>

        <Card Icon={Briefcase} title="Employment">
          <Pair label="Employee ID" value={staffRow.employeeId || '—'} mono />
          <Pair label="Designation" value={staffRow.designation || '—'} />
          <Pair label="Role" value={<RolePill role={staffRow.role} />} />
          <Pair label="Office" value={office ? `${office.name} (${office.code})` : '—'} Icon={Building2} />
          <Pair label="Reporting To" value={manager ? `${manager.fullName || manager.name} — ${manager.role}` : '—'} />
          <Pair label="Joining Date" value={formatDate(staffRow.joiningDate)} Icon={Calendar} />
        </Card>

        <Card Icon={Shield} title="Access">
          <Pair label="Access Status" value={<AccessStatusPill status={staffRow.accessStatus} />} />
          <Pair label="Employment Status" value={<StatusPill status={staffRow.status} />} />
          <Pair
            label="Must Change Password"
            value={staffRow.mustChangePassword
              ? <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">Yes</span>
              : <span className="text-[12px] font-semibold text-slate-500 dark:text-slate-400">No</span>}
          />
          <Pair label="Last Login" value="—" />
        </Card>
      </div>

      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          {stats.map((s) => <StatCard key={s.key} {...s} />)}
        </div>

        <div className="rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm dark:border-[#142535] dark:bg-[#0A1828]">
          <h3 className="mb-3 font-[Outfit,sans-serif] text-[13px] font-extrabold uppercase tracking-[0.08em] text-sky-700 dark:text-sky-300">
            Quick Actions
          </h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <QuickActionBtn
              Icon={MailPlus}
              label="Resend Invite"
              tone="emerald"
              onClick={onResendInvite}
              title={`Resend invitation email to ${staffRow.fullName || staffRow.name}.`}
            />
            <QuickActionBtn
              Icon={RefreshCcw}
              label="Reset Password"
              tone="violet"
              onClick={onResetPassword}
              title={selfResetNote || `Generate a new temporary password for ${staffRow.fullName || staffRow.name}.`}
              disabled={isSelf}
            />
            <QuickActionBtn
              Icon={UserCog}
              label="Change Role"
              tone="blue"
              onClick={canEdit ? onEdit : undefined}
              title="Open edit drawer to change role."
              disabled={!canEdit}
            />
          </div>
        </div>

        <div className="rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm dark:border-[#142535] dark:bg-[#0A1828]">
          <h3 className="mb-3 inline-flex items-center gap-2 font-[Outfit,sans-serif] text-[13px] font-extrabold uppercase tracking-[0.08em] text-sky-700 dark:text-sky-300">
            <BadgeCheck size={13} aria-hidden="true" /> Audit
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Pair label="Created At" value={formatDateTime(staffRow.createdAt)} />
            <Pair label="Created By" value={staffRow.createdBy || '—'} />
            <Pair label="Updated At" value={formatDateTime(staffRow.updatedAt)} />
            <Pair label="Updated By" value={staffRow.updatedBy || '—'} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 *   Presentational bits
 * ═══════════════════════════════════════════════════════════════════ */

function Card({ Icon, title, children }) {
  return (
    <div className="rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm dark:border-[#142535] dark:bg-[#0A1828]">
      <h3 className="mb-3 inline-flex items-center gap-2 font-[Outfit,sans-serif] text-[13px] font-extrabold uppercase tracking-[0.08em] text-sky-700 dark:text-sky-300">
        {Icon && <Icon size={13} aria-hidden="true" />}
        {title}
      </h3>
      <div className="space-y-1.5">{children}</div>
    </div>
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
        <div className={`min-w-0 break-words text-[13px] ${mono ? 'font-mono' : 'font-semibold'} text-[#0C2340] dark:text-slate-100`}>
          {value}
        </div>
        {action}
      </div>
    </div>
  );
}

function StatCard({ label, value, Icon, tone }) {
  const toneCls = {
    violet:  'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-400/30',
    blue:    'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30',
    amber:   'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
  }[tone];
  return (
    <div className="flex items-center justify-between gap-3 rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm dark:border-[#142535] dark:bg-[#0A1828]">
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400">
          {label}
        </p>
        <p className="mt-1 font-[Outfit,sans-serif] text-[26px] font-extrabold leading-none text-[#0C2340] dark:text-slate-100">
          {typeof value === 'number' ? value.toLocaleString('en-GB') : value}
        </p>
      </div>
      <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border ${toneCls}`}>
        <Icon size={18} aria-hidden="true" />
      </span>
    </div>
  );
}

function QuickActionBtn({ Icon, label, tone, onClick, title, disabled }) {
  const toneCls = {
    violet:  'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 dark:border-sky-400/30 dark:bg-sky-500/15 dark:text-sky-300',
    blue:    'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-300',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300',
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`inline-flex cursor-pointer items-center gap-2 rounded-[10px] border px-3 py-2 text-[12px] font-bold transition ${toneCls} disabled:cursor-not-allowed disabled:opacity-40`}
    >
      <Icon size={14} aria-hidden="true" />
      {label}
    </button>
  );
}

function RolePill({ role }) {
  const cls = {
    'Director':      'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/30 dark:bg-sky-500/15 dark:text-sky-300',
    'Manager':       'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-300',
    'Reception':     'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-500/30 dark:bg-cyan-500/15 dark:text-cyan-300',
    'Service Staff': 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300',
  }[role] || 'border-slate-200 bg-slate-100 text-slate-600';
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold ${cls}`}>
      {role || '—'}
    </span>
  );
}

function AccessStatusPill({ status }) {
  const cls = {
    'Invited':  'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300',
    'Pending':  'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
    'Active':   'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300',
    'Inactive': 'border-slate-200 bg-slate-100 text-slate-500 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-400',
  }[status] || 'border-slate-200 bg-slate-100 text-slate-500';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${cls}`}>
      <span aria-hidden="true">●</span>
      {status || 'Pending'}
    </span>
  );
}

function StatusPill({ status }) {
  return <AccessStatusPill status={status} />;
}

function ComingSoon({ Icon, title, subtitle }) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-[14px] border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-sm dark:border-[#142535] dark:bg-[#0A1828]">
      <Icon size={64} strokeWidth={1.25} aria-hidden="true" className="text-slate-300 dark:text-slate-600" />
      <p className="font-[Outfit,sans-serif] text-[15px] font-extrabold text-[#0C2340] dark:text-slate-100">
        {title}
      </p>
      <p className="max-w-md text-[12px] text-slate-500 dark:text-slate-400">
        {subtitle}
      </p>
    </div>
  );
}

/* ── Date helpers ─────────────────────────────────────────────────── */

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
}

function formatDateTime(iso) {
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

/* Silence unused-import — retained for future audit strip. */
void KeyRound;
