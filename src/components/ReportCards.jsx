import React from 'react';

/**
 * Summary cards for the Reports dashboard.
 * Pure presentational — caller passes the numeric values.
 */

const TONES = {
  violet:  { bg: 'bg-sky-50',  ring: 'ring-sky-100',  text: 'text-sky-700',  accent: '#0284C7' },
  blue:    { bg: 'bg-blue-50',    ring: 'ring-blue-100',    text: 'text-blue-700',    accent: '#1D4ED8' },
  emerald: { bg: 'bg-emerald-50', ring: 'ring-emerald-100', text: 'text-emerald-700', accent: '#059669' },
  amber:   { bg: 'bg-amber-50',   ring: 'ring-amber-100',   text: 'text-amber-700',   accent: '#B45309' },
  slate:   { bg: 'bg-slate-50',   ring: 'ring-slate-100',   text: 'text-slate-700',   accent: '#475569' },
};

function Card({ label, value, tone, icon, sub }) {
  const t = TONES[tone] || TONES.violet;
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ${t.ring}`}>
      <div className="flex items-start justify-between gap-3">
        <div className={`inline-flex h-10 w-10 items-center justify-center rounded-lg text-lg ${t.bg} ${t.text}`}>
          <span aria-hidden="true">{icon}</span>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">
          ● Live
        </span>
      </div>
      <p className="mt-3 text-2xl font-extrabold text-slate-800">{value}</p>
      <p className="text-xs font-semibold text-slate-600">{label}</p>
      {sub && <p className="mt-0.5 text-[11px] text-slate-400">{sub}</p>}
    </div>
  );
}

export default function ReportCards({ stats }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <Card label="Total Visitors"      value={stats.visitors}          tone="violet"  icon="👥" sub="All-time guest log entries" />
      <Card label="Total Appointments"  value={stats.appointments}      tone="blue"    icon="📅" sub="Scheduled visits" />
      <Card label="Total Services"      value={stats.services}          tone="slate"   icon="🛎️" sub="All service requests" />
      <Card label="Completed Services"  value={stats.completedServices} tone="emerald" icon="✅" sub="Delivered in full" />
      <Card label="Pending Services"    value={stats.pendingServices}   tone="amber"   icon="⏳" sub="Awaiting action" />
    </div>
  );
}
