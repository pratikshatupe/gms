import React, { useMemo } from 'react';
import { Search, X } from 'lucide-react';
import EmptyState from './EmptyState';
import Pagination from './Pagination';

/**
 * DataTable — composable table wrapper used by every list view.
 *
 * Column shape:
 *   {
 *     key:       string,
 *     header:    string,
 *     render:    (row, rowIndex) => node,
 *     width?:    string,
 *     nowrap?:   boolean,
 *     align?:    'left' | 'right' | 'center'
 *     headerClassName?: string
 *     cellClassName?:   string
 *     mobileHidden?:    boolean  // hide this field on mobile card view
 *     mobilePrimary?:   boolean  // show this field prominently in card header
 *   }
 *
 * Additional props for mobile card view:
 *   mobileCard      — (row, rowIndex) => node    custom card renderer (overrides auto)
 *   mobileFields    — string[]   column keys to show in mobile card (default: all)
 */
export default function DataTable({
  columns = [],
  rows = [],
  getRowKey,

  title,
  subtitle,
  actions,

  search,
  onSearchChange,
  searchPlaceholder = 'Search…',

  page,
  perPage,
  total,
  onPageChange,
  onPerPageChange,
  pageSizes,

  emptyState,
  loading,
  className = '',

  onRowClick,

  // When true, always renders the full table (with horizontal scroll) instead
  // of switching to the card view on small screens.
  forceTable = false,

  // Mobile card API
  mobileCard,    // custom card renderer fn(row, idx) => node
  mobileFields,  // array of column keys to show in mobile cards
}) {
  const hasHeaderStrip = Boolean(title || subtitle || actions);
  const hasSearch = typeof onSearchChange === 'function';
  const hasPagination =
    typeof onPageChange === 'function' &&
    typeof onPerPageChange === 'function' &&
    typeof page === 'number' &&
    typeof perPage === 'number' &&
    typeof total === 'number';

  const rowKey = useMemo(
    () => getRowKey || ((row, idx) => row?.id ?? idx),
    [getRowKey],
  );

  // Columns visible in mobile cards
  const mobileColumns = useMemo(() => {
    if (mobileFields) {
      return columns.filter((c) => mobileFields.includes(c.key));
    }
    return columns.filter((c) => !c.mobileHidden);
  }, [columns, mobileFields]);

  // Primary column for card heading
  const primaryCol = useMemo(
    () => mobileColumns.find((c) => c.mobilePrimary) || mobileColumns[0],
    [mobileColumns],
  );

  // Secondary columns (all except primary)
  const secondaryCols = useMemo(
    () => mobileColumns.filter((c) => c !== primaryCol),
    [mobileColumns, primaryCol],
  );

  const headerAndSearch = (
    <>
      {hasHeaderStrip && (
        <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between dark:border-[#142535]">
          <div className="min-w-0">
            {title && (
              <h3 className="truncate text-[14px] font-bold text-[#0C2340] font-['Outfit',sans-serif] dark:text-slate-100">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="mt-0.5 text-[12px] text-slate-500 dark:text-slate-400">
                {subtitle}
              </p>
            )}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}

      {hasSearch && (
        <div className="border-b border-slate-100 p-3 dark:border-[#142535]">
          <div className="relative">
            <Search
              size={14}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={search || ''}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-[10px] border border-slate-200 bg-white py-2 pl-9 pr-9 text-[13px] text-slate-700 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100 placeholder:text-slate-400 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-200 dark:focus:ring-sky-500/20"
              aria-label="Search table"
            />
            {search && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-[#1E1E3F] dark:hover:text-slate-200"
              >
                <X size={13} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );

  const paginationEl = hasPagination && rows.length > 0 ? (
    <Pagination
      page={page}
      perPage={perPage}
      total={total}
      onPageChange={onPageChange}
      onPerPageChange={(n) => {
        onPerPageChange(n);
        onPageChange?.(1);
      }}
      pageSizes={pageSizes}
    />
  ) : null;

  const emptyEl = (
    <div className="p-0">
      {emptyState || <EmptyState />}
    </div>
  );

  return (
    <div
      className={`overflow-x-auto rounded-[14px] border border-slate-200 bg-white shadow-sm dark:border-[#142535] dark:bg-[#0A1828] ${className}`}
    >
      {headerAndSearch}

      {/* ── DESKTOP TABLE (lg+) ── */}
      <div className="hidden lg:block w-full overflow-x-auto">
        <table className="w-full border-collapse text-[13px]" style={{ minWidth: '860px' }}>
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 dark:border-[#142535] dark:bg-[#071220]">
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  style={col.width ? { width: col.width } : undefined}
                  className={`px-2 py-2.5 text-[11px] font-bold uppercase tracking-[0.05em] text-slate-500 dark:text-slate-400 ${
                    col.align === 'right'
                      ? 'text-right'
                      : col.align === 'center'
                      ? 'text-center'
                      : 'text-left'
                  } ${col.headerClassName || ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-0">
                  {emptyEl}
                </td>
              </tr>
            ) : (
              rows.map((row, rowIndex) => (
                <tr
                  key={rowKey(row, rowIndex)}
                  onClick={onRowClick ? () => onRowClick(row, rowIndex) : undefined}
                  onKeyDown={onRowClick ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRowClick(row, rowIndex); }
                  } : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  role={onRowClick ? 'button' : undefined}
                  className={`border-b border-slate-50 transition hover:bg-slate-50 dark:border-[#142535]/60 dark:hover:bg-[#1E1E3F]/40 ${onRowClick ? 'cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-500/30' : ''}`}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`break-words px-2 py-2 align-middle text-slate-600 dark:text-slate-300 ${
                        col.nowrap ? 'whitespace-nowrap' : ''
                      } ${
                        col.align === 'right'
                          ? 'text-right'
                          : col.align === 'center'
                          ? 'text-center'
                          : 'text-left'
                      } ${col.cellClassName || ''}`}
                    >
                      {col.render
                        ? col.render(row, rowIndex)
                        : row?.[col.key] ?? ''}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── MOBILE / TABLET CARD VIEW (below lg) ── */}
      <div className="block lg:hidden">
        {rows.length === 0 ? (
          emptyEl
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-[#142535]">
            {rows.map((row, rowIndex) => {
              if (mobileCard) {
                return (
                  <div
                    key={rowKey(row, rowIndex)}
                    onClick={onRowClick ? () => onRowClick(row, rowIndex) : undefined}
                    onKeyDown={onRowClick ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRowClick(row, rowIndex); }
                    } : undefined}
                    tabIndex={onRowClick ? 0 : undefined}
                    role={onRowClick ? 'button' : undefined}
                    className={onRowClick ? 'cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-500/30' : ''}
                  >
                    {mobileCard(row, rowIndex)}
                  </div>
                );
              }

              // Auto-generated card
              return (
                <div
                  key={rowKey(row, rowIndex)}
                  onClick={onRowClick ? () => onRowClick(row, rowIndex) : undefined}
                  onKeyDown={onRowClick ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRowClick(row, rowIndex); }
                  } : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  role={onRowClick ? 'button' : undefined}
                  className={`px-4 py-3 transition hover:bg-slate-50 dark:hover:bg-[#1E1E3F]/40 ${onRowClick ? 'cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-500/30' : ''}`}
                >
                  {/* Primary field */}
                  {primaryCol && (
                    <div className="mb-2 font-semibold text-[14px] text-slate-800 dark:text-slate-100 break-words">
                      {primaryCol.render
                        ? primaryCol.render(row, rowIndex)
                        : row?.[primaryCol.key] ?? ''}
                    </div>
                  )}

                  {/* Secondary fields in 2-col grid */}
                  {secondaryCols.length > 0 && (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                      {secondaryCols.map((col) => (
                        <div key={col.key} className="min-w-0">
                          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-0.5">
                            {col.header}
                          </div>
                          <div className="text-[12px] text-slate-600 dark:text-slate-300 break-words">
                            {col.render
                              ? col.render(row, rowIndex)
                              : row?.[col.key] ?? '—'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {paginationEl}
    </div>
  );
}