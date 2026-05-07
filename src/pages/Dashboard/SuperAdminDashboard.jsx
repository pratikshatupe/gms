import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import {
  Shield, AlertTriangle, AlertCircle, TrendingUp, Clock, CreditCard,
  UserPlus, ArrowUpRight, XCircle, CheckCircle2,
} from 'lucide-react';
import {
  MOCK_ORGANIZATIONS,
  PLATFORM_METRICS,
  MRR_HISTORY,
  CRITICAL_ALERTS,
  PLATFORM_ACTIVITY,
  GEO_DISTRIBUTION,
} from '../../data/mockData';

/* ─── Formatting helpers ─────────────────────────────────────────────── */
const fmtAED = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const fmtNum = (n) => Number(n || 0).toLocaleString('en-GB');
const fmtPct = (n) => `${Number(n || 0).toFixed(1)}%`;

/* ─── Presentational atoms ───────────────────────────────────────────── */
function Card({ children, className = '', onClick, title }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      title={title}
      className={`w-full text-left bg-white dark:bg-[#0A1828] border border-slate-200 dark:border-[#142535] rounded-[14px] shadow-sm transition ${onClick ? 'cursor-pointer hover:shadow-md hover:border-sky-300 dark:hover:border-sky-400/40' : ''} ${className}`}
    >
      {children}
    </Tag>
  );
}

function KpiCard({ label, value, sub, delta, tone = 'violet', onClick, title, Icon }) {
  const toneCls = {
    violet:  'text-sky-700 bg-sky-50 border-sky-100 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-400/20',
    emerald: 'text-emerald-700 bg-emerald-50 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20',
    blue:    'text-blue-700 bg-blue-50 border-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/20',
    amber:   'text-amber-700 bg-amber-50 border-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20',
    red:     'text-red-700 bg-red-50 border-red-100 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/20',
  }[tone];
  return (
    <Card onClick={onClick} title={title} className={`p-4 border-l-4 !border-l-${tone}-500`}>
      <div className={`inline-flex items-center gap-2 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${toneCls}`}>
        {Icon && <Icon size={12} aria-hidden="true" />}{label}
      </div>
      <div className="mt-2 font-[Outfit,sans-serif] text-[24px] font-black leading-none text-slate-800 dark:text-slate-100">{value}</div>
      {sub && <div className="mt-1 text-[12px] font-medium text-slate-500 dark:text-slate-400">{sub}</div>}
      {typeof delta === 'number' && (
        <div className={`mt-1 text-[11px] font-bold ${delta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
          {delta >= 0 ? '↑' : '↓'} {Math.abs(delta).toFixed(1)}% vs last month
        </div>
      )}
    </Card>
  );
}

function SectionTitle({ children, subtitle, action }) {
  return (
    <div className="flex items-end justify-between gap-3 flex-wrap mb-3">
      <div>
        <h2 className="font-[Outfit,sans-serif] text-[16px] font-extrabold text-[#0C2340] dark:text-slate-100 m-0">{children}</h2>
        {subtitle && <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5 m-0">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function ActivityIcon({ type }) {
  const config = {
    signup:  { Icon: UserPlus,       tone: 'text-blue-600 bg-blue-50 dark:bg-blue-500/10 dark:text-blue-300' },
    payment: { Icon: CheckCircle2,   tone: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-300' },
    failed:  { Icon: XCircle,        tone: 'text-red-600 bg-red-50 dark:bg-red-500/10 dark:text-red-300' },
    upgrade: { Icon: ArrowUpRight,   tone: 'text-sky-500 bg-sky-50 dark:bg-sky-500/10 dark:text-sky-300' },
    cancel:  { Icon: AlertCircle,    tone: 'text-slate-500 bg-slate-100 dark:bg-slate-500/10 dark:text-slate-300' },
  }[type] || { Icon: AlertCircle, tone: 'text-slate-500 bg-slate-100 dark:bg-slate-500/10 dark:text-slate-300' };
  const { Icon, tone } = config;
  return (
    <span className={`inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[10px] ${tone}`}>
      <Icon size={14} aria-hidden="true" />
    </span>
  );
}

/* ─── Main component ─────────────────────────────────────────────────── */
export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const m = PLATFORM_METRICS;

  const topOrgs = useMemo(() => {
    return [...MOCK_ORGANIZATIONS]
      .filter((o) => o.status !== 'Trial')
      .sort((a, b) => (Number(b.mrr) || 0) - (Number(a.mrr) || 0))
      .slice(0, 10);
  }, []);

  const planDistribution = useMemo(() => {
    const counts = { Starter: 0, Professional: 0, Enterprise: 0, Trial: 0 };
    for (const o of MOCK_ORGANIZATIONS) {
      if (o.status === 'Trial') { counts.Trial += 1; continue; }
      if (counts[o.plan] != null) counts[o.plan] += 1;
    }
    const total = Object.values(counts).reduce((s, v) => s + v, 0) || 1;
    const tones = { Starter: '#10B981', Professional: '#0EA5E9', Enterprise: '#D97706', Trial: '#2563EB' };
    return Object.entries(counts).map(([plan, count]) => ({
      plan, count, pct: Math.round((count / total) * 100), tone: tones[plan],
    }));
  }, []);

  const allClear =
    CRITICAL_ALERTS.failedPayments.count === 0 &&
    CRITICAL_ALERTS.trialsExpiring.count === 0 &&
    CRITICAL_ALERTS.renewalRisks.count === 0;

  const storagePct = Math.round((m.storageUsedGB / m.storageTotalGB) * 100);

  return (
    <div className="flex w-full min-w-0 flex-col bg-slate-50 dark:bg-[#050E1A] min-h-full">
      {/* Header */}
      <header className="mb-6">
        <h1 className="flex items-center gap-3 m-0 font-[Outfit,sans-serif] text-[22px] font-extrabold text-[#0C2340] dark:text-slate-100">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
            <Shield size={18} aria-hidden="true" />
          </span>
          Platform Overview
        </h1>
        <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">
          Cross-organisation visibility — SaaS business intelligence
        </p>
      </header>

      {/* ─── ROW 1 — Revenue KPIs ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard
          label="MRR" Icon={CreditCard}
          value={fmtAED(m.mrr)}
          sub={`+${fmtAED(m.lastMonthMrrDelta)} this month`}
          delta={m.mrrChangePct}
          tone="violet"
          onClick={() => navigate('/subscription')}
          title="Open Subscriptions — filtered by revenue"
        />
        <KpiCard
          label="ARR" Icon={TrendingUp}
          value={fmtAED(m.arr)}
          sub="Annualised run-rate"
          tone="blue"
          onClick={() => navigate('/subscription')}
          title="Open Subscriptions — annual view"
        />
        <KpiCard
          label="Growth Rate" Icon={ArrowUpRight}
          value={fmtPct(m.growthRate)}
          sub={`${m.newThisMonth} new this month`}
          tone="emerald"
          onClick={() => navigate('/subscription?status=Trial')}
          title="See new signups and trials"
        />
        <KpiCard
          label="Churn Rate" Icon={AlertCircle}
          value={fmtPct(m.churnRate)}
          sub={`${m.lostThisMonth} cancelled this month`}
          tone="red"
          onClick={() => navigate('/subscription?status=Cancelled')}
          title="Filter to cancelled organisations"
        />
      </div>

      {/* ─── ROW 2 — Critical Alerts ─── */}
      <SectionTitle subtitle="Items that need your attention right now.">Critical Alerts</SectionTitle>
      {allClear ? (
        <div className="mb-6 rounded-[14px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200 flex items-center gap-3">
          <CheckCircle2 size={18} aria-hidden="true" />
          <span className="text-[13px] font-semibold">All clear — nothing needs your attention.</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          {CRITICAL_ALERTS.failedPayments.count > 0 && (
            <Card className="p-4 border-l-4 !border-l-red-500">
              <div className="flex items-start gap-3">
                <AlertTriangle size={18} className="text-red-600 mt-0.5" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-bold text-red-700 dark:text-red-300">
                    {CRITICAL_ALERTS.failedPayments.count} failed payment{CRITICAL_ALERTS.failedPayments.count === 1 ? '' : 's'}
                  </div>
                  <div className="mt-0.5 text-[12px] text-slate-600 dark:text-slate-300">
                    {fmtAED(CRITICAL_ALERTS.failedPayments.amountAed)} outstanding · {CRITICAL_ALERTS.failedPayments.orgs.slice(0, 2).join(', ')}{CRITICAL_ALERTS.failedPayments.orgs.length > 2 ? ', …' : ''}
                  </div>
                  <button onClick={() => navigate('/subscription?issue=failed-payment')} title="Review failed payments"
                          className="mt-2 cursor-pointer rounded-[8px] border border-red-300 bg-white text-red-700 text-[11px] font-bold px-3 py-1.5 hover:bg-red-50 dark:bg-transparent dark:hover:bg-red-500/10">
                    Review Payments →
                  </button>
                </div>
              </div>
            </Card>
          )}

          {CRITICAL_ALERTS.trialsExpiring.count > 0 && (
            <Card className="p-4 border-l-4 !border-l-amber-500">
              <div className="flex items-start gap-3">
                <Clock size={18} className="text-amber-600 mt-0.5" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-bold text-amber-700 dark:text-amber-300">
                    {CRITICAL_ALERTS.trialsExpiring.count} trial{CRITICAL_ALERTS.trialsExpiring.count === 1 ? '' : 's'} expiring
                  </div>
                  <div className="mt-0.5 text-[12px] text-slate-600 dark:text-slate-300">
                    {CRITICAL_ALERTS.trialsExpiring.orgs.join(', ')}
                  </div>
                  <button onClick={() => navigate('/subscription?status=Trial')} title="Open trial organisations"
                          className="mt-2 cursor-pointer rounded-[8px] border border-amber-300 bg-white text-amber-700 text-[11px] font-bold px-3 py-1.5 hover:bg-amber-50 dark:bg-transparent dark:hover:bg-amber-500/10">
                    View Trials →
                  </button>
                </div>
              </div>
            </Card>
          )}

          {CRITICAL_ALERTS.renewalRisks.count > 0 && (
            <Card className="p-4 border-l-4 !border-l-red-500">
              <div className="flex items-start gap-3">
                <AlertCircle size={18} className="text-red-600 mt-0.5" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-bold text-red-700 dark:text-red-300">
                    {CRITICAL_ALERTS.renewalRisks.count} renewal risk{CRITICAL_ALERTS.renewalRisks.count === 1 ? '' : 's'}
                  </div>
                  <div className="mt-0.5 text-[12px] text-slate-600 dark:text-slate-300">
                    {CRITICAL_ALERTS.renewalRisks.orgs.join(', ')}
                  </div>
                  <button onClick={() => navigate('/subscription?issue=renewal-risk')} title="Open at-risk renewals"
                          className="mt-2 cursor-pointer rounded-[8px] border border-red-300 bg-white text-red-700 text-[11px] font-bold px-3 py-1.5 hover:bg-red-50 dark:bg-transparent dark:hover:bg-red-500/10">
                    Contact Accounts →
                  </button>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ─── ROW 3 — MRR trend chart ─── */}
      <Card className="p-5 mb-6">
        <SectionTitle subtitle={`Active orgs: ${fmtNum(m.activeOrgs)} (+${m.newThisMonth} new this month)`}>
          Monthly Recurring Revenue — last 6 months
        </SectionTitle>
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer>
            <AreaChart data={MRR_HISTORY}>
              <defs>
                <linearGradient id="mrrFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0EA5E9" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#0EA5E9" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" strokeOpacity={0.12} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'currentColor' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} tick={{ fontSize: 11, fill: 'currentColor' }} axisLine={false} tickLine={false} width={54} />
              <Tooltip formatter={(v) => fmtAED(v)} labelFormatter={(l) => `${l} 2026`} />
              <Area type="monotone" dataKey="mrr" stroke="#0EA5E9" strokeWidth={2.5}
                    fill="url(#mrrFill)" name="MRR" dot={{ r: 3, fill: '#0EA5E9' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* ─── ROW 4 — Plan Distribution + Top 10 Organisations ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        <Card className="p-5">
          <SectionTitle subtitle="Active tenants grouped by plan tier.">Plan Distribution</SectionTitle>
          <div className="space-y-3">
            {planDistribution.map((row) => (
              <div key={row.plan} className="flex items-center gap-3">
                <div className="w-28 text-[12px] font-semibold text-slate-700 dark:text-slate-200">{row.plan}</div>
                <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-[#142535] overflow-hidden">
                  <div style={{ width: `${row.pct}%`, background: row.tone, height: '100%' }} />
                </div>
                <div className="w-24 text-right text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  {row.count} ({row.pct}%)
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle
            subtitle="Sorted by monthly recurring revenue."
            action={<button onClick={() => navigate('/subscription')} title="Open Subscriptions"
                            className="cursor-pointer text-[12px] font-bold text-sky-700 dark:text-sky-300 hover:underline">View All →</button>}
          >
            Top 10 Organisations
          </SectionTitle>
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[280px] text-[13px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  <th className="pb-2 pr-3">Rank</th>
                  <th className="pb-2 pr-3">Organisation</th>
                  <th className="pb-2 pr-3">Plan</th>
                  <th className="pb-2">MRR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#142535]">
                {topOrgs.map((o, i) => (
                  <tr key={o.id} className="hover:bg-slate-50 dark:hover:bg-[#071220]">
                    <td className="py-2 pr-3 text-slate-400 font-semibold">#{i + 1}</td>
                    <td className="py-2 pr-3 font-semibold text-[#0C2340] dark:text-slate-100">{o.name}</td>
                    <td className="py-2 pr-3 text-slate-600 dark:text-slate-300">{o.plan}</td>
                    <td className="py-2 text-slate-700 dark:text-slate-200 font-semibold">{fmtAED(o.mrr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* ─── ROW 5 — Platform Health + Geographic Distribution ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        <Card className="p-5">
          <SectionTitle subtitle="Live platform health indicators.">
            <span className="flex items-center gap-2">
              Platform Health
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true" />LIVE
              </span>
            </span>
          </SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <HealthCell label="Uptime"        value={`${m.uptime.toFixed(2)}%`}   ok={m.uptime >= 99.9}       tooltip="Percentage of time the platform has been reachable this month." />
            <HealthCell label="API latency"   value={`${m.apiResponseMs} ms`}     ok={m.apiResponseMs <= 200} tooltip="Average response time across the REST API." />
            <HealthCell label="Error rate"    value={`${m.errorRate.toFixed(2)}%`} ok={m.errorRate <= 1}      tooltip="Share of API requests that returned 5xx responses." />
            <HealthCell label="Failed logins" value={fmtNum(m.failedLogins)}       ok={m.failedLogins < 300}  tooltip="Failed login attempts across every tenant today." />
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between text-[12px] font-semibold text-slate-600 dark:text-slate-300">
              <span>Storage</span>
              <span>{m.storageUsedGB.toFixed(1)} / {m.storageTotalGB} GB</span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-slate-100 dark:bg-[#142535]">
              <div className={`h-full rounded-full ${storagePct > 80 ? 'bg-red-500' : storagePct > 60 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                   style={{ width: `${storagePct}%` }} />
            </div>
            <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{storagePct}% used</div>
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle subtitle="Active tenants by country.">Geographic Distribution</SectionTitle>
          <div className="space-y-2">
            {GEO_DISTRIBUTION.map((g) => (
              <div key={g.country} className="flex items-center gap-3">
                <span className="text-[18px]" aria-hidden="true">{g.flag}</span>
                <div className="w-24 sm:w-40 text-[13px] font-semibold text-[#0C2340] dark:text-slate-100 min-w-0 truncate">{g.country}</div>
                <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-[#142535]">
                  <div className="h-full rounded-full bg-sky-500" style={{ width: `${g.pct}%` }} />
                </div>
                <div className="w-24 text-right text-[12px] font-semibold text-slate-500 dark:text-slate-400">
                  {g.count} ({g.pct}%)
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ─── ROW 6 — Recent platform activity ─── */}
      <Card className="p-5">
        <SectionTitle
          subtitle="Latest platform-level events from across every tenant."
          action={<button onClick={() => navigate('/audit-logs')} title="Open the audit log"
                          className="cursor-pointer text-[12px] font-bold text-sky-700 dark:text-sky-300 hover:underline">View All Activity →</button>}
        >
          Recent Activity
        </SectionTitle>
        <ul className="divide-y divide-slate-100 dark:divide-[#142535]">
          {PLATFORM_ACTIVITY.slice(0, 10).map((a, i) => (
            <li key={i} className="flex items-start gap-3 py-3">
              <ActivityIcon type={a.type} />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] text-slate-700 dark:text-slate-200">
                  <span className="font-bold">{a.org}</span> {a.detail}
                </div>
              </div>
              <span className="text-[11px] text-slate-400 dark:text-slate-500 flex-shrink-0">{a.at}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function HealthCell({ label, value, ok, tooltip }) {
  const tone = ok
    ? 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20'
    : 'text-red-700 bg-red-50 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/20';
  return (
    <div title={tooltip} className={`rounded-[10px] border p-3 ${tone}`}>
      <div className="text-[11px] font-semibold uppercase tracking-wide opacity-80 flex items-center gap-2">
        <span aria-hidden="true">●</span>{label}
      </div>
      <div className="mt-1 font-[Outfit,sans-serif] text-[18px] font-black leading-none">{value}</div>
    </div>
  );
}
