import React, { useEffect, useMemo, useState } from 'react';
import {
  Sparkles, Plus, Search, X, Eye, Pencil, Trash2,
  ChevronRight, Building2, SlidersHorizontal, ChevronDown,
} from 'lucide-react';
import { useCollection, STORAGE_KEYS } from '../../store';
import {
  MOCK_SERVICES, MOCK_OFFICES, MOCK_ORGANIZATIONS,
} from '../../data/mockData';
import { useAuth } from '../../context/AuthContext';
import { useRole } from '../../context/RoleContext';
import NoAccess from '../../components/NoAccess';
import { Pagination, SearchableSelect, EmptyState, Toast, MobileCardList, MobileCard } from '../../components/ui';
import AddServiceDrawer, {
  byOrg, SERVICE_CATEGORIES, SERVICE_STATUSES,
  resolveCurrencyForOrg, formatServicePrice,
} from './AddServiceDrawer';
import EditServiceDrawer from './EditServiceDrawer';
import DeleteServiceModal from './DeleteServiceModal';
import ServiceDetailPage from './ServiceDetailPage';

export default function Services({ setActivePage }) {
  const { user }          = useAuth();
  const { hasPermission } = useRole();

  if (!hasPermission('services', 'view')) {
    return (
      <NoAccess
        module="Services"
        onGoBack={setActivePage ? () => setActivePage('dashboard') : undefined}
      />
    );
  }

  return <ServicesBody user={user} hasPermission={hasPermission} setActivePage={setActivePage} />;
}

function ServicesBody({ user, hasPermission, setActivePage }) {
  const [servicesRaw] = useCollection(STORAGE_KEYS.SERVICES,       MOCK_SERVICES);
  const [officesRaw]  = useCollection(STORAGE_KEYS.OFFICES,        MOCK_OFFICES);
  const [orgsAll]     = useCollection(STORAGE_KEYS.ORGANIZATIONS,  MOCK_ORGANIZATIONS);

  const services = Array.isArray(servicesRaw) ? servicesRaw : [];
  const offices  = Array.isArray(officesRaw)  ? officesRaw  : [];

  const [search, setSearch]               = useState('');
  const [categoryFilter, setCategoryF]    = useState('all');
  const [officeFilter, setOfficeFilter]   = useState('all');
  const [statusFilter, setStatusFilter]   = useState('all');
  const [page, setPage]                   = useState(1);
  const [perPage, setPerPage]             = useState(10);
  const [filtersOpen, setFiltersOpen]     = useState(false);

  const [editService, setEditService]     = useState(null);
  const [deleteService, setDeleteService] = useState(null);
  const [showAdd, setShowAdd]             = useState(false);
  const [viewService, setViewService]     = useState(null);
  const [toast, setToast]                 = useState(null);

  const showToast = (msg, type = 'success') => setToast({ msg, type });

  const canCreate   = hasPermission('services', 'create');
  const canEdit     = hasPermission('services', 'edit');
  const canDelete   = hasPermission('services', 'delete');
  const showActions = canEdit || canDelete;

  const scoped        = useMemo(() => byOrg(services, user), [services, user]);
  const scopedOffices = useMemo(() => byOrg(offices,  user), [offices,  user]);

  const officeById = useMemo(() => {
    const m = new Map();
    for (const o of scopedOffices) if (o?.id != null) m.set(String(o.id), o);
    return m;
  }, [scopedOffices]);

  const orgById = useMemo(() => {
    const m = new Map();
    for (const o of Array.isArray(orgsAll) ? orgsAll : []) if (o?.id != null) m.set(o.id, o);
    return m;
  }, [orgsAll]);

  useEffect(() => { setPage(1); }, [search, categoryFilter, officeFilter, statusFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scoped.filter((s) => {
      if (!s) return false;
      if (categoryFilter !== 'all' && s.category !== categoryFilter) return false;
      if (statusFilter   !== 'all' && s.status   !== statusFilter)   return false;
      if (officeFilter !== 'all') {
        const ids = (Array.isArray(s.availableOfficeIds) ? s.availableOfficeIds : []).map(String);
        if (!ids.includes(String(officeFilter))) return false;
      }
      if (q) {
        const hay = [s.name, s.code, s.category, s.description,
          s.chargeable ? 'chargeable' : 'free', s.status].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [scoped, search, categoryFilter, officeFilter, statusFilter]);

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => (a?.name || '').localeCompare(b?.name || '')),
    [filtered],
  );

  const total      = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage   = Math.max(1, Math.min(page, totalPages));
  const slice      = sorted.slice((safePage - 1) * perPage, safePage * perPage);

  const hasFilters = Boolean(search) || categoryFilter !== 'all' || officeFilter !== 'all' || statusFilter !== 'all';
  const clearFilters = () => {
    setSearch(''); setCategoryF('all'); setOfficeFilter('all'); setStatusFilter('all'); setPage(1);
  };

  const activeFilterCount = [
    search, categoryFilter !== 'all', officeFilter !== 'all', statusFilter !== 'all',
  ].filter(Boolean).length;

  /* ── Stat counts ── */
  const stats = [
    { label: 'Total Services', value: scoped.length,                                        color: 'text-sky-600 dark:text-sky-400' },
    { label: 'Active',         value: scoped.filter((s) => s.status === 'Active').length,   color: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Inactive',       value: scoped.filter((s) => s.status === 'Inactive').length, color: 'text-slate-500 dark:text-slate-400' },
    { label: 'Free',           value: scoped.filter((s) => !s.chargeable).length,           color: 'text-amber-600 dark:text-amber-400' },
  ];

  /* ── Detail page ── */
  if (viewService) {
    return (
      <ServiceDetailPage
        service={viewService}
        onBack={() => setViewService(null)}
        onEdit={(s) => { setViewService(null); setEditService(s); }}
        onDelete={(s) => { setViewService(null); setDeleteService(s); }}
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
          <span className="rounded-[6px] px-1.5 py-0.5 text-[#0C2340] dark:text-slate-200">Services</span>
        </nav>

        {/* Header */}
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-[Outfit,sans-serif] text-[22px] font-extrabold leading-tight text-[#0C2340] dark:text-slate-100">
              Services &amp; Facilities
            </h1>
            {/* Bug 11 fix: show logged-in organisation name */}
            {(user?.organisationName || user?.organizationName || user?.organization?.name || user?.orgName) && (
              <p className="mt-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-sky-600 dark:text-sky-300">
                {user.organisationName || user.organizationName || user.organization?.name || user.orgName}
              </p>
            )}
            <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">
              Manage refreshments, IT support, facility and administrative services offered to visitors.
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
              <button type="button" onClick={() => setShowAdd(true)} title="Add a new service"
                disabled={scopedOffices.length === 0}
                className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-sky-700 bg-gradient-to-r from-sky-600 to-sky-800 px-4 py-2.5 text-[13px] font-bold text-white shadow-sm transition hover:from-sky-700 hover:to-sky-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40 disabled:cursor-not-allowed disabled:opacity-40">
                <Plus size={14} aria-hidden="true" /> Add Service
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
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div className="relative">
              <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search by name, code, category…"
                aria-label="Search services"
                className="w-full rounded-[10px] border border-slate-200 bg-white py-2 pl-9 pr-9 text-[13px] text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-200" />
              {search && (
                <button type="button" onClick={() => { setSearch(''); setPage(1); }} aria-label="Clear search"
                  className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-[#1E1E3F]">
                  <X size={13} aria-hidden="true" />
                </button>
              )}
            </div>
            <SearchableSelect value={categoryFilter} onChange={(v) => { setCategoryF(v); setPage(1); }}
              options={[{ value: 'all', label: 'All Categories' }, ...SERVICE_CATEGORIES.map((c) => ({ value: c, label: c }))]}
              placeholder="Category" />
            <SearchableSelect value={officeFilter} onChange={(v) => { setOfficeFilter(v); setPage(1); }}
              options={[{ value: 'all', label: 'All Offices' }, ...scopedOffices.map((o) => ({ value: String(o.id), label: `${o.name} (${o.code})` }))]}
              placeholder="Office" searchPlaceholder="Search office…" />
            <SearchableSelect value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }}
              options={[{ value: 'all', label: 'All Statuses' }, ...SERVICE_STATUSES.map((s) => ({ value: s, label: s }))]}
              placeholder="Status" />
          </div>
          {hasFilters && (
            <div className="mt-3 flex items-center gap-3">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Showing {total} of {scoped.length} services.
              </span>
              <button type="button" onClick={clearFilters}
                className="cursor-pointer rounded-[8px] border border-slate-200 bg-white px-3 py-1 text-[11px] font-bold text-slate-600 transition hover:bg-slate-50 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-300">
                Clear filters
              </button>
            </div>
          )}
        </div>

        {/* ── Desktop Table (lg+) ── */}
        <div className="hidden lg:block w-full overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-sm dark:border-[#142535] dark:bg-[#0A1828]">
          <table className="w-full border-collapse text-left text-[12px]" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '44px' }} />   {/* # */}
              <col style={{ width: '24%' }} />    {/* Service */}
              <col style={{ width: '88px' }} />   {/* Code */}
              <col style={{ width: '13%' }} />    {/* Category */}
              <col style={{ width: '16%' }} />    {/* Offices */}
              <col style={{ width: '11%' }} />    {/* Price */}
              <col style={{ width: '72px' }} />   {/* Duration */}
              <col style={{ width: '90px' }} />   {/* Status */}
              {showActions && <col style={{ width: '88px' }} />}
            </colgroup>
            <thead className="bg-slate-50 dark:bg-[#071220]">
              <tr>
                {['#', 'Service', 'Code', 'Category', 'Available Offices', 'Price', 'Duration', 'Status',
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
                  <td colSpan={showActions ? 9 : 8} className="px-3 py-0">
                    <EmptyState icon={Sparkles}
                      message={scoped.length === 0 ? 'No services added yet.' : 'No services match the current filters.'}
                      description={scoped.length === 0
                        ? 'Add your first service to let visitors request refreshments, IT support or facility items.'
                        : 'Try removing a filter or clearing the search.'}
                      action={scoped.length === 0 && canCreate && scopedOffices.length > 0 ? (
                        <button type="button" onClick={() => setShowAdd(true)}
                          className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-sky-700 bg-sky-700 px-4 py-2 text-[12px] font-bold text-white transition hover:bg-sky-800">
                          <Plus size={13} aria-hidden="true" /> Add Service
                        </button>
                      ) : null} />
                  </td>
                </tr>
              )}
              {slice.map((s, idx) => {
                const sr      = (safePage - 1) * perPage + idx + 1;
                const org     = orgById.get(s.orgId);
                const currency = resolveCurrencyForOrg(org);
                const svcOffices = (Array.isArray(s.availableOfficeIds) ? s.availableOfficeIds : [])
                  .map((id) => officeById.get(String(id))).filter(Boolean);
                const isNew = s.createdAt && (Date.now() - new Date(s.createdAt).getTime()) < 48 * 3600 * 1000;
                return (
                  <tr key={s.id} className="transition hover:bg-slate-50 dark:hover:bg-[#1E1E3F]">

                    {/* # */}
                    <td className="px-2 py-2.5 align-middle text-[11px] font-semibold text-slate-400">{sr}</td>

                    {/* Service name + desc */}
                    <td className="px-2 py-2.5 align-middle min-w-0">
                      <div className="flex items-start gap-1.5 min-w-0">
                        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] border border-sky-200 bg-sky-50 text-[15px] leading-none dark:border-sky-400/30 dark:bg-sky-500/15">
                          {s.icon || '•'}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1 min-w-0">
                            <span className="truncate text-[12px] font-bold text-[#0C2340] dark:text-slate-100 max-w-full">
                              {s.name || 'Untitled Service'}
                            </span>
                            {isNew && (
                              <span className="shrink-0 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">New</span>
                            )}
                          </div>
                          {s.description && (
                            <span className="block truncate text-[10px] text-slate-400">
                              {s.description.length > 40 ? `${s.description.slice(0, 40)}…` : s.description}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Code */}
                    <td className="px-2 py-2.5 align-middle font-mono text-[11px] text-slate-700 dark:text-slate-200">{s.code || '—'}</td>

                    {/* Category */}
                    <td className="px-2 py-2.5 align-middle"><CategoryPill category={s.category} /></td>

                    {/* Offices */}
                    <td className="px-2 py-2.5 align-middle"><OfficesCell offices={svcOffices} /></td>

                    {/* Price */}
                    <td className="px-2 py-2.5 align-middle"><PriceCell service={s} currency={currency} /></td>

                    {/* Duration */}
                    <td className="px-2 py-2.5 align-middle text-center font-mono text-[11px] text-slate-700 dark:text-slate-200">
                      <DurationText minutes={s.estimatedTimeMinutes} />
                    </td>

                    {/* Status */}
                    <td className="px-2 py-2.5 align-middle"><StatusPill status={s.status} /></td>

                    {/* Actions */}
                    {showActions && (
                      <td className="px-2 py-2.5 align-middle">
                        <div className="flex items-center gap-1">
                          <IconBtn Icon={Eye}    tone="slate"  title={`View ${s.name || 'service'}`}   onClick={() => setViewService(s)} />
                          {canEdit   && <IconBtn Icon={Pencil} tone="violet" title={`Edit ${s.name || 'service'}`}   onClick={() => setEditService(s)} />}
                          {canDelete && <IconBtn Icon={Trash2} tone="red"    title={`Delete ${s.name || 'service'}`} onClick={() => setDeleteService(s)} />}
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
              Showing {slice.length === 0 ? 0 : (safePage - 1) * perPage + 1}–{(safePage - 1) * perPage + slice.length} of {total} service{total === 1 ? '' : 's'}.
            </span>
          </div>
          <Pagination page={safePage} perPage={perPage} total={total}
            onPageChange={setPage} onPerPageChange={(n) => { setPerPage(n); setPage(1); }} />
        </div>

        {/* ── Mobile / Tablet Cards (< lg) ── */}
        <div className="lg:hidden">
          <MobileCardList
            items={slice}
            emptyNode={(
              <EmptyState icon={Sparkles}
                message={scoped.length === 0 ? 'No services added yet.' : 'No services match the filters.'}
                description="Try removing a filter or clearing the search." />
            )}
            renderCard={(s) => {
              const org      = orgById.get(s.orgId);
              const currency = resolveCurrencyForOrg(org);
              const svcOffices = (Array.isArray(s.availableOfficeIds) ? s.availableOfficeIds : [])
                .map((id) => officeById.get(String(id))).filter(Boolean);
              return (
                <MobileCard
                  key={s.id}
                  title={`${s.icon || '•'} ${s.name || 'Untitled Service'}`}
                  subtitle={s.description?.slice(0, 60)}
                  badge={<StatusPill status={s.status} />}
                  rows={[
                    { label: 'Code',     value: <span className="font-mono">{s.code || '—'}</span> },
                    { label: 'Category', value: <CategoryPill category={s.category} /> },
                    { label: 'Price',    value: <PriceCell service={s} currency={currency} /> },
                    { label: 'Duration', value: <DurationText minutes={s.estimatedTimeMinutes} /> },
                    { label: 'Offices',  value: svcOffices.map((o) => o.name).join(', ') || '—', fullWidth: true },
                  ]}
                  actions={showActions && (
                    <>
                      <IconBtn Icon={Eye}    tone="slate"  title="View"   onClick={() => setViewService(s)} />
                      {canEdit   && <IconBtn Icon={Pencil} tone="violet" title="Edit"   onClick={() => setEditService(s)} />}
                      {canDelete && <IconBtn Icon={Trash2} tone="red"    title="Delete" onClick={() => setDeleteService(s)} />}
                    </>
                  )}
                />
              );
            }}
          />
          {slice.length > 0 && (
            <div className="mt-3 rounded-[12px] border border-slate-200 bg-white p-3 shadow-sm dark:border-[#142535] dark:bg-[#0A1828]">
              <div className="mb-2 text-center text-[12px] text-slate-500 dark:text-slate-400">
                Showing {(safePage - 1) * perPage + 1}–{(safePage - 1) * perPage + slice.length} of {total} services
              </div>
              <Pagination page={safePage} perPage={perPage} total={total}
                onPageChange={setPage} onPerPageChange={(n) => { setPerPage(n); setPage(1); }} />
            </div>
          )}
        </div>
      </div>

      {/* Drawers & Modals */}
      {showAdd && (
        <AddServiceDrawer open currentUser={user}
          onClose={() => setShowAdd(false)}
          onCreated={(created) => { setShowAdd(false); showToast(`${created.name} added successfully.`); }} />
      )}
      {editService && (
        <EditServiceDrawer open service={editService} currentUser={user}
          onClose={() => setEditService(null)}
          onUpdated={(updated) => { setEditService(null); showToast(`${updated.name} updated successfully.`); }} />
      )}
      {deleteService && (
        <DeleteServiceModal open service={deleteService} currentUser={user}
          onClose={() => setDeleteService(null)}
          onDeleted={(removed) => { setDeleteService(null); showToast(`${removed.name} deleted successfully.`); }} />
      )}
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

/* ── Shared helpers ─────────────────────────────────────────────── */

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

function CategoryPill({ category }) {
  const cls = {
    Refreshment:     'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300',
    'IT Support':    'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-300',
    Facility:        'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/30 dark:bg-sky-500/15 dark:text-sky-300',
    Administrative:  'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300',
    Other:           'border-slate-200 bg-slate-100 text-slate-600 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-300',
  }[category] || 'border-slate-200 bg-slate-100 text-slate-600 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-300';
  return (
    <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${cls}`}>
      {category || '—'}
    </span>
  );
}

function OfficesCell({ offices }) {
  if (!offices || offices.length === 0) return <span className="text-[11px] text-slate-400">—</span>;
  if (offices.length === 1) {
    return (
      <span className="inline-flex min-w-0 items-start gap-1 text-[11px] text-slate-700 dark:text-slate-200" title={offices[0].name}>
        <Building2 size={11} aria-hidden="true" className="mt-0.5 shrink-0 text-slate-400" />
        <span className="truncate font-semibold">{offices[0].name}</span>
      </span>
    );
  }
  const names = offices.map((o) => o.name).join(', ');
  return (
    <span className="inline-flex items-center gap-1 rounded-[7px] border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] font-bold text-slate-700 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-200" title={names}>
      <Building2 size={10} aria-hidden="true" className="text-slate-400" />
      {offices.length} offices
    </span>
  );
}

function PriceCell({ service, currency }) {
  if (!service?.chargeable) {
    return (
      <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
        Free
      </span>
    );
  }
  const numericPrice = Number(service?.price);
  if (!Number.isFinite(numericPrice)) return <span className="text-[11px] text-slate-400">—</span>;
  const price = formatServicePrice(numericPrice, currency);
  const suffix = { 'per page': '/ pg', 'per hour': '/ hr', 'per minute': '/ min' }[service.priceUnit] || '';
  return (
    <span className="text-[11px] font-bold text-[#0C2340] dark:text-slate-100">
      {price} {suffix && <span className="font-semibold text-slate-400 dark:text-slate-500">{suffix}</span>}
    </span>
  );
}

function DurationText({ minutes }) {
  const n = Number(minutes) || 0;
  if (n < 60) return <>{n}m</>;
  const h = Math.floor(n / 60);
  const m = n % 60;
  return <>{h}h{m > 0 ? ` ${m}m` : ''}</>;
}

function StatusPill({ status }) {
  const s = status || 'Inactive';
  const cls = {
    Active:   'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300',
    Inactive: 'border-slate-200 bg-slate-100 text-slate-500 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-400',
  }[s] || 'border-slate-200 bg-slate-100 text-slate-500';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${cls}`}>
      <span aria-hidden="true">●</span>{s}
    </span>
  );
}