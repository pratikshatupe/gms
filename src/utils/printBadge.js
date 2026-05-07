/**
 * Opens a print-ready window with a single visitor badge and triggers the
 * browser print dialog. Designed for a badge-sized layout (~4in × 3in) so
 * most thermal / label printers produce a clean page.
 */

function escapeHtml(value) {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function initials(name) {
  if (!name) return '?';
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/**
 * @param {Object} entry
 *   - guestName, company, host, purpose
 *   - checkInTime (ISO), id (badge id)
 *   - photoDataUrl (optional) — data: URL or remote src for captured photo
 *   - officeName (optional)
 *   - idType, idNumber (optional)
 */
export function printVisitorBadge(entry) {
  if (!entry) return;
  const win = window.open('', '_blank', 'width=520,height=420');
  if (!win) return;

  const photoBlock = entry.photoDataUrl
    ? `<img src="${escapeHtml(entry.photoDataUrl)}" alt="Visitor photo" class="photo" />`
    : `<div class="photo placeholder">${escapeHtml(initials(entry.guestName))}</div>`;

  const idLine = entry.idType && entry.idNumber
    ? `<div class="row"><span class="label">ID</span><span class="value">${escapeHtml(entry.idType)} · ${escapeHtml(entry.idNumber)}</span></div>`
    : '';

  const html = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8"/>
        <title>Visitor Badge — ${escapeHtml(entry.guestName || '')}</title>
        <style>
          @page { size: 4in 3in; margin: 0; }
          * { box-sizing: border-box; }
          html, body { margin: 0; padding: 0; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
            color: #0f172a;
          }
          .badge {
            width: 4in; height: 3in; padding: 10px 14px;
            display: flex; flex-direction: column; gap: 6px;
            border: 1px solid #cbd5e1;
          }
          .header {
            display: flex; justify-content: space-between; align-items: center;
            border-bottom: 2px solid #6d28d9; padding-bottom: 4px;
          }
          .header .kind {
            font-size: 10px; font-weight: 700; color: #6d28d9;
            letter-spacing: 0.12em; text-transform: uppercase;
          }
          .header .office { font-size: 9px; color: #64748b; }
          .body { display: flex; gap: 10px; flex: 1; align-items: stretch; }
          .photo {
            width: 72px; height: 72px; border-radius: 8px; flex-shrink: 0;
            object-fit: cover; border: 1px solid #e2e8f0;
          }
          .photo.placeholder {
            display: flex; align-items: center; justify-content: center;
            background: #f1f5f9; color: #475569; font-weight: 700; font-size: 24px;
          }
          .info { flex: 1; min-width: 0; }
          .name { font-size: 15px; font-weight: 800; line-height: 1.15; }
          .company { font-size: 11px; color: #64748b; margin-top: 1px; }
          .rows { margin-top: 6px; font-size: 10px; line-height: 1.35; }
          .row { display: flex; gap: 4px; }
          .row .label {
            font-weight: 700; color: #94a3b8; text-transform: uppercase;
            letter-spacing: 0.05em; font-size: 9px; width: 48px; flex-shrink: 0;
            padding-top: 1px;
          }
          .row .value { color: #1f2937; }
          .footer {
            border-top: 1px dashed #cbd5e1; padding-top: 4px;
            display: flex; justify-content: space-between; font-size: 9px; color: #94a3b8;
          }
          .toolbar { padding: 10px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
          .toolbar button {
            padding: 6px 12px; font-size: 12px; font-weight: 600; color: #fff;
            background: #6d28d9; border: none; border-radius: 6px; cursor: pointer;
          }
          @media print { .toolbar { display: none; } }
        </style>
      </head>
      <body>
        <div class="toolbar"><button onclick="window.print()">Print badge</button></div>
        <div class="badge">
          <div class="header">
            <span class="kind">Visitor Pass</span>
            <span class="office">${escapeHtml(entry.officeName || '')}</span>
          </div>
          <div class="body">
            ${photoBlock}
            <div class="info">
              <div class="name">${escapeHtml(entry.guestName || '—')}</div>
              <div class="company">${escapeHtml(entry.company || '')}</div>
              <div class="rows">
                <div class="row"><span class="label">Host</span><span class="value">${escapeHtml(entry.host || '—')}</span></div>
                <div class="row"><span class="label">Purpose</span><span class="value">${escapeHtml(entry.purpose || '—')}</span></div>
                <div class="row"><span class="label">In</span><span class="value">${escapeHtml(formatTime(entry.checkInTime))}</span></div>
                ${idLine}
              </div>
            </div>
          </div>
          <div class="footer">
            <span>Badge · ${escapeHtml(entry.id || '')}</span>
            <span>Please return on exit</span>
          </div>
        </div>
        <script>
          window.addEventListener('load', function () {
            setTimeout(function () { window.print(); }, 250);
          });
        </script>
      </body>
    </html>
  `;

  win.document.open();
  win.document.write(html);
  win.document.close();
}
