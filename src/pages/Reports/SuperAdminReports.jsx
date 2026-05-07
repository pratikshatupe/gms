import React, { useMemo, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Area, AreaChart,
} from 'recharts';
import { PLATFORM_METRICS, PLATFORM_TOP_ORGS, MRR_HISTORY, GEO_DISTRIBUTION } from '../../data/mockData';

const fmtAED   = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const fmtPct   = (n) => `${Number(n || 0).toFixed(1)}%`;
const fmtNum   = (n) => Number(n || 0).toLocaleString('en-GB');
const deltaPct = (now, prev) => (!prev ? 0 : Math.round(((now - prev) / prev) * 1000) / 10);

function Card({ children, className = '', onClick, title }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      title={title}
      className={`bg-white border border-slate-200 rounded-[14px] shadow-sm text-left w-full transition ${onClick ? 'cursor-pointer hover:shadow-md hover:border-sky-300' : ''} ${className}`}
    >
      {children}
    </Tag>
  );
}

function SectionHeader({ title, subtitle, id }) {
  return (
    <div className="mb-3" id={id}>
      <h2 className="font-[Outfit,sans-serif] text-[16px] font-extrabold text-[#0C2340]">{title}</h2>
      {subtitle && <p className="text-[12px] text-slate-500 mt-0.5">{subtitle}</p>}
    </div>
  );
}

function StatCard({ label, value, sub, delta, tone = 'violet', onClick, title }) {
  const toneCls = {
    violet:  'text-sky-700 bg-sky-50 border-sky-100',
    blue:    'text-blue-700 bg-blue-50 border-blue-100',
    amber:   'text-amber-700 bg-amber-50 border-amber-100',
    emerald: 'text-emerald-700 bg-emerald-50 border-emerald-100',
    red:     'text-red-700 bg-red-50 border-red-100',
    slate:   'text-slate-700 bg-slate-50 border-slate-100',
  }[tone];
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      title={title}
      className={`rounded-[14px] border p-4 shadow-sm w-full text-left ${toneCls} ${onClick ? 'cursor-pointer hover:shadow-md' : ''}`}
    >
      <div className="text-[11px] font-semibold uppercase tracking-wide opacity-80">{label}</div>
      <div className="mt-1 font-[Outfit,sans-serif] text-[24px] font-black leading-none">{value}</div>
      {sub && <div className="mt-1 text-[11px] font-medium opacity-70">{sub}</div>}
      {typeof delta === 'number' && (
        <div className={`mt-1 text-[11px] font-bold ${delta >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
          {delta >= 0 ? '↑' : '↓'} {Math.abs(delta).toFixed(1)}% vs last month
        </div>
      )}
    </Tag>
  );
}

function HealthPill({ label, value, target, format, lowerBetter = false, unit = '' }) {
  const ok = lowerBetter ? value <= target : value >= target;
  const amber = lowerBetter
    ? value <= target * 1.25
    : value >= target * 0.97;
  const tone = ok ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
              : amber ? 'text-amber-700 bg-amber-50 border-amber-200'
              : 'text-red-700 bg-red-50 border-red-200';
  const icon = ok ? '●' : amber ? '◐' : '●';
  return (
    <div className={`rounded-[12px] border p-4 shadow-sm ${tone}`}>
      <div className="text-[11px] font-semibold uppercase tracking-wide opacity-80 flex items-center gap-2">
        <span aria-hidden="true">{icon}</span>{label}
      </div>
      <div className="mt-1 font-[Outfit,sans-serif] text-[22px] font-black leading-none">{format(value)}{unit}</div>
      <div className="mt-1 text-[11px] font-medium opacity-70">Target: {format(target)}{unit}</div>
    </div>
  );
}

export default function SuperAdminReports({ exportAction }) {
  const m = PLATFORM_METRICS;
  const [sortKey, setSortKey] = useState('mrr');

  const mrrDelta     = deltaPct(m.mrr, m.mrrPrev);
  const signupsDelta = deltaPct(m.signups, m.signupsPrev);
  const arpuDelta    = deltaPct(m.arpu, m.arpuPrev);

  const orgs = useMemo(() => {
    const sorted = [...PLATFORM_TOP_ORGS];
    if (sortKey === 'usage') sorted.sort((a, b) => b.usage - a.usage);
    else sorted.sort((a, b) => b.mrr - a.mrr);
    return sorted;
  }, [sortKey]);

  const atRisk   = PLATFORM_TOP_ORGS.filter((o) => o.usage < 0.25 && o.status !== 'Trial').length;
  const trialExp = PLATFORM_TOP_ORGS.filter((o) => o.status === 'Trial').length;
  const failedP  = 2; /* Stub — wired to billing notifs in a later pass. */

  const totalPlans = m.planDistribution.reduce((sum, p) => sum + p.count, 0);
  const storagePct = Math.round((m.platformUsage.storageUsedGb / m.platformUsage.storageQuotaGb) * 100);

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 w-full">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:flex-wrap mb-6">
        <div>
          <h1 className="font-[Outfit,sans-serif] text-[20px] font-extrabold text-[#0C2340]">Platform Reports</h1>
          <p className="text-[13px] text-slate-500 mt-1">Revenue, tenants, usage, and health across every organisation.</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {['Export CSV', 'Export Excel', 'Export PDF'].map((l) => (
            <button key={l} title={l} onClick={() => exportAction?.(l)}
                    className="rounded-[10px] border border-slate-200 bg-white px-4 py-2 text-[12px] font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer">
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* ── Section 1: Revenue KPIs ── */}
      <SectionHeader title="Revenue" subtitle="Monthly recurring revenue, signup rate, churn, and ARPU." />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Monthly Recurring Revenue" value={fmtAED(m.mrr)} delta={mrrDelta} tone="violet" />
        <StatCard label="New Signups This Month" value={fmtNum(m.signups)} delta={signupsDelta} tone="emerald" />
        <StatCard label="Churn Rate" value={fmtPct(m.churn)} sub={`Target: ${fmtPct(m.churnTarget)} or lower`} tone={m.churn <= m.churnTarget ? 'emerald' : 'red'} />
        <StatCard label="Average Revenue per User" value={fmtAED(m.arpu)} delta={arpuDelta} tone="blue" />
      </div>

      {/* ── Section 2: MRR trend chart ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        <Card className="p-5">
          <div className="font-[Outfit] font-bold text-[#0C2340] text-[14px] mb-1">MRR — last 6 months</div>
          <div className="text-[11px] text-slate-400 mb-4">Monthly recurring revenue in INR</div>
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer>
              <AreaChart data={MRR_HISTORY}>
                <defs>
                  <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0EA5E9" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#0EA5E9" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={48} />
                <Tooltip formatter={(v) => fmtAED(v)} />
                <Area type="monotone" dataKey="mrr" stroke="#0EA5E9" strokeWidth={2.5} fill="url(#mrrGrad)" name="MRR" dot={{ r: 3, fill: '#0EA5E9' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* ── Section 3: Organisations overview + plan distribution ── */}
        <Card className="p-5">
          <div className="font-[Outfit] font-bold text-[#0C2340] text-[14px] mb-1">Organisations Overview</div>
          <div className="text-[11px] text-slate-400 mb-4">Lifecycle status and plan mix.</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
            <StatCard label="Active"    value={fmtNum(m.orgStatus.active)}    tone="emerald" />
            <StatCard label="Trial"     value={fmtNum(m.orgStatus.trial)}     tone="blue" />
            <StatCard label="Suspended" value={fmtNum(m.orgStatus.suspended)} tone="amber" />
            <StatCard label="Cancelled" value={fmtNum(m.orgStatus.cancelled)} tone="slate" />
          </div>
          <div className="space-y-2">
            {m.planDistribution.map((p) => {
              const pct = totalPlans > 0 ? Math.round((p.count / totalPlans) * 100) : 0;
              return (
                <div key={p.plan} className="flex items-center gap-3">
                  <div className="w-24 text-[12px] font-semibold text-slate-700">{p.plan}</div>
                  <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div style={{ width: `${pct}%`, background: p.tone, height: '100%' }} />
                  </div>
                  <div className="w-20 text-right text-[11px] font-semibold text-slate-500">{p.count} ({pct}%)</div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* ── Section 4: Top organisations table ── */}
      <Card className="p-5 mb-6">
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <div>
            <div className="font-[Outfit] font-bold text-[#0C2340] text-[14px]">Top 10 Organisations</div>
            <div className="text-[11px] text-slate-400">Sorted by {sortKey === 'mrr' ? 'MRR' : 'usage'}.</div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setSortKey('mrr')}   title="Sort by MRR"   className={`rounded-[10px] border px-3 py-1.5 text-[11px] font-semibold cursor-pointer ${sortKey === 'mrr' ? 'bg-sky-700 text-white border-sky-700' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>By MRR</button>
            <button onClick={() => setSortKey('usage')} title="Sort by usage" className={`rounded-[10px] border px-3 py-1.5 text-[11px] font-semibold cursor-pointer ${sortKey === 'usage' ? 'bg-sky-700 text-white border-sky-700' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>By Usage</button>
          </div>
        </div>
        {/* Desktop table */}
        <div className="hidden sm:block w-full overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                {['SR. No.', 'Organisation', 'Plan', 'MRR', 'Usage', 'Since', 'Status'].map((h) => (
                  <th key={h} className="pb-2 pr-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orgs.slice(0, 10).map((o, i) => (
                <tr key={o.id} className="hover:bg-slate-50 transition">
                  <td className="py-2 pr-3 text-slate-400 font-semibold">{i + 1}</td>
                  <td className="py-2 pr-3 font-semibold text-[#0C2340]">{o.name}</td>
                  <td className="py-2 pr-3 text-slate-600">{o.plan}</td>
                  <td className="py-2 pr-3 text-slate-700 font-semibold">{fmtAED(o.mrr)}</td>
                  <td className="py-2 pr-3 text-slate-600">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-slate-100"><div className="h-full rounded-full bg-sky-500" style={{ width: `${Math.round(o.usage * 100)}%` }} /></div>
                      <span className="text-[11px] font-bold text-sky-700">{Math.round(o.usage * 100)}%</span>
                    </div>
                  </td>
                  <td className="py-2 pr-3 text-slate-500 text-[12px] whitespace-nowrap">{new Date(o.since).toLocaleDateString('en-GB')}</td>
                  <td className="py-2 pr-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${o.status === 'Active' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : o.status === 'Trial' ? 'border-blue-200 bg-blue-50 text-blue-700' : o.status === 'Suspended' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-100 text-slate-500'}`}>{o.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Mobile cards */}
        <div className="block sm:hidden divide-y divide-slate-100 -mx-5">
          {orgs.slice(0, 10).map((o, i) => (
            <div key={o.id} className="px-5 py-3">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <div className="font-bold text-[13px] text-[#0C2340] break-words">{o.name}</div>
                  <div className="text-[11px] text-slate-400">{o.plan} · Since {new Date(o.since).toLocaleDateString('en-GB')}</div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${o.status === 'Active' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : o.status === 'Trial' ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-slate-100 text-slate-500'}`}>{o.status}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><div className="text-[10px] font-bold uppercase text-slate-400 mb-0.5">MRR</div><div className="text-[12px] font-semibold text-slate-700">{fmtAED(o.mrr)}</div></div>
                <div>
                  <div className="text-[10px] font-bold uppercase text-slate-400 mb-0.5">Usage</div>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-full rounded-full bg-slate-100"><div className="h-full rounded-full bg-sky-500" style={{ width: `${Math.round(o.usage * 100)}%` }} /></div>
                    <span className="text-[11px] font-bold text-sky-700 whitespace-nowrap">{Math.round(o.usage * 100)}%</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* ── Section 5: Churn & Risk ── */}
      <SectionHeader title="Churn & Risk" subtitle="Accounts that need attention in the next 30 days." />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <StatCard label="At-risk organisations" value={fmtNum(atRisk)}   sub="Low usage + renewal in 30 days" tone="amber" />
        <StatCard label="Trials expiring"        value={fmtNum(trialExp)} sub="This week"                       tone="blue" />
        <StatCard label="Failed payments"        value={fmtNum(failedP)}  sub="Require manual follow-up"         tone="red" />
      </div>

      {/* ── Section 6: Platform usage ── */}
      <SectionHeader title="Platform Usage" subtitle="Aggregate across all tenants — this month." />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <StatCard label="Visitors processed"   value={fmtNum(m.platformUsage.visitors)}      tone="violet" />
        <StatCard label="Appointments"         value={fmtNum(m.platformUsage.appointments)}  tone="blue" />
        <StatCard label="Platform peak hour"   value={m.platformUsage.peakHour}              tone="emerald" />
        <StatCard label="API calls"            value={fmtNum(m.platformUsage.apiCalls)}      tone="slate" />
        <Card className="p-4 border-slate-200">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Storage</div>
          <div className="mt-1 font-[Outfit,sans-serif] text-[18px] font-black text-slate-700">{m.platformUsage.storageUsedGb} / {m.platformUsage.storageQuotaGb} GB</div>
          <div className="mt-2 h-2 rounded-full bg-slate-100">
            <div className={`h-full rounded-full ${storagePct > 80 ? 'bg-red-500' : storagePct > 60 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${storagePct}%` }} />
          </div>
          <div className="mt-1 text-[11px] font-medium text-slate-400">{storagePct}% used</div>
        </Card>
      </div>

      {/* ── Section 7: Platform health — LIVE ── */}
      <div className="flex items-center gap-2 mb-3">
        <h2 className="font-[Outfit,sans-serif] text-[16px] font-extrabold text-[#0C2340]">Platform Health</h2>
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />LIVE
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <HealthPill label="Uptime"            value={m.platformHealth.uptime}          target={m.platformHealth.uptimeTarget}   format={(v) => v.toFixed(2)} unit="%" />
        <HealthPill label="Avg response time" value={m.platformHealth.avgResponseMs}   target={m.platformHealth.responseTarget} format={(v) => `${Math.round(v)}`} lowerBetter unit=" ms" />
        <HealthPill label="Error rate"        value={m.platformHealth.errorRate}       target={m.platformHealth.errorTarget}    format={(v) => v.toFixed(2)} lowerBetter unit="%" />
        <HealthPill label="Failed logins"     value={m.platformHealth.failedLogins}    target={300}                             format={(v) => fmtNum(v)} lowerBetter />
      </div>

      {/* ── Section 8: Geographic distribution ── */}
      <SectionHeader title="Geographic Distribution" subtitle="Organisations by country — UAE and India lead the platform." />
      <Card className="p-5 mb-8">
        <div className="w-full">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                <th className="pb-2 pr-3">SR. No.</th>
                <th className="pb-2 pr-3">Country</th>
                <th className="pb-2 pr-3">Organisations</th>
                <th className="pb-2">Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {GEO_DISTRIBUTION.map((g, i) => {
                const total = GEO_DISTRIBUTION.reduce((sum, x) => sum + x.count, 0);
                const pct = total > 0 ? Math.round((g.count / total) * 100) : 0;
                return (
                  <tr key={g.country}>
                    <td className="py-2 pr-3 text-slate-400 font-semibold">{i + 1}</td>
                    <td className="py-2 pr-3 font-semibold text-[#0C2340]">{g.country}</td>
                    <td className="py-2 pr-3 text-slate-700">{g.count}</td>
                    <td className="py-2">
                      <div className="flex items-center gap-3">
                        <div className="w-48 h-1.5 rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-sky-500" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[11px] font-bold text-sky-700 w-8">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
