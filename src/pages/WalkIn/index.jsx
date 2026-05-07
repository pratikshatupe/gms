import React, { useEffect, useMemo, useState } from 'react';
import {
  UserPlus, Clock3, Building2, ChevronRight, Printer,
} from 'lucide-react';
import { useCollection, STORAGE_KEYS } from '../../store';
import { MOCK_APPOINTMENTS } from '../../data/mockAppointments';
import {
  MOCK_OFFICES, MOCK_STAFF, MOCK_ROOMS, MOCK_ORGANIZATIONS,
} from '../../data/mockData';
import { useAuth } from '../../context/AuthContext';
import { useRole } from '../../context/RoleContext';
import NoAccess from '../../components/NoAccess';
import { Toast } from '../../components/ui';
import {
  byOrg, to12hAmPm, getTimezoneAbbr,
} from '../../utils/appointmentState';
import WalkInWizard from './WalkInWizard';
import VisitorBadge, { badgeFromAppointment } from '../../components/VisitorBadge';

/**
 * WalkIn — reception console landing page.
 *
 * Hero: live clock + office name + single "Start Walk-In Check-In" CTA.
 * Strip 1: Today's Walk-Ins (isWalkIn === true, scheduledDate = today).
 * Strip 2: Recent Check-Ins (any appointment checkedInAt within last 60 min).
 *
 * RBAC:
 *   SuperAdmin — reads cross-tenant (no Start button).
 *   Director / Manager / Reception — full access.
 *   Service Staff — NoAccess.
 */

export default function WalkIn({ setActivePage }) {
  const { user } = useAuth();
  const { hasPermission } = useRole();

  if (!hasPermission('walkin', 'view')) {
    return (
      <NoAccess
        module="Walk-In Check-In"
        onGoBack={setActivePage ? () => setActivePage('dashboard') : undefined}
      />
    );
  }

  return <WalkInBody user={user} hasPermission={hasPermission} setActivePage={setActivePage} />;
}

function WalkInBody({ user, hasPermission, setActivePage }) {
  const [appointments] = useCollection(STORAGE_KEYS.APPOINTMENTS, MOCK_APPOINTMENTS);
  const [offices]      = useCollection(STORAGE_KEYS.OFFICES,      MOCK_OFFICES);
  const [staffAll]     = useCollection(STORAGE_KEYS.STAFF,        MOCK_STAFF);
  const [roomsAll]     = useCollection(STORAGE_KEYS.ROOMS,        MOCK_ROOMS);
  const [orgsAll]      = useCollection(STORAGE_KEYS.ORGANIZATIONS, MOCK_ORGANIZATIONS);

  const opRoleLower = String(user?.role || '').toLowerCase();
  const isSuperRead = opRoleLower === 'superadmin';
  const canCreate   = hasPermission('walkin', 'create') && !isSuperRead;

  const [showWizard, setWizard] = useState(false);
  const [toast, setToast]       = useState(null);
  const [badgeApt, setBadgeApt] = useState(null);

  const showToast = (msg, type = 'success') => setToast({ msg, type });

  /* Live clock — updates every second. */
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const scoped        = useMemo(() => byOrg(appointments, user), [appointments, user]);
  const scopedOffices = useMemo(() => byOrg(offices,      user), [offices,      user]);
  const scopedStaff   = useMemo(() => byOrg(staffAll,     user), [staffAll,     user]);
  const scopedRooms   = useMemo(() => byOrg(roomsAll,     user), [roomsAll,     user]);

  const orgId = user?.organisationId || user?.orgId || null;
  const org   = useMemo(() => (orgsAll || []).find((o) => o?.id === orgId) || null, [orgsAll, orgId]);

  const sessionOfficeId = user?.officeId && user.officeId !== 'all' ? user.officeId : null;
  const sessionOffice   = sessionOfficeId
    ? scopedOffices.find((o) => o?.id === sessionOfficeId) || null
    : null;
  const heroOfficeLabel = sessionOffice?.name
    || (scopedOffices.length === 1 ? scopedOffices[0].name : 'All offices');

  const todayIso = now.toISOString().slice(0, 10);

  const todaysWalkIns = useMemo(() => {
    return (scoped || [])
      .filter((a) => a?.isWalkIn === true
        && (a.scheduledDate || a.date || '').slice(0, 10) === todayIso)
      .sort((a, b) => {
        const ta = a.checkedInAt || a.createdAt || '';
        const tb = b.checkedInAt || b.createdAt || '';
        return tb.localeCompare(ta);
      })
      .slice(0, 10);
  }, [scoped, todayIso]);

  const recentCheckIns = useMemo(() => {
    const oneHour = 60 * 60 * 1000;
    const cutoff = Date.now() - oneHour;
    return (scoped || [])
      .filter((a) => a?.checkedInAt)
      .filter((a) => {
        const t = new Date(a.checkedInAt).getTime();
        return !Number.isNaN(t) && t >= cutoff;
      })
      .sort((a, b) => (b.checkedInAt || '').localeCompare(a.checkedInAt || ''))
      .slice(0, 10);
  }, [scoped, now]);

  const staffById  = useMemo(() => {
    const m = new Map();
    for (const s of scopedStaff) m.set(s.id, s);
    return m;
  }, [scopedStaff]);
  const officeById = useMemo(() => {
    const m = new Map();
    for (const o of scopedOffices) m.set(o.id, o);
    return m;
  }, [scopedOffices]);
  const roomById = useMemo(() => {
    const m = new Map();
    for (const r of scopedRooms) m.set(r.id, r);
    return m;
  }, [scopedRooms]);

  const reprintBadge = (apt) => { if (apt) setBadgeApt(apt); };

  const dateStr = now.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  const clockStr = formatClock(now);
  const tzAbbr = getTimezoneAbbr(sessionOffice?.operations?.timezone || (scopedOffices[0]?.operations?.timezone));

  return (
    <div className="w-full min-h-screen bg-slate-50 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 dark:bg-[#050E1A]">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5">

        <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          <button type="button" onClick={() => setActivePage?.('dashboard')}
            className="cursor-pointer rounded-[6px] px-1.5 py-0.5 transition hover:bg-slate-100 hover:text-sky-700 dark:hover:bg-[#1E1E3F] dark:hover:text-sky-300">
            Dashboard
          </button>
          <ChevronRight size={12} aria-hidden="true" className="text-slate-300" />
          <span className="rounded-[6px] px-1.5 py-0.5 text-[#0C2340] dark:text-slate-200">Walk-In Check-In</span>
        </nav>

        <header className="rounded-[18px] border border-sky-200 bg-gradient-to-br from-sky-50 via-white to-white p-6 shadow-sm dark:border-sky-400/30 dark:from-sky-500/15 dark:via-[#0A1828] dark:to-[#0A1828] sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-[12px] font-bold text-slate-500 dark:text-slate-400">
                <Building2 size={14} aria-hidden="true" className="text-sky-500 dark:text-sky-300" />
                {heroOfficeLabel}
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                  <span aria-hidden="true" className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                  Live
                </span>
              </div>
              <div className="mt-3 font-[Outfit,sans-serif] text-[40px] font-extrabold leading-none text-[#0C2340] dark:text-slate-100 sm:text-[52px]">
                {clockStr}
                {tzAbbr && <span className="ml-2 text-[18px] font-bold text-slate-500 dark:text-slate-400">{tzAbbr}</span>}
              </div>
              <div className="mt-1 text-[13px] font-semibold text-slate-600 dark:text-slate-300">
                {dateStr}.
              </div>
            </div>
            <div className="flex flex-col items-start gap-3 sm:items-end">
              {canCreate ? (
                <button type="button" onClick={() => setWizard(true)}
                  disabled={scopedOffices.length === 0}
                  title="Start a new walk-in check-in"
                  className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-[12px] border border-sky-700 bg-gradient-to-r from-sky-600 to-sky-800 px-6 py-3 text-[14px] font-extrabold text-white shadow-lg hover:from-sky-700 hover:to-sky-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40 disabled:opacity-40 sm:w-[320px]">
                  <UserPlus size={16} aria-hidden="true" />
                  Start Walk-In Check-In
                </button>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-[10px] border border-slate-200 bg-white px-4 py-2 text-[12px] font-bold text-slate-600 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-300">
                  Read-only view
                </span>
              )}
              <div className="flex flex-wrap gap-3 text-[12px] font-bold">
                <button type="button" onClick={() => setActivePage?.('appointments')}
                  className="cursor-pointer text-sky-700 hover:underline dark:text-sky-300">
                  View Today&rsquo;s Appointments →
                </button>
                <button type="button" onClick={() => setActivePage?.('guest-log')}
                  className="cursor-pointer text-sky-700 hover:underline dark:text-sky-300">
                  View Guest Log →
                </button>
              </div>
            </div>
          </div>
        </header>

        <Strip
          Icon={UserPlus}
          title="Today's Walk-Ins"
          empty={canCreate
            ? 'No walk-ins yet today. Click Start Check-In to register a visitor.'
            : 'No walk-ins yet today.'}
          items={todaysWalkIns}
          onViewAll={() => setActivePage?.('guest-log')}
          renderItem={(a) => (
            <WalkInCard
              key={a.id} apt={a}
              host={staffById.get(a.hostUserId)}
              office={officeById.get(a.officeId)}
              room={roomById.get(a.roomId)}
              onReprint={() => reprintBadge(a)}
            />
          )}
        />

        <Strip
          Icon={Clock3}
          title="Recent Check-Ins (Last Hour)"
          empty="No recent check-ins."
          items={recentCheckIns}
          onViewAll={() => setActivePage?.('appointments')}
          renderItem={(a) => (
            <RecentCard
              key={`${a.id}-${a.checkedInAt}`} apt={a}
              host={staffById.get(a.hostUserId)}
              office={officeById.get(a.officeId)}
            />
          )}
        />
      </div>

      {showWizard && (
        <WalkInWizard
          open
          currentUser={user}
          onClose={() => setWizard(false)}
          onCheckedIn={(apt) => {
            setWizard(false);
            showToast(`${apt.visitor?.fullName || 'Visitor'} checked in successfully.`);
          }}
        />
      )}

      {badgeApt && (
        <VisitorBadge
          open
          badge={badgeFromAppointment({
            appointment: badgeApt,
            org,
            office: officeById.get(badgeApt.officeId),
            host:   staffById.get(badgeApt.hostUserId),
            room:   roomById.get(badgeApt.roomId),
          })}
          onClose={() => setBadgeApt(null)}
          onPrinted={() => {
            showToast(`Badge reprinted for ${badgeApt.visitor?.fullName || 'visitor'}.`);
            setBadgeApt(null);
          }}
        />
      )}

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

/* ── Strips + cards ─────────────────────────────────────────────── */

function Strip({ Icon, title, items, empty, renderItem, onViewAll }) {
  return (
    <section className="rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm dark:border-[#142535] dark:bg-[#0A1828]">
      <header className="mb-3 flex items-center justify-between gap-3">
        <h2 className="inline-flex items-center gap-2 font-[Outfit,sans-serif] text-[13px] font-extrabold uppercase tracking-[0.08em] text-sky-700 dark:text-sky-300">
          <Icon size={14} aria-hidden="true" />
          {title}
        </h2>
        {items.length > 0 && onViewAll && (
          <button type="button" onClick={onViewAll}
            className="cursor-pointer text-[11px] font-bold text-sky-700 hover:underline dark:text-sky-300">
            View All →
          </button>
        )}
      </header>
      {items.length === 0 ? (
        <p className="rounded-[10px] border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-[12px] text-slate-500 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-400">
          {empty}
        </p>
      ) : (
        <div className="flex flex-wrap gap-3 sm:flex-nowrap sm:overflow-x-auto sm:pb-1">
          {items.map(renderItem)}
        </div>
      )}
    </section>
  );
}

function WalkInCard({ apt, host, onReprint }) {
  const visitor = apt.visitor || {};
  const photo = visitor.photoDataUrl;
  const name  = visitor.fullName || apt.guestName || 'Visitor';
  const disp  = apt.status || 'Checked-In';
  const inTime = apt.checkedInAt
    ? new Date(apt.checkedInAt).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true })
    : to12hAmPm(apt.startTime);
  return (
    <div className="flex w-full min-w-[260px] shrink-0 items-start gap-3 rounded-[12px] border border-slate-200 bg-white p-3 shadow-sm dark:border-[#142535] dark:bg-[#071220] sm:w-[280px]">
      {photo ? (
        <img src={photo} alt={`${name} photo`} className="h-[64px] w-[64px] shrink-0 rounded-[10px] border border-slate-200 object-cover dark:border-[#142535]" />
      ) : (
        <div aria-hidden="true" className="flex h-[64px] w-[64px] shrink-0 items-center justify-center rounded-[10px] border border-slate-200 bg-sky-50 text-[12px] font-bold text-sky-700 dark:border-[#142535] dark:bg-sky-500/15 dark:text-sky-300">
          {initials(name)}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-bold text-[#0C2340] dark:text-slate-100">{name}</div>
        <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">
          {visitor.companyName || '—'}
        </div>
        <div className="mt-1 truncate text-[11px] text-slate-600 dark:text-slate-300">
          Host: {host?.fullName || host?.name || apt.host || '—'}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px]">
          <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
            {disp}
          </span>
          <span className="text-slate-500 dark:text-slate-400">{inTime}</span>
        </div>
        {apt.badgeNumber && (
          <button type="button" onClick={onReprint} title={`Reprint badge ${apt.badgeNumber}`}
            className="mt-2 inline-flex cursor-pointer items-center gap-1 rounded-[6px] border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-bold text-slate-700 hover:bg-slate-50 dark:border-[#142535] dark:bg-[#0A1828] dark:text-slate-200">
            <Printer size={10} aria-hidden="true" /> Reprint Badge
          </button>
        )}
      </div>
    </div>
  );
}

function RecentCard({ apt, host }) {
  const visitor = apt.visitor || {};
  const name = visitor.fullName || apt.guestName || 'Visitor';
  const inTime = apt.checkedInAt
    ? new Date(apt.checkedInAt).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true })
    : to12hAmPm(apt.startTime);
  return (
    <div className="flex w-full min-w-[220px] shrink-0 items-start gap-3 rounded-[12px] border border-slate-200 bg-white p-3 shadow-sm dark:border-[#142535] dark:bg-[#071220] sm:w-[240px]">
      <div aria-hidden="true" className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full border border-slate-200 bg-sky-50 text-[10px] font-bold text-sky-700 dark:border-[#142535] dark:bg-sky-500/15 dark:text-sky-300">
        {initials(name)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12px] font-bold text-[#0C2340] dark:text-slate-100">{name}</div>
        <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">
          Host: {host?.fullName || host?.name || apt.host || '—'}
        </div>
        <div className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">{inTime}</div>
      </div>
      {apt.isWalkIn && (
        <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-sky-700 dark:border-sky-400/30 dark:bg-sky-500/15 dark:text-sky-300">
          Walk-in
        </span>
      )}
    </div>
  );
}

function initials(name) {
  if (!name) return '?';
  const parts = String(name).trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase()).join('') || '?';
}

function formatClock(d) {
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const suffix = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${suffix}`;
}
