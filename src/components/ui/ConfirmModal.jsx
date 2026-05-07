import React, { useCallback, useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * ConfirmModal — canonical confirmation dialog.
 * Per QA Rule 46: destructive actions use a red Delete button and the message
 * should name the entity, e.g. "Are you sure you want to delete staff John Doe?".
 *
 * Props:
 *   open          — boolean, controls render
 *   title         — heading (default: "Confirm Delete")
 *   message       — descriptive body text naming the entity
 *   confirmLabel  — default "Delete"
 *   cancelLabel   — default "Cancel"
 *   destructive   — true → red confirm button (default true)
 *   loading       — disables confirm while async op runs
 *   onConfirm     — () => void | Promise<void>
 *   onCancel      — () => void  (also fires on Esc and backdrop click)
 */
export default function ConfirmModal({
  open = true,
  title = 'Confirm Delete',
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  destructive = true,
  loading = false,
  onConfirm,
  onCancel,
}) {
  const confirmBtnRef = useRef(null);
  const previouslyFocused = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    previouslyFocused.current = document.activeElement;
    const t = window.setTimeout(() => confirmBtnRef.current?.focus(), 0);

    const handleKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCancel?.();
      }
    };
    document.addEventListener('keydown', handleKey);

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.clearTimeout(t);
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = originalOverflow;
      if (previouslyFocused.current instanceof HTMLElement) {
        previouslyFocused.current.focus();
      }
    };
  }, [open, onCancel]);

  const handleBackdrop = useCallback(
    (e) => {
      if (e.target === e.currentTarget) onCancel?.();
    },
    [onCancel],
  );

  if (!open) return null;

  const confirmClasses = destructive
    ? 'border-red-600 bg-red-600 text-white hover:bg-red-700 hover:border-red-700 focus-visible:ring-red-500/40'
    : 'border-sky-700 bg-sky-700 text-white hover:bg-sky-800 hover:border-sky-800 focus-visible:ring-sky-500/40';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      aria-describedby="confirm-modal-desc"
      onMouseDown={handleBackdrop}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4 animate-[fadeIn_0.15s_ease-out]"
    >
      <div className="w-full max-w-md rounded-[14px] border border-slate-200 bg-white p-6 shadow-2xl dark:border-[#142535] dark:bg-[#0A1828]">
        <div className="mb-3 flex items-start gap-3">
          {destructive && (
            <div
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400"
            >
              <AlertTriangle size={20} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h3
              id="confirm-modal-title"
              className="text-[16px] font-extrabold text-[#0C2340] font-['Outfit',sans-serif] dark:text-slate-100"
            >
              {title}
            </h3>
            <p
              id="confirm-modal-desc"
              className="mt-1.5 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400"
            >
              {message}
            </p>
          </div>
        </div>

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 cursor-pointer rounded-[10px] border border-slate-200 bg-white py-2.5 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40 disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-200 dark:hover:bg-[#1E1E3F]"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 cursor-pointer rounded-[10px] border py-2.5 text-[13px] font-bold transition focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${confirmClasses}`}
          >
            {loading ? 'Processing…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
