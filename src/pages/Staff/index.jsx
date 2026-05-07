import React, { useEffect, useMemo, useState } from 'react';
import {
  UserRound, UserPlus, Search, X, Eye, Pencil, Trash2,
  ChevronRight, Building2, Mail, Phone,
  SlidersHorizontal, ChevronDown,
} from 'lucide-react';
import { useCollection, STORAGE_KEYS } from '../../store';
import { MOCK_STAFF, MOCK_OFFICES } from '../../data/mockData';
import { useAuth } from '../../context/AuthContext';
import { useRole } from '../../context/RoleContext';
import NoAccess from '../../components/NoAccess';
import { Pagination, SearchableSelect, EmptyState, Toast } from '../../components/ui';
import AddStaffDrawer, {
  byOrg, ALL_STAFF_ROLES, ACCESS_STATUSES, STAFF_STATUSES,
} from './AddStaffDrawer';
import EditStaffDrawer from './EditStaffDrawer';
import DeleteStaffModal from './DeleteStaffModal';
import StaffDetailPage from './StaffDetailPage';

export default function Staff({ setActivePage }) {
  const { user }          = useAuth();
  const { hasPermission } = useRole();

  if (!hasPermission('staff', 'view')) {
    return (
      <NoAccess
        module="Staff"
        onGoBack={setActivePage ? () => setActivePage('dashboard') : undefined}
      />
    );
  }

  return <StaffBody user={user} hasPermission={hasPermission} setActivePage={setActivePage} />;
}

function StaffBody({ user, hasPermission, setActivePage }) {
  const [staffRaw]   = useCollection(STORAGE_KEYS.STAFF,   MOCK_STAFF);
  const [officesRaw] = useCollection(STORAGE_KEYS.OFFICES, MOCK_OFFICES);

  const staff   = Array.isArray(staffRaw)   ? staffRaw   : [];
  const offices = Array.isArray(officesRaw) ? officesRaw : [];

  const [search, setSearch]           = useState('');
  const [roleFilter, setRoleFilter]   = useState('all');
  const [officeFilter, setOfficeF]    = useState('all');
  const [accessFilter, setAccessF]    = useState('all');
  const [statusFilter, setStatusF]    = useState('all');
  const [page, setPage]               = useState(1);
  const [perPage, setPerPage]         = useState(10);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [viewId, setViewId]       = useState(null);
  const [editRow, setEditRow]     = useState(null);
  const [deleteRow, setDeleteRow] = useState(null);
  const [showAdd, setShowAdd]     = useState(false);
  const [toast, setToast]         = useState(null);

  const showToast = (msg, type = 'success') => setToast({ msg, type });

  const canCreate   = hasPermission('staff', 'create');
  const canEdit     = hasPermission('staff', 'edit');
  const canDelete   = hasPermission('staff', 'delete');
  const showActions = canEdit || canDelete;

  const scoped        = useMemo(() => byOrg(staff,   user), [staff,   user]);
  const scopedOffices = useMemo(() => byOrg(offices, user), [offices, user]);

  const officeById = useMemo(() => {
    const m = new Map();
    for (const o of scopedOffices) if (o?.id != null) m.set(String(o.id), o);
    return m;
  }, [scopedOffices]);

  useEffect(() => { setPage(1); }, [search, roleFilter, officeFilter, accessFilter, statusFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scoped.filter((s) => {
      if (!s) return false;
      if (roleFilter   !== 'all' && s.role         !== roleFilter)   return false;
      if (accessFilter !== 'all' && s.accessStatus !== accessFilter) return false;
      if (statusFilter !== 'all' && s.status       !== statusFilter) return false;
      if (officeFilter !== 'all' && String(s.officeId || '') !== String(officeFilter)) return false;
      if (q) {
        const hay = [
          s.fullName, s.name, s.emailId, s.employeeId, s.designation,
          s.contactNumber, s.role, s.accessStatus, s.status,
          officeById.get(String(s.officeId || ''))?.name,
          officeById.get(String(s.officeId || ''))?.code,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [scoped, search, roleFilter, officeFilter, accessFilter, statusFilter, officeById]);

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => (a?.fullName || a?.name || '').localeCompare(b?.fullName || b?.name || '')),
    [filtered],
  );

  const total      = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage   = Math.max(1, Math.min(page, totalPages));
  const slice      = sorted.slice((safePage - 1) * perPage, safePage * perPage);

  const hasFilters = Boolean(search) || roleFilter !== 'all' || officeFilter !== 'all' || accessFilter !== 'all' || statusFilter !== 'all';
  const clearFilters = () => {
    setSearch(''); setRoleFilter('all'); setOfficeF('all'); setAccessF('all'); setStatusF('all'); setPage(1);
  };

  const activeFilterCount = [
    search, roleFilter !== 'all', officeFilter !== 'all', accessFilter !== 'all', statusFilter !== 'all',
  ].filter(Boolean).length;

  const openRecord = useMemo(
    () => (viewId ? scoped.find((s) => s.id === viewId) || null : null),
    [viewId, scoped],
  );

  /* ── Detail page ── */
  if (openRecord) {
    return (
      <div className="min-h-screen w-full bg-slate-50 px-3 py-5 sm:px-4 sm:py-6 lg:px-6 dark:bg-[#050E1A]">
        <StaffDetailPage
          staffRow={openRecord}
          onBack={() => setViewId(null)}
          onEdit={() => setEditRow(openRecord)}
          canEdit
          currentUser={user}
        />
        {editRow && (
          <EditStaffDrawer open staffRow={editRow} currentUser={user}
            onClose={() => setEditRow(null)}
            onUpdated={(updated) => {
              setEditRow(null);
              showToast(`${updated.fullName || updated.name || 'Staff'} updated successfully.`);
            }} />
        )}
        {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    );
  }

  /* ── Stats ── */
  const stats = [
    { label: 'Total Staff',  value: scoped.length,                                              color: 'text-sky-600 dark:text-sky-400',      bg: 'bg-sky-50 dark:bg-sky-500/10' },
    { label: 'Active',       value: scoped.filter((s) => s.status === 'Active').length,         color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
    { label: 'Invited',      value: scoped.filter((s) => s.accessStatus === 'Invited').length,  color: 'text-amber-600 dark:text-amber-400',   bg: 'bg-amber-50 dark:bg-amber-500/10' },
    { label: 'Offices',      value: scopedOffices.length,                                       color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-500/10' },
  ];

  return (
    <div className="w-full min-h-screen bg-slate-50 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 dark:bg-[#050E1A]">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4">

        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          <button type="button" onClick={() => setActivePage?.('dashboard')}
            className="cursor-pointer rounded-[6px] px-1.5 py-0.5 transition hover:bg-slate-100 hover:text-sky-700 dark:hover:bg-[#1E1E3F] dark:hover:text-sky-300">
            Dashboard
          </button>
          <ChevronRight size={12} aria-hidden="true" className="text-slate-300" />
          <span className="rounded-[6px] px-1.5 py-0.5 text-[#0C2340] dark:text-slate-200">Team &amp; Staff</span>
        </nav>

        {/* Header */}
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-[Outfit,sans-serif] text-[22px] font-extrabold leading-tight text-[#0C2340] dark:text-slate-100">
              Team &amp; Staff
            </h1>
            <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">
              Invite, manage and maintain the people who run your organisation&rsquo;s offices.
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
            {canCreate && (
              <button type="button" onClick={() => setShowAdd(true)}
                disabled={scopedOffices.length === 0}
                title="Invite a new staff member"
                className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-sky-700 bg-gradient-to-r from-sky-600 to-sky-800 px-4 py-2.5 text-[13px] font-bold text-white shadow-sm transition hover:from-sky-700 hover:to-sky-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40 disabled:cursor-not-allowed disabled:opacity-40">
                <UserPlus size={14} aria-hidden="true" /> Invite Staff
              </button>
            )}
          </div>
        </header>

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm dark:border-[#142535] dark:bg-[#0A1828]">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{s.label}</div>
              <div className={`font-[Outfit,sans-serif] text-2xl font-black ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Filter bar */}
        <div className={`${filtersOpen ? 'block' : 'hidden'} lg:block rounded-[14px] border border-slate-200 bg-white p-3 shadow-sm dark:border-[#142535] dark:bg-[#0A1828]`}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
            {/* Search */}
            <div className="relative lg:col-span-2">
              <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search name, email, ID, designation…"
                aria-label="Search staff"
                className="w-full rounded-[10px] border border-slate-200 bg-white py-2 pl-9 pr-9 text-[13px] text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-200" />
              {search && (
                <button type="button" onClick={() => { setSearch(''); setPage(1); }} aria-label="Clear search"
                  className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-[#1E1E3F]">
                  <X size={13} aria-hidden="true" />
                </button>
              )}
            </div>
            <SearchableSelect value={roleFilter} onChange={(v) => { setRoleFilter(v); setPage(1); }}
              options={[{ value: 'all', label: 'All Roles' }, ...ALL_STAFF_ROLES.map((r) => ({ value: r, label: r }))]}
              placeholder="Role" />
            <SearchableSelect value={officeFilter} onChange={(v) => { setOfficeF(v); setPage(1); }}
              options={[{ value: 'all', label: 'All Offices' }, ...scopedOffices.map((o) => ({ value: String(o.id), label: `${o.name} (${o.code})` }))]}
              placeholder="Office" searchPlaceholder="Search office…" />
            <SearchableSelect value={accessFilter} onChange={(v) => { setAccessF(v); setPage(1); }}
              options={[{ value: 'all', label: 'All Access' }, ...ACCESS_STATUSES.map((s) => ({ value: s, label: s }))]}
              placeholder="Access" />
          </div>

          {/* Second row — status filter + summary */}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <SearchableSelect value={statusFilter} onChange={(v) => { setStatusF(v); setPage(1); }}
              options={[{ value: 'all', label: 'All Statuses' }, ...STAFF_STATUSES.map((s) => ({ value: s, label: s }))]}
              placeholder="Status" />
            {hasFilters && (
              <>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Showing {total} of {scoped.length} staff.
                </span>
                <button type="button" onClick={clearFilters}
                  className="cursor-pointer rounded-[8px] border border-slate-200 bg-white px-3 py-1 text-[11px] font-bold text-slate-600 transition hover:bg-slate-50 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-300">
                  Clear filters
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── Desktop Table (lg+) ── */}
        <div className="hidden lg:block w-full overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-sm dark:border-[#142535] dark:bg-[#0A1828]">
          <table className="w-full border-collapse text-left text-[12px]" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '44px' }} />   {/* # */}
              <col style={{ width: '22%' }} />    {/* Name */}
              <col style={{ width: '90px' }} />   {/* Emp ID */}
              <col style={{ width: '90px' }} />   {/* Joining */}
              <col style={{ width: '13%' }} />    {/* Role */}
              <col style={{ width: '14%' }} />    {/* Designation */}
              <col style={{ width: '15%' }} />    {/* Office */}
              <col style={{ width: '90px' }} />   {/* Access */}
              <col style={{ width: '80px' }} />   {/* Status */}
              {showActions && <col style={{ width: '90px' }} />}
            </colgroup>
            <thead className="bg-slate-50 dark:bg-[#071220]">
              <tr>
                {['#', 'Name / Email ID', 'Emp. ID', 'Joining', 'Role', 'Designation', 'Office', 'Access', 'Status',
                  ...(showActions ? ['Actions'] : [])].map((h) => (
                  <th key={h} className="border-b border-slate-100 px-2 py-2.5 text-[10px] font-bold uppercase tracking-[0.05em] text-slate-500 dark:border-[#142535] dark:text-slate-400">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#142535]">
              {slice.length === 0 && (
                <tr>
                  <td colSpan={showActions ? 10 : 9} className="px-3 py-0">
                    <EmptyState icon={UserRound}
                      message={scoped.length === 0 ? 'No staff added yet.' : 'No staff match the current filters.'}
                      description={scoped.length === 0
                        ? 'Invite your first team member to start managing visitor operations.'
                        : 'Try removing a filter or clearing the search.'}
                      action={scoped.length === 0 && canCreate && scopedOffices.length > 0 ? (
                        <button type="button" onClick={() => setShowAdd(true)}
                          className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-sky-700 bg-sky-700 px-4 py-2 text-[12px] font-bold text-white transition hover:bg-sky-800">
                          <UserPlus size={13} aria-hidden="true" /> Invite Staff
                        </button>
                      ) : null} />
                  </td>
                </tr>
              )}
              {slice.map((s, idx) => {
                const sr      = (safePage - 1) * perPage + idx + 1;
                const office  = officeById.get(String(s.officeId || ''));
                const display = s.fullName || s.name || '—';
                const isNew   = s.createdAt && (Date.now() - new Date(s.createdAt).getTime()) < 48 * 3600 * 1000;
                return (
                  <tr key={s.id} onClick={() => setViewId(s.id)}
                    className="cursor-pointer transition hover:bg-slate-50 dark:hover:bg-[#1E1E3F]">

                    {/* # */}
                    <td className="px-2 py-2.5 align-middle text-[11px] font-semibold text-slate-400">{sr}</td>

                    {/* Name + Email */}
                    <td className="px-2 py-2.5 align-middle min-w-0">
                      <div className="flex items-start gap-1.5 min-w-0">
                        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] border border-sky-200 bg-sky-50 font-[Outfit,sans-serif] text-[10px] font-extrabold text-sky-700 dark:border-sky-400/30 dark:bg-sky-500/15 dark:text-sky-300">
                          {initials(display)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1 min-w-0">
                            <span className="truncate text-[12px] font-bold text-[#0C2340] dark:text-slate-100 max-w-full">
                              {display}
                            </span>
                            {isNew && (
                              <span className="shrink-0 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">New</span>
                            )}
                          </div>
                          <div className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-400">
                            <Mail size={9} className="shrink-0" />
                            <span className="truncate font-mono">{s.emailId || '—'}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Emp ID */}
                    <td className="px-2 py-2.5 align-middle">
                      <span className="font-mono text-[11px] font-semibold text-slate-700 dark:text-slate-200">{s.employeeId || '—'}</span>
                      {s.contactNumber && (
                        <div className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-400">
                          <Phone size={9} className="shrink-0" />
                          <span className="truncate">{s.contactNumber}</span>
                        </div>
                      )}
                    </td>

                    {/* Joining */}
                    <td className="px-2 py-2.5 align-middle whitespace-nowrap text-[11px] text-slate-600 dark:text-slate-300">
                      {s.joiningDate
                        ? new Date(`${s.joiningDate}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                        : '—'}
                    </td>

                    {/* Role */}
                    <td className="px-2 py-2.5 align-middle"><RolePill role={s.role} /></td>

                    {/* Designation */}
                    <td className="px-2 py-2.5 align-middle">
                      <span className="line-clamp-2 break-words text-[11px] text-slate-600 dark:text-slate-300">{s.designation || '—'}</span>
                      {s.gender && <span className="mt-0.5 block text-[10px] text-slate-400 capitalize">{s.gender}</span>}
                    </td>

                    {/* Office */}
                    <td className="px-2 py-2.5 align-middle min-w-0">
                      <div className="flex items-start gap-1 min-w-0">
                        <Building2 size={11} aria-hidden="true" className="mt-0.5 shrink-0 text-slate-400" />
                        <div className="min-w-0">
                          <div className="truncate text-[11px] font-semibold text-slate-700 dark:text-slate-200">{office?.name || '—'}</div>
                          {office?.code && <div className="font-mono text-[10px] text-slate-400">{office.code}</div>}
                        </div>
                      </div>
                    </td>

                    {/* Access */}
                    <td className="px-2 py-2.5 align-middle"><AccessPill status={s.accessStatus} /></td>

                    {/* Status */}
                    <td className="px-2 py-2.5 align-middle"><StatusPill status={s.status} /></td>

                    {/* Actions */}
                    {showActions && (
                      <td className="px-2 py-2.5 align-middle" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <IconBtn Icon={Eye}    tone="slate"  title={`View ${display}`}   onClick={() => setViewId(s.id)} />
                          {canEdit   && <IconBtn Icon={Pencil} tone="violet" title={`Edit ${display}`}   onClick={() => setEditRow(s)} />}
                          {canDelete && <IconBtn Icon={Trash2} tone="red"    title={`Delete ${display}`} onClick={() => setDeleteRow(s)} />}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-2 dark:border-[#142535]">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Showing {slice.length === 0 ? 0 : (safePage - 1) * perPage + 1}–{(safePage - 1) * perPage + slice.length} of {total} staff.
            </span>
          </div>
          <Pagination page={safePage} perPage={perPage} total={total}
            onPageChange={setPage} onPerPageChange={(n) => { setPerPage(n); setPage(1); }} />
        </div>

        {/* ── Mobile / Tablet Cards (< lg) ── */}
        <div className="lg:hidden space-y-3">
          {slice.length === 0 ? (
            <div className="rounded-[14px] border border-slate-200 bg-white shadow-sm dark:border-[#142535] dark:bg-[#0A1828]">
              <EmptyState icon={UserRound}
                message={scoped.length === 0 ? 'No staff added yet.' : 'No staff match the filters.'}
                description={scoped.length === 0
                  ? 'Invite your first team member to start managing visitor operations.'
                  : 'Try removing a filter or clearing the search.'} />
            </div>
          ) : (
            <>
              {slice.map((s, idx) => {
                const office  = officeById.get(String(s.officeId || ''));
                const display = s.fullName || s.name || '—';
                const sr      = (safePage - 1) * perPage + idx + 1;
                const isNew   = s.createdAt && Date.now() - new Date(s.createdAt).getTime() < 48 * 3600 * 1000;
                return (
                  <div key={s.id} onClick={() => setViewId(s.id)}
                    className="cursor-pointer rounded-[14px] border border-slate-200 bg-white shadow-sm transition hover:border-sky-300 hover:shadow-md dark:border-[#142535] dark:bg-[#0A1828] dark:hover:border-sky-600">

                    {/* Card top */}
                    <div className="flex items-start gap-3 p-4">
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-sky-200 bg-sky-50 font-[Outfit,sans-serif] text-[12px] font-extrabold text-sky-700 dark:border-sky-400/30 dark:bg-sky-500/15 dark:text-sky-300">
                        {initials(display)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-1.5">
                          <span className="text-[13px] font-bold text-[#0C2340] dark:text-slate-100">{display}</span>
                          {isNew && (
                            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">New</span>
                          )}
                        </div>
                        <div className="mb-2 flex items-center gap-1 text-[11px] text-slate-400">
                          <Mail size={10} className="shrink-0" />
                          <span className="truncate font-mono">{s.emailId || '—'}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <RolePill role={s.role} />
                          <AccessPill status={s.accessStatus} />
                          <StatusPill status={s.status} />
                        </div>
                      </div>
                      <span className="shrink-0 text-[11px] font-semibold text-slate-400 dark:text-slate-500">#{sr}</span>
                    </div>

                    {/* Card data grid */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-slate-100 px-4 py-3 dark:border-[#142535]">
                      <CardCell label="Employee ID" value={<span className="font-mono">{s.employeeId || '—'}</span>} />
                      <CardCell label="Designation" value={s.designation || '—'} />
                      <CardCell label="Office" value={
                        <div className="flex items-center gap-1">
                          <Building2 size={10} className="shrink-0 text-slate-400" />
                          <span className="truncate">{office?.name || '—'}</span>
                        </div>
                      } />
                      <CardCell label="Joining Date" value={
                        s.joiningDate
                          ? new Date(`${s.joiningDate}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                          : '—'
                      } />
                      {s.contactNumber && (
                        <CardCell label="Contact" value={
                          <div className="flex items-center gap-1">
                            <Phone size={10} className="shrink-0 text-slate-400" />
                            <span>{s.contactNumber}</span>
                          </div>
                        } />
                      )}
                      {s.gender && <CardCell label="Gender" value={s.gender} />}
                    </div>

                    {/* Card actions */}
                    <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-4 py-2.5 dark:border-[#142535]"
                      onClick={(e) => e.stopPropagation()}>
                      <ActionBtn icon={<Eye size={12} />} label="View"   tone="slate"  onClick={() => setViewId(s.id)} />
                      {canEdit   && <ActionBtn icon={<Pencil size={12} />} label="Edit"   tone="violet" onClick={() => setEditRow(s)} />}
                      {canDelete && <ActionBtn icon={<Trash2 size={12} />} label="Delete" tone="red"    onClick={() => setDeleteRow(s)} />}
                    </div>
                  </div>
                );
              })}

              {/* Mobile pagination */}
              <div className="rounded-[14px] border border-slate-200 bg-white p-3 shadow-sm dark:border-[#142535] dark:bg-[#0A1828]">
                <div className="mb-2 text-center text-[12px] text-slate-500 dark:text-slate-400">
                  Showing {(safePage - 1) * perPage + 1}–{(safePage - 1) * perPage + slice.length} of {total} staff
                </div>
                <Pagination page={safePage} perPage={perPage} total={total}
                  onPageChange={setPage} onPerPageChange={(n) => { setPerPage(n); setPage(1); }} />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Drawers & Modals */}
      {showAdd && (
        <AddStaffDrawer open currentUser={user}
          onClose={() => setShowAdd(false)}
          onCreated={(created) => {
            setShowAdd(false);
            showToast(`${created.fullName || created.name || 'Staff'} invited successfully.`);
          }} />
      )}
      {editRow && !viewId && (
        <EditStaffDrawer open staffRow={editRow} currentUser={user}
          onClose={() => setEditRow(null)}
          onUpdated={(updated) => {
            setEditRow(null);
            showToast(`${updated.fullName || updated.name || 'Staff'} updated successfully.`);
          }} />
      )}
      {deleteRow && (
        <DeleteStaffModal open staffRow={deleteRow} currentUser={user}
          onClose={() => setDeleteRow(null)}
          onDeleted={(removed) => {
            setDeleteRow(null);
            showToast(`${removed.fullName || removed.name || 'Staff'} deleted successfully.`);
          }} />
      )}
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────── */

function initials(name) {
  if (!name) return '?';
  return String(name).trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?';
}

function CardCell({ label, value }) {
  return (
    <div className="min-w-0">
      <div className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</div>
      <div className="truncate text-[12px] font-semibold text-slate-700 dark:text-slate-200">{value}</div>
    </div>
  );
}

function ActionBtn({ icon, label, tone, onClick }) {
  const cls = {
    slate:  'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-300 dark:hover:bg-[#1E1E3F]',
    violet: 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 dark:border-sky-400/30 dark:bg-sky-500/15 dark:text-sky-300 dark:hover:bg-sky-500/25',
    red:    'border-red-200 bg-red-50 text-red-600 hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20',
  }[tone];
  return (
    <button type="button" onClick={onClick}
      className={`flex items-center gap-1.5 rounded-[8px] border px-3 py-1.5 text-[11px] font-bold transition ${cls}`}>
      {icon}{label}
    </button>
  );
}

function IconBtn({ Icon, title, tone = 'slate', onClick }) {
  const cls = {
    slate:  'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-300 dark:hover:bg-[#1E1E3F]',
    violet: 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 dark:border-sky-400/30 dark:bg-sky-500/15 dark:text-sky-300 dark:hover:bg-sky-500/25',
    red:    'border-red-200 bg-red-50 text-red-600 hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20',
  }[tone];
  return (
    <button type="button" onClick={onClick} title={title} aria-label={title}
      className={`inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-[7px] border shadow-sm transition ${cls}`}>
      <Icon size={12} aria-hidden="true" />
    </button>
  );
}

function RolePill({ role }) {
  const cls = {
    Director:        'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/30 dark:bg-sky-500/15 dark:text-sky-300',
    Manager:         'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-300',
    Reception:       'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-500/30 dark:bg-cyan-500/15 dark:text-cyan-300',
    'Service Staff': 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300',
  }[role] || 'border-slate-200 bg-slate-100 text-slate-600 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-400';
  return (
    <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap ${cls}`}>
      {role || '—'}
    </span>
  );
}

function AccessPill({ status }) {
  const s = status || 'Pending';
  const cls = {
    Invited:  'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300',
    Pending:  'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
    Active:   'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300',
    Inactive: 'border-slate-200 bg-slate-100 text-slate-500 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-400',
  }[s] || 'border-slate-200 bg-slate-100 text-slate-500';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap ${cls}`}>
      <span aria-hidden="true">●</span>{s}
    </span>
  );
}

function StatusPill({ status }) {
  const s = status || 'Inactive';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap ${
      s === 'Active'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
        : 'border-slate-200 bg-slate-100 text-slate-500 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-400'
    }`}>
      <span aria-hidden="true">●</span>{s}
    </span>
  );
}