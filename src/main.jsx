import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './index.css';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppointmentProvider, ToastHost } from './context/AppointmentContext';
import { NotificationProvider } from './context/NotificationContext';
import { LogProvider, LogActorSync } from './context/LogContext';
import { RoleProvider, useRole } from './context/RoleContext';
import { ThemeProvider } from './context/ThemeContext';
import { BrandingProvider } from './context/BrandingContext';
import { RegionalProvider } from './context/RegionalContext';
import { AUTH_ROLE_TO_KEY } from './utils/defaultPermissions';
import { useEffect } from 'react';

/**
 * Bridges AuthContext → RoleContext: whenever the logged-in user's role
 * changes, mirror it into the global RBAC current_role so every consumer
 * (Sidebar, page guards, dynamic buttons) updates immediately.
 */
function RoleSyncFromAuth() {
  const { user } = useAuth();
  const { setRole } = useRole();
  useEffect(() => {
    if (!user?.role) return;
    const mapped = AUTH_ROLE_TO_KEY[user.role.toLowerCase()];
    if (mapped) setRole(mapped);
  }, [user?.role, setRole]);
  return null;
}

/**
 * Provider nesting (outside → inside):
 *   LogProvider           — audit log store (consumed by AppointmentProvider)
 *     NotificationProvider — persistent notification log
 *       AuthProvider       — current user (multi-tenant: provides orgId)
 *         AppointmentProvider — appointments / guest-log / services / toast.
 *                               Reads the current user to stamp orgId onto
 *                               every new record.
 *           RoleProvider   — RBAC matrix + current-role bridge
 *             BrowserRouter
 *               RoleSyncFromAuth / LogActorSync / ToastHost / App
 *
 * AuthProvider must sit above AppointmentProvider so the latter can call
 * useAuth() to resolve the actor's orgId at create-time.
 */

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <BrandingProvider>
        <RegionalProvider>
          <LogProvider>
            <NotificationProvider>
              <AuthProvider>
                <AppointmentProvider>
                  <RoleProvider>
                    <BrowserRouter>
                      <RoleSyncFromAuth />
                      <LogActorSync />
                      <ToastHost />
                      <App />
                    </BrowserRouter>
                  </RoleProvider>
                </AppointmentProvider>
              </AuthProvider>
            </NotificationProvider>
          </LogProvider>
        </RegionalProvider>
      </BrandingProvider>
    </ThemeProvider>
  </React.StrictMode>
);
