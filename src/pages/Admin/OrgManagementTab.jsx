import React, { useMemo, useState } from 'react';
import {
  LogIn, Eye, Pencil, BarChart2, PauseCircle, PlayCircle, Download, Building2,
  Search, X, Plus,
} from 'lucide-react';
import { MOCK_ORGANIZATIONS, CRITICAL_ALERTS } from '../../data/mockData';
import { useCollection, STORAGE_KEYS } from '../../store';
import { SearchableSelect } from '../../components/ui';
import { formatAed, formatNumber } from '../../utils/format';
import { useRole } from '../../context/RoleContext';
import AddOrgDrawer from './AddOrgDrawer';

/* Account managers — rotated deterministically across orgs until the seed
 * carries a real assignment field. */
const ACCOUNT_MANAGERS = ['Priya Sharma', 'Rahul Kapoor', 'Anita Desai', 'Kamal Singh'];

/* Plan-level limits — mirrors the SUBSCRIPTION_PLANS defaults. */
const PLAN_LIMITS = {
  Starter:      { users: 10,  offices: 1,  storageGb: 5   },
  Professional: { users: 50,  offices: 5,  storageGb: 25  },
  Enterprise:   { users: 500, offices: 25, storageGb: 200 },
};

/* Country flag lookup — reused across Subscription and Admin. */
const COUNTRY_FLAGS = {
  'United Arab Emirates': { code: 'AE', flag: '🇦🇪' },
  'India':                { code: 'IN', flag: '🇮🇳' },
  'Saudi Arabia':         { code: 'SA', flag: '🇸🇦' },
  'United Kingdom':       { code: 'GB', flag: '🇬🇧' },
  'Qatar':                { code: 'QA', flag: '🇶🇦' },
  'Oman':                 { code: 'OM', flag: '🇴🇲' },
  'Kuwait':               { code: 'KW', flag: '🇰🇼' },
  'Bahrain':              { code: 'BH', flag: '🇧🇭' },
};

/* Deterministic number-from-string — used for offices count, storage,
 * last-activity, and account-manager assignment. Stable across renders. */
function seedInt(s, max = 100) {
  const code = String(s || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return code % max;
}

function relativeTime(iso) {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const hours = Math.floor(ms / 3600000);
  if (hours < 1)  return 'just now';
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30)  return `${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? '' : 's'} ago`;
}

/* Enrich an org row with derived fields the deep-management table needs.
 * Pure — never mutates the source. */
export function enrichOrgForManagement(org) {
  if (!org) return null;
  const plan = PLAN_LIMITS[org.plan] || PLAN_LIMITS.Starter;
  const seed = seedInt(org.id, 1000);
  const offices  = Math.max(1, Math.min(plan.offices, 1 + (seed % plan.offices)));
  const storage  = Math.max(0.5, Math.round(((seed % 100) / 100) * plan.storageGb * 10) / 10);
  const manager  = ACCOUNT_MANAGERS[seed % ACCOUNT_MANAGERS.length];
  const lastActivityHours = 1 + (seed % 96); /* 1h..96h */
  const lastActivity = new Date(Date.now() - lastActivityHours * 3600000).toISOString();

  /* Health score — 0..100, penalties for cancellation, failed payments,
   * renewal risks, trials ending, and very high usage. */
  const failed   = new Set(CRITICAL_ALERTS?.failedPayments?.orgs || []);
  const renewal  = new Set(CRITICAL_ALERTS?.renewalRisks?.orgs   || []);
  const trials   = new Set(CRITICAL_ALERTS?.trialsExpiring?.orgs || []);
  let score = 100;
  if (String(org.status || '').toLowerCase() === 'cancelled') score -= 50;
  if (failed.has(org.name))   score -= 30;
  if (renewal.has(org.name))  score -= 20;
  if (trials.has(org.name))   score -= 15;
  const usagePct = Math.min(100, Math.round((Number(org.users) || 0) / plan.users * 100));
  if (usagePct >= 95) score -= 10;
  else if (usagePct >= 85) score -= 5;
  score = Math.max(0, Math.min(100, score));

  return {
    ...org,
    limits:      plan,
    offices,
    storageGb:   storage,
    accountManager: manager,
    lastActivity,
    healthScore: score,
  };
}

function HealthPill({ score }) {
  const tone = score >= 80 ? 'emerald'
             : score >= 50 ? 'amber'
             : 'red';
  const cls = {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    amber:   'border-amber-200 bg-amber-50 text-amber-700',
    red:     'border-red-200 bg-red-50 text-red-700',
  }[tone];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${cls}`} title={`Health score ${score}/100`}>
      <span aria-hidden="true">●</span>{score}
    </span>
  );
}

function StatusPill({ status }) {
  const cls = {
    Active:    'border-emerald-200 bg-emerald-50 text-emerald-700',
    Trial:     'border-blue-200 bg-blue-50 text-blue-700',
    Suspended: 'border-amber-200 bg-amber-50 text-amber-700',
    Cancelled: 'border-slate-200 bg-slate-100 text-slate-500',
  }[status] || 'border-slate-200 bg-slate-100 text-slate-500';
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${cls}`}>
      {status || '—'}
    </span>
  );
}

/** Compact icon button used by every action in the row. */
function IconBtn({ Icon, title, tone = 'slate', onClick, disabled, ariaLabel }) {
  const cls = {
    slate:   'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
    amber:   'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
    red:     'border-red-200 bg-red-50 text-red-600 hover:bg-red-100',
    violet:  'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100',
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel || title}
      className={`shrink-0 inline-flex items-center justify-center rounded-lg border p-1.5 shadow-sm transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${cls}`}
    >
      <Icon size={14} aria-hidden="true" />
    </button>
  );
}

export default function OrgManagementTab({ onOpenOrg, onImpersonate, onToggleSuspend, onExport, currentUser }) {
  const [orgs] = useCollection(STORAGE_KEYS.ORGANIZATIONS, MOCK_ORGANIZATIONS);
  const { hasPermission } = useRole();
  const canCreate = hasPermission('admin', 'create');
  const [showAdd, setShowAdd] = useState(false);

  const [search, setSearch]                     = useState('');
  const [industryFilter, setIndustryFilter]     = useState('all');
  const [countryFilter, setCountryFilter]       = useState('all');
  const [statusFilter, setStatusFilter]         = useState('all');
  const [healthFilter, setHealthFilter]         = useState('all');   /* 'all' | 'healthy' | 'at-risk' | 'critical' */
  const [managerFilter, setManagerFilter]       = useState('all');

  /* Enrich once per render so filters work against the derived fields too. */
  const enriched = useMemo(
    () => (orgs || MOCK_ORGANIZATIONS).map(enrichOrgForManagement).filter(Boolean),
    [orgs],
  );

  const industryOptions = useMemo(() => {
    const set = new Set();
    for (const o of enriched) if (o.industry) set.add(o.industry);
    return [...set].sort();
  }, [enriched]);

  const countryOptions = useMemo(() => {
    const set = new Set();
    for (const o of enriched) if (o.country) set.add(o.country);
    return [...set].sort();
  }, [enriched]);

  const managerOptions = useMemo(() => {
    const set = new Set();
    for (const o of enriched) if (o.accountManager) set.add(o.accountManager);
    return [...set].sort();
  }, [enriched]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched.filter((o) => {
      if (q) {
        const hay = `${o.name} ${o.industry} ${o.country} ${o.location}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (industryFilter !== 'all' && o.industry !== industryFilter) return false;
      if (countryFilter  !== 'all' && o.country  !== countryFilter)  return false;
      if (managerFilter  !== 'all' && o.accountManager !== managerFilter) return false;
      if (statusFilter   !== 'all' && o.status   !== statusFilter)   return false;
      if (healthFilter === 'healthy'  && o.healthScore < 80) return false;
      if (healthFilter === 'at-risk'  && !(o.healthScore >= 50 && o.healthScore < 80)) return false;
      if (healthFilter === 'critical' && o.healthScore >= 50) return false;
      return true;
    });
  }, [enriched, search, industryFilter, countryFilter, managerFilter, statusFilter, healthFilter]);

  const hasFilters = Boolean(search) || industryFilter !== 'all' || countryFilter !== 'all'
    || managerFilter !== 'all' || statusFilter !== 'all' || healthFilter !== 'all';

  const clearFilters = () => {
    setSearch(''); setIndustryFilter('all'); setCountryFilter('all');
    setManagerFilter('all'); setStatusFilter('all'); setHealthFilter('all');
  };

  return (
    <div className="space-y-4">
      {/* Action bar — search + filter trigger live in the filter card below;
           this row hosts the create-organisation CTA so the operator can
           provision a new tenant without leaving the table. */}
      {canCreate && (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <p className="text-[12px] text-slate-500">
            {filtered.length === enriched.length
              ? `Showing all ${enriched.length} organisations.`
              : `Showing ${filtered.length} of ${enriched.length} organisations.`}
          </p>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            title="Add a new organisation"
            className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-sky-700 bg-gradient-to-r from-sky-600 to-sky-800 px-4 py-2 text-[13px] font-bold text-white shadow-sm transition hover:from-sky-700 hover:to-sky-900"
          >
            <Plus size={14} aria-hidden="true" />
            Add Organisation
          </button>
        </div>
      )}

      {/* Filter bar */}
      <div className="rounded-[14px] border border-slate-200 bg-white p-3 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-6">
          <div className="relative lg:col-span-2">
            <Search size={14} aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, industry, country…"
              aria-label="Search organisations"
              className="w-full rounded-[10px] border border-slate-200 bg-white py-2 pl-9 pr-9 text-[13px] text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} aria-label="Clear search"
                      className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
                <X size={13} aria-hidden="true" />
              </button>
            )}
          </div>

          <SearchableSelect
            value={industryFilter}
            onChange={setIndustryFilter}
            options={[{ value: 'all', label: 'All Industries' }, ...industryOptions.map((i) => ({ value: i, label: i }))]}
            placeholder="Industry"
            searchPlaceholder="Search industry…"
          />
          <SearchableSelect
            value={countryFilter}
            onChange={setCountryFilter}
            options={[{ value: 'all', label: 'All Countries' }, ...countryOptions.map((c) => ({ value: c, label: `${COUNTRY_FLAGS[c]?.flag || '🌍'} ${c}` }))]}
            placeholder="Country"
            searchPlaceholder="Search country…"
          />
          <SearchableSelect
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'all',       label: 'All Statuses' },
              { value: 'Active',    label: 'Active' },
              { value: 'Trial',     label: 'Trial' },
              { value: 'Suspended', label: 'Suspended' },
              { value: 'Cancelled', label: 'Cancelled' },
            ]}
            placeholder="Status"
          />
          <SearchableSelect
            value={healthFilter}
            onChange={setHealthFilter}
            options={[
              { value: 'all',      label: 'All Health' },
              { value: 'healthy',  label: 'Healthy (80+)' },
              { value: 'at-risk',  label: 'At Risk (50–79)' },
              { value: 'critical', label: 'Critical (<50)' },
            ]}
            placeholder="Health Score"
          />
          <SearchableSelect
            value={managerFilter}
            onChange={setManagerFilter}
            options={[{ value: 'all', label: 'All Account Managers' }, ...managerOptions.map((m) => ({ value: m, label: m }))]}
            placeholder="Account Manager"
            searchPlaceholder="Search manager…"
          />
        </div>
        {hasFilters && (
          <div className="mt-3 flex items-center gap-3">
            <span className="text-[11px] text-slate-500">
              Showing {filtered.length} of {enriched.length} organisations
            </span>
            <button type="button" onClick={clearFilters}
                    className="cursor-pointer rounded-[8px] border border-slate-200 bg-white px-3 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-50"
                    title="Clear all filters">
              Clear filters
            </button>
          </div>
        )}
      </div>

      {showAdd && (
        <AddOrgDrawer
          open
          currentUser={currentUser}
          onClose={() => setShowAdd(false)}
          onCreated={() => setShowAdd(false)}
        />
      )}

      {/* Deep management table */}
      <div className="overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-sm">
        {/* Desktop table */}
        <div className="hidden lg:block w-full overflow-hidden">
          <table className="w-full table-fixed border-collapse text-left text-[12px]">
            <thead className="bg-slate-50">
              <tr>
                {[
                  { label: '#', cls: 'w-[42px]' },
                  { label: 'Organisation', cls: 'w-[20%]' },
                  { label: 'Industry', cls: 'hidden 2xl:table-cell w-[12%]' },
                  { label: 'Country', cls: 'hidden xl:table-cell w-[70px]' },
                  { label: 'Plan', cls: 'w-[90px]' },
                  { label: 'Users', cls: 'w-[100px]' },
                  { label: 'Offices', cls: 'w-[100px]' },
                  { label: 'Storage', cls: 'w-[120px]' },
                  { label: 'Health', cls: 'w-[75px]' },
                  { label: 'Status', cls: 'w-[85px]' },
                  { label: 'Manager', cls: 'hidden 2xl:table-cell w-[120px]' },
                  { label: 'Activity', cls: 'hidden xl:table-cell w-[95px]' },
                  { label: 'Actions', cls: 'w-[82px]' },
                ].map((h) => (
                  <th key={h.label} className={`${h.cls} px-2 py-3 text-[10px] font-bold uppercase tracking-[0.04em] text-slate-500 whitespace-nowrap`}>{h.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 && (
                <tr><td colSpan={13} className="px-3 py-10 text-center text-sm text-slate-400">No organisations match the current filters.</td></tr>
              )}
              {filtered.map((o, idx) => {
                const usersPct   = Math.min(100, Math.round((Number(o.users) || 0) / o.limits.users * 100));
                const storagePct = Math.min(100, Math.round((o.storageGb / o.limits.storageGb) * 100));
                const officesPct = Math.min(100, Math.round((o.offices / o.limits.offices) * 100));
                const flag = COUNTRY_FLAGS[o.country] || { code: '—', flag: '🌍' };
                const suspended  = o.status === 'Suspended';
                const isNew = o.createdAt && (Date.now() - o.createdAt) < 48 * 3600 * 1000;
                return (
                  <tr key={o.id} className="hover:bg-slate-50 transition">
                    <td className="px-2 py-3 text-slate-400 font-semibold">{idx + 1}</td>
                    <td className="px-2 py-3">
                      <button type="button"
                              onClick={() => onOpenOrg?.(o)}
                              title={`Open ${o.name}`}
                              className="inline-flex min-w-0 items-center gap-2 cursor-pointer text-left">
                        <span className="hidden xl:inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[8px] border border-sky-200 bg-sky-50 text-sky-700">
                          <Building2 size={14} aria-hidden="true" />
                        </span>
                        <span className="min-w-0">
                          <span className="flex min-w-0 items-center gap-2 truncate text-[12px] font-bold text-[#0C2340] hover:text-sky-700">
                            {o.name}
                            {isNew && (
                              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-emerald-700">
                                New
                              </span>
                            )}
                          </span>
                          <span className="block text-[11px] text-slate-400">{o.location || '—'}</span>
                        </span>
                      </button>
                    </td>
                    <td className="hidden 2xl:table-cell px-2 py-3 text-slate-600 truncate">{o.industry || '—'}</td>
                    <td className="hidden xl:table-cell px-2 py-3 text-slate-600">
                      <span className="inline-flex items-center gap-1.5" title={o.country}>
                        <span aria-hidden="true">{flag.flag}</span>
                        <span className="font-semibold">{flag.code}</span>
                      </span>
                    </td>
                    <td className="px-2 py-3"><StatusPill status={o.plan} /></td>
                    <td className="px-2 py-3 text-slate-600">
                      <MeterCell value={`${formatNumber(o.users || 0)} / ${formatNumber(o.limits.users)}`} pct={usersPct} />
                    </td>
                    <td className="px-2 py-3 text-slate-600">
                      <MeterCell value={`${o.offices} / ${o.limits.offices}`} pct={officesPct} />
                    </td>
                    <td className="px-2 py-3 text-slate-600">
                      <MeterCell value={`${o.storageGb} GB / ${o.limits.storageGb} GB`} pct={storagePct} />
                    </td>
                    <td className="px-2 py-3"><HealthPill score={o.healthScore} /></td>
                    <td className="px-2 py-3"><StatusPill status={o.status} /></td>
                    <td className="hidden 2xl:table-cell px-2 py-3 text-slate-600 text-[12px] truncate">{o.accountManager}</td>
                    <td className="hidden xl:table-cell px-2 py-3 text-slate-500 text-[12px] truncate">{relativeTime(o.lastActivity)}</td>
                    <td className="px-2 py-3">
                      <div className="grid grid-cols-2 gap-1">
                        <IconBtn
                          Icon={LogIn} tone="violet"
                          title={`Impersonate a Director of ${o.name}`}
                          onClick={() => onImpersonate?.(o)}
                        />
                        <IconBtn
                          Icon={Eye} tone="slate"
                          title={`View ${o.name}'s details`}
                          onClick={() => onOpenOrg?.(o, 'account')}
                        />
                        <IconBtn
                          Icon={BarChart2} tone="slate"
                          title={`View ${o.name}'s usage report`}
                          onClick={() => onOpenOrg?.(o, 'usage')}
                        />
                        {suspended ? (
                          <IconBtn
                            Icon={PlayCircle} tone="emerald"
                            title={`Reactivate ${o.name}`}
                            onClick={() => onToggleSuspend?.(o, false)}
                          />
                        ) : (
                          <IconBtn
                            Icon={PauseCircle} tone="amber"
                            title={`Suspend ${o.name}`}
                            onClick={() => onToggleSuspend?.(o, true)}
                          />
                        )}
                        <IconBtn
                          Icon={Download} tone="slate"
                          title={`Export ${o.name}'s data for GDPR`}
                          onClick={() => onExport?.(o)}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile / tablet card view */}
        <div className="block lg:hidden divide-y divide-slate-100 dark:divide-[#142535]">
          {filtered.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-slate-400">No organisations match the current filters.</div>
          )}
          {filtered.map((o, idx) => {
            const usersPct   = Math.min(100, Math.round((Number(o.users) || 0) / o.limits.users * 100));
            const storagePct = Math.min(100, Math.round((o.storageGb / o.limits.storageGb) * 100));
            const officesPct = Math.min(100, Math.round((o.offices / o.limits.offices) * 100));
            const flag = COUNTRY_FLAGS[o.country] || { code: '—', flag: '🌍' };
            const suspended  = o.status === 'Suspended';
            const isNew = o.createdAt && (Date.now() - o.createdAt) < 48 * 3600 * 1000;
            return (
              <div key={o.id} className="px-4 py-4 hover:bg-slate-50 transition">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[8px] border border-sky-200 bg-sky-50 text-sky-700">
                      <Building2 size={14} aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <button type="button" onClick={() => onOpenOrg?.(o)} className="text-left">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-[14px] text-[#0C2340] hover:text-sky-700 break-words">{o.name}</span>
                          {isNew && <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-emerald-700">New</span>}
                        </div>
                        <div className="text-[11px] text-slate-400">{o.location || '—'}</div>
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <StatusPill status={o.status} />
                    <HealthPill score={o.healthScore} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-3 sm:grid-cols-3">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-0.5">Industry</div>
                    <div className="text-[12px] text-slate-600">{o.industry || '—'}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-0.5">Country</div>
                    <div className="text-[12px] text-slate-600 flex items-center gap-1"><span>{flag.flag}</span><span>{flag.code}</span></div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-0.5">Plan</div>
                    <StatusPill status={o.plan} />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-0.5">Users</div>
                    <MeterCell value={`${Number(o.users||0)} / ${o.limits.users}`} pct={usersPct} />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-0.5">Storage</div>
                    <MeterCell value={`${o.storageGb}GB / ${o.limits.storageGb}GB`} pct={storagePct} />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-0.5">Last Activity</div>
                    <div className="text-[12px] text-slate-500">{relativeTime(o.lastActivity)}</div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <IconBtn Icon={LogIn} tone="violet" title={`Impersonate ${o.name}`} onClick={() => onImpersonate?.(o)} />
                  <IconBtn Icon={Eye} tone="slate" title={`View ${o.name}`} onClick={() => onOpenOrg?.(o, 'account')} />
                  <IconBtn Icon={BarChart2} tone="slate" title={`Usage ${o.name}`} onClick={() => onOpenOrg?.(o, 'usage')} />
                  {suspended ? (
                    <IconBtn Icon={PlayCircle} tone="emerald" title={`Reactivate ${o.name}`} onClick={() => onToggleSuspend?.(o, false)} />
                  ) : (
                    <IconBtn Icon={PauseCircle} tone="amber" title={`Suspend ${o.name}`} onClick={() => onToggleSuspend?.(o, true)} />
                  )}
                  <IconBtn Icon={Download} tone="slate" title={`Export ${o.name}`} onClick={() => onExport?.(o)} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MeterCell({ value, pct }) {
  const toneCls = pct >= 85 ? 'bg-red-500' : pct >= 60 ? 'bg-amber-500' : 'bg-sky-500';
  return (
    <div>
      <div className="text-[12px] font-semibold text-slate-700">{value}</div>
      <div className="mt-1 h-1 w-16 rounded-full bg-slate-100 xl:w-20">
        <div className={`h-full rounded-full ${toneCls}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
