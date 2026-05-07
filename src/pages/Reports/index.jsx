import React, { useMemo, useState } from 'react';
import { ChevronRight, ArrowRight, ExternalLink } from 'lucide-react';
import { useCollection, STORAGE_KEYS } from '../../store';
import { MOCK_APPOINTMENTS } from '../../data/mockAppointments';
import {
  MOCK_OFFICES, MOCK_STAFF, MOCK_SERVICES, MOCK_ROOMS, MOCK_ORGANIZATIONS,
} from '../../data/mockData';
import { useAuth } from '../../context/AuthContext';
import { useRole } from '../../context/RoleContext';
import NoAccess from '../../components/NoAccess';
import { byOrg, addDaysIso, todayIso } from '../../utils/appointmentState';
import { REPORT_REGISTRY, REPORTS_BY_KEY } from './reportDefinitions';
import ReportRenderer from './ReportRenderer';

/**
 * Reports — landing page (tile picker) + renderer mount.
 *
 * RBAC: single `reports.view` gate. Reception + Service Staff hit
 * NoAccess. Director / Manager / SuperAdmin full access.
 *
 * Tenant isolation: appointments and related stores are run through
 * `byOrg` before the renderer receives them. SuperAdmin bypasses
 * `byOrg` inside the helper and sees every tenant.
 *
 * Audit Report tile is delegated — routes to /audit-logs with a
 * pre-filled date-range query param instead of duplicating UI.
 */

export default function Reports({ setActivePage }) {
  const { user } = useAuth();
  const { hasPermission } = useRole();

  if (!hasPermission('reports', 'view')) {
    return (
      <NoAccess module="Reports"
        onGoBack={setActivePage ? () => setActivePage('dashboard') : undefined} />
    );
  }

  return <ReportsBody user={user} setActivePage={setActivePage} />;
}

function ReportsBody({ user, setActivePage }) {
  const [appointments] = useCollection(STORAGE_KEYS.APPOINTMENTS, MOCK_APPOINTMENTS);
  const [offices]      = useCollection(STORAGE_KEYS.OFFICES,      MOCK_OFFICES);
  const [staffAll]     = useCollection(STORAGE_KEYS.STAFF,        MOCK_STAFF);
  const [servicesAll]  = useCollection(STORAGE_KEYS.SERVICES,     MOCK_SERVICES);
  const [roomsAll]     = useCollection(STORAGE_KEYS.ROOMS,        MOCK_ROOMS);
  const [orgsAll]      = useCollection(STORAGE_KEYS.ORGANIZATIONS, MOCK_ORGANIZATIONS);

  const [activeKey, setActiveKey] = useState(null);

  const scoped = useMemo(() => ({
    appointments: byOrg(appointments, user),
    offices:      byOrg(offices, user),
    staff:        byOrg(staffAll, user),
    services:     byOrg(servicesAll, user),
    rooms:        byOrg(roomsAll, user),
    orgs:         orgsAll || [],
  }), [appointments, offices, staffAll, servicesAll, roomsAll, orgsAll, user]);

  const activeDefinition = activeKey ? REPORTS_BY_KEY[activeKey] : null;

  const navigate = (page, params) => {
    /* Stash query params on window.history before firing the
       page-level navigation. The destination page's mount-time
       query-param handler (Appointments / Guest Log / Audit Logs)
       picks them up and pre-fills its filters. */
    if (params && typeof window !== 'undefined') {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        if (v != null && v !== '') qs.set(k, v);
      }
      const target = pageToPath(page);
      if (target) {
        window.history.pushState({}, '', `${target}?${qs.toString()}`);
      }
    }
    setActivePage?.(page);
  };

  const handleTileClick = (def) => {
    if (def.externalLink) {
      const rangeIso = def.defaultRange === 'last7'
        ? { from: addDaysIso(-6), to: todayIso() }
        : { from: addDaysIso(-29), to: todayIso() };
      navigate(def.externalLink.page,
        def.externalLink.queryParams ? def.externalLink.queryParams(rangeIso) : rangeIso);
      return;
    }
    setActiveKey(def.key);
  };

  if (activeDefinition) {
    return (
      <div className="w-full min-h-screen bg-slate-50 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 dark:bg-[#050E1A]">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            <button type="button" onClick={() => setActivePage?.('dashboard')}
              className="cursor-pointer rounded-[6px] px-1.5 py-0.5 transition hover:bg-slate-100 hover:text-sky-700 dark:hover:bg-[#1E1E3F] dark:hover:text-sky-300">
              Dashboard
            </button>
            <ChevronRight size={12} aria-hidden="true" className="text-slate-300" />
            <button type="button" onClick={() => setActiveKey(null)}
              className="cursor-pointer rounded-[6px] px-1.5 py-0.5 transition hover:bg-slate-100 hover:text-sky-700 dark:hover:bg-[#1E1E3F] dark:hover:text-sky-300">
              Reports
            </button>
            <ChevronRight size={12} aria-hidden="true" className="text-slate-300" />
            <span className="rounded-[6px] px-1.5 py-0.5 text-[#0C2340] dark:text-slate-200">{activeDefinition.title}</span>
          </nav>

          <ReportRenderer
            definition={activeDefinition}
            user={user}
            appointments={scoped.appointments}
            offices={scoped.offices}
            staff={scoped.staff}
            services={scoped.services}
            rooms={scoped.rooms}
            orgs={scoped.orgs}
            onBack={() => setActiveKey(null)}
            onNavigate={navigate}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-slate-50 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 dark:bg-[#050E1A]">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5">

        <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          <button type="button" onClick={() => setActivePage?.('dashboard')}
            className="cursor-pointer rounded-[6px] px-1.5 py-0.5 transition hover:bg-slate-100 hover:text-sky-700 dark:hover:bg-[#1E1E3F] dark:hover:text-sky-300">
            Dashboard
          </button>
          <ChevronRight size={12} aria-hidden="true" className="text-slate-300" />
          <span className="rounded-[6px] px-1.5 py-0.5 text-[#0C2340] dark:text-slate-200">Reports</span>
        </nav>

        <header>
          <h1 className="font-[Outfit,sans-serif] text-[22px] font-extrabold leading-tight text-[#0C2340] dark:text-slate-100">
            Reports
          </h1>
          <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">
            On-demand analytics across appointments, walk-ins, staff and services.
          </p>
        </header>

        <section>
          <h2 className="mb-3 font-[Outfit,sans-serif] text-[12px] font-extrabold uppercase tracking-[0.08em] text-sky-700 dark:text-sky-300">
            Core Reports
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            {REPORT_REGISTRY.filter((r) => r.category === 'core').map((r) => (
              <Tile key={r.key} def={r} onOpen={handleTileClick} />
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 font-[Outfit,sans-serif] text-[12px] font-extrabold uppercase tracking-[0.08em] text-sky-700 dark:text-sky-300">
            Additional Reports
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            {REPORT_REGISTRY.filter((r) => r.category === 'stretch').map((r) => (
              <Tile key={r.key} def={r} onOpen={handleTileClick} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Tile({ def, onOpen }) {
  const { Icon } = def;
  const isExternal = Boolean(def.externalLink);
  return (
    <button type="button" onClick={() => onOpen(def)} title={def.title}
      className="group flex cursor-pointer flex-col gap-3 rounded-[14px] border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40 dark:border-[#142535] dark:bg-[#0A1828] dark:hover:border-sky-400/40">
      <div className="flex items-start justify-between gap-2">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-[10px] border border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/30 dark:bg-sky-500/15 dark:text-sky-300">
          <Icon size={18} aria-hidden="true" />
        </span>
        {isExternal ? (
          <ExternalLink size={14} aria-hidden="true" className="text-slate-300 transition group-hover:text-sky-500 dark:text-slate-500" />
        ) : (
          <ArrowRight size={14} aria-hidden="true" className="text-slate-300 transition group-hover:translate-x-1 group-hover:text-sky-500 dark:text-slate-500" />
        )}
      </div>
      <div>
        <p className="font-[Outfit,sans-serif] text-[15px] font-extrabold text-[#0C2340] dark:text-slate-100">
          {def.title}
        </p>
        <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">
          {def.description}
        </p>
      </div>
      {isExternal && (
        <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-sky-500 dark:text-sky-300">
          Opens in Audit Logs
        </p>
      )}
    </button>
  );
}

function pageToPath(page) {
  const map = {
    'dashboard':          '/dashboard',
    'guest-log':          '/guest-logs',
    'walkin':             '/walkin',
    'appointments':       '/appointments',
    'rooms':              '/rooms',
    'staff':              '/staff',
    'services':           '/services',
    'offices':            '/offices',
    'notifications':      '/notifications',
    'reports':            '/reports',
    'settings':           '/settings',
    'subscription':       '/subscription',
    'admin':              '/admin',
    'access-requests':    '/access-requests',
    'roles-permissions':  '/roles-permissions',
    'audit-logs':         '/audit-logs',
  };
  return map[page] || null;
}
