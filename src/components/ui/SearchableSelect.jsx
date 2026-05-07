import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useId,
} from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';

/**
 * SearchableSelect — single-select combobox with in-popover search + keyboard nav.
 * Chevron rotates ▼→▲ when open (QA spec).
 *
 * Option shape:
 *   string                         → rendered as-is, value === label
 *   { value, label, meta?, disabled? }
 *
 * Props:
 *   value              — currently selected `value` (string|number|null)
 *   onChange           — (value, option) => void
 *   options            — array of strings or option objects
 *   placeholder        — button placeholder when nothing selected
 *   searchPlaceholder  — search input placeholder (default "Search…")
 *   error              — validation error (red border)
 *   disabled           — disabled state
 *   id                 — forwarded button id (for Field label linkage)
 *   renderOption       — optional (option) => ReactNode to customise row rendering
 *   noResultsText      — shown when search filters everything out
 */
export default function SearchableSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  error = false,
  disabled = false,
  id,
  renderOption,
  noResultsText = 'No matches found.',
  className = '',
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedby,
  'aria-required': ariaRequired,
}) {
  const autoId = useId();
  const listboxId = `${id || autoId}-listbox`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);

  const rootRef = useRef(null);
  const searchInputRef = useRef(null);
  const listRef = useRef(null);

  const normalised = useMemo(
    () =>
      options.map((opt) =>
        typeof opt === 'string' || typeof opt === 'number'
          ? { value: opt, label: String(opt) }
          : opt,
      ),
    [options],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return normalised;
    return normalised.filter((o) =>
      String(o.label ?? o.value ?? '')
        .toLowerCase()
        .includes(q),
    );
  }, [normalised, query]);

  const selected = useMemo(
    () => normalised.find((o) => o.value === value) || null,
    [normalised, value],
  );

  // Close on outside click
  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  // Autofocus search + reset active index when opening
  useEffect(() => {
    if (open) {
      setQuery('');
      const idx = normalised.findIndex((o) => o.value === value);
      setActiveIndex(idx >= 0 ? idx : 0);
      window.setTimeout(() => searchInputRef.current?.focus(), 0);
    }
  }, [open, value, normalised]);

  // Keep active row scrolled into view
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const el = listRef.current?.querySelector(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open, filtered]);

  const commitValue = useCallback(
    (opt) => {
      if (!opt || opt.disabled) return;
      onChange?.(opt.value, opt);
      setOpen(false);
    },
    [onChange],
  );

  const handleTriggerKey = (e) => {
    if (disabled) return;
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen(true);
    }
  };

  const handleSearchKey = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min((i < 0 ? -1 : i) + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      commitValue(filtered[activeIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActiveIndex(filtered.length - 1);
    }
  };

  const borderCls = error
    ? 'border-red-400 focus-visible:ring-red-500/30'
    : 'border-slate-200 hover:border-slate-300 focus-visible:ring-sky-500/30 dark:border-[#142535] dark:hover:border-sky-400/60';

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedby}
        aria-required={ariaRequired}
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        onKeyDown={handleTriggerKey}
        className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-[10px] border bg-white px-3 py-2 text-left text-[13px] text-slate-700 outline-none transition focus-visible:ring-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 dark:bg-[#071220] dark:text-slate-200 dark:disabled:bg-[#0E0D23] ${borderCls}`}
      >
        <span
          className={`min-w-0 flex-1 truncate ${
            !selected ? 'text-slate-400 dark:text-slate-500' : ''
          }`}
        >
          {selected ? (renderOption ? renderOption(selected) : selected.label) : placeholder}
        </span>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={`shrink-0 text-slate-400 transition-transform duration-150 ${
            open ? 'rotate-180' : 'rotate-0'
          }`}
        />
      </button>

      {open && (
        <div
          className="absolute left-0 right-0 z-50 mt-1.5 overflow-hidden rounded-[10px] border border-slate-200 bg-white shadow-lg dark:border-[#142535] dark:bg-[#0A1828]"
          role="presentation"
        >
          <div className="relative border-b border-slate-100 p-2 dark:border-[#142535]">
            <Search
              size={14}
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={handleSearchKey}
              placeholder={searchPlaceholder}
              aria-autocomplete="list"
              aria-controls={listboxId}
              className="w-full rounded-[8px] border border-slate-200 bg-white py-1.5 pl-8 pr-2 text-[13px] text-slate-700 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100 placeholder:text-slate-400 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-200 dark:focus:ring-sky-500/20"
            />
          </div>

          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            className="max-h-60 overflow-y-auto py-1"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-4 text-center text-[12px] text-slate-400">
                {noResultsText}
              </li>
            ) : (
              filtered.map((opt, idx) => {
                const isSelected = opt.value === value;
                const isActive = idx === activeIndex;
                return (
                  <li
                    key={`${opt.value}-${idx}`}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={opt.disabled || undefined}
                    data-index={idx}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      commitValue(opt);
                    }}
                    className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-[13px] transition ${
                      opt.disabled
                        ? 'cursor-not-allowed text-slate-300 dark:text-slate-600'
                        : isActive
                        ? 'bg-sky-50 text-sky-900 dark:bg-sky-500/15 dark:text-sky-100'
                        : 'text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {renderOption ? renderOption(opt) : opt.label}
                    </span>
                    {isSelected && (
                      <Check
                        size={14}
                        aria-hidden="true"
                        className="shrink-0 text-sky-500 dark:text-sky-400"
                      />
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
