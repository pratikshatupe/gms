/**
 * guestLogAnalytics.js — pure helpers for the Guest Log module.
 *
 * No React imports. No data-store imports. Every function takes its
 * inputs explicitly so the list page, the export dialog, and any
 * future Reports / Audit surfaces can share the same filtering and
 * formatting logic without drift.
 */

import {
  formatDateGB, formatDateTime, formatAppointmentTime,
  getTimezoneAbbr, to12hAmPm,
} from './appointmentState';

/* ── Scope helpers ─────────────────────────────────────────────── */

/**
 * Decide whether a row belongs in the default Guest Log view.
 * Rule (Decision 9):
 *   • 'Checked-In', 'In-Progress', 'Completed', 'Cancelled',
 *     'No-Show' are always in-scope.
 *   • 'Approved' rows with a checkedInAt timestamp are in-scope.
 *   • 'Pending' and bare 'Approved' rows are excluded unless
 *     `includeScheduledOnly` is truthy.
 */
export function isGuestLogRow(apt, { includeScheduledOnly = false } = {}) {
  if (!apt) return false;
  const status = apt.status;
  if (!status) return false;
  if (includeScheduledOnly) return true;
  if (['Checked-In', 'In-Progress', 'Completed', 'Cancelled', 'No-Show'].includes(status)) {
    return true;
  }
  if (status === 'Approved' && apt.checkedInAt) return true;
  return false;
}

/* ── Row enrichment ────────────────────────────────────────────── */

/**
 * buildGuestLogRows — enrich raw appointments with resolved office,
 * host, room and service names so downstream views (table / drawer /
 * CSV / PDF) don't repeat the lookup gymnastics.
 *
 *   const rows = buildGuestLogRows(appointments, {
 *     offices, staff, services, orgs, includeScheduledOnly: false,
 *   });
 */
export function buildGuestLogRows(appointments, ctx = {}) {
  const {
    offices = [], staff = [], services = [], orgs = [],
    includeScheduledOnly = false,
  } = ctx;
  const officeById  = new Map((offices  || []).map((o) => [o?.id, o]).filter((e) => e[0]));
  const staffById   = new Map((staff    || []).map((s) => [s?.id, s]).filter((e) => e[0]));
  const serviceById = new Map((services || []).map((s) => [s?.id, s]).filter((e) => e[0]));
  const orgById     = new Map((orgs     || []).map((o) => [o?.id, o]).filter((e) => e[0]));

  return (appointments || [])
    .filter((a) => isGuestLogRow(a, { includeScheduledOnly }))
    .map((a) => {
      const office = officeById.get(a.officeId);
      const host   = staffById.get(a.hostUserId);
      const org    = orgById.get(a.orgId);
      const serviceRows = (a.servicesPrebooked || [])
        .map((id) => serviceById.get(id))
        .filter(Boolean);
      return {
        id:         a.id,
        apt:        a,
        orgId:      a.orgId,
        orgName:    org?.name || '',
        office,
        host,
        room:       a.roomId,
        serviceRows,
        visitorType: a.visitor?.visitorType || 'Regular',
        isWalkIn:    Boolean(a.isWalkIn),
      };
    });
}

/* ── Filtering ────────────────────────────────────────────────── */

function rangeDates(range, customStart, customEnd) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const startOfWeek = (() => {
    const d = new Date(now);
    const js = d.getDay();
    d.setDate(d.getDate() + (js === 0 ? -6 : 1 - js));
    return d.toISOString().slice(0, 10);
  })();
  const endOfWeek = (() => {
    const d = new Date(now);
    const js = d.getDay();
    d.setDate(d.getDate() + (js === 0 ? 0 : 7 - js));
    return d.toISOString().slice(0, 10);
  })();
  const startOfMonth = (() => {
    const d = new Date(now); d.setDate(1);
    return d.toISOString().slice(0, 10);
  })();
  const endOfMonth = (() => {
    const d = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return d.toISOString().slice(0, 10);
  })();

  switch (range) {
    case 'today':  return { from: today,        to: today };
    case 'week':   return { from: startOfWeek,  to: endOfWeek };
    case 'month':  return { from: startOfMonth, to: endOfMonth };
    case 'custom': return { from: customStart || '', to: customEnd || '' };
    default:       return { from: '', to: '' };
  }
}

/**
 * filterGuestLog — full filter pipeline.
 *
 * Args:
 *   rows:   output of buildGuestLogRows().
 *   filters: {
 *     search, dateRange ('all'|'today'|'week'|'month'|'custom'),
 *     customStart, customEnd, status, officeId, hostUserId,
 *     visitorType, includeScheduledOnly,
 *   }
 */
export function filterGuestLog(rows, filters = {}) {
  const {
    search = '', dateRange = 'all',
    customStart = '', customEnd = '',
    status = 'all', officeId = 'all', hostUserId = 'all',
    visitorType = 'all',
  } = filters;

  const q = String(search || '').trim().toLowerCase();
  const { from, to } = rangeDates(dateRange, customStart, customEnd);

  return rows.filter((r) => {
    const a = r.apt;
    const d = (a.scheduledDate || a.date || '').slice(0, 10);
    if (from && d < from) return false;
    if (to && d > to)     return false;
    if (status !== 'all' && a.status !== status) return false;
    if (officeId !== 'all' && a.officeId !== officeId) return false;
    if (hostUserId !== 'all' && a.hostUserId !== hostUserId) return false;
    if (visitorType !== 'all' && r.visitorType !== visitorType) return false;
    if (q) {
      const hay = [
        a.id, a.visitor?.fullName, a.visitor?.emailId,
        a.visitor?.companyName, a.visitor?.contactNumber,
        a.purpose, a.host,
      ].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function validateCustomDateRange(start, end) {
  if (!start && !end) return null;
  if (!start || !end) return 'Select both start and end dates.';
  const today = new Date().toISOString().slice(0, 10);
  const twoYearsAgo = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 2);
    return d.toISOString().slice(0, 10);
  })();
  if (start < twoYearsAgo) return 'Date must be within the last 2 years.';
  if (end > today)         return 'Date cannot be in the future.';
  if (start > end)         return 'Start date must be before or equal to end date.';
  return null;
}

/* ── Presets for the custom range picker ──────────────────────── */

export function datePresets() {
  const now = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);
  const endToday = iso(now);

  const last7 = new Date(now);
  last7.setDate(last7.getDate() - 6);
  const last30 = new Date(now);
  last30.setDate(last30.getDate() - 29);

  const quarter = new Date(now);
  const qMonth = Math.floor(quarter.getMonth() / 3) * 3;
  quarter.setMonth(qMonth); quarter.setDate(1);

  const year = new Date(now.getFullYear(), 0, 1);

  return [
    { key: 'last7',   label: 'Last 7 days',      start: iso(last7),   end: endToday },
    { key: 'last30',  label: 'Last 30 days',     start: iso(last30),  end: endToday },
    { key: 'qtd',     label: 'Quarter to date',  start: iso(quarter), end: endToday },
    { key: 'ytd',     label: 'Year to date',     start: iso(year),    end: endToday },
  ];
}

/* ── Duration + mask helpers ─────────────────────────────────── */

export function computeDurationMins(apt) {
  const inAt = apt?.checkedInAt ? new Date(apt.checkedInAt).getTime() : null;
  const outAt = apt?.checkedOutAt ? new Date(apt.checkedOutAt).getTime() : null;
  if (!inAt || !outAt) return null;
  const diff = Math.floor((outAt - inAt) / 60000);
  return diff < 0 ? null : diff;
}

export function formatDuration(mins) {
  if (mins == null || !Number.isFinite(mins)) return '—';
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/**
 * Mask the last N of an ID number with 'X' prefix so drawer display
 * doesn't leak full PII. For Aadhaar "1234 5678 9012" → "XXXX XXXX 9012".
 */
export function maskIdNumber(idType, idNumberDisplay) {
  if (!idNumberDisplay) return '';
  if (idType === 'Aadhaar') {
    const digits = String(idNumberDisplay).replace(/\s+/g, '');
    if (digits.length !== 12) return idNumberDisplay;
    return `XXXX XXXX ${digits.slice(8)}`;
  }
  if (idType === 'Emirates ID') {
    const digits = String(idNumberDisplay).replace(/[-\s]+/g, '');
    if (digits.length !== 15) return idNumberDisplay;
    return `784-XXXX-XXXXXXX-${digits.slice(14)}`;
  }
  /* Generic mask — keep last 4 chars. */
  const s = String(idNumberDisplay);
  if (s.length <= 4) return s;
  return `${'X'.repeat(s.length - 4)}${s.slice(-4)}`;
}

/* ── CSV export ───────────────────────────────────────────────── */

const CSV_COLUMNS = Object.freeze([
  'SR. No.', 'Appointment ID', 'Visitor Name', 'Company', 'Contact Number',
  'Email ID', 'Visitor Type', 'Host Name', 'Office Name', 'Room Name',
  'Date (DD/MM/YYYY)', 'Start Time (12h)', 'End Time (12h)', 'Timezone',
  'Status', 'Check-In Time', 'Check-Out Time', 'Duration (mins)',
  'Walk-In?', 'Services Availed', 'Feedback Rating',
]);

function csvQuote(value) {
  if (value == null) return '""';
  const s = String(value);
  /* Always quote to satisfy RFC 4180 strictly. */
  return `"${s.replace(/"/g, '""')}"`;
}

function csvContactExcelGuard(value) {
  if (!value) return '';
  /* Prefix with = so Excel treats it as a formula result (text), not
     a number — preserves leading "+" and spaces. */
  return `=${csvQuote(value)}`;
}

export function buildCsv(rows, { org } = {}) {
  const bom = '\uFEFF';
  const header = CSV_COLUMNS.map(csvQuote).join(',');
  const body = rows.map((r, idx) => {
    const a = r.apt;
    const tz = getTimezoneAbbr(r.office?.operations?.timezone);
    const duration = computeDurationMins(a);
    const checkInDisp  = a.checkedInAt  ? formatDateTime(a.checkedInAt)  : '';
    const checkOutDisp = a.checkedOutAt ? formatDateTime(a.checkedOutAt) : '';
    const servicesAvailed = (r.serviceRows || []).map((s) => s?.name).filter(Boolean).join(';');
    const rating = a.feedback?.rating != null ? String(a.feedback.rating) : '';
    const fields = [
      String(idx + 1),
      a.id || '',
      a.visitor?.fullName || '',
      a.visitor?.companyName || '',
      /* Email stays quoted normal; contact gets the Excel =" " guard. */
      null, /* placeholder for email, replaced after */
      a.visitor?.emailId || '',
      a.visitor?.visitorType || '',
      r.host?.fullName || r.host?.name || a.host || '',
      r.office?.name || '',
      a.room || '',
      formatDateGB(a.scheduledDate || a.date),
      to12hAmPm(a.startTime),
      to12hAmPm(a.endTime),
      tz,
      a.status || '',
      checkInDisp,
      checkOutDisp,
      duration == null ? '' : String(duration),
      a.isWalkIn ? 'Yes' : 'No',
      servicesAvailed,
      rating,
    ];
    /* Contact Number slot (column 5) uses the Excel text guard. */
    fields[4] = csvContactExcelGuard(a.visitor?.contactNumber || '');
    /* Everything else goes through the standard CSV quoter, skipping
       the already-guarded contact cell. */
    return fields.map((v, i) => (i === 4 ? v : csvQuote(v))).join(',');
  }).join('\r\n');
  return `${bom}${header}\r\n${body}${body ? '\r\n' : ''}`;
}

export function downloadCsv(csvString, filename) {
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename || 'guest-log.csv';
  a.style.display = 'none';
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

/* ── PDF export — browser print-to-PDF path ─────────────────── */

const PDF_COLUMNS = Object.freeze([
  { key: 'sr',         label: 'SR. No.',     width: '15mm' },
  { key: 'visitor',    label: 'Visitor',     width: '60mm' },
  { key: 'host',       label: 'Host',        width: '35mm' },
  { key: 'office',     label: 'Office',      width: '35mm' },
  { key: 'date',       label: 'Date',        width: '25mm' },
  { key: 'in',         label: 'Check-In',    width: '25mm' },
  { key: 'out',        label: 'Check-Out',   width: '25mm' },
  { key: 'status',     label: 'Status',      width: '25mm' },
  { key: 'type',       label: 'Type',        width: '25mm' },
]);

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function pdfStatusColor(status) {
  switch (status) {
    case 'Completed':   return '#15803D';
    case 'Cancelled':   return '#64748B';
    case 'No-Show':     return '#DC2626';
    case 'In-Progress': return '#0284C7';
    case 'Checked-In':  return '#2563EB';
    case 'Approved':    return '#059669';
    case 'Pending':     return '#B45309';
    default:            return '#64748B';
  }
}

export function buildPdfHtml(rows, ctx = {}) {
  const {
    org, filterSummary, generatedBy, generatedAtIso,
  } = ctx;
  const genAt = generatedAtIso ? formatDateTime(generatedAtIso) : formatDateTime(new Date().toISOString());

  const headerRow = PDF_COLUMNS.map(
    (c) => `<th style="width:${c.width};text-align:left;padding:4px 6px;border-bottom:2px solid #0C2340;font-size:9pt;">${escapeHtml(c.label)}</th>`,
  ).join('');

  const bodyRows = rows.map((r, idx) => {
    const a = r.apt;
    const checkInDisp  = a.checkedInAt  ? formatDateTime(a.checkedInAt)  : '—';
    const checkOutDisp = a.checkedOutAt ? formatDateTime(a.checkedOutAt) : '—';
    return `
      <tr style="page-break-inside:avoid;">
        <td style="padding:4px 6px;border-bottom:1px solid #E5E7EB;font-size:9pt;color:#94A3B8;">${idx + 1}</td>
        <td style="padding:4px 6px;border-bottom:1px solid #E5E7EB;font-size:9pt;">
          <div style="font-weight:700;">${escapeHtml(a.visitor?.fullName || a.guestName || '—')}</div>
          ${a.visitor?.companyName ? `<div style="font-size:8pt;color:#6B7280;">${escapeHtml(a.visitor.companyName)}</div>` : ''}
        </td>
        <td style="padding:4px 6px;border-bottom:1px solid #E5E7EB;font-size:9pt;">${escapeHtml(r.host?.fullName || r.host?.name || a.host || '—')}</td>
        <td style="padding:4px 6px;border-bottom:1px solid #E5E7EB;font-size:9pt;">${escapeHtml(r.office?.name || '—')}</td>
        <td style="padding:4px 6px;border-bottom:1px solid #E5E7EB;font-size:9pt;">${escapeHtml(formatDateGB(a.scheduledDate || a.date))}</td>
        <td style="padding:4px 6px;border-bottom:1px solid #E5E7EB;font-size:9pt;">${escapeHtml(checkInDisp)}</td>
        <td style="padding:4px 6px;border-bottom:1px solid #E5E7EB;font-size:9pt;">${escapeHtml(checkOutDisp)}</td>
        <td style="padding:4px 6px;border-bottom:1px solid #E5E7EB;font-size:9pt;">
          <span style="display:inline-block;padding:1px 6px;border-radius:10px;font-weight:700;background:${pdfStatusColor(a.status)}22;color:${pdfStatusColor(a.status)};">${escapeHtml(a.status || '—')}</span>
        </td>
        <td style="padding:4px 6px;border-bottom:1px solid #E5E7EB;font-size:9pt;">${escapeHtml(a.visitor?.visitorType || '—')}${a.isWalkIn ? ' · Walk-in' : ''}</td>
      </tr>
    `;
  }).join('');

  return `<!doctype html>
<html lang="en-GB">
  <head>
    <meta charset="utf-8" />
    <title>Guest Log Report — ${escapeHtml(org?.name || 'CorpGMS')}</title>
    <style>
      @page { size: A4 landscape; margin: 15mm; }
      html, body { margin: 0; padding: 0; color: #0C2340; font-family: 'Plus Jakarta Sans', Arial, sans-serif; }
      .cover { page-break-after: always; padding: 20mm 10mm; }
      .cover h1 { font-family: 'Outfit', Arial, sans-serif; font-size: 28pt; margin: 0 0 4pt 0; }
      .cover h2 { font-size: 14pt; margin: 6pt 0 16pt 0; color: #6B7280; font-weight: 600; }
      .cover .meta { font-size: 10pt; line-height: 1.7; color: #374151; }
      .cover .meta .label { color: #6B7280; display: inline-block; min-width: 140px; }
      table { width: 100%; border-collapse: collapse; }
      thead { display: table-header-group; }
      tr { page-break-inside: avoid; }
      .footer {
        position: fixed; bottom: 8mm; left: 15mm; right: 15mm;
        font-size: 8pt; color: #6B7280;
        display: flex; justify-content: space-between;
      }
      @media print {
        .no-print { display: none !important; }
      }
    </style>
  </head>
  <body>
    <div class="cover">
      <div style="border-bottom: 3px solid #0284C7; padding-bottom: 12pt; margin-bottom: 16pt;">
        <div style="font-family: 'Outfit', Arial, sans-serif; font-weight: 800; font-size: 14pt; color: #0284C7;">
          ${escapeHtml(org?.name || 'CorpGMS')}
        </div>
      </div>
      <h1>Guest Log Report</h1>
      <h2>${escapeHtml(rows.length.toLocaleString('en-GB'))} record${rows.length === 1 ? '' : 's'}</h2>
      <div class="meta">
        <div><span class="label">Filter summary:</span>${escapeHtml(filterSummary || 'All records')}</div>
        <div><span class="label">Generated by:</span>${escapeHtml(generatedBy || '—')}</div>
        <div><span class="label">Generated at:</span>${escapeHtml(genAt)}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr style="background:#E0F2FE;">${headerRow}</tr>
      </thead>
      <tbody>
        ${bodyRows || `<tr><td colspan="9" style="padding:20pt;text-align:center;color:#6B7280;font-size:10pt;">No records found.</td></tr>`}
      </tbody>
    </table>

    <div class="footer">
      <div>Guest Log Report · ${escapeHtml(org?.name || 'CorpGMS')}</div>
      <div>${escapeHtml(genAt)}</div>
    </div>

    <script>
      window.addEventListener('load', function() {
        window.focus();
        setTimeout(function() { window.print(); }, 250);
      });
      window.addEventListener('afterprint', function() { window.close(); });
    </script>
  </body>
</html>`;
}

export function openPdfPrintWindow(html, onError) {
  const notify = (msg) => {
    if (typeof onError === 'function') onError(msg);
    else console.error('[openPdfPrintWindow]', msg);
  };
  let w = null;
  try {
    w = window.open('', '_blank', 'width=1200,height=900,menubar=no,toolbar=no');
  } catch { /* popup blocked */ }
  if (!w) {
    notify('Print window could not open. Please check your browser\'s popup settings.');
    return false;
  }
  try {
    w.document.open(); w.document.write(html); w.document.close();
  } catch {
    if (w && !w.closed) w.close();
    notify('Print window could not be prepared. Please try again.');
    return false;
  }
  return true;
}

/* ── Filename helpers ────────────────────────────────────────── */

export function orgSlug(orgName) {
  return String(orgName || 'org')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function timestampSlug(now = new Date()) {
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
}

export function exportFilename(format, org, now) {
  return `guest-log-${orgSlug(org?.name)}-${timestampSlug(now)}.${format}`;
}

/* ── Display formatting helpers (re-exported for consumers) ──── */

export { formatDateGB, formatDateTime, formatAppointmentTime, to12hAmPm, getTimezoneAbbr };

export { CSV_COLUMNS, PDF_COLUMNS };
