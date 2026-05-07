import React, { createContext, useContext, useMemo } from 'react';
import { useCollection, STORAGE_KEYS } from '../store';

/**
 * Bug 4 — Regional Defaults application.
 *
 * Reads the regional block from cgms_platform_settings (Super Admin → Settings
 * → Regional Defaults) and exposes:
 *   - currency / currencySymbol — used by formatMoney
 *   - dateFormat / timeFormat / timezone / language / weekStart
 *   - formatMoney(value): string  — primary formatter for prices, MRR, invoices
 *   - formatDate(value): string   — locale-respecting date formatter
 *
 * Components should call useRegional() instead of hard-coding ₹/$/£ or
 * Intl.DateTimeFormat options. Existing screens that still use a hardcoded
 * symbol fall back gracefully because formatMoney always returns a string.
 */
const CURRENCY_META = {
  INR: { symbol: '₹', locale: 'en-IN' },
  USD: { symbol: '$', locale: 'en-US' },
  GBP: { symbol: '£', locale: 'en-GB' },
  EUR: { symbol: '€', locale: 'en-IE' },
  AED: { symbol: 'AED ', locale: 'en-AE' },
  SAR: { symbol: 'SAR ', locale: 'en-SA' },
  QAR: { symbol: 'QAR ', locale: 'en-QA' },
  OMR: { symbol: 'OMR ', locale: 'en-OM' },
  KWD: { symbol: 'KWD ', locale: 'en-KW' },
  BHD: { symbol: 'BHD ', locale: 'en-BH' },
  JPY: { symbol: '¥', locale: 'ja-JP' },
  CNY: { symbol: '¥', locale: 'zh-CN' },
  AUD: { symbol: 'A$', locale: 'en-AU' },
  CAD: { symbol: 'C$', locale: 'en-CA' },
  SGD: { symbol: 'S$', locale: 'en-SG' },
};

const DEFAULT_REGIONAL = {
  country: 'India',
  timezone: 'Asia/Kolkata',
  dateFormat: 'DD/MM/YYYY',
  timeFormat: '12h',
  language: 'English',
  weekStart: 'Monday',
  currency: 'INR',
};

const RegionalContext = createContext({
  ...DEFAULT_REGIONAL,
  currencySymbol: '₹',
  formatMoney: (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`,
  formatDate: (d) => (d ? new Date(d).toLocaleDateString('en-GB') : ''),
});

function pickCurrency(stored) {
  return stored?.pricing?.currency || stored?.regional?.currency || DEFAULT_REGIONAL.currency;
}

function buildFormatters(regional, currency) {
  const meta = CURRENCY_META[currency] || CURRENCY_META.INR;
  const symbol = meta.symbol;
  const locale = meta.locale;

  const formatMoney = (n) => {
    const num = Number(n);
    if (!Number.isFinite(num)) return `${symbol}0`;
    return `${symbol}${num.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (value) => {
    if (!value) return '';
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const fmt = regional.dateFormat || DEFAULT_REGIONAL.dateFormat;
    /* Manual format pick — avoids pulling in a heavy date library while
       still honouring the three formats the Settings tab supports. */
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = String(d.getFullYear());
    if (fmt === 'MM/DD/YYYY') return `${mm}/${dd}/${yyyy}`;
    if (fmt === 'YYYY-MM-DD') return `${yyyy}-${mm}-${dd}`;
    return `${dd}/${mm}/${yyyy}`;
  };

  return { formatMoney, formatDate, currencySymbol: symbol, currencyLocale: locale };
}

export function RegionalProvider({ children }) {
  const [stored] = useCollection(STORAGE_KEYS.PLATFORM_SETTINGS, {});
  const value = useMemo(() => {
    const regional = (stored && stored.regional) || {};
    const merged = { ...DEFAULT_REGIONAL, ...regional };
    const currency = pickCurrency(stored) || merged.currency;
    const formatters = buildFormatters(merged, currency);
    return { ...merged, currency, ...formatters };
  }, [stored]);

  return (
    <RegionalContext.Provider value={value}>
      {children}
    </RegionalContext.Provider>
  );
}

export function useRegional() {
  return useContext(RegionalContext);
}

/* Static helpers usable outside React for legacy reducer / sort callers. */
export function formatMoneyStatic(n, currency = DEFAULT_REGIONAL.currency) {
  const meta = CURRENCY_META[currency] || CURRENCY_META.INR;
  const num = Number(n);
  if (!Number.isFinite(num)) return `${meta.symbol}0`;
  return `${meta.symbol}${num.toLocaleString(meta.locale, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
