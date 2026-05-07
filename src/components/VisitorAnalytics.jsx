import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell,
} from 'recharts';

function TooltipContent({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      {label && <div className="mb-1 text-[11px] font-semibold text-slate-500">{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="font-semibold" style={{ color: p.color || p.payload?.fill }}>
          {p.name}: <span className="text-slate-700">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

function StatTile({ label, value, tone = 'slate', hint }) {
  const toneCls = {
    violet:  'border-sky-100 bg-sky-50 text-sky-700',
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    amber:   'border-amber-100 bg-amber-50 text-amber-700',
    red:     'border-red-100 bg-red-50 text-red-700',
    slate:   'border-slate-100 bg-slate-50 text-slate-700',
  }[tone];
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${toneCls}`}>
      <p className="text-2xl font-extrabold leading-none">{value}</p>
      <p className="mt-1.5 text-[12px] font-semibold opacity-80">{label}</p>
      {hint && <p className="mt-0.5 text-[11px] opacity-70">{hint}</p>}
    </div>
  );
}

export function NoShowCancellationCard({ stats }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="mb-3">
        <h3 className="text-sm font-bold text-slate-800">Attendance Breakdown</h3>
        <p className="text-xs text-slate-500">
          Pre-appointed visits, walk-ins, cancellations and no-shows in the selected range
        </p>
      </header>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Pre-appointed"   value={stats.preAppt}       tone="violet" />
        <StatTile label="Walk-ins"        value={stats.walkIns}       tone="emerald" />
        <StatTile label="Completed"       value={stats.completed}     tone="emerald" />
        <StatTile label="Scheduled"       value={stats.scheduledAppts} tone="slate" />
        <StatTile
          label="No-shows"
          value={stats.noShow}
          tone="amber"
          hint={stats.scheduledAppts ? `${stats.noShowRate}% of scheduled` : null}
        />
        <StatTile
          label="Cancelled"
          value={stats.cancelled}
          tone="red"
          hint={stats.cancellationRate ? `${stats.cancellationRate}% of total` : null}
        />
      </div>
    </section>
  );
}

export function OfficeComparisonChart({ rows }) {
  const data = rows.slice(0, 10);
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="mb-3">
        <h3 className="text-sm font-bold text-slate-800">Office-wise Comparison</h3>
        <p className="text-xs text-slate-500">Visitor activity per office in the selected range</p>
      </header>
      <div className="h-72 w-full">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-slate-400">
            No visitor activity in the selected range.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEE" vertical={false} />
              <XAxis dataKey="office" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
              <Tooltip content={<TooltipContent />} cursor={{ fill: 'rgba(14,165,233,0.06)' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="visitors"     name="Visitors"     fill="#0284C7" radius={[6, 6, 0, 0]} />
              <Bar dataKey="walkIns"      name="Walk-ins"     fill="#10B981" radius={[6, 6, 0, 0]} />
              <Bar dataKey="appointments" name="Appointments" fill="#F59E0B" radius={[6, 6, 0, 0]} />
              <Bar dataKey="noShows"      name="No-shows"     fill="#EF4444" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}

export function VisitDurationCard({ stats }) {
  const hasData = stats.completedVisits > 0;
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="mb-3 flex items-baseline justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Visit Duration</h3>
          <p className="text-xs text-slate-500">
            Based on completed check-ins in the selected range
          </p>
        </div>
        <span className="text-[11px] font-semibold text-slate-500">
          {stats.completedVisits} completed visit{stats.completedVisits === 1 ? '' : 's'}
        </span>
      </header>
      {!hasData ? (
        <div className="flex min-h-[80px] items-center justify-center text-xs text-slate-400">
          No completed visits in the selected range.
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          <StatTile label="Shortest" value={formatMinutes(stats.shortestVisitMin)} tone="emerald" />
          <StatTile label="Average"  value={formatMinutes(stats.avgVisitMin)}      tone="violet" />
          <StatTile label="Longest"  value={formatMinutes(stats.longestVisitMin)}  tone="amber" />
        </div>
      )}
    </section>
  );
}

export function TopHostsCard({ rows }) {
  const max = rows.reduce((m, r) => Math.max(m, r.visitors), 0);
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="mb-3">
        <h3 className="text-sm font-bold text-slate-800">Top Hosts</h3>
        <p className="text-xs text-slate-500">Hosts ranked by visitor count in the selected range</p>
      </header>
      {rows.length === 0 ? (
        <div className="flex min-h-[80px] items-center justify-center text-xs text-slate-400">
          No visitor activity in the selected range.
        </div>
      ) : (
        <ol className="space-y-2">
          {rows.map((r, idx) => (
            <li key={r.host} className="flex items-center gap-3">
              <span className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-extrabold text-sky-700">
                {idx + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-slate-800">{r.host}</span>
                  <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">
                    {r.visitors} visit{r.visitors === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-sky-500"
                    style={{ width: max ? `${Math.round((r.visitors / max) * 100)}%` : '0%' }}
                  />
                </div>
                <p className="mt-0.5 text-[10px] text-slate-400">
                  {r.appointments} appointment{r.appointments === 1 ? '' : 's'} · {r.walkIns} walk-in{r.walkIns === 1 ? '' : 's'}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function formatMinutes(minutes) {
  if (minutes == null) return '—';
  if (minutes < 1) return '<1 min';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function complianceTone(rate) {
  if (rate == null) return 'slate';
  if (rate >= 90) return 'emerald';
  if (rate >= 70) return 'amber';
  return 'red';
}

export function ServiceSLAPanel({ sla }) {
  const hasData = sla.responded > 0 || sla.completed > 0;
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Service SLA &amp; Response Time</h3>
          <p className="text-xs text-slate-500">
            Targets: pick up within {sla.targets.responseMinutes} min · complete within {sla.targets.completionMinutes} min
          </p>
        </div>
        <span className="text-[11px] font-semibold text-slate-500">
          {sla.responded} started · {sla.completed} completed
        </span>
      </header>
      {!hasData ? (
        <div className="flex min-h-[80px] items-center justify-center text-xs text-slate-400">
          No service activity in the selected range.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile
            label="Avg response"
            value={formatMinutes(sla.avgResponseMin)}
            tone="violet"
            hint={sla.medianResponseMin != null ? `Median ${formatMinutes(sla.medianResponseMin)}` : null}
          />
          <StatTile
            label="Avg completion"
            value={formatMinutes(sla.avgCompletionMin)}
            tone="violet"
            hint={sla.medianCompletionMin != null ? `Median ${formatMinutes(sla.medianCompletionMin)}` : null}
          />
          <StatTile
            label="Avg turnaround"
            value={formatMinutes(sla.avgTurnaroundMin)}
            tone="slate"
            hint="Created → completed"
          />
          <StatTile
            label="Response SLA"
            value={sla.responseCompliance != null ? `${sla.responseCompliance}%` : '—'}
            tone={complianceTone(sla.responseCompliance)}
            hint={sla.responseBreaches ? `${sla.responseBreaches} breach${sla.responseBreaches === 1 ? '' : 'es'}` : null}
          />
          <StatTile
            label="Completion SLA"
            value={sla.completionCompliance != null ? `${sla.completionCompliance}%` : '—'}
            tone={complianceTone(sla.completionCompliance)}
            hint={sla.completionBreaches ? `${sla.completionBreaches} breach${sla.completionBreaches === 1 ? '' : 'es'}` : null}
          />
          <StatTile
            label="Total breaches"
            value={sla.responseBreaches + sla.completionBreaches}
            tone={sla.responseBreaches + sla.completionBreaches > 0 ? 'red' : 'emerald'}
          />
        </div>
      )}
    </section>
  );
}

export function PeakHoursChart({ buckets, peakHour }) {
  const hasActivity = buckets.some((b) => b.count > 0);
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Peak Hours</h3>
          <p className="text-xs text-slate-500">Visitor arrivals by hour of day</p>
        </div>
        {hasActivity && (
          <span className="text-[11px] font-semibold text-sky-700">
            Busiest hour: {peakHour.label} · {peakHour.count} visits
          </span>
        )}
      </header>
      <div className="h-64 w-full">
        {!hasActivity ? (
          <div className="flex h-full items-center justify-center text-xs text-slate-400">
            No visitor activity in the selected range.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={buckets} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEE" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: '#94A3B8' }}
                axisLine={false}
                tickLine={false}
                interval={1}
              />
              <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
              <Tooltip content={<TooltipContent />} cursor={{ fill: 'rgba(14,165,233,0.06)' }} />
              <Bar dataKey="count" name="Visits" radius={[6, 6, 0, 0]}>
                {buckets.map((b) => (
                  <Cell
                    key={b.hour}
                    fill={b.hour === peakHour.hour && b.count > 0 ? '#0284C7' : '#7DD3FC'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
