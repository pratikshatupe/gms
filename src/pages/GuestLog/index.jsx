import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  FileDown, Search, X, ChevronRight, UserRound, Building2,
  Calendar, ClipboardList, Clock, CheckCircle, TrendingUp,
  SlidersHorizontal, ChevronDown,
} from 'lucide-react';
import { useCollection, STORAGE_KEYS, SAME_TAB_EVENT } from '../../store';
import { MOCK_APPOINTMENTS } from '../../data/mockAppointments';
import {
  MOCK_OFFICES, MOCK_STAFF, MOCK_SERVICES, MOCK_ORGANIZATIONS,
} from '../../data/mockData';
import { useAuth } from '../../context/AuthContext';
import { useRole } from '../../context/RoleContext';
import NoAccess from '../../components/NoAccess';
import { Pagination, SearchableSelect, EmptyState, Toast } from '../../components/ui';
import {
  byOrg, displayStatus, formatDateGB, VISITOR_TYPES,
} from '../../utils/appointmentState';
import {
  buildGuestLogRows, filterGuestLog, datePresets,
  validateCustomDateRange,
} from '../../utils/guestLogAnalytics';
import { VISITOR_TYPE_META } from '../Appointments/AddAppointmentDrawer';
import { addAuditLog } from '../../utils/auditLogger';
import GuestDetailDrawer from './GuestDetailDrawer';
import ExportDialog from './ExportDialog';
import AppointmentDetailPage from '../Appointments/AppointmentDetailPage';

const STATUS_DEFAULT    = ['Checked-In', 'In-Progress', 'Completed', 'Cancelled', 'No-Show'];
const STATUS_WITH_SCHED = ['Pending', 'Approved', 'Checked-In', 'In-Progress', 'Completed', 'Cancelled', 'No-Show'];

export default function GuestLog({ setActivePage }) {
  const { user }          = useAuth();
  const { hasPermission } = useRole();

  if (!hasPermission('guest-log', 'view')) {
    return (
      <NoAccess module="Guest Log"
        onGoBack={setActivePage ? () => setActivePage('dashboard') : undefined} />
    );
  }

  return <GuestLogBody user={user} hasPermission={hasPermission} setActivePage={setActivePage} />;
}

function GuestLogBody({ user, setActivePage }) {
  const [appointments] = useCollection(STORAGE_KEYS.APPOINTMENTS, MOCK_APPOINTMENTS);
  const [offices]      = useCollection(STORAGE_KEYS.OFFICES,      MOCK_OFFICES);
  const [staffAll]     = useCollection(STORAGE_KEYS.STAFF,        MOCK_STAFF);
  const [servicesAll]  = useCollection(STORAGE_KEYS.SERVICES,     MOCK_SERVICES);
  const [orgsAll]      = useCollection(STORAGE_KEYS.ORGANIZATIONS, MOCK_ORGANIZATIONS);

  /* Real-time refresh — the Guest Log must reflect every check-in /
     check-out / walk-in the instant it happens, in both the Director
     and Super Admin views. The previous 15-second tick only forced a
     re-render; it did not re-read localStorage, so writes that landed
     between tab focus changes (or before this listener mounted) were
     invisible until a manual reload.
   *
     We now poll every 2 seconds and dispatch the SAME_TAB_EVENT for
     each data store the page reads. `useCollection` already filters
     out no-op updates (it diffs the raw JSON before re-rendering), so
     the broadcast is cheap when nothing changed and instant when it
     did. The `lastUpdatedAt` state is bumped on every real change so
     the header can show "Live · updated HH:MM:SS". */
  const REFRESH_KEYS = useMemo(() => [
    STORAGE_KEYS.APPOINTMENTS,
    STORAGE_KEYS.OFFICES,
    STORAGE_KEYS.STAFF,
    STORAGE_KEYS.SERVICES,
    STORAGE_KEYS.ORGANIZATIONS,
  ], []);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(() => new Date());
  useEffect(() => {
    const tick = () => {
      for (const key of REFRESH_KEYS) {
        try {
          window.dispatchEvent(new CustomEvent(SAME_TAB_EVENT, { detail: { key } }));
        } catch { /* very old browsers — ignore */ }
      }
    };
    const id = setInterval(tick, 2000);
    return () => clearInterval(id);
  }, [REFRESH_KEYS]);

  const opRoleLower = String(user?.role || '').toLowerCase();
  const isSuperRead = opRoleLower === 'superadmin';
  const canExport   = true; // Super Admin and all roles can export

  const [search, setSearch]             = useState('');
  const [dateRange, setDateRange]       = useState('all');
  const [customStart, setCustomStart]   = useState('');
  const [customEnd, setCustomEnd]       = useState('');
  const [customError, setCustomError]   = useState('');
  const [statusFilter, setStatusF]      = useState('all');
  const [officeFilter, setOfficeF]      = useState('all');
  const [hostFilter, setHostF]          = useState('all');
  const [typeFilter, setTypeF]          = useState('all');
  const [includeScheduledOnly, setInc]  = useState(false);
  const [filtersOpen, setFiltersOpen]   = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const iso  = /^\d{4}-\d{2}-\d{2}$/;
    const from = searchParams.get('from');
    const to   = searchParams.get('to');
    const rng  = searchParams.get('dateRange');
    if (from && iso.test(from)) setCustomStart(from);
    if (to   && iso.test(to))   setCustomEnd(to);
    if (rng) setDateRange(rng);
    else if ((from && iso.test(from)) || (to && iso.test(to))) setDateRange('custom');
    const status = searchParams.get('status');
    const type   = searchParams.get('type');
    const office = searchParams.get('office');
    const host   = searchParams.get('host');
    if (status) setStatusF(status);
    if (type)   setTypeF(type);
    if (office) setOfficeF(office);
    if (host)   setHostF(host);
    if (searchParams.toString()) setSearchParams(new URLSearchParams(), { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [page, setPage]             = useState(1);
  const [perPage, setPerPage]       = useState(20);
  const [viewId, setViewId]         = useState(null);
  const [fullDetailRow, setFullDetailRow] = useState(null);
  const [showExport, setShowExport] = useState(false);
  const [toast, setToast]           = useState(null);

  const showToast = (msg, type = 'success') => setToast({ msg, type });

  const scopedAppointments = useMemo(() => byOrg(appointments, user), [appointments, user]);
  const scopedOffices      = useMemo(() => byOrg(offices,      user), [offices,      user]);
  const scopedStaff        = useMemo(() => byOrg(staffAll,     user), [staffAll,     user]);
  const scopedServices     = useMemo(() => byOrg(servicesAll,  user), [servicesAll,  user]);

  const officePickerOptions = useMemo(() => {
    if (!isSuperRead) return scopedOffices.map((o) => ({ value: o.id, label: `${o.name} (${o.code})` }));
    const orgById = new Map((orgsAll || []).map((o) => [o?.id, o]));
    return scopedOffices.map((o) => {
      const org = orgById.get(o.orgId);
      return { value: o.id, label: `${org?.name ? `[${org.name}] ` : ''}${o.name} (${o.code})` };
    });
  }, [scopedOffices, isSuperRead, orgsAll]);

  const enrichedRows = useMemo(
    () => buildGuestLogRows(scopedAppointments, {
      offices: scopedOffices, staff: scopedStaff,
      services: scopedServices, orgs: orgsAll,
      includeScheduledOnly,
    }),
    [scopedAppointments, scopedOffices, scopedStaff, scopedServices, orgsAll, includeScheduledOnly],
  );

  /* Whenever the underlying appointment data actually changes (a guest
   * is added or checked out by any role on this tab or another), bump
   * the "last updated" timestamp shown in the header so the operator
   * can see the page is live. We diff on the appointments fingerprint
   * — id + status + checkedInAt + checkedOutAt — to ignore renders
   * caused by unrelated re-mounts. */
  const apptFingerprint = useMemo(
    () => (scopedAppointments || [])
      .map((a) => `${a?.id}|${a?.status}|${a?.checkedInAt || ''}|${a?.checkedOutAt || ''}`)
      .join('§'),
    [scopedAppointments],
  );
  const fingerprintRef = React.useRef(apptFingerprint);
  useEffect(() => {
    if (fingerprintRef.current !== apptFingerprint) {
      fingerprintRef.current = apptFingerprint;
      setLastUpdatedAt(new Date());
    }
  }, [apptFingerprint]);

  useEffect(() => {
    if (dateRange !== 'custom') { setCustomError(''); return; }
    setCustomError(validateCustomDateRange(customStart, customEnd) || '');
  }, [dateRange, customStart, customEnd]);

  const filtered = useMemo(() => {
    if (dateRange === 'custom' && customError) return [];
    return filterGuestLog(enrichedRows, {
      search, dateRange, customStart, customEnd,
      status: statusFilter, officeId: officeFilter,
      hostUserId: hostFilter, visitorType: typeFilter,
    });
  }, [enrichedRows, search, dateRange, customStart, customEnd, customError, statusFilter, officeFilter, hostFilter, typeFilter]);

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => {
      const ta = a.apt.checkedInAt || `${a.apt.scheduledDate || a.apt.date}T${a.apt.startTime || a.apt.time || ''}`;
      const tb = b.apt.checkedInAt || `${b.apt.scheduledDate || b.apt.date}T${b.apt.startTime || b.apt.time || ''}`;
      return String(tb).localeCompare(String(ta));
    }),
    [filtered],
  );

  const total      = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage   = Math.min(page, totalPages);
  const slice      = sorted.slice((safePage - 1) * perPage, safePage * perPage);

  const hasFilters = Boolean(search) || dateRange !== 'all' || statusFilter !== 'all'
    || officeFilter !== 'all' || hostFilter !== 'all' || typeFilter !== 'all' || includeScheduledOnly;

  const clearFilters = () => {
    setSearch(''); setDateRange('all');
    setCustomStart(''); setCustomEnd(''); setCustomError('');
    setStatusF('all'); setOfficeF('all'); setHostF('all'); setTypeF('all');
    setInc(false); setPage(1);
  };

  const openRow = useMemo(
    () => (viewId ? sorted.find((r) => r.id === viewId) || null : null),
    [viewId, sorted],
  );

  const orgForExport = useMemo(() => {
    if (isSuperRead) return { name: 'All Tenants' };
    const orgId = user?.organisationId || user?.orgId;
    return (orgsAll || []).find((o) => o?.id === orgId) || { name: 'CorpGMS' };
  }, [orgsAll, user, isSuperRead]);

  const filterSummary = useMemo(() => {
    const parts = [];
    if (dateRange === 'today')       parts.push('Date: Today');
    else if (dateRange === 'week')   parts.push('Date: This Week');
    else if (dateRange === 'month')  parts.push('Date: This Month');
    else if (dateRange === 'custom') parts.push(`Date: ${customStart || 'â€”'} â†’ ${customEnd || 'â€”'}`);
    else                             parts.push('Date: All');
    parts.push(`Status: ${statusFilter === 'all' ? 'All' : statusFilter}`);
    parts.push(`Office: ${officeFilter === 'all' ? 'All' : officeFilter}`);
    parts.push(`Host: ${hostFilter === 'all' ? 'All' : hostFilter}`);
    parts.push(`Type: ${typeFilter === 'all' ? 'All' : typeFilter}`);
    if (search) parts.push(`Search: "${search}"`);
    if (includeScheduledOnly) parts.push('Includes scheduled-only');
    return parts.join(' | ');
  }, [dateRange, customStart, customEnd, statusFilter, officeFilter, hostFilter, typeFilter, search, includeScheduledOnly]);

  /* Quick stats from full enriched set */
  const quickStats = useMemo(() => ({
    total:      enrichedRows.length,
    checkedIn:  enrichedRows.filter((r) => displayStatus(r.apt).label === 'Checked-In').length,
    inProgress: enrichedRows.filter((r) => displayStatus(r.apt).label === 'In-Progress').length,
    completed:  enrichedRows.filter((r) => displayStatus(r.apt).label === 'Completed').length,
  }), [enrichedRows]);

  const statusOptions = includeScheduledOnly ? STATUS_WITH_SCHED : STATUS_DEFAULT;

  const activeFilterCount = [
    search, dateRange !== 'all', statusFilter !== 'all',
    officeFilter !== 'all', hostFilter !== 'all', typeFilter !== 'all', includeScheduledOnly,
  ].filter(Boolean).length;

  return (
    <>
    {/* Full Detail Page — rendered instead of list when a row is opened */}
    {fullDetailRow && (
      <div className="w-full min-h-screen bg-slate-50 dark:bg-[#050E1A]">
        <AppointmentDetailPage
          appointmentRow={fullDetailRow.apt}
          onBack={() => setFullDetailRow(null)}
          canEdit={false}
          currentUser={user}
        />
      </div>
    )}
    {!fullDetailRow && (
    <div className="w-full min-h-screen bg-slate-50 dark:bg-[#050E1A]">
      <div className="mx-auto flex w-full flex-col gap-4">

        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          <button type="button" onClick={() => setActivePage?.('dashboard')}
            className="cursor-pointer rounded-[6px] px-1.5 py-0.5 transition hover:bg-slate-100 hover:text-sky-700 dark:hover:bg-[#1E1E3F] dark:hover:text-sky-300">
            Dashboard
          </button>
          <ChevronRight size={12} aria-hidden="true" className="text-slate-300" />
          <span className="rounded-[6px] px-1.5 py-0.5 text-[#0C2340] dark:text-slate-200">Guest Log</span>
        </nav>

        {/* Header */}
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="font-[Outfit,sans-serif] text-[22px] font-extrabold leading-tight text-[#0C2340] dark:text-slate-100">
                Guest Log
              </h1>
              {/* Live indicator — pulses while the page is mounted so the
                  operator can see the view is updating in real time. */}
              <span
                title={`Live · last update ${lastUpdatedAt.toLocaleTimeString('en-GB')}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
              >
                <span className="relative inline-flex h-2 w-2">
                  <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                Live
                <span className="font-mono text-[10px] font-semibold text-emerald-600/80 dark:text-emerald-300/80">
                  {lastUpdatedAt.toLocaleTimeString('en-GB')}
                </span>
              </span>
            </div>
            <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">
              Unified record of every visitor who has arrived, is arriving, or has left.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Mobile filter toggle */}
            <button type="button" onClick={() => setFiltersOpen((v) => !v)}
              className="flex lg:hidden items-center gap-1.5 rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-[12px] font-bold text-slate-600 shadow-sm hover:bg-slate-50 dark:border-[#142535] dark:bg-[#0A1828] dark:text-slate-300">
              <SlidersHorizontal size={13} />
              Filters
              {activeFilterCount > 0 && (
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-sky-600 text-[10px] font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
              <ChevronDown size={12} className={`transition-transform ${filtersOpen ? 'rotate-180' : ''}`} />
            </button>
            <button type="button"
              onClick={() => { if (canExport) setShowExport(true); }}
              disabled={!canExport}
              title={canExport ? 'Export the current filtered view' : 'Export requires tenant-level permissions. Use impersonation to export for a specific organisation.'}
              className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-sky-700 bg-gradient-to-r from-sky-600 to-sky-800 px-4 py-2.5 text-[13px] font-bold text-white shadow-sm transition hover:from-sky-700 hover:to-sky-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40 disabled:cursor-not-allowed disabled:opacity-40">
              <FileDown size={14} aria-hidden="true" />
              Export
            </button>
          </div>
        </header>

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[
            { label: 'Total Records', value: quickStats.total,      color: 'text-sky-600 dark:text-sky-400',      icon: ClipboardList },
            { label: 'Checked In',    value: quickStats.checkedIn,  color: 'text-cyan-600 dark:text-cyan-400',    icon: CheckCircle   },
            { label: 'In Progress',   value: quickStats.inProgress, color: 'text-amber-600 dark:text-amber-400',  icon: Clock         },
            { label: 'Completed',     value: quickStats.completed,  color: 'text-emerald-600 dark:text-emerald-400', icon: TrendingUp },
          ].map((s) => (
            <div key={s.label} className="rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm dark:border-[#142535] dark:bg-[#0A1828]">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{s.label}</span>
                <s.icon size={14} className={s.color} />
              </div>
              <div className={`font-[Outfit,sans-serif] text-2xl font-black ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Filter bar */}
        <div className={`${filtersOpen ? 'block' : 'hidden'} lg:block rounded-[14px] border border-slate-200 bg-white p-3 shadow-sm dark:border-[#142535] dark:bg-[#0A1828]`}>

          {/* Row 1 */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-6">
            <div className="relative lg:col-span-2">
              <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search by name, contact or company"
                aria-label="Search guest log"
                className="w-full rounded-[10px] border border-slate-200 bg-white py-2 pl-9 pr-9 text-[13px] text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-200" />
              {search && (
                <button type="button" onClick={() => { setSearch(''); setPage(1); }} aria-label="Clear search"
                  className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-[#1E1E3F]">
                  <X size={13} aria-hidden="true" />
                </button>
              )}
            </div>
            <SearchableSelect value={dateRange}
              onChange={(v) => { setDateRange(v); setPage(1); }}
              options={[
                { value: 'all',    label: 'All Dates' },
                { value: 'today',  label: 'Today' },
                { value: 'week',   label: 'This Week' },
                { value: 'month',  label: 'This Month' },
                { value: 'custom', label: 'Custom Range' },
              ]}
              placeholder="Date Range" />
            <SearchableSelect value={statusFilter}
              onChange={(v) => { setStatusF(v); setPage(1); }}
              options={[
                { value: 'all', label: 'All Statuses' },
                ...statusOptions.map((s) => ({ value: s, label: s })),
              ]}
              placeholder="All Statuses" />
            <SearchableSelect value={typeFilter}
              onChange={(v) => { setTypeF(v); setPage(1); }}
              options={[
                { value: 'all', label: 'All Types' },
                ...VISITOR_TYPES.map((t) => ({ value: t, label: t })),
              ]}
              placeholder="All Types" />
            <label className="inline-flex cursor-pointer items-center gap-2 self-center text-[12px] font-semibold text-slate-600 dark:text-slate-300">
              <input type="checkbox" checked={includeScheduledOnly}
                onChange={(e) => { setInc(e.target.checked); setPage(1); }}
                className="h-4 w-4 cursor-pointer accent-sky-600" />
              <span title="Shows upcoming visits that haven't started yet.">Include scheduled</span>
            </label>
          </div>

          {/* Row 2 â€” Host + Office */}
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <SearchableSelect value={hostFilter}
              onChange={(v) => { setHostF(v); setPage(1); }}
              options={[
                { value: 'all', label: 'All Hosts' },
                ...scopedStaff
                  .filter((s) => s.status !== 'Inactive')
                  .sort((a, b) => (a.fullName || a.name || '').localeCompare(b.fullName || b.name || ''))
                  .map((s) => ({ value: s.id, label: s.fullName || s.name })),
              ]}
              placeholder="All Hosts" searchPlaceholder="Search hostâ€¦" />
            <SearchableSelect value={officeFilter}
              onChange={(v) => { setOfficeF(v); setPage(1); }}
              options={[
                { value: 'all', label: 'All Offices' },
                ...officePickerOptions,
              ]}
              placeholder="All Offices" searchPlaceholder="Search officeâ€¦" />
          </div>

          {/* Custom date range */}
          {dateRange === 'custom' && (
            <div className="mt-3 flex flex-col gap-3 rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-3 dark:border-[#142535] dark:bg-[#071220] sm:flex-row sm:flex-wrap sm:items-center">
              <label className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400">
                <Calendar size={12} aria-hidden="true" /> Start date
                <input type="date" value={customStart}
                  onChange={(e) => { setCustomStart(e.target.value); setPage(1); }}
                  max={customEnd || undefined}
                  className="rounded-[8px] border border-slate-200 bg-white px-2 py-1 font-mono text-[12px] text-slate-700 dark:border-[#142535] dark:bg-[#0A1828] dark:text-slate-200" />
              </label>
              <label className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400">
                End date
                <input type="date" value={customEnd}
                  onChange={(e) => { setCustomEnd(e.target.value); setPage(1); }}
                  min={customStart || undefined}
                  max={new Date().toISOString().slice(0, 10)}
                  className="rounded-[8px] border border-slate-200 bg-white px-2 py-1 font-mono text-[12px] text-slate-700 dark:border-[#142535] dark:bg-[#0A1828] dark:text-slate-200" />
              </label>
              <div className="flex flex-wrap gap-2">
                {datePresets().map((p) => (
                  <button key={p.key} type="button"
                    onClick={() => { setCustomStart(p.start); setCustomEnd(p.end); setPage(1); }}
                    className="cursor-pointer rounded-[6px] border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-700 transition hover:bg-sky-100 dark:border-sky-400/40 dark:bg-sky-500/15 dark:text-sky-300">
                    {p.label}
                  </button>
                ))}
                <button type="button"
                  onClick={() => { setCustomStart(''); setCustomEnd(''); setCustomError(''); setDateRange('all'); setPage(1); }}
                  className="cursor-pointer text-[11px] text-slate-500 hover:text-sky-700 dark:text-slate-400 dark:hover:text-sky-300">
                  âœ• Clear
                </button>
              </div>
              {customError && (
                <p role="alert" className="w-full text-[11px] font-semibold text-red-500">{customError}</p>
              )}
            </div>
          )}

          {/* Filter summary */}
          {hasFilters && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Showing <strong>{total}</strong> of <strong>{enrichedRows.length}</strong> records.
              </span>
              <button type="button" onClick={clearFilters}
                className="cursor-pointer rounded-[8px] border border-slate-200 bg-white px-3 py-1 text-[11px] font-bold text-slate-600 transition hover:bg-slate-50 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-300">
                Clear all filters
              </button>
            </div>
          )}
        </div>

        {/* â”€â”€ Desktop Table (lg+) â”€â”€ */}
        <div className="hidden lg:block w-full overflow-x-auto rounded-[14px] border border-slate-200 bg-white shadow-sm dark:border-[#142535] dark:bg-[#0A1828]">
            <table className="w-full min-w-[860px] border-collapse text-left text-[12px]">
              <thead className="bg-slate-50 dark:bg-[#071220]">
                <tr>
                  {['SR.', 'Appointment ID', 'Visitor', 'Host', 'Office', 'Date', 'Check-In', 'Check-Out', 'Status', 'Type'].map((h, i) => (
                    <th key={h}
                      className={`border-b border-slate-100 px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.05em] text-slate-500 dark:border-[#142535] dark:text-slate-400 whitespace-nowrap ${i === 0 ? 'text-center' : 'text-left'}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#142535]">
                {slice.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-3 py-0">
                      <GuestLogEmptyState
                        enriched={enrichedRows} hasFilters={hasFilters}
                        search={search} dateRange={dateRange}
                        customStart={customStart} customEnd={customEnd}
                        status={statusFilter}
                        onClearFilters={clearFilters}
                        onClearSearch={() => setSearch('')}
                        onClearStatus={() => setStatusF('all')}
                        onChangeDateRange={() => setDateRange('all')}
                        onGoToAppointments={() => setActivePage?.('appointments')}
                      />
                    </td>
                  </tr>
                )}
                {slice.map((r, idx) => {
                  const sr       = (safePage - 1) * perPage + idx + 1;
                  const a        = r.apt;
                  const disp     = displayStatus(a);
                  const typeMeta = VISITOR_TYPE_META[r.visitorType] || VISITOR_TYPE_META.Regular;
                  return (
                    <tr key={r.id} onClick={() => setViewId(r.id)}
                      className="cursor-pointer transition hover:bg-sky-50/40 dark:hover:bg-[#1E1E3F]">

                      {/* SR */}
                      <td className="px-3 py-2.5 text-center text-[11px] font-semibold text-slate-400 w-10">{sr}</td>

                      {/* Apt ID */}
                      <td className="px-3 py-2.5 font-mono text-[11px] text-slate-700 dark:text-slate-200 whitespace-nowrap">
                        {a.id || 'â€”'}
                      </td>

                      {/* Visitor */}
                      <td className="px-3 py-2.5 align-middle">
                        <div className="flex items-center gap-1.5 min-w-0 max-w-[170px]">
                          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] border border-sky-200 bg-sky-50 text-[14px] leading-none dark:border-sky-400/30 dark:bg-sky-500/15">
                            {typeMeta.icon}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1 min-w-0">
                              <span className="truncate text-[12px] font-bold text-[#0C2340] dark:text-slate-100">
                                {a.visitor?.fullName || a.guestName || 'â€”'}
                              </span>
                              {r.isWalkIn && (
                                <span className="shrink-0 inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-sky-700 dark:border-sky-400/30 dark:bg-sky-500/15 dark:text-sky-300">Walk-in</span>
                              )}
                            </div>
                            <div className="truncate text-[10px] text-slate-400">
                              {a.visitor?.companyName || a.company || 'â€”'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Host */}
                      <td className="px-3 py-2.5 align-middle max-w-[120px]">
                        <div className="flex items-center gap-1 min-w-0">
                          <UserRound size={11} className="shrink-0 text-slate-400" aria-hidden="true" />
                          <span className="truncate text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                            {r.host?.fullName || r.host?.name || a.host || 'â€”'}
                          </span>
                        </div>
                      </td>

                      {/* Office */}
                      <td className="px-3 py-2.5 align-middle max-w-[140px]">
                        <div className="flex items-center gap-1 min-w-0">
                          <Building2 size={11} className="shrink-0 text-slate-400" aria-hidden="true" />
                          <span className="truncate text-[11px] text-slate-700 dark:text-slate-300">
                            {r.office?.name || 'â€”'}
                          </span>
                        </div>
                      </td>

                      {/* Date */}
                      <td className="whitespace-nowrap px-3 py-2.5 text-[11px] text-slate-700 dark:text-slate-200">
                        {formatDateGB(a.scheduledDate || a.date)}
                      </td>

                      {/* Check-In */}
                      <td className="whitespace-nowrap px-3 py-2.5 text-[11px] text-slate-700 dark:text-slate-200">
                        {a.checkedInAt
                          ? new Date(a.checkedInAt).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true })
                          : <span className="text-slate-400">â€”</span>}
                      </td>

                      {/* Check-Out */}
                      <td className="whitespace-nowrap px-3 py-2.5 text-[11px] text-slate-700 dark:text-slate-200">
                        {a.checkedOutAt
                          ? new Date(a.checkedOutAt).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true })
                          : <span className="text-slate-400">â€”</span>}
                      </td>

                      {/* Status */}
                      <td className="px-3 py-2.5 align-middle whitespace-nowrap">
                        <StatusPill label={disp.label} tone={disp.tone} />
                      </td>

                      {/* Type */}
                      <td className="px-3 py-2.5 align-middle whitespace-nowrap">
                        <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-300 whitespace-nowrap">
                          {r.visitorType}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-2 dark:border-[#142535]">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Showing {slice.length === 0 ? 0 : (safePage - 1) * perPage + 1}â€“{(safePage - 1) * perPage + slice.length} of {total} record{total === 1 ? '' : 's'}.
            </span>
          </div>
          <Pagination page={safePage} perPage={perPage} total={total}
            onPageChange={setPage} onPerPageChange={(n) => { setPerPage(n); setPage(1); }} />
        </div>

        {/* â”€â”€ Mobile / Tablet Cards (< lg) â”€â”€ */}
        <div className="lg:hidden space-y-3">
          {slice.length === 0 ? (
            <div className="rounded-[14px] border border-slate-200 bg-white shadow-sm dark:border-[#142535] dark:bg-[#0A1828]">
              <GuestLogEmptyState
                enriched={enrichedRows} hasFilters={hasFilters} search={search}
                dateRange={dateRange} customStart={customStart} customEnd={customEnd}
                status={statusFilter} onClearFilters={clearFilters}
                onClearSearch={() => setSearch('')} onClearStatus={() => setStatusF('all')}
                onChangeDateRange={() => setDateRange('all')}
                onGoToAppointments={() => setActivePage?.('appointments')}
              />
            </div>
          ) : (
            <>
              {slice.map((r, idx) => {
                const a        = r.apt;
                const disp     = displayStatus(a);
                const typeMeta = VISITOR_TYPE_META[r.visitorType] || VISITOR_TYPE_META.Regular;
                const sr       = (safePage - 1) * perPage + idx + 1;
                return (
                  <div key={r.id} onClick={() => setViewId(r.id)}
                    className="cursor-pointer rounded-[14px] border border-slate-200 bg-white shadow-sm transition hover:border-sky-300 hover:shadow-md dark:border-[#142535] dark:bg-[#0A1828] dark:hover:border-sky-600">

                    {/* Card header */}
                    <div className="flex items-start gap-3 p-4">
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-sky-200 bg-sky-50 text-[20px] leading-none dark:border-sky-400/30 dark:bg-sky-500/15">
                        {typeMeta.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-1.5">
                          <span className="text-[13px] font-bold text-[#0C2340] dark:text-slate-100">
                            {a.visitor?.fullName || a.guestName || 'â€”'}
                          </span>
                          {r.isWalkIn && (
                            <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-sky-700 dark:border-sky-400/30 dark:text-sky-300">Walk-in</span>
                          )}
                        </div>
                        <div className="mb-1.5 text-[11px] text-slate-400 truncate">
                          {a.visitor?.companyName || a.company || 'â€”'}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <StatusPill label={disp.label} tone={disp.tone} />
                          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-300">
                            {r.visitorType}
                          </span>
                        </div>
                      </div>
                      <span className="shrink-0 text-[11px] font-semibold text-slate-400 dark:text-slate-500">#{sr}</span>
                    </div>

                    {/* Card data grid */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-slate-100 px-4 py-3 dark:border-[#142535]">
                      <CardCell label="Appointment ID" value={<span className="font-mono text-[11px]">{a.id || 'â€”'}</span>} />
                      <CardCell label="Date" value={formatDateGB(a.scheduledDate || a.date)} />
                      <CardCell label="Host" value={
                        <div className="flex items-center gap-1">
                          <UserRound size={10} className="shrink-0 text-slate-400" />
                          <span className="truncate">{r.host?.fullName || r.host?.name || a.host || 'â€”'}</span>
                        </div>
                      } />
                      <CardCell label="Office" value={
                        <div className="flex items-center gap-1">
                          <Building2 size={10} className="shrink-0 text-slate-400" />
                          <span className="truncate">{r.office?.name || 'â€”'}</span>
                        </div>
                      } />
                      <CardCell label="Check-In" value={
                        a.checkedInAt
                          ? new Date(a.checkedInAt).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true })
                          : 'â€”'
                      } />
                      <CardCell label="Check-Out" value={
                        a.checkedOutAt
                          ? new Date(a.checkedOutAt).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true })
                          : 'â€”'
                      } />
                    </div>
                  </div>
                );
              })}

              {/* Mobile pagination */}
              <div className="rounded-[14px] border border-slate-200 bg-white p-3 shadow-sm dark:border-[#142535] dark:bg-[#0A1828]">
                <div className="mb-2 text-center text-[12px] text-slate-500 dark:text-slate-400">
                  Showing {(safePage - 1) * perPage + 1}â€“{(safePage - 1) * perPage + slice.length} of {total} records
                </div>
                <Pagination page={safePage} perPage={perPage} total={total}
                  onPageChange={setPage} onPerPageChange={(n) => { setPerPage(n); setPage(1); }} />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Detail Drawer */}
      {openRow && (
        <GuestDetailDrawer open row={openRow}
          onClose={() => setViewId(null)}
          onOpenFullDetail={() => {
            setViewId(null);
            setFullDetailRow(openRow);
          }} />
      )}

      {/* Export Dialog */}
      {showExport && (
        <ExportDialog open rows={sorted} org={orgForExport}
          filterSummary={filterSummary}
          generatedBy={user?.name || 'Unknown'}
          onClose={() => setShowExport(false)}
          onExported={({ format, rowCount, filename }) => {
            addAuditLog({
              userName:    user?.name || 'Unknown',
              role:        (user?.role || '').toString(),
              action:      'GUEST_LOG_EXPORTED',
              module:      'Guest Log',
              description: `Exported ${rowCount} record(s) as ${format} (${filename}). Filters: ${filterSummary}.`,
              orgId:       user?.organisationId || user?.orgId,
            });
            showToast(`${format} export ${format === 'PDF' ? 'opened in print dialog' : 'downloaded'} successfully.`);
          }} />
      )}

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
    )}
    </>
  );
}

/* â”€â”€ Helper components â”€â”€ */

function CardCell({ label, value }) {
  return (
    <div className="min-w-0">
      <div className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</div>
      <div className="truncate text-[12px] font-semibold text-slate-700 dark:text-slate-200">{value}</div>
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
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap ${cls}`}>
      <span aria-hidden="true">â—</span>{label}
    </span>
  );
}

function GuestLogEmptyState({
  enriched, hasFilters, search, dateRange, customStart, customEnd, status,
  onClearFilters, onClearSearch, onClearStatus, onChangeDateRange, onGoToAppointments,
}) {
  if (enriched.length === 0 && !hasFilters) {
    return (
      <EmptyState icon={ClipboardList}
        message="No guest records yet."
        description="Visitor check-ins will appear here after the first appointment or walk-in is completed."
        action={
          <button type="button" onClick={onGoToAppointments}
            className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-sky-700 bg-sky-700 px-4 py-2 text-[12px] font-bold text-white transition hover:bg-sky-800">
            â†’ Go to Appointments
          </button>
        } />
    );
  }
  if (search) {
    return (
      <EmptyState icon={ClipboardList}
        message={`No records found matching "${search}".`}
        description="Try a different name, company or contact number."
        action={
          <button type="button" onClick={onClearSearch}
            className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-slate-200 bg-white px-4 py-2 text-[12px] font-bold text-slate-700 transition hover:bg-slate-50 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-200">
            Clear search
          </button>
        } />
    );
  }
  if (dateRange !== 'all') {
    return (
      <EmptyState icon={Calendar}
        message="No records found for the selected date range."
        description="Try adjusting the date range filters."
        action={
          <button type="button" onClick={onChangeDateRange}
            className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-slate-200 bg-white px-4 py-2 text-[12px] font-bold text-slate-700 transition hover:bg-slate-50 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-200">
            Change date range
          </button>
        } />
    );
  }
  if (status !== 'all') {
    return (
      <EmptyState icon={ClipboardList}
        message={`No ${status} records found.`}
        description="Try a different status filter or clear the filter."
        action={
          <button type="button" onClick={onClearStatus}
            className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-slate-200 bg-white px-4 py-2 text-[12px] font-bold text-slate-700 transition hover:bg-slate-50 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-200">
            Clear status filter
          </button>
        } />
    );
  }
  return (
    <EmptyState icon={ClipboardList}
      message="No records found."
      description="Try removing a filter or clearing the search."
      action={
        <button type="button" onClick={onClearFilters}
          className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-sky-700 bg-sky-700 px-4 py-2 text-[12px] font-bold text-white transition hover:bg-sky-800">
          Clear all filters
        </button>
      } />
  );
}