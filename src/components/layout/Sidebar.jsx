import React, { useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useAppointments } from '../../context/AppointmentContext';
import { useUnreadCount } from '../../context/NotificationContext';
import { useRole } from '../../context/RoleContext';
import { useCollection, STORAGE_KEYS } from '../../store';

const R = {
  SUPER_ADMIN: 'superadmin',
  DIRECTOR: 'director',
  MANAGER: 'manager',
  SERVICE_STAFF: 'service',
  RECEPTION: 'reception',
};

const NAV = [
  { path: 'dashboard',         label: 'Dashboard',           icon: '⬛' },
  { path: 'guest-log',         label: 'Guest Log',           icon: '📋' },
  { path: 'walkin',            label: 'Walk-in Check-in',    icon: '🚶' },
  { path: 'appointments',      label: 'Appointments',        icon: '📅' },
  { path: 'rooms',             label: 'Venues & Rooms',      icon: '🏢' },
  { path: 'staff',             label: 'Team & Staff',        icon: '👥' },
  { path: 'services',          label: 'Services',            icon: '⚙️' },
  { path: 'offices',           label: 'Offices',             icon: '🌐' },
  { path: 'notifications',     label: 'Notifications',       icon: '🔔', badge: true },
  { path: 'reports',           label: 'Reports',             icon: '📊' },
  { path: 'settings',          label: 'Settings',            icon: '🔧' },
  { path: 'subscription',      label: 'Subscription',        icon: '💎' },
  { path: 'admin',             label: 'Organisations',       icon: '🛡️' },
  { path: 'roles-permissions', label: 'Roles & Permissions', icon: '🔐' },
  { path: 'audit-logs',        label: 'Audit Logs',          icon: '📜' },
  { path: 'coupons',           label: 'Coupons',              icon: '🏷️' },
  { path: 'referrals',         label: 'Referrals',            icon: '🔗' },
];

const roleColors = {
  [R.SUPER_ADMIN]: '#a29bfe',
  [R.DIRECTOR]:    '#55efc4',
  [R.MANAGER]:     '#34D399',
  [R.SERVICE_STAFF]:'#FBBF24',
  [R.RECEPTION]:   '#00cec9',
};

const roleLabels = {
  [R.SUPER_ADMIN]:  'Super Admin',
  [R.DIRECTOR]:     'Director',
  [R.MANAGER]:      'Manager',
  [R.SERVICE_STAFF]:'Service Staff',
  [R.RECEPTION]:    'Reception',
};

export default function Sidebar({
  activePage,
  setActivePage,
  collapsed,
  setCollapsed,
  isMobile,
  mobileOpen,
  onMobileClose,
  onLogout,
}) {
  const { user, logout: ctxLogout } = useAuth();
  const { hasPermission, currentRole } = useRole();
  const handleLogout = onLogout || ctxLogout;

  const allowed = useMemo(
    () => NAV.filter((n) => hasPermission(n.gateModule || n.path, 'view')),
    [hasPermission, currentRole],
  );

  const { staff } = useAppointments();
  const currentStaffId = useMemo(() => {
    if (!user) return null;
    if (user.staffId) return user.staffId;
    const match = staff.find(
      (s) => s.name?.toLowerCase() === (user.name || '').toLowerCase(),
    );
    return match ? match.id : null;
  }, [user, staff]);

  const unreadCount = useUnreadCount(user, currentStaffId);
  const isExpanded = isMobile ? true : !collapsed;
  const sidebarWidthClass = isMobile ? 'w-[260px]' : collapsed ? 'w-[72px]' : 'w-[260px]';

  if (isMobile && !mobileOpen) return null;

  const handleNavClick = (path) => {
    setActivePage(path);
    if (isMobile && onMobileClose) onMobileClose();
  };

  return (
    <>
      {isMobile && (
        <div
          onClick={onMobileClose}
          className="fixed inset-0 z-[99] bg-black/60 backdrop-blur-[2px]"
        />
      )}

      <aside
        className={[
          isMobile
            ? 'fixed left-0 top-0 bottom-0 z-[100] shadow-[4px_0_32px_rgba(0,0,0,0.5)]'
            : 'sticky top-0 z-[40] h-screen self-start flex-shrink-0',
          'flex flex-col overflow-x-hidden overflow-y-auto',
          'transition-[width] duration-300 ease-in-out',
          sidebarWidthClass,
        ].join(' ')}
        style={{
          background: 'linear-gradient(180deg, var(--sb-bg-from), var(--sb-bg-via), var(--sb-bg-to))',
          borderRight: '1px solid var(--sb-border)',
        }}
      >
        <div className="h-[2px] flex-shrink-0" style={{
          background: 'linear-gradient(90deg, #6c5ce7, #a29bfe, #00cec9)',
        }} />

        <div className="flex min-h-[58px] flex-shrink-0 items-center gap-3 overflow-hidden p-3.5"
          style={{ borderBottom: '1px solid var(--sb-border)' }}>
          <div className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[10px] text-[16px] font-extrabold text-white"
            style={{
              background: 'linear-gradient(135deg, #6c5ce7, #00cec9)',
              boxShadow: '0 0 16px rgba(108,92,231,0.45)',
            }}>
            G
          </div>

          {isExpanded && (
            <div className="min-w-0 flex-1 overflow-hidden">
              <div className="whitespace-nowrap font-[Outfit,sans-serif] text-[14px] font-bold leading-[1.2]"
                style={{ color: '#e9e4ff' }}>
                CorpGMS
              </div>
              <div className="whitespace-nowrap text-[10px]" style={{ color: 'rgba(162,155,254,0.6)' }}>
                Guest Management
              </div>
            </div>
          )}

          {!isMobile && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="ml-auto rounded-[6px] border-0 bg-transparent px-[6px] py-1 text-[12px] transition-colors duration-200"
              style={{ color: 'rgba(162,155,254,0.55)' }}
              onMouseEnter={e => { e.target.style.background = 'rgba(108,92,231,0.18)'; e.target.style.color = '#c4b8ff'; }}
              onMouseLeave={e => { e.target.style.background = 'transparent'; e.target.style.color = 'rgba(162,155,254,0.55)'; }}
              type="button"
            >
              {collapsed ? '→' : '←'}
            </button>
          )}

          {isMobile && (
            <button
              onClick={onMobileClose}
              className="ml-auto rounded-[6px] border-0 bg-transparent px-2 py-1 text-[18px] leading-none"
              style={{ color: 'rgba(162,155,254,0.6)' }}
              type="button"
            >
              ×
            </button>
          )}
        </div>

        <nav className="sidebar-scroll flex-1 overflow-y-auto overflow-x-hidden px-2 py-2">
          {allowed.map((item) => {
            const active = activePage === item.path;
            const isNotif = item.badge && unreadCount > 0;
            const accessCount = 0;
            const showAccessBadge = false;

            return (
              <button
                key={item.path}
                type="button"
                onClick={() => handleNavClick(item.path)}
                title={collapsed && !isMobile ? item.label : undefined}
                className="sidebar-nav-btn mb-[2px] flex w-full items-center gap-2 rounded-[8px] border-0 px-[11px] py-[9px] text-left font-inherit relative overflow-hidden transition-all duration-150"
                style={{
                  background: active ? 'var(--sb-active-bg)' : 'transparent',
                  borderLeft: active ? '2px solid var(--sb-accent)' : '2px solid transparent',
                  color: active ? 'var(--sb-text-active)' : 'var(--sb-text)',
                }}
              >
                <span className="relative flex w-[20px] flex-shrink-0 justify-center text-[15px]">
                  {item.icon}
                  {isNotif && !isExpanded && (
                    <span className="absolute -right-[4px] -top-[4px] h-2 w-2 rounded-full border border-ocean-900 bg-red-500" />
                  )}
                  {showAccessBadge && !isExpanded && (
                    <span className="absolute -right-[4px] -top-[4px] h-2 w-2 rounded-full border border-ocean-900 bg-red-500" />
                  )}
                </span>

                {isExpanded && (
                  <span className={[
                    'flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[13px]',
                    active ? 'font-semibold' : 'font-normal',
                  ].join(' ')}>
                    {item.label}
                  </span>
                )}

                {isExpanded && isNotif && (
                  <span className="min-w-[18px] rounded-full bg-red-500 px-1.5 py-[2px] text-center text-[10px] font-bold text-white">
                    {unreadCount}
                  </span>
                )}
                {isExpanded && showAccessBadge && (
                  <span className="min-w-[18px] rounded-full bg-red-500 px-1.5 py-[2px] text-center text-[10px] font-bold text-white" title={`${accessCount} pending access requests`}>
                    {accessCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {user && (
          <div className="flex-shrink-0 p-2 space-y-2" style={{ borderTop: '1px solid var(--sb-border)' }}>
            <div className="flex items-center gap-[9px] overflow-hidden rounded-[8px] px-[10px] py-[9px]"
              style={{
                border: '1px solid rgba(108,92,231,0.22)',
                background: 'rgba(108,92,231,0.10)',
              }}>
              <div
                className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-[8px] border text-[10px] font-bold"
                style={{
                  background: `${roleColors[user.role]}18`,
                  borderColor: `${roleColors[user.role]}38`,
                  color: roleColors[user.role],
                  fontFamily: 'Outfit, sans-serif',
                }}
              >
                {user.avatar || (user.name ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'U')}
              </div>

              {isExpanded && (
                <div className="min-w-0 flex-1">
                  <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[12px] font-semibold" style={{ color: '#e9e4ff' }}>
                    {user.name}
                  </div>
                  <div className="text-[10px]" style={{ color: roleColors[user.role] }}>
                    {roleLabels[user.role] || user.label}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleLogout}
              title="Log Out"
              type="button"
              className={[
                'sidebar-logout-btn flex w-full items-center gap-2 rounded-[8px] border border-red-500/20 bg-red-500/10 px-[11px] py-[9px]',
                'text-[13px] font-semibold text-red-300/90 transition-colors duration-150',
                'hover:bg-red-500/20 hover:text-red-200 hover:border-red-500/40',
                isExpanded ? 'justify-start' : 'justify-center',
              ].join(' ')}
            >
              <span className="text-[15px] leading-none">🚪</span>
              {isExpanded && <span className="flex-1 text-left">Log Out</span>}
            </button>
          </div>
        )}
      </aside>

      <style>{`
        .sidebar-nav-btn:hover:not([style*="var(--sb-accent)"]) {
          background: rgba(108,92,231,0.12) !important;
          color: #c4b8ff !important;
        }
        .sidebar-scroll::-webkit-scrollbar { width: 4px; }
        .sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
        .sidebar-scroll::-webkit-scrollbar-thumb { background: rgba(108,92,231,0.20); border-radius: 4px; }
        .sidebar-scroll::-webkit-scrollbar-thumb:hover { background: rgba(108,92,231,0.40); }
      `}</style>
    </>
  );
}
