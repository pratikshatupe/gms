import React, { useMemo, useState } from 'react';
import { ClipboardCheck, Loader2, QrCode, IdCard, Camera, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCollection, STORAGE_KEYS, useOrgSettings } from '../../store';
import { MOCK_ORGANIZATIONS, MOCK_APPOINTMENTS } from '../../data/mockData';
import { addAuditLog } from '../../utils/auditLogger';
import { Toast, ConfirmModal } from '../../components/ui';

const APPROVAL_MODES = [
  { value: 'Any',           label: 'Any Approver',          description: 'Any Director or Manager in the organisation can approve pending appointments.' },
  { value: 'ReportingChain',label: 'Reporting Chain',       description: "Only the host's direct manager (or anyone up the reporting chain) can approve." },
  { value: 'None',          label: 'No Approval Required',  description: 'Appointments are auto-approved on creation. Useful for low-risk internal guests.' },
];

const BADGE_TEMPLATES = [
  { value: 'standard',  label: 'Standard — Visitor name + organisation logo + host + date' },
  { value: 'compact',   label: 'Compact — Visitor name + badge number only (half-size)' },
  { value: 'hostFirst', label: 'Host-First — Host name + company + visitor name below' },
];

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={[
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200',
        checked ? 'bg-sky-600' : 'bg-slate-300 dark:bg-slate-600',
        disabled ? 'cursor-not-allowed opacity-50' : '',
      ].join(' ')}
    >
      <span className={[
        'inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200',
        checked ? 'translate-x-5' : 'translate-x-0',
      ].join(' ')} />
    </button>
  );
}

export default function CheckInConfigTab({ canEdit = true }) {
  const { user } = useAuth();
  const [orgs] = useCollection(STORAGE_KEYS.ORGANIZATIONS, MOCK_ORGANIZATIONS);
  const [appointments] = useCollection(STORAGE_KEYS.APPOINTMENTS, MOCK_APPOINTMENTS);

  const orgId = user?.organisationId || user?.orgId;
  const orgRecord = useMemo(() => (orgs || []).find((o) => o?.id === orgId) || null, [orgs, orgId]);
  const { settings, save } = useOrgSettings(user, { org: orgRecord });

  const [draft, setDraft] = useState(settings || {});
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [confirm, setConfirm] = useState(null);

  React.useEffect(() => { if (settings) setDraft(settings); }, [settings]);

  if (!orgId) {
    return (
      <div className="rounded-[14px] border border-slate-200 bg-white p-10 text-center shadow-sm dark:border-[#142535] dark:bg-[#0A1828]">
        <p className="text-[13px] text-slate-400 dark:text-slate-500">Check-in configuration requires a logged-in tenant user.</p>
      </div>
    );
  }

  const set = (key, value) => {
    if (!canEdit) return;
    setDraft((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const pendingCount = useMemo(() =>
    (appointments || []).filter((a) => a?.orgId === orgId && a?.status === 'Pending').length,
    [appointments, orgId],
  );

  const validate = (next) => {
    const e = {};
    if (!APPROVAL_MODES.find((m) => m.value === next.approvalMode)) e.approvalMode = 'Select an approval mode.';
    const timeout = Number(next.approvalTimeoutHrs);
    if (!Number.isFinite(timeout) || timeout < 1 || timeout > 168) e.approvalTimeoutHrs = 'Approval timeout must be between 1 and 168 hours.';
    const qrTtl = Number(next.qrTtlMinutes);
    if (!Number.isFinite(qrTtl) || qrTtl < 5 || qrTtl > 1440) e.qrTtlMinutes = 'QR code lifetime must be between 5 and 1440 minutes.';
    if (!BADGE_TEMPLATES.find((b) => b.value === next.badgeTemplate)) e.badgeTemplate = 'Select a badge template.';
    return e;
  };

  const attemptSave = () => {
    if (!canEdit) return;
    const errs = validate(draft);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    if (draft.approvalMode !== settings.approvalMode) {
      setConfirm({ kind: 'approvalMode', title: 'Change approval workflow?', newMode: APPROVAL_MODES.find((m) => m.value === draft.approvalMode)?.label || draft.approvalMode, oldMode: APPROVAL_MODES.find((m) => m.value === settings.approvalMode)?.label || settings.approvalMode, pendingCount });
      return;
    }
    commitSave();
  };

  const commitSave = async (extraAudit = null) => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 800));
    const next = save(draft);
    const actor = user?.name || 'Unknown';
    addAuditLog({ userName: actor, role: (user?.role || '').toLowerCase(), action: 'SETTINGS_CHECKIN_UPDATED', module: 'Settings', description: `Check-in configuration updated.`, orgId });
    if (extraAudit) addAuditLog({ ...extraAudit, orgId, userName: actor, role: (user?.role || '').toLowerCase() });
    setSaving(false);
    setToast({ msg: 'Check-in configuration updated successfully.', type: 'success' });
    setDraft(next || draft);
  };

  const handleConfirm = () => {
    const c = confirm; setConfirm(null);
    if (!c) return;
    commitSave({ action: 'APPROVAL_WORKFLOW_CHANGED', module: 'Settings', description: `Approval workflow changed from ${c.oldMode} to ${c.newMode}. ${c.pendingCount} pending appointment(s) will complete under their original workflow.` });
  };

  const isDirty = JSON.stringify(draft) !== JSON.stringify(settings);

  return (
    <div className="flex flex-col gap-4">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {!canEdit && (
        <div role="status" className="flex items-center gap-2 rounded-[10px] border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] font-semibold text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          <AlertTriangle size={14} /> You can view Check-In configuration but editing is restricted to Directors and Managers.
        </div>
      )}

      {/* Approval workflow */}
      <section className="rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm dark:border-[#142535] dark:bg-[#0A1828]">
        <div className="mb-4 flex items-center gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400">
            <ClipboardCheck size={18} />
          </span>
          <div>
            <h2 className="text-[15px] font-extrabold text-[#0C2340] dark:text-slate-100">Approval Workflow</h2>
            <p className="mt-0.5 text-[12px] text-slate-400 dark:text-slate-500">Who can approve pending visitor appointments.</p>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          {APPROVAL_MODES.map((mode) => {
            const active = draft.approvalMode === mode.value;
            return (
              <label key={mode.value}
                className={[
                  'flex cursor-pointer items-start gap-3 rounded-[10px] border-2 p-3 transition',
                  active
                    ? 'border-sky-500 bg-sky-50 dark:border-sky-500 dark:bg-sky-500/10'
                    : 'border-slate-200 bg-white hover:border-sky-200 dark:border-[#142535] dark:bg-[#071220] dark:hover:border-sky-700',
                  !canEdit ? 'cursor-not-allowed opacity-70' : '',
                ].join(' ')}
              >
                <input type="radio" name="approvalMode" value={mode.value}
                  checked={active} onChange={() => set('approvalMode', mode.value)}
                  disabled={!canEdit} className="mt-0.5 accent-sky-600" />
                <div>
                  <div className="text-[13px] font-bold text-slate-700 dark:text-slate-200">{mode.label}</div>
                  <p className="mt-0.5 text-[12px] text-slate-400 dark:text-slate-500">{mode.description}</p>
                </div>
              </label>
            );
          })}
        </div>
        {errors.approvalMode && <p role="alert" className="mt-2 text-[11px] font-semibold text-red-500">{errors.approvalMode}</p>}

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TabField label="Approval Timeout (hours)" required error={errors.approvalTimeoutHrs} hint="Pending appointments auto-cancel after this many hours without approval.">
            <TabInput type="number" min={1} max={168} step={1} value={draft.approvalTimeoutHrs ?? 24} onChange={(e) => set('approvalTimeoutHrs', Number(e.target.value))} disabled={!canEdit} invalid={Boolean(errors.approvalTimeoutHrs)} />
          </TabField>
        </div>

        <div className="mt-4 rounded-[10px] border border-indigo-200 bg-indigo-50 px-3 py-2.5 text-[12px] text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300">
          Changes apply to <strong>new</strong> appointments only. {pendingCount} pending appointment(s) will complete under their originally-stamped workflow.
        </div>
      </section>

      {/* Walk-In Requirements */}
      <section className="rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm dark:border-[#142535] dark:bg-[#0A1828]">
        <h2 className="mb-0.5 text-[15px] font-extrabold text-[#0C2340] dark:text-slate-100">Walk-In Requirements</h2>
        <p className="mb-3 text-[12px] text-slate-400 dark:text-slate-500">What front-desk staff must capture before a walk-in is checked in.</p>
        <ToggleRow icon={<Camera size={16} />} label="Require visitor photo" desc="Walk-in wizard blocks submission until a photo is captured or uploaded." checked={!!draft.requirePhoto} onChange={(v) => set('requirePhoto', v)} disabled={!canEdit} />
        <ToggleRow icon={<IdCard size={16} />} label="Require ID proof" desc="Walk-in wizard blocks submission until a government ID number is captured." checked={!!draft.requireIdProof} onChange={(v) => set('requireIdProof', v)} disabled={!canEdit} />
        <ToggleRow label="Allow double-booking a room" desc="When enabled, staff can override conflict warnings and book overlapping meetings." checked={!!draft.allowDoubleBook} onChange={(v) => set('allowDoubleBook', v)} disabled={!canEdit} />
      </section>

      {/* Badge & QR */}
      <section className="rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm dark:border-[#142535] dark:bg-[#0A1828]">
        <div className="mb-4 flex items-center gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
            <QrCode size={18} />
          </span>
          <div>
            <h2 className="text-[15px] font-extrabold text-[#0C2340] dark:text-slate-100">Badge & Check-Out QR</h2>
            <p className="mt-0.5 text-[12px] text-slate-400 dark:text-slate-500">Visitor badge layout and self-checkout QR lifetime.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TabField label="Badge Template" required error={errors.badgeTemplate}>
            <TabSelect value={draft.badgeTemplate || 'standard'} onChange={(e) => set('badgeTemplate', e.target.value)} disabled={!canEdit} invalid={Boolean(errors.badgeTemplate)}>
              {BADGE_TEMPLATES.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
            </TabSelect>
          </TabField>
          <TabField label="QR Code Lifetime (minutes)" required error={errors.qrTtlMinutes} hint="Self-checkout QR codes expire after this many minutes for security.">
            <TabInput type="number" min={5} max={1440} step={5} value={draft.qrTtlMinutes ?? 60} onChange={(e) => set('qrTtlMinutes', Number(e.target.value))} disabled={!canEdit} invalid={Boolean(errors.qrTtlMinutes)} />
          </TabField>
        </div>
      </section>

      {/* Save bar */}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setDraft(settings)} disabled={!canEdit || !isDirty || saving}
          className="rounded-[10px] border border-slate-200 bg-white px-4 py-2 text-[13px] font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-300">
          Cancel
        </button>
        <button type="button" onClick={attemptSave} disabled={!canEdit || !isDirty || saving}
          className="inline-flex items-center gap-1.5 rounded-[10px] border border-sky-700 bg-sky-600 px-4 py-2 text-[13px] font-bold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50">
          {saving && <Loader2 size={14} className="animate-spin" />}
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      {confirm && (
        <ConfirmModal
          title={confirm.title}
          message={`New appointments created after this change will use the "${confirm.newMode}" workflow. ${confirm.pendingCount} pending appointment(s) will complete under their original "${confirm.oldMode}" workflow.`}
          onConfirm={handleConfirm}
          onCancel={() => setConfirm(null)}
          confirmLabel="Confirm Change"
        />
      )}
    </div>
  );
}

function TabField({ label, required, error, hint, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400">
        {label}{required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {error ? <p role="alert" className="text-[11px] font-semibold text-red-500">{error}</p>
             : hint ? <p className="text-[11px] text-slate-400 dark:text-slate-500">{hint}</p> : null}
    </div>
  );
}

function TabInput({ type = 'text', value, onChange, disabled, invalid, min, max, step }) {
  return (
    <input type={type} value={value} onChange={onChange} disabled={disabled} min={min} max={max} step={step}
      className={[
        'w-full rounded-[10px] border px-3 py-2.5 text-[13px] outline-none transition text-slate-700 dark:text-slate-200',
        invalid
          ? 'border-red-400 bg-red-50 dark:border-red-500/50 dark:bg-red-500/10'
          : 'border-slate-200 bg-white focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-[#142535] dark:bg-[#071220]',
        disabled ? 'cursor-not-allowed opacity-60 dark:bg-[#040D18]' : '',
      ].join(' ')}
    />
  );
}

function TabSelect({ value, onChange, disabled, invalid, children }) {
  return (
    <select value={value} onChange={onChange} disabled={disabled}
      className={[
        'w-full rounded-[10px] border px-3 py-2.5 text-[13px] outline-none transition text-slate-700 dark:text-slate-200',
        invalid
          ? 'border-red-400 bg-red-50 dark:border-red-500/50 dark:bg-red-500/10'
          : 'border-slate-200 bg-white focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-[#142535] dark:bg-[#071220]',
        disabled ? 'cursor-not-allowed opacity-60 dark:bg-[#040D18]' : '',
      ].join(' ')}
    >
      {children}
    </select>
  );
}

function ToggleRow({ icon, label, desc, checked, onChange, disabled }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 py-3 dark:border-[#142535]">
      <div className="flex items-start gap-2.5">
        {icon && (
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-[8px] bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400">{icon}</span>
        )}
        <div>
          <div className="text-[13px] font-bold text-slate-700 dark:text-slate-200">{label}</div>
          {desc && <div className="mt-0.5 max-w-[520px] text-[11px] text-slate-400 dark:text-slate-500">{desc}</div>}
        </div>
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  );
}