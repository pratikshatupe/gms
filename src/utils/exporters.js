/**
 * Zero-dependency exporters for report / list pages.
 *
 * - downloadCsv:  standard comma-separated, Excel-friendly.
 * - downloadXls:  Excel-compatible HTML table, saved with `.xls` extension
 *                 and `application/vnd.ms-excel` MIME type. Excel opens it
 *                 natively (with a one-time format warning on some builds).
 * - printToPdf:   opens a styled print window and calls window.print();
 *                 the user picks "Save as PDF" in the browser dialog.
 */

function escapeCsv(value) {
  if (value == null) return '';
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function escapeHtml(value) {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadCsv(filename, rows) {
  if (!rows || rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const body = rows
    .map((row) => headers.map((h) => escapeCsv(row[h])).join(','))
    .join('\n');
  const csv = `${headers.join(',')}\n${body}`;
  triggerDownload(
    new Blob([csv], { type: 'text/csv;charset=utf-8' }),
    filename.endsWith('.csv') ? filename : `${filename}.csv`,
  );
}

/**
 * Humanizes snake_case / camelCase keys into readable column headers
 * ("visitor_name" → "Visitor Name").
 */
function humanizeHeader(key) {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function downloadXls(filename, rows, options = {}) {
  if (!rows || rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const title = options.title || filename;
  const html =
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" ' +
    'xmlns:x="urn:schemas-microsoft-com:office:excel" ' +
    'xmlns="http://www.w3.org/TR/REC-html40">' +
    '<head><meta charset="utf-8"/><title>' + escapeHtml(title) + '</title></head>' +
    '<body>' +
    '<table border="1" cellspacing="0" cellpadding="4">' +
    '<thead><tr>' +
    headers.map((h) => `<th>${escapeHtml(humanizeHeader(h))}</th>`).join('') +
    '</tr></thead>' +
    '<tbody>' +
    rows
      .map(
        (row) =>
          '<tr>' +
          headers.map((h) => `<td>${escapeHtml(row[h])}</td>`).join('') +
          '</tr>',
      )
      .join('') +
    '</tbody>' +
    '</table>' +
    '</body></html>';
  /* BOM so Excel detects UTF-8 consistently. */
  const blob = new Blob(['\uFEFF', html], {
    type: 'application/vnd.ms-excel;charset=utf-8',
  });
  triggerDownload(
    blob,
    filename.match(/\.(xls|xlsx)$/i) ? filename : `${filename}.xls`,
  );
}

/**
 * Opens a styled print window and triggers the browser print dialog.
 * Users choose "Save as PDF" to produce a PDF.
 *
 *   rows     — array of row objects (same shape as CSV/XLS rows)
 *   options  — { title, subtitle, filename }
 */
export function printToPdf(rows, options = {}) {
  if (!rows || rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const title = options.title || 'Report';
  const subtitle = options.subtitle || '';
  const generatedAt = new Date().toLocaleString();

  const win = window.open('', '_blank', 'width=1000,height=700');
  if (!win) {
    /* Popup blocked — fall back to a hidden iframe on the current page. */
    printInCurrentWindow({ headers, rows, title, subtitle, generatedAt });
    return;
  }

  const styles = `
    <style>
      @page { size: A4 landscape; margin: 14mm; }
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
             color: #1f2937; margin: 0; padding: 20px; }
      h1 { font-size: 18px; margin: 0 0 4px; }
      .subtitle { color: #64748b; font-size: 12px; margin: 0 0 16px; }
      .meta { color: #94a3b8; font-size: 11px; margin-bottom: 12px; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; }
      th { text-align: left; background: #f1f5f9; color: #475569;
           text-transform: uppercase; letter-spacing: 0.03em; font-size: 10px;
           padding: 8px; border-bottom: 1px solid #cbd5e1; }
      td { padding: 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
      tr:nth-child(even) td { background: #fafafa; }
      @media print {
        button { display: none; }
        tr { break-inside: avoid; }
      }
      .toolbar { margin-bottom: 16px; }
      .toolbar button {
        padding: 8px 14px; font-size: 13px; font-weight: 600; color: #fff;
        background: #6d28d9; border: none; border-radius: 6px; cursor: pointer;
      }
    </style>
  `;

  const html = `
    <!doctype html>
    <html>
      <head><meta charset="utf-8"/><title>${escapeHtml(title)}</title>${styles}</head>
      <body>
        <div class="toolbar"><button onclick="window.print()">Print / Save as PDF</button></div>
        <h1>${escapeHtml(title)}</h1>
        ${subtitle ? `<p class="subtitle">${escapeHtml(subtitle)}</p>` : ''}
        <p class="meta">Generated: ${escapeHtml(generatedAt)} · ${rows.length} rows</p>
        <table>
          <thead><tr>${headers.map((h) => `<th>${escapeHtml(humanizeHeader(h))}</th>`).join('')}</tr></thead>
          <tbody>
            ${rows
              .map(
                (row) =>
                  `<tr>${headers.map((h) => `<td>${escapeHtml(row[h])}</td>`).join('')}</tr>`,
              )
              .join('')}
          </tbody>
        </table>
        <script>
          window.addEventListener('load', function () {
            setTimeout(function () { window.print(); }, 300);
          });
        </script>
      </body>
    </html>
  `;

  win.document.open();
  win.document.write(html);
  win.document.close();
}

function printInCurrentWindow({ headers, rows, title, subtitle, generatedAt }) {
  const frame = document.createElement('iframe');
  frame.style.position = 'fixed';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  document.body.appendChild(frame);
  const doc = frame.contentDocument || frame.contentWindow.document;
  doc.open();
  doc.write(`
    <html><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title>
    <style>
      @page { size: A4 landscape; margin: 14mm; }
      body { font-family: Arial, sans-serif; color: #1f2937; }
      h1 { font-size: 18px; margin: 0 0 4px; }
      .subtitle { color: #64748b; font-size: 12px; margin: 0 0 12px; }
      .meta { color: #94a3b8; font-size: 11px; margin-bottom: 12px; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; }
      th { background: #f1f5f9; padding: 8px; border-bottom: 1px solid #cbd5e1; text-align: left; }
      td { padding: 8px; border-bottom: 1px solid #e2e8f0; }
    </style></head>
    <body>
      <h1>${escapeHtml(title)}</h1>
      ${subtitle ? `<p class="subtitle">${escapeHtml(subtitle)}</p>` : ''}
      <p class="meta">Generated: ${escapeHtml(generatedAt)} · ${rows.length} rows</p>
      <table>
        <thead><tr>${headers.map((h) => `<th>${escapeHtml(humanizeHeader(h))}</th>`).join('')}</tr></thead>
        <tbody>
          ${rows
            .map(
              (row) =>
                `<tr>${headers.map((h) => `<td>${escapeHtml(row[h])}</td>`).join('')}</tr>`,
            )
            .join('')}
        </tbody>
      </table>
    </body></html>
  `);
  doc.close();
  frame.contentWindow.focus();
  frame.contentWindow.print();
  setTimeout(() => frame.remove(), 2000);
}
