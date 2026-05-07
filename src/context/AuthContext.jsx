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
    const role = (u.role || u.id || '').toString().toLowerCase();
    return { ...u, role };
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