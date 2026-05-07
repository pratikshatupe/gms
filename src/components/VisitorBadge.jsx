import React, { useRef } from 'react';
import { Printer, X } from 'lucide-react';
import { to12hAmPm, formatDateGB } from '../utils/appointmentState';

/**
 * VisitorBadge — printable badge preview modal.
 *
 * Renders a 3.375" × 2.125" landscape ID-card preview with the
 * visitor's photo, name, company, host, room, valid window and a
 * QR placeholder. The Print button opens a new window, writes the
 * badge HTML with a dedicated print stylesheet, fires
 * window.print(), and closes on print complete. This avoids the
 * in-place print fragility (reception often has multiple tabs and
 * side drawers open — in-place print can layout those surfaces).
 */

/* TODO Module 5 Guest Log — generate QR payload pointing to
   /checkout/:appointmentId. Replace the <QrPlaceholder /> box with
   an actual QR component (qrcode.react library or similar) once
   self-check-out ships. */
function QrPlaceholder() {
  return (
    <div
      aria-hidden="true"
      style={{
        width: 64, height: 64,
        border: '2px solid #0C2340',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'monospace', fontSize: 11, fontWeight: 700,
        color: '#0C2340', background: '#E0F2FE',
      }}
    >
      QR
    </div>
  );
}

/* Returns the raw HTML string used by the print window. Keeping the
   print-target HTML as a string (not a React subtree) makes the
   new-window pattern robust across browsers. */
function badgePrintHtml({ badge }) {
  const photoSrc = badge.photoDataUrl || '';
  return `<!doctype html>
<html lang="en-GB">
  <head>
    <meta charset="utf-8" />
    <title>Visitor Badge — ${escapeHtml(badge.visitorName)} — ${escapeHtml(badge.badgeNumber)}</title>
    <style>
      @page { size: 3.375in 2.125in landscape; margin: 0; }
      html, body { margin: 0; padding: 0; background: #fff; }
      * { box-sizing: border-box; }
      .badge {
        width: 3.375in; height: 2.125in;
        padding: 0.12in 0.14in; display: grid;
        grid-template-columns: 0.9in 1fr; gap: 0.1in;
        font-family: 'Plus Jakarta Sans', Arial, sans-serif;
        color: #0C2340;
        border: 2px solid #0C2340; border-radius: 6px;
      }
      .badge-header {
        grid-column: 1 / span 2;
        display: flex; align-items: center; justify-content: space-between;
        border-bottom: 2px solid #0284C7; padding-bottom: 4px; margin-bottom: 4px;
      }
      .org {
        font-family: 'Outfit', Arial, sans-serif;
        font-size: 10pt; font-weight: 800; letter-spacing: -0.3px;
      }
      .type {
        font-family: 'Outfit', Arial, sans-serif;
        font-size: 9pt; font-weight: 800;
        background: #0284C7; color: #fff; padding: 2px 6px; border-radius: 3px;
      }
      .photo {
        width: 0.9in; height: 1in; object-fit: cover;
        border: 1px solid #0C2340; background: #E0F2FE;
        display: flex; align-items: center; justify-content: center;
        font-size: 9pt; color: #6B7280;
      }
      .info { display: flex; flex-direction: column; gap: 2px; font-size: 9pt; line-height: 1.3; }
      .name { font-family: 'Outfit', Arial, sans-serif; font-size: 11pt; font-weight: 800; }
      .meta { font-size: 8pt; color: #4C4A7A; }
      .row { display: flex; gap: 4px; }
      .label { font-weight: 700; color: #6B7280; min-width: 44px; }
      .footer {
        grid-column: 1 / span 2;
        display: flex; align-items: center; justify-content: space-between;
        border-top: 1px dashed #BAE6FD; padding-top: 4px; margin-top: 2px;
        font-size: 7pt; color: #6B7280;
      }
      .qr {
        width: 0.5in; height: 0.5in; border: 1.5px solid #0C2340;
        display: flex; align-items: center; justify-content: center;
        font-family: monospace; font-size: 8pt; font-weight: 700;
        color: #0C2340; background: #E0F2FE;
      }
      @media print {
        html, body { width: 3.375in; height: 2.125in; }
      }
    </style>
  </head>
  <body>
    <div class="badge">
      <div class="badge-header">
        <div class="org">${escapeHtml(badge.orgName || 'CorpGMS')}</div>
        <div class="type">${escapeHtml(badge.header || 'VISITOR')}</div>
      </div>
      ${photoSrc
        ? `<img class="photo" src="${escapeHtml(photoSrc)}" alt="Visitor photo" />`
        : `<div class="photo">No Photo</div>`
      }
      <div class="info">
        <div class="name">${escapeHtml(badge.visitorName)}</div>
        ${badge.accompanyingCount > 0 ? `<div class="meta">+${escapeHtml(String(badge.accompanyingCount))} accompanying</div>` : ''}
        ${badge.companyName ? `<div class="meta">${escapeHtml(badge.companyName)}</div>` : ''}
        <div class="row"><div class="label">Host:</div><div>${escapeHtml(badge.hostName || '—')}</div></div>
        ${badge.roomName ? `<div class="row"><div class="label">Room:</div><div>${escapeHtml(badge.roomName)}</div></div>` : ''}
        <div class="row"><div class="label">Valid:</div><div>${escapeHtml(badge.validWindow || '—')}</div></div>
      </div>
      <div class="footer">
        <div>
          <div><strong>${escapeHtml(badge.badgeNumber)}</strong></div>
          <div>${escapeHtml(badge.dateStr || '')}</div>
        </div>
        <div class="qr">QR</div>
      </div>
    </div>
    <script>
      window.addEventListener('load', function() {
        window.focus();
        setTimeout(function() { window.print(); }, 150);
      });
      window.addEventListener('afterprint', function() { window.close(); });
    </script>
  </body>
</html>`;
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Compose a badge-ready payload from an appointment + supporting
 * context (office, host, room, org). Exported so the appointment
 * detail page can reprint later.
 */
export function badgeFromAppointment({ appointment, org, office, host, room }) {
  const apt = appointment || {};
  const visitor = apt.visitor || {};
  const accCount = Number(visitor.accompanyingCount) || 0;
  const baseHeader = accCount > 0
    ? `VISITOR + ${accCount} GUEST${accCount === 1 ? '' : 'S'}`
    : 'VISITOR';
  const validWindow = apt.startTime && apt.endTime
    ? `${to12hAmPm(apt.startTime)} – ${to12hAmPm(apt.endTime)}`
    : to12hAmPm(apt.startTime);
  return {
    badgeNumber: apt.badgeNumber || '—',
    orgName:     org?.name || 'CorpGMS',
    header:      baseHeader,
    visitorName: visitor.fullName || apt.guestName || 'Visitor',
    accompanyingCount: accCount,
    companyName: visitor.companyName || apt.company || '',
    hostName:    (host?.fullName || host?.name || apt.host || '—'),
    roomName:    (room?.name || apt.room || ''),
    photoDataUrl: visitor.photoDataUrl || '',
    dateStr:     formatDateGB(apt.scheduledDate || apt.date),
    validWindow,
  };
}

/* ═══════════════════════════════════════════════════════════════════
 *   React component — preview modal
 * ═══════════════════════════════════════════════════════════════════ */

export default function VisitorBadge({ open, badge, onClose, onPrinted, onError }) {
  const printedRef = useRef(false);

  if (!open || !badge) return null;

  const accCount = Number(badge.accompanyingCount) || 0;

  const handlePrint = () => {
    const html = badgePrintHtml({ badge });
    const notify = (msg) => {
      if (typeof onError === 'function') onError(msg);
      else console.error('[VisitorBadge]', msg);
    };
    let w = null;
    try {
      w = window.open('', '_blank', 'width=560,height=420,menubar=no,toolbar=no');
    } catch { /* popup blocked */ }
    if (!w) {
      notify('Print window could not open. Please check your browser\'s popup settings.');
      return;
    }
    try {
      w.document.open();
      w.document.write(html);
      w.document.close();
    } catch {
      if (w && !w.closed) w.close();
      notify('Print window could not be prepared. Please try again.');
      return;
    }
    printedRef.current = true;
    onPrinted?.();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="badge-title"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      className="fixed inset-0 z-[9500] flex items-center justify-center bg-black/55 p-4"
    >
      <div className="w-full max-w-lg rounded-[14px] border border-slate-200 bg-white shadow-2xl dark:border-[#142535] dark:bg-[#0A1828]">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-gradient-to-r from-sky-700 to-sky-800 px-5 py-4 text-white dark:border-[#142535]">
          <div className="min-w-0">
            <h3 id="badge-title" className="font-[Outfit,sans-serif] text-[16px] font-extrabold leading-tight">
              Visitor Badge
            </h3>
            <p className="mt-0.5 text-[12px] opacity-85">
              Preview, print, or close without printing.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close dialog" title="Close"
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md bg-white/15 text-white hover:bg-white/25">
            <X size={15} aria-hidden="true" />
          </button>
        </div>

        <div className="px-5 py-5">
          {/* On-screen preview — roughly matches the print layout. */}
          <div
            className="mx-auto overflow-hidden rounded-[6px] border-2 border-[#0C2340] bg-white"
            style={{ width: 324, height: 204 /* approx 3.375in × 2.125in at 96dpi */ }}
          >
            <div className="flex items-center justify-between border-b-2 border-sky-700 px-3 py-1.5">
              <div className="font-[Outfit,sans-serif] text-[11px] font-extrabold text-[#0C2340]">{badge.orgName || 'CorpGMS'}</div>
              <div className="rounded-sm bg-sky-700 px-1.5 py-0.5 font-[Outfit,sans-serif] text-[9px] font-extrabold uppercase text-white">
                {badge.header || 'VISITOR'}
              </div>
            </div>
            <div className="grid grid-cols-[80px_1fr] gap-2 px-3 py-2">
              {badge.photoDataUrl ? (
                <img
                  src={badge.photoDataUrl}
                  alt={`${badge.visitorName} photo`}
                  className="h-[84px] w-[80px] rounded-[3px] border border-[#0C2340] object-cover"
                />
              ) : (
                <div className="flex h-[84px] w-[80px] items-center justify-center rounded-[3px] border border-[#0C2340] bg-sky-50 text-[9px] font-semibold text-slate-500">
                  No Photo
                </div>
              )}
              <div className="min-w-0 text-[#0C2340]">
                <div className="truncate font-[Outfit,sans-serif] text-[12px] font-extrabold">
                  {badge.visitorName}
                </div>
                {accCount > 0 && (
                  <div className="truncate text-[10px] text-slate-600">+{accCount} accompanying</div>
                )}
                {badge.companyName && (
                  <div className="truncate text-[10px] text-slate-600">{badge.companyName}</div>
                )}
                <div className="mt-0.5 flex gap-1 text-[10px] text-slate-700">
                  <span className="font-bold text-slate-500">Host:</span>
                  <span className="truncate">{badge.hostName || '—'}</span>
                </div>
                {badge.roomName && (
                  <div className="flex gap-1 text-[10px] text-slate-700">
                    <span className="font-bold text-slate-500">Room:</span>
                    <span className="truncate">{badge.roomName}</span>
                  </div>
                )}
                <div className="flex gap-1 text-[10px] text-slate-700">
                  <span className="font-bold text-slate-500">Valid:</span>
                  <span className="truncate">{badge.validWindow || '—'}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-dashed border-sky-200 px-3 py-1">
              <div className="text-[9px] text-slate-500">
                <div><strong className="text-[#0C2340]">{badge.badgeNumber}</strong></div>
                <div>{badge.dateStr}</div>
              </div>
              <QrPlaceholder />
            </div>
          </div>

          <p className="mt-4 text-[11px] text-slate-500 dark:text-slate-400">
            If the print window doesn&rsquo;t open, check your browser&rsquo;s popup settings.
          </p>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-[#142535] dark:bg-[#071220]">
          <button type="button" onClick={onClose}
            className="cursor-pointer rounded-[10px] border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-[#142535] dark:bg-[#0A1828] dark:text-slate-200">
            Close Without Printing
          </button>
          <button type="button" onClick={handlePrint}
            className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-sky-700 bg-gradient-to-r from-sky-600 to-sky-800 px-5 py-2.5 text-[13px] font-bold text-white shadow-sm hover:from-sky-700 hover:to-sky-900">
            <Printer size={14} aria-hidden="true" /> Print Badge
          </button>
        </div>
      </div>
    </div>
  );
}
