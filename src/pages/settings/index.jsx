import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  ClipboardCheck,
  Bell,
  Shield,
  CreditCard,
  Sun,
  Moon,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useRole } from '../../context/RoleContext';
import { useCollection, STORAGE_KEYS } from '../../store';
import { useTheme } from '../../context/ThemeContext';
import NoAccess from '../../components/NoAccess';
import SuperAdminSettings from './SuperAdminSettings';
import OrganisationProfileTab from './OrganisationProfileTab';
import CheckInConfigTab from './CheckInConfigTab';
import NotificationPreferencesTab from './NotificationPreferencesTab';
import SecurityTab from './SecurityTab';
import BillingTab from './BillingTab';

export const DEFAULT_SETTINGS = {
  maintenanceMode: false,
  allowRegistrations: true,
  force2FA: false,
  auditLogging: true,
  defaultTimezone: 'Asia/Dubai',
  dateFormat: 'DD/MM/YYYY',
  appName: 'Guest Management System',
  primaryColor: '#0284C7',
  notifEmail: true,
  notifWhatsApp: false,
  notifInApp: true,
  notifVisitorCheckin: true,
  notifAppointmentReminder: true,
  notifServiceAlert: true,
};

function withDefaults(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...DEFAULT_SETTINGS };
  return { ...DEFAULT_SETTINGS, ...raw };
}

const TAB_DEFS = [
  { id: 'profile', label: 'Organisation', icon: Building2 },
  { id: 'checkin', label: 'Check-In', icon: ClipboardCheck },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'billing', label: 'Billing', icon: CreditCard },
];

function permissionsForRole(role) {
  switch (role) {
    case 'director':
      return {
        profile: { visible: true, canEdit: true },
        checkin: { visible: true, canEdit: true },
        notifications: { visible: true, canEdit: true },
        security: { visible: true, canEdit: true },
        billing: { visible: true, canEdit: true },
      };
    case 'manager':
      return {
        profile: { visible: true, canEdit: false },
        checkin: { visible: true, canEdit: true },
        notifications: { visible: true, canEdit: true },
        security: { visible: true, canEdit: true },
        billing: { visible: true, canEdit: false },
      };
    case 'reception':
      return {
        profile: { visible: false, canEdit: false },
        checkin: { visible: false, canEdit: false },
        notifications: { visible: true, canEdit: true },
        security: { visible: true, canEdit: true },
        billing: { visible: false, canEdit: false },
      };
    default:
      return {
        profile: { visible: false, canEdit: false },
        checkin: { visible: false, canEdit: false },
        notifications: { visible: true, canEdit: true },
        security: { visible: true, canEdit: true },
        billing: { visible: false, canEdit: false },
      };
  }
}

export function canEditOrgSettings(user, tab) {
  const role = (user?.role || '').toLowerCase();
  if (role === 'superadmin') return false;
  const matrix = permissionsForRole(role);
  return Boolean(matrix?.[tab]?.canEdit);
}

function useTabFromUrl(visibleIds, fallback) {
  const read = () => {
    if (typeof window === 'undefined') return fallback;
    const qs = new URLSearchParams(window.location.search);
    const cand = qs.get('tab');
    if (cand && visibleIds.includes(cand)) return cand;
    return fallback;
  };

  const [tab, setTab] = useState(read);

  useEffect(() => {
    const onPop = () => setTab(read());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [visibleIds.join(',')]);

  const setTabAndUrl = (next) => {
    setTab(next);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', next);
      window.history.replaceState({}, '', url);
    }
  };

  return [tab, setTabAndUrl];
}

function ThemeCard() {
  const { theme, setTheme } = useTheme();

  const options = [
    { value: 'light', label: 'Light', icon: Sun, desc: 'Always use light theme' },
    { value: 'dark', label: 'Dark', icon: Moon, desc: 'Always use dark theme' },
  ];

  return (
    <div className="rounded-[14px] border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[var(--app-surface-muted)]">
          {theme === 'dark' ? (
            <Moon size={18} className="text-[var(--app-accent)]" />
          ) : (
            <Sun size={18} className="text-[var(--app-accent)]" />
          )}
        </div>
        <div>
          <h3 className="text-[14px] font-bold text-[var(--app-text)]">Appearance</h3>
          <p className="text-[12px] text-[var(--app-muted)]">Choose how the interface looks to you.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {options.map(({ value, label, icon: Icon, desc }) => {
          const active = theme === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setTheme(value)}
              className={[
                'group relative flex items-center gap-3 rounded-[12px] border-2 p-4 text-left transition-all duration-150',
                active
                  ? 'border-[var(--app-accent)] bg-[var(--app-surface-muted)]'
                  : 'border-[var(--app-border)] bg-[var(--app-surface)] hover:border-[var(--app-accent)]',
              ].join(' ')}
            >
              <div
                className={[
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] transition-colors',
                  active ? 'bg-[var(--app-surface)]' : 'bg-[var(--app-surface-muted)]',
                ].join(' ')}
              >
                <Icon
                  size={18}
                  className={active ? 'text-[var(--app-accent)]' : 'text-[var(--app-muted)]'}
                />
              </div>
              <div className="min-w-0">
                <div
                  className={[
                    'text-[13px] font-bold',
                    active ? 'text-[var(--app-accent)]' : 'text-[var(--app-text)]',
                  ].join(' ')}
                >
                  {label}
                </div>
                <div className="mt-0.5 text-[11px] leading-tight text-[var(--app-muted)]">
                  {desc}
                </div>
              </div>
              {active && (
                <span className="absolute right-3 top-3 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--app-accent)] text-white">
                  <svg viewBox="0 0 10 10" fill="none" className="h-2.5 w-2.5">
                    <path
                      d="M2 5l2 2 4-4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-3 rounded-[10px] bg-[var(--app-surface-muted)] px-3 py-2.5">
        <div className="flex gap-1.5">
          <span className="h-3 w-3 rounded-full border border-[var(--app-border)] bg-[var(--app-bg)] shadow-sm" />
          <span className="h-3 w-3 rounded-full bg-[var(--app-text)]" />
        </div>
        <span className="text-[11px] text-[var(--app-muted)]">
          Currently using{' '}
          <strong className="capitalize text-[var(--app-text)]">{theme}</strong> mode. Changes apply instantly and are saved across sessions.
        </span>
      </div>
    </div>
  );
}

export default function Settings({ setActivePage }) {
  const { user } = useAuth();
  const { hasPermission } = useRole();
  const role = (user?.role || '').toLowerCase();

  if (role === 'superadmin') return <SuperAdminSettings />;
  if (!hasPermission('settings', 'view')) {
    return (
      <NoAccess
        module="Settings"
        onGoBack={setActivePage ? () => setActivePage('dashboard') : undefined}
      />
    );
  }

  return <OrgSettingsShell user={user} setActivePage={setActivePage} />;
}

function OrgSettingsShell({ user, setActivePage }) {
  const role = (user?.role || '').toLowerCase();
  const matrix = useMemo(() => permissionsForRole(role), [role]);
  const visibleTabs = useMemo(() => TAB_DEFS.filter((t) => matrix[t.id]?.visible), [matrix]);

  const fallbackTab = visibleTabs[0]?.id || 'security';
  const [activeTab, setActiveTab] = useTabFromUrl(visibleTabs.map((t) => t.id), fallbackTab);

  if (visibleTabs.length === 0) {
    return (
      <NoAccess
        module="Settings"
        onGoBack={setActivePage ? () => setActivePage('dashboard') : undefined}
      />
    );
  }

  const ActiveBody = useMemo(() => {
    switch (activeTab) {
      case 'profile':
        return <OrganisationProfileTab canEdit={matrix.profile.canEdit} />;
      case 'checkin':
        return <CheckInConfigTab canEdit={matrix.checkin.canEdit} />;
      case 'notifications':
        return <NotificationPreferencesTab />;
      case 'security':
        return <SecurityTab />;
      case 'billing':
        return <BillingTab canEdit={matrix.billing.canEdit} setActivePage={setActivePage} />;
      default:
        return null;
    }
  }, [activeTab, matrix, setActivePage]);

  return (
    <div className="cgms-settings-page min-h-screen bg-[var(--app-bg)] p-4 text-[var(--app-text)] md:p-6 lg:p-7">
      <div className="mx-auto max-w-[1100px]">
        <header className="mb-5">
          <h1 className="text-[20px] font-extrabold text-[var(--app-text)] md:text-[22px]">
            Settings
          </h1>
          <p className="mt-1 text-[13px] text-[var(--app-muted)]">
            Manage your organisation, check-in workflow, notifications, security and billing.
          </p>
        </header>

        <div className="mb-5">
          <ThemeCard />
        </div>

        <nav
          role="tablist"
          aria-label="Settings sections"
          className="mb-5 flex gap-1 overflow-x-auto rounded-[12px] border border-[var(--app-border)] bg-[var(--app-surface)] p-1 shadow-sm"
        >
          {visibleTabs.map((t) => {
            const Icon = t.icon;
            const active = t.id === activeTab;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(t.id)}
                className={[
                  'inline-flex items-center gap-2 whitespace-nowrap rounded-[10px] px-3 py-2.5 text-[13px] font-bold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40',
                  active
                    ? 'bg-[var(--app-accent)] text-white shadow-sm'
                    : 'text-[var(--app-muted)] hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text)]',
                ].join(' ')}
              >
                <Icon size={14} aria-hidden="true" />
                {t.label}
              </button>
            );
          })}
        </nav>

        <div
          role="tabpanel"
          id={`panel-${activeTab}`}
          aria-labelledby={`tab-${activeTab}`}
          className="animate-[fadeIn_0.2s_ease_both]"
        >
          {ActiveBody}
        </div>
      </div>
    </div>
  );
}

export function MaintenanceBanner() {
  const [rawStored]    = useCollection(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
  const [platformRaw]  = useCollection(STORAGE_KEYS.PLATFORM_SETTINGS, {});
  const settings = withDefaults(rawStored);

  /* Bug 5 — read the platform-level Maintenance configuration alongside the
     per-org maintenanceMode flag. The platform window has start/end and a
     custom message; show the banner when EITHER is in effect. */
  const platformMaint = (platformRaw && platformRaw.maintenance) || null;
  const now = Date.now();
  const inPlatformWindow = (() => {
    if (!platformMaint) return false;
    if (platformMaint.mode) return true;
    const start = platformMaint.scheduleStartDate
      ? new Date(`${platformMaint.scheduleStartDate}T${platformMaint.scheduleStartTime || '00:00'}`).getTime()
      : null;
    const end = platformMaint.scheduleEndDate
      ? new Date(`${platformMaint.scheduleEndDate}T${platformMaint.scheduleEndTime || '23:59'}`).getTime()
      : null;
    if (start == null || end == null) return false;
    return now >= start && now <= end;
  })();

  if (!settings.maintenanceMode && !inPlatformWindow) return null;

  const message = inPlatformWindow
    ? (platformMaint?.message || 'Scheduled maintenance is in progress. Some features may be unavailable.')
    : '⚠️ System under maintenance. Some features may be unavailable.';

  return (
    <div
      role="alert"
      className="border-b border-red-200 bg-red-50 px-4 py-2.5 text-center text-[13px] font-bold text-red-700"
    >
      {message}
    </div>
  );
}

export function readSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return withDefaults(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}