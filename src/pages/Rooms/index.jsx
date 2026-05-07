import React, { useMemo, useState } from 'react';
import {
  DoorOpen, Plus, Search, X, Eye, Pencil, Trash2, ChevronRight, Building2,
} from 'lucide-react';
import { useCollection, STORAGE_KEYS } from '../../store';
import { MOCK_ROOMS, MOCK_OFFICES } from '../../data/mockData';
import { useAuth } from '../../context/AuthContext';
import { useRole } from '../../context/RoleContext';
import NoAccess from '../../components/NoAccess';
import { Pagination, SearchableSelect, EmptyState, Toast, MobileCardList, MobileCard } from '../../components/ui';
import AddRoomDrawer, { byOrg, ROOM_TYPES, ROOM_STATUSES } from './AddRoomDrawer';
import EditRoomDrawer from './EditRoomDrawer';
import DeleteRoomModal from './DeleteRoomModal';
import RoomDetailPage from './RoomDetailPage';

export default function Rooms({ setActivePage }) {
  const { user }          = useAuth();
  const { hasPermission } = useRole();

  if (!hasPermission('rooms', 'view')) {
    return (
      <NoAccess
        module="Rooms"
        onGoBack={setActivePage ? () => setActivePage('dashboard') : undefined}
      />
    );
  }

  return <RoomsBody user={user} hasPermission={hasPermission} setActivePage={setActivePage} />;
}

function RoomsBody({ user, hasPermission, setActivePage }) {
  const [rooms]   = useCollection(STORAGE_KEYS.ROOMS,   MOCK_ROOMS);
  const [offices] = useCollection(STORAGE_KEYS.OFFICES, MOCK_OFFICES);

  const [search, setSearch]             = useState('');
  const [officeFilter, setOfficeFilter] = useState('all');
  const [typeFilter, setTypeFilter]     = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage]                 = useState(1);
  const [perPage, setPerPage]           = useState(10);

  const [editRoom, setEditRoom]     = useState(null);
  const [deleteRoom, setDeleteRoom] = useState(null);
  const [showAdd, setShowAdd]       = useState(false);
  const [viewRoom, setViewRoom]     = useState(null);
  const [toast, setToast]           = useState(null);

  const showToast = (msg, type = 'success') => setToast({ msg, type });

  const canCreate   = hasPermission('rooms', 'create');
  const canEdit     = hasPermission('rooms', 'edit');
  const canDelete   = hasPermission('rooms', 'delete');
  const showActions = canEdit || canDelete;

  const scoped        = useMemo(() => byOrg(rooms,   user), [rooms,   user]);
  const scopedOffices = useMemo(() => byOrg(offices, user), [offices, user]);

  const officeById = useMemo(() => {
    const m = new Map();
    for (const o of scopedOffices) m.set(o.id, o);
    return m;
  }, [scopedOffices]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scoped.filter((r) => {
      if (officeFilter !== 'all' && r.officeId !== officeFilter) return false;
      if (typeFilter   !== 'all' && r.type     !== typeFilter)   return false;
      if (statusFilter !== 'all' && r.status   !== statusFilter) return false;
      if (q) {
        const hay = [r.name, r.code, r.type, r.status, r.floor,
          officeById.get(r.officeId)?.name].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [scoped, search, officeFilter, typeFilter, statusFilter, officeById]);

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [filtered],
  );

  const total      = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage   = Math.min(page, totalPages);
  const slice      = sorted.slice((safePage - 1) * perPage, safePage * perPage);

  const hasFilters = Boolean(search) || officeFilter !== 'all' || typeFilter !== 'all' || statusFilter !== 'all';
  const clearFilters = () => {
    setSearch(''); setOfficeFilter('all'); setTypeFilter('all'); setStatusFilter('all'); setPage(1);
  };

  /* ── Detail page ── */
  if (viewRoom) {
    return (
      <RoomDetailPage
        room={viewRoom}
        onBack={() => setViewRoom(null)}
        onEdit={(r) => { setViewRoom(null); setEditRoom(r); }}
        onDelete={(r) => { setViewRoom(null); setDeleteRoom(r); }}
        canEdit={canEdit}
        canDelete={canDelete}
      />
    );
  }

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
          <span className="rounded-[6px] px-1.5 py-0.5 text-[#0C2340] dark:text-slate-200">Rooms</span>
        </nav>

        {/* Header */}
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-[Outfit,sans-serif] text-[22px] font-extrabold leading-tight text-[#0C2340] dark:text-slate-100">
              Rooms
            </h1>
            <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">
              Manage meeting rooms, cabins and common areas across your organisation&rsquo;s offices.
            </p>
          </div>
          {canCreate && (
            <button type="button" onClick={() => setShowAdd(true)} title="Add a new room"
              disabled={scopedOffices.length === 0}
              className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-sky-700 bg-gradient-to-r from-sky-600 to-sky-800 px-4 py-2.5 text-[13px] font-bold text-white shadow-sm transition hover:from-sky-700 hover:to-sky-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40 disabled:cursor-not-allowed disabled:opacity-40">
              <Plus size={14} aria-hidden="true" /> Add Room
            </button>
          )}
        </header>

        {/* Filter bar */}
        <div className="rounded-[14px] border border-slate-200 bg-white p-3 shadow-sm dark:border-[#142535] dark:bg-[#0A1828]">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div className="relative">
              <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search rooms by name or code…" aria-label="Search rooms"
                className="w-full rounded-[10px] border border-slate-200 bg-white py-2 pl-9 pr-9 text-[13px] text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-200" />
              {search && (
                <button type="button" onClick={() => { setSearch(''); setPage(1); }} aria-label="Clear search"
                  className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-[#1E1E3F]">
                  <X size={13} aria-hidden="true" />
                </button>
              )}
            </div>
            <SearchableSelect value={officeFilter} onChange={(v) => { setOfficeFilter(v); setPage(1); }}
              options={[{ value: 'all', label: 'All Offices' }, ...scopedOffices.map((o) => ({ value: o.id, label: `${o.name} (${o.code})` }))]}
              placeholder="Office" searchPlaceholder="Search office…" />
            <SearchableSelect value={typeFilter} onChange={(v) => { setTypeFilter(v); setPage(1); }}
              options={[{ value: 'all', label: 'All Types' }, ...ROOM_TYPES.map((t) => ({ value: t, label: t }))]}
              placeholder="Type" />
            <SearchableSelect value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }}
              options={[{ value: 'all', label: 'All Statuses' }, ...ROOM_STATUSES.map((s) => ({ value: s, label: s }))]}
              placeholder="Status" />
          </div>
          {hasFilters && (
            <div className="mt-3 flex items-center gap-3">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Showing {total} of {scoped.length} rooms.</span>
              <button type="button" onClick={clearFilters}
                className="cursor-pointer rounded-[8px] border border-slate-200 bg-white px-3 py-1 text-[11px] font-bold text-slate-600 transition hover:bg-slate-50 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-300">
                Clear filters
              </button>
            </div>
          )}
        </div>

        {/* ── Desktop table ── */}
        <div className="hidden lg:block w-full overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-sm dark:border-[#142535] dark:bg-[#0A1828]">
          <table className="w-full border-collapse text-left text-[12px]" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '44px' }} />   {/* # */}
              <col style={{ width: '22%' }} />    {/* Room Name */}
              <col style={{ width: '90px' }} />   {/* Code */}
              <col style={{ width: '13%' }} />    {/* Type */}
              <col style={{ width: '17%' }} />    {/* Office */}
              <col style={{ width: '70px' }} />   {/* Floor */}
              <col style={{ width: '80px' }} />   {/* Capacity */}
              <col style={{ width: '60px' }} />   {/* Book */}
              <col style={{ width: '11%' }} />    {/* Status */}
              {showActions && <col style={{ width: '90px' }} />}  {/* Actions */}
            </colgroup>
            <thead className="bg-slate-50 dark:bg-[#071220]">
              <tr>
                {['#', 'Room Name', 'Code', 'Type', 'Office', 'Floor', 'Capacity', 'Book', 'Status',
                  ...(showActions ? ['Actions'] : [])].map((h) => (
                  <th key={h} className="px-2 py-2.5 text-[10px] font-bold uppercase tracking-[0.05em] text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-[#142535]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#142535]">
              {slice.length === 0 && (
                <tr>
                  <td colSpan={showActions ? 10 : 9} className="px-3 py-0">
                    <EmptyState icon={DoorOpen}
                      message={scoped.length === 0 ? 'No rooms added yet.' : 'No rooms match the current filters.'}
                      description={scoped.length === 0
                        ? 'Create your first room to let staff and visitors book meeting spaces.'
                        : 'Try removing a filter or clearing the search.'}
                      action={scoped.length === 0 && canCreate && scopedOffices.length > 0 ? (
                        <button type="button" onClick={() => setShowAdd(true)}
                          className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-sky-700 bg-sky-700 px-4 py-2 text-[12px] font-bold text-white transition hover:bg-sky-800">
                          <Plus size={13} aria-hidden="true" /> Add Room
                        </button>
                      ) : null} />
                  </td>
                </tr>
              )}
              {slice.map((r, idx) => {
                const sr     = (safePage - 1) * perPage + idx + 1;
                const office = officeById.get(r.officeId);
                const isNew  = r.createdAt && (Date.now() - new Date(r.createdAt).getTime()) < 48 * 3600 * 1000;
                return (
                  <tr key={r.id} className="transition hover:bg-slate-50 dark:hover:bg-[#1E1E3F]">

                    {/* # */}
                    <td className="px-2 py-2.5 align-middle font-semibold text-slate-400 text-[11px]">{sr}</td>

                    {/* Room Name */}
                    <td className="px-2 py-2.5 align-middle min-w-0">
                      <div className="flex items-start gap-1.5 min-w-0">
                        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] border border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/30 dark:bg-sky-500/15 dark:text-sky-300">
                          <DoorOpen size={11} aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1 min-w-0">
                            <button type="button" onClick={() => showToast('Room details coming soon.', 'info')}
                              className="truncate text-left text-[12px] font-bold text-[#0C2340] hover:text-sky-700 dark:text-slate-100 dark:hover:text-sky-300 max-w-full">
                              {r.name}
                            </button>
                            {isNew && (
                              <span className="shrink-0 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">New</span>
                            )}
                          </div>
                          {r.description && (
                            <span className="block truncate text-[10px] text-slate-400">
                              {r.description.length > 38 ? `${r.description.slice(0, 38)}…` : r.description}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Code */}
                    <td className="px-2 py-2.5 align-middle font-mono text-[11px] text-slate-700 dark:text-slate-200">{r.code || '—'}</td>

                    {/* Type */}
                    <td className="px-2 py-2.5 align-middle"><TypePill type={r.type} /></td>

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

                    {/* Floor */}
                    <td className="px-2 py-2.5 align-middle text-[11px] text-slate-600 dark:text-slate-300">{r.floor || '—'}</td>

                    {/* Capacity */}
                    <td className="px-2 py-2.5 align-middle text-right font-mono text-[11px] text-slate-700 dark:text-slate-200">
                      {Number(r.seatingCapacity || 0).toLocaleString('en-GB')}
                    </td>

                    {/* Bookable */}
                    <td className="px-2 py-2.5 align-middle"><BookablePill bookable={r.bookableByVisitors} /></td>

                    {/* Status */}
                    <td className="px-2 py-2.5 align-middle"><StatusPill status={r.status} /></td>

                    {/* Actions */}
                    {showActions && (
                      <td className="px-2 py-2.5 align-middle">
                        <div className="flex items-center gap-1">
                          <IconBtn Icon={Eye} tone="slate" title={`View ${r.name}`} onClick={() => setViewRoom(r)} />
                          {canEdit && <IconBtn Icon={Pencil} tone="violet" title={`Edit ${r.name}`} onClick={() => setEditRoom(r)} />}
                          {canDelete && <IconBtn Icon={Trash2} tone="red" title={`Delete ${r.name}`} onClick={() => setDeleteRoom(r)} />}
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
              Showing {slice.length === 0 ? 0 : (safePage - 1) * perPage + 1}–{(safePage - 1) * perPage + slice.length} of {total} room{total === 1 ? '' : 's'}.
            </span>
          </div>
          <Pagination page={safePage} perPage={perPage} total={total} onPageChange={setPage}
            onPerPageChange={(n) => { setPerPage(n); setPage(1); }} />
        </div>

        {/* ── Mobile cards ── */}
        <div className="lg:hidden">
          <MobileCardList
            items={slice}
            emptyNode={<EmptyState icon={DoorOpen} message={scoped.length === 0 ? 'No rooms added yet.' : 'No rooms match the filters.'} description="Try removing a filter or clearing the search." />}
            renderCard={(r) => {
              const office = officeById.get(r.officeId);
              return (
                <MobileCard key={r.id} title={r.name} subtitle={`Code: ${r.code || '—'} · Floor: ${r.floor || '—'}`}
                  badge={<StatusPill status={r.status} />}
                  rows={[
                    { label: 'Type',     value: <TypePill type={r.type} /> },
                    { label: 'Office',   value: office?.name },
                    { label: 'Capacity', value: Number(r.seatingCapacity || 0).toLocaleString('en-GB') },
                    { label: 'Bookable', value: <BookablePill bookable={r.bookableByVisitors} /> },
                  ]}
                  actions={showActions && (
                    <>
                      {canEdit   && <IconBtn Icon={Pencil} tone="violet" title="Edit"   onClick={() => setEditRoom(r)} />}
                      {canDelete && <IconBtn Icon={Trash2} tone="red"    title="Delete" onClick={() => setDeleteRoom(r)} />}
                    </>
                  )}
                />
              );
            }}
          />
          {slice.length > 0 && (
            <div className="mt-3 rounded-[12px] border border-slate-200 bg-white p-3 shadow-sm dark:border-[#142535] dark:bg-[#0A1828]">
              <div className="mb-2 text-center text-[12px] text-slate-500">
                Showing {(safePage - 1) * perPage + 1}–{(safePage - 1) * perPage + slice.length} of {total} rooms
              </div>
              <Pagination page={safePage} perPage={perPage} total={total} onPageChange={setPage} onPerPageChange={(n) => { setPerPage(n); setPage(1); }} />
            </div>
          )}
        </div>
      </div>

      {showAdd && (
        <AddRoomDrawer open currentUser={user} onClose={() => setShowAdd(false)}
          onCreated={(created) => { setShowAdd(false); showToast(`${created.name} added successfully.`); }} />
      )}
      {editRoom && (
        <EditRoomDrawer open room={editRoom} currentUser={user} onClose={() => setEditRoom(null)}
          onUpdated={(updated) => { setEditRoom(null); showToast(`${updated.name} updated successfully.`); }} />
      )}
      {deleteRoom && (
        <DeleteRoomModal open room={deleteRoom} currentUser={user} onClose={() => setDeleteRoom(null)}
          onDeleted={(removed) => { setDeleteRoom(null); showToast(`${removed.name} deleted successfully.`); }} />
      )}
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────── */

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

function TypePill({ type }) {
  const cls = {
    'Conference Room': 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/30 dark:bg-sky-500/15 dark:text-sky-300',
    'Meeting Room':    'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-300',
    'Cabin':           'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300',
    'Training Room':   'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300',
    'Lobby':           'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/15 dark:text-sky-300',
    'Cafeteria':       'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-300',
    'Other':           'border-slate-200 bg-slate-100 text-slate-600 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-300',
  }[type] || 'border-slate-200 bg-slate-100 text-slate-600';
  return (
    <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${cls}`}>
      {type || '—'}
    </span>
  );
}

function BookablePill({ bookable }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${
      bookable
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
        : 'border-slate-200 bg-slate-100 text-slate-500 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-400'}`}>
      {bookable ? 'Yes' : 'No'}
    </span>
  );
}

function StatusPill({ status }) {
  const cls = {
    'Active':            'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300',
    'Inactive':          'border-slate-200 bg-slate-100 text-slate-500 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-400',
    'Under Maintenance': 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
  }[status] || 'border-slate-200 bg-slate-100 text-slate-500';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${cls}`}>
      <span aria-hidden="true">●</span>{status || 'Active'}
    </span>
  );
}