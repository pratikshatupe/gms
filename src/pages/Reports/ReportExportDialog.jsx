import React, { useEffect, useRef, useState } from 'react';
import {
  X, FileText, FileSpreadsheet, Loader2, Download, Printer,
} from 'lucide-react';
import {
  buildCsvFromSpec, buildPdfHtmlFromSpec,
  downloadCsv, openPdfPrintWindow,
} from '../../utils/reportExporters';
import { orgSlug, timestampSlug } from '../../utils/guestLogAnalytics';

/**
 * ReportExportDialog — format picker for Reports.
 *
 * Differs from Guest Log's ExportDialog only in the column spec —
 * the dialog consumes `definition.csvColumns` / `definition.pdfColumns`
 * declared on each report. Low-level IO (downloadCsv,
 * openPdfPrintWindow) + builder helpers live in reportExporters.js
 * (shared between Guest Log and Reports); no duplication.
 */

export default function ReportExportDialog({
  open, definition, data, rangeLabel, from, to, user, orgs,
  onClose, onExported,
}) {
  const [format, setFormat]     = useState('csv');
  const [filename, setFilename] = useState('');
  const [saving, setSaving]     = useState(false);
  const cancelBtnRef            = useRef(null);

  const rows = useMemo_rows(data);

  const orgForExport = useMemo_org(user, orgs);

  useEffect(() => {
    if (!open) return;
    setFormat('csv'); setSaving(false);
    setFilename(`${fileBase(definition, orgForExport)}.csv`);
    const t = window.setTimeout(() => cancelBtnRef.current?.focus(), 30);
    return () => window.clearTimeout(t);
  }, [open, definition, orgForExport]);

  useEffect(() => {
    if (!open) return;
    setFilename((cur) => `${(cur || fileBase(definition, orgForExport)).replace(/\.(csv|pdf)$/, '')}.${format}`);
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

  if (!open || !definition) return null;

  const rowCount = rows.length;

  const handleExport = async () => {
    if (saving) return;
    setSaving(true);
    await new Promise((r) => setTimeout(r, 400));

    const filterSummary = `Date: ${from || '—'} → ${to || '—'}${rangeLabel ? ` (${rangeLabel})` : ''}`;
    const generatedAt = new Date().toISOString();

    if (format === 'csv') {
      const csv = buildCsvFromSpec(rows, definition.csvColumns || [], {
        ctx: { officeById: new Map() },
      });
      downloadCsv(csv, filename || `${fileBase(definition, orgForExport)}.csv`);
      setSaving(false);
      onExported?.({ format: 'CSV', rowCount, filename });
      onClose?.();
      return;
    }
    const html = buildPdfHtmlFromSpec(rows, definition.pdfColumns || [], {
      orgName:       orgForExport?.name || 'CorpGMS',
      title:         definition.title,
      subtitle:      filterSummary,
      filterSummary,
      generatedBy:   user?.name || 'Unknown',
      generatedAtIso: generatedAt,
      pageOrientation: 'landscape',
    });
    const ok = openPdfPrintWindow(html);
    setSaving(false);
    if (ok) {
      onExported?.({ format: 'PDF', rowCount, filename });
      onClose?.();
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="rpt-export-title"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose?.(); }}
      className="fixed inset-0 z-[9500] flex items-center justify-center bg-black/55 p-4">
      <div className="w-full max-w-md rounded-[14px] border border-slate-200 bg-white shadow-2xl dark:border-[#142535] dark:bg-[#0A1828]">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-gradient-to-r from-sky-700 to-sky-800 px-5 py-4 text-white dark:border-[#142535]">
          <div className="min-w-0">
            <h3 id="rpt-export-title" className="font-[Outfit,sans-serif] text-[16px] font-extrabold leading-tight">
              Export · {definition.title}
            </h3>
            <p className="mt-0.5 text-[12px] opacity-85">
              {rowCount.toLocaleString('en-GB')} record{rowCount === 1 ? '' : 's'} in the current view.
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={saving}
            aria-label="Close dialog" title="Close"
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md bg-white/15 text-white hover:bg-white/25 disabled:opacity-40">
            <X size={15} aria-hidden="true" />
          </button>
        </div>

        <div className="px-5 py-4">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400">Format</p>
          <div role="radiogroup" aria-label="Export format" className="grid grid-cols-2 gap-2">
            <FormatCard active={format === 'csv'} Icon={FileSpreadsheet}
              label="CSV" description={`${definition.csvColumns?.length || 0} columns · Excel compatible`}
              onClick={() => setFormat('csv')} />
            <FormatCard active={format === 'pdf'} Icon={FileText}
              label="PDF" description={`${definition.pdfColumns?.length || 0} columns · Print dialog`}
              onClick={() => setFormat('pdf')} />
          </div>

          <label htmlFor="rpt-export-filename" className="mt-4 mb-1.5 block text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400">
            Filename
          </label>
          <input id="rpt-export-filename" type="text" value={filename}
            onChange={(e) => setFilename(e.target.value)}
            maxLength={200}
            className="w-full rounded-[10px] border border-slate-200 bg-white px-3 py-2 font-mono text-[12px] text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-200" />

          {format === 'pdf' && (
            <p className="mt-3 rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-500 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-400">
              PDF opens your browser&rsquo;s print dialog. Choose &ldquo;Save as PDF&rdquo; as the destination. If the window doesn&rsquo;t open, check your browser&rsquo;s popup settings.
            </p>
          )}

          {rowCount === 0 && (
            <p className="mt-3 rounded-[10px] border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
              No records in the current view — nothing to export.
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
            {saving ? <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              : (format === 'csv' ? <Download size={14} aria-hidden="true" /> : <Printer size={14} aria-hidden="true" />)}
            {saving ? 'Preparing…' : (format === 'csv' ? 'Download CSV' : 'Open Print Dialog')}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── helpers ───────────────────────────────────────────────── */

function fileBase(definition, org) {
  const reportSlug = String(definition?.key || 'report').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return `${reportSlug}-${orgSlug(org?.name)}-${timestampSlug()}`;
}

function useMemo_rows(data) {
  return useMemoShallow(() => data?.rows || [], [data]);
}

function useMemo_org(user, orgs) {
  return useMemoShallow(() => {
    if (String(user?.role || '').toLowerCase() === 'superadmin') return { name: 'All Tenants' };
    const orgId = user?.organisationId || user?.orgId;
    return (orgs || []).find((o) => o?.id === orgId) || { name: 'CorpGMS' };
  }, [user, orgs]);
}

/* Inline useMemo alias — kept local to avoid unused-import noise. */
function useMemoShallow(fn, deps) {
  const [val, setVal] = useState(fn);
  useEffect(() => { setVal(fn()); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, deps);
  return val;
}

function FormatCard({ active, Icon, label, description, onClick }) {
  return (
    <button type="button" role="radio" aria-checked={active}
      onClick={onClick}
      className={`flex cursor-pointer flex-col items-start gap-1 rounded-[12px] border p-3 text-left transition ${active
        ? 'border-sky-700 bg-sky-50 shadow-sm dark:border-sky-400 dark:bg-sky-500/15'
        : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-[#142535] dark:bg-[#071220] dark:hover:bg-[#1E1E3F]'}`}>
      <Icon size={20} aria-hidden="true" className={active ? 'text-sky-700 dark:text-sky-300' : 'text-slate-500 dark:text-slate-400'} />
      <span className={`text-[13px] font-extrabold ${active ? 'text-sky-700 dark:text-sky-300' : 'text-[#0C2340] dark:text-slate-100'}`}>{label}</span>
      <span className={`text-[11px] ${active ? 'text-sky-500 dark:text-sky-300' : 'text-slate-500 dark:text-slate-400'}`}>{description}</span>
    </button>
  );
}
