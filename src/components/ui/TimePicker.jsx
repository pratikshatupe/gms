import React, { useEffect, useRef, useState, useId } from 'react';
import { Clock } from 'lucide-react';
import { to12Hour, from12Hour } from '../../utils/datetime';

/**
 * TimePicker — always displays HH:MM AM/PM (uppercase) and stores 24-hour "HH:mm".
 * Clock icon opens the browser's native picker; typed input is normalised on blur.
 *
 * Props:
 *   value        — 24-hour "HH:mm" (or empty string)
 *   onChange     — (value24) => void
 *   placeholder  — default "HH:MM AM/PM"
 *   error        — red border on truthy
 *   disabled
 *   id           — forwarded to underlying input (for Field label linkage)
 */
export default function TimePicker({
  value,
  onChange,
  placeholder = 'HH:MM AM/PM',
  error = false,
  disabled = false,
  id,
  className = '',
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedby,
  'aria-required': ariaRequired,
}) {
  const autoId = useId();
  const displayId = id || `time-${autoId}`;
  const nativeRef = useRef(null);
  const [typed, setTyped] = useState(() => to12Hour(value));

  useEffect(() => {
    setTyped(to12Hour(value));
  }, [value]);

  const openNative = () => {
    if (disabled) return;
    const el = nativeRef.current;
    if (!el) return;
    if (typeof el.showPicker === 'function') {
      try {
        el.showPicker();
        return;
      } catch {
        // fall through
      }
    }
    el.focus();
    el.click();
  };

  const handleTypedChange = (e) => {
    // Allow digits, colon, space, letters A/P/M only — always uppercase
    const raw = e.target.value.toUpperCase().replace(/[^0-9:APM\s]/g, '');
    setTyped(raw.slice(0, 8));
  };

  const handleTypedBlur = () => {
    if (!typed) return;
    const iso = from12Hour(typed);
    if (iso) {
      setTyped(to12Hour(iso));
      if (iso !== value) onChange?.(iso);
    } else {
      setTyped(to12Hour(value));
    }
  };

  const handleNativeChange = (e) => {
    const iso = e.target.value || '';
    onChange?.(iso);
    setTyped(to12Hour(iso));
  };

  const borderCls = error
    ? 'border-red-400 focus-within:ring-red-500/30'
    : 'border-slate-200 focus-within:border-sky-400 focus-within:ring-sky-500/20 dark:border-[#142535] dark:focus-within:border-sky-400';

  return (
    <div
      className={`relative flex w-full items-center rounded-[10px] border bg-white transition focus-within:ring-2 ${
        disabled ? 'cursor-not-allowed opacity-60' : ''
      } dark:bg-[#071220] ${borderCls} ${className}`}
    >
      <input
        id={displayId}
        type="text"
        inputMode="text"
        autoComplete="off"
        value={typed}
        onChange={handleTypedChange}
        onBlur={handleTypedBlur}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedby}
        aria-required={ariaRequired}
        className="flex-1 rounded-[10px] bg-transparent px-3 py-2 text-[13px] uppercase tracking-wide text-slate-700 outline-none placeholder:text-slate-400 placeholder:normal-case disabled:cursor-not-allowed dark:text-slate-200"
      />

      <button
        type="button"
        tabIndex={-1}
        onClick={openNative}
        disabled={disabled}
        aria-label="Open time picker"
        className="mr-1.5 inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-sky-500 disabled:cursor-not-allowed dark:text-slate-400 dark:hover:bg-[#1E1E3F] dark:hover:text-sky-300"
      >
        <Clock size={15} aria-hidden="true" />
      </button>

      <input
        ref={nativeRef}
        type="time"
        value={value || ''}
        onChange={handleNativeChange}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        className="pointer-events-none absolute right-2 top-1/2 h-0 w-0 -translate-y-1/2 opacity-0"
      />
    </div>
  );
}
