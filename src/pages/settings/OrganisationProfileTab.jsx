import React, { useMemo, useRef, useState } from 'react';
import { Building2, Upload, Loader2, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCollection, STORAGE_KEYS, useOrgSettings } from '../../store';
import { MOCK_ORGANIZATIONS, MOCK_APPOINTMENTS, MOCK_SERVICES } from '../../data/mockData';
import { addAuditLog } from '../../utils/auditLogger';
import { Toast, ConfirmModal } from '../../components/ui';
import { getTimezoneAbbr } from '../../utils/appointmentState';
/* Phase 2 strict validators for the Organisation Profile form. The
 * earlier validate() only checked org-name length and a loose email
 * regex; the strict rules below tighten that to match the spec. */
import {
  validateOrgName,
  validateEmail,
  sanitizeEmail,
  validatePhoneByCountry,
  validateAddress,
} from '../../utils/validators';

const LOGO_MAX_BYTES = 200 * 1024;

const TIMEZONES = [
  'Asia/Dubai', 'Asia/Kolkata', 'Asia/Riyadh', 'Asia/Singapore',
  'UTC', 'Europe/London', 'Europe/Paris',
  'America/New_York', 'America/Los_Angeles',
];

const CURRENCIES = [
  { value: 'INR', label: 'INR — Indian Rupee' },
  { value: 'AED', label: 'AED — UAE Dirham' },
  { value: 'SAR', label: 'SAR — Saudi Riyal' },
  { value: 'GBP', label: 'GBP — Pound Sterling' },
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'QAR', label: 'QAR — Qatari Riyal' },
  { value: 'OMR', label: 'OMR — Omani Rial' },
  { value: 'KWD', label: 'KWD — Kuwaiti Dinar' },
  { value: 'BHD', label: 'BHD — Bahraini Dinar' },
];

const COUNTRIES = [
  'India', 'United Arab Emirates', 'Saudi Arabia', 'Singapore',
  'United Kingdom', 'United States', 'Other',
];

export default function OrganisationProfileTab({ canEdit = true }) {
  const { user } = useAuth();
  const [orgs, , updateOrg] = useCollection(STORAGE_KEYS.ORGANIZATIONS, MOCK_ORGANIZATIONS);
  const [appointments] = useCollection(STORAGE_KEYS.APPOINTMENTS, MOCK_APPOINTMENTS);
  const [services]     = useCollection(STORAGE_KEYS.SERVICES,     MOCK_SERVICES);

  const orgId = user?.organisationId || user?.orgId;
  const orgRecord = useMemo(() => (orgs || []).find((o) => o?.id === orgId) || null, [orgs, orgId]);
  const { settings, save } = useOrgSettings(user, { org: orgRecord });

  const [draft, setDraft] = useState(settings || {});
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const fileRef = useRef(null);

  React.useEffect(() => { if (settings) setDraft(settings); }, [settings]);

  if (!orgId) {
    return (
      <Card className="text-center py-10">
        <p className="text-slate-400 dark:text-slate-500 text-[13px]">
          Organisation profile requires a logged-in tenant user.
        </p>
      </Card>
    );
  }

  const set = (key, value) => {
    if (!canEdit) return;
    setDraft((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const countAffectedAppointments = () =>
    (appointments || [])
      .filter((a) => a?.orgId === orgId)
      .filter((a) => ['Pending', 'Approved', 'Checked-In', 'In-Progress'].includes(a?.status))
      .length;

  const countServicesInCurrency = (currency) =>
    (services || [])
      .filter((s) => s?.orgId === orgId)
      .filter((s) => (s?.currency || settings.currency) === currency)
      .length;

  const validate = (next) => {
    const e = {};

    /* Phase 2 spec: org name 2–100, alphanumeric + & . - _ + space. */
    const orgErr = validateOrgName(next.orgName, { label: 'Organisation Name', min: 2, max: 100 });
    if (orgErr) e.orgName = orgErr;

    /* Email is optional on this tab, but enforce strict format when
     * present (no internal whitespace, valid format, length cap). */
    if (next.contactEmail && next.contactEmail.trim()) {
      const emailErr = validateEmail(next.contactEmail, { label: 'Email ID', required: false });
      if (emailErr) e.contactEmail = emailErr;
    }

    /* Phone is optional. When present, validate against the chosen
     * country: Indian numbers go through the strict 10-digit + 6/7/8/9
     * + fake-block rule; international tenants get the 7–15 fallback. */
    if (next.contactPhone && next.contactPhone.trim()) {
      const phoneErr = validatePhoneByCountry(next.contactPhone, next.country, {
        label: 'Contact Number', required: false,
      });
      if (phoneErr) e.contactPhone = phoneErr;
    }

    /* Address lines optional; if filled, enforce 5–250 characters. */
    if (next.addressLine1 && next.addressLine1.trim()) {
      const addr1Err = validateAddress(next.addressLine1, {
        label: 'Address Line 1', min: 5, max: 250, required: false,
      });
      if (addr1Err) e.addressLine1 = addr1Err;
    }
    if (next.addressLine2 && next.addressLine2.trim()) {
      const addr2Err = validateAddress(next.addressLine2, {
        label: 'Address Line 2', min: 5, max: 250, required: false,
      });
      if (addr2Err) e.addressLine2 = addr2Err;
    }

    if (next.postalCode && next.postalCode.length > 20) e.postalCode = 'Postal Code must be 20 characters or fewer.';
    if (!next.timezone || !TIMEZONES.includes(next.timezone)) e.timezone = 'Select a valid timezone.';
    if (!next.currency || !CURRENCIES.find((c) => c.value === next.currency)) e.currency = 'Select a valid currency.';
    return e;
  };

  const attemptSave = () => {
    if (!canEdit) return;
    const errs = validate(draft);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    const tzChanged  = draft.timezone !== settings.timezone;
    const curChanged = draft.currency !== settings.currency;
    if (tzChanged) {
      setConfirm({ kind: 'timezone', title: 'Change organisation timezone?', oldTz: settings.timezone, newTz: draft.timezone, affected: countAffectedAppointments() });
      return;
    }
    if (curChanged) {
      setConfirm({ kind: 'currency', title: 'Change organisation currency?', oldCurrency: settings.currency, newCurrency: draft.currency, affected: countServicesInCurrency(settings.currency) });
      return;
    }
    commitSave();
  };

  const commitSave = async (extraAudit = null) => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 800));
    const next = save(draft);
    if (orgRecord) {
      updateOrg(orgRecord.id, { ...orgRecord, name: draft.orgName || orgRecord.name, country: draft.country || orgRecord.country, timezone: draft.timezone || orgRecord.timezone, currency: draft.currency || orgRecord.currency, logoDataUrl: draft.logoDataUrl ?? orgRecord.logoDataUrl ?? null });
    }
    const actor = user?.name || 'Unknown';
    addAuditLog({ userName: actor, role: (user?.role || '').toLowerCase(), action: 'SETTINGS_ORG_UPDATED', module: 'Settings', description: `Organisation profile updated: ${Object.keys(draft).join(', ').slice(0, 140)}.`, orgId });
    if (extraAudit) addAuditLog({ ...extraAudit, orgId, userName: actor, role: (user?.role || '').toLowerCase() });
    setSaving(false);
    setToast({ msg: 'Organisation profile updated successfully.', type: 'success' });
    setDraft(next || draft);
  };

  const handleConfirm = () => {
    const c = confirm; setConfirm(null);
    if (!c) return;
    const extra = c.kind === 'timezone'
      ? { action: 'TIMEZONE_CHANGED', module: 'Settings', description: `Timezone changed from ${c.oldTz} to ${c.newTz}. ${c.affected} active appointment(s) will display in the new timezone.` }
      : { action: 'CURRENCY_CHANGED', module: 'Settings', description: `Currency changed from ${c.oldCurrency} to ${c.newCurrency}. ${c.affected} service(s) re-labelled without conversion.` };
    commitSave(extra).then(() => {
      if (c.kind === 'currency') setToast({ msg: 'Currency changed. Please review service prices in the Services module.', type: 'info' });
    });
  };

  const handleLogoPick = (e) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    if (!['image/jpeg','image/png','image/svg+xml'].includes(file.type)) { setToast({ msg: 'Logo must be a JPG, PNG or SVG file.', type: 'error' }); return; }
    if (file.size > LOGO_MAX_BYTES) { setToast({ msg: `Logo must be under 200 KB. Current file is ${Math.round(file.size/1024)} KB.`, type: 'error' }); return; }
    const reader = new FileReader();
    reader.onload = () => {
      let dataUrl = String(reader.result || '');
      if (file.type === 'image/svg+xml') dataUrl = dataUrl.replace(/<script[\s\S]*?<\/script>/gi, '');
      set('logoDataUrl', dataUrl);
    };
    reader.onerror = () => setToast({ msg: 'Unable to read the selected file.', type: 'error' });
    reader.readAsDataURL(file);
  };

  const tzAbbr = getTimezoneAbbr(draft.timezone);
  const isDirty = JSON.stringify(draft) !== JSON.stringify(settings);

  return (
    <div className="flex flex-col gap-4">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {!canEdit && (
        <div role="status" className="flex items-center gap-2 rounded-[10px] border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] font-semibold text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          <AlertTriangle size={14} aria-hidden="true" />
          You can view Organisation details but editing is restricted to Directors.
        </div>
      )}

      {/* Identity */}
      <Card>
        <SectionHeader icon={<Building2 size={18} />} title="Organisation Identity" desc="Visible on badges, emails and reports." iconColor="sky" />
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Organisation Name" required error={errors.orgName}>
            <Input value={draft.orgName || ''} onChange={(e) => set('orgName', e.target.value)} placeholder="Enter Organisation Name" disabled={!canEdit} invalid={Boolean(errors.orgName)} maxLength={120} />
          </Field>
          <Field label="Trading Name" hint="Optional — appears on invoices if set.">
            <Input value={draft.tradingName || ''} onChange={(e) => set('tradingName', e.target.value)} placeholder="Enter Trading Name" disabled={!canEdit} />
          </Field>
          <Field label="Email ID" error={errors.contactEmail}>
            <Input type="email" value={draft.contactEmail || ''} onChange={(e) => set('contactEmail', sanitizeEmail(e.target.value))} placeholder="Enter Email ID" disabled={!canEdit} invalid={Boolean(errors.contactEmail)} maxLength={200} />
          </Field>
          <Field label="Contact Number" error={errors.contactPhone}>
            <Input type="tel" value={draft.contactPhone || ''} onChange={(e) => set('contactPhone', e.target.value)} placeholder="Enter Contact Number" disabled={!canEdit} invalid={Boolean(errors.contactPhone)} maxLength={20} />
          </Field>
        </div>
      </Card>

      {/* Logo */}
      <Card>
        <h2 className="text-[15px] font-extrabold text-[#0C2340] dark:text-slate-100">Logo</h2>
        <p className="mt-0.5 text-[12px] text-slate-400 dark:text-slate-500">Recommended 400x120px. Max 200 KB. JPG, PNG or SVG.</p>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <div className="flex h-[60px] w-[160px] items-center justify-center overflow-hidden rounded-[10px] border border-dashed border-slate-200 bg-slate-50 dark:border-[#142535] dark:bg-[#071220]">
            {draft.logoDataUrl
              ? <img src={draft.logoDataUrl} alt="Organisation logo" className="max-h-full max-w-full object-contain" />
              : <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">No logo uploaded</span>}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => fileRef.current?.click()} disabled={!canEdit}
              className="inline-flex items-center gap-1.5 rounded-[10px] border border-sky-600 px-3 py-2 text-[12px] font-bold text-sky-700 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-sky-500 dark:text-sky-400 dark:hover:bg-sky-500/10">
              <Upload size={13} /> {draft.logoDataUrl ? 'Replace Logo' : 'Upload Logo'}
            </button>
            {draft.logoDataUrl && (
              <button type="button" onClick={() => { if (canEdit) set('logoDataUrl', null); }} disabled={!canEdit}
                className="rounded-[10px] border border-red-300 px-3 py-2 text-[12px] font-bold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-500/40 dark:text-red-400 dark:hover:bg-red-500/10">
                Remove
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/svg+xml" className="hidden" onChange={handleLogoPick} />
          </div>
        </div>
      </Card>

      {/* Address */}
      <Card>
        <h2 className="text-[15px] font-extrabold text-[#0C2340] dark:text-slate-100">Registered Address</h2>
        <p className="mt-0.5 text-[12px] text-slate-400 dark:text-slate-500">Used on invoices and compliance documents.</p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Address Line 1" error={errors.addressLine1}>
            <Input value={draft.addressLine1 || ''} onChange={(e) => set('addressLine1', e.target.value)} placeholder="Enter Address Line 1" disabled={!canEdit} invalid={Boolean(errors.addressLine1)} maxLength={250} />
          </Field>
          <Field label="Address Line 2" error={errors.addressLine2}>
            <Input value={draft.addressLine2 || ''} onChange={(e) => set('addressLine2', e.target.value)} placeholder="Enter Address Line 2" disabled={!canEdit} invalid={Boolean(errors.addressLine2)} maxLength={250} />
          </Field>
          <Field label="City">
            <Input value={draft.city || ''} onChange={(e) => set('city', e.target.value)} placeholder="Enter City" disabled={!canEdit} maxLength={80} />
          </Field>
          <Field label="State / Emirate">
            <Input value={draft.state || ''} onChange={(e) => set('state', e.target.value)} placeholder="Enter State or Emirate" disabled={!canEdit} maxLength={80} />
          </Field>
          <Field label="Postal Code" error={errors.postalCode}>
            <Input value={draft.postalCode || ''} onChange={(e) => set('postalCode', e.target.value)} placeholder="Enter Postal Code" disabled={!canEdit} invalid={Boolean(errors.postalCode)} maxLength={20} />
          </Field>
          <Field label="Country">
            <Select value={draft.country || ''} onChange={(e) => set('country', e.target.value)} disabled={!canEdit}>
              <option value="">Select Country</option>
              {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
        </div>
      </Card>

      {/* Regional */}
      <Card>
        <h2 className="text-[15px] font-extrabold text-[#0C2340] dark:text-slate-100">Regional Defaults</h2>
        <p className="mt-0.5 text-[12px] text-slate-400 dark:text-slate-500">
          Timezone feeds appointment display ({tzAbbr}). Currency feeds service pricing.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Timezone" required error={errors.timezone}>
            <Select value={draft.timezone || ''} onChange={(e) => set('timezone', e.target.value)} disabled={!canEdit} invalid={Boolean(errors.timezone)}>
              {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </Select>
          </Field>
          <Field label="Currency" required error={errors.currency}>
            <Select value={draft.currency || ''} onChange={(e) => set('currency', e.target.value)} disabled={!canEdit} invalid={Boolean(errors.currency)}>
              {CURRENCIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </Select>
          </Field>
        </div>
      </Card>

      {/* Save bar */}
      <div className="flex justify-end gap-2">
        <Btn outline disabled={!canEdit || !isDirty || saving} onClick={() => setDraft(settings)}>Cancel</Btn>
        <Btn disabled={!canEdit || !isDirty || saving} onClick={attemptSave}>
          {saving && <Loader2 size={14} className="animate-spin" />}
          {saving ? 'Saving…' : 'Save Changes'}
        </Btn>
      </div>

      {confirm && (
        <ConfirmModal
          title={confirm.title}
          message={confirm.kind === 'timezone'
            ? `${confirm.affected} existing appointment(s) will be displayed in the new timezone (${confirm.newTz}). Historic times are interpreted literally — "10:00" will continue showing as "10:00" but labelled ${getTimezoneAbbr(confirm.newTz)} instead of ${getTimezoneAbbr(confirm.oldTz)}.`
            : `${confirm.affected} service(s) currently priced in ${confirm.oldCurrency} will be re-labelled as ${confirm.newCurrency} WITHOUT automatic conversion. You must update each service price manually.`}
          onConfirm={handleConfirm}
          onCancel={() => setConfirm(null)}
          confirmLabel="Confirm Change"
        />
      )}
    </div>
  );
}

/* ── Shared primitives ── */

function Card({ children, className = '' }) {
  return (
    <section className={`rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm dark:border-[#142535] dark:bg-[#0A1828] ${className}`}>
      {children}
    </section>
  );
}

function SectionHeader({ icon, title, desc, iconColor = 'sky' }) {
  const colorMap = {
    sky:   'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400',
    green: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400',
    red:   'bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400',
  };
  return (
    <div className="flex items-center gap-3">
      <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] ${colorMap[iconColor] || colorMap.sky}`}>
        {icon}
      </span>
      <div>
        <h2 className="text-[15px] font-extrabold text-[#0C2340] dark:text-slate-100">{title}</h2>
        {desc && <p className="mt-0.5 text-[12px] text-slate-400 dark:text-slate-500">{desc}</p>}
      </div>
    </div>
  );
}

function Input({ type = 'text', value, onChange, placeholder, disabled, invalid, maxLength, className = '' }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      maxLength={maxLength}
      className={[
        'w-full rounded-[10px] border px-3 py-2.5 text-[13px] outline-none transition',
        'text-slate-700 dark:text-slate-200',
        'placeholder:text-slate-400 dark:placeholder:text-slate-500',
        invalid
          ? 'border-red-400 bg-red-50 dark:border-red-500/50 dark:bg-red-500/10'
          : 'border-slate-200 bg-white focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-[#142535] dark:bg-[#071220] dark:focus:border-sky-500',
        disabled ? 'cursor-not-allowed opacity-60 dark:bg-[#040D18]' : '',
        className,
      ].join(' ')}
    />
  );
}

function Select({ value, onChange, disabled, invalid, children, className = '' }) {
  return (
    <select
      value={value}
      onChange={onChange}
      disabled={disabled}
      className={[
        'w-full rounded-[10px] border px-3 py-2.5 text-[13px] outline-none transition',
        'text-slate-700 dark:text-slate-200',
        invalid
          ? 'border-red-400 bg-red-50 dark:border-red-500/50 dark:bg-red-500/10'
          : 'border-slate-200 bg-white focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-[#142535] dark:bg-[#071220] dark:focus:border-sky-500',
        disabled ? 'cursor-not-allowed opacity-60 dark:bg-[#040D18]' : '',
        className,
      ].join(' ')}
    >
      {children}
    </select>
  );
}

function Field({ label, required, error, hint, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400">
        {label}{required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {error
        ? <p role="alert" className="text-[11px] font-semibold text-red-500">{error}</p>
        : hint ? <p className="text-[11px] text-slate-400 dark:text-slate-500">{hint}</p> : null}
    </div>
  );
}

function Btn({ children, onClick, disabled, outline }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'inline-flex items-center gap-1.5 rounded-[10px] border px-4 py-2 text-[13px] font-bold transition disabled:cursor-not-allowed disabled:opacity-50',
        outline
          ? 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-300 dark:hover:bg-[#0A1828]'
          : 'border-sky-700 bg-sky-600 text-white hover:bg-sky-700',
      ].join(' ')}
    >
      {children}
    </button>
  );
}