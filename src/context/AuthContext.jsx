import React, { createContext, useContext, useState, useEffect } from "react";
import { STORAGE_KEYS } from "../store";

/* ─── Create Context ─── */
const AuthContext = createContext();

/* ─── Provider ─── */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  /* ─── Normalise user object: guarantee `.role` lowercase ─── */
  const normaliseUser = (u) => {
    if (!u) return null;
    /* Strip underscores so backend constants like `SUPER_ADMIN` collapse to
       the `superadmin` form the RBAC matrix and route gates compare against. */
    const role = (u.role || u.id || '').toString().toLowerCase().replace(/_/g, '');
    const out = { ...u, role };
    /* Back-fill legacy `organisationId` / `orgId` (used by Subscription,
       NotificationContext, byOrg() etc.) from the backend's `organizationId`,
       which may arrive populated as { _id, name, slug, isActive }. Without
       this the tenant is never resolved for backend-authenticated users and
       the Subscription page renders the empty-state card. */
    const orgRaw = u.organizationId ?? u.organisationId ?? u.orgId ?? null;
    if (orgRaw != null) {
      const orgId = (typeof orgRaw === 'object') ? (orgRaw._id || orgRaw.id || '') : orgRaw;
      if (!out.organisationId) out.organisationId = orgId;
      if (!out.orgId)          out.orgId          = orgId;
    }
    const offRaw = u.officeId ?? null;
    if (offRaw != null && (typeof offRaw === 'object')) {
      out.officeId = offRaw._id || offRaw.id || '';
    }
    return out;
  };

  /* ─── Load user from localStorage (on app start) ─── */
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem(STORAGE_KEYS.USER);
      if (savedUser) {
        const parsed = normaliseUser(JSON.parse(savedUser));
        setUser(parsed);
        /* Migrate older entries that lacked .role */
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(parsed));
      }
    } catch (err) {
      console.error("Error loading user:", err);
      localStorage.removeItem(STORAGE_KEYS.USER);
    } finally {
      setLoading(false);
    }
  }, []);

  /* ─── LOGIN ─── */
  const login = (userData) => {
    if (!userData) return;
    const normalised = normaliseUser(userData);
    setUser(normalised);
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(normalised));
  };

  /* ─── LOGOUT ─── */
  const logout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEYS.USER);
  };

  /* ─── UPDATE PROFILE — merge a patch into the current user and persist ─── */
  const updateUser = (patch) => {
    if (!patch) return;
    setUser((prev) => {
      if (!prev) return prev;
      const next = normaliseUser({ ...prev, ...patch });
      try { localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  /* ─── Check role — accepts string or array ─── */
  const hasRole = (roles) => {
    if (!user?.role) return false;
    if (Array.isArray(roles)) return roles.includes(user.role);
    return user.role === roles;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        updateUser,
        loading,
        isAuthenticated: !!user,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

/* ─── Hook ─── */
export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
};