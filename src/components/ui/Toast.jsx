import React, { useEffect, useRef } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const VARIANTS = {
  success: {
    Icon: CheckCircle2,
    classes:
      'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300',
    iconClass: 'text-emerald-600 dark:text-emerald-400',
  },
  error: {
    Icon: XCircle,
    classes:
      'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300',
    iconClass: 'text-red-600 dark:text-red-400',
  },
  warning: {
    Icon: AlertTriangle,
    classes:
      'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
    iconClass: 'text-amber-600 dark:text-amber-400',
  },
  info: {
    Icon: Info,
    classes:
      'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300',
    iconClass: 'text-sky-600 dark:text-sky-400',
  },
};

/**
 * Toast — canonical notification. Auto-dismisses after `duration` ms (default 3500).
 * Props:
 *   message   — string (should end with a full stop per QA rule)
 *   type      — 'success' | 'error' | 'warning' | 'info'   (default: success)
 *   onClose   — () => void
 *   duration  — ms before auto-close; pass 0 to disable auto-dismiss
 */
export default function Toast({
  message,
  type = 'success',
  onClose,
  duration = 3500,
}) {
  const timerRef = useRef(null);
  const variant = VARIANTS[type] || VARIANTS.success;
  const { Icon } = variant;

  useEffect(() => {
    if (!onClose || !duration) return undefined;
    timerRef.current = window.setTimeout(onClose, duration);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [onClose, duration, message]);

  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      aria-live={type === 'error' ? 'assertive' : 'polite'}
      className={`fixed right-4 top-4 z-[10000] flex min-w-[260px] max-w-sm items-start gap-3 rounded-[10px] border px-4 py-3 text-[13px] font-semibold shadow-lg animate-[fadeIn_0.2s_ease-out] ${variant.classes}`}
    >
      <Icon
        size={18}
        className={`mt-0.5 shrink-0 ${variant.iconClass}`}
        aria-hidden="true"
      />
      <span className="flex-1 leading-snug">{message}</span>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss notification"
          className="-mr-1 -mt-1 inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-current opacity-60 transition hover:bg-black/5 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current/40 dark:hover:bg-white/10"
        >
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
