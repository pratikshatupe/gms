import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Gate any page by role.
 *   <ProtectedRoute allowedRoles={['superadmin','director']}><Admin /></ProtectedRoute>
 *
 * Behaviour:
 *  - No user → redirect to "/" (App.jsx handles the login view)
 *  - Wrong role → shows Access Denied card, auto-redirects after 1.5s
 *  - Allowed → renders children
 */
export default function ProtectedRoute({ allowedRoles, children, fallbackPath = '/' }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const role = user?.role;
  const authed = !!user;
  const allowed = authed && (!allowedRoles || allowedRoles.length === 0 || allowedRoles.includes(role));

  useEffect(() => {
    if (loading) return; // wait for localStorage hydration
    if (!authed) {
      navigate(fallbackPath, { replace: true });
      return;
    }
    if (!allowed) {
      const t = setTimeout(() => navigate(fallbackPath, { replace: true }), 1500);
      return () => clearTimeout(t);
    }
  }, [loading, authed, allowed, navigate, fallbackPath]);

  if (loading) return null; // still hydrating — don't redirect yet
  if (!authed) return null;

  if (!allowed) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="max-w-md rounded-[14px] border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-[24px]">🔒</div>
          <h2 className="font-[Outfit,sans-serif] text-[18px] font-extrabold text-[#0C2340]">Access Denied</h2>
          <p className="mt-2 text-[13px] text-slate-500">
            You do not have permission to view this page. Redirecting to Dashboard…
          </p>
        </div>
      </div>
    );
  }

  return children;
}
