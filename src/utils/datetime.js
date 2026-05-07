/**
 * Bidirectional date & time helpers for form pickers.
 *
 * Storage convention:
 *   Dates → ISO short form "YYYY-MM-DD"  (matches native <input type="date">)
 *   Times → 24-hour "HH:mm"               (matches native <input type="time">)
 *
 * Display convention (per QA spec — DD/MM/YYYY and AM/PM uppercase):
 *   Dates → "DD/MM/YYYY"
 *   Times → "HH:MM AM/PM"   (always uppercase, never am/pm or a.m.)
 */

/** "2026-04-17" → "17/04/2026".  Returns "" for empty/invalid. */
export function toDDMMYYYY(isoDate) {
  if (!isoDate || typeof isoDate !== 'string') return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) return '';
  const [, y, mo, d] = m;
  return `${d}/${mo}/${y}`;
}

/** "17/04/2026" → "2026-04-17".  Returns "" for invalid / incomplete. */
export function fromDDMMYYYY(display) {
  if (!display || typeof display !== 'string') return '';
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(display.trim());
  if (!m) return '';
  const [, d, mo, y] = m;
  const dd = Number(d);
  const mm = Number(mo);
  const yy = Number(y);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31 || yy < 1900) return '';
  // round-trip to catch things like 31/02/2026
  const dt = new Date(Date.UTC(yy, mm - 1, dd));
  if (
    dt.getUTCFullYear() !== yy ||
    dt.getUTCMonth() !== mm - 1 ||
    dt.getUTCDate() !== dd
  )
    return '';
  return `${y}-${mo}-${d}`;
}

/** "14:30" → "02:30 PM".  Returns "" for empty/invalid. */
export function to12Hour(time24) {
  if (!time24 || typeof time24 !== 'string') return '';
  const m = /^(\d{1,2}):(\d{2})$/.exec(time24);
  if (!m) return '';
  let h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return '';
  const period = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${String(h).padStart(2, '0')}:${m[2]} ${period}`;
}

/** "02:30 PM" / "2:30 pm" → "14:30".  Returns "" for invalid. */
export function from12Hour(display) {
  if (!display || typeof display !== 'string') return '';
  const m = /^(\d{1,2}):(\d{2})\s*([AP]M)$/i.exec(display.trim());
  if (!m) return '';
  let h = Number(m[1]);
  const min = Number(m[2]);
  const period = m[3].toUpperCase();
  if (h < 1 || h > 12 || min < 0 || min > 59) return '';
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}

/** Today as "YYYY-MM-DD" in the user's local timezone. */
export function todayLocalISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
