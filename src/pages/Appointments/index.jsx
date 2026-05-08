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
import { Pagination, SearchableSelect, EmptyState, Toast, MobileCardList, MobileCard, ConfirmModal } from '../../components/ui';
import { addAuditLog } from '../../utils/auditLogger';
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
  const [appointments, , , removeAppt, replaceAppts] = useCollection(STORAGE_KEYS.APPOINTMENTS, MOCK_APPOINTMENTS);
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

  /* Selection + bulk-delete state. `selectedIds` is a Set of
   * appointment ids the user has ticked; `confirmDelete` holds either
   * { kind: 'one', id } or { kind: 'many', ids: [...] } and drives the
   * shared ConfirmModal. */
  const [selectedIds, setSelectedIds]   = useState(() => new Set());
  const [confirmDelete, setConfirmDelete] = useState(null);

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

  /* Selection helpers — keep selection scoped to the currently visible
   * filter slice so a stale filter change doesn't leave invisible
   * checkboxes ticked. We refresh selectedIds whenever `sorted` shrinks. */
  const sortedIdSet = useMemo(() => new Set((sorted || []).map((a) => a.id)), [sorted]);
  useEffect(() => {
    setSelectedIds((prev) => {
      let changed = false;
      const next = new Set();
      for (const id of prev) {
        if (sortedIdSet.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [sortedIdSet]);

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /* Header checkbox toggles the entire filtered set (`sorted`), not just
   * the current page, so "select all" is intuitive when paginated. */
  const allFilteredSelected = sorted.length > 0 && sorted.every((a) => selectedIds.has(a.id));
  const someFilteredSelected = sorted.some((a) => selectedIds.has(a.id));
  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      if (allFilteredSelected) {
        const next = new Set(prev);
        for (const a of sorted) next.delete(a.id);
        return next;
      }
      const next = new Set(prev);
      for (const a of sorted) next.add(a.id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const requestDeleteOne = (id) => setConfirmDelete({ kind: 'one', id });
  const requestDeleteMany = () => {
    if (selectedIds.size === 0) return;
    setConfirmDelete({ kind: 'many', ids: [...selectedIds] });
  };

  const performDelete = () => {
    if (!confirmDelete) return;
    const author = user?.name || 'Unknown';
    const role   = (user?.role || '').toString();
    const orgId  = user?.organisationId || user?.orgId;

    if (confirmDelete.kind === 'one') {
      const id = confirmDelete.id;
      removeAppt(id);
      addAuditLog({
        userName: author, role, action: 'DELETE', module: 'Appointments',
        description: `Deleted appointment ${id}.`, orgId,
      });
      setSelectedIds((prev) => {
        const next = new Set(prev); next.delete(id); return next;
      });
      showToast(`Appointment ${id} deleted successfully.`);
    } else {
      const idSet = new Set(confirmDelete.ids);
      replaceAppts((list) => list.filter((a) => !idSet.has(a?.id)));
      addAuditLog({
        userName: author, role, action: 'BULK_DELETE', module: 'Appointments',
        description: `Deleted ${idSet.size} appointment${idSet.size === 1 ? '' : 's'} (${[...idSet].join(', ')}).`,
        orgId,
      });
      setSelectedIds(new Set());
      showToast(`${idSet.size} appointment${idSet.size === 1 ? '' : 's'} deleted successfully.`);
    }
    setConfirmDelete(null);
  };

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
          <div className="min-w-0 flex-1">
            <h1 className="font-[Outfit,sans-serif] text-[22px] font-extrabold leading-tight text-[#0C2340] dark:text-slate-100">
              Appointments
            </h1>
            <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">
              Schedule visitor meetings, approve requests and track check-ins across your organisation.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
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
          {/* Responsive filter grid:
                mobile (< md)    → single column stack
                tablet (md→xl)   → 2 columns, filters wrap to 3 rows
                desktop (xl+)    → 5 columns in one row, search 2× wide
              `minmax(0,*)` lets each cell shrink past its content width
              so long option labels can't push the row past 100% and
              spawn a horizontal scrollbar. */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:[grid-template-columns:minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <div className="relative min-w-0">
              <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search by visitor, company, purpose or ID"
                aria-label="Search appointments"
                className="w-full min-w-0 rounded-[10px] border border-slate-200 bg-white py-2 pl-9 pr-9 text-[13px] text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-200" />
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

        {/* Bulk-action bar — appears only when one or more rows are
            selected. Hosts both the selection summary and the bulk
            Delete CTA, plus a Clear Selection button. */}
        {canDelete && view === 'list' && selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-sky-200 bg-sky-50 px-4 py-2.5 shadow-sm dark:border-sky-400/30 dark:bg-sky-500/10">
            <div className="flex items-center gap-2 text-[13px] font-bold text-sky-800 dark:text-sky-200">
              <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-sky-700 px-1.5 text-[11px] font-extrabold text-white">
                {selectedIds.size}
              </span>
              {selectedIds.size === 1 ? 'appointment selected' : 'appointments selected'}
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={clearSelection}
                className="cursor-pointer rounded-[8px] border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-bold text-slate-600 hover:bg-slate-50 dark:border-[#142535] dark:bg-[#0A1828] dark:text-slate-300">
                Clear selection
              </button>
              <button type="button" onClick={requestDeleteMany}
                title={`Delete ${selectedIds.size} selected appointment${selectedIds.size === 1 ? '' : 's'}`}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] border border-red-600 bg-red-600 px-3 py-1.5 text-[12px] font-bold text-white hover:bg-red-700">
                <Trash2 size={13} aria-hidden="true" />
                Delete selected
              </button>
            </div>
          </div>
        )}

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
            onDelete={requestDeleteOne}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            allFilteredSelected={allFilteredSelected}
            someFilteredSelected={someFilteredSelected}
            onToggleSelectAll={toggleSelectAll}
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

      {confirmDelete && (
        <ConfirmModal
          open
          title={confirmDelete.kind === 'one' ? 'Delete Appointment' : 'Delete Appointments'}
          message={confirmDelete.kind === 'one'
            ? (() => {
                const apt = scoped.find((a) => a.id === confirmDelete.id);
                const name = apt?.visitor?.fullName || apt?.guestName || confirmDelete.id;
                return `Are you sure you want to permanently delete appointment ${confirmDelete.id} (${name})? This cannot be undone.`;
              })()
            : `Are you sure you want to permanently delete ${confirmDelete.ids.length} selected appointment${confirmDelete.ids.length === 1 ? '' : 's'}? This cannot be undone.`}
          confirmLabel={confirmDelete.kind === 'one' ? 'Delete' : `Delete ${confirmDelete.ids.length}`}
          destructive
          onConfirm={performDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

function ListBody({
  slice, officeById, total, safePage, perPage,
  setPage, setPerPage, canEdit, canDelete, showActions,
  onView, onEdit, onCancel, onDelete, scopedAll,
  selectedIds, onToggleSelect,
  allFilteredSelected, someFilteredSelected, onToggleSelectAll,
}) {
  /* Indeterminate state on the master checkbox needs a ref so we can
   * write the property post-mount (HTML doesn't expose `indeterminate`
   * as an attribute, only as an Element property). */
  const masterCheckboxRef = React.useRef(null);
  React.useEffect(() => {
    if (!masterCheckboxRef.current) return;
    masterCheckboxRef.current.indeterminate = !allFilteredSelected && Boolean(someFilteredSelected);
  }, [allFilteredSelected, someFilteredSelected]);

  /* Header columns vary slightly when the user can delete — checkbox
   * column joins on the left, Actions on the right. We define each
   * column with an explicit width so `table-layout: fixed` can size
   * them deterministically and long visitor / office / host strings
   * truncate with `…` instead of pushing the table past the viewport.
   *
   *   - Fixed-pixel widths for chrome / metadata columns (Select, SR,
   *     Type, Date, Time, Status, Actions).
   *   - Percentage widths for the three text-heavy columns (Visitor /
   *     Host / Office) so they share the leftover space. */
  const columns = [
    ...(canDelete ? [{ key: 'select',  label: 'Select',  width: '46px' }] : []),
    { key: 'sr',       label: 'SR. No.',  width: '60px' },
    { key: 'visitor',  label: 'Visitor',  width: '24%' },
    { key: 'type',     label: 'Type',     width: '90px' },
    { key: 'host',     label: 'Host',     width: '14%' },
    { key: 'office',   label: 'Office',   width: '14%' },
    { key: 'date',     label: 'Date',     width: '100px' },
    { key: 'time',     label: 'Time',     width: '120px' },
    { key: 'status',   label: 'Status',   width: '110px' },
    ...(showActions ? [{ key: 'actions', label: 'Actions', width: '120px' }] : []),
  ];

  return (
    <>
      {/* Table — desktop only.
            outer wrapper: rounded card + clip so corners stay sharp.
            inner wrapper: overflow-x-auto so on truly narrow viewports
            (<≈1100px once min sidebar + padding eat into the space)
            the user can still pan rather than seeing the action column
            cut off. On normal desktops the table fits without scroll. */}
      <div className="hidden lg:block overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-sm dark:border-[#142535] dark:bg-[#0A1828]">
        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse text-left text-[13px]" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              {columns.map((c) => (
                <col key={c.key} style={{ width: c.width }} />
              ))}
            </colgroup>
            <thead className="bg-slate-50 dark:bg-[#071220]">
              <tr>
                {columns.map((c) => (
                  <th key={c.key} className="whitespace-nowrap px-3 py-3 text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400">
                    {c.key === 'select' ? (
                      <input
                        ref={masterCheckboxRef}
                        type="checkbox"
                        aria-label="Select all appointments matching the current filters"
                        title={allFilteredSelected ? 'Deselect all' : 'Select all'}
                        checked={allFilteredSelected}
                        onChange={onToggleSelectAll}
                        className="h-4 w-4 cursor-pointer accent-sky-600"
                      />
                    ) : c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#142535]">
              {slice.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="px-3 py-0">
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
                const isSelected = selectedIds?.has(a.id);
                return (
                  <tr key={a.id}
                    onClick={() => onView(a.id)}
                    className={`cursor-pointer transition ${isSelected ? 'bg-sky-50 dark:bg-sky-500/10' : 'hover:bg-slate-50 dark:hover:bg-[#1E1E3F]'}`}>
                    {canDelete && (
                      <td className="px-3 py-3 align-top" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label={`Select appointment ${a.id}`}
                          checked={Boolean(isSelected)}
                          onChange={() => onToggleSelect?.(a.id)}
                          className="h-4 w-4 cursor-pointer accent-sky-600"
                        />
                      </td>
                    )}
                    <td className="px-3 py-3 align-top font-semibold text-slate-400">{sr}</td>
                    <td className="px-3 py-3 align-top">
                      <div className="flex items-start gap-2 min-w-0">
                        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-sky-200 bg-sky-50 text-[18px] leading-none dark:border-sky-400/30 dark:bg-sky-500/15">
                          {typeMeta.icon}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px] font-bold text-[#0C2340] dark:text-slate-100" title={a.visitor?.fullName || a.guestName || ''}>
                            {a.visitor?.fullName || a.guestName || '—'}
                          </div>
                          <div className="mt-0.5 truncate text-[11px] text-slate-400">
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
                      <div className="flex items-center gap-1.5 min-w-0">
                        <UserRound size={12} aria-hidden="true" className="shrink-0 text-slate-400" />
                        <span className="truncate text-[12px] font-semibold text-slate-700 dark:text-slate-200" title={a.host || ''}>
                          {a.host || '—'}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 align-top text-[12px] text-slate-600 dark:text-slate-300">
                      <span className="block truncate" title={office?.name || ''}>
                        {office?.name || '—'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 align-top text-[12px] text-slate-700 dark:text-slate-200">
                      {formatDateGB(a.scheduledDate || a.date)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 align-top text-[12px] text-slate-700 dark:text-slate-200">
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
                          {canDelete && (
                            <IconBtn Icon={Trash2} tone="red" title={`Delete ${a.id} permanently`} onClick={() => onDelete?.(a.id)} />
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
        {canDelete && slice.length > 0 && (
          <div className="mb-2 flex items-center justify-between rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-[12px] dark:border-[#142535] dark:bg-[#0A1828]">
            <label className="inline-flex cursor-pointer items-center gap-2 font-bold text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                aria-label="Select all visible appointments"
                checked={allFilteredSelected}
                onChange={onToggleSelectAll}
                className="h-4 w-4 cursor-pointer accent-sky-600"
              />
              Select all
            </label>
            <span className="text-[11px] text-slate-400">{selectedIds?.size || 0} selected</span>
          </div>
        )}
        <MobileCardList
          items={slice}
          emptyNode={<EmptyState icon={Calendar} message={scopedAll.length === 0 ? 'No appointments yet.' : 'No records found.'} description="Try removing a filter or clearing the search." />}
          renderCard={(a) => {
            const office = officeById.get(a.officeId);
            const disp = displayStatus(a);
            const typeMeta = VISITOR_TYPE_META[a.visitor?.visitorType] || VISITOR_TYPE_META.Regular;
            const isSelected = selectedIds?.has(a.id);
            return (
              <MobileCard
                key={a.id}
                onClick={() => onView(a.id)}
                title={a.visitor?.fullName || a.guestName || '—'}
                subtitle={`${a.visitor?.companyName || a.company || '—'} · ${a.id}`}
                badge={<StatusPill label={disp.label} tone={disp.tone} />}
                rows={[
                  ...(canDelete ? [{
                    label: 'Select',
                    value: (
                      <span onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label={`Select appointment ${a.id}`}
                          checked={Boolean(isSelected)}
                          onChange={() => onToggleSelect?.(a.id)}
                          className="h-4 w-4 cursor-pointer accent-sky-600"
                        />
                      </span>
                    ),
                  }] : []),
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
                    {canDelete && (
                      <IconBtn Icon={Trash2} tone="red" title="Delete permanently" onClick={() => onDelete?.(a.id)} />
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
    amber:  'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
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
