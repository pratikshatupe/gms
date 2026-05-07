import React, { useMemo, useState } from 'react';
import { ClipboardList, Search, X } from 'lucide-react';
import { useCollection, STORAGE_KEYS } from '../../store';
import { MOCK_ACCESS_REQUESTS } from '../../data/mockData';
import { Pagination, EmptyState, SearchableSelect, Toast } from '../../components/ui';
import { useRole } from '../../context/RoleContext';
import { useAuth } from '../../context/AuthContext';
import NoAccess from '../../components/NoAccess';
import RequestDetailDrawer from './RequestDetailDrawer';

/**
 * AccessRequests — Super Admin inbox for the public "Request
 * Organisation Access" form. Each row opens RequestDetailDrawer where
 * the Super Admin can Reject, Request Info, or Approve & Create
 * Account (which hands off to AddOrgDrawer with fields pre-filled).
 *
 * RBAC: gated on `admin.view` — same module key the Organisations
 * module uses, since both surfaces are platform owner-only. Director,
 * Manager, Reception and Service Staff get NoAccess.
 */

const COUNTRY_FLAGS = {
  India:                   { code: 'IN', flag: '🇮🇳' },
  'United Arab Emirates':  { code: 'AE', flag: '🇦🇪' },
  'Saudi Arabia':          { code: 'SA', flag: '🇸🇦' },
  'United Kingdom':        { code: 'GB', flag: '🇬🇧' },
  Qatar:                   { code: 'QA', flag: '🇶🇦' },
  Oman:                    { code: 'OM', flag: '🇴🇲' },
  Kuwait:                  { code: 'KW', flag: '🇰🇼' },
  Bahrain:                 { code: 'BH', flag: '🇧🇭' },
  Other:                   { code: '—',  flag: '🌍' },
};

const STATUSES = ['Pending', 'Approved', 'Rejected', 'InfoRequested'];

const STATUS_STYLES = {
  Pending:        'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
  Approved:       'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300',
  Rejected:       'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300',
  InfoRequested:  'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300',
};

const STATUS_LABEL = {
  Pending:        'Pending',
  Approved:       'Approved',
  Rejected:       'Rejected',
  InfoRequested:  'Info Requested',
};

function relativeTime(ms) {
  const diff = Date.now() - ms;
  if (!Number.isFinite(diff) || diff < 0) return '—';
  const min = Math.floor(diff / 60000);
  if (min < 1)   return 'just now';
  if (min < 60)  return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24)    return `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.floor(h / 24);
  if (d < 30)    return `${d} day${d === 1 ? '' : 's'} ago`;
  const mo = Math.floor(d / 30);
  return `${mo} month${mo === 1 ? '' : 's'} ago`;
}

export default function AccessRequests({ setActivePage }) {
  const { hasPermission } = useRole();
  const { user } = useAuth();

  if (!hasPermission('admin', 'view')) {
    return (
      <NoAccess
        module="Access Requests"
        onGoBack={setActivePage ? () => setActivePage('dashboard') : undefined}
      />
    );
  }

  return <AccessRequestsBody currentUser={user} />;
}

function AccessRequestsBody({ currentUser }) {
  const [requests, addRequest, updateRequest] = useCollection(
    STORAGE_KEYS.ACCESS_REQUESTS,
    MOCK_ACCESS_REQUESTS,
  );

  const [search, setSearch]               = useState('');
  const [statusFilter, setStatusFilter]   = useState('all');
  const [countryFilter, setCountryFilter] = useState('all');
  const [page, setPage]                   = useState(1);
  const [perPage, setPerPage]             = useState(10);
  const [openId, setOpenId]               = useState(null);
  const [toast, setToast]                 = useState(null);

  const showToast = (msg, type = 'success') => setToast({ msg, type });

  const countryOptions = useMemo(() => {
    const set = new Set();
    for (const r of requests || []) if (r?.country) set.add(r.country);
    return [...set].sort();
  }, [requests]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (requests || []).filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (countryFilter !== 'all' && r.country !== countryFilter) return false;
      if (q) {
        const hay = `${r.orgName || ''} ${r.businessEmail || ''} ${r.contactNumber || ''} ${r.ownerName || ''} ${r.id || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [requests, search, statusFilter, countryFilter]);

  /* Newest first by submittedAt — keeps the inbox feeling alive. */
  const sorted = useMemo(
    () => [...filtered].sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0)),
    [filtered],
  );

  const total      = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage   = Math.min(page, totalPages);
  const slice      = sorted.slice((safePage - 1) * perPage, safePage * perPage);

  const pendingCount = (requests || []).filter((r) => r.status === 'Pending').length;
  const hasFilters   = Boolean(search) || statusFilter !== 'all' || countryFilter !== 'all';

  const clearFilters = () => {
    setSearch(''); setStatusFilter('all'); setCountryFilter('all'); setPage(1);
  };

  const openRequest = requests?.find((r) => r.id === openId) || null;

  return (
    <div className="w-full min-w-0 px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-[Outfit,sans-serif] text-[20px] font-extrabold text-[#0C2340] dark:text-slate-100">
            Access Requests
          </h1>
          <p className="mt-1 text-[13px] text-slate-400 dark:text-slate-500">
            Public requests to join the platform — review and approve to create an organisation.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[12px] font-bold text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          <span aria-hidden="true">●</span>
          {pendingCount} pending review
        </div>
      </div>

      {/* Filter bar */}
      <div className="mb-4 rounded-[14px] border border-slate-200 bg-white p-3 shadow-sm dark:border-[#142535] dark:bg-[#0A1828]">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div className="relative lg:col-span-2">
            <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by organisation, email, contact or request ID"
              aria-label="Search access requests"
              className="w-full rounded-[10px] border border-slate-200 bg-white py-2 pl-9 pr-9 text-[13px] text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-200"
            />
            {search && (
              <button
                type="button"
                onClick={() => { setSearch(''); setPage(1); }}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-[#1E1E3F]"
              >
                <X size={13} aria-hidden="true" />
              </button>
            )}
          </div>
          <SearchableSelect
            value={statusFilter}
            onChange={(v) => { setStatusFilter(v); setPage(1); }}
            options={[
              { value: 'all', label: 'All Statuses' },
              ...STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] })),
            ]}
            placeholder="Status"
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
        </div>
        {hasFilters && (
          <div className="mt-3 flex items-center gap-3">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Showing {total} of {(requests || []).length} requests.
            </span>
            <button
              type="button"
              onClick={clearFilters}
              className="cursor-pointer rounded-[8px] border border-slate-200 bg-white px-3 py-1 text-[11px] font-bold text-slate-600 transition hover:bg-slate-50 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-300"
              title="Clear all filters"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Table — desktop only */}
      <div className="hidden lg:block overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-sm dark:border-[#142535] dark:bg-[#0A1828]">
        <div className="w-full">
          <table className="w-full min-w-[920px] border-collapse text-left text-[13px]">
            <thead className="bg-slate-50 dark:bg-[#071220]">
              <tr>
                {['SR. No.', 'Organisation', 'Country', 'Company Size', 'Submitted', 'Status', 'Actions'].map((h) => (
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
                  <td colSpan={7} className="px-3 py-0">
                    <EmptyState
                      icon={ClipboardList}
                      message="No access requests match the current filters."
                      description={hasFilters ? 'Try removing a filter or clearing the search.' : 'New requests submitted from the landing page will appear here.'}
                    />
                  </td>
                </tr>
              )}
              {slice.map((r, idx) => {
                const sr = (safePage - 1) * perPage + idx + 1;
                const flag = COUNTRY_FLAGS[r.country] || { code: '—', flag: '🌍' };
                return (
                  <tr
                    key={r.id}
                    onClick={() => setOpenId(r.id)}
                    className="cursor-pointer transition hover:bg-slate-50 dark:hover:bg-[#1E1E3F]"
                  >
                    <td className="px-3 py-3 font-semibold text-slate-400">{sr}</td>
                    <td className="px-3 py-3">
                      <div className="text-[13px] font-bold text-[#0C2340] dark:text-slate-100">
                        {r.orgName}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-400">
                        {r.businessEmail} · <span className="font-mono">{r.id}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-slate-600 dark:text-slate-300">
                      <span className="inline-flex items-center gap-1.5" title={r.country}>
                        <span aria-hidden="true">{flag.flag}</span>
                        <span className="font-semibold">{flag.code}</span>
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{r.companySize || '—'}</td>
                    <td className="px-3 py-3 text-slate-500 dark:text-slate-400">
                      <span title={new Date(r.submittedAt).toLocaleString('en-GB')}>
                        {relativeTime(r.submittedAt)}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${STATUS_STYLES[r.status] || STATUS_STYLES.Pending}`}>
                        {STATUS_LABEL[r.status] || r.status}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setOpenId(r.id); }}
                        title={`Review ${r.orgName}`}
                        className="cursor-pointer rounded-[8px] border border-slate-200 bg-white px-3 py-1 text-[11px] font-bold text-slate-700 transition hover:bg-slate-50 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-200 dark:hover:bg-[#1E1E3F]"
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-2 dark:border-[#142535]">
          <span className="text-[12px] text-slate-500 dark:text-slate-400">
            Showing {slice.length === 0 ? 0 : (safePage - 1) * perPage + 1}
            –{(safePage - 1) * perPage + slice.length} of {total} requests.
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
        {slice.length === 0 ? (
          <div className="rounded-[14px] border border-slate-200 bg-white shadow-sm dark:border-[#142535] dark:bg-[#0A1828]">
            <EmptyState
              icon={ClipboardList}
              message="No access requests match the current filters."
              description={hasFilters ? 'Try removing a filter or clearing the search.' : 'New requests submitted from the landing page will appear here.'}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {slice.map((r, idx) => {
              const sr = (safePage - 1) * perPage + idx + 1;
              const flag = COUNTRY_FLAGS[r.country] || { code: '—', flag: '🌍' };
              return (
                <div
                  key={r.id}
                  onClick={() => setOpenId(r.id)}
                  className="cursor-pointer rounded-[12px] border border-slate-200 bg-white p-4 shadow-sm transition hover:border-sky-300 hover:shadow-md dark:border-[#142535] dark:bg-[#0A1828] dark:hover:border-sky-600"
                  style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-bold text-[#0C2340] dark:text-slate-100">{r.orgName}</div>
                      <div className="mt-0.5 truncate text-[11px] text-slate-400">{r.businessEmail}</div>
                    </div>
                    <span className={`shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLES[r.status] || STATUS_STYLES.Pending}`}>
                      {STATUS_LABEL[r.status] || r.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-y-2 text-[12px]">
                    <div>
                      <span className="text-slate-400">Request ID</span>
                      <div className="font-mono font-semibold text-slate-600 dark:text-slate-300 text-[11px]">{r.id}</div>
                    </div>
                    <div>
                      <span className="text-slate-400">Country</span>
                      <div className="font-semibold text-slate-600 dark:text-slate-300">{flag.flag} {flag.code}</div>
                    </div>
                    <div>
                      <span className="text-slate-400">Company Size</span>
                      <div className="font-semibold text-slate-600 dark:text-slate-300">{r.companySize || '—'}</div>
                    </div>
                    <div>
                      <span className="text-slate-400">Submitted</span>
                      <div className="font-semibold text-slate-600 dark:text-slate-300">{relativeTime(r.submittedAt)}</div>
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setOpenId(r.id); }}
                      className="cursor-pointer rounded-[8px] border border-sky-200 bg-sky-50 px-3 py-1.5 text-[11px] font-bold text-sky-700 transition hover:bg-sky-100 dark:border-sky-700/30 dark:bg-sky-900/20 dark:text-sky-300"
                    >
                      Review →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Mobile pagination */}
        <div className="mt-4 rounded-[12px] border border-slate-200 bg-white p-3 shadow-sm dark:border-[#142535] dark:bg-[#0A1828]">
          <div className="mb-2 text-center text-[12px] text-slate-500 dark:text-slate-400">
            Showing {slice.length === 0 ? 0 : (safePage - 1) * perPage + 1}–{(safePage - 1) * perPage + slice.length} of {total} requests
          </div>
          <Pagination
            page={safePage}
            perPage={perPage}
            total={total}
            onPageChange={setPage}
            onPerPageChange={(n) => { setPerPage(n); setPage(1); }}
          />
        </div>
      </div>

      {openRequest && (
        <RequestDetailDrawer
          request={openRequest}
          currentUser={currentUser}
          onClose={() => setOpenId(null)}
          onUpdate={(patch) => updateRequest(openRequest.id, patch)}
          onToast={showToast}
        />
      )}

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
