import React from 'react';
import { useTheme } from '../context/ThemeContext';

/**
 * Simple emoji-based light/dark toggle.
 *   ☀️  → currently light (click to go dark)
 *   🌙  → currently dark  (click to go light)
 *
 * Uses inline styles so it can live inside inline-styled pages
 * (Landing) and Tailwind pages (Login) without conflict.
 *
 * Pass `fixed` to float it in the top-right corner, or pass a
 * `style` override to position it manually. No extra libraries.
 */
export default function ThemeToggle({ fixed = false, style = {} }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  const base = {
    width: 40,
    height: 40,
    borderRadius: 12,
    border: `1px solid ${isDark ? '#142535' : '#BAE6FD'}`,
    background: isDark ? '#0A1828' : '#FFFFFF',
    color: isDark ? '#E0F2FE' : '#0C2340',
    fontSize: 18,
    lineHeight: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: isDark
      ? '0 4px 14px rgba(0,0,0,0.35)'
      : '0 3px 10px rgba(14,165,233,0.12)',
    transition: 'transform .2s ease, background .2s ease, border-color .2s ease',
    ...(fixed
      ? { position: 'fixed', top: 16, right: 16, zIndex: 9999 }
      : {}),
    ...style,
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
      style={base}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      {isDark ? '☀️' : '🌙'}
    </button>
  );
}
