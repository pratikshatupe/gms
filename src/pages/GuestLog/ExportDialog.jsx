import React, { useEffect, useRef, useState } from 'react';
import {
  X, FileText, FileSpreadsheet, Loader2, Download, Printer,
} from 'lucide-react';
import {
  buildCsv, buildPdfHtml, downloadCsv, openPdfPrintWindow,
  exportFilename, timestampSlug, orgSlug,
} from '../../utils/guestLogAnalytics';

/**
 * ExportDialog — format picker for Guest Log exports.
 *
 * CSV: pure JS build, UTF-8 BOM, RFC 4180, downloaded via anchor.
 * PDF: window.print() path via a pre-rendered new window.
 *
 * No new dependencies. Both paths are audit-logged by the caller
 * via the onExported callback.
 */

export default function ExportDialog({
  open, rows, org, filterSummary, generatedBy,
  onClose, onExported,
}) {
  const [format, setFormat] = useState('csv');
  const [filename, setFilename] = useState('');
  const [saving, setSaving] = useState(false);
  const cancelBtnRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setFormat('csv');
    setSaving(false);
    const suggested = exportFilename('csv', org, new Date());
    setFilename(suggested);
    const t = window.setTimeout(() => cancelBtnRef.current?.focus(), 30);
    return () => window.clearTimeout(t);
  }, [open, org]);

  useEffect(() => {
    if (!open) return;
    /* Keep the filename in sync with the selected format — except
       when the operator has typed a custom name without an extension,
       in which case we append the correct one. */
    const base = exportFilename(format, org, new Date()).replace(/\.(csv|pdf)$/, '');
    setFilename((current) => {
      if (!current) return `${base}.${format}`;
      /* Strip any existing extension then add the current format. */
      return `${current.replace(/\.(csv|pdf)$/, '')}.${format}`;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format]);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape' && !saving) onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, saving, onClose]);

  if (!open) return null;

  const rowCount = rows?.length || 0;

  const handleExport = async () => {
    if (saving) return;
    setSaving(true);
    /* Brief spinner to indicate the build — keeps the UI honest. */
    await new Promise((r) => setTimeout(r, 400));
    if (format === 'csv') {
      const csv = buildCsv(rows, { org });
      downloadCsv(csv, filename || exportFilename('csv', org, new Date()));
      setSaving(false);
      onExported?.({ format: 'CSV', rowCount, filename });
      onClose?.();
      return;
    }
    /* PDF path. */
    const html = buildPdfHtml(rows, {
      org,
      filterSummary,
      generatedBy,
      generatedAtIso: new Date().toISOString(),
    });
    const ok = openPdfPrintWindow(html);
    setSaving(false);
    if (ok) {
      onExported?.({ format: 'PDF', rowCount, filename });
      onClose?.();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-title"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose?.(); }}
      className="fixed inset-0 z-[9500] flex items-center justify-center bg-black/55 p-4"
    >
      <div className="w-full max-w-md rounded-[14px] border border-slate-200 bg-white shadow-2xl dark:border-[#142535] dark:bg-[#0A1828]">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-gradient-to-r from-sky-700 to-sky-800 px-5 py-4 text-white dark:border-[#142535]">
          <div className="min-w-0">
            <h3 id="export-title" className="font-[Outfit,sans-serif] text-[16px] font-extrabold leading-tight">
              Export Guest Log
            </h3>
            <p className="mt-0.5 text-[12px] opacity-85">
              {rowCount.toLocaleString('en-GB')} record{rowCount === 1 ? '' : 's'} match the current filters.
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={saving}
            aria-label="Close dialog" title="Close"
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md bg-white/15 text-white hover:bg-white/25 disabled:opacity-40">
            <X size={15} aria-hidden="true" />
          </button>
        </div>

        <div className="px-5 py-4">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400">
            Format
          </p>
          <div role="radiogroup" aria-label="Export format" className="grid grid-cols-2 gap-2">
            <FormatCard
              active={format === 'csv'} Icon={FileSpreadsheet}
              label="CSV" description="21 columns · Excel compatible"
              onClick={() => setFormat('csv')}
            />
            <FormatCard
              active={format === 'pdf'} Icon={FileText}
              label="PDF" description="9 columns · Print dialog"
              onClick={() => setFormat('pdf')}
            />
          </div>

          <label htmlFor="export-filename" className="mt-4 mb-1.5 block text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400">
            Filename
          </label>
          <input
            id="export-filename"
            type="text"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            placeholder={`guest-log-${orgSlug(org?.name)}-${timestampSlug()}.${format}`}
            maxLength={200}
            className="w-full rounded-[10px] border border-slate-200 bg-white px-3 py-2 font-mono text-[12px] text-slate-700 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-200"
          />

          {format === 'pdf' && (
            <p className="mt-3 rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-500 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-400">
              PDF opens your browser&rsquo;s print dialog. Choose &ldquo;Save as PDF&rdquo; as the destination to generate a file. If the print window doesn&rsquo;t open, check your browser&rsquo;s popup settings.
            </p>
          )}

          {rowCount === 0 && (
            <p className="mt-3 rounded-[10px] border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
              No records match the current filters — nothing to export.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-[#142535] dark:bg-[#071220]">
          <button ref={cancelBtnRef} type="button" onClick={onClose} disabled={saving}
            className="cursor-pointer rounded-[10px] border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-[#142535] dark:bg-[#0A1828] dark:text-slate-200">
            Cancel
          </button>
          <button type="button" onClick={handleExport} disabled={saving || rowCount === 0}
            className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-sky-700 bg-gradient-to-r from-sky-600 to-sky-800 px-5 py-2.5 text-[13px] font-bold text-white shadow-sm hover:from-sky-700 hover:to-sky-900 disabled:opacity-40">
            {saving
              ? <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              : (format === 'csv' ? <Download size={14} aria-hidden="true" /> : <Printer size={14} aria-hidden="true" />)}
            {saving ? 'Preparing…' : (format === 'csv' ? 'Download CSV' : 'Open Print Dialog')}
          </button>
        </div>
      </div>
    </div>
  );
}

function FormatCard({ active, Icon, label, description, onClick }) {
  return (
    <button
      type="button" role="radio" aria-checked={active}
      onClick={onClick}
      className={`flex cursor-pointer flex-col items-start gap-1 rounded-[12px] border p-3 text-left transition ${active
        ? 'border-sky-700 bg-sky-50 shadow-sm dark:border-sky-400 dark:bg-sky-500/15'
        : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-[#142535] dark:bg-[#071220] dark:hover:bg-[#1E1E3F]'}`}
    >
      <Icon size={20} aria-hidden="true" className={active ? 'text-sky-700 dark:text-sky-300' : 'text-slate-500 dark:text-slate-400'} />
      <span className={`text-[13px] font-extrabold ${active ? 'text-sky-700 dark:text-sky-300' : 'text-[#0C2340] dark:text-slate-100'}`}>
        {label}
      </span>
      <span className={`text-[11px] ${active ? 'text-sky-500 dark:text-sky-300' : 'text-slate-500 dark:text-slate-400'}`}>
        {description}
      </span>
    </button>
  );
}
