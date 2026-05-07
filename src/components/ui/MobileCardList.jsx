/**
 * MobileCardList — renders a list of data cards for mobile/tablet.
 *
 * Usage:
 *   <MobileCardList
 *     items={slice}
 *     onRowClick={(item) => ...}
 *     renderCard={(item, idx) => <MobileCard ... />}
 *     emptyNode={<EmptyState ... />}
 *   />
 *
 * The parent decides whether to show this (lg:hidden) or the table (hidden lg:block).
 */
import React from 'react';

export function MobileCardList({ items, renderCard, emptyNode }) {
  if (!items || items.length === 0) {
    return (
      <div className="rounded-[14px] border border-slate-200 bg-white shadow-sm dark:border-[#142535] dark:bg-[#0A1828]">
        {emptyNode}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {items.map((item, idx) => renderCard(item, idx))}
    </div>
  );
}

/**
 * MobileCard — a single card wrapper.
 * Props:
 *   onClick, badge (JSX), title, subtitle, rows ([{label, value}]), actions (JSX)
 */
export function MobileCard({ onClick, badge, title, subtitle, rows = [], actions }) {
  return (
    <div
      onClick={onClick}
      className={`rounded-[12px] border border-slate-200 bg-white p-4 shadow-sm transition dark:border-[#142535] dark:bg-[#0A1828] ${onClick ? 'cursor-pointer hover:border-sky-300 hover:shadow-md dark:hover:border-sky-600' : ''}`}
      style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
    >
      {/* Top row: title + badge */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          {title && <div className="truncate text-[13px] font-bold text-[#0C2340] dark:text-slate-100">{title}</div>}
          {subtitle && <div className="mt-0.5 truncate text-[11px] text-slate-400">{subtitle}</div>}
        </div>
        {badge && <div className="shrink-0">{badge}</div>}
      </div>

      {/* Data rows grid */}
      {rows.length > 0 && (
        <div className="grid grid-cols-2 gap-y-2.5 text-[12px]">
          {rows.map(({ label, value, fullWidth }, i) => (
            <div key={i} className={fullWidth ? 'col-span-2' : ''}>
              <div className="text-slate-400">{label}</div>
              <div className="font-semibold text-slate-600 dark:text-slate-300 truncate">{value ?? '—'}</div>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      {actions && (
        <div className="mt-3 flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
          {actions}
        </div>
      )}
    </div>
  );
}

export default MobileCardList;
