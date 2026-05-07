import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';

/**
 * PlanEditorModal — Add/Edit a subscription plan inside the Super Admin
 * Settings surface. Scope is intentionally broader than the older
 * Subscription/CreatePlanModal (it adds code, description, limits with
 * Unlimited toggles, trial, visibility, and feature checkboxes against
 * the Feature Flags catalogue).
 *
 * Props:
 *   open               boolean
 *   plan               plan object for edit mode, or null for add mode
 *   existingPlans      full list — used for duplicate-name + "Most Popular" reset
 *   featureCatalogue   string[]  — from Feature Flags tab
 *   onClose()
 *   onSave(plan)
 */
export default function PlanEditorModal({
  open,
  plan = null,
  existingPlans = [],
  featureCatalogue = [],
  onClose,
  onSave,
}) {
  const isEdit = Boolean(plan);
  const scrollRef = useRef(null);

  const initialDraft = useMemo(() => buildInitialDraft(plan), [plan]);
  const [draft, setDraft] = useState(initialDraft);
  const [errors, setErrors] = useState({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  /* Reset draft each time the modal opens or the edited plan changes. */
  useEffect(() => {
    if (!open) return;
    setDraft(buildInitialDraft(plan));
    setErrors({});
    setSubmitAttempted(false);
  }, [open, plan]);

  /* Monthly × 12 vs Yearly — read-only display. */
  const discountPct = useMemo(() => {
    const m = Number(draft.monthly) || 0;
    const y = Number(draft.yearly) || 0;
    if (m <= 0 || y <= 0) return 0;
    const pct = Math.max(0, Math.round((1 - (y / (m * 12))) * 100));
    return pct;
  }, [draft.monthly, draft.yearly]);

  if (!open) return null;

  const patch = (partial) =>
    setDraft((prev) => ({ ...prev, ...partial }));

  const patchErrorClear = (keys) => (value) => {
    setDraft((prev) => ({ ...prev, ...(typeof value === 'object' ? value : { [keys[0]]: value }) }));
    setErrors((prev) => {
      const next = { ...prev };
      keys.forEach((k) => delete next[k]);
      return next;
    });
  };

  const toggleFeature = (feature) => {
    setDraft((prev) => {
      const set = new Set(prev.features);
      if (set.has(feature)) set.delete(feature); else set.add(feature);
      return { ...prev, features: Array.from(set) };
    });
  };

  const selectAllFeatures = () => patch({ features: [...featureCatalogue] });
  const clearAllFeatures  = () => patch({ features: [] });

  const toggleCycle = (cycle) => {
    const next = draft.cycles.includes(cycle)
      ? draft.cycles.filter((c) => c !== cycle)
      : [...draft.cycles, cycle];
    patch({ cycles: next });
    setErrors((prev) => ({ ...prev, cycles: undefined }));
  };

  const validate = () => {
    const e = {};
    const nameTrim = draft.name.trim();
    if (!nameTrim) e.name = 'Plan Name is required.';
    else if (!/^[A-Za-z\s\-&().]+$/.test(nameTrim))
      e.name = 'Plan Name must contain only letters, spaces, and basic punctuation (no numbers).';
    else if (nameTrim.length < 2)
      e.name = 'Plan Name must be at least 2 characters.';
    else {
      const dup = existingPlans.some(
        (p) => p.name.trim().toLowerCase() === nameTrim.toLowerCase() && p.id !== draft.id,
      );
      if (dup) e.name = 'A plan with this name already exists.';
    }

    if (!draft.code.trim()) e.code = 'Plan Code is required.';
    else if (!/^[a-z][a-z0-9-]*$/.test(draft.code))
      e.code = 'Plan Code must start with a letter and use only lowercase letters, numbers, and hyphens (e.g. starter, pro-plan).';
    else if (draft.code.endsWith('-'))
      e.code = 'Plan Code cannot end with a hyphen.';
    else if (draft.code.includes('--'))
      e.code = 'Plan Code cannot have consecutive hyphens.';
    else {
      const dupCode = existingPlans.some(
        (p) => p.code && p.code.trim().toLowerCase() === draft.code.trim().toLowerCase() && p.id !== draft.id,
      );
      if (dupCode) e.code = 'A plan with this code already exists. Please use a unique plan code.';
    }

    if (!draft.description.trim()) e.description = 'Description is required.';
    else if (draft.description.length > 150) e.description = 'Description must be 150 characters or fewer.';

    if (!draft.cycles.length) e.cycles = 'Select at least one billing cycle.';

    if (draft.cycles.includes('Monthly')) {
      const m = Number(draft.monthly);
      if (!Number.isFinite(m) || m < 0) e.monthly = 'Monthly Price must be 0 or more.';
    }
    if (draft.cycles.includes('Yearly')) {
      const y = Number(draft.yearly);
      if (!Number.isFinite(y) || y < 0) e.yearly = 'Yearly Price must be 0 or more.';
    }
    if (draft.setupFee !== '' && !(Number(draft.setupFee) >= 0)) {
      e.setupFee = 'Setup Fee must be 0 or more.';
    }

    for (const lim of LIMIT_FIELDS) {
      if (draft[lim.unlimitedKey]) continue;
      const raw = draft[lim.key];
      const n = Number(raw);
      if (raw === '' || !Number.isFinite(n) || n < 0) {
        e[lim.key] = `${lim.label} is required.`;
      }
    }

    const trial = Number(draft.trialDays);
    if (!Number.isFinite(trial) || trial < 0 || trial > 90) {
      e.trialDays = 'Trial Duration must be between 0 and 90 days.';
    }

    if (!STATUSES.includes(draft.status))         e.status     = 'Status is required.';
    if (!VISIBILITIES.includes(draft.visibility)) e.visibility = 'Visibility is required.';

    return e;
  };

  const handleSave = () => {
    setSubmitAttempted(true);
    const nextErrors = validate();
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      /* Scroll modal body to top so the error banner is visible */
      if (scrollRef.current) {
        scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return;
    }
    const saved = {
      ...draft,
      name:        draft.name.trim(),
      code:        draft.code.trim(),
      description: draft.description.trim(),
      monthly:     Number(draft.monthly) || 0,
      yearly:      Number(draft.yearly) || 0,
      setupFee:    draft.setupFee === '' ? 0 : Number(draft.setupFee) || 0,
      trialDays:   Number(draft.trialDays) || 0,
      /* Limits: coerce to number when present, null when unlimited. */
      maxUsers:       draft.maxUsersUnlimited       ? null : Number(draft.maxUsers) || 0,
      maxOffices:     draft.maxOfficesUnlimited     ? null : Number(draft.maxOffices) || 0,
      maxVisitors:    draft.maxVisitorsUnlimited    ? null : Number(draft.maxVisitors) || 0,
      maxStorageGb:   draft.maxStorageGbUnlimited   ? null : Number(draft.maxStorageGb) || 0,
      maxApiCallsDay: draft.maxApiCallsDayUnlimited ? null : (draft.maxApiCallsDay === '' ? null : Number(draft.maxApiCallsDay)),
      updatedAt:      new Date().toISOString(),
    };
    onSave(saved);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="plan-editor-title"
      style={{ position: 'fixed', inset: 0, zIndex: 9100, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px 8px' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={scrollRef}
        style={{ maxHeight: '92vh', overflowY: 'auto', width: '100%', maxWidth: 760, background: 'var(--app-surface)', borderRadius: 16, padding: 'clamp(14px, 4vw, 24px)', fontFamily: "'Plus Jakarta Sans', sans-serif", boxShadow: '0 25px 60px rgba(0,0,0,0.4)', color: 'var(--app-text)' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
          <div>
            <h3 id="plan-editor-title" style={{ margin: 0, fontSize: 18, fontWeight: 800, color: T.navy, fontFamily: T.font }}>
              {isEdit ? `Edit ${plan.name}` : 'Add New Plan'}
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: T.muted }}>Define pricing, limits, trial, and feature entitlements.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" title="Close"
                  style={{ border: `1px solid var(--app-border)`, background: 'var(--app-surface-muted)', borderRadius: 10, padding: 6, cursor: 'pointer', flexShrink: 0, color: 'var(--app-text)' }}>
            <X size={16} />
          </button>
        </div>

        {/* ── Error Summary Banner ── */}
        {submitAttempted && Object.keys(errors).length > 0 && (
          <div role="alert" style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>⚠️</span>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#DC2626' }}>
                Please fix {Object.keys(errors).length} error{Object.keys(errors).length > 1 ? 's' : ''} before saving.
              </p>
              <ul style={{ margin: '6px 0 0', paddingLeft: 16, fontSize: 12, color: '#B91C1C' }}>
                {Object.values(errors).map((msg, i) => (
                  <li key={i}>{msg}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Section: Basic info */}
        <SectionTitle>Basic Info</SectionTitle>
        <div style={gridCls}>
          <FieldRow label="Plan Name" required error={errors.name}
                    hint={!errors.name ? 'Letters, spaces, and basic punctuation only. No numbers.' : undefined}>
            <input style={input(errors.name)} value={draft.name}
                   onChange={(e) => {
                     /* Allow only letters, spaces, and basic punctuation — block numbers */
                     const raw = e.target.value.replace(/[^A-Za-z\s\-&().]/g, '');
                     /* Only update name — code auto-fills on blur, not while typing */
                     patchErrorClear(['name'])({ name: raw });
                   }}
                   onBlur={(e) => {
                     const v = e.target.value.trim();
                     if (!v) { setErrors((prev) => ({ ...prev, name: 'Plan Name is required.' })); return; }
                     if (!/^[A-Za-z\s\-&().]+$/.test(v)) { setErrors((prev) => ({ ...prev, name: 'Plan Name must contain only letters and basic punctuation (no numbers).' })); return; }
                     if (v.length < 2) { setErrors((prev) => ({ ...prev, name: 'Plan Name must be at least 2 characters.' })); return; }
                     const dup = existingPlans.some((p) => p.name.trim().toLowerCase() === v.toLowerCase() && p.id !== draft.id);
                     if (dup) { setErrors((prev) => ({ ...prev, name: 'A plan with this name already exists.' })); return; }
                     /* Auto-fill code only when user leaves name field and code hasn't been manually edited */
                     if (!draft.codeManuallyEdited) {
                       patch({ code: slugify(v) });
                     }
                   }}
                   placeholder="e.g. Professional" maxLength={40} />
          </FieldRow>
          <FieldRow label="Plan Code" required error={errors.code} hint={!errors.code ? 'Auto-generated from name. Lowercase letters, numbers, hyphens only. Must start with a letter.' : undefined}>
            <input style={input(errors.code)} value={draft.code}
                   onChange={(e) => {
                     /* Auto lowercase, allow only a-z 0-9 hyphen, block leading hyphen */
                     let raw = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
                     /* Prevent leading hyphen */
                     if (raw.startsWith('-')) raw = raw.replace(/^-+/, '');
                     /* Prevent consecutive hyphens */
                     raw = raw.replace(/--+/g, '-');
                     patchErrorClear(['code'])({ code: raw, codeManuallyEdited: true });
                   }}
                   onBlur={(e) => {
                     const v = e.target.value.trim();
                     if (!v) { setErrors((prev) => ({ ...prev, code: 'Plan Code is required.' })); return; }
                     if (!/^[a-z][a-z0-9-]*$/.test(v)) { setErrors((prev) => ({ ...prev, code: 'Code must start with a letter, e.g. starter or pro-plan.' })); return; }
                     if (v.endsWith('-')) { setErrors((prev) => ({ ...prev, code: 'Code cannot end with a hyphen.' })); return; }
                   }}
                   placeholder="professional" maxLength={40} />
          </FieldRow>

          <div style={{ gridColumn: '1 / -1' }}>
            <FieldRow label="Description" required error={errors.description}>
              <textarea style={{ ...input(errors.description), resize: 'vertical', maxHeight: 120 }} rows={3} maxLength={150}
                        value={draft.description}
                        onChange={(e) => patchErrorClear(['description'])({ description: e.target.value.slice(0, 150) })}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (!v) setErrors((prev) => ({ ...prev, description: 'Description is required.' }));
                          else if (v.length > 150) setErrors((prev) => ({ ...prev, description: 'Description must be 150 characters or fewer.' }));
                        }}
                        placeholder="One-line description shown on pricing cards." />
              <p style={{ margin: '4px 0 0', fontSize: 10, color: T.muted, textAlign: 'right' }}>{draft.description.length}/150</p>
            </FieldRow>
          </div>

          <FieldRow label="Badge Colour">
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="color" value={draft.badgeColour} onChange={(e) => patch({ badgeColour: e.target.value })}
                     style={{ width: 48, height: 38, padding: 0, border: `1px solid ${T.border}`, borderRadius: 8 }} />
              <input style={input()} value={draft.badgeColour} maxLength={9}
                     onChange={(e) => patch({ badgeColour: e.target.value })} placeholder="#0284C7" />
            </div>
          </FieldRow>
          <FieldRow label="Most Popular" hint="Highlights this plan on the landing page. Mutually exclusive.">
            <label style={toggleLabelCls}>
              <input type="checkbox" checked={draft.mostPopular}
                     onChange={(e) => patch({ mostPopular: e.target.checked })} />
              Flag as most popular
            </label>
          </FieldRow>
        </div>

        {/* Section: Pricing */}
        <SectionTitle>Pricing</SectionTitle>
        <div style={gridCls}>
          <div style={{ gridColumn: '1 / -1' }}>
            <FieldRow label="Billing Cycles" required error={errors.cycles}>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {['Monthly', 'Yearly'].map((c) => (
                  <label key={c} style={toggleLabelCls}>
                    <input type="checkbox" checked={draft.cycles.includes(c)} onChange={() => toggleCycle(c)} />
                    {c}
                  </label>
                ))}
              </div>
            </FieldRow>
          </div>

          <FieldRow label="Monthly Price" required error={errors.monthly} hint="In INR.">
            <div style={inputGroupCls}>
              <span style={prefixCls}>₹</span>
              <input style={{ ...input(errors.monthly), borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
                     type="text" inputMode="numeric" value={draft.monthly}
                     onChange={(e) => patchErrorClear(['monthly'])({ monthly: e.target.value.replace(/[^0-9]/g, '') })}
                     disabled={!draft.cycles.includes('Monthly')} placeholder="299" />
            </div>
          </FieldRow>
          <FieldRow label="Yearly Price" required error={errors.yearly}
                    hint={discountPct > 0 ? `Discount: ${discountPct}% vs Monthly × 12.` : 'Set Monthly + Yearly to calculate discount.'}>
            <div style={inputGroupCls}>
              <span style={prefixCls}>₹</span>
              <input style={{ ...input(errors.yearly), borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
                     type="text" inputMode="numeric" value={draft.yearly}
                     onChange={(e) => patchErrorClear(['yearly'])({ yearly: e.target.value.replace(/[^0-9]/g, '') })}
                     disabled={!draft.cycles.includes('Yearly')} placeholder="2990" />
            </div>
          </FieldRow>

          <FieldRow label="Setup Fee" error={errors.setupFee} hint="Optional one-off charge.">
            <div style={inputGroupCls}>
              <span style={prefixCls}>₹</span>
              <input style={{ ...input(errors.setupFee), borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
                     type="text" inputMode="numeric" value={draft.setupFee}
                     onChange={(e) => patchErrorClear(['setupFee'])({ setupFee: e.target.value.replace(/[^0-9]/g, '') })}
                     placeholder="0" />
            </div>
          </FieldRow>
          <FieldRow label="Tax Included" hint="When on, the displayed prices already include VAT.">
            <label style={toggleLabelCls}>
              <input type="checkbox" checked={draft.taxIncluded}
                     onChange={(e) => patch({ taxIncluded: e.target.checked })} />
              Prices include tax
            </label>
          </FieldRow>
        </div>

        {/* Section: Limits */}
        <SectionTitle>Limits</SectionTitle>
        <div style={gridCls}>
          {LIMIT_FIELDS.map((l) => (
            <FieldRow key={l.key} label={l.label} required={l.required} error={errors[l.key]} hint={l.hint}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="text" inputMode="numeric"
                       style={{ ...input(errors[l.key]), flex: 1 }}
                       value={draft[l.unlimitedKey] ? '' : draft[l.key]}
                       onChange={(e) => patchErrorClear([l.key])({ [l.key]: e.target.value.replace(/[^0-9]/g, '') })}
                       disabled={draft[l.unlimitedKey]} placeholder="0" />
                <label style={{ ...toggleLabelCls, padding: 0, fontSize: 12 }}>
                  <input type="checkbox" checked={Boolean(draft[l.unlimitedKey])}
                         onChange={(e) => patch({ [l.unlimitedKey]: e.target.checked })} />
                  Unlimited
                </label>
              </div>
            </FieldRow>
          ))}
        </div>

        {/* Section: Trial */}
        <SectionTitle>Trial</SectionTitle>
        <div style={gridCls}>
          <FieldRow label="Trial Duration (days)" required error={errors.trialDays} hint="0–90 days. Use 0 to disable trials.">
            <input type="number" min="0" max="90" style={input(errors.trialDays)}
                   value={draft.trialDays}
                   onChange={(e) => patchErrorClear(['trialDays'])({ trialDays: e.target.value })} />
          </FieldRow>
          <FieldRow label="Credit Card Required" hint="Make trials collect a card up-front.">
            <label style={toggleLabelCls}>
              <input type="checkbox" checked={draft.requiresCard}
                     onChange={(e) => patch({ requiresCard: e.target.checked })} />
              Require credit card
            </label>
          </FieldRow>
        </div>

        {/* Section: Features */}
        <SectionTitle>Features</SectionTitle>
        <div style={{ ...card(), marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <button type="button" onClick={selectAllFeatures}
                    style={{ ...btn(T.purple, true), padding: '6px 12px', fontSize: 11 }}
                    title="Enable every feature for this plan">Select All</button>
            <button type="button" onClick={clearAllFeatures}
                    style={{ ...btn(T.muted, true), padding: '6px 12px', fontSize: 11 }}
                    title="Disable every feature for this plan">Clear All</button>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: T.muted }}>
              {draft.features.length}/{featureCatalogue.length} selected
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
            {featureCatalogue.map((feat) => (
              <label key={feat} style={{ ...toggleLabelCls, padding: '6px 0', fontSize: 12 }}>
                <input type="checkbox" checked={draft.features.includes(feat)} onChange={() => toggleFeature(feat)} />
                {feat}
              </label>
            ))}
          </div>
        </div>

        {/* Section: Status */}
        <SectionTitle>Status</SectionTitle>
        <div style={gridCls}>
          <FieldRow label="Status" required error={errors.status}>
            <select style={input(errors.status)} value={draft.status}
                    onChange={(e) => patch({ status: e.target.value })}>
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </FieldRow>
          <FieldRow label="Visibility" required error={errors.visibility}
                    hint="Public shows in the landing pricing grid. Sales-only hides it.">
            <select style={input(errors.visibility)} value={draft.visibility}
                    onChange={(e) => patch({ visibility: e.target.value })}>
              {VISIBILITIES.map((v) => <option key={v}>{v}</option>)}
            </select>
          </FieldRow>
        </div>

        {/* Footer buttons */}
        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button style={btn(T.muted, true)} onClick={onClose}>Cancel</button>
          <button style={btn(T.purple)} onClick={handleSave}>{isEdit ? 'Update Plan' : 'Save Plan'}</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Internal constants + helpers ────────────────────────────────────── */

const STATUSES     = ['Active', 'Draft', 'Archived'];
const VISIBILITIES = ['Public', 'Private', 'Enterprise Sales Only'];

const LIMIT_FIELDS = [
  { key: 'maxUsers',       unlimitedKey: 'maxUsersUnlimited',       label: 'Max Users',               required: true,  hint: 'Staff accounts this plan supports.' },
  { key: 'maxOffices',     unlimitedKey: 'maxOfficesUnlimited',     label: 'Max Offices',             required: true,  hint: 'Separate physical locations.' },
  { key: 'maxVisitors',    unlimitedKey: 'maxVisitorsUnlimited',    label: 'Max Visitors per Month',  required: true,  hint: 'Total check-ins allowed each calendar month.' },
  { key: 'maxStorageGb',   unlimitedKey: 'maxStorageGbUnlimited',   label: 'Max Storage (GB)',        required: true,  hint: 'Shared across photos, documents, and logs.' },
  { key: 'maxApiCallsDay', unlimitedKey: 'maxApiCallsDayUnlimited', label: 'Max API Calls per Day',   required: false, hint: 'Leave Unlimited for plans without API access.' },
];

const T = {
  border: 'var(--app-border)',
  navy:   'var(--app-text)',
  text:   'var(--app-text-muted)',
  muted:  'var(--app-text-subtle)',
  purple: '#0284C7',
  font:   "'Outfit', 'Plus Jakarta Sans', sans-serif",
};

const card = (extra = {}) => ({
  background: 'var(--app-surface)',
  border: `1px solid var(--app-border)`,
  borderRadius: 12,
  padding: 14,
  ...extra,
});

const btn = (color = T.purple, outline = false) => ({
  padding: '8px 18px',
  borderRadius: 10,
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: T.font,
  border: `1px solid ${color}`,
  background: outline ? 'var(--app-surface)' : color,
  color: outline ? color : '#fff',
});

const input = (hasError = false) => ({
  width: '100%',
  border: `1px solid ${hasError ? '#DC2626' : 'var(--app-border)'}`,
  borderRadius: 10,
  padding: '10px 12px',
  fontSize: 13,
  color: 'var(--app-text)',
  outline: 'none',
  fontFamily: T.font,
  background: 'var(--app-surface-muted)',
});

const inputGroupCls = { display: 'flex', alignItems: 'stretch', borderRadius: 10, overflow: 'hidden', border: `1px solid var(--app-border)`, background: 'var(--app-surface-muted)' };
const prefixCls     = { padding: '10px 12px', background: 'var(--app-surface)', color: 'var(--app-text-muted)', fontSize: 12, fontWeight: 700, borderRight: `1px solid var(--app-border)` };
const toggleLabelCls = { display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: T.text, cursor: 'pointer' };
const gridCls = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))', gap: 14, marginBottom: 14 };

function SectionTitle({ children }) {
  return (
    <h4 style={{ margin: '18px 0 8px', fontSize: 12, fontWeight: 800, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
      {children}
    </h4>
  );
}

function FieldRow({ label, required, error, hint, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 6 }}>
        {label}{required && <span style={{ color: '#DC2626' }}>*</span>}
      </label>
      {children}
      {error && <p style={{ margin: '4px 0 0', fontSize: 11, color: '#DC2626' }}>{error}</p>}
      {!error && hint && <p style={{ margin: '4px 0 0', fontSize: 11, color: T.muted }}>{hint}</p>}
    </div>
  );
}

function slugify(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function buildInitialDraft(plan) {
  if (plan) {
    return {
      id:                      plan.id,
      name:                    plan.name || '',
      code:                    plan.code || slugify(plan.name),
      codeManuallyEdited:      Boolean(plan.code),
      description:             plan.description || '',
      badgeColour:             plan.badgeColour || '#0284C7',
      mostPopular:             Boolean(plan.mostPopular),

      cycles:                  Array.isArray(plan.cycles) && plan.cycles.length ? plan.cycles : ['Monthly', 'Yearly'],
      monthly:                 plan.monthly != null ? String(plan.monthly) : '',
      yearly:                  plan.yearly  != null ? String(plan.yearly)  : '',
      setupFee:                plan.setupFee != null ? String(plan.setupFee) : '',
      taxIncluded:             Boolean(plan.taxIncluded),

      maxUsers:                plan.maxUsers       == null ? '' : String(plan.maxUsers),
      maxUsersUnlimited:       plan.maxUsers       === null,
      maxOffices:              plan.maxOffices     == null ? '' : String(plan.maxOffices),
      maxOfficesUnlimited:     plan.maxOffices     === null,
      maxVisitors:             plan.maxVisitors    == null ? '' : String(plan.maxVisitors),
      maxVisitorsUnlimited:    plan.maxVisitors    === null,
      maxStorageGb:            plan.maxStorageGb   == null ? '' : String(plan.maxStorageGb),
      maxStorageGbUnlimited:   plan.maxStorageGb   === null,
      maxApiCallsDay:          plan.maxApiCallsDay == null ? '' : String(plan.maxApiCallsDay),
      maxApiCallsDayUnlimited: plan.maxApiCallsDay === null,

      trialDays:               plan.trialDays != null ? plan.trialDays : 14,
      requiresCard:            Boolean(plan.requiresCard),

      features:                Array.isArray(plan.features) ? plan.features : [],

      status:                  STATUSES.includes(plan.status) ? plan.status : 'Active',
      visibility:              VISIBILITIES.includes(plan.visibility) ? plan.visibility : 'Public',
    };
  }
  return {
    id:                      `plan-${Date.now()}`,
    name:                    '',
    code:                    '',
    codeManuallyEdited:      false,
    description:             '',
    badgeColour:             '#0284C7',
    mostPopular:             false,
    cycles:                  ['Monthly', 'Yearly'],
    monthly:                 '',
    yearly:                  '',
    setupFee:                '',
    taxIncluded:             false,
    maxUsers:                '5',   maxUsersUnlimited:       false,
    maxOffices:              '1',   maxOfficesUnlimited:     false,
    maxVisitors:             '500', maxVisitorsUnlimited:    false,
    maxStorageGb:            '5',   maxStorageGbUnlimited:   false,
    maxApiCallsDay:          '',    maxApiCallsDayUnlimited: true,
    trialDays:               14,
    requiresCard:            false,
    features:                [],
    status:                  'Active',
    visibility:              'Public',
  };
}