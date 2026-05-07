import React, { useEffect, useRef, useState, useId } from 'react';
import { Calendar } from 'lucide-react';
import { toDDMMYYYY, fromDDMMYYYY } from '../../utils/datetime';

/**
 * DatePicker — always displays DD/MM/YYYY and stores ISO "YYYY-MM-DD".
 * Clicking anywhere on the field (including the calendar icon) opens the
 * browser's native picker; users may also type DD/MM/YYYY directly.
 *
 * Props:
 *   value        — ISO "YYYY-MM-DD" (or empty string)
 *   onChange     — (isoValue) => void
 *   placeholder  — default "DD/MM/YYYY"
 *   min / max    — ISO bounds forwarded to native picker
 *   error        — red border on truthy
 *   disabled
 *   id           — forwarded to underlying input (for Field label linkage)
 */
export default function DatePicker({
  value,
  onChange,
  placeholder = 'DD/MM/YYYY',
  min,
  max,
  error = false,
  disabled = false,
  id,
  className = '',
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedby,
  'aria-required': ariaRequired,
}) {
  const autoId = useId();
  const displayId = id || `date-${autoId}`;
  const nativeRef = useRef(null);
  const [typed, setTyped] = useState(() => toDDMMYYYY(value));

  // Keep typed text in sync when external value changes
  useEffect(() => {
    setTyped(toDDMMYYYY(value));
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
        // Fall through to focus fallback for unsupported browsers
      }
    }
    el.focus();
    el.click();
  };

  const handleTypedChange = (e) => {
    let v = e.target.value.replace(/[^\d/]/g, '').slice(0, 10);
    // auto-insert slashes as user types digits
    const digits = v.replace(/\//g, '');
    if (digits.length > 4) v = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
    else if (digits.length > 2) v = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    else v = digits;
    setTyped(v);
    if (v.length === 10) {
      const iso = fromDDMMYYYY(v);
      if (iso) onChange?.(iso);
    } else if (v === '') {
      onChange?.('');
    }
  };

  const handleTypedBlur = () => {
    // normalise or clear on blur
    if (!typed) return;
    const iso = fromDDMMYYYY(typed);
    if (iso) setTyped(toDDMMYYYY(iso));
    else setTyped(toDDMMYYYY(value));
  };

  const handleNativeChange = (e) => {
    const iso = e.target.value || '';
    onChange?.(iso);
    setTyped(toDDMMYYYY(iso));
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
        inputMode="numeric"
        autoComplete="off"
        value={typed}
        onChange={handleTypedChange}
        onBlur={handleTypedBlur}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedby}
        aria-required={ariaRequired}
        className="flex-1 rounded-[10px] bg-transparent px-3 py-2 text-[13px] text-slate-700 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed dark:text-slate-200"
      />

      <button
        type="button"
        tabIndex={-1}
        onClick={openNative}
        disabled={disabled}
        aria-label="Open date picker"
        className="mr-1.5 inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-sky-500 disabled:cursor-not-allowed dark:text-slate-400 dark:hover:bg-[#1E1E3F] dark:hover:text-sky-300"
      >
        <Calendar size={15} aria-hidden="true" />
      </button>

      {/* Hidden native input drives the OS picker. Kept visually hidden but focusable. */}
      <input
        ref={nativeRef}
        type="date"
        value={value || ''}
        onChange={handleNativeChange}
        min={min}
        max={max}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        className="pointer-events-none absolute right-2 top-1/2 h-0 w-0 -translate-y-1/2 opacity-0"
      />
    </div>
  );
}
