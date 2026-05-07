import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { useCollection, STORAGE_KEYS } from '../store';

/**
 * Bug 2 — Platform Branding application.
 *
 * Reads platform settings (the same cgms_platform_settings entry the Super
 * Admin Settings tab writes) and applies the brand at runtime:
 *   - sets document.title to the saved Platform Name
 *   - swaps the favicon to the saved data URL
 *   - exposes --brand-primary / --brand-secondary / --brand-accent CSS
 *     variables so any component can pick them up via var(--brand-primary)
 *
 * Components that need to render the brand (logo, name) can call
 * useBranding() to get the merged values without reaching into localStorage.
 */
const BrandingContext = createContext({
  name: 'CorpGMS',
  tagline: 'Corporate Guest Management',
  logoDataUrl: '',
  faviconDataUrl: '',
  primary: '#0284C7',
  secondary: '#0EA5E9',
  accent: '#10B981',
  emailFromName: 'CorpGMS Team',
  emailFromAddress: 'no-reply@corpgms.ae',
  footer: '© 2026 CorpGMS — All rights reserved.',
});

const DEFAULT_BRANDING = {
  name: 'CorpGMS',
  tagline: 'Corporate Guest Management',
  logoDataUrl: '',
  faviconDataUrl: '',
  primary: '#0284C7',
  secondary: '#0EA5E9',
  accent: '#10B981',
  emailFromName: 'CorpGMS Team',
  emailFromAddress: 'no-reply@corpgms.ae',
  footer: '© 2026 CorpGMS — All rights reserved.',
};

function ensureFavicon() {
  let link = document.querySelector("link[rel='icon']");
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  return link;
}

export function BrandingProvider({ children }) {
  /* useCollection isn't shape-strict — the platform settings entry is an
     object, not an array, but the hook still gives us reactive cross-tab
     updates whenever Save Changes runs in Settings. */
  const [stored] = useCollection(STORAGE_KEYS.PLATFORM_SETTINGS, {});
  const branding = useMemo(() => {
    const fromStore = stored && typeof stored === 'object' && stored.branding;
    return { ...DEFAULT_BRANDING, ...(fromStore || {}) };
  }, [stored]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    /* Browser tab title / favicon. */
    if (branding.name) document.title = branding.name;
    const favicon = ensureFavicon();
    if (branding.faviconDataUrl) favicon.href = branding.faviconDataUrl;
    /* CSS variables for runtime theme. */
    const root = document.documentElement;
    if (branding.primary)   root.style.setProperty('--brand-primary',   branding.primary);
    if (branding.secondary) root.style.setProperty('--brand-secondary', branding.secondary);
    if (branding.accent)    root.style.setProperty('--brand-accent',    branding.accent);
  }, [branding]);

  return (
    <BrandingContext.Provider value={branding}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  return useContext(BrandingContext);
}
