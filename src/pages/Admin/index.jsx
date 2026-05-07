import React, { useEffect, useMemo, useState } from 'react';
import { MOCK_ORGANIZATIONS, PLATFORM_METRICS, CRITICAL_ALERTS, SUPPORT_TICKETS, MOCK_ACCESS_REQUESTS } from '../../data/mockData';
import { safeGet } from '../../utils/storage';
import { AUDIT_LOGS_UPDATED_EVENT } from '../../utils/auditLogger';
import { formatAed, formatNumber, formatPercent } from '../../utils/format';
import { Toast } from '../../components/ui';
import { useCollection, STORAGE_KEYS } from '../../store';
import { addAuditLog } from '../../utils/auditLogger';
import { startImpersonation } from '../../utils/impersonate';
import { useAuth } from '../../context/AuthContext';
import NoAccess from '../../components/NoAccess';
import OrgManagementTab, { enrichOrgForManagement } from './OrgManagementTab';
import OrgManagementDrawer from './OrgManagementDrawer';

const safeLower = (value) => (value ?? '').toString().toLowerCase();
const safeText  = (value, fallback = '—') => (value ?? fallback);
const safeArray = (value) => (Array.isArray(value) ? value : []);
const safeStatus = (value, fallback = 'Active') => (value ?? fallback);

/* ── Badge ── */
function Badge({ label, variant = 'default' }) {
  const styles = {
    enterprise:   { bg: '#E0F2FE', color: '#0D9488', border: '#7DD3FC' },
    professional: { bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' },
    starter:      { bg: '#F0FDF4', color: '#15803D', border: '#BBF7D0' },
    trial:        { bg: '#FFF7ED', color: '#C2410C', border: '#FED7AA' },
    active:       { bg: '#ECFDF5', color: '#15803D', border: '#86EFAC' },
    suspended:    { bg: '#FEF2F2', color: '#DC2626', border: '#FCA5A5' },
    cancelled:    { bg: '#F3F4F6', color: '#374151', border: '#E5E7EB' },
    default:      { bg: '#E0F2FE', color: '#0284C7', border: '#BAE6FD' },
  };
  const s = styles[safeLower(label)] || styles[variant] || styles.default;
  return (
    <span
      className="inline-flex items-center text-[11px] font-bold px-2.5 py-1 rounded-full"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
    >
      {label}
    </span>
  );
}

/* Tabs kept after the dedup sweep — Subscriptions, Notifications, Settings,
 * and Booking Requests are delegated to their own dedicated modules. */
const TABS = [
  { id: 'overview',            label: 'Overview',           icon: '🏠' },
  { id: 'organizations',       label: 'Organisations',      icon: '🏢' },
  { id: 'support-tickets',     label: 'Support Tickets',    icon: '🎫' },
  { id: 'impersonation-log',   label: 'Impersonation Log',  icon: '🔐' },
];

export default function Admin({ setActivePage }) {
  /* Role gate — defence in depth. The RBAC matrix already denies
   * admin to every role except superadmin (see defaultPermissions.js),
   * and App.jsx wraps this route in RbacGate which renders NoAccess
   * when hasPermission('admin', 'view') is false. The inner body is
   * split into AdminBody so the gate can early-return without
   * violating the Rules of Hooks (all AdminBody hooks only run when
   * the gate passes). */
  const { user: authUser } = useAuth();
  const role = (authUser?.role || '').toLowerCase();
  if (role !== 'superadmin') {
    return <NoAccess module="Organisations Management" onGoBack={setActivePage ? () => setActivePage('dashboard') : undefined} />;
  }
  return <AdminBody setActivePage={setActivePage} />;
}

function AdminBody({ setActivePage }) {
  const { user: authUser, login } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [toast, setToast]         = useState(null);
  const [drawerOrg, setDrawerOrg] = useState(null);
  const [drawerTab, setDrawerTab] = useState('account');
  /* Bug 9 — read the live organisations collection so Recent Signups, the
     stat cards and the health buckets re-render whenever a new tenant is
     added. Previously the page kept reading the static MOCK seed. */
  const [orgsLive, , , , replaceOrgs] = useCollection(STORAGE_KEYS.ORGANIZATIONS, MOCK_ORGANIZATIONS);
  const liveOrgs = useMemo(
    () => (Array.isArray(orgsLive) && orgsLive.length ? orgsLive : MOCK_ORGANIZATIONS),
    [orgsLive],
  );
  const [accessRequests]          = useCollection(STORAGE_KEYS.ACCESS_REQUESTS, MOCK_ACCESS_REQUESTS);
  const pendingAccess             = useMemo(
    () => (accessRequests || []).filter((r) => r.status === 'Pending'),
    [accessRequests],
  );

  const showToast = (msg, type = 'success') => setToast({ msg, type });

  /* Row-click and most row actions open the drawer. initialTab routes
   * directly to the relevant section — e.g. clicking "Usage" in the
   * table jumps straight to the Usage tab. */
  const handleOpenOrg = (org, tab = 'account') => {
    setDrawerOrg(enrichOrgForManagement(org));
    setDrawerTab(tab);
  };
  const handleImpersonate = (org, userOverride) => {
    /* If the caller picked a specific Director from the Users tab,
     * use them; otherwise synthesise the org's primary Director. */
    const target = userOverride || {
      id:    `dir-${org.id}`,
      name:  'Arjun Mehta',
      email: `director@${(org.name || 'org').toLowerCase().replace(/\s+/g, '')}.com`,
      role:  'director',
    };
    const nextUser = startImpersonation({ operator: authUser, org, target });
    if (!nextUser) {
      showToast('Impersonation could not start — an existing session is already active.', 'error');
      return;
    }
    /* Swap the Auth context over; the banner picks up via sessionStorage. */
    login(nextUser);
    showToast(`Now viewing ${org.name} as ${nextUser.name} — banner at top ends the session.`, 'success');
    setDrawerOrg(null);
  };
  const handleToggleSuspend = (org, suspend) => {
    /* Persist the new status — status values we accept are
     * Active / Trial / Suspended / Cancelled. Case-preserved. */
    const nextStatus = suspend ? 'Suspended' : 'Active';
    replaceOrgs((prev) => (Array.isArray(prev) ? prev : []).map((o) => (o.id === org.id ? { ...o, status: nextStatus } : o)));
    addAuditLog({
      userName:    'Super Admin',
      role:        'superadmin',
      action:      suspend ? 'SUSPEND' : 'REACTIVATE',
      module:      'Organisations',
      description: `${suspend ? 'Suspended' : 'Reactivated'} ${org.name}.`,
      orgId:       org.id,
    });
    showToast(`${org.name} ${suspend ? 'suspended' : 'reactivated'} successfully.`);
  };
  const handleExport = (org) => {
    addAuditLog({
      userName:    'Super Admin',
      role:        'superadmin',
      action:      'DATA_EXPORT',
      module:      'Organisations',
      description: `Exported ${org.name} data (quick action).`,
      orgId:       org.id,
    });
    showToast(`${org.name} data export queued successfully.`);
  };

  const handleDeleteOrg = (org) => {
    replaceOrgs((prev) => (Array.isArray(prev) ? prev : []).filter((o) => o.id !== org.id));
    addAuditLog({
      userName:    'Super Admin',
      role:        'superadmin',
      action:      'DELETE',
      module:      'Organisations',
      description: `Permanently deleted ${org.name}.`,
      orgId:       org.id,
    });
    showToast(`${org.name} deleted successfully.`);
  };

  /* Live overview stats — every number derives from the shared seed data
   * so the Admin header, the Super Admin Dashboard, and Reports all share
   * one source of truth. Status comparison is case-insensitive because
   * the seed uses "Active" / "Trial" while older callers pass lowercase. */
  const overviewStats = useMemo(() => {
    const orgs = safeArray(liveOrgs);
    const activeOrgs = orgs.filter((o) => safeLower(o?.status) === 'active').length;
    const totalUsers = orgs.reduce((sum, o) => sum + (Number(o?.users) || 0), 0);
    return {
      activeOrgs,
      totalUsers,
      mrr:          Number(PLATFORM_METRICS?.mrr) || 0,
      uptime:       Number(PLATFORM_METRICS?.uptime) || 0,
      newThisMonth: Number(PLATFORM_METRICS?.newThisMonth) || 0,
    };
  }, [liveOrgs]);

  /* Bug 9 — recent signups derive from the live collection (createdAt /
     id-suffix sort), so adding an organisation via the Add Org drawer
     causes the panel to refresh without a page reload. */
  const recentSignups = useMemo(() => {
    const orgs = safeArray(liveOrgs);
    const sorted = [...orgs].sort((a, b) => {
      const at = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bt = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (bt !== at) return bt - at;
      const ai = parseInt(String(a?.id || '').replace(/\D/g, ''), 10) || 0;
      const bi = parseInt(String(b?.id || '').replace(/\D/g, ''), 10) || 0;
      return bi - ai;
    });
    return sorted.slice(0, 5);
  }, [liveOrgs]);

  const healthBuckets = useMemo(() => {
    const orgs = safeArray(liveOrgs);
    const failedPaymentOrgs = new Set(CRITICAL_ALERTS?.failedPayments?.orgs || []);
    const renewalRiskOrgs   = new Set(CRITICAL_ALERTS?.renewalRisks?.orgs   || []);
    const trialsEndingOrgs  = new Set(CRITICAL_ALERTS?.trialsExpiring?.orgs || []);

    let healthy = 0, atRisk = 0, critical = 0;
    for (const o of orgs) {
      const status = safeLower(o?.status);
      if (status === 'cancelled' || failedPaymentOrgs.has(o?.name)) { critical += 1; continue; }
      if (renewalRiskOrgs.has(o?.name) || trialsEndingOrgs.has(o?.name)) { atRisk += 1; continue; }
      if (status === 'active' || status === 'trial') { healthy += 1; continue; }
    }
    return { healthy, atRisk, critical };
  }, [liveOrgs]);

  const pendingActions = useMemo(() => [
    { label: 'Failed payments requiring follow-up', count: Number(CRITICAL_ALERTS?.failedPayments?.count || 0), tone: 'red'   },
    { label: 'Renewal risks this month',             count: Number(CRITICAL_ALERTS?.renewalRisks?.count   || 0), tone: 'amber' },
    { label: 'Trials expiring in the next 7 days',    count: Number(CRITICAL_ALERTS?.trialsExpiring?.count  || 0), tone: 'blue'  },
  ], []);

  return (
    <div className="w-full min-w-0 overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8 bg-slate-50 min-h-full">

      {/* Header — Super Admin role is already visible in the sidebar
           user card + topbar profile dropdown, so no redundant pill here. */}
      <div className="mb-6">
        <h2 className="font-[Outfit,sans-serif] text-[20px] font-extrabold text-[#0C2340]">
          Organisations Management
        </h2>
        <p className="mt-1 text-[13px] text-slate-400">
          Manage customer accounts, users, and tenant-level operations
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 mb-6 bg-white border border-slate-200 rounded-[12px] p-1 w-fit shadow-sm">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-[8px] text-[12px] font-semibold transition relative"
            style={{
              background: activeTab === t.id ? '#0284C7' : 'transparent',
              color:      activeTab === t.id ? 'white'   : '#64748B',
            }}
          >
            <span aria-hidden="true">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {activeTab === 'overview' && (
        <div>
          {/* Stat cards — driven by PLATFORM_METRICS + MOCK_ORGANIZATIONS so
               the figures match the Dashboard and Subscription modules exactly. */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Active Organisations', val: formatNumber(overviewStats.activeOrgs), icon: '🏢', sub: `${overviewStats.newThisMonth} new this month`,                                         color: '#0284C7' },
              { label: 'Total Platform Users', val: formatNumber(overviewStats.totalUsers), icon: '👥', sub: 'Across every tenant',                                                                 color: '#15803D' },
              { label: 'Monthly Revenue',      val: formatAed(overviewStats.mrr),           icon: '💰', sub: `${formatPercent(PLATFORM_METRICS?.mrrChangePct || 0)} vs last month`,                    color: '#B45309' },
              { label: 'System Uptime',        val: formatPercent(overviewStats.uptime, 2), icon: '⚡', sub: 'Last 30 days',                                                                          color: '#0369A1' },
            ].map(s => (
              <div key={s.label} className="bg-white border border-slate-200 rounded-[14px] shadow-sm hover:shadow-md transition p-5 relative overflow-hidden">
                <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ background: `radial-gradient(circle at top right, ${s.color}, transparent 60%)` }} />
                <div className="flex justify-between items-start mb-3">
                  <div className="text-2xl" aria-hidden="true">{s.icon}</div>
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">↑</span>
                </div>
                <div className="font-[Outfit,sans-serif] text-[30px] font-extrabold leading-none mb-1" style={{ color: s.color }}>{s.val}</div>
                <div className="text-[12px] font-semibold text-slate-600 mb-0.5">{s.label}</div>
                <div className="text-[11px] text-slate-400">{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Row 2 — Recent Signups + Pending Actions side by side. */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
            <div className="bg-white border border-slate-200 rounded-[14px] shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="font-[Outfit,sans-serif] text-[15px] font-extrabold text-[#0C2340]">Recent Signups</div>
                <span className="text-[11px] text-slate-400">Last 5 organisations</span>
              </div>
              <ul className="divide-y divide-slate-100">
                {recentSignups.length === 0 && (
                  <li className="px-5 py-6 text-center text-[12px] text-slate-400">No organisations yet.</li>
                )}
                {recentSignups.map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <button
                      type="button"
                      onClick={() => setActiveTab('organizations')}
                      title={`Open ${o.name} in the Organisations tab`}
                      className="min-w-0 flex-1 text-left cursor-pointer"
                    >
                      <div className="truncate text-[13px] font-semibold text-[#0C2340] hover:text-sky-700">{o.name}</div>
                      <div className="truncate text-[11px] text-slate-400">{safeText(o.plan)} · {safeText(o.country)}</div>
                    </button>
                    <Badge label={safeStatus(o.status, 'Active')} />
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white border border-slate-200 rounded-[14px] shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="font-[Outfit,sans-serif] text-[15px] font-extrabold text-[#0C2340]">Pending Actions</div>
                <span className="text-[11px] text-slate-400">Require attention</span>
              </div>
              <ul className="divide-y divide-slate-100">
                {pendingActions.map((a) => {
                  const toneCls = {
                    red:   'bg-red-50 text-red-700 border-red-200',
                    amber: 'bg-amber-50 text-amber-700 border-amber-200',
                    blue:  'bg-blue-50 text-blue-700 border-blue-200',
                  }[a.tone];
                  return (
                    <li key={a.label} className="flex items-center justify-between gap-3 px-5 py-3">
                      <span className="text-[13px] text-slate-700">{a.label}</span>
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${a.count > 0 ? toneCls : 'border-slate-200 bg-slate-50 text-slate-400'}`}>
                        {formatNumber(a.count)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          {/* Critical Alerts — pending access requests (gated B2B onboarding). */}
          {pendingAccess.length > 0 && (
            <div className="mb-6 rounded-[14px] border border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 px-5 py-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span aria-hidden="true" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-[18px]">⏳</span>
                  <div className="min-w-0">
                    <div className="font-[Outfit,sans-serif] text-[15px] font-extrabold text-amber-900">
                      {pendingAccess.length} pending access request{pendingAccess.length === 1 ? '' : 's'}.
                    </div>
                    <div className="mt-1 truncate text-[12px] text-amber-700">
                      {pendingAccess.slice(0, 3).map((r) => r.orgName).join(', ')}{pendingAccess.length > 3 ? ` and ${pendingAccess.length - 3} more` : ''}.
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActivePage?.('access-requests')}
                  title="Open the Access Requests inbox"
                  className="cursor-pointer rounded-[10px] border border-amber-700 bg-amber-700 px-4 py-2 text-[12px] font-bold text-white shadow-sm transition hover:bg-amber-800"
                >
                  Review Requests →
                </button>
              </div>
            </div>
          )}

          {/* Row 3 — Organisation health indicators. */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="rounded-[14px] border border-emerald-200 bg-emerald-50 px-5 py-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">Healthy</div>
                  <div className="mt-1 font-[Outfit,sans-serif] text-[28px] font-black text-emerald-800 leading-none">{formatNumber(healthBuckets.healthy)}</div>
                </div>
                <span aria-hidden="true" className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-[18px]">✓</span>
              </div>
              <p className="mt-2 text-[11px] text-emerald-700/80">Paying on time with usage in range.</p>
            </div>
            <div className="rounded-[14px] border border-amber-200 bg-amber-50 px-5 py-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wide text-amber-700">At Risk</div>
                  <div className="mt-1 font-[Outfit,sans-serif] text-[28px] font-black text-amber-800 leading-none">{formatNumber(healthBuckets.atRisk)}</div>
                </div>
                <span aria-hidden="true" className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-[18px]">!</span>
              </div>
              <p className="mt-2 text-[11px] text-amber-700/80">Upcoming renewal issues or low usage.</p>
            </div>
            <div className="rounded-[14px] border border-red-200 bg-red-50 px-5 py-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wide text-red-700">Critical</div>
                  <div className="mt-1 font-[Outfit,sans-serif] text-[28px] font-black text-red-800 leading-none">{formatNumber(healthBuckets.critical)}</div>
                </div>
                <span aria-hidden="true" className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-700 text-[18px]">⚠</span>
              </div>
              <p className="mt-2 text-[11px] text-red-700/80">Failed payments or cancelled accounts.</p>
            </div>
          </div>

          {/* Recent Orgs Table — desktop only */}
          <div className="bg-white border border-slate-200 rounded-[14px] shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <div className="font-[Outfit,sans-serif] text-[15px] font-extrabold text-[#0C2340]">Recent Organisations</div>
            </div>
            {/* Desktop table */}
            <div className="hidden lg:block w-full">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    {['Organisation', 'Plan', 'Users', 'Country', 'MRR', 'Status', 'Actions'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-slate-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {safeArray(MOCK_ORGANIZATIONS).slice(0, 5).map((o, idx) => (
                    <tr key={o?.id ?? idx} className="border-t border-slate-100 hover:bg-slate-50 transition">
                      <td className="px-3 py-2.5 text-[12px] font-semibold text-[#0C2340]">{safeText(o?.name)}</td>
                      <td className="px-3 py-2.5"><Badge label={safeText(o?.plan)} /></td>
                      <td className="px-3 py-2.5 font-mono text-[12px] text-slate-600">{safeText(o?.users, 0)}</td>
                      <td className="px-3 py-2.5 text-[12px] text-slate-600">{safeText(o?.country)}</td>
                      <td className="px-3 py-2.5 text-[12px] font-semibold text-emerald-600">{formatAed(Number(o?.mrr) || 0)}</td>
                      <td className="px-3 py-2.5"><Badge label={safeStatus(o?.status, 'Active')} /></td>
                      <td className="px-3 py-2.5">
                        <button
                          type="button"
                          onClick={() => setActiveTab('organizations')}
                          title="Open the full Organisations table"
                          className="px-3 py-1.5 rounded-[8px] border border-slate-200 bg-white text-slate-600 text-[11px] font-semibold hover:bg-slate-50 transition">
                          Manage
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile cards */}
            <div className="lg:hidden grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
              {safeArray(MOCK_ORGANIZATIONS).slice(0, 5).map((o, idx) => (
                <div key={o?.id ?? idx} className="rounded-[12px] border border-slate-200 bg-white p-4" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-bold text-[#0C2340]">{safeText(o?.name)}</div>
                      <div className="mt-0.5 text-[11px] text-slate-400">{safeText(o?.country)}</div>
                    </div>
                    <Badge label={safeStatus(o?.status, 'Active')} />
                  </div>
                  <div className="grid grid-cols-2 gap-y-2 text-[12px] mb-3">
                    <div><div className="text-slate-400">Plan</div><div className="font-semibold"><Badge label={safeText(o?.plan)} /></div></div>
                    <div><div className="text-slate-400">Users</div><div className="font-mono font-semibold text-slate-600">{safeText(o?.users, 0)}</div></div>
                    <div><div className="text-slate-400">MRR</div><div className="font-semibold text-emerald-600">{formatAed(Number(o?.mrr) || 0)}</div></div>
                  </div>
                  <div className="flex justify-end">
                    <button type="button" onClick={() => setActiveTab('organizations')} className="px-3 py-1.5 rounded-[8px] border border-sky-200 bg-sky-50 text-sky-700 text-[11px] font-bold hover:bg-sky-100 transition">
                      Manage →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── ORGANISATIONS — deep management table with derived columns. ── */}
      {activeTab === 'organizations' && (
        <OrgManagementTab
          onOpenOrg={handleOpenOrg}
          onImpersonate={handleImpersonate}
          onToggleSuspend={handleToggleSuspend}
          onExport={handleExport}
          currentUser={authUser}
        />
      )}

      {/* ── SUPPORT TICKETS tab ── */}
      {activeTab === 'support-tickets' && <SupportTicketsTab />}

      {/* ── IMPERSONATION LOG tab ── */}
      {activeTab === 'impersonation-log' && <ImpersonationLogTab />}

      {/* Organisation management drawer — six tabs (Account / Users /
           Usage / Support / Data & Compliance / Danger Zone). */}
      <OrgManagementDrawer
        open={Boolean(drawerOrg)}
        org={drawerOrg}
        initialTab={drawerTab}
        onClose={() => setDrawerOrg(null)}
        onSuspend={(o)    => { handleToggleSuspend(o, true);  setDrawerOrg(null); }}
        onReactivate={(o) => { handleToggleSuspend(o, false); setDrawerOrg(null); }}
        onImpersonate={(o, u) => handleImpersonate(o, u)}
        onDelete={handleDeleteOrg}
      />

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
 *   Support Tickets tab — simple list + filters, seed-backed.
 * ═══════════════════════════════════════════════════════════════════ */
function SupportTicketsTab() {
  const [statusFilter, setStatusFilter]     = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [orgFilter, setOrgFilter]           = useState('all');
  const [openTicket, setOpenTicket]         = useState(null);

  const tickets = safeArray(SUPPORT_TICKETS);
  const orgOptions = useMemo(() => {
    const set = new Set();
    for (const t of tickets) if (t.org) set.add(t.org);
    return [...set].sort();
  }, [tickets]);

  const filtered = tickets.filter((t) => {
    if (statusFilter   !== 'all' && t.status   !== statusFilter)   return false;
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
    if (orgFilter      !== 'all' && t.org      !== orgFilter)      return false;
    return true;
  });

  const priorityCls = (p) => p === 'High'   ? 'border-red-200 bg-red-50 text-red-700'
                           : p === 'Normal' ? 'border-amber-200 bg-amber-50 text-amber-700'
                           :                  'border-slate-200 bg-slate-50 text-slate-600';
  const statusCls = (s) => s === 'Open'        ? 'border-red-200 bg-red-50 text-red-700'
                         : s === 'In Progress' ? 'border-blue-200 bg-blue-50 text-blue-700'
                         :                       'border-emerald-200 bg-emerald-50 text-emerald-700';

  return (
    <div className="space-y-4">
      <div className="rounded-[14px] border border-slate-200 bg-white p-3 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <select value={statusFilter}   onChange={(e) => setStatusFilter(e.target.value)}   className="rounded-[10px] border border-slate-200 bg-white py-2 px-3 text-[13px] text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100">
            <option value="all">All statuses</option>
            <option>Open</option><option>In Progress</option><option>Resolved</option>
          </select>
          <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="rounded-[10px] border border-slate-200 bg-white py-2 px-3 text-[13px] text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100">
            <option value="all">All priorities</option>
            <option>High</option><option>Normal</option><option>Low</option>
          </select>
          <select value={orgFilter}      onChange={(e) => setOrgFilter(e.target.value)}      className="rounded-[10px] border border-slate-200 bg-white py-2 px-3 text-[13px] text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100">
            <option value="all">All organisations</option>
            {orgOptions.map((o) => <option key={o}>{o}</option>)}
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-sm">
        <div className="w-full">
          <table className="w-full text-[13px]">
            <thead className="bg-slate-50">
              <tr>
                {['Ticket ID', 'Organisation', 'Subject', 'Priority', 'Status', 'Created', 'Actions'].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-400">No tickets match the current filters.</td></tr>
              )}
              {filtered.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2.5 font-mono text-[11px] font-semibold text-slate-700">{t.id}</td>
                  <td className="px-3 py-2.5 font-semibold text-[12px] text-[#0C2340]">{t.org}</td>
                  <td className="px-3 py-2.5 text-[12px] text-slate-600">{t.subject}</td>
                  <td className="px-4 py-3"><span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${priorityCls(t.priority)}`}>{t.priority}</span></td>
                  <td className="px-4 py-3"><span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusCls(t.status)}`}>{t.status}</span></td>
                  <td className="px-4 py-3 text-slate-500 text-[12px]">{new Date(t.created).toLocaleDateString('en-GB')}</td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => setOpenTicket(t)} title={`Open ticket ${t.id}`}
                            className="cursor-pointer rounded-[8px] border border-slate-200 bg-white px-3 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50">
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {openTicket && (
        <div role="dialog" aria-modal="true"
             style={{ position: 'fixed', inset: 0, zIndex: 9200, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
             onMouseDown={(e) => { if (e.target === e.currentTarget) setOpenTicket(null); }}>
          <div style={{ width: '100%', maxWidth: 560, maxHeight: '85vh', overflowY: 'auto', background: '#fff', borderRadius: 14, padding: 24 }}>
            <h3 className="m-0 text-[16px] font-extrabold text-[#0C2340]">{openTicket.id} — {openTicket.subject}</h3>
            <p className="mt-1 text-[12px] text-slate-400">{openTicket.org} · Opened {new Date(openTicket.created).toLocaleString('en-GB')}</p>
            <div className="mt-3 flex gap-2">
              <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${priorityCls(openTicket.priority)}`}>{openTicket.priority}</span>
              <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusCls(openTicket.status)}`}>{openTicket.status}</span>
            </div>
            <div className="mt-4 rounded-[10px] border border-slate-200 bg-slate-50 p-3 text-[12px] text-slate-600">
              Ticket thread will render here once the support backend is wired. For now this view shows
              metadata so the Super Admin can triage from the tab without a dedicated support tool.
            </div>
            <div className="mt-5 flex justify-end">
              <button type="button" onClick={() => setOpenTicket(null)}
                      className="cursor-pointer rounded-[10px] border border-slate-200 bg-white px-4 py-2 text-[12px] font-bold text-slate-700 hover:bg-slate-50">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
 *   Impersonation Log tab — read-only audit of start/end events.
 * ═══════════════════════════════════════════════════════════════════ */
function ImpersonationLogTab() {
  /* Pull live from the audit-log storage used by addAuditLog. We re-read
   * on every render via a tick so new entries appear when the operator
   * starts/ends impersonations inside the same session. */
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const onUpdate = () => setTick((n) => n + 1);
    window.addEventListener(AUDIT_LOGS_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(AUDIT_LOGS_UPDATED_EVENT, onUpdate);
  }, []);

  const entries = useMemo(() => {
    const all = safeArray(safeGet('audit_logs', []));
    return all
      .filter((e) => e && typeof e.action === 'string' && e.action.startsWith('IMPERSONATE'))
      .slice(0, 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const fmt = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('en-GB');
  };

  return (
    <div className="space-y-4">
      <div className="rounded-[12px] border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-800">
        <strong>Compliance log.</strong> Every Super Admin impersonation is recorded here with operator,
        target, organisation, and duration. Required for SOC 2 and ISO 27001 privileged-access audits.
      </div>

      <div className="overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-sm">
        <div className="w-full">
          <table className="w-full text-[13px]">
            <thead className="bg-slate-50">
              <tr>
                {['Timestamp', 'Event', 'Operator', 'Role', 'Organisation', 'Details'].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-400">
                  No impersonation events yet. Start one from the Organisations tab and it will appear here.
                </td></tr>
              )}
              {entries.map((e) => (
                <tr key={e.id || `${e.timestamp}-${e.action}`}>
                  <td className="px-4 py-3 text-slate-500 text-[12px]">{fmt(e.timestamp)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${e.action === 'IMPERSONATE_START'
                      ? 'border-amber-200 bg-amber-50 text-amber-700'
                      : 'border-slate-200 bg-slate-100 text-slate-600'}`}>
                      {e.action === 'IMPERSONATE_START' ? 'Started' : 'Ended'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-semibold text-[12px] text-[#0C2340]">{e.userName || '—'}</td>
                  <td className="px-4 py-3 text-slate-600 capitalize">{e.role || '—'}</td>
                  <td className="px-3 py-2.5 text-[12px] text-slate-600">{(() => {
                    const orgName = MOCK_ORGANIZATIONS.find((o) => o.id === e.orgId)?.name;
                    return orgName || e.orgId || '—';
                  })()}</td>
                  <td className="px-4 py-3 text-slate-600 text-[12px]">{e.description || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
