import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

/**
 * Single source of truth for the theme localStorage key.
 * Kept in sync with the pre-hydration script in `index.html`.
 */
export const THEME_KEY = 'cgms_theme';

const ThemeContext = createContext(null);

function getStoredTheme() {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

function getSystemTheme() {
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

function applyTheme(theme) {
  const html = document.documentElement;
  html.classList.toggle('dark', theme === 'dark');
  html.setAttribute('data-theme', theme);
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => getStoredTheme() ?? getSystemTheme());

  /* Reflect the current theme into the DOM whenever it changes. */
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  /**
   * Auto-sync with the OS theme, but ONLY when the user has not manually
   * picked a theme (i.e. localStorage is empty). Any manual toggle persists
   * the value, which in turn short-circuits this listener.
   */
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const handleSystemChange = (e) => {
      if (getStoredTheme()) return;
      setThemeState(e.matches ? 'dark' : 'light');
    };
    mq.addEventListener('change', handleSystemChange);
    return () => mq.removeEventListener('change', handleSystemChange);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(THEME_KEY, next); } catch {}
      return next;
    });
  }, []);

  const setTheme = useCallback((next) => {
    if (next !== 'light' && next !== 'dark') return;
    try { localStorage.setItem(THEME_KEY, next); } catch {}
    setThemeState(next);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
