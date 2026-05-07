import React, { useEffect, useRef, useState } from 'react';
import { Toast } from '../../components/ui';
import { useCollection, STORAGE_KEYS } from '../../store';
import { MOCK_OFFICES } from '../../data/mockData';
import { addAuditLog } from '../../utils/auditLogger';
import {
  validateOfficeForm,
  emptyOfficeShape,
  COUNTRY_TREE,
  Header,
  Footer,
  OfficeFormBody,
  WORKING_DAYS,
} from './AddOfficeDrawer';

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
  return String(value || '').trim().toLowerCase().slice(0, 100);
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

function hydrateFrom(office) {
  if (!office) return emptyOfficeShape();

  const base = emptyOfficeShape();

  return {
    name: office.name || '',
    code: office.code || '',
    type: office.type || '',
    address: {
      ...base.address,
      ...(office.address || {}),
    },
    contact: {
      ...base.contact,
      ...(office.contact || {}),
    },
    operations: {
      ...base.operations,
      ...(office.operations || {}),
      workingDays: Array.isArray(office.operations?.workingDays)
        ? WORKING_DAYS.filter((d) => office.operations.workingDays.includes(d))
        : [],
      maxCapacity: office.operations?.maxCapacity ?? '',
    },
    status: office.status || 'Active',
  };
}

export default function EditOfficeDrawer({
  open,
  office,
  onClose,
  onUpdated,
  currentUser,
}) {
  const [offices, , updateOffice] = useCollection(STORAGE_KEYS.OFFICES, MOCK_OFFICES);
  const orgId = currentUser?.organisationId || currentUser?.orgId || null;

  const [form, setForm] = useState(() => hydrateFrom(office));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const closeBtnRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setForm(hydrateFrom(office));
    setErrors({});
    setSaving(false);
  }, [open, office]);

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

  if (!open || !office) return null;

  const setField = (path, value) => {
    let nextValue = value;

    if (path === 'name') nextValue = sanitizeOfficeName(value);
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

      return {
        ...f,
        operations: {
          ...f.operations,
          workingDays: WORKING_DAYS.filter((d) => existing.has(d)),
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

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;

    const cleanedForm = {
      ...form,
      name: normalizeSpaces(form.name),
      code: office.code,
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

    const e = validateOfficeForm(cleanedForm, offices, orgId, {
      excludeId: office.id,
    });

    if (Object.keys(e).length) {
      setErrors(e);
      setToast({ type: 'error', msg: 'Please fix the highlighted fields and try again.' });
      return;
    }

    setSaving(true);
    await new Promise((r) => setTimeout(r, 800));

    const now = new Date().toISOString();
    const author = currentUser?.name || 'Unknown';

    const patch = {
      code: office.code,
      name: cleanedForm.name,
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
      updatedAt: now,
      updatedBy: author,
    };

    updateOffice(office.id, patch);

    addAuditLog({
      userName: author,
      role: (currentUser?.role || '').toString(),
      action: 'UPDATE',
      module: 'Offices',
      description: `Updated office ${patch.name} (${office.code}).`,
      orgId,
    });

    setSaving(false);
    onUpdated?.({ ...office, ...patch });
  };

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-office-title"
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
            title={`Edit Office — ${office.name}`}
            subtitle={`Office Code: ${office.code} (immutable).`}
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
                onCodeBlur={() => {}}
                codeImmutable
              />
            </div>

            <Footer saving={saving} submitLabel="Save Changes" onCancel={onClose} />
          </form>
        </aside>
      </div>

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
}