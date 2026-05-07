import React, { useMemo, useState } from 'react';
import Pagination from './ui/Pagination';

const STATUS_BADGE = {
  Pending:       'border-amber-200 bg-amber-50 text-amber-700',
  'In Progress': 'border-blue-200 bg-blue-50 text-blue-700',
  Completed:     'border-emerald-200 bg-emerald-50 text-emerald-700',
};

function StatusBadge({ status }) {
  const cls = STATUS_BADGE[status] || 'border-slate-200 bg-slate-100 text-slate-500';
  return (
    <span className={`inline-flex whitespace-nowrap items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${cls}`}>
      {status}
    </span>
  );
}

function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

/**
 * Service Reports table — takes already-date-filtered rows and adds its own
 * in-table filters (status + staff + search) plus pagination.
 *
 * Mobile: rows render as cards. Desktop: full table with horizontal scroll.
 */
export default function ReportsTable({ services, staff }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [staffFilter, setStaffFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const serviceStaff = useMemo(
    () => staff.filter((s) => (s.role || '').toLowerCase() === 'service staff'),
    [staff],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return services.filter((s) => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (staffFilter !== 'all'  && s.assignedStaffId !== staffFilter) return false;
      if (!q) return true;
      return (
        s.visitorName?.toLowerCase().includes(q) ||
        s.serviceType?.toLowerCase().includes(q) ||
        s.assignedStaff?.toLowerCase().includes(q) ||
        s.notes?.toLowerCase().includes(q)
      );
    });
  }, [services, search, statusFilter, staffFilter]);

  /* Reset to page 1 whenever filters narrow the result set. */
  const resetPage = (setter) => (next) => { setter(next); setPage(1); };

  const total = filtered.length;
  const startIndex = (page - 1) * perPage;
  const paginated = filtered.slice(startIndex, startIndex + perPage);

  return (
    <section className="w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-col gap-3 border-b border-slate-100 p-4 md:flex-row md:items-center md:justify-between">
        <h3 className="text-sm font-bold text-slate-800">Service Reports</h3>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => resetPage(setSearch)(e.target.value)}
            placeholder="Search visitor, service, staff…"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 md:w-56"
          />
          <select
            value={statusFilter}
            onChange={(e) => resetPage(setStatusFilter)(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-sky-400"
          >
            <option value="all">All statuses</option>
            <option value="Pending">Pending</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
          </select>
          <select
            value={staffFilter}
            onChange={(e) => resetPage(setStaffFilter)(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-sky-400"
          >
            <option value="all">All staff</option>
            {serviceStaff.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </header>

      {total === 0 ? (
        <div className="flex min-h-[200px] flex-col items-center justify-center p-8 text-center">
          <div className="mb-3 text-4xl" aria-hidden="true">📄</div>
          <h4 className="text-sm font-semibold text-slate-700">No records found.</h4>
          <p className="mt-1 text-xs text-slate-400">
            Try widening the date range or clearing the filters.
          </p>
        </div>
      ) : (
        <>
          {/* Mobile: cards (below md) */}
          <div className="block md:hidden divide-y divide-slate-100 dark:divide-[#142535]">
            {paginated.map((s) => (
              <div key={s.id} className="p-3 hover:bg-slate-50 dark:hover:bg-[#1E1E3F]/40 transition">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <h4 className="text-[13px] font-bold text-slate-800 dark:text-slate-100 truncate">{s.visitorName}</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{s.serviceType}</p>
                  </div>
                  <StatusBadge status={s.status} />
                </div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                  <div>
                    <dt className="text-[10px] font-bold uppercase text-slate-400">Staff</dt>
                    <dd className="mt-0.5 truncate text-slate-700 dark:text-slate-300">{s.assignedStaff}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-bold uppercase text-slate-400">Created</dt>
                    <dd className="mt-0.5 text-slate-700 dark:text-slate-300">{formatDateTime(s.createdAt)}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-[10px] font-bold uppercase text-slate-400">Completed</dt>
                    <dd className="mt-0.5 text-slate-700 dark:text-slate-300">{formatDateTime(s.completedAt)}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>

          {/* Desktop: table (md+) */}
          <div className="hidden md:block w-full overflow-x-auto">
            <table className="w-full min-w-[600px] border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Visitor Name</th>
                  <th className="px-4 py-3">Service Type</th>
                  <th className="px-4 py-3">Assigned Staff</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Completed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginated.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-semibold text-slate-800">{s.visitorName}</td>
                    <td className="px-4 py-3 text-slate-700">{s.serviceType}</td>
                    <td className="px-4 py-3 text-slate-600">{s.assignedStaff}</td>
                    <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDateTime(s.createdAt)}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDateTime(s.completedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={page}
            perPage={perPage}
            total={total}
            onPageChange={setPage}
            onPerPageChange={(next) => { setPerPage(next); setPage(1); }}
            pageSizes={[5, 10, 20, 50]}
          />
        </>
      )}
    </section>
  );
}