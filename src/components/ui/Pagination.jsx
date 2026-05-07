import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Pagination — page-size pills + prev/next + record counter.
 *
 * Props:
 *   page             — current 1-indexed page
 *   perPage          — rows per page
 *   total            — total rows across all pages
 *   onPageChange     — (nextPage) => void
 *   onPerPageChange  — (nextSize) => void  (resets page to 1)
 *   pageSizes        — pill options, default [10, 20, 50, 100]
 *   className        — wrapper class
 */
export default function Pagination({
  page,
  perPage,
  total,
  onPageChange,
  onPerPageChange,
  pageSizes = [10, 20, 50, 100],
  className = '',
}) {
  const totalPages = Math.max(1, Math.ceil((total || 0) / (perPage || 1)));
  const safePage = Math.min(Math.max(1, page || 1), totalPages);

  /* Jump-to-page input — local string state so the user can type freely
     without each keystroke firing onPageChange. Commits on Enter or blur. */
  const [jumpValue, setJumpValue] = useState(String(safePage));
  useEffect(() => { setJumpValue(String(safePage)); }, [safePage]);

  const commitJump = () => {
    const n = Number(jumpValue);
    if (!Number.isFinite(n)) { setJumpValue(String(safePage)); return; }
    const next = Math.min(Math.max(1, Math.round(n)), totalPages);
    if (next !== safePage) onPageChange?.(next);
    setJumpValue(String(next));
  };

  const handlePrev = () => {
    if (safePage > 1) onPageChange?.(safePage - 1);
  };
  const handleNext = () => {
    if (safePage < totalPages) onPageChange?.(safePage + 1);
  };

  return (
    <div
      className={`flex flex-col gap-3 border-t border-slate-100 px-3 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-4 dark:border-[#142535] ${className}`}
    >
      <div className="flex flex-wrap items-center gap-2 text-[12px] text-slate-500 dark:text-slate-400">
        <span>Show:</span>
        {pageSizes.map((n) => {
          const isActive = perPage === n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onPerPageChange?.(n)}
              aria-pressed={isActive}
              className={`cursor-pointer rounded-[7px] border px-2.5 py-1 text-[12px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40 ${
                isActive
                  ? 'border-sky-700 bg-sky-700 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-300 dark:hover:bg-[#1E1E3F]'
              }`}
            >
              {n}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[12px] text-slate-500 dark:text-slate-400">
        <span>
          Page {safePage} of {totalPages} · {total} record{total === 1 ? '' : 's'}
        </span>
        <button
          type="button"
          onClick={handlePrev}
          disabled={safePage === 1}
          aria-label="Previous page"
          className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-[7px] border border-slate-200 bg-white transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-300 dark:hover:bg-[#1E1E3F]"
        >
          <ChevronLeft size={14} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={handleNext}
          disabled={safePage >= totalPages}
          aria-label="Next page"
          className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-[7px] border border-slate-200 bg-white transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-300 dark:hover:bg-[#1E1E3F]"
        >
          <ChevronRight size={14} aria-hidden="true" />
        </button>
        {totalPages > 1 && (
          <label className="ml-1 inline-flex items-center gap-1.5 text-[11px] font-semibold">
            Go to
            <input
              type="number"
              min={1}
              max={totalPages}
              value={jumpValue}
              onChange={(e) => setJumpValue(e.target.value)}
              onBlur={commitJump}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitJump(); } }}
              aria-label="Jump to page"
              className="w-14 rounded-[6px] border border-slate-200 bg-white px-2 py-1 text-center text-[12px] text-slate-700 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-200 dark:focus:ring-sky-500/20"
            />
          </label>
        )}
      </div>
    </div>
  );
}
