import React, { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from 'recharts';

/**
 * Charts for the Reports page. Pure presentational — each chart takes the
 * already-filtered services array and renders from it.
 */

const STATUS_COLORS = {
  Pending:       '#F59E0B',
  'In Progress': '#3B82F6',
  Completed:     '#10B981',
};

function isoDay(iso) {
  return iso ? iso.slice(0, 10) : '';
}

function formatDay(iso) {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
}

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

/** Bar chart of services per day, last N days. */
export function ServicesPerDayChart({ services, days = 7 }) {
  const data = useMemo(() => {
    /* Build an empty-bucket skeleton for the last `days` days so gaps are
       visible even when there's no activity. */
    const buckets = new Map();
    const today = new Date();
    for (let i = days - 1; i >= 0; i -= 1) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      buckets.set(iso, { day: iso, label: formatDay(iso), created: 0, completed: 0 });
    }
    services.forEach((s) => {
      const created = isoDay(s.createdAt);
      if (buckets.has(created)) buckets.get(created).created += 1;
      const completed = isoDay(s.completedAt);
      if (buckets.has(completed)) buckets.get(completed).completed += 1;
    });
    return Array.from(buckets.values());
  }, [services, days]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="mb-3">
        <h3 className="text-sm font-bold text-slate-800">Services per Day</h3>
        <p className="text-xs text-slate-500">Last {days} days — created vs. completed</p>
      </header>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barSize={18} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EEE" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
            <Tooltip content={<TooltipContent />} cursor={{ fill: 'rgba(14,165,233,0.06)' }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="created"   name="Created"   fill="#0284C7" radius={[6, 6, 0, 0]} />
            <Bar dataKey="completed" name="Completed" fill="#10B981" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Pie chart of service status distribution. */
export function StatusPieChart({ services }) {
  const data = useMemo(() => {
    const counts = { Pending: 0, 'In Progress': 0, Completed: 0 };
    services.forEach((s) => { if (counts[s.status] != null) counts[s.status] += 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [services]);

  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="mb-3">
        <h3 className="text-sm font-bold text-slate-800">Status Distribution</h3>
        <p className="text-xs text-slate-500">Share of services in each state</p>
      </header>
      <div className="h-64 w-full">
        {total === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-slate-400">
            No services in the selected range.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip content={<TooltipContent />} />
              <Legend wrapperStyle={{ fontSize: 12 }} verticalAlign="bottom" />
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={50}
                outerRadius={85}
                paddingAngle={2}
                label={({ name, percent }) =>
                  percent > 0 ? `${Math.round(percent * 100)}%` : ''
                }
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || '#94A3B8'} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

export default function Charts({ services, days = 7 }) {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <ServicesPerDayChart services={services} days={days} />
      <StatusPieChart services={services} />
    </div>
  );
}
