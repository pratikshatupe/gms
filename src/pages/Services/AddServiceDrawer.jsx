import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X, Sparkles, Tag, Clock, Building2, FileText, Loader2, Check,
} from 'lucide-react';
import { Field, SearchableSelect, Toast } from '../../components/ui';
import { useCollection, STORAGE_KEYS } from '../../store';
import {
  MOCK_SERVICES, MOCK_OFFICES, MOCK_ORGANIZATIONS,
} from '../../data/mockData';
import { addAuditLog } from '../../utils/auditLogger';

export const SERVICE_CATEGORIES = [
  'Refreshment', 'IT Support', 'Facility', 'Administrative', 'Other',
];

export const PRICE_UNITS = ['flat', 'per page', 'per hour', 'per minute'];

export const PRICE_UNIT_LABEL = {
  flat: 'Flat rate',
  'per page': 'Per page',
  'per hour': 'Per hour',
  'per minute': 'Per minute',
};

export const SERVICE_ICON_SUGGESTIONS = Object.freeze({
  Refreshments: ['☕', '🍵', '🥤', '💧', '🧃', '🍹', '🥛', '🍪'],
  'IT Support': ['🖨', '💻', '📱', '🖥', '🔌', '📡', '🎧', '🖱'],
  Facility: ['🚗', '🅿️', '🧹', '🧻', '🔑', '🪑', '🛋', '🧊'],
  Administrative: ['📄', '📋', '📞', '✉️', '📦', '🎫', '📝', '💼'],
});

export const DEFAULT_ESTIMATED_MINUTES = 5;
export const SERVICE_STATUSES = ['Active', 'Inactive'];

export function resolveCurrencyForOrg(org) {
  if (!org) return 'INR';
  if (org.currency) return org.currency;
  if (org.country === 'India') return 'INR';
  return 'INR';
}

export function formatServicePrice(amount, currency) {
  const n = Number(amount) || 0;
  if (currency === 'INR') {
    return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  }
  return `₹${n.toLocaleString('en-GB', { maximumFractionDigits: 2 })}`;
}

export function currencySymbolForInput(currency) {
  if (currency === 'INR') return '₹';
  return currency || 'INR';
}

export function byOrg(records, user) {
  if (!Array.isArray(records)) return [];
  const role = String(user?.role || '').toLowerCase();
  if (role === 'superadmin') return records;
  const orgId = user?.organisationId || user?.orgId || null;
  if (!orgId) return [];
  return records.filter((r) => !r?.orgId || r.orgId === orgId);
}

export function isValidEmoji(value) {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;

  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    let count = 0;
    for (const _ of seg.segment(trimmed)) {
      count += 1;
      if (count > 1) return false;
    }
    return count === 1;
  }

  return [...trimmed].length >= 1 && [...trimmed].length <= 4;
}

const isBlank = (v) => v == null || String(v).trim().length === 0;
const SERVICE_NAME_RE = /^(?=.*[A-Za-z])[A-Za-z ,.&()'/-]+$/;

function normalizeSpaces(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function sanitizeServiceName(value) {
  return String(value || '')
    .replace(/[^A-Za-z ,.&()'/-]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^\s+/g, '')
    .slice(0, 50);
}

function sanitizeServiceCode(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, 20);
}

function sanitizeDuration(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 3);
}

function sanitizePrice(value) {
  let v = String(value || '').replace(/[^0-9.]/g, '');
  const firstDot = v.indexOf('.');
  if (firstDot !== -1) {
    v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, '');
  }

  const [wholeRaw = '', decimalRaw = ''] = v.split('.');
  const whole = wholeRaw.slice(0, 6);
  const decimal = decimalRaw.slice(0, 2);

  if (v.includes('.')) return `${whole}.${decimal}`;
  return whole;
}

function sanitizeDescription(value) {
  return String(value || '').slice(0, 500);
}

export function validateServiceForm(form, allServices, orgId, offices = [], opts = {}) {
  const { excludeId = null } = opts;
  const e = {};

  const name = normalizeSpaces(form.name);
  const code = sanitizeServiceCode(form.code);
  const description = String(form.description || '').trim();

  const validOfficeIds = new Set(
    (offices || [])
      .filter((o) => String(o?.status || 'Active') !== 'Inactive')
      .map((o) => o.id)
  );

  if (isBlank(name)) {
    e.name = 'Service Name is required.';
  } else if (name.length < 2) {
    e.name = 'Service Name must be at least 2 characters.';
  } else if (name.length > 50) {
    e.name = 'Service Name must be 50 characters or fewer.';
  } else if (!SERVICE_NAME_RE.test(name)) {
    e.name = 'Service Name must contain letters only. Numbers are not allowed.';
  } else {
    const dupName = (allServices || []).find(
      (s) =>
        s &&
        s.orgId === orgId &&
        normalizeSpaces(s.name).toLowerCase() === name.toLowerCase() &&
        s.id !== excludeId
    );
    if (dupName) e.name = 'Service Name already exists in your organisation.';
  }

  if (isBlank(code)) {
    e.code = 'Service Code is required.';
  } else if (code.length < 3 || code.length > 20) {
    e.code = 'Service Code must be 3 to 20 characters.';
  } else if (!/^[A-Z0-9-]+$/.test(code)) {
    e.code = 'Service Code accepts letters, digits and hyphens only.';
  } else {
    const dup = (allServices || []).find(
      (s) =>
        s &&
        s.orgId === orgId &&
        String(s.code || '').toUpperCase() === code &&
        s.id !== excludeId
    );
    if (dup) e.code = 'Service Code must be unique within your organisation.';
  }

  if (isBlank(form.category) || !SERVICE_CATEGORIES.includes(form.category)) {
    e.category = 'Category is required.';
  }

  if (!isValidEmoji(form.icon)) {
    e.icon = 'Icon is required.';
  }

  const est = form.estimatedTimeMinutes;
  if (est == null || est === '') {
    e.estimatedTimeMinutes = 'Estimated Duration is required.';
  } else {
    const n = Number(est);
    if (!Number.isFinite(n) || !Number.isInteger(n)) {
      e.estimatedTimeMinutes = 'Estimated Duration must be a whole number.';
    } else if (n < 1) {
      e.estimatedTimeMinutes = 'Estimated Duration must be at least 1 minute.';
    } else if (n > 120) {
      e.estimatedTimeMinutes = 'Estimated Duration must be 120 minutes or fewer.';
    }
  }

  if (typeof form.chargeable !== 'boolean') {
    e.chargeable = 'Chargeable is required.';
  }

  if (form.chargeable) {
    const p = form.price;
    if (p == null || p === '') {
      e.price = 'Price is required for chargeable services.';
    } else {
      const n = Number(p);
      if (!Number.isFinite(n)) {
        e.price = 'Price must be a valid number.';
      } else if (n < 0) {
        e.price = 'Price cannot be negative.';
      } else if (n > 999999) {
        e.price = 'Price must be 999999 or fewer.';
      }
    }

    if (!PRICE_UNITS.includes(form.priceUnit)) {
      e.priceUnit = 'Price Unit is required.';
    }
  }

  if (!Array.isArray(form.availableOfficeIds) || form.availableOfficeIds.length === 0) {
    e.availableOfficeIds = 'Please select at least one office where this service is available.';
  } else {
    const hasInvalidOffice = form.availableOfficeIds.some((id) => !validOfficeIds.has(id));
    if (hasInvalidOffice) {
      e.availableOfficeIds = 'One or more selected offices are invalid.';
    }
  }

  if (!SERVICE_STATUSES.includes(form.status)) {
    e.status = 'Status is required.';
  }

  if (description.length > 500) {
    e.description = 'Description must be 500 characters or fewer.';
  }

  return e;
}

export function emptyServiceShape() {
  return {
    name: '',
    code: '',
    category: '',
    icon: '',
    estimatedTimeMinutes: DEFAULT_ESTIMATED_MINUTES,
    chargeable: false,
    price: '',
    priceUnit: 'flat',
    availableOfficeIds: [],
    assignedStaffIds: [],
    status: 'Active',
    description: '',
  };
}

export default function AddServiceDrawer({ open, onClose, onCreated, currentUser }) {
  const [services, addService] = useCollection(STORAGE_KEYS.SERVICES, MOCK_SERVICES);
  const [officesAll] = useCollection(STORAGE_KEYS.OFFICES, MOCK_OFFICES);
  const [orgsAll] = useCollection(STORAGE_KEYS.ORGANIZATIONS, MOCK_ORGANIZATIONS);
  const orgId = currentUser?.organisationId || currentUser?.orgId || null;

  const userOffices = useMemo(
    () =>
      byOrg(officesAll, currentUser)
        .filter((o) => String(o?.status || 'Active') !== 'Inactive')
        .sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [officesAll, currentUser]
  );

  const org = useMemo(
    () => (orgsAll || []).find((o) => o?.id === orgId) || null,
    [orgsAll, orgId]
  );

  const currency = resolveCurrencyForOrg(org);

  const [form, setForm] = useState(emptyServiceShape());
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const closeBtnRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setForm(emptyServiceShape());
    setErrors({});
    setSaving(false);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape' && !saving) onClose?.();
    };
    document.addEventListener('keydown', onKey);
    const t = window.setTimeout(() => closeBtnRef.current?.focus(), 30);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
      window.clearTimeout(t);
    };
  }, [open, saving, onClose]);

  if (!open) return null;

  const setField = (key, value) => {
    let nextValue = value;

    if (key === 'name') nextValue = sanitizeServiceName(value);
    if (key === 'code') nextValue = sanitizeServiceCode(value);
    if (key === 'estimatedTimeMinutes') nextValue = sanitizeDuration(value);
    if (key === 'price') nextValue = sanitizePrice(value);
    if (key === 'description') nextValue = sanitizeDescription(value);

    setForm((f) => ({ ...f, [key]: nextValue }));

    if (errors[key]) {
      setErrors((e) => {
        const n = { ...e };
        delete n[key];
        return n;
      });
    }
  };

  const toggleOffice = (officeId) => {
    setForm((f) => {
      const set = new Set(f.availableOfficeIds || []);
      if (set.has(officeId)) set.delete(officeId);
      else set.add(officeId);
      const nextArr = userOffices.map((o) => o.id).filter((id) => set.has(id));
      return { ...f, availableOfficeIds: nextArr };
    });

    if (errors.availableOfficeIds) {
      setErrors((e) => {
        const n = { ...e };
        delete n.availableOfficeIds;
        return n;
      });
    }
  };

  const selectAllOffices = () => {
    setForm((f) => ({ ...f, availableOfficeIds: userOffices.map((o) => o.id) }));
    if (errors.availableOfficeIds) {
      setErrors((e) => {
        const n = { ...e };
        delete n.availableOfficeIds;
        return n;
      });
    }
  };

  const handleCodeBlur = () => {
    if (form.code) setField('code', sanitizeServiceCode(form.code));
  };

  const handleChargeableToggle = (next) => {
    setForm((f) => ({
      ...f,
      chargeable: next,
      price: next ? f.price : '',
      priceUnit: next ? (f.priceUnit || 'flat') : 'flat',
    }));

    setErrors((e) => {
      const n = { ...e };
      delete n.chargeable;
      delete n.price;
      delete n.priceUnit;
      return n;
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;

    const cleanedForm = {
      ...form,
      name: normalizeSpaces(form.name),
      code: sanitizeServiceCode(form.code),
      description: String(form.description || '').trim(),
    };

    const e = validateServiceForm(cleanedForm, services, orgId, userOffices);

    if (Object.keys(e).length) {
      setErrors(e);
      setToast({ type: 'error', msg: 'Please fix the highlighted fields and try again.' });
      window.setTimeout(() => {
        const firstKey = Object.keys(e)[0];
        const el = document.querySelector(
          `[data-field="${firstKey}"] input, [data-field="${firstKey}"] textarea, [data-field="${firstKey}"] button`
        );
        if (el && typeof el.focus === 'function') el.focus();
      }, 0);
      return;
    }

    setSaving(true);
    await new Promise((r) => setTimeout(r, 800));

    const nextSeq =
      (services || [])
        .map((s) => Number(String(s?.id || '').replace(/\D/g, '')))
        .filter((n) => Number.isFinite(n))
        .reduce((a, b) => Math.max(a, b), 0) + 1;

    const id = `SVC-${String(nextSeq).padStart(5, '0')}`;
    const now = new Date().toISOString();
    const author = currentUser?.name || 'Unknown';

    const record = {
      id,
      orgId,
      name: cleanedForm.name,
      code: cleanedForm.code,
      category: cleanedForm.category,
      icon: String(cleanedForm.icon || '').trim(),
      estimatedTimeMinutes: Number(cleanedForm.estimatedTimeMinutes),
      chargeable: Boolean(cleanedForm.chargeable),
      price: cleanedForm.chargeable ? Number(cleanedForm.price) : 0,
      priceUnit: cleanedForm.chargeable ? cleanedForm.priceUnit : 'flat',
      availableOfficeIds: [...cleanedForm.availableOfficeIds],
      assignedStaffIds: [...(cleanedForm.assignedStaffIds || [])],
      status: cleanedForm.status,
      description: cleanedForm.description,
      createdAt: now,
      createdBy: author,
      updatedAt: now,
      updatedBy: author,
    };

    addService(record);

    addAuditLog({
      userName: author,
      role: (currentUser?.role || '').toString(),
      action: 'CREATE',
      module: 'Services',
      description: `Created service ${record.name} (${record.code}).`,
      orgId,
    });

    setSaving(false);
    onCreated?.(record);
  };

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-service-title"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget && !saving) onClose?.();
        }}
        className="fixed inset-0 z-[9100] flex justify-end bg-black/45"
      >
        <aside
          className="flex h-full w-full max-w-[720px] flex-col bg-white shadow-2xl dark:bg-[#0A1828] sm:w-[720px]"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <Header
            closeBtnRef={closeBtnRef}
            title="Add Service"
            subtitle="Add a service your offices offer to visitors."
            onClose={onClose}
            disabled={saving}
          />

          <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
              <ServiceFormBody
                form={form}
                errors={errors}
                setField={setField}
                onToggleOffice={toggleOffice}
                onSelectAllOffices={selectAllOffices}
                onCodeBlur={handleCodeBlur}
                onChargeableToggle={handleChargeableToggle}
                userOffices={userOffices}
                currency={currency}
                codeImmutable={false}
              />
            </div>

            <Footer saving={saving} submitLabel="Save Service" onCancel={onClose} />
          </form>
        </aside>
      </div>

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
}

export function Header({ closeBtnRef, title, subtitle, onClose, disabled }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-gradient-to-r from-sky-700 to-sky-800 px-5 py-4 text-white dark:border-[#142535]">
      <div className="min-w-0">
        <h2 id="add-service-title" className="font-[Outfit,sans-serif] text-[16px] font-extrabold leading-tight">
          {title}
        </h2>
        {subtitle && <p className="mt-1 text-[12px] opacity-85">{subtitle}</p>}
      </div>
      <button
        ref={closeBtnRef}
        type="button"
        onClick={onClose}
        disabled={disabled}
        aria-label="Close drawer"
        title="Close"
        className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md bg-white/15 text-white transition hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

export function Footer({ saving, submitLabel, onCancel }) {
  return (
    <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-[#142535] dark:bg-[#071220]">
      <button
        type="button"
        onClick={onCancel}
        disabled={saving}
        className="cursor-pointer rounded-[10px] border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#142535] dark:bg-[#0A1828] dark:text-slate-200"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={saving}
        className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-sky-700 bg-gradient-to-r from-sky-600 to-sky-800 px-5 py-2.5 text-[13px] font-bold text-white shadow-sm transition hover:from-sky-700 hover:to-sky-900 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {saving && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
        {saving ? 'Saving…' : submitLabel}
      </button>
    </div>
  );
}

export function ServiceFormBody({
  form,
  errors,
  setField,
  onToggleOffice,
  onSelectAllOffices,
  onCodeBlur,
  onChargeableToggle,
  userOffices,
  currency,
  codeImmutable,
}) {
  const descLen = (form.description || '').length;
  const selectedLabel = form.icon
    ? form.name
      ? `Selected: ${form.icon} ${form.name}`
      : `Selected: ${form.icon}`
    : 'No icon selected yet.';

  return (
    <>
      <SectionHeader Icon={Tag} title="Basic Details" />

      <div className={twoColCls()}>
        <div data-field="name">
          <Field label="Service Name" required error={errors.name}>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              onPaste={(e) => {
                e.preventDefault();
                const pasted = e.clipboardData.getData('text');
                setField('name', `${form.name}${pasted}`);
              }}
              placeholder="Enter Service Name"
              maxLength={50}
              className={inputCls(errors.name)}
            />
          </Field>
        </div>

        <div data-field="code">
          <Field
            label="Service Code"
            required
            error={errors.code}
            hint={codeImmutable ? 'Cannot be changed.' : 'Uppercase letters, digits and hyphens. Unique within your organisation.'}
          >
            <input
              type="text"
              value={form.code}
              onChange={(e) => setField('code', e.target.value)}
              onBlur={onCodeBlur}
              placeholder="Enter Service Code (e.g. TEA-01)"
              maxLength={20}
              disabled={codeImmutable}
              className={`${inputCls(errors.code)} ${codeImmutable ? 'cursor-not-allowed opacity-40' : ''}`}
            />
          </Field>
        </div>
      </div>

      <div className={twoColCls()}>
        <div data-field="category">
          <Field label="Category" required error={errors.category}>
            <SearchableSelect
              value={form.category}
              onChange={(v) => setField('category', v)}
              options={SERVICE_CATEGORIES.map((c) => ({ value: c, label: c }))}
              placeholder="Select Category"
              error={Boolean(errors.category)}
            />
          </Field>
        </div>

        <div data-field="status">
          <Field label="Status" required error={errors.status}>
            <div role="radiogroup" aria-label="Status" className="flex gap-2">
              {SERVICE_STATUSES.map((s) => {
                const active = form.status === s;
                const activeCls =
                  s === 'Active'
                    ? 'border-emerald-700 bg-emerald-700 text-white'
                    : 'border-slate-600 bg-slate-600 text-white';

                return (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setField('status', s)}
                    className={`cursor-pointer rounded-[10px] border px-4 py-2 text-[12px] font-bold transition ${
                      active
                        ? activeCls
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-300'
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </Field>
        </div>
      </div>

      <SectionHeader Icon={Sparkles} title="Icon" />
      <div data-field="icon">
        <IconPicker
          value={form.icon}
          onChange={(v) => setField('icon', v)}
          error={errors.icon}
          selectedLabel={selectedLabel}
        />
      </div>

      <SectionHeader Icon={Clock} title="Duration and Pricing" />

      <div className={twoColCls()}>
        <div data-field="estimatedTimeMinutes">
          <Field
            label="Estimated Duration"
            required
            error={errors.estimatedTimeMinutes}
            hint="Whole minutes, between 1 and 120."
          >
            <div className="relative">
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={120}
                step={1}
                value={form.estimatedTimeMinutes}
                onChange={(e) => setField('estimatedTimeMinutes', e.target.value)}
                placeholder="Enter Estimated Duration"
                className={`${inputCls(errors.estimatedTimeMinutes)} pr-14`}
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-400"
              >
                minutes
              </span>
            </div>
          </Field>
        </div>

        <div data-field="chargeable">
          <Field label="Chargeable" required error={errors.chargeable}>
            <div role="radiogroup" aria-label="Chargeable" className="flex gap-2">
              {[
                { v: false, label: 'No (Free)' },
                { v: true, label: 'Yes' },
              ].map((opt) => {
                const active = form.chargeable === opt.v;
                return (
                  <button
                    key={String(opt.v)}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => onChargeableToggle(opt.v)}
                    className={`cursor-pointer rounded-[10px] border px-4 py-2 text-[12px] font-bold transition ${
                      active
                        ? 'border-sky-700 bg-sky-700 text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </Field>
        </div>
      </div>

      {form.chargeable && (
        <div className={twoColCls()}>
          <div data-field="price">
            <Field
              label="Price"
              required
              error={errors.price}
              hint="Enter 0 for complimentary services, or use the Chargeable toggle above."
            >
              <div className="relative">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] font-bold text-slate-500 dark:text-slate-400"
                >
                  {currencySymbolForInput(currency)}
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={999999}
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setField('price', e.target.value)}
                  placeholder="Enter Price"
                  className={`${inputCls(errors.price)} ${currency === 'INR' ? 'pl-7' : 'pl-12'}`}
                />
              </div>
            </Field>
          </div>

          <div data-field="priceUnit">
            <Field label="Price Unit" required error={errors.priceUnit}>
              <SearchableSelect
                value={form.priceUnit}
                onChange={(v) => setField('priceUnit', v)}
                options={PRICE_UNITS.map((u) => ({ value: u, label: PRICE_UNIT_LABEL[u] }))}
                placeholder="Select Price Unit"
                error={Boolean(errors.priceUnit)}
              />
            </Field>
          </div>
        </div>
      )}

      <SectionHeader Icon={Building2} title="Availability" />
      <div data-field="availableOfficeIds">
        <Field
          label="Available at Offices"
          required
          error={errors.availableOfficeIds}
          hint="Select at least one office where this service is available."
        >
          {userOffices.length === 0 ? (
            <p className="rounded-[10px] border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-[12px] text-slate-500 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-400">
              No offices available. Add an office before creating services.
            </p>
          ) : (
            <>
              {userOffices.length >= 3 && (
                <button
                  type="button"
                  onClick={onSelectAllOffices}
                  className="mb-2 inline-flex cursor-pointer items-center gap-1 text-[11px] font-bold text-sky-700 transition hover:underline dark:text-sky-300"
                >
                  <Check size={11} aria-hidden="true" /> Select all ({userOffices.length})
                </button>
              )}

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {userOffices.map((o) => {
                  const checked = form.availableOfficeIds.includes(o.id);
                  return (
                    <label
                      key={o.id}
                      className={`flex cursor-pointer items-start gap-2 rounded-[10px] border px-3 py-2 text-[12px] transition ${
                        checked
                          ? 'border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-400/40 dark:bg-sky-500/15 dark:text-sky-200'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggleOffice(o.id)}
                        className="mt-0.5 h-4 w-4 cursor-pointer accent-sky-600"
                      />
                      <span className="min-w-0">
                        <span className="block truncate font-bold">{o.name}</span>
                        <span className="block truncate text-[11px] font-mono text-slate-400">{o.code}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </>
          )}
        </Field>
      </div>

      <SectionHeader Icon={FileText} title="Description (optional)" />
      <div data-field="description">
        <Field
          label="Description"
          hint={`${descLen.toLocaleString('en-GB')} / 500 characters.`}
          error={errors.description}
        >
          <textarea
            value={form.description || ''}
            onChange={(e) => setField('description', e.target.value)}
            placeholder="Enter Description"
            rows={4}
            maxLength={500}
            className={`${inputCls(errors.description)} resize-none`}
          />
        </Field>
      </div>
    </>
  );
}

function IconPicker({ value, onChange, error, selectedLabel }) {
  const tabKeys = Object.keys(SERVICE_ICON_SUGGESTIONS);
  const [tab, setTab] = useState(tabKeys[0]);
  const [customOpen, setCustom] = useState(false);
  const [customVal, setCustomVal] = useState('');

  const commitCustom = () => {
    const v = (customVal || '').trim();
    if (!v) return;
    if (!isValidEmoji(v)) return;
    onChange(v);
    setCustomVal('');
    setCustom(false);
  };

  return (
    <div
      className={`rounded-[12px] border bg-white p-3 dark:bg-[#071220] ${
        error
          ? 'border-red-400 dark:border-red-500/40'
          : 'border-slate-200 dark:border-[#142535]'
      }`}
    >
      <div role="tablist" aria-label="Icon categories" className="mb-3 flex flex-wrap gap-1">
        {tabKeys.map((k) => {
          const active = tab === k;
          return (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(k)}
              className={`cursor-pointer rounded-[8px] px-2.5 py-1 text-[11px] font-bold transition ${
                active
                  ? 'bg-sky-700 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-[#1E1E3F] dark:text-slate-300 dark:hover:bg-[#142535]'
              }`}
            >
              {k}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
        {SERVICE_ICON_SUGGESTIONS[tab].map((emoji) => {
          const active = value === emoji;
          return (
            <button
              key={emoji}
              type="button"
              onClick={() => onChange(emoji)}
              aria-pressed={active}
              title={emoji}
              className={`flex h-11 w-full cursor-pointer items-center justify-center rounded-[10px] border text-[22px] leading-none transition ${
                active
                  ? 'border-sky-700 bg-sky-50 shadow-sm dark:border-sky-400 dark:bg-sky-500/15'
                  : 'border-slate-200 bg-white hover:border-sky-300 hover:bg-slate-50 dark:border-[#142535] dark:bg-[#0A1828] dark:hover:bg-[#1E1E3F]'
              }`}
            >
              {emoji}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
        <span className="font-semibold">{selectedLabel}</span>
        <button
          type="button"
          onClick={() => setCustom((o) => !o)}
          className="cursor-pointer text-[11px] font-bold text-sky-700 transition hover:underline dark:text-sky-300"
        >
          {customOpen ? 'Cancel custom' : 'Use custom emoji'}
        </button>
      </div>

      {customOpen && (
        <div className="mt-2 flex items-center gap-2">
          <input
            type="text"
            value={customVal}
            onChange={(e) => setCustomVal(e.target.value)}
            placeholder="Paste emoji here"
            maxLength={8}
            className={inputCls(false)}
          />
          <button
            type="button"
            onClick={commitCustom}
            disabled={!customVal.trim()}
            className="inline-flex cursor-pointer items-center gap-1 rounded-[10px] border border-sky-700 bg-sky-700 px-3 py-2 text-[11px] font-bold text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Check size={12} aria-hidden="true" /> Apply
          </button>
        </div>
      )}
    </div>
  );
}

export function SectionHeader({ Icon, title }) {
  return (
    <h3 className="mb-3 mt-2 inline-flex items-center gap-2 font-[Outfit,sans-serif] text-[12px] font-extrabold uppercase tracking-[0.08em] text-sky-700 dark:text-sky-300">
      {Icon && <Icon size={14} aria-hidden="true" />}
      {title}
    </h3>
  );
}

export function inputCls(hasError) {
  const base =
    'w-full rounded-[10px] border bg-white px-3 py-2 text-[13px] text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:bg-[#071220] dark:text-slate-200';
  return hasError
    ? `${base} border-red-400 focus:border-red-500 focus:ring-red-100 dark:border-red-500/40`
    : `${base} border-slate-200 dark:border-[#142535]`;
}

export function twoColCls() {
  return 'grid grid-cols-1 gap-3 sm:grid-cols-2';
}