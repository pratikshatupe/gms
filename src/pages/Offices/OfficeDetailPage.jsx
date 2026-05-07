import React, { useMemo, useState } from 'react';
import {
  ArrowLeft, Building2, MapPin, Phone, Clock, Mail, UserCircle2,
  UserPlus, Plus, ArrowRight, Pencil, BadgeCheck, Globe2,
  Users, Calendar, CalendarDays, Percent, Settings, DoorOpen,
} from 'lucide-react';
import { to12hAmPm, WORKING_DAYS } from './AddOfficeDrawer';

/**
 * OfficeDetailPage — 5-tab detail view for a single office.
 *
 * Overview is fully built; Rooms / Staff / Visitors / Settings are
 * placeholders per the brief. Navigation back to the list uses the
 * `onBack` callback provided by the parent page (no react-router
 * coupling — matches the codebase's setActivePage pattern).
 */

const TABS = [
  { key: 'overview',  label: 'Overview',  Icon: Building2 },
  { key: 'rooms',     label: 'Rooms',     Icon: DoorOpen },
  { key: 'staff',     label: 'Staff',     Icon: Users },
  { key: 'visitors',  label: 'Visitors',  Icon: Calendar },
  { key: 'settings',  label: 'Settings',  Icon: Settings },
];

export default function OfficeDetailPage({ office, onBack, onEdit, onNavigate, canEdit }) {
  const [tab, setTab] = useState('overview');

  if (!office) {
    return (
      <div className="px-4 py-8 sm:px-6">
        <p className="text-[13px] text-slate-500">Office not found.</p>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0">
      {/* Top bar — back + title + actions */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <button
            type="button"
            onClick={onBack}
            title="Back to all offices"
            className="mb-2 inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-[#142535] dark:bg-[#0A1828] dark:text-slate-300"
          >
            <ArrowLeft size={13} aria-hidden="true" />
            Back to Offices
          </button>
          <h1 className="font-[Outfit,sans-serif] text-[22px] font-extrabold leading-tight text-[#0C2340] dark:text-slate-100">
            {office.name}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-slate-500 dark:text-slate-400">
            <span className="font-mono font-bold text-slate-700 dark:text-slate-200">{office.code}</span>
            <span aria-hidden="true">·</span>
            <span>{office.type}</span>
            <span aria-hidden="true">·</span>
            <StatusPill status={office.status} />
          </div>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={onEdit}
            title="Edit this office"
            className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-sky-700 bg-gradient-to-r from-sky-600 to-sky-800 px-4 py-2 text-[13px] font-bold text-white shadow-sm transition hover:from-sky-700 hover:to-sky-900"
          >
            <Pencil size={13} aria-hidden="true" />
            Edit Office
          </button>
        )}
      </div>

      {/* Tabs */}
      <div role="tablist" aria-label="Office tabs" className="mb-4 flex flex-wrap gap-1 rounded-[12px] border border-slate-200 bg-white p-1 shadow-sm dark:border-[#142535] dark:bg-[#0A1828]">
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

      {/* Tab panels */}
      {tab === 'overview' && <OverviewTab office={office} onNavigate={onNavigate} />}
      {tab === 'rooms'    && <ComingSoon Icon={DoorOpen}  title="Rooms module coming soon." subtitle="Manage meeting rooms, cabins, and common areas for this office." />}
      {tab === 'staff'    && <ComingSoon Icon={Users}     title="Staff module coming soon." subtitle="View and manage team members assigned to this office." />}
      {tab === 'visitors' && <ComingSoon Icon={Calendar}  title="Guest log coming soon."    subtitle="View today's visitors and historical check-ins for this office." />}
      {tab === 'settings' && <ComingSoon Icon={Settings}  title="Office settings coming soon." subtitle="Configure check-in rules, working hours, and visitor policies." />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 *   Overview tab
 * ═══════════════════════════════════════════════════════════════════ */

function OverviewTab({ office, onNavigate }) {
  const workingDaysText = useMemo(() => {
    const days = Array.isArray(office.operations?.workingDays) ? office.operations.workingDays : [];
    return WORKING_DAYS.filter((d) => days.includes(d)).join(', ') || '—';
  }, [office.operations?.workingDays]);

  const stats = [
    { key: 'today',     label: "Visitors Today",     value: 0, Icon: Users,       tone: 'violet' },
    { key: 'week',      label: 'Visitors This Week', value: 0, Icon: CalendarDays, tone: 'blue'   },
    { key: 'month',     label: 'Visitors This Month',value: 0, Icon: Calendar,    tone: 'emerald'},
    { key: 'occupancy', label: 'Current Occupancy',  value: '0%', Icon: Percent,  tone: 'amber'  },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      {/* Left 40% — Address / Contact / Operations cards */}
      <div className="flex flex-col gap-4">
        <Card Icon={MapPin} title="Address">
          <Pair label="Line 1" value={office.address?.line1 || '—'} />
          {office.address?.line2 && <Pair label="Line 2" value={office.address.line2} />}
          <Pair label="City"        value={office.address?.city        || '—'} />
          <Pair label="State"       value={office.address?.state       || '—'} />
          <Pair label="Country"     value={office.address?.country     || '—'} Icon={Globe2} />
          <Pair label="Postal Code" value={office.address?.postalCode  || '—'} mono />
        </Card>

        <Card Icon={Phone} title="Contact">
          <Pair label="Contact Number" value={office.contact?.contactNumber || '—'} mono />
          <Pair
            label="Email ID"
            value={office.contact?.emailId || '—'}
            Icon={Mail}
            action={office.contact?.emailId ? (
              <a
                href={`mailto:${office.contact.emailId}`}
                className="text-[11px] font-bold text-sky-700 hover:underline dark:text-sky-300"
              >
                Send email
              </a>
            ) : null}
          />
          <Pair label="Manager Name" value={office.contact?.managerName || '—'} Icon={UserCircle2} />
        </Card>

        <Card Icon={Clock} title="Operations">
          <Pair label="Open Time"    value={to12hAmPm(office.operations?.openTime)} />
          <Pair label="Close Time"   value={to12hAmPm(office.operations?.closeTime)} />
          <Pair label="Working Days" value={workingDaysText} />
          <Pair label="Timezone"     value={office.operations?.timezone || '—'} />
          <Pair label="Maximum Capacity" value={(Number(office.operations?.maxCapacity) || 0).toLocaleString('en-GB')} />
        </Card>
      </div>

      {/* Right 60% — stats + quick actions */}
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
              Icon={Plus}
              label="Add Room"
              tone="violet"
              onClick={() => onNavigate?.('rooms')}
            />
            <QuickActionBtn
              Icon={UserPlus}
              label="Add Staff"
              tone="blue"
              onClick={() => onNavigate?.('staff')}
            />
            <QuickActionBtn
              Icon={ArrowRight}
              label="View Visitor Log"
              tone="emerald"
              onClick={() => onNavigate?.('guest-log')}
            />
          </div>
        </div>

        {/* Audit strip */}
        <div className="rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm dark:border-[#142535] dark:bg-[#0A1828]">
          <h3 className="mb-3 inline-flex items-center gap-2 font-[Outfit,sans-serif] text-[13px] font-extrabold uppercase tracking-[0.08em] text-sky-700 dark:text-sky-300">
            <BadgeCheck size={13} aria-hidden="true" /> Audit
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Pair label="Created At" value={formatDateTime(office.createdAt)} />
            <Pair label="Created By" value={office.createdBy || '—'} />
            <Pair label="Updated At" value={formatDateTime(office.updatedAt)} />
            <Pair label="Updated By" value={office.updatedBy || '—'} />
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

function QuickActionBtn({ Icon, label, tone, onClick }) {
  const toneCls = {
    violet:  'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 dark:border-sky-400/30 dark:bg-sky-500/15 dark:text-sky-300',
    blue:    'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-300',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300',
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`inline-flex cursor-pointer items-center gap-2 rounded-[10px] border px-3 py-2 text-[12px] font-bold transition ${toneCls}`}
    >
      <Icon size={14} aria-hidden="true" />
      {label}
    </button>
  );
}

function StatusPill({ status }) {
  const active = status === 'Active';
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold ${active
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
        : 'border-slate-200 bg-slate-100 text-slate-500 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-400'}`}
    >
      {status || 'Active'}
    </span>
  );
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
