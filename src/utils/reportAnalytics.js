/**
 * Pure analytics helpers for the Reports page. Each function takes the raw
 * context data plus a { from, to } range and returns a ready-to-render shape.
 *
 * Keeping these pure (no React, no context) means they can also be reused
 * for exports, dashboard aggregations, and future server-side rendering.
 */

function within(iso, from, to) {
  if (!iso) return false;
  const day = iso.slice(0, 10);
  return day >= from && day <= to;
}

/**
 * Appointments are date-bearing even before check-in, so we filter by
 * appointment date. Guest log entries are filtered by checkInTime.
 */
export function computeVisitorStats(appointments, guestLog, { from, to }) {
  const aptInRange = appointments.filter((a) => within(a.date, from, to));
  const logInRange = guestLog.filter((g) => within(g.checkInTime, from, to));

  const walkIns     = logInRange.filter((g) => g.type === 'Walk-in').length;
  const preAppt     = logInRange.filter((g) => g.type === 'Appointment').length;
  const noShow      = aptInRange.filter((a) => a.status === 'No-show').length;
  const cancelled   = aptInRange.filter((a) => a.status === 'Rejected').length;
  const scheduled   = aptInRange.filter((a) => ['Pending', 'Approved', 'Inside', 'Completed', 'No-show'].includes(a.status)).length;
  const completed   = aptInRange.filter((a) => a.status === 'Completed').length;

  const denom = scheduled || 1; /* avoid divide-by-zero without hiding the zero */
  const noShowRate      = scheduled ? Math.round((noShow / denom) * 100) : 0;
  const cancellationRate = aptInRange.length
    ? Math.round((cancelled / aptInRange.length) * 100)
    : 0;

  /* Completed visit durations (in minutes) — only rows with both timestamps. */
  const durations = logInRange
    .map((g) => diffMinutes(g.checkInTime, g.checkOutTime))
    .filter((m) => m != null && m > 0);

  const avgVisitMin     = durations.length ? Math.round(mean(durations)) : null;
  const longestVisitMin = durations.length ? Math.round(Math.max(...durations)) : null;
  const shortestVisitMin = durations.length ? Math.round(Math.min(...durations)) : null;

  return {
    totalVisits:       logInRange.length,
    walkIns,
    preAppt,
    scheduledAppts:    scheduled,
    completed,
    noShow,
    cancelled,
    noShowRate,
    cancellationRate,
    avgVisitMin,
    longestVisitMin,
    shortestVisitMin,
    completedVisits: durations.length,
  };
}

/**
 * Rank hosts by the number of visitors they received in the range. Uses the
 * guest-log `host` field (name string) so walk-ins are counted too.
 */
export function computeTopHosts(guestLog, { from, to }, limit = 5) {
  const counts = new Map();
  guestLog
    .filter((g) => within(g.checkInTime, from, to))
    .forEach((g) => {
      const host = (g.host || '').trim() || 'Unassigned';
      const entry = counts.get(host) || { host, visitors: 0, walkIns: 0, appointments: 0 };
      entry.visitors += 1;
      if (g.type === 'Walk-in')    entry.walkIns      += 1;
      if (g.type === 'Appointment') entry.appointments += 1;
      counts.set(host, entry);
    });
  return Array.from(counts.values())
    .sort((a, b) => b.visitors - a.visitors)
    .slice(0, limit);
}

/**
 * Group visits by office. Host → staff → officeId. Appointments without a
 * resolvable host go into an 'Unassigned' bucket.
 */
export function computeOfficeComparison(appointments, guestLog, staff, { from, to }) {
  const staffById   = new Map(staff.map((s) => [s.id, s]));
  const staffByName = new Map(staff.map((s) => [s.name?.toLowerCase(), s]));

  const officeFor = (entry) => {
    if (entry.hostId && staffById.has(entry.hostId)) {
      return staffById.get(entry.hostId).officeId || 'Unassigned';
    }
    const byName = staffByName.get((entry.host || '').toLowerCase());
    return byName?.officeId || 'Unassigned';
  };

  const buckets = new Map();
  const getBucket = (office) => {
    if (!buckets.has(office)) {
      buckets.set(office, {
        office,
        visitors:     0,
        walkIns:      0,
        appointments: 0,
        noShows:      0,
      });
    }
    return buckets.get(office);
  };

  appointments
    .filter((a) => within(a.date, from, to))
    .forEach((a) => {
      const b = getBucket(officeFor(a));
      b.appointments += 1;
      if (a.status === 'No-show') b.noShows += 1;
    });

  guestLog
    .filter((g) => within(g.checkInTime, from, to))
    .forEach((g) => {
      const b = getBucket(officeFor(g));
      b.visitors += 1;
      if (g.type === 'Walk-in') b.walkIns += 1;
    });

  return Array.from(buckets.values()).sort((a, b) => b.visitors - a.visitors);
}

/**
 * Bucket check-ins by hour of day (0–23).
 * Falls back to appointment time when the visitor never checked in, so the
 * "expected peak" is still visible even on a slow day.
 */
export function computePeakHours(guestLog, appointments, { from, to }) {
  const buckets = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: `${String(hour).padStart(2, '0')}:00`,
    count: 0,
  }));

  guestLog.forEach((g) => {
    if (!within(g.checkInTime, from, to)) return;
    const d = new Date(g.checkInTime);
    if (Number.isNaN(d.getTime())) return;
    buckets[d.getHours()].count += 1;
  });

  /* For appointments that weren't checked in (Pending, Approved, Rejected, No-show),
     fall back to the scheduled time so the chart reflects *intended* load. */
  appointments.forEach((a) => {
    if (!within(a.date, from, to)) return;
    if (['Inside', 'Completed'].includes(a.status)) return; /* already counted via guestLog */
    if (!a.time) return;
    const hour = Number(a.time.slice(0, 2));
    if (!Number.isFinite(hour) || hour < 0 || hour > 23) return;
    buckets[hour].count += 1;
  });

  const peak = buckets.reduce((best, b) => (b.count > best.count ? b : best), buckets[0]);
  return { buckets, peakHour: peak };
}

/* ─── Service SLA metrics ────────────────────────────────────────────
   Response time  = createdAt → startedAt   (time for staff to pick up)
   Completion     = startedAt → completedAt (time to finish the work)
   Turnaround     = createdAt → completedAt (total visitor wait) */
export const SLA_TARGETS = {
  responseMinutes:   10,
  completionMinutes: 30,
};

function diffMinutes(aIso, bIso) {
  if (!aIso || !bIso) return null;
  const a = new Date(aIso).getTime();
  const b = new Date(bIso).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
  return (b - a) / 60_000;
}

function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((sum, n) => sum + n, 0) / arr.length;
}

function median(arr) {
  if (!arr.length) return 0;
  const sorted = arr.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/* ─── Room utilization ──────────────────────────────────────────────
   Business hours default 08:00–20:00. For each day in the range, a room
   contributes `businessMinutesPerDay` of capacity. Actual booked minutes
   come from Confirmed bookings whose date is in the range, clipped to
   business hours so a 07:00→22:00 booking doesn't inflate utilisation. */
const DEFAULT_BUSINESS_HOURS = { startHour: 8, endHour: 20 };

function toMinutesOfDay(hhmm) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function enumerateDays(from, to) {
  const out = [];
  const start = new Date(`${from}T00:00:00`);
  const end   = new Date(`${to}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return out;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export function computeRoomUtilization(
  rooms,
  bookings,
  { from, to },
  hours = DEFAULT_BUSINESS_HOURS,
) {
  const days = enumerateDays(from, to);
  const dayCount = days.length || 1;
  const dayStart = hours.startHour * 60;
  const dayEnd   = hours.endHour   * 60;
  const businessMinutesPerDay = Math.max(0, dayEnd - dayStart);
  const capacityMinutes = dayCount * businessMinutesPerDay;

  const hourCounts = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: `${String(hour).padStart(2, '0')}:00`,
    count: 0,
  }));

  const perRoom = rooms.map((room) => {
    const relevant = bookings.filter(
      (b) => b.roomId === room.id && b.status !== 'Cancelled' && within(b.date, from, to),
    );
    let bookedMinutes = 0;
    relevant.forEach((b) => {
      const s = toMinutesOfDay(b.startTime);
      const e = toMinutesOfDay(b.endTime);
      if (s == null || e == null || e <= s) return;
      const clippedStart = Math.max(s, dayStart);
      const clippedEnd   = Math.min(e, dayEnd);
      if (clippedEnd > clippedStart) bookedMinutes += clippedEnd - clippedStart;
      /* Peak-hour contribution: increment each hour the booking touches. */
      for (let h = Math.floor(s / 60); h < Math.ceil(e / 60); h += 1) {
        if (h >= 0 && h <= 23) hourCounts[h].count += 1;
      }
    });
    return {
      roomId:         room.id,
      roomName:       room.name,
      capacity:       room.capacity,
      bookings:       relevant.length,
      bookedMinutes,
      utilizationPct: capacityMinutes
        ? Math.min(100, Math.round((bookedMinutes / capacityMinutes) * 100))
        : 0,
    };
  });

  const overall = {
    totalBookings:   perRoom.reduce((sum, r) => sum + r.bookings, 0),
    bookedMinutes:   perRoom.reduce((sum, r) => sum + r.bookedMinutes, 0),
    capacityMinutes: capacityMinutes * rooms.length,
  };
  overall.utilizationPct = overall.capacityMinutes
    ? Math.min(100, Math.round((overall.bookedMinutes / overall.capacityMinutes) * 100))
    : 0;

  const peakHour = hourCounts.reduce(
    (best, h) => (h.count > best.count ? h : best),
    hourCounts[0],
  );

  return {
    days,
    businessHours: hours,
    perRoom: perRoom.slice().sort((a, b) => b.utilizationPct - a.utilizationPct),
    overall,
    hourCounts,
    peakHour,
  };
}

export function computeServiceSLA(services, targets = SLA_TARGETS) {
  const responseTimes   = [];
  const completionTimes = [];
  const turnaroundTimes = [];
  let responseBreaches   = 0;
  let completionBreaches = 0;

  services.forEach((s) => {
    const response   = diffMinutes(s.createdAt,  s.startedAt);
    const completion = diffMinutes(s.startedAt,  s.completedAt);
    const turnaround = diffMinutes(s.createdAt,  s.completedAt);
    if (response != null) {
      responseTimes.push(response);
      if (response > targets.responseMinutes) responseBreaches += 1;
    }
    if (completion != null) {
      completionTimes.push(completion);
      if (completion > targets.completionMinutes) completionBreaches += 1;
    }
    if (turnaround != null) turnaroundTimes.push(turnaround);
  });

  const responseCompliance = responseTimes.length
    ? Math.round(((responseTimes.length - responseBreaches) / responseTimes.length) * 100)
    : null;
  const completionCompliance = completionTimes.length
    ? Math.round(((completionTimes.length - completionBreaches) / completionTimes.length) * 100)
    : null;

  return {
    targets,
    responded:  responseTimes.length,
    completed:  completionTimes.length,
    avgResponseMin:   Math.round(mean(responseTimes)),
    medianResponseMin: Math.round(median(responseTimes)),
    avgCompletionMin: Math.round(mean(completionTimes)),
    medianCompletionMin: Math.round(median(completionTimes)),
    avgTurnaroundMin: Math.round(mean(turnaroundTimes)),
    responseBreaches,
    completionBreaches,
    responseCompliance,
    completionCompliance,
  };
}

/* ═══════════════════════════════════════════════════════════════════
 *   MODULE 6 — Report Builders
 *
 *   Each builder takes a pre-scoped appointments array (already run
 *   through byOrg by the caller) + a { from, to } ISO date window +
 *   a context bundle { offices, staff, services, orgs } and returns
 *   a ready-to-render shape: kpis, seriesForChart, table.
 *
 *   Pure functions — no React, no store access. Callers pass the
 *   data in, the builder hands back a plain object.
 *
 *   Production — migrate report builders to backend API endpoints
 *   when appointment volume exceeds ~10,000 rows per org. The in-
 *   memory scans here are fine for the mock dataset but would stall
 *   the main thread at production scale. Target post-production-auth
 *   refactor.
 * ═══════════════════════════════════════════════════════════════════ */

const REPORT_STATUSES = ['Pending', 'Approved', 'Checked-In', 'In-Progress', 'Completed', 'Cancelled', 'No-Show'];

function inRangeDate(iso, from, to) {
  const d = (iso || '').slice(0, 10);
  if (!d) return false;
  if (from && d < from) return false;
  if (to && d > to)     return false;
  return true;
}

function durationMinutes(apt) {
  if (!apt?.checkedInAt || !apt?.checkedOutAt) return null;
  const ms = new Date(apt.checkedOutAt).getTime() - new Date(apt.checkedInAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return Math.floor(ms / 60000);
}

function avg(nums) {
  const arr = (nums || []).filter((n) => Number.isFinite(n));
  if (!arr.length) return 0;
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
}

/* ── 1. Today's Visitor Report ───────────────────────────────── */

export function buildTodayVisitorReport(appointments, ctx = {}) {
  const { offices = [], staff = [], date = new Date().toISOString().slice(0, 10) } = ctx;
  const inScope = (appointments || []).filter((a) => (a?.scheduledDate || a?.date || '').slice(0, 10) === date);

  /* Hourly histogram — bucket by startTime hour. */
  const hourly = new Array(24).fill(0).map((_, h) => ({
    hour: h,
    label: `${h % 12 || 12} ${h >= 12 ? 'PM' : 'AM'}`,
    count: 0,
  }));
  for (const a of inScope) {
    const t = a?.startTime || a?.time || '';
    if (!/^\d{2}:\d{2}$/.test(t)) continue;
    const h = Number(t.slice(0, 2));
    if (h >= 0 && h < 24) hourly[h].count += 1;
  }

  /* Top hosts. */
  const staffById = new Map((staff || []).map((s) => [s?.id, s]));
  const hostAgg = new Map();
  for (const a of inScope) {
    const key = a?.hostUserId || a?.host || '—';
    const bucket = hostAgg.get(key) || { hostUserId: a?.hostUserId, hostName: null, count: 0 };
    bucket.count += 1;
    hostAgg.set(key, bucket);
  }
  const topHosts = [...hostAgg.values()].map((b) => {
    const s = staffById.get(b.hostUserId);
    return { ...b, hostName: s?.fullName || s?.name || b.hostUserId || '—' };
  }).sort((a, b) => b.count - a.count).slice(0, 5);

  /* Top offices. */
  const officeById = new Map((offices || []).map((o) => [o?.id, o]));
  const officeAgg = new Map();
  for (const a of inScope) {
    const key = a?.officeId || '—';
    officeAgg.set(key, (officeAgg.get(key) || 0) + 1);
  }
  const topOffices = [...officeAgg.entries()]
    .map(([id, count]) => {
      const o = officeById.get(id);
      return { officeId: id, officeName: o?.name || id, count };
    })
    .sort((a, b) => b.count - a.count).slice(0, 5);

  const durations = inScope.map(durationMinutes).filter((n) => n != null);
  const walkIns = inScope.filter((a) => a?.isWalkIn).length;
  const completed = inScope.filter((a) => a?.status === 'Completed').length;
  const peakHour = [...hourly].sort((a, b) => b.count - a.count)[0];

  return {
    kpis: {
      totalVisitors: inScope.length,
      walkIns,
      completed,
      avgDurationMin: avg(durations),
      peakHourLabel: peakHour && peakHour.count > 0 ? peakHour.label : '—',
    },
    hourly,
    topHosts,
    topOffices,
    rows: inScope,
  };
}

/* ── 2. Weekly Summary ───────────────────────────────────────── */

export function buildWeeklySummary(appointments, ctx = {}) {
  const { from, to } = ctx;
  const inScope = (appointments || []).filter((a) => inRangeDate(a?.scheduledDate || a?.date, from, to));

  /* Day-by-day counts. */
  const dayMap = new Map();
  for (const a of inScope) {
    const d = (a?.scheduledDate || a?.date || '').slice(0, 10);
    if (!d) continue;
    dayMap.set(d, (dayMap.get(d) || 0) + 1);
  }
  /* Fill missing days in range. */
  const dailyTrend = [];
  if (from && to) {
    const cur = new Date(`${from}T00:00:00`);
    const end = new Date(`${to}T00:00:00`);
    while (cur <= end) {
      const iso = cur.toISOString().slice(0, 10);
      const label = cur.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
      dailyTrend.push({ iso, label, count: dayMap.get(iso) || 0 });
      cur.setDate(cur.getDate() + 1);
    }
  }

  /* Status breakdown. */
  const statusAgg = new Map(REPORT_STATUSES.map((s) => [s, 0]));
  for (const a of inScope) statusAgg.set(a?.status, (statusAgg.get(a?.status) || 0) + 1);
  const statusBreakdown = [...statusAgg.entries()]
    .filter(([, c]) => c > 0)
    .map(([status, count]) => ({ status, count }));

  /* Visitor type mix. */
  const typeAgg = new Map();
  for (const a of inScope) {
    const t = a?.visitor?.visitorType || 'Regular';
    typeAgg.set(t, (typeAgg.get(t) || 0) + 1);
  }
  const typeMix = [...typeAgg.entries()].map(([type, count]) => ({ type, count }));

  const walkIns = inScope.filter((a) => a?.isWalkIn).length;
  const walkInRatio = inScope.length === 0 ? 0 : Math.round((walkIns / inScope.length) * 100);
  const completed = inScope.filter((a) => a?.status === 'Completed').length;
  const cancelled = inScope.filter((a) => a?.status === 'Cancelled').length;

  return {
    kpis: {
      totalVisitors: inScope.length,
      walkIns,
      walkInRatioPct: walkInRatio,
      completed,
      cancelled,
    },
    dailyTrend,
    statusBreakdown,
    typeMix,
    rows: inScope,
  };
}

/* ── 3. Staff Performance ────────────────────────────────────── */

export function buildStaffPerformance(appointments, ctx = {}) {
  const { from, to, staff = [] } = ctx;
  const inScope = (appointments || []).filter((a) => inRangeDate(a?.scheduledDate || a?.date, from, to));
  const staffById = new Map((staff || []).map((s) => [s?.id, s]));

  const agg = new Map();
  for (const a of inScope) {
    const key = a?.hostUserId;
    if (!key) continue;
    const bucket = agg.get(key) || {
      hostUserId: key, visits: 0, durations: [],
      noShows: 0, ratings: [],
    };
    bucket.visits += 1;
    const dur = durationMinutes(a);
    if (dur != null) bucket.durations.push(dur);
    if (a?.status === 'No-Show') bucket.noShows += 1;
    if (a?.feedback?.rating) bucket.ratings.push(Number(a.feedback.rating));
    agg.set(key, bucket);
  }

  const rows = [...agg.values()].map((b) => {
    const s = staffById.get(b.hostUserId);
    return {
      hostUserId:    b.hostUserId,
      hostName:      s?.fullName || s?.name || '—',
      role:          s?.role || '—',
      office:        s?.officeId || '—',
      visits:        b.visits,
      avgDurationMin: avg(b.durations),
      noShows:       b.noShows,
      noShowRatePct: b.visits === 0 ? 0 : Math.round((b.noShows / b.visits) * 100),
      avgRating:     b.ratings.length ? Math.round((b.ratings.reduce((a, n) => a + n, 0) / b.ratings.length) * 10) / 10 : null,
    };
  }).sort((a, b) => b.visits - a.visits);

  const top10 = rows.slice(0, 10);

  return {
    kpis: {
      uniqueHosts:       rows.length,
      totalVisitsHosted: rows.reduce((a, r) => a + r.visits, 0),
      avgRating:         rows.length === 0 ? null : Math.round((rows.filter((r) => r.avgRating != null).reduce((a, r) => a + r.avgRating, 0) / Math.max(1, rows.filter((r) => r.avgRating != null).length)) * 10) / 10,
      totalNoShows:      rows.reduce((a, r) => a + r.noShows, 0),
    },
    top10,
    rows,
  };
}

/* ── 4. Room Utilisation ─────────────────────────────────────── */

export function buildRoomUtilisation(appointments, ctx = {}) {
  const { from, to, rooms = [], offices = [] } = ctx;
  const inScope = (appointments || []).filter((a) => inRangeDate(a?.scheduledDate || a?.date, from, to) && a?.roomId);
  const roomById = new Map((rooms || []).map((r) => [r?.id, r]));
  const officeById = new Map((offices || []).map((o) => [o?.id, o]));

  const agg = new Map();
  for (const a of inScope) {
    const key = a.roomId;
    const bucket = agg.get(key) || { roomId: key, bookings: 0, durations: [], hours: new Set() };
    bucket.bookings += 1;
    const dur = durationMinutes(a);
    if (dur != null) bucket.durations.push(dur);
    const t = a?.startTime || a?.time || '';
    if (/^\d{2}:\d{2}$/.test(t)) {
      const h = Number(t.slice(0, 2));
      if (h >= 0 && h < 24) bucket.hours.add(h);
    }
    agg.set(key, bucket);
  }

  const rows = [...agg.values()].map((b) => {
    const r = roomById.get(b.roomId);
    const o = officeById.get(r?.officeId);
    return {
      roomId:         b.roomId,
      roomName:       r?.name || '—',
      officeName:     o?.name || '—',
      capacity:       r?.seatingCapacity || 0,
      bookings:       b.bookings,
      avgDurationMin: avg(b.durations),
      hoursBooked:    [...b.hours].sort((x, y) => x - y),
    };
  }).sort((a, b) => b.bookings - a.bookings);

  /* Peak hours — distribution of start times across booked rooms. */
  const peak = new Array(24).fill(0).map((_, h) => ({
    hour: h,
    label: `${h % 12 || 12} ${h >= 12 ? 'PM' : 'AM'}`,
    bookings: 0,
  }));
  for (const a of inScope) {
    const t = a?.startTime || a?.time || '';
    if (!/^\d{2}:\d{2}$/.test(t)) continue;
    const h = Number(t.slice(0, 2));
    if (h >= 0 && h < 24) peak[h].bookings += 1;
  }

  /* Idle capacity — rough heuristic: (total rooms × active days) vs used-room slots. */
  const totalRooms = (rooms || []).length || 1;
  const usedRooms = rows.length;
  const idlePct = Math.max(0, Math.round(((totalRooms - usedRooms) / totalRooms) * 100));

  return {
    kpis: {
      totalRooms,
      roomsUsed: usedRooms,
      totalBookings: rows.reduce((a, r) => a + r.bookings, 0),
      avgDurationMin: avg(rows.map((r) => r.avgDurationMin).filter((n) => n > 0)),
      idleCapacityPct: idlePct,
    },
    rows,
    peak,
  };
}

/* ── 5. Service Usage (tabular) ──────────────────────────────── */

export function buildServiceUsage(appointments, ctx = {}) {
  const { from, to, services = [], offices = [] } = ctx;
  const inScope = (appointments || []).filter((a) => inRangeDate(a?.scheduledDate || a?.date, from, to));
  const serviceById = new Map((services || []).map((s) => [s?.id, s]));
  const officeById = new Map((offices || []).map((o) => [o?.id, o]));

  const byService = new Map();
  for (const a of inScope) {
    const ids = Array.isArray(a?.servicesPrebooked) ? a.servicesPrebooked : [];
    for (const sid of ids) {
      const bucket = byService.get(sid) || { serviceId: sid, count: 0, officeCounts: new Map() };
      bucket.count += 1;
      const oid = a.officeId || '—';
      bucket.officeCounts.set(oid, (bucket.officeCounts.get(oid) || 0) + 1);
      byService.set(sid, bucket);
    }
  }

  const rows = [...byService.values()].map((b) => {
    const s = serviceById.get(b.serviceId);
    let topOfficeName = '—';
    let topOfficeCount = 0;
    for (const [oid, n] of b.officeCounts.entries()) {
      if (n > topOfficeCount) {
        topOfficeCount = n;
        topOfficeName = officeById.get(oid)?.name || oid;
      }
    }
    return {
      serviceId:        b.serviceId,
      serviceName:      s?.name || b.serviceId,
      serviceIcon:      s?.icon || '•',
      category:         s?.category || '—',
      bookingCount:     b.count,
      topOfficeName,
      topOfficeCount,
      chargeable:       Boolean(s?.chargeable),
      priceDisplay:     s?.chargeable ? `${s?.priceUnit === 'flat' ? '' : s?.priceUnit === 'per page' ? '/pg' : s?.priceUnit === 'per hour' ? '/hr' : '/min'}` : 'Free',
    };
  }).sort((a, b) => b.bookingCount - a.bookingCount);

  const totalBookings = rows.reduce((a, r) => a + r.bookingCount, 0);

  return {
    kpis: {
      totalBookings,
      uniqueServices: rows.length,
    },
    rows,
  };
}

