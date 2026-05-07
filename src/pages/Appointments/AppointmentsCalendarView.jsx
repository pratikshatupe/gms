import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * AppointmentsCalendarView — month grid with per-day appointment
 * dots. Clicking a day fires onSelectDate(iso) for list mode to
 * filter down; clicking an empty day fires onCreate(iso) for the
 * pre-filled Add drawer.
 */

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function monthKey(year, month0) {
  return `${year}-${String(month0 + 1).padStart(2, '0')}`;
}

function daysInMonth(year, month0) {
  return new Date(year, month0 + 1, 0).getDate();
}

function isoFor(year, month0, day) {
  return `${year}-${String(month0 + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/* Return 0 = Mon, 6 = Sun — matches the header row. */
function weekdayMonStart(date) {
  const js = date.getDay();            /* 0=Sun..6=Sat */
  return (js + 6) % 7;
}

export default function AppointmentsCalendarView({
  appointments, onSelectDate, onCreate, canCreate,
}) {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const byDate = useMemo(() => {
    const m = new Map();
    for (const a of appointments || []) {
      const d = (a?.scheduledDate || a?.date || '').slice(0, 10);
      if (!d) continue;
      if (!m.has(d)) m.set(d, []);
      m.get(d).push(a);
    }
    return m;
  }, [appointments]);

  const viewYm = monthKey(year, month);
  const cursor = new Date(year, month, 1);
  const firstDow = weekdayMonStart(cursor);
  const total = daysInMonth(year, month);
  const todayIso = new Date().toISOString().slice(0, 10);
  const todayYm  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const goPrev = () => {
    const d = new Date(year, month - 1, 1);
    setYear(d.getFullYear()); setMonth(d.getMonth());
  };
  const goNext = () => {
    const d = new Date(year, month + 1, 1);
    setYear(d.getFullYear()); setMonth(d.getMonth());
  };
  const goToday = () => {
    setYear(now.getFullYear()); setMonth(now.getMonth());
  };

  const cells = [];
  for (let i = 0; i < firstDow; i += 1) cells.push(null);
  for (let d = 1; d <= total; d += 1) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = cursor.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  return (
    <div className="rounded-[14px] border border-slate-200 bg-white shadow-sm dark:border-[#142535] dark:bg-[#0A1828]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-[#142535]">
        <div>
          <h3 className="font-[Outfit,sans-serif] text-[15px] font-extrabold text-[#0C2340] dark:text-slate-100">
            {monthLabel}
          </h3>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            Click a date to filter · click an empty date to create.
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={goPrev} aria-label="Previous month" title="Previous month"
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[8px] border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-300">
            <ChevronLeft size={14} aria-hidden="true" />
          </button>
          <button type="button" onClick={goToday} disabled={viewYm === todayYm}
            className="cursor-pointer rounded-[8px] border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-200">
            Today
          </button>
          <button type="button" onClick={goNext} aria-label="Next month" title="Next month"
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[8px] border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-300">
            <ChevronRight size={14} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-7 gap-2 text-center">
          {DAY_LABELS.map((d) => (
            <div key={d} className="text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400">
              {d}
            </div>
          ))}
          {cells.map((d, idx) => {
            if (d == null) return <div key={`empty-${idx}`} />;
            const iso = isoFor(year, month, d);
            const list = byDate.get(iso) || [];
            const count = list.length;
            const isToday = iso === todayIso;

            const hasPending = list.some((a) => a.status === 'Pending');
            const hasTerminal = list.some((a) => a.status === 'Cancelled' || a.status === 'No-Show');
            const dotColor =
              count === 0 ? null
              : hasPending ? 'bg-amber-500'
              : hasTerminal ? 'bg-slate-400'
              : 'bg-emerald-500';
            const dotCount = count === 0 ? 0 : count <= 2 ? 1 : count <= 5 ? 2 : 3;

            const clickHandler = () => {
              if (count > 0) onSelectDate?.(iso);
              else if (canCreate) onCreate?.(iso);
            };
            const disabled = count === 0 && !canCreate;

            return (
              <button
                key={iso}
                type="button"
                onClick={clickHandler}
                disabled={disabled}
                title={count > 0
                  ? `${count} appointment${count === 1 ? '' : 's'} scheduled.`
                  : (canCreate ? 'Click to create a new appointment on this date.' : 'No appointments.')}
                className={`relative flex min-h-[72px] flex-col items-start justify-start rounded-[10px] border px-2 py-1.5 text-left transition ${isToday
                  ? 'border-sky-700 bg-sky-50 dark:border-sky-400 dark:bg-sky-500/15'
                  : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-[#142535] dark:bg-[#071220] dark:hover:bg-[#1E1E3F]'} ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
              >
                <span className={`text-[12px] font-bold ${isToday ? 'text-sky-700 dark:text-sky-300' : 'text-slate-700 dark:text-slate-200'}`}>
                  {d}
                </span>
                {count > 0 && (
                  <div className="mt-auto flex items-end gap-1">
                    <div className="flex gap-0.5">
                      {Array.from({ length: dotCount }).map((_, i) => (
                        <span key={i} aria-hidden="true" className={`inline-block h-1.5 w-1.5 rounded-full ${dotColor}`} />
                      ))}
                    </div>
                    {count > 5 && (
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                        {count}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
