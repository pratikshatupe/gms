import React, { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';

import Login from './pages/Login';
import TermsOfService from './pages/Legal/TermsOfService';
import PrivacyPolicy from './pages/Legal/PrivacyPolicy';
import Sidebar from './components/layout/Sidebar';
import Topbar from './components/layout/Topbar';
import ChatBot from './components/Chatboat'; // ← NEW
import ChatbotWidget from './components/Chatbot/ChatbotWidget';

import NoAccess from './components/NoAccess';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from './context/AuthContext';
import { useRole } from './context/RoleContext';
import { useTheme } from './context/ThemeContext';
import { addAuditLog } from './utils/auditLogger';
import { startAppointmentReminderLoop } from './utils/appointmentReminders';
import { MaintenanceBanner } from './pages/settings/index';
import ImpersonationBanner from './components/ImpersonationBanner';
import TrialBanner from './components/TrialBanner';
import { hasPermission as hasPerm } from './utils/defaultPermissions';

/**
 * Every route is code-split. The Landing and Login routes stay eagerly loaded
 * (they are the first-paint experience), while every authenticated page is
 * fetched on demand the first time the user visits it.
 */
const Landing           = lazy(() => import('./pages/Landing/index'));
const Dashboard         = lazy(() => import('./pages/Dashboard/index'));
const GuestLog          = lazy(() => import('./pages/GuestLog/index'));
const GuestCheckOut     = lazy(() => import('./pages/GuestCheckOut/index'));
const WalkIn            = lazy(() => import('./pages/WalkIn/index'));
const Appointments      = lazy(() => import('./pages/Appointments/index'));
const Rooms             = lazy(() => import('./pages/Rooms/index'));
const Staff             = lazy(() => import('./pages/Staff/index'));
const Services          = lazy(() => import('./pages/Services/index'));
const Offices           = lazy(() => import('./pages/Offices/index'));
const Reports           = lazy(() => import('./pages/Reports/index'));
const Notifications     = lazy(() => import('./pages/Notifications/index'));
const Settings          = lazy(() => import('./pages/settings/index'));
const Subscription      = lazy(() => import('./pages/Subscription/index'));
const Admin             = lazy(() => import('./pages/Admin/index'));
const RolesPermissions  = lazy(() => import('./pages/rolepermission/RolePermission'));
const AuditLogs         = lazy(() => import('./pages/auditlogs/index'));
const Coupons           = lazy(() => import('./pages/Coupons/index'));
const Referrals         = lazy(() => import('./pages/Referrals/index'));

/** Path ↔ sidebar page key — single source of truth for the shell. */
const PATH_TO_PAGE = {
  '/dashboard':          'dashboard',
  '/guest-logs':         'guest-log',
  '/walkin':             'walkin',
  '/appointments':       'appointments',
  '/rooms':              'rooms',
  '/staff':              'staff',
  '/services':           'services',
  '/offices':            'offices',
  '/notifications':      'notifications',
  '/reports':            'reports',
  '/settings':           'settings',
  '/subscription':       'subscription',
  '/admin':              'admin',
  '/roles-permissions':  'roles-permissions',
  '/audit-logs':         'audit-logs',
  '/coupons':            'coupons',
  '/referrals':          'referrals',
  '/integrations':       'integrations',
};

const PAGE_TO_PATH = Object.fromEntries(
  Object.entries(PATH_TO_PAGE).map(([p, k]) => [k, p]),
);

/**
 * Role-aware landing path. Reads from the saved RBAC matrix instead of
 * hardcoding role-specific paths — so when a Director grants ServiceStaff
 * dashboard access, login routes there. Falls back through a priority list
 * of modules, then any module the user has `view` on, then `/login`.
 */
const LANDING_PRIORITY = [
  ['dashboard',     '/dashboard'],
  ['services',      '/services'],
  ['guest-log',     '/guest-logs'],
  ['walkin',        '/walkin'],
  ['appointments',  '/appointments'],
  ['rooms',         '/rooms'],
  ['staff',         '/staff'],
  ['offices',       '/offices'],
  ['reports',       '/reports'],
  ['notifications', '/notifications'],
  ['settings',      '/settings'],
  ['admin',         '/admin'],
];

export function landingPathFor(user) {
  if (!user?.role) return '/login';
  for (const [moduleKey, path] of LANDING_PRIORITY) {
    if (hasPerm(user, moduleKey, 'view')) return path;
  }
  return '/login';
}

/** Page-level RBAC gate reading the live permission matrix from RoleContext. */
function RbacGate({ module, children }) {
  const { hasPermission } = useRole();
  const { user } = useAuth();
  const navigate = useNavigate();
  if (!hasPermission(module, 'view')) {
    return <NoAccess module={module} onGoBack={() => navigate(landingPathFor(user))} />;
  }
  return children;
}

function NotFoundPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const landing = landingPathFor(user);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-semibold text-slate-900">Page Not Found</h1>
      <p className="mt-2 text-sm text-slate-600">The page you requested does not exist.</p>
      <button
        type="button"
        onClick={() => navigate(landing)}
        title={landing === '/services' ? 'Go to My Tasks' : 'Go to Dashboard'}
        className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-sky-700 bg-sky-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-700 hover:border-sky-800 focus:outline-none focus:ring-2 focus:ring-sky-400"
      >
        {landing === '/services' ? 'Go to My Tasks' : 'Go to Dashboard'}
      </button>
    </div>
  );
}

function PageLoader() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[40vh] items-center justify-center"
    >
      <div
        aria-hidden="true"
        className="h-8 w-8 animate-spin rounded-full border-2 border-sky-200 border-t-sky-700"
      />
      <span className="sr-only">Loading page…</span>
    </div>
  );
}

/**
 * Public landing route — always renders the marketing page at "/",
 * regardless of whether the visitor already has a session.
 */
function LandingRoute() {
  const navigate = useNavigate();

  const handleRegLogin = (userData) => {
    if (userData?.password) {
      try {
        sessionStorage.setItem('cgms_reg_prefill', JSON.stringify({
          email: userData.email || userData.emailId || '',
          password: userData.password || '',
        }));
      } catch(e) {}
    }
    navigate('/login');
  };

  return (
    <Suspense fallback={<PageLoader />}>
      <Landing
        onEnterApp={() => navigate('/login')}
        onLogin={handleRegLogin}
      />
    </Suspense>
  );
}

/** /login — form page. Delegates success to the shared login handler. */
function LoginRoute() {
  const { user, login } = useAuth();
  const navigate = useNavigate();

  if (user) return <Navigate to={landingPathFor(user)} replace />;

  const handleLoginSuccess = (role) => {
    login(role);
    addAuditLog({
      userName:    role?.name || 'Unknown',
      role:        (role?.role || role?.id || '').toString(),
      action:      'LOGIN',
      module:      'Auth',
      description: 'User logged in',
    });
    navigate(landingPathFor(role), { replace: true });
  };

  return <Login onBackToLanding={() => navigate('/')} onLogin={handleLoginSuccess} />;
}

/**
 * Authenticated-app shell. Sidebar + Topbar + <Outlet /> + ChatBot (fixed floating).
 */
function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setMobileOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const stop = startAppointmentReminderLoop(60_000);
    return stop;
  }, []);

  const activePage = PATH_TO_PAGE[location.pathname] || 'dashboard';

  const handlePageChange = useCallback((page) => {
    const nextPath = PAGE_TO_PATH[page];
    if (!nextPath) return;
    navigate(nextPath);
    if (isMobile) setMobileOpen(false);
  }, [navigate, isMobile]);

  const handleLogout = useCallback(() => {
    const snapshot = user;
    logout();
    addAuditLog({
      userName:    snapshot?.name || 'Unknown',
      role:        snapshot?.role || '',
      action:      'LOGOUT',
      module:      'Auth',
      description: 'User logged out',
    });
    navigate('/', { replace: true });
  }, [user, logout, navigate]);

  return (
    <div className="flex min-h-screen w-full bg-[#F0F9FF] dark:bg-slate-950">
      {isMobile && mobileOpen && (
        <div onClick={() => setMobileOpen(false)} className="fixed inset-0 z-[99] bg-black/50" />
      )}
      <Sidebar
        activePage={activePage}
        setActivePage={handlePageChange}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        isMobile={isMobile}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        onLogout={handleLogout}
      />
      <div className="flex flex-1 min-w-0 flex-col">
        <Topbar
          activePage={activePage}
          setActivePage={handlePageChange}
          isMobile={isMobile}
          onMenuClick={() => setMobileOpen(true)}
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          user={user}
          onLogout={handleLogout}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
        <ImpersonationBanner />
        <MaintenanceBanner />
        <TrialBanner />
        <main className="flex-1 w-full min-w-0 overflow-x-hidden px-3 py-4 sm:px-4 sm:py-6 lg:px-6">
          <Suspense fallback={<PageLoader />}>
            <Outlet context={{ user, setActivePage: handlePageChange }} />
          </Suspense>
        </main>
      </div>

      {/* ── ChatBot — visible on every authenticated page ── */}
      <ChatBot />
      <ChatbotWidget variant="floating" />
    </div>
  );
}

/**
 * Small helper that wraps a lazy page with its RBAC gate and injects the
 * legacy props the inner pages still expect.
 */
function GatedPage({ module, Component }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const setActivePage = useCallback((page) => {
    const path = PAGE_TO_PATH[page];
    if (path && path !== location.pathname) navigate(path);
  }, [location.pathname, navigate]);
  return (
    <RbacGate module={module}>
      <Component user={user} setActivePage={setActivePage} />
    </RbacGate>
  );
}

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<LandingRoute />} />
      <Route path="/login" element={<LoginRoute />} />
      <Route path="/terms" element={<TermsOfService />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route
        path="/checkout/:appointmentId/:badgeNumber"
        element={<Suspense fallback={<PageLoader />}><GuestCheckOut /></Suspense>}
      />

      {/* Protected app shell */}
      <Route
        element={
          <ProtectedRoute fallbackPath="/">
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard"          element={<GatedPage module="dashboard"         Component={Dashboard} />} />
        <Route path="/guest-logs"         element={<GatedPage module="guest-log"         Component={GuestLog} />} />
        <Route path="/walkin"             element={<GatedPage module="walkin"            Component={WalkIn} />} />
        <Route path="/appointments"       element={<GatedPage module="appointments"      Component={Appointments} />} />
        <Route path="/rooms"              element={<GatedPage module="rooms"             Component={Rooms} />} />
        <Route path="/staff"              element={<GatedPage module="staff"             Component={Staff} />} />
        <Route path="/services"           element={<GatedPage module="services"          Component={Services} />} />
        <Route path="/offices"            element={<GatedPage module="offices"           Component={Offices} />} />
        <Route path="/notifications"      element={<GatedPage module="notifications"     Component={Notifications} />} />
        <Route path="/reports"            element={<GatedPage module="reports"           Component={Reports} />} />
        <Route path="/settings"           element={<GatedPage module="settings"          Component={Settings} />} />
        <Route path="/subscription"       element={<GatedPage module="subscription"      Component={Subscription} />} />
        <Route path="/admin"              element={<GatedPage module="admin"             Component={Admin} />} />
        <Route path="/roles-permissions"  element={<RolesPermissionsRoute />} />
        <Route path="/audit-logs"         element={<GatedPage module="audit-logs"        Component={AuditLogs} />} />
        <Route path="/coupons"            element={<GatedPage module="coupons"           Component={Coupons} />} />
        <Route path="/referrals"          element={<GatedPage module="referrals"         Component={Referrals} />} />
        <Route path="*"                   element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

function RolesPermissionsRoute() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const role = (user?.role || '').toString().toLowerCase();

  if (!['superadmin', 'director'].includes(role)) {
    return <NoAccess module="roles-permissions" onGoBack={() => navigate(landingPathFor(user))} />;
  }

  return (
    <RbacGate module="roles-permissions">
      <RolesPermissions tenantId={user?.tenantId || 'org_1'} />
    </RbacGate>
  );
}