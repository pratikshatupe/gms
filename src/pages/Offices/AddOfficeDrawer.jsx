import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X, Building2, MapPin, Phone, Clock, Loader2,
} from 'lucide-react';
import { Field, SearchableSelect, Toast } from '../../components/ui';
import { useCollection, STORAGE_KEYS } from '../../store';
import { MOCK_OFFICES, MOCK_ORGANIZATIONS } from '../../data/mockData';
import { addAuditLog } from '../../utils/auditLogger';
import { generateOfficeCreatedEmail, previewEmail } from '../../utils/emailTemplates';
/* Phase 2 strict validators. The existing country-aware phone rule
 * (e.g. "+91 followed by 10 digits") is kept for non-India entries;
 * India is rerouted through the strict Indian validator (10 digits,
 * starts with 6/7/8/9, blocks repeated/sequential fakes). */
import {
  validateEmail   as validateEmailStrict,
  validateName    as validatePersonNameStrict,
  validatePhoneIndian,
  validateAddress as validateAddressStrict,
  sanitizeEmail   as sanitizeEmailStrict,
} from '../../utils/validators';

export const OFFICE_TYPES = ['HQ', 'Branch', 'Warehouse', 'Regional Office', 'Other'];
export const WORKING_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const COUNTRY_TREE = {
  India: {
    dialCode: '+91',
    timezone: 'Asia/Kolkata',
    states: {
      Maharashtra: ['Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Aurangabad', 'Thane'],
      Karnataka: ['Bengaluru', 'Mysuru', 'Mangaluru', 'Hubballi'],
      'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli'],
      Delhi: ['New Delhi', 'Delhi'],
      Gujarat: ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot'],
      Telangana: ['Hyderabad', 'Warangal'],
      'West Bengal': ['Kolkata', 'Howrah'],
      Rajasthan: ['Jaipur', 'Udaipur', 'Jodhpur'],
      'Uttar Pradesh': ['Lucknow', 'Noida', 'Ghaziabad', 'Kanpur'],
      Haryana: ['Gurugram', 'Faridabad'],
      Kerala: ['Kochi', 'Thiruvananthapuram'],
    },
  },
  'United Arab Emirates': {
    dialCode: '+971',
    timezone: 'Asia/Dubai',
    states: {
      'Abu Dhabi': ['Abu Dhabi', 'Al Ain'],
      Dubai: ['Dubai', 'Jebel Ali'],
      Sharjah: ['Sharjah', 'Khor Fakkan'],
      Ajman: ['Ajman'],
      'Umm Al Quwain': ['Umm Al Quwain'],
      'Ras Al Khaimah': ['Ras Al Khaimah'],
      Fujairah: ['Fujairah'],
    },
  },
  'Saudi Arabia': {
    dialCode: '+966',
    timezone: 'Asia/Riyadh',
    states: {
      'Riyadh Province': ['Riyadh'],
      'Makkah Province': ['Jeddah', 'Makkah', 'Taif'],
      'Eastern Province': ['Dammam', 'Al Khobar', 'Dhahran'],
    },
  },
  'United Kingdom': {
    dialCode: '+44',
    timezone: 'Europe/London',
    states: {
      England: ['London', 'Manchester', 'Birmingham', 'Leeds', 'Liverpool'],
      Scotland: ['Edinburgh', 'Glasgow'],
      Wales: ['Cardiff', 'Swansea'],
      'Northern Ireland': ['Belfast'],
    },
  },
  Qatar: { dialCode: '+974', timezone: 'Asia/Qatar', states: { Doha: ['Doha'] } },
  Oman: { dialCode: '+968', timezone: 'Asia/Muscat', states: { Muscat: ['Muscat'] } },
  Kuwait: { dialCode: '+965', timezone: 'Asia/Kuwait', states: { 'Kuwait City': ['Kuwait City'] } },
  Bahrain: { dialCode: '+973', timezone: 'Asia/Bahrain', states: { Manama: ['Manama'] } },
  Other: { dialCode: '+', timezone: 'UTC', states: { Other: ['Other'] } },
};

export const TIMEZONES = [
  'Asia/Kolkata', 'Asia/Dubai', 'Asia/Riyadh', 'Asia/Qatar', 'Asia/Muscat',
  'Asia/Kuwait', 'Asia/Bahrain', 'Europe/London', 'Europe/Paris', 'Europe/Berlin',
  'America/New_York', 'America/Chicago', 'America/Los_Angeles',
  'Asia/Singapore', 'Asia/Hong_Kong', 'Asia/Tokyo', 'UTC',
];

const isBlank = (v) => v == null || String(v).trim().length === 0;
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const OFFICE_NAME_RE = /^(?=.*[A-Za-z])[A-Za-z .,&()'/-]+$/;
const ADDRESS_RE = /^[A-Za-z0-9 .,#&()'/-]+$/;
const MANAGER_RE = /^[A-Za-z\s'.-]+$/;
const CITY_STATE_RE = /^[A-Za-z .'-]+$/;

function normalizeSpaces(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function sanitizeOfficeName(value) {
  return String(value || '')
    .replace(/[^A-Za-z .,&()'/-]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^\s+/g, '')
    .slice(0, 100);
}

function sanitizeOfficeCode(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, 20);
}

function sanitizeAddress(value, max = 200) {
  return String(value || '')
    .replace(/[^A-Za-z0-9 .,#&()'/-]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^\s+/g, '')
    .slice(0, max);
}

function sanitizePostalCode(value, country) {
  let v = String(value || '').trim();

  if (country === 'India' || country === 'United Arab Emirates') {
    return v.replace(/\D/g, '').slice(0, country === 'India' ? 6 : 5);
  }

  return v.replace(/[^A-Za-z0-9\s-]/g, '').slice(0, 10);
}

function sanitizePhone(value) {
  let v = String(value || '').replace(/[^\d+\s-]/g, '');
  v = v.replace(/(?!^)\+/g, '');
  v = v.replace(/\s+/g, ' ').trim();
  return v.slice(0, 20);
}

function sanitizeEmail(value) {
  /* Phase 2 spec: lowercase + trim + strip internal whitespace. */
  return sanitizeEmailStrict(value).slice(0, 100);
}

function sanitizeManagerName(value) {
  return String(value || '')
    .replace(/[^A-Za-z\s'.-]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^\s+/g, '')
    .slice(0, 50);
}

function sanitizeDigits(value, maxLength = 5) {
  return String(value || '').replace(/\D/g, '').slice(0, maxLength);
}

export function validateOfficeForm(form, allOffices, orgId, opts = {}) {
  const { excludeId = null } = opts;
  const e = {};

  const name = normalizeSpaces(form.name);
  const code = sanitizeOfficeCode(form.code);
  const address1 = normalizeSpaces(form.address?.line1);
  const address2 = normalizeSpaces(form.address?.line2);
  const country = form.address?.country;
  const state = normalizeSpaces(form.address?.state);
  const city = normalizeSpaces(form.address?.city);
  const postal = String(form.address?.postalCode || '').trim();
  const contact = sanitizePhone(form.contact?.contactNumber);
  const email = sanitizeEmail(form.contact?.emailId);
  const manager = normalizeSpaces(form.contact?.managerName);

  if (isBlank(name)) {
    e.name = 'Office Name is required.';
  } else if (name.length < 2) {
    e.name = 'Office Name must be at least 2 characters.';
  } else if (name.length > 100) {
    e.name = 'Office Name must be 100 characters or fewer.';
  } else if (!OFFICE_NAME_RE.test(name)) {
    e.name = 'Office Name must contain letters only. Numbers are not allowed.';
  } else {
    const dupName = (allOffices || []).find(
      (o) =>
        o &&
        o.orgId === orgId &&
        normalizeSpaces(o.name).toLowerCase() === name.toLowerCase() &&
        o.id !== excludeId
    );
    if (dupName) e.name = 'Office Name already exists in your organisation.';
  }

  if (isBlank(code)) {
    e.code = 'Office Code is required.';
  } else if (code.length < 3 || code.length > 20) {
    e.code = 'Office Code must be 3 to 20 characters.';
  } else if (!/^[A-Z0-9-]+$/.test(code)) {
    e.code = 'Office Code accepts letters, digits and hyphens only.';
  } else {
    const dup = (allOffices || []).find(
      (o) =>
        o &&
        o.orgId === orgId &&
        String(o.code || '').toUpperCase() === code &&
        o.id !== excludeId
    );
    if (dup) e.code = 'Office Code must be unique within your organisation.';
  }

  if (isBlank(form.type) || !OFFICE_TYPES.includes(form.type)) {
    e.type = 'Office Type is required.';
  }

  /* Phase 2 spec: address must be 5–250 characters. */
  const addrErr = validateAddressStrict(address1, { label: 'Address Line 1', min: 5, max: 250, required: true });
  if (addrErr) {
    e['address.line1'] = addrErr;
  } else if (!ADDRESS_RE.test(address1)) {
    e['address.line1'] = 'Address Line 1 contains unsupported characters.';
  }

  if (address2) {
    const addr2Err = validateAddressStrict(address2, { label: 'Address Line 2', min: 1, max: 250, required: false });
    if (addr2Err) {
      e['address.line2'] = addr2Err;
    } else if (!ADDRESS_RE.test(address2)) {
      e['address.line2'] = 'Address Line 2 contains unsupported characters.';
    }
  }

  if (isBlank(country)) {
    e['address.country'] = 'Country is required.';
  }

  if (isBlank(state)) {
    e['address.state'] = 'State is required.';
  } else if (!CITY_STATE_RE.test(state)) {
    e['address.state'] = 'State contains unsupported characters.';
  }

  if (isBlank(city)) {
    e['address.city'] = 'City is required.';
  } else if (!CITY_STATE_RE.test(city)) {
    e['address.city'] = 'City contains unsupported characters.';
  }

  if (isBlank(postal)) {
    e['address.postalCode'] = 'Postal Code is required.';
  } else if (country === 'India' && !/^\d{6}$/.test(postal)) {
    e['address.postalCode'] = 'Postal Code must be exactly 6 digits for India.';
  } else if (country === 'United Arab Emirates' && !/^\d{5}$/.test(postal)) {
    e['address.postalCode'] = 'Postal Code must be exactly 5 digits for the United Arab Emirates.';
  } else if (
    country &&
    !['India', 'United Arab Emirates'].includes(country) &&
    !/^[A-Za-z0-9\s-]{3,10}$/.test(postal)
  ) {
    e['address.postalCode'] = 'Postal Code must be 3 to 10 alphanumeric characters.';
  }

  if (isBlank(contact)) {
    e['contact.contactNumber'] = 'Contact Number is required.';
  } else if (!/^\+?[\d\s-]+$/.test(contact)) {
    e['contact.contactNumber'] = 'Contact Number accepts digits, spaces and hyphens only.';
  } else {
    const digitsOnly = contact.replace(/[^0-9]/g, '');
    /* India: enforce the strict Phase 2 rule on the local 10-digit
     * portion — exactly 10 digits, starts with 6/7/8/9, blocks known
     * fakes (0000…, 1234567890, etc.). Accept either "+91 9876543210"
     * (12 digits with 91 prefix) or a bare "9876543210" (10 digits). */
    if (country === 'India') {
      const local = digitsOnly.startsWith('91') && digitsOnly.length === 12
        ? digitsOnly.slice(2)
        : digitsOnly;
      const indiaErr = validatePhoneIndian(local, { label: 'Contact Number' });
      if (indiaErr) e['contact.contactNumber'] = indiaErr;
    } else if (
      country === 'United Arab Emirates' &&
      !(digitsOnly.startsWith('971') && digitsOnly.length === 12)
    ) {
      e['contact.contactNumber'] = 'Contact Number must be +971 followed by 9 digits for the United Arab Emirates.';
    } else if (digitsOnly.length < 7) {
      e['contact.contactNumber'] = 'Contact Number must include the country code and local number.';
    }
  }

  /* Phase 2 spec: required, valid format, no spaces, lowercased on
   * input, length cap. */
  const emailErr = validateEmailStrict(email, { label: 'Email ID' });
  if (emailErr) e['contact.emailId'] = emailErr;

  if (manager) {
    /* Phase 2 spec: 2–50 letters, must start with a letter, allow
     * spaces, dots, hyphens, apostrophes. */
    const mgrErr = validatePersonNameStrict(manager, { label: 'Manager Name', min: 2, max: 50, required: false });
    if (mgrErr) e['contact.managerName'] = mgrErr;
  }

  if (isBlank(form.operations?.openTime)) {
    e['operations.openTime'] = 'Open Time is required.';
  }

  if (isBlank(form.operations?.closeTime)) {
    e['operations.closeTime'] = 'Close Time is required.';
  }

  if (
    form.operations?.openTime &&
    form.operations?.closeTime &&
    form.operations.closeTime <= form.operations.openTime
  ) {
    e['operations.closeTime'] = 'Close Time must be later than Open Time.';
  }

  if (
    !Array.isArray(form.operations?.workingDays) ||
    form.operations.workingDays.length === 0
  ) {
    e['operations.workingDays'] = 'Select at least one working day.';
  }

  if (isBlank(form.operations?.timezone)) {
    e['operations.timezone'] = 'Timezone is required.';
  }

  const cap = form.operations?.maxCapacity;
  if (cap == null || cap === '') {
    e['operations.maxCapacity'] = 'Maximum Capacity is required.';
  } else {
    const n = Number(cap);
    if (!Number.isFinite(n) || !Number.isInteger(n)) {
      e['operations.maxCapacity'] = 'Maximum Capacity must be a whole number.';
    } else if (n < 10) {
      e['operations.maxCapacity'] = 'Maximum Capacity must be at least 10.';
    } else if (n > 10000) {
      e['operations.maxCapacity'] = 'Maximum Capacity must be 10000 or fewer.';
    }
  }

  if (!['Active', 'Inactive'].includes(form.status)) {
    e.status = 'Status is required.';
  }

  return e;
}

export function emptyOfficeShape() {
  return {
    name: '',
    code: '',
    type: '',
    address: {
      line1: '',
      line2: '',
      country: '',
      state: '',
      city: '',
      postalCode: '',
    },
    contact: {
      contactNumber: '',
      emailId: '',
      managerName: '',
    },
    operations: {
      openTime: '',
      closeTime: '',
      workingDays: [],
      timezone: '',
      maxCapacity: '',
    },
    status: 'Active',
  };
}

export function to12hAmPm(hhmm) {
  if (!hhmm || !/^\d{2}:\d{2}$/.test(hhmm)) return hhmm || '—';
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

export default function AddOfficeDrawer({ open, onClose, onCreated, currentUser }) {
  const [offices, addOffice] = useCollection(STORAGE_KEYS.OFFICES, MOCK_OFFICES);
  const orgId = currentUser?.organisationId || currentUser?.orgId || null;

  const [form, setForm] = useState(emptyOfficeShape());
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const closeBtnRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setForm(emptyOfficeShape());
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

  const setField = (path, value) => {
    let nextValue = value;

    if (path === 'name') nextValue = sanitizeOfficeName(value);
    if (path === 'code') nextValue = sanitizeOfficeCode(value);
    if (path === 'address.line1') nextValue = sanitizeAddress(value, 200);
    if (path === 'address.line2') nextValue = sanitizeAddress(value, 200);
    if (path === 'address.postalCode') nextValue = sanitizePostalCode(value, form.address?.country);
    if (path === 'contact.contactNumber') nextValue = sanitizePhone(value);
    if (path === 'contact.emailId') nextValue = sanitizeEmail(value);
    if (path === 'contact.managerName') nextValue = sanitizeManagerName(value);
    if (path === 'operations.maxCapacity') nextValue = sanitizeDigits(value, 5);

    setForm((f) => {
      const next = { ...f };
      const parts = path.split('.');
      if (parts.length === 1) {
        next[parts[0]] = nextValue;
      } else {
        next[parts[0]] = { ...next[parts[0]], [parts[1]]: nextValue };
      }
      return next;
    });

    if (errors[path]) {
      setErrors((e) => {
        const n = { ...e };
        delete n[path];
        return n;
      });
    }
  };

  const handleCountryChange = (country) => {
    const tree = COUNTRY_TREE[country];
    const tz = tree?.timezone || form.operations.timezone;
    const dial = tree?.dialCode || '+';
    const prefix = form.contact.contactNumber?.startsWith(dial)
      ? form.contact.contactNumber
      : `${dial} `;

    setForm((f) => ({
      ...f,
      address: {
        ...f.address,
        country,
        state: '',
        city: '',
        postalCode: '',
      },
      operations: {
        ...f.operations,
        timezone: tz || f.operations.timezone,
      },
      contact: {
        ...f.contact,
        contactNumber: prefix,
      },
    }));

    setErrors((e) => {
      const n = { ...e };
      delete n['address.country'];
      delete n['address.state'];
      delete n['address.city'];
      delete n['address.postalCode'];
      delete n['contact.contactNumber'];
      return n;
    });
  };

  const handleStateChange = (state) => {
    setForm((f) => ({
      ...f,
      address: {
        ...f.address,
        state,
        city: '',
      },
    }));

    setErrors((e) => {
      const n = { ...e };
      delete n['address.state'];
      delete n['address.city'];
      return n;
    });
  };

  const toggleDay = (day) => {
    setForm((f) => {
      const existing = new Set(f.operations.workingDays || []);
      if (existing.has(day)) existing.delete(day);
      else existing.add(day);
      const nextArr = WORKING_DAYS.filter((d) => existing.has(d));
      return {
        ...f,
        operations: {
          ...f.operations,
          workingDays: nextArr,
        },
      };
    });

    if (errors['operations.workingDays']) {
      setErrors((e) => {
        const n = { ...e };
        delete n['operations.workingDays'];
        return n;
      });
    }
  };

  const handleCodeBlur = () => {
    if (form.code) setField('code', sanitizeOfficeCode(form.code));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;

    const cleanedForm = {
      ...form,
      name: normalizeSpaces(form.name),
      code: sanitizeOfficeCode(form.code),
      address: {
        ...form.address,
        line1: normalizeSpaces(form.address.line1),
        line2: normalizeSpaces(form.address.line2),
        postalCode: String(form.address.postalCode || '').trim(),
      },
      contact: {
        ...form.contact,
        contactNumber: sanitizePhone(form.contact.contactNumber),
        emailId: sanitizeEmail(form.contact.emailId),
        managerName: normalizeSpaces(form.contact.managerName),
      },
      operations: {
        ...form.operations,
        maxCapacity: Number(form.operations.maxCapacity),
      },
    };

    const e = validateOfficeForm(cleanedForm, offices, orgId);

    if (Object.keys(e).length) {
      setErrors(e);
      setToast({ type: 'error', msg: 'Please fix the highlighted fields and try again.' });
      return;
    }

    setSaving(true);
    await new Promise((r) => setTimeout(r, 800));

    const nextSeq =
      (offices || [])
        .map((o) => Number(String(o?.id || '').replace(/\D/g, '')))
        .filter((n) => Number.isFinite(n))
        .reduce((a, b) => Math.max(a, b), 0) + 1;

    const id = `OFC-${String(nextSeq).padStart(5, '0')}`;
    const now = new Date().toISOString();
    const author = currentUser?.name || 'Unknown';

    const record = {
      id,
      orgId,
      name: cleanedForm.name,
      code: cleanedForm.code,
      type: cleanedForm.type,
      address: {
        line1: cleanedForm.address.line1,
        line2: cleanedForm.address.line2 || '',
        country: cleanedForm.address.country,
        state: cleanedForm.address.state,
        city: cleanedForm.address.city,
        postalCode: cleanedForm.address.postalCode,
      },
      contact: {
        contactNumber: cleanedForm.contact.contactNumber,
        emailId: cleanedForm.contact.emailId || '',
        managerName: cleanedForm.contact.managerName || '',
      },
      operations: {
        openTime: cleanedForm.operations.openTime,
        closeTime: cleanedForm.operations.closeTime,
        workingDays: [...cleanedForm.operations.workingDays],
        timezone: cleanedForm.operations.timezone,
        maxCapacity: Number(cleanedForm.operations.maxCapacity),
      },
      status: cleanedForm.status,
      createdAt: now,
      createdBy: author,
      updatedAt: now,
      updatedBy: author,
    };

    addOffice(record);

    addAuditLog({
      userName: author,
      role: (currentUser?.role || '').toString(),
      action: 'CREATE',
      module: 'Offices',
      description: `Created office ${record.name} (${record.code}).`,
      orgId,
    });

    /* Fire the branded "office created" email to the office's contact
     * inbox so the manager gets a record of the new location and the
     * stamped operating hours. Fire-and-forget — UI continues even when
     * SMTP is offline. */
    if (record.contact?.emailId) {
      try {
        const org = (MOCK_ORGANIZATIONS || []).find(
          (o) => o?.id === orgId || o?.organisationId === orgId,
        );
        const envelope = generateOfficeCreatedEmail({
          office: record,
          orgName: org?.name,
          orgCountry: org?.country || record.address?.country,
        });
        previewEmail({ ...envelope, to: record.contact.emailId });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[AddOfficeDrawer] office-created email dispatch failed:', err);
      }
    }

    setSaving(false);
    onCreated?.(record);
  };

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-office-title"
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
            title="Add Office"
            subtitle="Create a new office location within your organisation."
            onClose={onClose}
            disabled={saving}
          />

          <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
              <OfficeFormBody
                form={form}
                errors={errors}
                setField={setField}
                onCountryChange={handleCountryChange}
                onStateChange={handleStateChange}
                onToggleDay={toggleDay}
                onCodeBlur={handleCodeBlur}
                codeImmutable={false}
              />
            </div>

            <Footer saving={saving} submitLabel="Create Office" onCancel={onClose} />
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
        <h2 id="add-office-title" className="font-[Outfit,sans-serif] text-[16px] font-extrabold leading-tight">
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

export function OfficeFormBody({
  form,
  errors,
  setField,
  onCountryChange,
  onStateChange,
  onToggleDay,
  onCodeBlur,
  codeImmutable = false,
}) {
  const country = form.address?.country;

  const stateOptions = useMemo(() => {
    const tree = COUNTRY_TREE[country];
    if (!tree) return [];
    return Object.keys(tree.states).sort();
  }, [country]);

  const cityOptions = useMemo(() => {
    const tree = COUNTRY_TREE[country];
    if (!tree) return [];
    const cities = tree.states?.[form.address?.state] || [];
    return [...cities].sort();
  }, [country, form.address?.state]);

  const postalPlaceholder =
    country === 'India'
      ? 'Enter Postal Code (6 digits)'
      : country === 'United Arab Emirates'
      ? 'Enter Postal Code (5 digits)'
      : 'Enter Postal Code';

  return (
    <>
      <SectionHeader Icon={Building2} title="Basic Details" />

      <Field label="Office Name" required error={errors.name}>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setField('name', e.target.value)}
          onPaste={(e) => {
            e.preventDefault();
            const pasted = e.clipboardData.getData('text');
            setField('name', `${form.name}${pasted}`);
          }}
          placeholder="Enter Office Name"
          maxLength={100}
          className={inputCls(errors.name)}
        />
      </Field>

      <div className={twoColCls()}>
        <Field
          label="Office Code"
          required
          error={errors.code}
          hint={codeImmutable ? 'Office Code cannot be changed after creation.' : 'Uppercase letters, digits and hyphens only. Unique within your organisation.'}
        >
          <input
            type="text"
            value={form.code}
            onChange={(e) => setField('code', e.target.value)}
            onBlur={onCodeBlur}
            placeholder="Enter Office Code (e.g. PUN-HQ-01)"
            maxLength={20}
            disabled={codeImmutable}
            className={`${inputCls(errors.code)} ${codeImmutable ? 'opacity-40 cursor-not-allowed' : ''}`}
          />
        </Field>

        <Field label="Office Type" required error={errors.type}>
          <SearchableSelect
            value={form.type}
            onChange={(v) => setField('type', v)}
            options={OFFICE_TYPES.map((t) => ({ value: t, label: t }))}
            placeholder="Select Office Type"
            error={Boolean(errors.type)}
          />
        </Field>
      </div>

      <SectionHeader Icon={MapPin} title="Address" />

      <Field label="Address Line 1" required error={errors['address.line1']}>
        <input
          type="text"
          value={form.address.line1}
          onChange={(e) => setField('address.line1', e.target.value)}
          placeholder="Enter Address Line 1"
          maxLength={200}
          className={inputCls(errors['address.line1'])}
        />
      </Field>

      <Field label="Address Line 2" error={errors['address.line2']}>
        <input
          type="text"
          value={form.address.line2}
          onChange={(e) => setField('address.line2', e.target.value)}
          placeholder="Enter Address Line 2"
          maxLength={200}
          className={inputCls(errors['address.line2'])}
        />
      </Field>

      <div className={twoColCls()}>
        <Field label="Country" required error={errors['address.country']}>
          <SearchableSelect
            value={form.address.country}
            onChange={onCountryChange}
            options={Object.keys(COUNTRY_TREE).map((c) => ({ value: c, label: c }))}
            placeholder="Select Country"
            searchPlaceholder="Search country…"
            error={Boolean(errors['address.country'])}
          />
        </Field>

        <Field label="State / Province" required error={errors['address.state']}>
          <SearchableSelect
            value={form.address.state}
            onChange={onStateChange}
            options={stateOptions.map((s) => ({ value: s, label: s }))}
            placeholder={country ? 'Select State' : 'Select Country first'}
            searchPlaceholder="Search state…"
            disabled={!country}
            error={Boolean(errors['address.state'])}
          />
        </Field>
      </div>

      <div className={twoColCls()}>
        <Field label="City" required error={errors['address.city']}>
          <SearchableSelect
            value={form.address.city}
            onChange={(v) => setField('address.city', v)}
            options={cityOptions.map((c) => ({ value: c, label: c }))}
            placeholder={form.address.state ? 'Select City' : 'Select State first'}
            searchPlaceholder="Search city…"
            disabled={!form.address.state}
            error={Boolean(errors['address.city'])}
          />
        </Field>

        <Field label="Postal Code" required error={errors['address.postalCode']}>
          <input
            type="text"
            value={form.address.postalCode}
            onChange={(e) => setField('address.postalCode', e.target.value)}
            placeholder={postalPlaceholder}
            maxLength={10}
            className={inputCls(errors['address.postalCode'])}
          />
        </Field>
      </div>

      <SectionHeader Icon={Phone} title="Contact" />

      <Field label="Contact Number" required error={errors['contact.contactNumber']}>
        <input
          type="tel"
          value={form.contact.contactNumber}
          onChange={(e) => setField('contact.contactNumber', e.target.value)}
          placeholder="Enter Contact Number (e.g. +91 20 2612 3456)"
          maxLength={20}
          className={inputCls(errors['contact.contactNumber'])}
        />
      </Field>

      <div className={twoColCls()}>
        <Field label="Email ID" error={errors['contact.emailId']}>
          <input
            type="email"
            value={form.contact.emailId}
            onChange={(e) => setField('contact.emailId', e.target.value)}
            placeholder="Enter Email ID"
            maxLength={100}
            className={inputCls(errors['contact.emailId'])}
          />
        </Field>

        <Field label="Manager Name" error={errors['contact.managerName']}>
          <input
            type="text"
            value={form.contact.managerName}
            onChange={(e) => setField('contact.managerName', e.target.value)}
            placeholder="Enter Manager Name"
            maxLength={50}
            className={inputCls(errors['contact.managerName'])}
          />
        </Field>
      </div>

      <SectionHeader Icon={Clock} title="Operations" />

      <div className={twoColCls()}>
        <Field label="Open Time" required error={errors['operations.openTime']} hint="AM and PM shown on display only — 24h stored.">
          <TimeInput
            value={form.operations.openTime}
            onChange={(v) => setField('operations.openTime', v)}
            invalid={Boolean(errors['operations.openTime'])}
          />
        </Field>

        <Field label="Close Time" required error={errors['operations.closeTime']}>
          <TimeInput
            value={form.operations.closeTime}
            onChange={(v) => setField('operations.closeTime', v)}
            invalid={Boolean(errors['operations.closeTime'])}
          />
        </Field>
      </div>

      <Field label="Working Days" required error={errors['operations.workingDays']}>
        <div role="group" aria-label="Working Days" className="flex flex-wrap gap-2">
          {WORKING_DAYS.map((day) => {
            const active = form.operations.workingDays.includes(day);
            return (
              <button
                key={day}
                type="button"
                role="checkbox"
                aria-checked={active}
                onClick={() => onToggleDay(day)}
                title={active ? `Remove ${day}` : `Add ${day}`}
                className={`cursor-pointer rounded-[10px] border px-3 py-1.5 text-[12px] font-bold transition ${
                  active
                    ? 'border-sky-700 bg-sky-700 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-300 dark:hover:bg-[#1E1E3F]'
                }`}
              >
                {day}
              </button>
            );
          })}
        </div>
      </Field>

      <div className={twoColCls()}>
        <Field label="Timezone" required error={errors['operations.timezone']}>
          <SearchableSelect
            value={form.operations.timezone}
            onChange={(v) => setField('operations.timezone', v)}
            options={TIMEZONES.map((t) => ({ value: t, label: t }))}
            placeholder="Select Timezone"
            searchPlaceholder="Search timezone…"
            error={Boolean(errors['operations.timezone'])}
          />
        </Field>

        <Field label="Maximum Capacity" required error={errors['operations.maxCapacity']} hint="Whole number between 10 and 10000.">
          <input
            type="number"
            inputMode="numeric"
            min={10}
            max={10000}
            step={1}
            value={form.operations.maxCapacity}
            onChange={(e) => setField('operations.maxCapacity', e.target.value)}
            placeholder="Enter Maximum Capacity"
            className={inputCls(errors['operations.maxCapacity'])}
          />
        </Field>
      </div>

      <Field label="Status" required error={errors.status}>
        <div role="radiogroup" aria-label="Status" className="flex gap-2">
          {['Active', 'Inactive'].map((s) => {
            const active = form.status === s;
            return (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setField('status', s)}
                className={`cursor-pointer rounded-[10px] border px-4 py-2 text-[12px] font-bold transition ${
                  active
                    ? s === 'Active'
                      ? 'border-emerald-700 bg-emerald-700 text-white'
                      : 'border-slate-600 bg-slate-600 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-300'
                }`}
              >
                {s}
              </button>
            );
          })}
        </div>
      </Field>
    </>
  );
}

function TimeInput({ value, onChange, invalid }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="time"
        step="60"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="HH:mm"
        className={inputCls(invalid)}
      />
      <span className="shrink-0 text-[12px] font-semibold text-slate-500 dark:text-slate-400">
        {value ? to12hAmPm(value) : '— AM'}
      </span>
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