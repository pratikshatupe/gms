import React, { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

function pad(n) { return String(n).padStart(2, '0'); }

function formatDayLabel(iso) {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short' });
}

function utilTone(pct) {
  if (pct >= 75) return 'bg-sky-500 text-white';
  if (pct >= 50) return 'bg-sky-300 text-sky-900';
  if (pct >= 25) return 'bg-sky-100 text-sky-700';
  if (pct > 0)   return 'bg-sky-50  text-sky-700';
  return 'bg-slate-50 text-slate-400';
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

export function WeekScheduleGrid({ rooms, bookings, weekStartDate, onWeekChange }) {
  const days = useMemo(() => {
    const out = [];
    const start = new Date(`${weekStartDate}T00:00:00`);
    if (Number.isNaN(start.getTime())) return out;
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      out.push(d.toISOString().slice(0, 10));
    }
    return out;
  }, [weekStartDate]);

  const grid = useMemo(() => {
    const map = new Map();
    rooms.forEach((r) => map.set(r.id, new Map()));
    bookings.forEach((b) => {
      if (b.status === 'Cancelled') return;
      if (!days.includes(b.date)) return;
      const roomMap = map.get(b.roomId);
      if (!roomMap) return;
      const bucket = roomMap.get(b.date) || { count: 0, minutes: 0 };
      const [sh, sm] = (b.startTime || '').split(':').map(Number);
      const [eh, em] = (b.endTime   || '').split(':').map(Number);
      const start = Number.isFinite(sh) && Number.isFinite(sm) ? sh * 60 + sm : null;
      const end   = Number.isFinite(eh) && Number.isFinite(em) ? eh * 60 + em : null;
      if (start != null && end != null && end > start) bucket.minutes += end - start;
      bucket.count += 1;
      roomMap.set(b.date, bucket);
    });
    return map;
  }, [rooms, bookings, days]);

  const TIME_COL_W = 140;
  const DAY_COL_MIN = 92;

  return (
    <section className="w-full min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-[#142535] dark:bg-[#0A1828]">
      <header className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-[#142535]">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Week at a Glance</h3>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Week of:</label>
          <input
            type="date"
            value={weekStartDate}
            onChange={(e) => onWeekChange(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-sky-400 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-200"
          />
        </div>
      </header>

      <div className="w-full overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
        <table
          className="w-full border-collapse text-xs"
          style={{ minWidth: TIME_COL_W + days.length * DAY_COL_MIN }}
        >
          <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:bg-[#071220] dark:text-slate-400">
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-20 bg-slate-50 px-3 py-3 text-left shadow-[2px_0_4px_-2px_rgba(15,23,42,0.08)] dark:bg-[#071220]"
                style={{ width: TIME_COL_W, minWidth: TIME_COL_W }}
              >
                Room
              </th>
              {days.map((d) => (
                <th
                  key={d}
                  scope="col"
                  className="px-2 py-3 text-center align-top"
                  style={{ minWidth: DAY_COL_MIN }}
                >
                  {formatDayLabel(d)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-[#142535]">
            {rooms.map((r) => {
              const roomMap = grid.get(r.id) || new Map();
              return (
                <tr key={r.id}>
                  <td
                    className="sticky left-0 z-10 bg-white px-3 py-2 shadow-[2px_0_4px_-2px_rgba(15,23,42,0.08)] dark:bg-[#0A1828]"
                    style={{ width: TIME_COL_W, minWidth: TIME_COL_W }}
                  >
                    <div className="truncate font-semibold text-slate-700 dark:text-slate-200">{r.name}</div>
                    <div className="text-[10px] font-normal text-slate-400 dark:text-slate-500">Cap {r.capacity}</div>
                  </td>
                  {days.map((d) => {
                    const entry = roomMap.get(d);
                    const minutes = entry?.minutes || 0;
                    const pct = Math.min(100, Math.round((minutes / 720) * 100));
                    return (
                      <td
                        key={d}
                        className="h-14 border-l border-slate-100 p-1 text-center align-middle dark:border-[#142535]"
                        style={{ minWidth: DAY_COL_MIN }}
                      >
                        <div className={`mx-auto flex h-full w-full flex-col items-center justify-center rounded-md px-1.5 py-1 ${utilTone(pct)}`}>
                          {entry ? (
                            <>
                              <span className="text-sm font-extrabold leading-none">{entry.count}</span>
                              <span className="mt-0.5 text-[10px] font-semibold opacity-80">{pct}% util</span>
                            </>
                          ) : (
                            <span className="text-[10px] font-semibold">—</span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function RoomUtilizationReport({ util }) {
  const hasData = util.overall.totalBookings > 0;
  return (
    <div className="space-y-5">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Total Bookings"    value={util.overall.totalBookings}        tone="violet" />
        <StatTile label="Booked Hours"      value={(util.overall.bookedMinutes / 60).toFixed(1)} tone="violet" />
        <StatTile
          label="Overall Utilization"
          value={`${util.overall.utilizationPct}%`}
          tone={util.overall.utilizationPct >= 50 ? 'emerald' : 'amber'}
          hint={`Across ${util.days.length} day${util.days.length === 1 ? '' : 's'}, ${util.businessHours.startHour}:00–${util.businessHours.endHour}:00`}
        />
        <StatTile
          label="Peak Hour"
          value={hasData ? util.peakHour.label : '—'}
          tone="slate"
          hint={hasData ? `${util.peakHour.count} booking${util.peakHour.count === 1 ? '' : 's'} touched this hour` : null}
        />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm dark:border-[#142535] dark:bg-[#0A1828]">
        <header className="mb-3">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Per-room Utilization</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Bookings and booked hours per room in the selected range.</p>
        </header>
        <div className="h-72 w-full">
          {!hasData ? (
            <div className="flex h-full items-center justify-center text-xs text-slate-400">No bookings in the selected range.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={util.perRoom} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEE" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="roomName" width={100} tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
                <Tooltip content={<TooltipContent />} cursor={{ fill: 'rgba(14,165,233,0.06)' }} />
                <Bar dataKey="utilizationPct" name="Utilization %" radius={[0, 6, 6, 0]}>
                  {util.perRoom.map((r) => (
                    <Cell key={r.roomId} fill={r.utilizationPct >= 50 ? '#0284C7' : r.utilizationPct >= 25 ? '#38BDF8' : '#7DD3FC'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* Room Breakdown — desktop table / mobile cards */}
      <section className="w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-[#142535] dark:bg-[#0A1828]">
        <header className="border-b border-slate-100 px-5 py-4 dark:border-[#142535]">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Room Breakdown</h3>
        </header>

        {/* Desktop */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full min-w-[540px] border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:bg-[#071220] dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Room</th>
                <th className="px-4 py-3">Capacity</th>
                <th className="px-4 py-3">Bookings</th>
                <th className="px-4 py-3">Hours Booked</th>
                <th className="px-4 py-3">Utilization</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#142535]">
              {util.perRoom.map((r) => (
                <tr key={r.roomId} className="hover:bg-slate-50/70 dark:hover:bg-[#1E1E3F]/40">
                  <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-100">{r.roomName}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{r.capacity}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{r.bookings}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{(r.bookedMinutes / 60).toFixed(1)} h</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-28 rounded-full bg-slate-100 dark:bg-[#142535]">
                        <div className="h-full rounded-full bg-sky-500" style={{ width: `${r.utilizationPct}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{r.utilizationPct}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile / tablet cards */}
        <div className="block lg:hidden divide-y divide-slate-100 dark:divide-[#142535]">
          {util.perRoom.map((r) => (
            <div key={r.roomId} className="px-4 py-4">
              <div className="font-bold text-[14px] text-slate-800 dark:text-slate-100 mb-3">{r.roomName}</div>
              <div className="mb-3">
                <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-1">Utilization</div>
                <div className="flex items-center gap-2">
                  <div className="h-2 flex-1 rounded-full bg-slate-100 dark:bg-[#142535]">
                    <div className="h-full rounded-full bg-sky-500" style={{ width: `${r.utilizationPct}%` }} />
                  </div>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">{r.utilizationPct}%</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Capacity', value: r.capacity },
                  { label: 'Bookings', value: r.bookings },
                  { label: 'Hours', value: `${(r.bookedMinutes / 60).toFixed(1)} h` },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-0.5">{label}</div>
                    <div className="text-[13px] font-semibold text-slate-600 dark:text-slate-300">{value}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatTile({ label, value, tone = 'slate', hint }) {
  const toneCls = {
    violet:  'border-sky-100 bg-sky-50 text-sky-700 dark:border-sky-400/20 dark:bg-sky-500/10 dark:text-sky-300',
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300',
    amber:   'border-amber-100 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300',
    slate:   'border-slate-100 bg-slate-50 text-slate-700 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-200',
  }[tone];
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${toneCls}`}>
      <p className="text-2xl font-extrabold leading-none">{value}</p>
      <p className="mt-1.5 text-[12px] font-semibold opacity-80">{label}</p>
      {hint && <p className="mt-0.5 text-[11px] opacity-70">{hint}</p>}
    </div>
  );
}
