import React, { useMemo, useState } from 'react';
import { Bell, Mail, MonitorSmartphone, Moon, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCollection, STORAGE_KEYS } from '../../store';
import { MOCK_STAFF } from '../../data/mockData';
import { addAuditLog } from '../../utils/auditLogger';
import { Toast } from '../../components/ui';
import { NOTIFICATION_TYPES } from '../../context/NotificationContext';

const TRIGGER_ROWS = [
  { key: NOTIFICATION_TYPES.APPOINTMENT_APPROVED,  label: 'Appointment approved',    icon: '✅' },
  { key: NOTIFICATION_TYPES.APPOINTMENT_CANCELLED, label: 'Appointment cancelled',   icon: '❌' },
  { key: NOTIFICATION_TYPES.WALKIN_ARRIVED,        label: 'Walk-in arrived',         icon: '🚶' },
  { key: NOTIFICATION_TYPES.VIP_PENDING,           label: 'VIP appointment pending', icon: '⭐' },
  { key: NOTIFICATION_TYPES.REPORT_READY,          label: 'Report ready',            icon: '📊' },
  { key: NOTIFICATION_TYPES.SYSTEM_ALERT,          label: 'System alert',            icon: '🚨' },
];

export const DEFAULT_NOTIFICATION_PREFS = Object.freeze({
  inApp: true,
  email: true,
  perType: TRIGGER_ROWS.reduce((acc, t) => ({ ...acc, [t.key]: { inApp: true, email: true } }), {}),
  quietHours: { start: '', end: '', timezone: '' },
});

function mergeWithDefaults(prefs) {
  if (!prefs || typeof prefs !== 'object') return { ...DEFAULT_NOTIFICATION_PREFS };
  return {
    inApp: typeof prefs.inApp === 'boolean' ? prefs.inApp : true,
    email: typeof prefs.email === 'boolean' ? prefs.email : true,
    perType: TRIGGER_ROWS.reduce((acc, t) => ({
      ...acc,
      [t.key]: { inApp: prefs.perType?.[t.key]?.inApp !== false, email: prefs.perType?.[t.key]?.email !== false },
    }), {}),
    quietHours: { start: prefs.quietHours?.start || '', end: prefs.quietHours?.end || '', timezone: prefs.quietHours?.timezone || '' },
  };
}

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={[
        'relative inline-flex h-[22px] w-[38px] shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200',
        checked ? 'bg-sky-600' : 'bg-slate-300 dark:bg-slate-600',
        disabled ? 'cursor-not-allowed opacity-50' : '',
      ].join(' ')}
    >
      <span className={[
        'inline-block h-[18px] w-[18px] transform rounded-full bg-white shadow transition duration-200',
        checked ? 'translate-x-[16px]' : 'translate-x-0',
      ].join(' ')} />
    </button>
  );
}

export default function NotificationPreferencesTab() {
  const { user, updateUser } = useAuth();
  const [staff, , updateStaff] = useCollection(STORAGE_KEYS.STAFF, MOCK_STAFF);

  const staffRow = useMemo(() => {
    if (!staff) return null;
    return staff.find((s) => s?.id === (user?.staffId || user?.id))
      || staff.find((s) => (s?.emailId || '').toLowerCase() === (user?.email || '').toLowerCase())
      || null;
  }, [staff, user?.staffId, user?.id, user?.email]);

  const persisted = useMemo(
    () => mergeWithDefaults(staffRow?.notificationPrefs || user?.notificationPrefs),
    [staffRow?.notificationPrefs, user?.notificationPrefs],
  );

  const [draft, setDraft] = useState(persisted);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  React.useEffect(() => { setDraft(persisted); }, [persisted]);

  const browserTz = useMemo(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
  }, []);

  const setMaster  = (channel, value) => setDraft((d) => ({ ...d, [channel]: value }));
  const setPerType = (typeKey, channel, value) => setDraft((d) => ({ ...d, perType: { ...d.perType, [typeKey]: { ...(d.perType[typeKey] || {}), [channel]: value } } }));
  const setQuiet   = (key, value) => setDraft((d) => ({ ...d, quietHours: { ...(d.quietHours || {}), [key]: value, timezone: d.quietHours?.timezone || browserTz } }));
  const clearQuiet = () => setDraft((d) => ({ ...d, quietHours: { start: '', end: '', timezone: '' } }));
  const isDirty    = JSON.stringify(draft) !== JSON.stringify(persisted);

  const handleSave = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 800));
    const nextPrefs = { ...draft };
    if ((nextPrefs.quietHours.start || nextPrefs.quietHours.end) && !nextPrefs.quietHours.timezone) nextPrefs.quietHours.timezone = browserTz;
    if (staffRow) updateStaff(staffRow.id, { ...staffRow, notificationPrefs: nextPrefs });
    updateUser({ notificationPrefs: nextPrefs });
    addAuditLog({ userName: user?.name || 'Unknown', role: (user?.role || '').toLowerCase(), action: 'NOTIFICATION_PREFS_UPDATED', module: 'Settings', description: `Updated notification preferences. Master in-app=${nextPrefs.inApp ? 'on' : 'off'}, email=${nextPrefs.email ? 'on' : 'off'}.`, orgId: user?.organisationId || user?.orgId });
    setSaving(false);
    setToast({ msg: 'Notification preferences updated successfully.', type: 'success' });
  };

  return (
    <div className="flex flex-col gap-4">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* Master channels */}
      <section className="rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm dark:border-[#142535] dark:bg-[#0A1828]">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400">
            <Bell size={18} />
          </span>
          <div>
            <h2 className="text-[15px] font-extrabold text-[#0C2340] dark:text-slate-100">Master Channels</h2>
            <p className="mt-0.5 text-[12px] text-slate-400 dark:text-slate-500">Disabling a master channel turns off every trigger for that channel.</p>
          </div>
        </div>
        <div className="mt-3">
          <ChannelRow icon={<MonitorSmartphone size={16} />} label="In-app notifications" desc="Bell badge + Notifications page entries." checked={draft.inApp} onChange={(v) => setMaster('inApp', v)} />
          <ChannelRow icon={<Mail size={16} />} label="Email notifications" desc="Transactional emails for triggers below." checked={draft.email} onChange={(v) => setMaster('email', v)} />
        </div>
      </section>

      {/* Per-trigger grid */}
      <section className="rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm dark:border-[#142535] dark:bg-[#0A1828]">
        <h2 className="text-[15px] font-extrabold text-[#0C2340] dark:text-slate-100">Per-Trigger Preferences</h2>
        <p className="mt-0.5 text-[12px] text-slate-400 dark:text-slate-500">Fine-grained control. Greyed channels follow the master toggle above.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[320px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-slate-100 dark:border-[#142535]">
                <th className="py-2.5 px-2 text-left text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400">Trigger</th>
                <th className="py-2.5 px-2 text-center text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400">In-app</th>
                <th className="py-2.5 px-2 text-center text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400">Email ID</th>
              </tr>
            </thead>
            <tbody>
              {TRIGGER_ROWS.map((t) => {
                const row = draft.perType[t.key] || {};
                return (
                  <tr key={t.key} className="border-b border-slate-100 dark:border-[#142535]">
                    <td className="py-3 px-2 font-semibold text-slate-700 dark:text-slate-200">
                      <span className="mr-2" aria-hidden="true">{t.icon}</span>{t.label}
                    </td>
                    <td className="py-3 px-2 text-center">
                      <Toggle checked={!!row.inApp && draft.inApp} disabled={!draft.inApp} onChange={(v) => setPerType(t.key, 'inApp', v)} />
                    </td>
                    <td className="py-3 px-2 text-center">
                      <Toggle checked={!!row.email && draft.email} disabled={!draft.email} onChange={(v) => setPerType(t.key, 'email', v)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Quiet hours */}
      <section className="rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm dark:border-[#142535] dark:bg-[#0A1828]">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
            <Moon size={18} />
          </span>
          <div>
            <h2 className="text-[15px] font-extrabold text-[#0C2340] dark:text-slate-100">Quiet Hours</h2>
            <p className="mt-0.5 text-[12px] text-slate-400 dark:text-slate-500">Suppress email triggers in this window. In-app notifications still appear.</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 items-end">
          <QField label="Start time">
            <TimeInput value={draft.quietHours?.start || ''} onChange={(e) => setQuiet('start', e.target.value)} />
          </QField>
          <QField label="End time">
            <TimeInput value={draft.quietHours?.end || ''} onChange={(e) => setQuiet('end', e.target.value)} />
          </QField>
          <QField label="Timezone" hint={`Browser default: ${browserTz}.`}>
            <TimeInput value={draft.quietHours?.timezone || browserTz} disabled />
          </QField>
          <div className="flex items-end">
            <button type="button" onClick={clearQuiet}
              className="rounded-[10px] border border-slate-200 bg-white px-3 py-2.5 text-[12px] font-bold text-slate-600 hover:bg-slate-50 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-300 dark:hover:bg-[#0A1828]">
              Clear
            </button>
          </div>
        </div>
        {(draft.quietHours?.start && draft.quietHours?.end) && (
          <p className="mt-3 text-[12px] text-slate-400 dark:text-slate-500">
            Quiet hours: <strong className="text-slate-700 dark:text-slate-200">{draft.quietHours.start} – {draft.quietHours.end}</strong>
            {' '}({draft.quietHours.timezone || browserTz}). Email suppressed; in-app notifications still fire.
          </p>
        )}
      </section>

      {/* Save bar */}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setDraft(persisted)} disabled={!isDirty || saving}
          className="rounded-[10px] border border-slate-200 bg-white px-4 py-2 text-[13px] font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-300">
          Cancel
        </button>
        <button type="button" onClick={handleSave} disabled={!isDirty || saving}
          className="inline-flex items-center gap-1.5 rounded-[10px] border border-sky-700 bg-sky-600 px-4 py-2 text-[13px] font-bold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50">
          {saving && <Loader2 size={14} className="animate-spin" />}
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

function QField({ label, hint, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-slate-400 dark:text-slate-500">{hint}</p>}
    </div>
  );
}

function TimeInput({ value, onChange, disabled }) {
  return (
    <input
      type="time"
      value={value}
      onChange={onChange}
      disabled={disabled}
      className={[
        'w-full rounded-[10px] border px-3 py-2.5 text-[13px] text-slate-700 outline-none transition dark:text-slate-200',
        'border-slate-200 bg-white focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-[#142535] dark:bg-[#071220]',
        disabled ? 'cursor-not-allowed opacity-60 dark:bg-[#040D18]' : '',
      ].join(' ')}
    />
  );
}

function ChannelRow({ icon, label, desc, checked, onChange }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-slate-100 py-3 dark:border-[#142535]">
      <div className="flex items-start gap-2.5">
        {icon && (
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-[8px] bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400">
            {icon}
          </span>
        )}
        <div>
          <div className="text-[13px] font-bold text-slate-700 dark:text-slate-200">{label}</div>
          {desc && <div className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">{desc}</div>}
        </div>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}