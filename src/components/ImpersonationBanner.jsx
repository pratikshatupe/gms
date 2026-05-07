import React, { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { endImpersonation, isImpersonating, readBackup, impersonationDurationMs } from '../utils/impersonate';

/**
 * Persistent yellow banner shown at the very top of the authenticated
 * app shell when a Super Admin is impersonating a tenant user.
 *
 * - Auto-renders only when isImpersonating() reports true.
 * - Updates the elapsed duration every 30 s so the banner never lies.
 * - "End Impersonation" restores the Super Admin session via
 *   endImpersonation() + AuthContext.login().
 */
export default function ImpersonationBanner() {
  const { user, login } = useAuth();
  const [tick, setTick] = useState(0);

  /* Tick every 30 s purely to re-render the duration label. */
  useEffect(() => {
    if (!isImpersonating()) return undefined;
    const handle = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(handle);
  }, []);

  if (!isImpersonating()) return null;
  const backup = readBackup();
  if (!backup) return null;

  const durationSec = Math.round(impersonationDurationMs() / 1000);
  const durationLabel = durationSec < 60
    ? `${durationSec}s`
    : durationSec < 3600
    ? `${Math.floor(durationSec / 60)}m`
    : `${Math.floor(durationSec / 3600)}h ${Math.floor((durationSec % 3600) / 60)}m`;

  const handleEnd = () => {
    const restored = endImpersonation(user);
    if (restored) login(restored);
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      data-tick={tick}
      className="sticky top-0 z-[60] flex flex-wrap items-center justify-between gap-3 border-b border-amber-300 bg-amber-100 px-4 py-2 text-[12px] font-semibold text-amber-900 shadow-sm dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200"
    >
      <div className="flex min-w-0 items-center gap-2">
        <ShieldAlert size={16} aria-hidden="true" className="text-amber-700" />
        <span className="truncate">
          🔐 Impersonating: <strong>{user?.name || 'Tenant user'}</strong>
          {user?.role ? <> ({user.role})</> : null}
          {backup?.orgName ? <> at <strong>{backup.orgName}</strong></> : null}
          <span className="ml-2 text-amber-700/80">· active for {durationLabel}</span>
        </span>
      </div>
      <button
        type="button"
        onClick={handleEnd}
        title="Restore your Super Admin session"
        className="cursor-pointer rounded-[8px] border border-amber-700 bg-amber-700 px-3 py-1 text-[11px] font-bold text-white transition hover:bg-amber-800"
      >
        End Impersonation
      </button>
    </div>
  );
}
