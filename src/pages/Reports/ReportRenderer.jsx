import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, Calendar, FileDown, Bell, ExternalLink, Building2,
  Users,
} from 'lucide-react';
import { SearchableSelect, Toast } from '../../components/ui';
import { datePresets, validateCustomDateRange } from '../../utils/guestLogAnalytics';
import { addDaysIso, todayIso } from '../../utils/appointmentState';
import { addAuditLog } from '../../utils/auditLogger';
import { useNotificationTriggers } from '../../utils/notificationTriggers';
import ReportExportDialog from './ReportExportDialog';

/**
 * ReportRenderer — shared chrome + orchestration for a single
 * report. Left side is the header (back / title / date range /
 * SuperAdmin toggle / Subscribe / Export). Body is summary KPIs +
 * chart block + table block. All three stages call into the
 * active report's definition (from `reportDefinitions.jsx`).
 *
 * Drill-down semantics:
 *   Level 1 — chart element click sets `tableFilter` which the
 *             active report's `renderTable` receives via ctx.
 *   Level 2 — "Open in Guest Log" header button navigates with
 *             query params pre-filled.
 *   Level 3 — appointment ID click inside the table opens the
 *             Appointments detail view via `?viewId=`.
 */

/* Compute {from, to} for the default ranges used by each report. */
function rangeFor(key) {
  const t = todayIso();
  switch (key) {
    case 'today':   return { from: t, to: t };
    case 'week':   {
      const d = new Date();
      const js = d.getDay();
      const monOffset = js === 0 ? -6 : 1 - js;
      const sunOffset = js === 0 ? 0 : 7 - js;
      const from = new Date(d); from.setDate(d.getDate() + monOffset);
      const to   = new Date(d); to.setDate(d.getDate() + sunOffset);
      return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
    }
    case 'last7':   return { from: addDaysIso(-6), to: t };
    case 'last30':  return { from: addDaysIso(-29), to: t };
    default:        return { from: '', to: '' };
  }
}

export default function ReportRenderer({
  definition, user, appointments, offices, staff, services, orgs, rooms,
  onBack, onNavigate,
}) {
  const isSuperAdmin = String(user?.role || '').toLowerCase() === 'superadmin';

  const initialRange = useMemo(() => rangeFor(definition?.defaultRange), [definition]);
  const [range, setRange]               = useState(definition?.defaultRange || 'last30');
  const [customStart, setCustomStart]   = useState(initialRange.from);
  const [customEnd, setCustomEnd]       = useState(initialRange.to);
  const [customError, setCustomError]   = useState('');
  const [tableFilter, setTableFilter]   = useState(null); /* { key, label, predicate } */
  const [superMode, setSuperMode]       = useState('combined'); /* 'combined' | 'per-tenant' */
  const [showExport, setShowExport]     = useState(false);
  const [generating, setGenerating]     = useState(false);
  const [toast, setToast]               = useState(null);
  const { fireReportReady }             = useNotificationTriggers();

  const showToast = (msg, type = 'success') => setToast({ msg, type });

  /* Sync range chips to custom inputs. */
  useEffect(() => {
    if (range === 'custom') return;
    const { from, to } = rangeFor(range);
    setCustomStart(from); setCustomEnd(to); setCustomError('');
  }, [range]);

  useEffect(() => {
    if (range !== 'custom') return;
    setCustomError(validateCustomDateRange(customStart, customEnd) || '');
  }, [range, customStart, customEnd]);

  /* Build the report data. Short 120ms skeleton for UX polish on
     heavier reports — callers with cached data render instantly. */
  const [data, setData] = useState(null);
  useEffect(() => {
    if (!definition || !definition.build) { setData(null); return; }
    if (range === 'custom' && customError) { setData(null); return; }
    setGenerating(true);
    const startedAt = performance.now();
    const ctx = {
      from: customStart, to: customEnd,
      date: range === 'today' ? customStart : undefined,
      offices, staff, services, rooms, orgs,
      officeById: new Map((offices || []).map((o) => [o?.id, o])),
    };
    const nextData = definition.build(appointments, ctx);
    const elapsed = performance.now() - startedAt;
    /* Dev-only perf tracer — flag reports taking >200ms so we can
       migrate to backend before production scale hits. */
    if (typeof window !== 'undefined' && window.console && elapsed > 200) {
      // eslint-disable-next-line no-console
      console.debug(`[ReportRenderer] ${definition.key} built in ${Math.round(elapsed)}ms on ${appointments.length} rows.`);
    }
    setData(nextData);
    window.setTimeout(() => setGenerating(false), Math.max(0, 120 - elapsed));
    /* Log generation for audit trail. */
    addAuditLog({
      userName:    user?.name || 'Unknown',
      role:        (user?.role || '').toString(),
      action:      'REPORT_GENERATED',
      module:      'Reports',
      description: `${definition.title} · ${customStart} → ${customEnd}${isSuperAdmin ? ` · super-mode=${superMode}` : ''}.`,
      orgId:       user?.organisationId || user?.orgId,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [definition?.key, customStart, customEnd, range, customError, appointments.length, superMode]);

  /* Per-tenant slice — only in SuperAdmin mode. Returns an array of
     { org, data } pairs, each built independently. */
  const perTenantData = useMemo(() => {
    if (!isSuperAdmin || superMode !== 'per-tenant' || !definition?.build) return null;
    if (range === 'custom' && customError) return null;
    const byOrgId = new Map();
    for (const a of appointments || []) {
      const oid = a?.orgId;
      if (!oid) continue;
      if (!byOrgId.has(oid)) byOrgId.set(oid, []);
      byOrgId.get(oid).push(a);
    }
    const orgs2 = orgs || [];
    return [...byOrgId.entries()]
      .map(([orgId, orgApts]) => {
        const org = orgs2.find((o) => o?.id === orgId);
        if (!org) return null;
        const ctx = {
          from: customStart, to: customEnd,
          date: range === 'today' ? customStart : undefined,
          offices, staff, services, rooms, orgs,
          officeById: new Map((offices || []).map((o) => [o?.id, o])),
        };
        return { org, data: definition.build(orgApts, ctx) };
      })
      .filter(Boolean);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [definition?.key, appointments, customStart, customEnd, customError, superMode, isSuperAdmin]);

  const tableCtx = useMemo(() => ({
    filterLabel: tableFilter?.label,
    onClearFilter: tableFilter ? () => setTableFilter(null) : undefined,
    onSelectAppointment: (apptId) => {
      addAuditLog({
        userName:    user?.name || 'Unknown',
        role:        (user?.role || '').toString(),
        action:      'REPORT_DRILL_DOWN',
        module:      'Reports',
        description: `${definition.title} → appointment ${apptId}.`,
        orgId:       user?.organisationId || user?.orgId,
      });
      onNavigate?.('appointments', { viewId: apptId });
    },
  }), [tableFilter, definition, user, onNavigate]);

  /* Shared chart ctx — chart components call setChartFilter with the
     full filter payload. Clicking the same slice again toggles it off. */
  const chartCtx = useMemo(() => ({
    tableFilter,
    setChartFilter: (next) => {
      if (!next) { setTableFilter(null); return; }
      if (tableFilter
          && tableFilter.field === next.field
          && tableFilter.value === next.value) {
        setTableFilter(null);          /* toggle off when re-clicked */
        return;
      }
      setTableFilter(next);
    },
    /* Legacy signature kept for any chart still using it. */
    onSliceClick: (label, predicate) => setTableFilter({ label, predicate }),
  }), [tableFilter]);

  /* Apply Level-1 chart-click filter against the underlying rows. */
  const filteredData = useMemo(() => {
    if (!data || !tableFilter?.predicate) return data;
    const sub = (data.rows || []).filter(tableFilter.predicate);
    return { ...data, rows: sub };
  }, [data, tableFilter]);

  if (!definition) {
    return (
      <div className="px-4 py-8">
        <p className="text-[13px] text-slate-500">Report not found.</p>
      </div>
    );
  }

  const openInGuestLog = () => {
    addAuditLog({
      userName:    user?.name || 'Unknown',
      role:        (user?.role || '').toString(),
      action:      'REPORT_DRILL_DOWN',
      module:      'Reports',
      description: `${definition.title} → Guest Log · ${customStart} to ${customEnd}.`,
      orgId:       user?.organisationId || user?.orgId,
    });
    onNavigate?.('guest-log', {
      from: customStart, to: customEnd,
      dateRange: 'custom',
    });
  };

  const handleSubscribe = () => {
    // eslint-disable-next-line no-console
    console.log(`[subscribe stub] report=${definition.key} user=${user?.name || '—'}`);
    showToast('Report subscriptions ship in Module 11.', 'info');
  };

  /* TODO Module 11 Settings — implement per-user report
     subscription preferences (frequency, format, delivery email).
     Requires Module 12 email dispatch infrastructure. */

  const rangeLabel = range === 'today'  ? 'Today'
                   : range === 'week'   ? 'This Week'
                   : range === 'last7'  ? 'Last 7 Days'
                   : range === 'last30' ? 'Last 30 Days'
                   : 'Custom';

  return (
    <div className="flex w-full flex-col gap-4">
      {/* Top bar */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <button type="button" onClick={onBack} title="Back to Reports"
            className="mb-2 inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-[#142535] dark:bg-[#0A1828] dark:text-slate-300">
            <ArrowLeft size={13} aria-hidden="true" /> Back to Reports
          </button>
          <h1 className="font-[Outfit,sans-serif] text-[22px] font-extrabold leading-tight text-[#0C2340] dark:text-slate-100">
            {definition.title}
          </h1>
          <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">
            {definition.description}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={handleSubscribe}
            title="Subscribe to this report"
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-[12px] font-bold text-slate-600 hover:bg-slate-50 dark:border-[#142535] dark:bg-[#0A1828] dark:text-slate-300">
            <Bell size={13} aria-hidden="true" /> Subscribe
          </button>
          <button type="button" onClick={openInGuestLog}
            title="Open in Guest Log with the same date range"
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-[12px] font-bold text-slate-600 hover:bg-slate-50 dark:border-[#142535] dark:bg-[#0A1828] dark:text-slate-300">
            <ExternalLink size={13} aria-hidden="true" /> Open in Guest Log
          </button>
          <button type="button" onClick={() => setShowExport(true)}
            title="Export this report"
            disabled={!data}
            className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-sky-700 bg-gradient-to-r from-sky-600 to-sky-800 px-4 py-2 text-[12px] font-bold text-white shadow-sm hover:from-sky-700 hover:to-sky-900 disabled:opacity-40">
            <FileDown size={13} aria-hidden="true" /> Export
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-[14px] border border-slate-200 bg-white p-3 shadow-sm dark:border-[#142535] dark:bg-[#0A1828]">
        <div className="inline-flex items-center gap-2 text-[12px] font-semibold text-slate-500 dark:text-slate-400">
          <Calendar size={13} aria-hidden="true" />
          Date Range
        </div>
        <div className="w-[180px]">
          <SearchableSelect value={range}
            onChange={(v) => setRange(v)}
            options={[
              { value: 'today',  label: 'Today' },
              { value: 'week',   label: 'This Week' },
              { value: 'last7',  label: 'Last 7 Days' },
              { value: 'last30', label: 'Last 30 Days' },
              { value: 'custom', label: 'Custom' },
            ]}
            placeholder="Range" />
        </div>
        {range === 'custom' && (
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              max={customEnd || undefined}
              className="rounded-[8px] border border-slate-200 bg-white px-2 py-1 font-mono text-[12px] text-slate-700 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-200" />
            <span className="text-[11px] text-slate-400">to</span>
            <input type="date" value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              min={customStart || undefined}
              max={todayIso()}
              className="rounded-[8px] border border-slate-200 bg-white px-2 py-1 font-mono text-[12px] text-slate-700 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-200" />
            <div className="flex flex-wrap gap-1">
              {datePresets().map((p) => (
                <button key={p.key} type="button"
                  onClick={() => { setCustomStart(p.start); setCustomEnd(p.end); }}
                  className="cursor-pointer rounded-[6px] border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700 hover:bg-sky-100 dark:border-sky-400/40 dark:bg-sky-500/15 dark:text-sky-300">
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {isSuperAdmin && (
          <div role="tablist" aria-label="SuperAdmin aggregation" className="ml-auto inline-flex rounded-[10px] border border-slate-200 bg-slate-50 p-0.5 dark:border-[#142535] dark:bg-[#071220]">
            <button type="button" role="tab" aria-selected={superMode === 'combined'}
              onClick={() => setSuperMode('combined')}
              className={`inline-flex cursor-pointer items-center gap-1 rounded-[8px] px-3 py-1 text-[11px] font-bold ${superMode === 'combined'
                ? 'bg-sky-700 text-white' : 'text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-[#0A1828]'}`}>
              <Users size={12} aria-hidden="true" /> Combined
            </button>
            <button type="button" role="tab" aria-selected={superMode === 'per-tenant'}
              onClick={() => setSuperMode('per-tenant')}
              className={`inline-flex cursor-pointer items-center gap-1 rounded-[8px] px-3 py-1 text-[11px] font-bold ${superMode === 'per-tenant'
                ? 'bg-sky-700 text-white' : 'text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-[#0A1828]'}`}>
              <Building2 size={12} aria-hidden="true" /> Per tenant
            </button>
          </div>
        )}
      </div>

      {customError && (
        <p role="alert" className="rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          {customError}
        </p>
      )}

      {/* Body */}
      {generating ? (
        <BuildingSkeleton />
      ) : !data ? (
        <EmptyReportState range={rangeLabel} />
      ) : (
        <>
          {/* KPI strip */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
            {definition.renderSummary?.(data, { rangeLabel })}
          </div>

          {/* SuperAdmin per-tenant: render one block per tenant. */}
          {isSuperAdmin && superMode === 'per-tenant' && perTenantData ? (
            <div className="flex flex-col gap-6">
              {perTenantData.length === 0 && (
                <div className="rounded-[10px] border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-[12px] text-slate-500 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-400">
                  No tenants with data in this window.
                </div>
              )}
              {perTenantData.map(({ org, data: orgData }) => (
                <section key={org.id} className="rounded-[14px] border border-slate-200 bg-white shadow-sm dark:border-[#142535] dark:bg-[#0A1828]">
                  <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3 dark:border-[#142535]">
                    <h3 className="inline-flex items-center gap-2 font-[Outfit,sans-serif] text-[13px] font-extrabold uppercase tracking-[0.08em] text-sky-700 dark:text-sky-300">
                      <Building2 size={13} aria-hidden="true" />
                      {org.name}
                    </h3>
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      {(orgData?.rows?.length || 0).toLocaleString('en-GB')} record{orgData?.rows?.length === 1 ? '' : 's'}
                    </span>
                  </header>
                  <div className="flex flex-col gap-4 p-5">
                    {definition.hasChart && (
                      <ChartFrame>
                        {definition.renderCharts?.(orgData, chartCtx)}
                      </ChartFrame>
                    )}
                    <div>
                      {definition.renderTable?.(orgData, tableCtx)}
                    </div>
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <>
              {/* Combined view — single chart + single table. */}
              {definition.hasChart && (
                <section className="rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm dark:border-[#142535] dark:bg-[#0A1828]">
                  <ChartFrame>
                    {definition.renderCharts?.(data, chartCtx)}
                  </ChartFrame>
                </section>
              )}
              <section className="rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm dark:border-[#142535] dark:bg-[#0A1828]">
                {definition.renderTable?.(filteredData, tableCtx)}
              </section>
            </>
          )}
        </>
      )}

      {showExport && (
        <ReportExportDialog
          open definition={definition} data={filteredData} rangeLabel={rangeLabel}
          from={customStart} to={customEnd}
          user={user} orgs={orgs}
          onClose={() => setShowExport(false)}
          onExported={({ format, rowCount, filename }) => {
            addAuditLog({
              userName:    user?.name || 'Unknown',
              role:        (user?.role || '').toString(),
              action:      'REPORT_EXPORTED',
              module:      'Reports',
              description: `${definition.title} · ${format} · ${rowCount} row(s) · ${filename}.`,
              orgId:       user?.organisationId || user?.orgId,
            });
            /* Module 7 — fire report ready notification + email preview. */
            const orgRecord = (orgs || []).find((o) => o.id === (user?.organisationId || user?.orgId)) || null;
            fireReportReady({
              reportTitle: definition.title,
              format,
              org:         orgRecord,
              requester:   { name: user?.name, email: user?.email },
            });
            showToast(`${format} export ${format === 'PDF' ? 'opened in print dialog' : 'downloaded'} successfully.`);
          }}
        />
      )}

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

/* ── Layout bits ───────────────────────────────────────────── */

function ChartFrame({ children }) {
  return <div className="w-full">{children}</div>;
}

function BuildingSkeleton() {
  const block = 'animate-pulse rounded-[14px] bg-slate-200/60 dark:bg-[#142535]';
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0,1,2,3].map((i) => <div key={i} className={`${block} h-[72px]`} />)}
      </div>
      <div className={`${block} h-[320px]`} />
      <div className={`${block} h-[260px]`} />
    </div>
  );
}

function EmptyReportState({ range }) {
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center gap-2 rounded-[14px] border border-dashed border-slate-200 bg-white text-center shadow-sm dark:border-[#142535] dark:bg-[#0A1828]">
      <span aria-hidden="true" className="text-[36px]">📊</span>
      <p className="font-[Outfit,sans-serif] text-[15px] font-extrabold text-[#0C2340] dark:text-slate-100">
        No data available for this report.
      </p>
      <p className="max-w-md text-[12px] text-slate-500 dark:text-slate-400">
        Data will populate as visitor activity accumulates. Try a broader date range — currently {range}.
      </p>
    </div>
  );
}
