import React, { useMemo, useState } from 'react';
import {
  Building2, Plus, Search, X, Eye, Pencil, Trash2, MapPin,
} from 'lucide-react';
import { useCollection, STORAGE_KEYS } from '../../store';
import { MOCK_OFFICES } from '../../data/mockData';
import { useAuth } from '../../context/AuthContext';
import { useRole } from '../../context/RoleContext';
import NoAccess from '../../components/NoAccess';
import { Pagination, SearchableSelect, EmptyState, Toast, MobileCardList, MobileCard } from '../../components/ui';
import AddOfficeDrawer from './AddOfficeDrawer';
import EditOfficeDrawer from './EditOfficeDrawer';
import DeleteOfficeModal from './DeleteOfficeModal';
import OfficeDetailPage from './OfficeDetailPage';

/**
 * Offices — list page for the Offices module.
 *
 * Tenant isolation: every row is passed through a local `byOrg`
 * helper keyed on the logged-in user's orgId BEFORE rendering, so a
 * Director of one tenant never sees another tenant's offices even
 * if the raw store contains cross-tenant rows.
 *
 * RBAC:
 *   SuperAdmin — full CRUD, cross-tenant (skips byOrg).
 *   Director   — full CRUD within own org.
 *   Manager    — view + create + edit (NO delete).
 *   Reception  — view only (Actions column hidden).
 *   Service    — NoAccess (wrapped at the top).
 */

const COUNTRY_FLAGS = {
  'India':                { flag: '🇮🇳', code: 'IN' },
  'United Arab Emirates': { flag: '🇦🇪', code: 'AE' },
  'Saudi Arabia':         { flag: '🇸🇦', code: 'SA' },
  'United Kingdom':       { flag: '🇬🇧', code: 'GB' },
  'Qatar':                { flag: '🇶🇦', code: 'QA' },
  'Oman':                 { flag: '🇴🇲', code: 'OM' },
  'Kuwait':               { flag: '🇰🇼', code: 'KW' },
  'Bahrain':              { flag: '🇧🇭', code: 'BH' },
};

const OFFICE_TYPE_OPTIONS = ['HQ', 'Branch', 'Warehouse', 'Regional Office', 'Other'];

function byOrg(records, user) {
  if (!Array.isArray(records)) return [];
  const role = String(user?.role || '').toLowerCase();
  if (role === 'superadmin') return records;
  const orgId = user?.organisationId || user?.orgId || null;
  if (!orgId) return [];
  return records.filter((r) => !r?.orgId || r.orgId === orgId);
}

export default function Offices({ setActivePage }) {
  const { user } = useAuth();
  const { hasPermission } = useRole();

  if (!hasPermission('offices', 'view')) {
    return (
      <NoAccess
        module="Offices"
        onGoBack={setActivePage ? () => setActivePage('dashboard') : undefined}
      />
    );
  }

  return <OfficesBody user={user} hasPermission={hasPermission} setActivePage={setActivePage} />;
}

function OfficesBody({ user, hasPermission, setActivePage }) {
  const [offices] = useCollection(STORAGE_KEYS.OFFICES, MOCK_OFFICES);

  const [search, setSearch]               = useState('');
  const [typeFilter, setTypeFilter]       = useState('all');
  const [countryFilter, setCountryFilter] = useState('all');
  const [statusFilter, setStatusFilter]   = useState('all');
  const [page, setPage]                   = useState(1);
  const [perPage, setPerPage]             = useState(10);

  const [viewId, setViewId]               = useState(null);
  const [editOffice, setEditOffice]       = useState(null);
  const [deleteOffice, setDeleteOffice]   = useState(null);
  const [showAdd, setShowAdd]             = useState(false);
  const [toast, setToast]                 = useState(null);

  const showToast = (msg, type = 'success') => setToast({ msg, type });

  const canCreate = hasPermission('offices', 'create');
  const canEdit   = hasPermission('offices', 'edit');
  const canDelete = hasPermission('offices', 'delete');
  const showActions = canEdit || canDelete;  /* Reception: both false → hide column */

  /* Tenant-scoped dataset — everything downstream derives from this. */
  const scoped = useMemo(() => byOrg(offices, user), [offices, user]);

  const countryOptions = useMemo(() => {
    const set = new Set();
    for (const o of scoped) if (o?.address?.country) set.add(o.address.country);
    return [...set].sort();
  }, [scoped]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scoped.filter((o) => {
      if (typeFilter !== 'all' && o.type !== typeFilter) return false;
      if (countryFilter !== 'all' && o.address?.country !== countryFilter) return false;
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (q) {
        const hay = [
          o.name, o.code, o.type, o.status,
          o.address?.city, o.address?.state, o.address?.country,
          o.contact?.managerName, o.contact?.contactNumber, o.contact?.emailId,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [scoped, search, typeFilter, countryFilter, statusFilter]);

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [filtered],
  );

  const total      = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage   = Math.min(page, totalPages);
  const slice      = sorted.slice((safePage - 1) * perPage, safePage * perPage);

  const hasFilters = Boolean(search) || typeFilter !== 'all' || countryFilter !== 'all' || statusFilter !== 'all';

  const clearFilters = () => {
    setSearch(''); setTypeFilter('all'); setCountryFilter('all'); setStatusFilter('all'); setPage(1);
  };

  const openRecord = useMemo(
    () => (viewId ? scoped.find((o) => o.id === viewId) || null : null),
    [viewId, scoped],
  );

  /* Detail page takes over the full area — cleaner than a modal when
     there are multiple tabs to house. */
  if (openRecord) {
    return (
      <div className="w-full min-h-screen bg-slate-50 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 dark:bg-[#050E1A]">
        <OfficeDetailPage
          office={openRecord}
          onBack={() => setViewId(null)}
          onEdit={canEdit ? () => setEditOffice(openRecord) : undefined}
          onNavigate={(target) => setActivePage?.(target)}
          canEdit={canEdit}
        />
        {editOffice && (
          <EditOfficeDrawer
            open
            office={editOffice}
            currentUser={user}
            onClose={() => setEditOffice(null)}
            onUpdated={(updated) => {
              setEditOffice(null);
              showToast(`${updated.name} updated successfully.`);
            }}
          />
        )}
        {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-slate-50 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 dark:bg-[#050E1A]">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4">

        {/* Header */}
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-[Outfit,sans-serif] text-[22px] font-extrabold leading-tight text-[#0C2340] dark:text-slate-100">
              Offices
            </h1>
            <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">
              Manage office locations, working hours and capacity for your organisation.
            </p>
          </div>
          {canCreate && (
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              title="Add a new office"
              className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-sky-700 bg-gradient-to-r from-sky-600 to-sky-800 px-4 py-2.5 text-[13px] font-bold text-white shadow-sm transition hover:from-sky-700 hover:to-sky-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40"
            >
              <Plus size={14} aria-hidden="true" />
              Add Office
            </button>
          )}
        </header>

        {/* Filter bar */}
        <div className="rounded-[14px] border border-slate-200 bg-white p-3 shadow-sm dark:border-[#142535] dark:bg-[#0A1828]">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div className="relative">
              <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search offices by name, code, city, country"
                aria-label="Search offices"
                className="w-full rounded-[10px] border border-slate-200 bg-white py-2 pl-9 pr-9 text-[13px] text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-200"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => { setSearch(''); setPage(1); }}
                  aria-label="Clear search"
                  title="Clear search"
                  className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-[#1E1E3F]"
                >
                  <X size={13} aria-hidden="true" />
                </button>
              )}
            </div>
            <SearchableSelect
              value={typeFilter}
              onChange={(v) => { setTypeFilter(v); setPage(1); }}
              options={[
                { value: 'all', label: 'All Types' },
                ...OFFICE_TYPE_OPTIONS.map((t) => ({ value: t, label: t })),
              ]}
              placeholder="Type"
            />
            <SearchableSelect
              value={countryFilter}
              onChange={(v) => { setCountryFilter(v); setPage(1); }}
              options={[
                { value: 'all', label: 'All Countries' },
                ...countryOptions.map((c) => ({
                  value: c,
                  label: `${COUNTRY_FLAGS[c]?.flag || '🌍'} ${c}`,
                })),
              ]}
              placeholder="Country"
              searchPlaceholder="Search country…"
            />
            <SearchableSelect
              value={statusFilter}
              onChange={(v) => { setStatusFilter(v); setPage(1); }}
              options={[
                { value: 'all',      label: 'All Statuses' },
                { value: 'Active',   label: 'Active' },
                { value: 'Inactive', label: 'Inactive' },
              ]}
              placeholder="Status"
            />
          </div>
          {hasFilters && (
            <div className="mt-3 flex items-center gap-3">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Showing {total} of {scoped.length} offices.
              </span>
              <button
                type="button"
                onClick={clearFilters}
                title="Clear all filters"
                className="cursor-pointer rounded-[8px] border border-slate-200 bg-white px-3 py-1 text-[11px] font-bold text-slate-600 transition hover:bg-slate-50 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-300"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>

        {/* Table — desktop only */}
        <div className="hidden lg:block overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-sm dark:border-[#142535] dark:bg-[#0A1828]">
          <div className="w-full">
            <table className="w-full min-w-[960px] border-collapse text-left text-[13px]">
              <thead className="bg-slate-50 dark:bg-[#071220]">
                <tr>
                  {[
                    'SR. No.',
                    'Office Name',
                    'Code',
                    'Type',
                    'Location',
                    'Manager',
                    'Capacity',
                    'Status',
                    ...(showActions ? ['Actions'] : []),
                  ].map((h) => (
                    <th
                      key={h}
                      className="whitespace-nowrap px-3 py-3 text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#142535]">
                {slice.length === 0 && (
                  <tr>
                    <td colSpan={showActions ? 9 : 8} className="px-3 py-0">
                      <EmptyState
                        icon={Building2}
                        message={scoped.length === 0
                          ? 'No offices yet — add your first office to start tracking visitors.'
                          : 'No records found.'}
                        description={scoped.length === 0
                          ? undefined
                          : 'Try removing a filter or clearing the search.'}
                        action={scoped.length === 0 && canCreate ? (
                          <button
                            type="button"
                            onClick={() => setShowAdd(true)}
                            title="Add a new office"
                            className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-sky-700 bg-sky-700 px-4 py-2 text-[12px] font-bold text-white transition hover:bg-sky-800"
                          >
                            <Plus size={13} aria-hidden="true" /> Add Office
                          </button>
                        ) : null}
                      />
                    </td>
                  </tr>
                )}
                {slice.map((o, idx) => {
                  const sr   = (safePage - 1) * perPage + idx + 1;
                  const flag = COUNTRY_FLAGS[o.address?.country] || { flag: '🌍', code: '—' };
                  return (
                    <tr
                      key={o.id}
                      onClick={() => setViewId(o.id)}
                      className="cursor-pointer transition hover:bg-slate-50 dark:hover:bg-[#1E1E3F]"
                    >
                      <td className="px-3 py-3 align-top font-semibold text-slate-400">{sr}</td>
                      <td className="px-3 py-3 align-top">
                        <div className="flex items-start gap-2">
                          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/30 dark:bg-sky-500/15 dark:text-sky-300">
                            <Building2 size={13} aria-hidden="true" />
                          </span>
                          <div className="min-w-0">
                            <div className="break-words text-[13px] font-bold text-[#0C2340] hover:text-sky-700 dark:text-slate-100 dark:hover:text-sky-300">
                              {o.name}
                            </div>
                            <div className="mt-0.5 break-words text-[11px] text-slate-400">
                              {o.address?.line1 || '—'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top font-mono text-[12px] text-slate-700 dark:text-slate-200">
                        {o.code || '—'}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <TypePill type={o.type} />
                      </td>
                      <td className="px-3 py-3 align-top text-slate-600 dark:text-slate-300">
                        <div className="flex items-start gap-1.5">
                          <MapPin size={12} aria-hidden="true" className="mt-0.5 shrink-0 text-slate-400" />
                          <div className="min-w-0">
                            <div className="break-words text-[12px] font-semibold text-slate-700 dark:text-slate-200">
                              {o.address?.city || '—'}{o.address?.state ? `, ${o.address.state}` : ''}
                            </div>
                            <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-slate-400">
                              <span aria-hidden="true">{flag.flag}</span>
                              <span className="font-semibold">{flag.code}</span>
                              <span>·</span>
                              <span className="font-mono">{o.address?.postalCode || '—'}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top text-[12px] text-slate-600 dark:text-slate-300">
                        {o.contact?.managerName || '—'}
                      </td>
                      <td className="px-3 py-3 align-top font-mono text-[12px] text-slate-700 dark:text-slate-200">
                        {Number(o.operations?.maxCapacity || 0).toLocaleString('en-GB')}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <StatusPill status={o.status} />
                      </td>
                      {showActions && (
                        <td className="px-3 py-3 align-top" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <IconBtn
                              Icon={Eye}
                              tone="slate"
                              title={`View ${o.name}`}
                              onClick={() => setViewId(o.id)}
                            />
                            {canEdit && (
                              <IconBtn
                                Icon={Pencil}
                                tone="violet"
                                title={`Edit ${o.name}`}
                                onClick={() => setEditOffice(o)}
                              />
                            )}
                            {canDelete && (
                              <IconBtn
                                Icon={Trash2}
                                tone="red"
                                title={`Delete ${o.name}`}
                                onClick={() => setDeleteOffice(o)}
                              />
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
              –{(safePage - 1) * perPage + slice.length} of {total} office{total === 1 ? '' : 's'}.
            </span>
          </div>

          <Pagination
            page={safePage}
            perPage={perPage}
            total={total}
            onPageChange={setPage}
            onPerPageChange={(n) => { setPerPage(n); setPage(1); }}
          />
        </div>

        {/* Cards — mobile/tablet only */}
        <div className="lg:hidden">
          <MobileCardList
            items={slice}
            emptyNode={<EmptyState icon={Building2} message={scoped.length === 0 ? 'No offices yet.' : 'No records found.'} description="Try removing a filter or clearing the search." />}
            renderCard={(o) => {
              const flag = COUNTRY_FLAGS[o.address?.country] || { flag: '🌍', code: '—' };
              return (
                <MobileCard
                  key={o.id}
                  onClick={() => setViewId(o.id)}
                  title={o.name}
                  subtitle={o.address?.line1}
                  badge={<StatusPill status={o.status} />}
                  rows={[
                    { label: 'Code', value: <span className="font-mono">{o.code || '—'}</span> },
                    { label: 'Type', value: <TypePill type={o.type} /> },
                    { label: 'City', value: `${o.address?.city || '—'}${o.address?.state ? `, ${o.address.state}` : ''}` },
                    { label: 'Country', value: `${flag.flag} ${flag.code}` },
                    { label: 'Manager', value: o.contact?.managerName },
                    { label: 'Capacity', value: Number(o.operations?.maxCapacity || 0).toLocaleString('en-IN') },
                  ]}
                  actions={showActions && (
                    <>
                      <IconBtn Icon={Eye} tone="slate" title="View" onClick={() => setViewId(o.id)} />
                      {canEdit && <IconBtn Icon={Pencil} tone="violet" title="Edit" onClick={() => setEditOffice(o)} />}
                      {canDelete && <IconBtn Icon={Trash2} tone="red" title="Delete" onClick={() => setDeleteOffice(o)} />}
                    </>
                  )}
                />
              );
            }}
          />
          {slice.length > 0 && (
            <div className="mt-3 rounded-[12px] border border-slate-200 bg-white p-3 shadow-sm dark:border-[#142535] dark:bg-[#0A1828]">
              <div className="mb-2 text-center text-[12px] text-slate-500">
                Showing {(safePage - 1) * perPage + 1}–{(safePage - 1) * perPage + slice.length} of {total} offices
              </div>
              <Pagination page={safePage} perPage={perPage} total={total} onPageChange={setPage} onPerPageChange={(n) => { setPerPage(n); setPage(1); }} />
            </div>
          )}
        </div>
      </div>

      {/* Drawers + modals */}
      {showAdd && (
        <AddOfficeDrawer
          open
          currentUser={user}
          onClose={() => setShowAdd(false)}
          onCreated={(created) => {
            setShowAdd(false);
            showToast(`${created.name} created successfully.`);
          }}
        />
      )}
      {editOffice && !viewId && (
        <EditOfficeDrawer
          open
          office={editOffice}
          currentUser={user}
          onClose={() => setEditOffice(null)}
          onUpdated={(updated) => {
            setEditOffice(null);
            showToast(`${updated.name} updated successfully.`);
          }}
        />
      )}
      {deleteOffice && (
        <DeleteOfficeModal
          open
          office={deleteOffice}
          currentUser={user}
          onClose={() => setDeleteOffice(null)}
          onDeleted={(deleted) => {
            setDeleteOffice(null);
            showToast(`${deleted.name} deleted successfully.`);
          }}
        />
      )}

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

/* ── Row helpers ─────────────────────────────────────────────────── */

function IconBtn({ Icon, title, tone = 'slate', onClick }) {
  const cls = {
    slate:  'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-300 dark:hover:bg-[#1E1E3F]',
    violet: 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 dark:border-sky-400/30 dark:bg-sky-500/15 dark:text-sky-300 dark:hover:bg-sky-500/25',
    red:    'border-red-200 bg-red-50 text-red-600 hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20',
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-[8px] border shadow-sm transition ${cls}`}
    >
      <Icon size={13} aria-hidden="true" />
    </button>
  );
}

function TypePill({ type }) {
  const cls = {
    'HQ':              'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/30 dark:bg-sky-500/15 dark:text-sky-300',
    'Branch':          'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-300',
    'Warehouse':       'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300',
    'Regional Office': 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300',
    'Other':           'border-slate-200 bg-slate-100 text-slate-600 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-300',
  }[type] || 'border-slate-200 bg-slate-100 text-slate-600';
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold ${cls}`}>
      {type || '—'}
    </span>
  );
}

function StatusPill({ status }) {
  const active = status === 'Active';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${active
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
        : 'border-slate-200 bg-slate-100 text-slate-500 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-400'}`}
    >
      <span aria-hidden="true">●</span>
      {status || 'Active'}
    </span>
  );
}
