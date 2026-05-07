import React from 'react';

/**
 * Reusable audit-log table with responsive card fallback.
 *
 * Props:
 *   rows           — array of log entries
 *   startIndex     — global index offset for Sr. No. when paginated
 */

const ACTION_TONE_RULES = [
  { match: /created|added|check-?in|started|approved|walk-in/i,     tone: 'green' },
  { match: /updated|edited|assigned/i,                               tone: 'blue' },
  { match: /deleted|removed|rejected|no-show/i,                      tone: 'red' },
  { match: /completed|check-?out/i,                                  tone: 'emerald' },
];

const TONE_CLS = {
  green:   'border-green-200 bg-green-50 text-green-700',
  blue:    'border-blue-200 bg-blue-50 text-blue-700',
  red:     'border-red-200 bg-red-50 text-red-700',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  slate:   'border-slate-200 bg-slate-100 text-slate-600',
};

function actionTone(action) {
  const rule = ACTION_TONE_RULES.find((r) => r.match.test(action));
  return rule ? rule.tone : 'slate';
}

function ActionBadge({ action }) {
  const cls = TONE_CLS[actionTone(action)];
  return (
    <span className={`inline-flex whitespace-nowrap items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${cls}`}>
      {action}
    </span>
  );
}

function ModulePill({ module }) {
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[11px] font-semibold text-sky-700">
      {module}
    </span>
  );
}

function formatTimestamp(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function Details({ metadata }) {
  if (!metadata || typeof metadata !== 'object') return <span className="text-slate-400">—</span>;
  const entries = Object.entries(metadata).filter(([, v]) => v != null && v !== '');
  if (entries.length === 0) return <span className="text-slate-400">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {entries.map(([key, value]) => (
        <span
          key={key}
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-600"
        >
          <span className="font-semibold text-slate-500">{key}:</span>
          <span className="truncate max-w-[160px]">{String(value)}</span>
        </span>
      ))}
    </div>
  );
}

export default function LogTable({ rows, startIndex = 0 }) {
  if (!rows.length) {
    return (
      <div className="flex min-h-[220px] flex-col items-center justify-center p-8 text-center">
        <div className="mb-3 text-4xl" aria-hidden="true">📜</div>
        <h4 className="text-sm font-semibold text-slate-700">No activity yet</h4>
        <p className="mt-1 text-xs text-slate-400">
          Actions across the system will appear here as they happen.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Mobile: cards */}
      <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 md:hidden">
        {rows.map((log) => (
          <div key={log.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <ActionBadge action={log.action} />
              <ModulePill module={log.module} />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              <div>
                <dt className="text-[10px] font-bold uppercase text-slate-400">User</dt>
                <dd className="mt-0.5 truncate text-slate-700">
                  {log.performedBy}
                  {log.performedByRole && (
                    <span className="ml-1 text-[10px] text-slate-400">({log.performedByRole})</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase text-slate-400">Time</dt>
                <dd className="mt-0.5 text-slate-700">{formatTimestamp(log.timestamp)}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-[10px] font-bold uppercase text-slate-400">Details</dt>
                <dd className="mt-0.5"><Details metadata={log.metadata} /></dd>
              </div>
            </dl>
          </div>
        ))}
      </div>

      {/* Desktop: table */}
      <div className="hidden w-full overflow-x-auto md:block">
        <table className="w-full min-w-[920px] border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Sr. No.</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Module</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((log, idx) => (
              <tr key={log.id} className="hover:bg-slate-50/70">
                <td className="px-4 py-3 text-slate-500">{startIndex + idx + 1}</td>
                <td className="px-4 py-3"><ActionBadge action={log.action} /></td>
                <td className="px-4 py-3"><ModulePill module={log.module} /></td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="font-semibold text-slate-800">{log.performedBy}</div>
                  {log.performedByRole && (
                    <div className="text-[11px] capitalize text-slate-400">{log.performedByRole}</div>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                  {formatTimestamp(log.timestamp)}
                </td>
                <td className="px-4 py-3"><Details metadata={log.metadata} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
