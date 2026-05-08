import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X, Building2, User, CreditCard, Settings2, Mail, Loader2,
  Copy, Check, Calendar as CalIcon,
} from 'lucide-react';
import {
  validateOrgName, validateBusinessEmail, validateFullName,
  validatePhone, validateRequired, generateTempPassword,
  COUNTRY_TO_CURRENCY, COUNTRY_TO_CODE, DIAL_CODES,
} from '../../utils/requestValidation';
/* Phase 2 strict validators — layered on top of the legacy ones above
 * so the new spec wins (2–100 org name with limited symbol set,
 * lowercase + trim email, 10-digit Indian phone with fake-number block,
 * 5–250 address bounds). Aliased to avoid name collisions. */
import {
  validateOrgName  as validateOrgNameStrict,
  validateEmail    as validateEmailStrict,
  validateName     as validatePersonNameStrict,
  validatePhoneByCountry,
  validateAddress  as validateAddressStrict,
  sanitizeEmail,
} from '../../utils/validators';
import { generateWelcomeEmail, previewEmail } from '../../utils/emailTemplates';
import { addAuditLog } from '../../utils/auditLogger';
import { useCollection, STORAGE_KEYS } from '../../store';
import { MOCK_ORGANIZATIONS } from '../../data/mockData';
import { Field, SearchableSelect, DatePicker } from '../../components/ui';

/**
 * AddOrgDrawer — right-side drawer Super Admin uses to provision a new
 * organisation. Two entry points:
 *
 *   1. Direct add from Organisations tab (blank form).
 *   2. Approve flow from Access Requests (prefilled from the request).
 *
 * On save:
 *   • Persists a new row into STORAGE_KEYS.ORGANIZATIONS.
 *   • Logs ORG_MANUAL_CREATED with sourceRequestId when applicable.
 *   • Generates a welcome-email envelope and console-logs the preview
 *     (the production backend will swap in a real mailer behind the
 *     same shape).
 *   • Calls onCreated(org) — the caller decides what to do next
 *     (close drawer, refresh table, mark request as Approved).
 *
 * Currency, GST/Trade-License rules and the welcome-email template
 * all flex by `country`, so the same drawer serves India and UAE
 * tenants without two code paths.
 */

const COUNTRIES = [
  { value: 'India',                  label: 'India' },
  { value: 'United Arab Emirates',   label: 'United Arab Emirates' },
  { value: 'Saudi Arabia',           label: 'Saudi Arabia' },
  { value: 'United Kingdom',         label: 'United Kingdom' },
  { value: 'Qatar',                  label: 'Qatar' },
  { value: 'Oman',                   label: 'Oman' },
  { value: 'Kuwait',                 label: 'Kuwait' },
  { value: 'Bahrain',                label: 'Bahrain' },
];

const INDUSTRIES = [
  'Retail', 'IT/Software', 'Manufacturing', 'Healthcare', 'Education',
  'Hospitality', 'Real Estate', 'Finance', 'Logistics', 'Aviation',
  'Consulting', 'Jewellery', 'Investments', 'Other',
];

const COMPANY_SIZES = ['1-10', '11-50', '51-200', '200+'];
const PLAN_OPTIONS  = ['Trial', 'Starter', 'Professional', 'Enterprise', 'Custom'];
const PAYMENT_STATUS = ['Trial', 'Paid Upfront', 'Invoice Raised', 'PO Received'];
const TAG_OPTIONS    = ['Enterprise', 'Referral', 'Migration', 'White-label', 'VIP', 'Custom'];

const ACCOUNT_MANAGERS = [
  { id: 'am-priya',  name: 'Priya Sharma' },
  { id: 'am-rahul',  name: 'Rahul Kapoor' },
  { id: 'am-anita',  name: 'Anita Desai' },
  { id: 'am-kamal',  name: 'Kamal Singh' },
];

/* Plan default monthly price in the org's local currency. The Custom plan
   exposes a price-override field; everything else is a sensible seed. */
const PLAN_DEFAULT_PRICE = {
  Trial:        0,
  Starter:      1999,
  Professional: 4999,
  Enterprise:   8999,
  Custom:       0,
};

function formatCurrency(amount, currency = 'INR') {
  const n = Number(amount) || 0;
  const locale = currency === 'INR' ? 'en-IN' : 'en-GB';
  const formatted = n.toLocaleString(locale, { maximumFractionDigits: 0 });
  if (currency === 'INR') return `\u20B9${formatted}`;
  return `${currency}\u00A0${formatted}`;
}

function nextOrgId(existing) {
  const used = new Set(existing.map((o) => o?.id));
  let n = existing.length + 1;
  while (used.has(`org-new-${n}`)) n += 1;
  return `org-new-${n}`;
}

export default function AddOrgDrawer({
  open,
  onClose,
  onCreated,
  prefillFromRequest = null,
  currentUser,
}) {
  const [orgs, addOrg] = useCollection(STORAGE_KEYS.ORGANIZATIONS, MOCK_ORGANIZATIONS);

  const closeBtnRef = useRef(null);
  const [saving, setSaving]       = useState(false);
  const [errors, setErrors]       = useState({});
  const [pwdCopied, setPwdCopied] = useState(false);

  /* Initial form values. When prefilled from a request, owner + org
     fields are seeded from the request payload; everything else uses
     plan defaults so the operator can save in two clicks. */
  const initial = useMemo(() => {
    const country = prefillFromRequest?.country || '';
    const currency = COUNTRY_TO_CURRENCY[country] || 'INR';
    const code     = COUNTRY_TO_CODE[country] || 'AE';
    return {
      orgName:        prefillFromRequest?.orgName || '',
      legalName:      prefillFromRequest?.orgName || '',
      country,
      industry:       prefillFromRequest?.industry || '',
      companySize:    prefillFromRequest?.companySize || '',
      address:        '',
      city:           prefillFromRequest?.city || '',
      postalCode:     '',
      gstOrLicense:   prefillFromRequest?.gstOrLicense || '',

      ownerFullName:  prefillFromRequest?.ownerName || '',
      ownerEmail:     prefillFromRequest?.businessEmail || '',
      ownerCountryCode: prefillFromRequest?.countryCode || code,
      ownerContact:   prefillFromRequest?.contactNumber || '',
      tempPassword:   generateTempPassword(),
      forcePwdChange: true,

      plan:           'Trial',
      billingCycle:   'Monthly',
      currency,
      trialDays:      14,
      priceOverride:  '',
      paymentStatus:  'Trial',

      accountManager: 'am-priya',
      tags:           [],
      internalNotes:  '',

      sendWelcome:    true,
      sendChecklist:  true,
      scheduleCall:   false,
      callDate:       '',
    };
  }, [prefillFromRequest]);

  const [form, setForm] = useState(initial);
  /* Reset form when drawer reopens or prefill source changes. */
  useEffect(() => { setForm(initial); setErrors({}); }, [initial, open]);

  /* Body scroll lock + Escape close + focus close button. */
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape' && !saving) onClose?.(); };
    document.addEventListener('keydown', onKey);
    const t = window.setTimeout(() => closeBtnRef.current?.focus(), 30);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
      window.clearTimeout(t);
    };
  }, [open, saving, onClose]);

  if (!open) return null;

  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) {
      setErrors((e) => { const n = { ...e }; delete n[key]; return n; });
    }
  };

  /* Country change cascades to currency + dial code so the operator
     does not need to re-pick them. */
  const handleCountryChange = (value) => {
    const cur  = COUNTRY_TO_CURRENCY[value] || 'INR';
    const code = COUNTRY_TO_CODE[value] || 'AE';
    setForm((f) => ({ ...f, country: value, currency: cur, ownerCountryCode: code }));
    if (errors.country) {
      setErrors((e) => { const n = { ...e }; delete n.country; return n; });
    }
  };

  /* Plan change resets the price override and trial-default. */
  const handlePlanChange = (value) => {
    setForm((f) => ({
      ...f,
      plan: value,
      priceOverride: value === 'Custom' ? f.priceOverride : '',
      paymentStatus: value === 'Trial' ? 'Trial' : (f.paymentStatus === 'Trial' ? 'Invoice Raised' : f.paymentStatus),
    }));
  };

  const toggleTag = (tag) => {
    setForm((f) => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter((t) => t !== tag) : [...f.tags, tag],
    }));
  };

  const copyPwd = async () => {
    try {
      await navigator.clipboard.writeText(form.tempPassword);
      setPwdCopied(true);
      window.setTimeout(() => setPwdCopied(false), 1800);
    } catch {
      /* clipboard might be denied (insecure context, sandbox) — silent. */
    }
  };

  const regenPwd = () => set('tempPassword', generateTempPassword());

  const validateAll = () => {
    const e = {};

    /* Country / plan / account manager — keep the legacy required check
     * because it understands country-code cascades + manager IDs. */
    const required = [
      ['country',        validateRequired(form.country, 'Country')],
      ['plan',           validateRequired(form.plan, 'Plan')],
      ['accountManager', validateRequired(form.accountManager, 'Assigned Account Manager')],
    ];
    for (const [field, res] of required) {
      if (!res.valid) e[field] = res.reason;
    }

    /* Phase 2 strict rules win for the user-typed identity fields. */
    const orgErr = validateOrgNameStrict(form.orgName, { label: 'Organisation name', min: 2, max: 100 });
    if (orgErr) e.orgName = orgErr;

    const nameErr = validatePersonNameStrict(form.ownerFullName, { label: 'Full name', min: 2, max: 50 });
    if (nameErr) e.ownerFullName = nameErr;

    const emailErr = validateEmailStrict(form.ownerEmail, { label: 'Email ID' });
    if (emailErr) e.ownerEmail = emailErr;

    /* Country-aware: Indian numbers go through the strict 10-digit
     * 6-9-prefix + fake-block rule; international tenants get the legacy
     * 7–15-digit fallback. */
    const phoneErr = validatePhoneByCountry(form.ownerContact, form.country, { label: 'Contact number' });
    if (phoneErr) e.ownerContact = phoneErr;

    /* Address — optional, but enforce 5–250 length when provided. */
    if (form.address && form.address.trim()) {
      const addrErr = validateAddressStrict(form.address, { required: false, min: 5, max: 250 });
      if (addrErr) e.address = addrErr;
    }

    if (form.plan === 'Custom') {
      const override = Number(form.priceOverride);
      if (!Number.isFinite(override) || override < 0) {
        e.priceOverride = 'Please enter a valid custom price.';
      }
    }
    if (form.scheduleCall && !form.callDate) {
      e.callDate = 'Please select a date and time for the onboarding call.';
    }
    if (form.trialDays !== '' && form.trialDays !== null) {
      const td = Number(form.trialDays);
      if (!Number.isFinite(td) || td < 0 || td > 90) {
        e.trialDays = 'Trial Days must be between 0 and 90.';
      }
    }
    return e;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;
    const e = validateAll();
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    setSaving(true);
    /* Server-simulate delay so the success toast only fires after a
       confirmed save, per the QA defect guide. */
    await new Promise((r) => setTimeout(r, 800));

    const id = nextOrgId(orgs || []);
    const planPrice = form.plan === 'Custom'
      ? Number(form.priceOverride) || 0
      : PLAN_DEFAULT_PRICE[form.plan] || 0;

    const newOrg = {
      id,
      name:           form.orgName.trim(),
      legalName:      (form.legalName || '').trim() || form.orgName.trim(),
      industry:       form.industry || '',
      location:       form.city ? `${form.city}, ${form.country}` : form.country,
      country:        form.country,
      address:        (form.address || '').trim(),
      city:           (form.city || '').trim(),
      postalCode:     (form.postalCode || '').trim(),
      plan:           form.plan,
      billingCycle:   form.billingCycle,
      currency:       form.currency,
      mrr:            planPrice,
      price:          planPrice,
      status:         form.plan === 'Trial' ? 'Trial' : 'Active',
      users:          1,
      trialDaysLeft:  form.plan === 'Trial' ? Number(form.trialDays) || 14 : null,
      paymentStatus:  form.paymentStatus,
      gstOrLicense:   (form.gstOrLicense || '').trim(),
      accountManager: ACCOUNT_MANAGERS.find((a) => a.id === form.accountManager)?.name || '',
      tags:           [...form.tags],
      internalNotes:  (form.internalNotes || '').trim(),
      owner: {
        fullName:     form.ownerFullName.trim(),
        email:        form.ownerEmail.trim(),
        contact:      `+${form.ownerCountryCode} ${form.ownerContact}`,
        forcePwdChange: form.forcePwdChange,
      },
      createdAt:      Date.now(),
      sourceRequestId: prefillFromRequest?.id || null,
      onboarding: {
        sendWelcome:   form.sendWelcome,
        sendChecklist: form.sendChecklist,
        scheduledCall: form.scheduleCall ? form.callDate : null,
      },
    };
    addOrg(newOrg);

    /* Bug 10 — register the organisation owner so they can sign in
       immediately and see all the data captured during creation
       (industry, country, contact, account manager, tags, notes).
       The Login flow reads cgms_registered_users; matching there
       returns a user object whose .organisationId points at the new
       org so the dashboard / settings hydrate from it. */
    try {
      const regKey = 'cgms_registered_users';
      const reg = JSON.parse(localStorage.getItem(regKey) || '[]');
      const ownerEmail = (newOrg.owner.email || '').toLowerCase();
      const exists = reg.some((u) => (u.email || u.emailId || '').toLowerCase() === ownerEmail);
      if (ownerEmail && !exists) {
        reg.push({
          id:             `owner-${id}`,
          name:           newOrg.owner.fullName,
          email:          ownerEmail,
          emailId:        ownerEmail,
          password:       form.tempPassword || '123456',
          role:           'director',
          organisationId: id,
          organisation:   newOrg.name,
          mustChangePassword: Boolean(form.forcePwdChange),
          createdAt:      Date.now(),
        });
        localStorage.setItem(regKey, JSON.stringify(reg));
      }
    } catch { /* localStorage unavailable — silently continue */ }

    addAuditLog({
      userName:    currentUser?.name || 'Super Admin',
      role:        currentUser?.role || 'superadmin',
      action:      'CREATE',
      module:      'Organisations',
      description: `Manually created organisation ${newOrg.name}${prefillFromRequest ? ` from request ${prefillFromRequest.id}` : ''}.`,
      orgId:       id,
    });

    if (form.sendWelcome) {
      previewEmail(generateWelcomeEmail(newOrg, newOrg.owner, form.tempPassword, newOrg.country));
    }

    setSaving(false);
    onCreated?.(newOrg);
  };

  /* ── Render ─────────────────────────────────────────────────────── */
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="addorg-title"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose?.(); }}
      className="fixed inset-0 z-[9100] flex justify-end bg-black/45"
    >
      <aside
        className="flex h-full w-full max-w-[720px] flex-col bg-white shadow-2xl dark:bg-[#0A1828] sm:w-[720px]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-gradient-to-r from-sky-700 to-sky-800 px-5 py-4 text-white dark:border-[#142535]">
          <div className="min-w-0">
            <h2 id="addorg-title" className="font-[Outfit,sans-serif] text-[16px] font-extrabold leading-tight">
              {prefillFromRequest ? `Approve & Create — ${prefillFromRequest.orgName}` : 'Add Organisation'}
            </h2>
            <p className="mt-1 text-[12px] opacity-85">
              {prefillFromRequest
                ? `Review the prefilled details from request ${prefillFromRequest.id} and create the account.`
                : 'Provision a new tenant directly. Used for enterprise deals, referrals and migrations.'}
            </p>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close drawer"
            title="Close"
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md bg-white/15 text-white transition hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">

            {/* ── Section 1: Organisation Details ── */}
            <SectionHeader Icon={Building2} title="Organisation Details" />
            <Field label="Organisation Name" required error={errors.orgName}>
              <input
                type="text"
                value={form.orgName}
                onChange={(e) => set('orgName', e.target.value)}
                placeholder="Enter organisation name"
                maxLength={100}
                className={inputCls(errors.orgName)}
              />
            </Field>
            <Field label="Legal Entity Name" hint="Optional — defaults to Organisation Name on the invoice if blank.">
              <input
                type="text"
                value={form.legalName}
                onChange={(e) => set('legalName', e.target.value)}
                placeholder="Enter legal entity name"
                maxLength={120}
                className={inputCls()}
              />
            </Field>
            <div className={twoColCls()}>
              <Field label="Country" required error={errors.country}>
                <SearchableSelect
                  value={form.country}
                  onChange={handleCountryChange}
                  options={COUNTRIES}
                  placeholder="Select country"
                  searchPlaceholder="Search country…"
                  error={Boolean(errors.country)}
                />
              </Field>
              <Field label="Industry">
                <SearchableSelect
                  value={form.industry}
                  onChange={(v) => set('industry', v)}
                  options={INDUSTRIES.map((i) => ({ value: i, label: i }))}
                  placeholder="Select industry"
                  searchPlaceholder="Search industry…"
                />
              </Field>
            </div>
            <div className={twoColCls()}>
              <Field label="Company Size">
                <SearchableSelect
                  value={form.companySize}
                  onChange={(v) => set('companySize', v)}
                  options={COMPANY_SIZES.map((s) => ({ value: s, label: s }))}
                  placeholder="Select company size"
                />
              </Field>
              <Field label="GST / Trade License">
                <input
                  type="text"
                  value={form.gstOrLicense}
                  onChange={(e) => set('gstOrLicense', e.target.value.toUpperCase())}
                  placeholder="Enter GST or Trade License Number"
                  maxLength={20}
                  className={inputCls()}
                />
              </Field>
            </div>
            <Field label="Address" error={errors.address} hint="If provided, must be 5–250 characters.">
              <input
                type="text"
                value={form.address}
                onChange={(e) => set('address', e.target.value)}
                placeholder="Enter street address"
                maxLength={250}
                className={inputCls(errors.address)}
              />
            </Field>
            <div className={twoColCls()}>
              <Field label="City">
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => set('city', e.target.value)}
                  placeholder="Enter city"
                  maxLength={60}
                  className={inputCls()}
                />
              </Field>
              <Field label="Postal Code">
                <input
                  type="text"
                  value={form.postalCode}
                  onChange={(e) => set('postalCode', e.target.value)}
                  placeholder="Enter postal code"
                  maxLength={12}
                  className={inputCls()}
                />
              </Field>
            </div>

            {/* ── Section 2: Owner / Administrator ── */}
            <SectionHeader Icon={User} title="Owner / Administrator" />
            <div className={twoColCls()}>
              <Field label="Full Name" required error={errors.ownerFullName}>
                <input
                  type="text"
                  value={form.ownerFullName}
                  onChange={(e) => set('ownerFullName', e.target.value)}
                  placeholder="Enter owner full name"
                  maxLength={80}
                  className={inputCls(errors.ownerFullName)}
                />
              </Field>
              <Field label="Email ID" required error={errors.ownerEmail}>
                <input
                  type="email"
                  value={form.ownerEmail}
                  onChange={(e) => set('ownerEmail', sanitizeEmail(e.target.value))}
                  placeholder="Enter owner business email ID"
                  className={inputCls(errors.ownerEmail)}
                />
              </Field>
            </div>
            <Field label="Contact Number" required error={errors.ownerContact}>
              <div className="flex gap-2">
                <SearchableSelect
                  value={form.ownerCountryCode}
                  onChange={(v) => set('ownerCountryCode', v)}
                  options={Object.entries(DIAL_CODES).map(([code, dial]) => ({
                    value: code, label: `${code} ${dial}`,
                  }))}
                  className="!w-[140px] flex-shrink-0"
                />
                <input
                  type="tel"
                  inputMode="numeric"
                  value={form.ownerContact}
                  onChange={(e) => set('ownerContact', e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="Enter contact number"
                  className={`${inputCls(errors.ownerContact)} flex-1`}
                />
              </div>
            </Field>
            <Field label="Temporary Password" hint="Auto-generated, 12 characters with mixed case, digits and symbols.">
              <div className="flex items-stretch gap-2">
                <input
                  readOnly
                  value={form.tempPassword}
                  aria-label="Temporary password"
                  className={`${inputCls()} flex-1 font-mono`}
                />
                <button
                  type="button"
                  onClick={copyPwd}
                  title="Copy password to clipboard"
                  className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-[10px] border border-slate-200 bg-white px-3 text-[12px] font-bold text-slate-700 transition hover:bg-slate-50 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-200"
                >
                  {pwdCopied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                  {pwdCopied ? 'Copied' : 'Copy'}
                </button>
                <button
                  type="button"
                  onClick={regenPwd}
                  title="Regenerate temporary password"
                  className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-[10px] border border-sky-200 bg-sky-50 px-3 text-[12px] font-bold text-sky-700 transition hover:bg-sky-100 dark:border-sky-400/30 dark:bg-sky-500/10 dark:text-sky-300"
                >
                  Regenerate
                </button>
              </div>
            </Field>
            <label className="mb-3 mt-1 inline-flex items-center gap-2 text-[13px] font-semibold text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={form.forcePwdChange}
                onChange={(e) => set('forcePwdChange', e.target.checked)}
                className="h-4 w-4 cursor-pointer accent-sky-600"
              />
              Force password change on first login
            </label>

            {/* ── Section 3: Subscription ── */}
            <SectionHeader Icon={CreditCard} title="Subscription" />
            <div className={twoColCls()}>
              <Field label="Plan" required error={errors.plan}>
                <SearchableSelect
                  value={form.plan}
                  onChange={handlePlanChange}
                  options={PLAN_OPTIONS.map((p) => ({ value: p, label: p }))}
                  placeholder="Select plan"
                  error={Boolean(errors.plan)}
                />
              </Field>
              <Field label="Billing Cycle">
                <div role="radiogroup" aria-label="Billing Cycle" className="flex gap-2">
                  {['Monthly', 'Annual'].map((c) => {
                    const active = form.billingCycle === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => set('billingCycle', c)}
                        className={`cursor-pointer rounded-[10px] border px-4 py-2 text-[12px] font-bold transition ${active
                          ? 'border-sky-700 bg-sky-700 text-white'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-300'}`}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
              </Field>
            </div>
            <div className={twoColCls()}>
              <Field label="Currency">
                <SearchableSelect
                  value={form.currency}
                  onChange={(v) => set('currency', v)}
                  options={[
                    { value: 'INR', label: 'INR — Indian Rupee' },
                    { value: 'AED', label: 'AED — UAE Dirham' },
                    { value: 'SAR', label: 'SAR — Saudi Riyal' },
                    { value: 'GBP', label: 'GBP — British Pound' },
                    { value: 'USD', label: 'USD — US Dollar' },
                    { value: 'QAR', label: 'QAR — Qatari Riyal' },
                    { value: 'OMR', label: 'OMR — Omani Rial' },
                    { value: 'KWD', label: 'KWD — Kuwaiti Dinar' },
                    { value: 'BHD', label: 'BHD — Bahraini Dinar' },
                  ]}
                />
              </Field>
              <Field label="Custom Trial Days" hint="0–90, default 14. Set 0 to skip the trial." error={errors.trialDays}>
                <input
                  type="number"
                  min={0}
                  max={90}
                  value={form.trialDays}
                  onChange={(e) => set('trialDays', e.target.value)}
                  className={inputCls(errors.trialDays)}
                />
              </Field>
            </div>
            {form.plan === 'Custom' && (
              <Field label="Price Override" required error={errors.priceOverride} hint={`Enter the monthly price in ${form.currency}.`}>
                <input
                  type="number"
                  min={0}
                  value={form.priceOverride}
                  onChange={(e) => set('priceOverride', e.target.value)}
                  placeholder="Enter custom price"
                  className={inputCls(errors.priceOverride)}
                />
                {form.priceOverride && (
                  <p className="mt-1 text-[11px] font-bold text-sky-700 dark:text-sky-300">
                    Preview: {formatCurrency(Number(form.priceOverride) || 0, form.currency)} per Month.
                  </p>
                )}
              </Field>
            )}
            <Field label="Payment Status">
              <div role="radiogroup" aria-label="Payment Status" className="flex flex-wrap gap-2">
                {PAYMENT_STATUS.map((s) => {
                  const active = form.paymentStatus === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => set('paymentStatus', s)}
                      className={`cursor-pointer rounded-full border px-3 py-1.5 text-[11px] font-bold transition ${active
                        ? 'border-sky-700 bg-sky-700 text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-300'}`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </Field>

            {/* ── Section 4: Account Management ── */}
            <SectionHeader Icon={Settings2} title="Account Management (Internal)" />
            <Field label="Assigned Account Manager" required error={errors.accountManager}>
              <SearchableSelect
                value={form.accountManager}
                onChange={(v) => set('accountManager', v)}
                options={ACCOUNT_MANAGERS.map((a) => ({ value: a.id, label: a.name }))}
                placeholder="Select account manager"
                error={Boolean(errors.accountManager)}
              />
            </Field>
            <Field label="Tags">
              <div className="flex flex-wrap gap-2">
                {TAG_OPTIONS.map((tag) => {
                  const active = form.tags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      aria-pressed={active}
                      className={`cursor-pointer rounded-full border px-3 py-1.5 text-[11px] font-bold transition ${active
                        ? 'border-sky-700 bg-sky-700 text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-300'}`}
                    >
                      {active ? '✓ ' : ''}{tag}
                    </button>
                  );
                })}
              </div>
            </Field>
            <Field label="Internal Notes">
              <textarea
                value={form.internalNotes}
                onChange={(e) => set('internalNotes', e.target.value)}
                placeholder="Add private notes about this organisation"
                rows={3}
                className={`${inputCls()} resize-vertical`}
              />
            </Field>

            {/* ── Section 5: Welcome Communication ── */}
            <SectionHeader Icon={Mail} title="Welcome Communication" />
            <label className="mb-2 flex items-start gap-2 text-[13px] text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={form.sendWelcome}
                onChange={(e) => set('sendWelcome', e.target.checked)}
                className="mt-0.5 h-4 w-4 cursor-pointer accent-sky-600"
              />
              Send welcome email with login credentials.
            </label>
            <label className="mb-2 flex items-start gap-2 text-[13px] text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={form.sendChecklist}
                onChange={(e) => set('sendChecklist', e.target.checked)}
                className="mt-0.5 h-4 w-4 cursor-pointer accent-sky-600"
              />
              Send 5-step onboarding checklist.
            </label>
            <label className="mb-3 flex items-start gap-2 text-[13px] text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={form.scheduleCall}
                onChange={(e) => set('scheduleCall', e.target.checked)}
                className="mt-0.5 h-4 w-4 cursor-pointer accent-sky-600"
              />
              Schedule onboarding call.
            </label>
            {form.scheduleCall && (
              <Field label="Call Date and Time" required error={errors.callDate}>
                <div className="flex items-center gap-2">
                  <CalIcon size={16} aria-hidden="true" className="shrink-0 text-sky-500 dark:text-sky-300" />
                  <input
                    type="datetime-local"
                    value={form.callDate}
                    onChange={(e) => set('callDate', e.target.value)}
                    className={inputCls(errors.callDate)}
                  />
                </div>
              </Field>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-[#142535] dark:bg-[#071220]">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {form.plan === 'Custom' && form.priceOverride
                ? `Will be billed ${formatCurrency(Number(form.priceOverride) || 0, form.currency)} per Month.`
                : `Will be billed ${formatCurrency(PLAN_DEFAULT_PRICE[form.plan] || 0, form.currency)} per Month.`}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="cursor-pointer rounded-[10px] border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-[#142535] dark:bg-[#0A1828] dark:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-sky-700 bg-gradient-to-r from-sky-600 to-sky-800 px-5 py-2.5 text-[13px] font-bold text-white shadow-sm transition hover:from-sky-700 hover:to-sky-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
                {saving ? 'Creating…' : 'Create Account →'}
              </button>
            </div>
          </div>
        </form>
      </aside>
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────── */
function SectionHeader({ Icon, title }) {
  return (
    <h3 className="mb-3 mt-2 inline-flex items-center gap-2 font-[Outfit,sans-serif] text-[12px] font-extrabold uppercase tracking-[0.08em] text-sky-700 dark:text-sky-300">
      {Icon && <Icon size={14} aria-hidden="true" />}
      {title}
    </h3>
  );
}

function inputCls(hasError) {
  const base =
    'w-full rounded-[10px] border bg-white px-3 py-2 text-[13px] text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:bg-[#071220] dark:text-slate-200';
  return hasError
    ? `${base} border-red-400 focus:border-red-500 focus:ring-red-100 dark:border-red-500/40`
    : `${base} border-slate-200 dark:border-[#142535]`;
}

function twoColCls() {
  return 'grid grid-cols-1 gap-3 sm:grid-cols-2';
}
