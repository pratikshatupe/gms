import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Toast } from '../../components/ui';
import { useCollection, STORAGE_KEYS } from '../../store';
import {
  MOCK_SERVICES, MOCK_OFFICES, MOCK_ORGANIZATIONS,
} from '../../data/mockData';
import { addAuditLog } from '../../utils/auditLogger';
import {
  validateServiceForm,
  emptyServiceShape,
  byOrg,
  resolveCurrencyForOrg,
  Header,
  Footer,
  ServiceFormBody,
} from './AddServiceDrawer';

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

function hydrate(service) {
  if (!service) return emptyServiceShape();
  const base = emptyServiceShape();

  return {
    name: service.name || '',
    code: service.code || '',
    category: service.category || '',
    icon: service.icon || '',
    estimatedTimeMinutes:
      service.estimatedTimeMinutes ?? base.estimatedTimeMinutes,
    chargeable: Boolean(service.chargeable),
    price: service.price == null ? '' : String(service.price),
    priceUnit: service.priceUnit || 'flat',
    availableOfficeIds: Array.isArray(service.availableOfficeIds)
      ? [...service.availableOfficeIds]
      : [],
    assignedStaffIds: Array.isArray(service.assignedStaffIds)
      ? [...service.assignedStaffIds]
      : [],
    status: service.status || 'Active',
    description: service.description || '',
  };
}

function diffSummary(before, after) {
  const lines = [];
  const scalarKeys = [
    'name',
    'category',
    'icon',
    'estimatedTimeMinutes',
    'chargeable',
    'price',
    'priceUnit',
    'status',
  ];

  for (const k of scalarKeys) {
    if (before?.[k] !== after?.[k]) {
      lines.push(`${k}: ${before?.[k]} → ${after?.[k]}`);
    }
  }

  const beforeOff = JSON.stringify((before?.availableOfficeIds || []).slice().sort());
  const afterOff = JSON.stringify((after?.availableOfficeIds || []).slice().sort());
  if (beforeOff !== afterOff) lines.push('availableOfficeIds updated');

  if ((before?.description || '') !== (after?.description || '')) {
    lines.push('description updated');
  }

  return lines.join('; ');
}

export default function EditServiceDrawer({
  open,
  service,
  onClose,
  onUpdated,
  currentUser,
}) {
  const [services, , updateService] = useCollection(STORAGE_KEYS.SERVICES, MOCK_SERVICES);
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
    () => (orgsAll || []).find((o) => o?.id === (service?.orgId || orgId)) || null,
    [orgsAll, service, orgId]
  );

  const currency = resolveCurrencyForOrg(org);

  const [form, setForm] = useState(() => hydrate(service));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const closeBtnRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setForm(hydrate(service));
    setErrors({});
    setSaving(false);
  }, [open, service]);

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

  if (!open || !service) return null;

  const setField = (key, value) => {
    let nextValue = value;

    if (key === 'name') nextValue = sanitizeServiceName(value);
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
    setForm((f) => ({
      ...f,
      availableOfficeIds: userOffices.map((o) => o.id),
    }));

    if (errors.availableOfficeIds) {
      setErrors((e) => {
        const n = { ...e };
        delete n.availableOfficeIds;
        return n;
      });
    }
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

    const formToCheck = {
      ...form,
      code: service.code,
      name: normalizeSpaces(form.name),
      description: String(form.description || '').trim(),
      estimatedTimeMinutes: Number(form.estimatedTimeMinutes),
      price: form.chargeable ? form.price : '',
    };

    const e = validateServiceForm(
      formToCheck,
      services,
      service.orgId,
      userOffices,
      { excludeId: service.id }
    );

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
      code: service.code,
      orgId: service.orgId,

      name: normalizeSpaces(form.name),
      category: form.category,
      icon: String(form.icon || '').trim(),
      estimatedTimeMinutes: Number(form.estimatedTimeMinutes),
      chargeable: Boolean(form.chargeable),
      price: form.chargeable ? Number(form.price) : 0,
      priceUnit: form.chargeable ? form.priceUnit : 'flat',
      availableOfficeIds: [...form.availableOfficeIds],
      assignedStaffIds: [...(form.assignedStaffIds || [])],
      status: form.status,
      description: String(form.description || '').trim(),
      updatedAt: now,
      updatedBy: author,
    };

    updateService(service.id, patch);

    const summary = diffSummary(service, { ...service, ...patch });
    addAuditLog({
      userName: author,
      role: (currentUser?.role || '').toString(),
      action: 'UPDATE',
      module: 'Services',
      description: `Updated service ${patch.name} (${service.code})${summary ? ` — ${summary}` : ''}.`,
      orgId: service.orgId,
    });

    setSaving(false);
    onUpdated?.({ ...service, ...patch });
  };

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-service-title"
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
            title={`Edit Service — ${service.name}`}
            subtitle={`Service Code: ${service.code} (immutable).`}
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
                onCodeBlur={() => {}}
                onChargeableToggle={handleChargeableToggle}
                userOffices={userOffices}
                currency={currency}
                codeImmutable
              />
            </div>

            <Footer
              saving={saving}
              submitLabel="Save Changes"
              onCancel={onClose}
            />
          </form>
        </aside>
      </div>

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
}