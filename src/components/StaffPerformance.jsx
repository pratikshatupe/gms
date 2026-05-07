import React, { useMemo } from 'react';

/**
 * Staff performance table — desktop table, mobile/tablet card view.
 */
export default function StaffPerformance({ services, staff }) {
  const rows = useMemo(() => {
    const serviceStaff = staff.filter(
      (s) => (s.role || '').toLowerCase() === 'service staff',
    );
    const withStats = serviceStaff.map((member) => {
      const assigned  = services.filter((s) => s.assignedStaffId === member.id);
      const completed = assigned.filter((s) => s.status === 'Completed').length;
      const inProgress = assigned.filter((s) => s.status === 'In Progress').length;
      const pending    = assigned.filter((s) => s.status === 'Pending').length;
      const rate = assigned.length === 0
        ? 0
        : Math.round((completed / assigned.length) * 100);
      return { id: member.id, name: member.name, totalAssigned: assigned.length, completed, inProgress, pending, rate };
    });
    return withStats.sort((a, b) => {
      if (b.completed !== a.completed) return b.completed - a.completed;
      return b.totalAssigned - a.totalAssigned;
    });
  }, [services, staff]);

  const topPerformerId = rows.length && rows[0].completed > 0 ? rows[0].id : null;

  const RateBar = ({ rate }) => (
    <div className="flex items-center gap-2 min-w-0">
      <div className="relative h-2 w-full max-w-[120px] overflow-hidden rounded-full bg-slate-100 flex-shrink-0">
        <div className="absolute inset-y-0 left-0 rounded-full bg-emerald-500" style={{ width: `${rate}%` }} />
      </div>
      <span className="text-sm font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap">{rate}%</span>
    </div>
  );

  return (
    <section className="w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-[#142535] dark:bg-[#0A1828]">
      <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-[#142535]">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Staff Performance</h3>
        <span className="text-xs text-slate-400 dark:text-slate-500">{rows.length} service staff</span>
      </header>

      {rows.length === 0 ? (
        <div className="flex min-h-[160px] flex-col items-center justify-center p-6 text-center">
          <div className="mb-2 text-3xl" aria-hidden="true">👥</div>
          <p className="text-xs text-slate-400 dark:text-slate-500">No service staff available. Add staff in the Team &amp; Staff module.</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden lg:block w-full overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:bg-[#071220] dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Staff</th>
                  <th className="px-4 py-3">Assigned</th>
                  <th className="px-4 py-3">Completed</th>
                  <th className="px-4 py-3">In Progress</th>
                  <th className="px-4 py-3">Pending</th>
                  <th className="px-4 py-3">Completion Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#142535]">
                {rows.map((r) => {
                  const isTop = r.id === topPerformerId;
                  return (
                    <tr key={r.id} className={isTop ? 'bg-amber-50/40 dark:bg-amber-500/5' : 'hover:bg-slate-50/70 dark:hover:bg-[#1E1E3F]/40'}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-800 dark:text-slate-100">{r.name}</span>
                          {isTop && (
                            <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">🏆 Top</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{r.totalAssigned}</td>
                      <td className="px-4 py-3 text-emerald-700 font-semibold dark:text-emerald-400">{r.completed}</td>
                      <td className="px-4 py-3 text-blue-700 dark:text-blue-400">{r.inProgress}</td>
                      <td className="px-4 py-3 text-amber-700 dark:text-amber-400">{r.pending}</td>
                      <td className="px-4 py-3">
                        <RateBar rate={r.rate} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile / tablet cards */}
          <div className="block lg:hidden divide-y divide-slate-100 dark:divide-[#142535]">
            {rows.map((r) => {
              const isTop = r.id === topPerformerId;
              return (
                <div key={r.id} className={`px-4 py-4 ${isTop ? 'bg-amber-50/40 dark:bg-amber-500/5' : ''}`}>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-bold text-[14px] text-slate-800 dark:text-slate-100 truncate">{r.name}</span>
                      {isTop && (
                        <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 whitespace-nowrap">🏆 Top</span>
                      )}
                    </div>
                  </div>
                  <div className="mb-3">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-1">Completion Rate</div>
                    <RateBar rate={r.rate} />
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                    {[
                      { label: 'Assigned', value: r.totalAssigned, cls: 'text-slate-600 dark:text-slate-300' },
                      { label: 'Completed', value: r.completed, cls: 'text-emerald-700 dark:text-emerald-400 font-semibold' },
                      { label: 'In Progress', value: r.inProgress, cls: 'text-blue-700 dark:text-blue-400' },
                      { label: 'Pending', value: r.pending, cls: 'text-amber-700 dark:text-amber-400' },
                    ].map(({ label, value, cls }) => (
                      <div key={label}>
                        <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-0.5">{label}</div>
                        <div className={`text-[13px] font-semibold ${cls}`}>{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
