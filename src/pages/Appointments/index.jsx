import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Calendar, Plus, Search, X, Eye, Pencil, Trash2, ChevronRight,
  LayoutGrid, List, UserRound,
} from 'lucide-react';
import { useCollection, STORAGE_KEYS } from '../../store';
import { MOCK_APPOINTMENTS } from '../../data/mockAppointments';
import { MOCK_OFFICES, MOCK_STAFF } from '../../data/mockData';
import { useAuth } from '../../context/AuthContext';
import { useRole } from '../../context/RoleContext';
import NoAccess from '../../components/NoAccess';
import { Pagination, SearchableSelect, EmptyState, Toast, MobileCardList, MobileCard } from '../../components/ui';
import {
  byOrg, displayStatus, VISITOR_TYPES,
  formatAppointmentTime, formatDateGB,
} from '../../utils/appointmentState';
import AddAppointmentDrawer, { VISITOR_TYPE_META } from './AddAppointmentDrawer';
import EditAppointmentDrawer from './EditAppointmentDrawer';
import CancelAppointmentModal from './CancelAppointmentModal';
import AppointmentDetailPage from './AppointmentDetailPage';
import AppointmentsCalendarView from './AppointmentsCalendarView';

/**
 * Appointments — list + calendar toggle. Tenant-scoped via byOrg.
 *
 * RBAC:
 *   SuperAdmin — full read across tenants; action buttons hidden (read-only on tenant ops).
 *   Director   — full CRUD, approval authority.
 *   Manager    — full CRUD.
 *   Reception  — view + create + edit; no delete.
 *   Service    — NoAccess (tasks via Services module).
 */

const DATE_RANGES = [
  { value: 'all',     label: 'All Dates' },
  { value: 'today',   label: 'Today' },
  { value: 'week',    label: 'This Week' },
  { value: 'month',   label: 'This Month' },
];

const STATUS_FILTER_VALUES = [
  'Pending', 'Approved', 'Checked-In', 'In-Progress', 'Completed',
  'Cancelled', 'No-Show',
];

function todayIso() { return new Date().toISOString().slice(0, 10); }
function startOfWeekIso() {
  const d = new Date();
  const js = d.getDay();
  const monOffset = js === 0 ? -6 : 1 - js;
  d.setDate(d.getDate() + monOffset);
  return d.toISOString().slice(0, 10);
}
function endOfWeekIso() {
  const d = new Date();
  const js = d.getDay();
  const sunOffset = js === 0 ? 0 : 7 - js;
  d.setDate(d.getDate() + sunOffset);
  return d.toISOString().slice(0, 10);
}
function startOfMonthIso() {
  const d = new Date(); d.setDate(1);
  return d.toISOString().slice(0, 10);
}
function endOfMonthIso() {
  const d = new Date();
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return end.toISOString().slice(0, 10);
}

export default function Appointments({ setActivePage }) {
  const { user } = useAuth();
  const { hasPermission } = useRole();

  if (!hasPermission('appointments', 'view')) {
    return (
      <NoAccess module="Appointments"
        onGoBack={setActivePage ? () => setActivePage('dashboard') : undefined} />
    );
  }

  return <AppointmentsBody user={user} hasPermission={hasPermission} setActivePage={setActivePage} />;
}

function AppointmentsBody({ user, hasPermission, setActivePage }) {
  const [appointments] = useCollection(STORAGE_KEYS.APPOINTMENTS, MOCK_APPOINTMENTS);
  const [offices]      = useCollection(STORAGE_KEYS.OFFICES,      MOCK_OFFICES);
  const [staffAll]     = useCollection(STORAGE_KEYS.STAFF,        MOCK_STAFF);

  const opRoleLower = String(user?.role || '').toLowerCase();
  const isSuperRead = opRoleLower === 'superadmin';
  const canCreate   = hasPermission('appointments', 'create') && !isSuperRead;
  const canEdit     = hasPermission('appointments', 'edit')   && !isSuperRead;
  const canDelete   = hasPermission('appointments', 'delete') && !isSuperRead;
  const showActions = canEdit || canDelete;

  const [view, setView]                 = useState('list');
  const [search, setSearch]             = useState('');
  const [dateRange, setDateRange]       = useState('all');
  const [specificDate, setSpecificDate] = useState('');
  const [statusFilter, setStatusF]      = useState('all');
  const [officeFilter, setOfficeF]      = useState('all');
  const [hostFilter, setHostF]          = useState('all');
  const [typeFilter, setTypeF]          = useState('all');
  const [page, setPage]                 = useState(1);
  const [perPage, setPerPage]           = useState(10);

  const [viewId, setViewId]             = useState(null);

  /* Module 6 deep-link — accept ?viewId=APT-XXXXX and auto-open the
     row's detail view on mount. Non-breaking if the query param is
     absent. Clear the param after opening so filter changes don't
     re-open on every render. */
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const preOpen = searchParams.get('viewId');
    if (!preOpen) return;
    setViewId(preOpen);
    const next = new URLSearchParams(searchParams);
    next.delete('viewId');
    setSearchParams(next, { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [editRow, setEditRow]           = useState(null);
  const [cancelRow, setCancelRow]       = useState(null);
  const [showAdd, setShowAdd]           = useState(false);
  const [prefillDate, setPrefillDate]   = useState('');
  const [toast, setToast]               = useState(null);

  const showToast = (msg, type = 'success') => setToast({ msg, type });

  const scoped        = useMemo(() => byOrg(appointments, user), [appointments, user]);
  const scopedOffices = useMemo(() => byOrg(offices,      user), [offices,      user]);
  const scopedStaff   = useMemo(() => byOrg(staffAll,     user), [staffAll,     user]);

  const officeById = useMemo(() => {
    const m = new Map();
    for (const o of scopedOffices) m.set(o.id, o);
    return m;
  }, [scopedOffices]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const t = todayIso();
    const weekS = startOfWeekIso(), weekE = endOfWeekIso();
    const monS  = startOfMonthIso(), monE  = endOfMonthIso();

    return scoped.filter((a) => {
      const d = (a.scheduledDate || a.date || '').slice(0, 10);
      if (specificDate && d !== specificDate) return false;
      if (!specificDate) {
        if (dateRange === 'today' && d !== t) return false;
        if (dateRange === 'week'  && !(d >= weekS && d <= weekE)) return false;
        if (dateRange === 'month' && !(d >= monS  && d <= monE))  return false;
      }
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      if (officeFilter !== 'all' && a.officeId !== officeFilter) return false;
      if (hostFilter   !== 'all' && a.hostUserId !== hostFilter) return false;
      if (typeFilter   !== 'all' && a.visitor?.visitorType !== typeFilter) return false;
      if (q) {
        const hay = [
          a.id, a.visitor?.fullName, a.visitor?.emailId,
          a.visitor?.companyName, a.visitor?.contactNumber,
          a.purpose, a.host, a.visitor?.visitorType,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [scoped, search, dateRange, specificDate, statusFilter, officeFilter, hostFilter, typeFilter]);

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => {
      const da = `${a.scheduledDate || a.date || ''}T${a.startTime || a.time || ''}`;
      const db = `${b.scheduledDate || b.date || ''}T${b.startTime || b.time || ''}`;
      return da.localeCompare(db);
    }),
    [filtered],
  );

  const total      = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage   = Math.min(page, totalPages);
  const slice      = sorted.slice((safePage - 1) * perPage, safePage * perPage);

  const hasFilters = Boolean(search) || dateRange !== 'all' || statusFilter !== 'all'
    || officeFilter !== 'all' || hostFilter !== 'all' || typeFilter !== 'all' || Boolean(specificDate);

  const clearFilters = () => {
    setSearch(''); setDateRange('all'); setSpecificDate(''); setStatusF('all');
    setOfficeF('all'); setHostF('all'); setTypeF('all'); setPage(1);
  };

  const openRecord = useMemo(
    () => (viewId ? scoped.find((a) => a.id === viewId) || null : null),
    [viewId, scoped],
  );

  if (openRecord) {
    return (
      <div className="w-full min-h-screen bg-slate-50 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 dark:bg-[#050E1A]">
        <AppointmentDetailPage
          appointmentRow={openRecord}
          onBack={() => setViewId(null)}
          onEdit={canEdit ? () => setEditRow(openRecord) : undefined}
          canEdit={canEdit}
          currentUser={user}
        />
        {editRow && (
          <EditAppointmentDrawer open appointmentRow={editRow} currentUser={user}
            onClose={() => setEditRow(null)}
            onUpdated={(updated) => { setEditRow(null); showToast(`Appointment ${updated.id} updated successfully.`); }} />
        )}
        {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-slate-50 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 dark:bg-[#050E1A]">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4">

        <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          <button type="button" onClick={() => setActivePage?.('dashboard')}
            className="cursor-pointer rounded-[6px] px-1.5 py-0.5 transition hover:bg-slate-100 hover:text-sky-700 dark:hover:bg-[#1E1E3F] dark:hover:text-sky-300">
            Dashboard
          </button>
          <ChevronRight size={12} aria-hidden="true" className="text-slate-300" />
          <span className="rounded-[6px] px-1.5 py-0.5 text-[#0C2340] dark:text-slate-200">Appointments</span>
        </nav>

        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-[Outfit,sans-serif] text-[22px] font-extrabold leading-tight text-[#0C2340] dark:text-slate-100">
              Appointments
            </h1>
            <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">
              Schedule visitor meetings, approve requests and track check-ins across your organisation.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div role="tablist" aria-label="View mode" className="inline-flex rounded-[10px] border border-slate-200 bg-white p-0.5 dark:border-[#142535] dark:bg-[#0A1828]">
              <button type="button" role="tab" aria-selected={view === 'list'}
                onClick={() => setView('list')} title="List view"
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-[12px] font-semibold transition ${view === 'list'
                  ? 'bg-sky-700 text-white'
                  : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-[#1E1E3F]'}`}>
                <List size={13} aria-hidden="true" /> List
              </button>
              <button type="button" role="tab" aria-selected={view === 'calendar'}
                onClick={() => setView('calendar')} title="Calendar view"
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-[12px] font-semibold transition ${view === 'calendar'
                  ? 'bg-sky-700 text-white'
                  : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-[#1E1E3F]'}`}>
                <LayoutGrid size={13} aria-hidden="true" /> Calendar
              </button>
            </div>
            {canCreate && (
              <button type="button" onClick={() => { setPrefillDate(''); setShowAdd(true); }}
                title="Create new appointment" disabled={scopedOffices.length === 0}
                className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-sky-700 bg-gradient-to-r from-sky-600 to-sky-800 px-4 py-2.5 text-[13px] font-bold text-white shadow-sm hover:from-sky-700 hover:to-sky-900 disabled:opacity-40">
                <Plus size={14} aria-hidden="true" /> New Appointment
              </button>
            )}
          </div>
        </header>

        <div className="rounded-[14px] border border-slate-200 bg-white p-3 shadow-sm dark:border-[#142535] dark:bg-[#0A1828]">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-6">
            <div className="relative lg:col-span-2">
              <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search by visitor, company, purpose or ID"
                aria-label="Search appointments"
                className="w-full rounded-[10px] border border-slate-200 bg-white py-2 pl-9 pr-9 text-[13px] text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-200" />
              {search && (
                <button type="button" onClick={() => { setSearch(''); setPage(1); }}
                  aria-label="Clear search" title="Clear search"
                  className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-[#1E1E3F]">
                  <X size={13} aria-hidden="true" />
                </button>
              )}
            </div>
            <SearchableSelect value={specificDate ? 'specific' : dateRange}
              onChange={(v) => { if (v === 'specific') return; setDateRange(v); setSpecificDate(''); setPage(1); }}
              options={[...DATE_RANGES, ...(specificDate ? [{ value: 'specific', label: `Date: ${formatDateGB(specificDate)}` }] : [])]}
              placeholder="Date Range" />
            <SearchableSelect value={statusFilter}
              onChange={(v) => { setStatusF(v); setPage(1); }}
              options={[{ value: 'all', label: 'All Statuses' }, ...STATUS_FILTER_VALUES.map((s) => ({ value: s, label: s }))]}
              placeholder="Status" />
            <SearchableSelect value={officeFilter}
              onChange={(v) => { setOfficeF(v); setPage(1); }}
              options={[{ value: 'all', label: 'All Offices' }, ...scopedOffices.map((o) => ({ value: o.id, label: `${o.name} (${o.code})` }))]}
              placeholder="Office" searchPlaceholder="Search office…" />
            <SearchableSelect value={hostFilter}
              onChange={(v) => { setHostF(v); setPage(1); }}
              options={[{ value: 'all', label: 'All Hosts' }, ...scopedStaff
                .filter((s) => s.status !== 'Inactive')
                .sort((a, b) => (a.fullName || a.name || '').localeCompare(b.fullName || b.name || ''))
                .map((s) => ({ value: s.id, label: `${s.fullName || s.name}` }))]}
              placeholder="Host" searchPlaceholder="Search host…" />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Type:</span>
              <button type="button" onClick={() => { setTypeF('all'); setPage(1); }}
                className={`cursor-pointer rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${typeFilter === 'all'
                  ? 'border-sky-700 bg-sky-700 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-300'}`}>
                All
              </button>
              {VISITOR_TYPES.map((t) => {
                const active = typeFilter === t;
                const meta = VISITOR_TYPE_META[t];
                return (
                  <button key={t} type="button" onClick={() => { setTypeF(t); setPage(1); }}
                    className={`cursor-pointer rounded-full border px-2.5 py-0.5 text-[11px] font-semibold inline-flex items-center gap-1 ${active
                      ? 'border-sky-700 bg-sky-700 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-300'}`}>
                    <span aria-hidden="true">{meta.icon}</span>{t}
                  </button>
                );
              })}
            </div>
            {hasFilters && (
              <>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Showing {total} of {scoped.length} appointments.
                </span>
                <button type="button" onClick={clearFilters} title="Clear all filters"
                  className="cursor-pointer rounded-[8px] border border-slate-200 bg-white px-3 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-50 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-300">
                  Clear filters
                </button>
              </>
            )}
          </div>
        </div>

        {view === 'calendar' ? (
          <AppointmentsCalendarView
            appointments={scoped}
            onSelectDate={(iso) => {
              setSpecificDate(iso); setDateRange('all');
              setView('list'); setPage(1);
            }}
            onCreate={(iso) => {
              if (!canCreate) return;
              setPrefillDate(iso); setShowAdd(true);
            }}
            canCreate={canCreate}
          />
        ) : (
          <ListBody
            slice={slice} officeById={officeById}
            total={total} safePage={safePage} perPage={perPage}
            setPage={setPage} setPerPage={setPerPage}
            canEdit={canEdit} canDelete={canDelete} showActions={showActions}
            onView={setViewId} onEdit={(r) => setEditRow(r)} onCancel={(r) => setCancelRow(r)}
            scopedAll={scoped}
          />
        )}
      </div>

      {showAdd && (
        <AddAppointmentDrawer open currentUser={user} prefillDate={prefillDate}
          onClose={() => { setShowAdd(false); setPrefillDate(''); }}
          onCreated={(created) => {
            setShowAdd(false); setPrefillDate('');
            showToast(`Appointment ${created.id} created successfully.`);
          }} />
      )}
      {editRow && !viewId && (
        <EditAppointmentDrawer open appointmentRow={editRow} currentUser={user}
          onClose={() => setEditRow(null)}
          onUpdated={(updated) => { setEditRow(null); showToast(`Appointment ${updated.id} updated successfully.`); }} />
      )}
      {cancelRow && (
        <CancelAppointmentModal open appointmentRow={cancelRow} currentUser={user}
          onClose={() => setCancelRow(null)}
          onCancelled={(row) => { setCancelRow(null); showToast(`Appointment ${row.id} cancelled successfully.`); }} />
      )}

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

function ListBody({
  slice, officeById, total, safePage, perPage,
  setPage, setPerPage, canEdit, canDelete, showActions,
  onView, onEdit, onCancel, scopedAll,
}) {
  return (
    <>
      {/* Table — desktop only */}
      <div className="hidden lg:block overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-sm dark:border-[#142535] dark:bg-[#0A1828]">
        <div className="w-full">
          <table className="w-full min-w-[1100px] border-collapse text-left text-[13px]">
            <thead className="bg-slate-50 dark:bg-[#071220]">
              <tr>
                {['SR. No.', 'Visitor', 'Type', 'Host', 'Office', 'Date', 'Time', 'Status', ...(showActions ? ['Actions'] : [])].map((h) => (
                  <th key={h} className="whitespace-nowrap px-3 py-3 text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#142535]">
              {slice.length === 0 && (
                <tr>
                  <td colSpan={showActions ? 9 : 8} className="px-3 py-0">
                    <EmptyState
                      icon={Calendar}
                      message={scopedAll.length === 0 ? 'No appointments scheduled yet.' : 'No records found.'}
                      description={scopedAll.length === 0
                        ? 'Create your first appointment to start tracking visitor meetings.'
                        : 'Try removing a filter or clearing the search.'}
                    />
                  </td>
                </tr>
              )}
              {slice.map((a, idx) => {
                const sr = (safePage - 1) * perPage + idx + 1;
                const office = officeById.get(a.officeId);
                const disp = displayStatus(a);
                const typeMeta = VISITOR_TYPE_META[a.visitor?.visitorType] || VISITOR_TYPE_META.Regular;
                return (
                  <tr key={a.id}
                    onClick={() => onView(a.id)}
                    className="cursor-pointer transition hover:bg-slate-50 dark:hover:bg-[#1E1E3F]">
                    <td className="px-3 py-3 align-top font-semibold text-slate-400">{sr}</td>
                    <td className="px-3 py-3 align-top">
                      <div className="flex items-start gap-2">
                        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-sky-200 bg-sky-50 text-[18px] leading-none dark:border-sky-400/30 dark:bg-sky-500/15">
                          {typeMeta.icon}
                        </span>
                        <div className="min-w-0">
                          <div className="break-words text-[13px] font-bold text-[#0C2340] dark:text-slate-100">
                            {a.visitor?.fullName || a.guestName || '—'}
                          </div>
                          <div className="mt-0.5 break-words text-[11px] text-slate-400">
                            {a.visitor?.companyName || a.company || '—'} · <span className="font-mono">{a.id}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-bold text-slate-600 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-300">
                        {a.visitor?.visitorType || 'Regular'}
                      </span>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <div className="flex items-start gap-1.5 min-w-0">
                        <UserRound size={12} aria-hidden="true" className="mt-0.5 shrink-0 text-slate-400" />
                        <span className="break-words text-[12px] font-semibold text-slate-700 dark:text-slate-200">
                          {a.host || '—'}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 align-top text-[12px] text-slate-600 dark:text-slate-300">
                      {office?.name || '—'}
                    </td>
                    <td className="px-3 py-3 align-top text-[12px] text-slate-700 dark:text-slate-200">
                      {formatDateGB(a.scheduledDate || a.date)}
                    </td>
                    <td className="px-3 py-3 align-top text-[12px] text-slate-700 dark:text-slate-200">
                      {formatAppointmentTime(a, office)}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <StatusPill label={disp.label} tone={disp.tone} />
                    </td>
                    {showActions && (
                      <td className="px-3 py-3 align-top" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <IconBtn Icon={Eye} tone="slate" title={`View ${a.id}`} onClick={() => onView(a.id)} />
                          {canEdit && <IconBtn Icon={Pencil} tone="violet" title={`Edit ${a.id}`} onClick={() => onEdit(a)} />}
                          {canDelete && a.status !== 'Cancelled' && a.status !== 'Completed' && (
                            <IconBtn Icon={Trash2} tone="red" title={`Cancel ${a.id}`} onClick={() => onCancel(a)} />
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-2 dark:border-[#142535]">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Showing {slice.length === 0 ? 0 : (safePage - 1) * perPage + 1}
            –{(safePage - 1) * perPage + slice.length} of {total} appointment{total === 1 ? '' : 's'}.
          </span>
        </div>

        <Pagination
          page={safePage} perPage={perPage} total={total}
          onPageChange={setPage}
          onPerPageChange={(n) => { setPerPage(n); setPage(1); }}
        />
      </div>

      {/* Cards — mobile/tablet only */}
      <div className="lg:hidden">
        <MobileCardList
          items={slice}
          emptyNode={<EmptyState icon={Calendar} message={scopedAll.length === 0 ? 'No appointments yet.' : 'No records found.'} description="Try removing a filter or clearing the search." />}
          renderCard={(a) => {
            const office = officeById.get(a.officeId);
            const disp = displayStatus(a);
            const typeMeta = VISITOR_TYPE_META[a.visitor?.visitorType] || VISITOR_TYPE_META.Regular;
            return (
              <MobileCard
                key={a.id}
                onClick={() => onView(a.id)}
                title={a.visitor?.fullName || a.guestName || '—'}
                subtitle={`${a.visitor?.companyName || a.company || '—'} · ${a.id}`}
                badge={<StatusPill label={disp.label} tone={disp.tone} />}
                rows={[
                  { label: 'Type', value: <span className="inline-flex items-center gap-1">{typeMeta.icon} {a.visitor?.visitorType || 'Regular'}</span> },
                  { label: 'Host', value: a.host },
                  { label: 'Office', value: office?.name },
                  { label: 'Date', value: formatDateGB(a.scheduledDate || a.date) },
                  { label: 'Time', value: formatAppointmentTime(a, office) },
                ]}
                actions={showActions && (
                  <>
                    <IconBtn Icon={Eye} tone="slate" title="View" onClick={() => onView(a.id)} />
                    {canEdit && <IconBtn Icon={Pencil} tone="violet" title="Edit" onClick={() => onEdit(a)} />}
                    {canDelete && a.status !== 'Cancelled' && a.status !== 'Completed' && (
                      <IconBtn Icon={Trash2} tone="red" title="Cancel" onClick={() => onCancel(a)} />
                    )}
                  </>
                )}
              />
            );
          }}
        />
        {slice.length > 0 && (
          <div className="mt-3 rounded-[12px] border border-slate-200 bg-white p-3 shadow-sm dark:border-[#142535] dark:bg-[#0A1828]">
            <div className="mb-2 text-center text-[12px] text-slate-500">
              Showing {(safePage - 1) * perPage + 1}–{(safePage - 1) * perPage + slice.length} of {total} appointments
            </div>
            <Pagination page={safePage} perPage={perPage} total={total} onPageChange={setPage} onPerPageChange={(n) => { setPerPage(n); setPage(1); }} />
          </div>
        )}
      </div>
    </>
  );
}

function IconBtn({ Icon, title, tone = 'slate', onClick }) {
  const cls = {
    slate:  'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-300 dark:hover:bg-[#1E1E3F]',
    violet: 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 dark:border-sky-400/30 dark:bg-sky-500/15 dark:text-sky-300',
    red:    'border-red-200 bg-red-50 text-red-600 hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300',
  }[tone];
  return (
    <button type="button" onClick={onClick} title={title} aria-label={title}
      className={`inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-[8px] border shadow-sm transition ${cls}`}>
      <Icon size={13} aria-hidden="true" />
    </button>
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
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${cls}`}>
      <span aria-hidden="true">●</span>{label}
    </span>
  );
}
