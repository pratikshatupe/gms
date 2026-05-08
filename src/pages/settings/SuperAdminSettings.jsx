import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pencil, Copy, Trash2 } from 'lucide-react';
import { Toast, ConfirmModal } from '../../components/ui';
import { useCollection, STORAGE_KEYS } from '../../store';
import { useAuth } from '../../context/AuthContext';
import { addAuditLog } from '../../utils/auditLogger';
import { MOCK_ORGANIZATIONS, MOCK_STAFF } from '../../data/mockData';
import { dispatchPasswordExpiryEmails } from '../../utils/passwordExpiry';
import PlanEditorModal from '../../components/PlanEditorModal';
import EmailTemplates from './EmailTemplates';

/* Design tokens mirror the existing Settings palette so the tabs blend in. */
const T = {
bg: 'var(--bg)',
  border: '#E2E8F0',
  navy: '#0C2340',
  text: '#475569',
  muted: '#94A3B8',
  purple: '#0284C7',
  red: '#DC2626',
  amber: '#B45309',
  green: '#059669',
  blue: '#2563EB',
  font: "'Outfit', 'Plus Jakarta Sans', sans-serif",
};

const card = (extra = {}) => ({
  background: 'var(--card)',
  border: `1px solid var(--border)`,
  borderRadius: 14,
  boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
  padding: 20,
  ...extra,
});

const input = (hasError = false) => ({
  width: '100%',
  border: `1px solid ${hasError ? T.red : T.border}`,
  borderRadius: 10,
  padding: '10px 12px',
  fontSize: 13,
color: 'var(--text)',
  outline: 'none',
  fontFamily: T.font,
background: 'var(--card)',
});

const btn = (color = T.purple, outline = false, disabled = false) => ({
  padding: '8px 18px',
  borderRadius: 10,
  fontSize: 13,
  fontWeight: 700,
  cursor: disabled ? 'not-allowed' : 'pointer',
  fontFamily: T.font,
  border: `1px solid ${color}`,
  background: outline ? 'var(--app-surface)' : color,
  color: outline ? color : '#fff',
  opacity: disabled ? 0.5 : 1,
  transition: 'all .15s ease',
});

/* ─── Defaults ─── */

const DEFAULT_FEATURES = [
  'Walk-in Check-in',
  'Appointments Scheduling',
  'Multi-Office Support',
  'Custom Branding',
  'Advanced Reports',
  'Excel Exports',
  'PDF Exports',
  'Email Notifications',
  'SMS Notifications',
  'WhatsApp Notifications',
  'API Access',
  'Webhooks',
  'Single Sign-On (SSO)',
  'White-label',
  'Priority Support',
  'Dedicated Account Manager',
  'AI Features (beta)',
];

const DEFAULT_PLAN_SLOTS = ['Starter', 'Professional', 'Enterprise'];

function defaultPlatformSettings() {
  const flagsByPlan = {};
  for (const feat of DEFAULT_FEATURES) {
    flagsByPlan[feat] = {
      Starter:      ['Walk-in Check-in', 'Appointments Scheduling', 'Email Notifications'].includes(feat),
      Professional: ['Walk-in Check-in', 'Appointments Scheduling', 'Multi-Office Support', 'Advanced Reports', 'Excel Exports', 'PDF Exports', 'Email Notifications', 'WhatsApp Notifications', 'API Access'].includes(feat),
      Enterprise:   true,  /* Enterprise gets everything by default */
    };
  }
  return {
    branding: {
      name:         'CorpGMS',
      tagline:      'Corporate Guest Management',
      logoDataUrl:  '',
      faviconDataUrl: '',
      primary:      '#0284C7',
      secondary:    '#0EA5E9',
      accent:       '#10B981',
      domain:       '',
      emailFromName:    'CorpGMS Team',
      emailFromAddress: 'no-reply@corpgms.ae',
      footer:       '© 2026 CorpGMS — All rights reserved.',
    },
    plans: [
      { id: 'plan-starter', name: 'Starter',      monthly: 299,  yearly: 2990,  maxUsers: 10,  maxOffices: 1,  maxVisitors: 500,   maxStorageGb: 5,   trialDays: 14, status: 'Active',   features: ['Walk-in Check-in','Appointments Scheduling','Email Notifications'] },
      { id: 'plan-pro',     name: 'Professional', monthly: 999,  yearly: 9990,  maxUsers: 50,  maxOffices: 5,  maxVisitors: 5000,  maxStorageGb: 25,  trialDays: 14, status: 'Active',   features: ['Walk-in Check-in','Appointments Scheduling','Multi-Office Support','Advanced Reports','Excel Exports','PDF Exports','Email Notifications','WhatsApp Notifications','API Access'] },
      { id: 'plan-ent',     name: 'Enterprise',   monthly: 2990, yearly: 29900, maxUsers: 500, maxOffices: 25, maxVisitors: 50000, maxStorageGb: 200, trialDays: 30, status: 'Active',   features: [...DEFAULT_FEATURES] },
    ],
    pricing: {
      currency:    'INR',
      taxRate:     5,
      graceDays:   7,
      trialDays:   14,
      discountCodes: [
        { code: 'LAUNCH10',  percent: 10, validUntil: '2026-12-31', usage: 24, active: true },
        { code: 'WELCOME25', percent: 25, validUntil: '2026-06-30', usage: 3,  active: true },
      ],
    },
    security: {
      minPasswordLength: 8,
      requireUppercase: true,
      requireNumber:    true,
      requireSpecial:   false,
      passwordExpiryDays: 90,
      passwordHistory:  3,
      twoFA:            'Optional',
      sessionTimeoutMins: 30,
      maxLoginAttempts: 5,
      lockoutMins:      30,
      ipAllowlist:      '',
      auditRetentionDays: 90,
    },
    regional: {
      country:     'United Arab Emirates',
      timezone:    'Asia/Dubai',
      dateFormat:  'DD/MM/YYYY',
      timeFormat:  '12h',
      language:    'English',
      weekStart:   'Sunday',
      workingDays: { Sun: true, Mon: true, Tue: true, Wed: true, Thu: true, Fri: false, Sat: false },
    },
    features: {
      flagsByPlan,
      global: {
        registrationOpen:  true,
        publicApi:         false,
        marketingSite:     true,
        betaOptIn:         false,
      },
    },
    maintenance: {
      mode:             false,
      message:          'We\'re performing scheduled maintenance. Back shortly.',
      scheduleStartDate: '',
      scheduleStartTime: '',
      scheduleEndDate:   '',
      scheduleEndTime:   '',
      notifyBefore:      '24h',
      bannerMessage:     '',
      bannerSeverity:    'Info',
    },
  };
}

function mergeWithDefaults(raw) {
  const defaults = defaultPlatformSettings();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return defaults;
  return {
    branding:    { ...defaults.branding,    ...(raw.branding    || {}) },
    plans:       Array.isArray(raw.plans) && raw.plans.length ? raw.plans : defaults.plans,
    pricing:     { ...defaults.pricing,     ...(raw.pricing     || {}), discountCodes: Array.isArray(raw.pricing?.discountCodes) ? raw.pricing.discountCodes : defaults.pricing.discountCodes },
    security:    { ...defaults.security,    ...(raw.security    || {}) },
    regional:    { ...defaults.regional,    ...(raw.regional    || {}), workingDays: { ...defaults.regional.workingDays, ...(raw.regional?.workingDays || {}) } },
    features:    {
      flagsByPlan: { ...defaults.features.flagsByPlan, ...(raw.features?.flagsByPlan || {}) },
      global:      { ...defaults.features.global,      ...(raw.features?.global || {}) },
    },
    maintenance: { ...defaults.maintenance, ...(raw.maintenance || {}) },
  };
}

/* ─── Small form atoms ─── */

function FieldRow({ label, required, error, hint, children, wide, labelTitle }) {
  return (
    <div style={{ marginBottom: 14, gridColumn: wide ? '1 / -1' : undefined }}>
      <label
        title={labelTitle}
        style={{
          display: 'block', fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 6,
          /* When the label has a tooltip, expose it visually via a dotted
           * underline so users know they can hover for an explanation. */
          cursor: labelTitle ? 'help' : 'default',
          textDecoration: labelTitle ? 'underline dotted' : 'none',
          textUnderlineOffset: labelTitle ? '3px' : undefined,
          textDecorationColor: labelTitle ? T.muted : undefined,
        }}
      >
        {label}{required && <span style={{ color: T.red }}>*</span>}
      </label>
      {children}
      {error && <p style={{ margin: '4px 0 0', fontSize: 11, color: T.red }}>{error}</p>}
      {!error && hint && <p style={{ margin: '4px 0 0', fontSize: 11, color: T.muted }}>{hint}</p>}
    </div>
  );
}

function Toggle({ checked, onChange, label, title }) {
  return (
    <label title={title} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, color: T.text, padding: '6px 0' }}>
      <input type="checkbox" checked={Boolean(checked)} onChange={(e) => onChange(e.target.checked)} />
      {label && <span>{label}</span>}
    </label>
  );
}

function SectionHeader({ title, subtitle, action }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: T.navy, fontFamily: T.font }}>{title}</h2>
        {subtitle && <p style={{ margin: '4px 0 0', fontSize: 12, color: T.muted }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/* ─── Tab bodies ─── */

function BrandingTab({ value, onPatch }) {
  return (
    <>
      <SectionHeader title="Platform Branding" subtitle="Public-facing identity — logo, colours, sender details." />
      <div style={{ ...card(), display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
        <FieldRow label="Platform Name" required labelTitle="The product name shown in the top bar, emails, and browser tab.">
          <input style={input()} value={value.name} onChange={(e) => onPatch({ name: e.target.value.slice(0, 60) })} maxLength={60} placeholder="CorpGMS" />
        </FieldRow>
        <FieldRow label="Platform Tagline" hint="Shown under the logo on the landing page. 80 characters max." labelTitle="Short strapline shown under the platform name on the marketing site.">
          <input style={input()} value={value.tagline} onChange={(e) => onPatch({ tagline: e.target.value.slice(0, 80) })} maxLength={80} placeholder="Corporate Guest Management" />
        </FieldRow>

        <FieldRow label="Platform Logo" required hint="PNG or SVG, max 2 MB." labelTitle="Uploaded once and shown on Login, top bar, and every email template.">
          <input type="file" accept=".png,.svg,image/png,image/svg+xml"
                 onChange={(e) => {
                   const f = e.target.files?.[0];
                   if (!f) return;
                   const r = new FileReader();
                   r.onload = () => onPatch({ logoDataUrl: String(r.result || '') });
                   r.readAsDataURL(f);
                 }} />
          {value.logoDataUrl && <img src={value.logoDataUrl} alt="Logo preview" style={{ marginTop: 6, maxHeight: 48, borderRadius: 8, border: `1px solid ${T.border}` }} />}
        </FieldRow>

        <FieldRow label="Favicon" required hint=".ico or .png 32×32, max 500 KB." labelTitle="Small icon shown in the browser tab and bookmark list.">
          <input type="file" accept=".ico,.png,image/png,image/x-icon"
                 onChange={(e) => {
                   const f = e.target.files?.[0];
                   if (!f) return;
                   const r = new FileReader();
                   r.onload = () => onPatch({ faviconDataUrl: String(r.result || '') });
                   r.readAsDataURL(f);
                 }} />
          {value.faviconDataUrl && <img src={value.faviconDataUrl} alt="Favicon preview" style={{ marginTop: 6, width: 32, height: 32, borderRadius: 6, border: `1px solid ${T.border}` }} />}
        </FieldRow>

        <FieldRow label="Primary Colour" required labelTitle="Dominant brand colour used on headings, primary buttons, and charts.">
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="color" value={value.primary} onChange={(e) => onPatch({ primary: e.target.value })} style={{ width: 48, height: 38, padding: 0, border: `1px solid ${T.border}`, borderRadius: 8 }} />
            <input style={input()} value={value.primary} onChange={(e) => onPatch({ primary: e.target.value })} maxLength={9} placeholder="#0284C7" />
          </div>
        </FieldRow>
        <FieldRow label="Secondary Colour" required labelTitle="Supporting colour used for highlights, badges, and hover states.">
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="color" value={value.secondary} onChange={(e) => onPatch({ secondary: e.target.value })} style={{ width: 48, height: 38, padding: 0, border: `1px solid ${T.border}`, borderRadius: 8 }} />
            <input style={input()} value={value.secondary} onChange={(e) => onPatch({ secondary: e.target.value })} maxLength={9} placeholder="#0EA5E9" />
          </div>
        </FieldRow>
        <FieldRow label="Accent Colour" hint="Optional accent used for callouts." labelTitle="Optional third colour for callouts, ribbons, and promotional banners.">
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="color" value={value.accent} onChange={(e) => onPatch({ accent: e.target.value })} style={{ width: 48, height: 38, padding: 0, border: `1px solid ${T.border}`, borderRadius: 8 }} />
            <input style={input()} value={value.accent} onChange={(e) => onPatch({ accent: e.target.value })} maxLength={9} placeholder="#10B981" />
          </div>
        </FieldRow>

        <FieldRow label="Custom Domain" hint="Leave blank to stay on the default corpgms.ae subdomain." labelTitle="Vanity domain your tenants sign in through. DNS setup required.">
          <input style={input()} value={value.domain} onChange={(e) => onPatch({ domain: e.target.value.trim() })} placeholder="app.yourbrand.com" />
        </FieldRow>
        <FieldRow label="Email From Name" labelTitle="Display name shown as the sender on all outgoing platform emails.">
          <input style={input()} value={value.emailFromName} onChange={(e) => onPatch({ emailFromName: e.target.value.slice(0, 80) })} placeholder="CorpGMS Team" />
        </FieldRow>
        <FieldRow label="Email From Address" labelTitle="Email address all platform notifications are sent from.">
          <input style={input()} value={value.emailFromAddress} onChange={(e) => onPatch({ emailFromAddress: e.target.value.trim() })} placeholder="no-reply@corpgms.ae" />
        </FieldRow>

        <FieldRow wide label="Footer Text" hint="Shown at the bottom of every authenticated page." labelTitle="Copyright line shown in the footer of every page inside the app.">
          <textarea style={{ ...input(), resize: 'vertical', maxHeight: 120 }} value={value.footer} onChange={(e) => onPatch({ footer: e.target.value.slice(0, 200) })} rows={2} maxLength={200} placeholder="© 2026 CorpGMS — All rights reserved." />
          <p style={{ margin: '4px 0 0', fontSize: 10, color: T.muted, textAlign: 'right' }}>{(value.footer || '').length}/200</p>
        </FieldRow>
      </div>
    </>
  );
}

function PlansTab({ value, onPatch, onPersistPlans, showToast, featureCatalogue = DEFAULT_FEATURES }) {
  const { plans = [], pricing } = value;

  const [editorOpen, setEditorOpen]   = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);     /* null = add mode */
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [bulkDeleteTarget, setBulkDeleteTarget] = useState(null);
  /* Bug #8 — multi-select set keyed by plan id. */
  const [selectedPlanIds, setSelectedPlanIds] = useState(() => new Set());

  const togglePlanSelection = (id) => {
    setSelectedPlanIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelectedPlanIds(new Set());

  /* Org-count lookup used for the "X organisations on this plan" footer line.
   * Matched by plan name — the seed uses plan names as the foreign key. */
  const orgCountByPlan = useMemo(() => {
    const map = new Map();
    for (const o of MOCK_ORGANIZATIONS) {
      const k = String(o.plan || '').trim();
      if (!k) continue;
      map.set(k, (map.get(k) || 0) + 1);
    }
    /* Augment from PLATFORM_TOP_ORGS if present (more realistic totals). */
    return map;
  }, []);

  const updatePricing = (patch) => onPatch({ pricing: { ...pricing, ...patch } });
  const toggleDiscount = (code) => {
    const codes = (pricing?.discountCodes || []).map((c) => c.code === code ? { ...c, active: !c.active } : c);
    updatePricing({ discountCodes: codes });
  };

  const openAdd = () => { setEditingPlan(null); setEditorOpen(true); };
  const openEdit = (p) => { setEditingPlan(p); setEditorOpen(true); };

  const handleSavePlan = (saved) => {
    /* "Most popular" is mutually exclusive — clear it on every other plan
     * when this one is flagged. */
    let nextList = plans.some((p) => p.id === saved.id)
      ? plans.map((p) => (p.id === saved.id ? saved : p))
      : [...plans, saved];
    if (saved.mostPopular) {
      nextList = nextList.map((p) => (p.id === saved.id ? p : { ...p, mostPopular: false }));
    }
    const isUpdate = plans.some((p) => p.id === saved.id);
    (onPersistPlans || ((next) => onPatch({ plans: next })))(nextList);
    setEditorOpen(false);
    setEditingPlan(null);
    showToast?.(isUpdate ? 'Plan saved successfully.' : 'Plan created successfully.', 'success');
  };

  const handleDuplicate = (p) => {
    const suffix = Date.now().toString(36).slice(-4);
    const copy = {
      ...p,
      id:          `plan-${Date.now()}`,
      name:        `${p.name} - Copy`,
      code:        `${p.code || slugifyLocal(p.name)}-copy-${suffix}`,
      mostPopular: false,
      status:      'Draft',
    };
    /* Open the editor so the user must confirm/change name & code before saving.
     * This prevents duplicate plans from being added silently. */
    setEditingPlan(copy);
    setEditorOpen(true);
  };

  const handleRequestDelete = (p) => {
    const affected = orgCountByPlan.get(p.name) || 0;
    setDeleteTarget({ plan: p, affected });
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    const nextList = plans.filter((p) => p.id !== deleteTarget.plan.id);
    (onPersistPlans || ((next) => onPatch({ plans: next })))(nextList);
    showToast?.('Plan deleted successfully.', 'success');
    setDeleteTarget(null);
  };

  const handleBulkDelete = () => {
    const idsToDelete = new Set(selectedPlanIds);
    const nextList = plans.filter((p) => !idsToDelete.has(p.id));
    (onPersistPlans || ((next) => onPatch({ plans: next })))(nextList);
    showToast?.(
      `${idsToDelete.size} plan${idsToDelete.size === 1 ? '' : 's'} deleted successfully.`,
      'success',
    );
    clearSelection();
    setBulkDeleteTarget(null);
  };

  /* Names of selected plans, used for the confirmation modal copy. */
  const selectedPlanNames = plans
    .filter((p) => selectedPlanIds.has(p.id))
    .map((p) => p.name);

  return (
    <>
      <SectionHeader
        title="Plans & Pricing"
        subtitle="Subscription tiers, trial length, VAT, and discount codes."
        action={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {selectedPlanIds.size > 0 && (
              <>
                <span style={{ fontSize: 12, color: T.muted, alignSelf: 'center' }}>
                  {selectedPlanIds.size} selected
                </span>
                <button
                  style={btn(T.muted, true)}
                  onClick={clearSelection}
                  title="Clear selection"
                >
                  Clear
                </button>
                <button
                  style={btn(T.red)}
                  onClick={() => setBulkDeleteTarget(true)}
                  title={`Delete ${selectedPlanIds.size} selected plan${selectedPlanIds.size === 1 ? '' : 's'}`}
                >
                  Delete Plan{selectedPlanIds.size === 1 ? '' : 's'}
                </button>
              </>
            )}
            <button style={btn(T.purple)} onClick={openAdd} title="Add a new plan">+ Add New Plan</button>
          </div>
        }
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
        {plans.map((p) => (
          <PlanPreviewCard
            key={p.id}
            plan={p}
            orgCount={orgCountByPlan.get(p.name) || 0}
            selected={selectedPlanIds.has(p.id)}
            onToggleSelect={() => togglePlanSelection(p.id)}
            onEdit={() => openEdit(p)}
            onDuplicate={() => handleDuplicate(p)}
            onDelete={() => handleRequestDelete(p)}
          />
        ))}
      </div>

      <div style={{ ...card(), marginTop: 20 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: T.navy }}>Global Pricing</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginTop: 12 }}>
          <FieldRow label="Default Currency" required>
            <select style={input()} value={pricing.currency} onChange={(e) => updatePricing({ currency: e.target.value })}>
              {['INR', 'USD', 'GBP', 'SAR'].map((c) => <option key={c}>{c}</option>)}
            </select>
          </FieldRow>
          <FieldRow label="Tax Rate (%)" required hint="UAE VAT is 5.">
            <input type="number" step="0.1" min="0" max="100" style={input()} value={pricing.taxRate} onChange={(e) => updatePricing({ taxRate: Number(e.target.value) })} />
          </FieldRow>
          <FieldRow label="Grace After Failed Payment (days)" required>
            <input type="number" min="0" max="60" style={input()} value={pricing.graceDays} onChange={(e) => updatePricing({ graceDays: Number(e.target.value) })} />
          </FieldRow>
          <FieldRow label="Default Trial Length (days)" required>
            <input type="number" min="0" max="90" style={input()} value={pricing.trialDays} onChange={(e) => updatePricing({ trialDays: Number(e.target.value) })} />
          </FieldRow>
        </div>
        <h4 style={{ margin: '20px 0 8px', fontSize: 13, fontWeight: 800, color: T.navy }}>Discount Codes</h4>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: T.muted, fontSize: 11, textTransform: 'uppercase' }}>
                <th style={{ paddingBottom: 8 }}>Code</th>
                <th style={{ paddingBottom: 8 }}>Discount</th>
                <th style={{ paddingBottom: 8 }}>Valid Until</th>
                <th style={{ paddingBottom: 8 }}>Usage</th>
                <th style={{ paddingBottom: 8 }}>Active</th>
              </tr>
            </thead>
            <tbody>
              {(pricing.discountCodes || []).map((c) => (
                <tr key={c.code} style={{ borderTop: `1px solid ${T.border}` }}>
                  <td style={{ padding: '8px 0', fontWeight: 700, color: T.navy }}>{c.code}</td>
                  <td>{c.percent}%</td>
                  <td>{new Date(c.validUntil).toLocaleDateString('en-GB')}</td>
                  <td>{c.usage}</td>
                  <td><Toggle checked={c.active} onChange={() => toggleDiscount(c.code)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Plan editor + delete confirm modals */}
      <PlanEditorModal
        open={editorOpen}
        plan={editingPlan}
        existingPlans={plans}
        featureCatalogue={featureCatalogue}
        onClose={() => { setEditorOpen(false); setEditingPlan(null); }}
        onSave={handleSavePlan}
      />
      {deleteTarget && (
        <ConfirmModal
          title="Delete Plan"
          message={`Are you sure you want to delete the ${deleteTarget.plan.name} plan? ${deleteTarget.affected} organisation${deleteTarget.affected === 1 ? '' : 's'} ${deleteTarget.affected === 1 ? 'is' : 'are'} on this plan and will be affected.`}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
      {bulkDeleteTarget && (
        <ConfirmModal
          title={`Delete ${selectedPlanIds.size} Plan${selectedPlanIds.size === 1 ? '' : 's'}`}
          message={`Are you sure you want to delete ${selectedPlanIds.size === 1 ? 'this plan' : `these ${selectedPlanIds.size} plans`}: ${selectedPlanNames.join(', ')}? Organisations currently on ${selectedPlanIds.size === 1 ? 'this plan' : 'these plans'} will be affected.`}
          onConfirm={handleBulkDelete}
          onCancel={() => setBulkDeleteTarget(null)}
        />
      )}
    </>
  );
}

/* Plan card — preview-only, all edits happen in PlanEditorModal. */
function PlanPreviewCard({ plan, orgCount, onEdit, onDuplicate, onDelete, selected, onToggleSelect }) {
  const monthly = Number(plan.monthly) || 0;
  const yearly  = Number(plan.yearly)  || 0;
  const discountPct = monthly > 0 && yearly > 0
    ? Math.max(0, Math.round((1 - (yearly / (monthly * 12))) * 100))
    : 0;
  const features = Array.isArray(plan.features) ? plan.features : [];
  const first4 = features.slice(0, 4);
  const remaining = Math.max(0, features.length - 4);

  const formatAmount = (n) => Number(n || 0).toLocaleString('en-GB');
  const limitPart = (key, unit) => {
    const v = plan[key];
    if (v === null || v === undefined) return `Unlimited ${unit}`;
    return `${formatAmount(v)} ${unit}`;
  };

  const status = plan.status || 'Active';
  const statusStyle = {
    Active:   { bg: 'rgba(5,150,105,0.12)',  color: '#059669', border: 'rgba(5,150,105,0.3)'  },
    Draft:    { bg: 'rgba(37,99,235,0.12)',  color: '#3B82F6', border: 'rgba(37,99,235,0.3)'  },
    Archived: { bg: 'rgba(100,116,139,0.12)', color: '#94A3B8', border: 'rgba(100,116,139,0.3)' },
  }[status] || { bg: 'rgba(100,116,139,0.12)', color: '#94A3B8', border: 'rgba(100,116,139,0.3)' };

  const accent = plan.badgeColour || T.purple;

  return (
    <div style={{
      position: 'relative',
      background: selected ? 'rgba(2,132,199,0.06)' : 'var(--app-surface)',
      border: `1px solid ${selected ? T.purple : 'var(--app-border)'}`,
      borderLeft: `4px solid ${accent}`, borderRadius: 14, padding: 20,
      boxShadow: '0 1px 2px rgba(15,23,42,0.04)', display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      {onToggleSelect && (
        <input
          type="checkbox"
          checked={Boolean(selected)}
          onChange={onToggleSelect}
          aria-label={`Select ${plan.name} for bulk action`}
          title={`Select ${plan.name}`}
          style={{ position: 'absolute', top: 12, left: 12, width: 16, height: 16, cursor: 'pointer' }}
        />
      )}
      {plan.mostPopular && (
        <span style={{
          position: 'absolute', top: -10, left: 16,
          background: accent, color: '#fff', fontSize: 10, fontWeight: 800,
          padding: '3px 10px', borderRadius: 20, letterSpacing: '.05em',
        }}>⭐ Most Popular</span>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: T.navy, fontFamily: T.font }}>{plan.name}</h3>
          <div style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 10px', borderRadius: 20,
                        background: statusStyle.bg, color: statusStyle.color, border: `1px solid ${statusStyle.border}`,
                        fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em' }}>
            {status}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button type="button" onClick={onEdit}      title={`Edit ${plan.name}`}      aria-label={`Edit ${plan.name}`}
                  style={iconBtnCls}><Pencil size={14} aria-hidden="true" /></button>
          <button type="button" onClick={onDuplicate} title={`Duplicate ${plan.name}`} aria-label={`Duplicate ${plan.name}`}
                  style={iconBtnCls}><Copy size={14} aria-hidden="true" /></button>
          <button type="button" onClick={onDelete}    title={`Delete ${plan.name}`}    aria-label={`Delete ${plan.name}`}
                  style={{ ...iconBtnCls, color: T.red, borderColor: 'rgba(220,38,38,0.3)', background: 'rgba(220,38,38,0.08)' }}>
            <Trash2 size={14} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div>
        <div style={{ fontSize: 22, fontWeight: 900, color: T.navy, fontFamily: T.font }}>
          ₹{formatAmount(monthly)} <span style={{ fontSize: 12, fontWeight: 600, color: T.muted }}>per Month</span>
        </div>
        {yearly > 0 && (
          <div style={{ marginTop: 2, fontSize: 12, color: T.muted }}>
            or ₹{formatAmount(yearly)} per Year{discountPct > 0 && ` · Saves ${discountPct}%`}
          </div>
        )}
      </div>

      <div style={{ height: 1, background: T.border }} />

      <div style={{ fontSize: 12, color: T.text, fontWeight: 600 }}>
        {[
          limitPart('maxUsers',     'users'),
          limitPart('maxOffices',   plan.maxOffices === 1 ? 'office' : 'offices'),
          limitPart('maxVisitors',  'visitors/month'),
          limitPart('maxStorageGb', 'GB storage'),
        ].join(' · ')}
      </div>

      {features.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {first4.map((f) => (
            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.text }}>
              <span style={{ color: '#059669' }} aria-hidden="true">✓</span>{f}
            </div>
          ))}
          {remaining > 0 && (
            <button type="button" onClick={onEdit}
                    style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: T.purple, fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0 }}
                    title={`View all ${features.length} features`}>
              + {remaining} more
            </button>
          )}
        </div>
      )}

      <div style={{ marginTop: 'auto', fontSize: 11, color: T.muted }}>
        {plan.trialDays > 0
          ? `${plan.trialDays}-day free trial · ${plan.requiresCard ? 'Card required' : 'No card required'}`
          : 'No free trial'}
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, borderTop: `1px dashed ${T.border}`, paddingTop: 8 }}>
        {orgCount} organisation{orgCount === 1 ? '' : 's'} on this plan
      </div>
    </div>
  );
}

const iconBtnCls = {
  width: 30, height: 30, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: 8, border: `1px solid var(--app-border)`, background: 'var(--app-surface)', color: 'var(--app-text-muted)', cursor: 'pointer',
};

function slugifyLocal(name) {
  return String(name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

function SecurityTab({ value, onPatch }) {
  return (
    <>
      <SectionHeader title="Security Policies" subtitle="Password rules, 2FA, sessions, and audit retention." />

      {/* ── Password Policy ── */}
      <h4 style={sectionSubHeadCls} title="Rules applied at sign-up and password change.">Password Policy</h4>
      <div style={{ ...card(), display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginBottom: 18 }}>
        <FieldRow
          label="Minimum Password Length" required
          labelTitle="The minimum number of characters a password must contain."
        >
          <input type="number" min="6" max="20" style={input()} value={value.minPasswordLength} onChange={(e) => onPatch({ minPasswordLength: Number(e.target.value) })} />
        </FieldRow>
        <FieldRow
          label="Password Expiry (days)" required hint="0 = never expires."
          labelTitle="Days before users must change their password. Set to 0 to disable expiry."
        >
          <input type="number" min="0" max="365" style={input()} value={value.passwordExpiryDays} onChange={(e) => onPatch({ passwordExpiryDays: Number(e.target.value) })} />
        </FieldRow>
        <FieldRow
          label="Password History" required hint="Prevent reuse of last N passwords."
          labelTitle="Prevent users from reusing their last N passwords."
        >
          <input type="number" min="0" max="20" style={input()} value={value.passwordHistory} onChange={(e) => onPatch({ passwordHistory: Number(e.target.value) })} />
        </FieldRow>
        <FieldRow wide label="Complexity rules" labelTitle="Character classes that every password must contain.">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
            <Toggle checked={value.requireUppercase} onChange={(v) => onPatch({ requireUppercase: v })} label="Require uppercase"         title="At least one uppercase letter required in every password." />
            <Toggle checked={value.requireNumber}    onChange={(v) => onPatch({ requireNumber: v })}    label="Require number"             title="At least one digit required in every password." />
            <Toggle checked={value.requireSpecial}   onChange={(v) => onPatch({ requireSpecial: v })}   label="Require special character"  title="At least one symbol (e.g. !@#$) required in every password." />
          </div>
        </FieldRow>
      </div>

      {/* ── Session & Login ── */}
      <h4 style={sectionSubHeadCls} title="Authentication and lockout behaviour.">Session &amp; Login</h4>
      <div style={{ ...card(), display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginBottom: 18 }}>
        <FieldRow
          label="2FA Enforcement" required
          labelTitle="Require second-factor authentication for user logins."
        >
          <select style={input()} value={value.twoFA} onChange={(e) => onPatch({ twoFA: e.target.value })}>
            <option>Optional</option>
            <option>Required for Admin</option>
            <option>Required for All</option>
          </select>
        </FieldRow>
        <FieldRow
          label="Session Timeout (mins)" required
          labelTitle="How long an idle user remains signed in before automatic sign-out."
        >
          <select style={input()} value={value.sessionTimeoutMins} onChange={(e) => onPatch({ sessionTimeoutMins: Number(e.target.value) })}>
            {[15, 30, 60, 120, 480].map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </FieldRow>
        <FieldRow
          label="Max Login Attempts" required
          labelTitle="How many failed sign-in attempts are allowed before an account is locked."
        >
          <input type="number" min="1" max="20" style={input()} value={value.maxLoginAttempts} onChange={(e) => onPatch({ maxLoginAttempts: Number(e.target.value) })} />
        </FieldRow>
        <FieldRow
          label="Lockout Duration (mins)" required
          labelTitle="How long an account is locked after exceeding max login attempts."
        >
          <input type="number" min="1" max="1440" style={input()} value={value.lockoutMins} onChange={(e) => onPatch({ lockoutMins: Number(e.target.value) })} />
        </FieldRow>
      </div>

      {/* ── Access & Audit ── */}
      <h4 style={sectionSubHeadCls} title="Network-level access and audit log retention.">Access &amp; Audit</h4>
      <div style={{ ...card(), display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
        <FieldRow
          label="Audit Log Retention (days)" required
          labelTitle="How many days audit log entries are kept before automatic deletion."
        >
          <input type="number" min="30" max="3650" style={input()} value={value.auditRetentionDays} onChange={(e) => onPatch({ auditRetentionDays: Number(e.target.value) })} />
        </FieldRow>
        <FieldRow
          wide label="IP Allowlist"
          hint="One IP per line. Leave empty to allow all."
          labelTitle="Restrict platform sign-in to these IPs or CIDR ranges. Leave empty to allow all."
        >
          <textarea style={{ ...input(), resize: 'vertical', maxHeight: 140, fontFamily: 'monospace' }} rows={4} value={value.ipAllowlist} onChange={(e) => onPatch({ ipAllowlist: e.target.value })} placeholder="One IP per line. Leave empty to allow all." />
        </FieldRow>
      </div>
    </>
  );
}

const sectionSubHeadCls = {
  margin: '0 0 10px',
  fontSize: 12,
  fontWeight: 800,
  color: '#0284C7',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
};

/* Country → default timezone + currency mapping */
const COUNTRY_META = {
  'United Arab Emirates': { timezones: ['Asia/Dubai'],                                        currency: 'AED', weekStart: 'Sunday',  lang: 'Arabic'  },
  'India':                { timezones: ['Asia/Kolkata'],                                       currency: 'INR', weekStart: 'Monday',  lang: 'Hindi'   },
  'Saudi Arabia':         { timezones: ['Asia/Riyadh'],                                        currency: 'SAR', weekStart: 'Sunday',  lang: 'Arabic'  },
  'Qatar':                { timezones: ['Asia/Qatar'],                                         currency: 'QAR', weekStart: 'Sunday',  lang: 'Arabic'  },
  'Oman':                 { timezones: ['Asia/Muscat'],                                        currency: 'OMR', weekStart: 'Sunday',  lang: 'Arabic'  },
  'Kuwait':               { timezones: ['Asia/Kuwait'],                                        currency: 'KWD', weekStart: 'Sunday',  lang: 'Arabic'  },
  'Bahrain':              { timezones: ['Asia/Bahrain'],                                       currency: 'BHD', weekStart: 'Sunday',  lang: 'Arabic'  },
  'United States':        { timezones: ['America/New_York','America/Chicago','America/Denver','America/Los_Angeles','America/Anchorage','Pacific/Honolulu'], currency: 'USD', weekStart: 'Sunday',  lang: 'English' },
  'United Kingdom':       { timezones: ['Europe/London'],                                      currency: 'GBP', weekStart: 'Monday',  lang: 'English' },
  'Germany':              { timezones: ['Europe/Berlin'],                                      currency: 'EUR', weekStart: 'Monday',  lang: 'English' },
  'France':               { timezones: ['Europe/Paris'],                                       currency: 'EUR', weekStart: 'Monday',  lang: 'English' },
  'Singapore':            { timezones: ['Asia/Singapore'],                                     currency: 'SGD', weekStart: 'Monday',  lang: 'English' },
  'Australia':            { timezones: ['Australia/Sydney','Australia/Melbourne','Australia/Brisbane','Australia/Perth'], currency: 'AUD', weekStart: 'Monday', lang: 'English' },
  'Canada':               { timezones: ['America/Toronto','America/Vancouver','America/Winnipeg'], currency: 'CAD', weekStart: 'Sunday', lang: 'English' },
  'Japan':                { timezones: ['Asia/Tokyo'],                                         currency: 'JPY', weekStart: 'Monday',  lang: 'English' },
  'China':                { timezones: ['Asia/Shanghai'],                                      currency: 'CNY', weekStart: 'Monday',  lang: 'English' },
  'Pakistan':             { timezones: ['Asia/Karachi'],                                       currency: 'PKR', weekStart: 'Monday',  lang: 'English' },
  'Bangladesh':           { timezones: ['Asia/Dhaka'],                                         currency: 'BDT', weekStart: 'Monday',  lang: 'English' },
  'Sri Lanka':            { timezones: ['Asia/Colombo'],                                       currency: 'LKR', weekStart: 'Monday',  lang: 'English' },
  'Nepal':                { timezones: ['Asia/Kathmandu'],                                     currency: 'NPR', weekStart: 'Monday',  lang: 'English' },
  'Egypt':                { timezones: ['Africa/Cairo'],                                       currency: 'EGP', weekStart: 'Sunday',  lang: 'Arabic'  },
  'Jordan':               { timezones: ['Asia/Amman'],                                         currency: 'JOD', weekStart: 'Sunday',  lang: 'Arabic'  },
  'Lebanon':              { timezones: ['Asia/Beirut'],                                        currency: 'LBP', weekStart: 'Monday',  lang: 'Arabic'  },
  'Turkey':               { timezones: ['Europe/Istanbul'],                                    currency: 'TRY', weekStart: 'Monday',  lang: 'English' },
  'South Africa':         { timezones: ['Africa/Johannesburg'],                                currency: 'ZAR', weekStart: 'Monday',  lang: 'English' },
  'Nigeria':              { timezones: ['Africa/Lagos'],                                       currency: 'NGN', weekStart: 'Monday',  lang: 'English' },
  'Kenya':                { timezones: ['Africa/Nairobi'],                                     currency: 'KES', weekStart: 'Monday',  lang: 'English' },
};

const ALL_COUNTRIES = Object.keys(COUNTRY_META).sort();

function RegionalTab({ value, onPatch }) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  /* When country changes → auto-set timezone and week start (currency fixed to INR) */
  const handleCountryChange = (country) => {
    const meta = COUNTRY_META[country];
    if (meta) {
      onPatch({
        country,
        timezone: meta.timezones[0],
        weekStart: meta.weekStart,
        currency: 'INR', // ✅ Always INR internally
      });
    } else {
      onPatch({
        country,
        currency: 'INR',
      });
    }
  };

  const availableTimezones =
    COUNTRY_META[value.country]?.timezones ||
    [value.timezone].filter(Boolean);

  return (
    <>
      <SectionHeader
        title="Regional Defaults"
        subtitle="Country, timezone, date/time format, and working week."
      />

      <div
        style={{
          ...card(),
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 12,
        }}
      >
        {/* Country */}
        <FieldRow
          label="Default Country*"
          labelTitle="Changing country auto-updates timezone and week start."
        >
          <select
            style={input()}
            value={value.country}
            onChange={(e) => handleCountryChange(e.target.value)}
          >
            {ALL_COUNTRIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </FieldRow>

        {/* Timezone */}
        <FieldRow
          label="Default Timezone*"
          labelTitle="Auto-set when country changes. Override manually if needed."
        >
          <select
            style={input()}
            value={value.timezone}
            onChange={(e) => onPatch({ timezone: e.target.value })}
          >
            {availableTimezones.map((tz) => (
              <option key={tz}>{tz}</option>
            ))}
          </select>

          {availableTimezones.length > 1 && (
            <p
              style={{
                margin: '4px 0 0',
                fontSize: 11,
                color: '#94A3B8',
              }}
            >
              {availableTimezones.length} timezones available for this country.
            </p>
          )}
        </FieldRow>

        {/* Date Format */}
        <FieldRow
          label="Default Date Format*"
          labelTitle="How dates render across tables, forms, and exports."
        >
          <select
            style={input()}
            value={value.dateFormat}
            onChange={(e) => onPatch({ dateFormat: e.target.value })}
          >
            {['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </FieldRow>

        {/* Time Format */}
        <FieldRow
          label="Default Time Format*"
          labelTitle="12-hour shows AM/PM; 24-hour shows 00–23."
        >
          <div style={{ display: 'flex', gap: 16 }}>
            <label style={{ fontSize: 13 }}>
              <input
                type="radio"
                name="timefmt"
                checked={value.timeFormat === '12h'}
                onChange={() => onPatch({ timeFormat: '12h' })}
              />{' '}
              12-hour AM/PM
            </label>

            <label style={{ fontSize: 13 }}>
              <input
                type="radio"
                name="timefmt"
                checked={value.timeFormat === '24h'}
                onChange={() => onPatch({ timeFormat: '24h' })}
              />{' '}
              24-hour
            </label>
          </div>
        </FieldRow>

        {/* Language */}
        <FieldRow
          label="Default Language*"
          labelTitle="Language used for UI labels when a tenant has not set their own."
        >
          <select
            style={input()}
            value={value.language}
            onChange={(e) => onPatch({ language: e.target.value })}
          >
            {['English', 'Arabic', 'Hindi'].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </FieldRow>

        {/* Currency */}
        <FieldRow
          label="Default Currency"
          hint="Inherited from Plans → Pricing."
          labelTitle="Inherited from Plans → Pricing. Change it there to update everywhere."
        >
          <input
            style={{ ...input(), background: 'var(--app-surface-muted)', opacity: 0.7 }}
            value="₹"   // ✅ Always show ₹ (no mix bug)
            readOnly
          />
        </FieldRow>

        {/* Week Start */}
        <FieldRow
          label="Working Week Start*"
          hint="UAE week starts Sunday."
          labelTitle="The first day of every calendar week across schedules and reports."
        >
          <select
            style={input()}
            value={value.weekStart}
            onChange={(e) => onPatch({ weekStart: e.target.value })}
          >
            {['Sunday', 'Monday', 'Saturday'].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </FieldRow>

        {/* Working Days */}
        <FieldRow
          wide
          label="Working Days"
          labelTitle="Days counted as working days when computing room utilisation and reports."
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            {days.map((d) => (
              <Toggle
                key={d}
                checked={value.workingDays?.[d]}
                onChange={(v) =>
                  onPatch({
                    workingDays: {
                      ...(value.workingDays || {}),
                      [d]: v,
                    },
                  })
                }
                label={d}
              />
            ))}
          </div>
        </FieldRow>
      </div>
    </>
  );
}

function FeatureFlagsTab({ value, onPatch }) {
  const flags = value.flagsByPlan || {};
  const toggleFlag = (feat, plan) => {
    const current = flags[feat] || { Starter: false, Professional: false, Enterprise: false };
    onPatch({ flagsByPlan: { ...flags, [feat]: { ...current, [plan]: !current[plan] } } });
  };
  const toggleGlobal = (key, v) => {
    onPatch({ global: { ...(value.global || {}), [key]: v } });
  };

  return (
    <>
      <SectionHeader title="Feature Flags" subtitle="Map features to tiers and toggle platform-wide switches." />
      <div style={{ ...card(), overflowX: 'auto' }}>
        <table style={{ width: '100%', fontSize: 13, minWidth: 400 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: T.muted, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <th style={{ paddingBottom: 10 }}>Feature</th>
              {DEFAULT_PLAN_SLOTS.map((p) => <th key={p} style={{ paddingBottom: 10, textAlign: 'center' }}>{p}</th>)}
            </tr>
          </thead>
          <tbody>
            {DEFAULT_FEATURES.map((feat) => (
              <tr key={feat} style={{ borderTop: `1px solid ${T.border}` }}>
                <td style={{ padding: '10px 0', fontWeight: 600, color: T.navy }}>{feat}</td>
                {DEFAULT_PLAN_SLOTS.map((p) => (
                  <td key={p} style={{ textAlign: 'center' }}>
                    <input type="checkbox"
                           checked={Boolean(flags[feat]?.[p])}
                           onChange={() => toggleFlag(feat, p)}
                           title={`${flags[feat]?.[p] ? 'Disable' : 'Enable'} ${feat} on ${p}`} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ ...card(), marginTop: 20 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: T.navy }}>Global Toggles</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
          <Toggle checked={value.global?.registrationOpen} onChange={(v) => toggleGlobal('registrationOpen', v)} label="Enable new user registration" title="Allow companies to sign up from the marketing site" />
          <Toggle checked={value.global?.publicApi}        onChange={(v) => toggleGlobal('publicApi', v)}        label="Enable public API"                 title="Expose the REST API to tenants" />
          <Toggle checked={value.global?.marketingSite}    onChange={(v) => toggleGlobal('marketingSite', v)}    label="Enable marketing site"             title="Serve the public landing page" />
          <Toggle checked={value.global?.betaOptIn}        onChange={(v) => toggleGlobal('betaOptIn', v)}        label="Beta programme opt-in"              title="Offer experimental features to opted-in tenants" />
        </div>
      </div>
    </>
  );
}

function MaintenanceTab({ value, onPatch, onRunAction }) {
  return (
    <>
      <SectionHeader title="Maintenance" subtitle="Maintenance windows, system banner, and emergency controls." />
      {value.mode && (
        <div style={{ ...card({ borderColor: T.red, background: 'rgba(220,38,38,0.08)', padding: 14 }), marginBottom: 14, color: T.red, fontWeight: 700, fontSize: 13 }}>
          ⚠ Maintenance mode is currently ENABLED — tenants will see the maintenance page.
        </div>
      )}
      <div style={{ ...card(), display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <FieldRow wide label="Maintenance Mode" labelTitle="When on, every tenant login is replaced with the maintenance page.">
          <Toggle checked={value.mode} onChange={(v) => onPatch({ mode: v })} label="Enable maintenance mode" title="Lock out tenants while you work." />
        </FieldRow>
        <FieldRow wide label="Maintenance Message" required hint="Shown to users while maintenance is on." labelTitle="Copy shown to every tenant while maintenance mode is active.">
          <textarea style={{ ...input(), resize: 'vertical', maxHeight: 160 }} rows={3} value={value.message} onChange={(e) => onPatch({ message: e.target.value.slice(0, 500) })} maxLength={500} />
          <p style={{ margin: '4px 0 0', fontSize: 10, color: T.muted, textAlign: 'right' }}>{(value.message || '').length}/500</p>
        </FieldRow>
        <FieldRow label="Scheduled Start Date" labelTitle="Day the maintenance window begins.">
          <input type="date" style={input()} value={value.scheduleStartDate} onChange={(e) => onPatch({ scheduleStartDate: e.target.value })} />
        </FieldRow>
        <FieldRow label="Scheduled Start Time" labelTitle="Clock time the maintenance window begins (platform timezone).">
          <input type="time" style={input()} value={value.scheduleStartTime} onChange={(e) => onPatch({ scheduleStartTime: e.target.value })} />
        </FieldRow>
        <FieldRow label="Scheduled End Date" labelTitle="Day the maintenance window ends and service resumes.">
          <input type="date" style={input()} value={value.scheduleEndDate} onChange={(e) => onPatch({ scheduleEndDate: e.target.value })} />
        </FieldRow>
        <FieldRow label="Scheduled End Time" labelTitle="Clock time the maintenance window ends (platform timezone).">
          <input type="time" style={input()} value={value.scheduleEndTime} onChange={(e) => onPatch({ scheduleEndTime: e.target.value })} />
        </FieldRow>
        <FieldRow label="Notify Users Before" labelTitle="How far in advance of maintenance to notify every tenant.">
          <select style={input()} value={value.notifyBefore} onChange={(e) => onPatch({ notifyBefore: e.target.value })}>
            {['24h', '12h', '1h', 'None'].map((c) => <option key={c}>{c}</option>)}
          </select>
        </FieldRow>
      </div>

      <div style={{ ...card(), marginTop: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <FieldRow wide label="System Banner Message" hint="Shows at the top of every authenticated page." labelTitle="Shown in a banner at the top of every signed-in page across the platform.">
          <textarea style={{ ...input(), resize: 'vertical', maxHeight: 120 }} rows={2} value={value.bannerMessage} onChange={(e) => onPatch({ bannerMessage: e.target.value.slice(0, 200) })} maxLength={200} />
        </FieldRow>
        <FieldRow label="System Banner Severity" labelTitle="Colour of the banner: Info (blue), Warning (amber), Critical (red).">
          <select style={input()} value={value.bannerSeverity} onChange={(e) => onPatch({ bannerSeverity: e.target.value })}>
            {['Info', 'Warning', 'Critical'].map((c) => <option key={c}>{c}</option>)}
          </select>
        </FieldRow>
      </div>

      <div style={{ ...card(), marginTop: 20 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: T.navy }}>Emergency Actions</h3>
        <p style={{ margin: '4px 0 14px', fontSize: 12, color: T.muted }}>These are irreversible. Each action prompts for confirmation.</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button style={btn(T.red, true)} title="Force-reset all user passwords" onClick={() => onRunAction('force-password-reset', 'Force-reset passwords for every user?')}>Force Password Reset — All Users</button>
          <button style={btn(T.red, true)} title="Force-logout every active session"   onClick={() => onRunAction('force-logout',         'Log everyone out immediately?')}>Force Logout — All Sessions</button>
          <button style={btn(T.amber, true)} title="Clear platform caches"               onClick={() => onRunAction('clear-cache',          'Clear all platform caches?')}>Clear Cache</button>
          <button style={btn(T.blue, true)} title="Trigger an immediate backup"          onClick={() => onRunAction('trigger-backup',        'Trigger a backup now?')}>Trigger Backup Now</button>
        </div>
      </div>
    </>
  );
}

/* ─── Main component ─── */

const TABS = [
  { id: 'branding',    label: 'Platform Branding' },
  { id: 'plans',       label: 'Plans & Pricing' },
  { id: 'security',    label: 'Security Policies' },
  { id: 'regional',    label: 'Regional Defaults' },
  { id: 'features',    label: 'Feature Flags' },
  { id: 'emails',      label: 'Email Templates' },
  { id: 'maintenance', label: 'Maintenance' },
];

export default function SuperAdminSettings() {
  const { user } = useAuth();
  const [stored, , , , replace] = useCollection(STORAGE_KEYS.PLATFORM_SETTINGS, defaultPlatformSettings());
  const [staff, , updateStaff] = useCollection(STORAGE_KEYS.STAFF, MOCK_STAFF);
  const persisted = useMemo(() => mergeWithDefaults(stored), [stored]);

  const [active, setActive] = useState('branding');
  const [draft, setDraft] = useState(persisted);
  const [toast, setToast] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [pendingTab, setPendingTab] = useState(null);

  /* Internal-write flag: when WE persist a partial change (e.g. plan
   * add/edit/delete) we don't want the persisted-sync effect to clobber
   * other unsaved draft edits. Cross-tab writes still flow through. */
  const internalWriteRef = useRef(false);

  /* Keep draft in sync when another tab writes to storage. */
  useEffect(() => {
    if (internalWriteRef.current) {
      internalWriteRef.current = false;
      return;
    }
    setDraft(persisted);
  }, [persisted]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(persisted);

  const patchSection = (section) => (patch) => {
    setDraft((prev) => ({ ...prev, [section]: { ...prev[section], ...patch } }));
  };

  /* Persist plan add/edit/delete immediately. The plan modals declare success
   * with a toast, so the change must survive a refresh without requiring the
   * top-level "Save Changes" button. We write only the plans field through to
   * storage so any unsaved edits on other tabs are preserved. */
  const persistPlans = (nextPlans) => {
    setDraft((prev) => ({ ...prev, plans: nextPlans }));
    internalWriteRef.current = true;
    replace({ ...persisted, plans: nextPlans });
  };

  const handleSave = async () => {
    /* Detect a change to the password expiry policy BEFORE we replace
     * the stored payload, so we know whether to fire expiry emails. We
     * fire whenever the security tab's expiryDays > 0 either changed
     * just now OR was already configured but no users have been
     * notified yet (idempotency lives on each staff record). */
    const prevExpiry = Number(persisted.security?.passwordExpiryDays || 0);
    const nextExpiry = Number(draft.security?.passwordExpiryDays || 0);
    const expiryChanged = prevExpiry !== nextExpiry;

    replace(draft);
    setToast({ msg: 'Settings saved successfully.', type: 'success' });
    addAuditLog({
      userName:    user?.name || 'Super Admin',
      role:        'superadmin',
      action:      'UPDATE',
      module:      'Platform Settings',
      description: `Saved platform settings (${active} tab touched last).`,
    });

    /* Password expiry dispatch — mirrors backend
     * dispatchPasswordExpiryWarnings. We check on every save so an
     * admin who lowers the threshold (e.g. 180 → 90) immediately
     * notifies users who newly fall outside the window. The 24-hour
     * dedupe stamp on each staff record prevents duplicate emails. */
    if (nextExpiry > 0) {
      try {
        const orgsById = (MOCK_ORGANIZATIONS || []).reduce((acc, o) => {
          if (o?.id) acc[o.id] = o;
          return acc;
        }, {});
        const result = await dispatchPasswordExpiryEmails({
          staff,
          expiryDays: nextExpiry,
          updateStaff,
          orgsById,
        });
        if (result.candidates > 0) {
          const summary = `${result.sent}/${result.candidates} sent` +
            (result.failed ? `, ${result.failed} failed` : '') +
            (result.skipped ? `, ${result.skipped} skipped (SMTP)` : '');
          setToast({
            msg: result.sent > 0
              ? `Password expiry emails: ${summary}.`
              : `Password expiry: ${summary}.`,
            type: result.failed && !result.sent ? 'error' : 'success',
          });
          addAuditLog({
            userName:    user?.name || 'Super Admin',
            role:        'superadmin',
            action:      'EMAIL',
            module:      'Platform Settings',
            description: `Password expiry policy ${expiryChanged ? 'changed to ' + nextExpiry : 'enforced at ' + nextExpiry} days — ${summary}.`,
          });
        } else if (expiryChanged) {
          /* Threshold updated but no one is currently over the limit
           * (or all eligible users were already notified within 24h).
           * Stay quiet to avoid noise. */
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[SuperAdminSettings] password-expiry dispatch failed:', err);
      }
    }
  };

  const handleDiscard = () => {
    setConfirm({
      kind: 'discard',
      title: 'Discard Changes',
      message: 'Are you sure you want to discard all unsaved changes?',
      onConfirm: () => {
        setDraft(persisted);
        setConfirm(null);
        setToast({ msg: 'Changes discarded.', type: 'info' });
      },
    });
  };

  const switchTab = (id) => {
    if (id === active) return;
    if (dirty) {
      setPendingTab(id);
      setConfirm({
        kind: 'tab-switch',
        title: 'Unsaved changes',
        message: 'You have unsaved changes on this tab. Switch anyway?',
        onConfirm: () => { setActive(id); setConfirm(null); setPendingTab(null); },
      });
    } else {
      setActive(id);
    }
  };

  const runAction = (key, prompt) => {
    setConfirm({
      kind: 'maintenance-action',
      title: 'Confirm emergency action',
      message: prompt,
      onConfirm: () => {
        setConfirm(null);
        setToast({ msg: `Action queued: ${key}.`, type: 'success' });
        addAuditLog({
          userName:    user?.name || 'Super Admin',
          role:        'superadmin',
          action:      'EMERGENCY',
          module:      'Platform Settings',
          description: `Triggered emergency action "${key}".`,
        });
      },
    });
  };

  return (
<div style={{ padding: 28, background: 'var(--app-bg)', minHeight: '100vh', fontFamily: T.font }}>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {confirm && (
        <ConfirmModal
          title={confirm.title}
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onCancel={() => { setConfirm(null); setPendingTab(null); }}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: T.navy, fontFamily: T.font }}>Settings</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: T.muted }}>Platform-wide configuration for the SaaS owner.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={btn(T.muted, true, !dirty)} onClick={handleDiscard} disabled={!dirty} title={dirty ? 'Discard unsaved changes' : 'No changes to discard'}>Discard</button>
          <button style={btn(T.purple, false, !dirty)} onClick={handleSave} disabled={!dirty} title={dirty ? 'Save changes' : 'No changes to save'}>Save Changes</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {TABS.map((t) => {
          const on = active === t.id;
          return (
            <button key={t.id} onClick={() => switchTab(t.id)}
                    style={{ padding: '8px 16px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: T.font,
                             background: on ? T.purple : 'var(--app-surface)', color: on ? '#fff' : 'var(--app-text-muted)',
                             border: `1.5px solid ${on ? T.purple : T.border}` }}>
              {t.label}
            </button>
          );
        })}
      </div>

      {active === 'branding'    && <BrandingTab       value={draft.branding}    onPatch={patchSection('branding')} />}
      {active === 'plans'       && <PlansTab          value={draft}             onPatch={(p) => setDraft((prev) => ({ ...prev, ...p }))} onPersistPlans={persistPlans} showToast={(msg, type) => setToast({ msg, type })} featureCatalogue={DEFAULT_FEATURES} />}
      {active === 'security'    && <SecurityTab       value={draft.security}    onPatch={patchSection('security')} />}
      {active === 'regional'    && <RegionalTab       value={{ ...draft.regional, currency: draft.pricing?.currency || 'INR' }} onPatch={patchSection('regional')} />}
      {active === 'features'    && <FeatureFlagsTab   value={draft.features}    onPatch={patchSection('features')} />}
      {active === 'emails'      && <EmailTemplates />}
      {active === 'maintenance' && <MaintenanceTab    value={draft.maintenance} onPatch={patchSection('maintenance')} onRunAction={runAction} />}
    </div>
  );
}