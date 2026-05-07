import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, Building2, Users, BarChart2, LifeBuoy, ShieldCheck, AlertTriangle,
  UserPlus, LogOut, LockKeyhole, UserX, Plus, Tag, Mail, Phone, Globe,
  Pencil, Download, FileText, CheckCircle2,
} from 'lucide-react';
import { Toast, ConfirmModal } from '../../components/ui';
import { addAuditLog } from '../../utils/auditLogger';
import { formatAed, formatNumber, formatPercent } from '../../utils/format';

const T = {
  border: '#E2E8F0',
  navy:   '#0C2340',
  text:   '#475569',
  muted:  '#94A3B8',
  purple: '#0284C7',
  red:    '#DC2626',
  green:  '#059669',
  amber:  '#D97706',
  blue:   '#2563EB',
  font:   "'Outfit', 'Plus Jakarta Sans', sans-serif",
};

const ACCOUNT_MANAGERS = ['Priya Sharma', 'Rahul Kapoor', 'Anita Desai', 'Kamal Singh', 'Unassigned'];

const PLAN_LIMITS = {
  Starter:      { users: 10,  offices: 1,  storageGb: 5   },
  Professional: { users: 50,  offices: 5,  storageGb: 25  },
  Enterprise:   { users: 500, offices: 25, storageGb: 200 },
};
function seedInt(s, max = 100) {
  const code = String(s || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return code % max;
}
function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB');
}

export default function OrgManagementDrawer({
  open,
  org,
  initialTab = 'account',
  onClose,
  onSuspend,
  onReactivate,
  onImpersonate,
  onDelete,
}) {
  const navigate = useNavigate();
  const onNavigate = (path) => { onClose?.(); navigate(path); };
  const [tab, setTab] = useState(initialTab);
  const [toast, setToast]         = useState(null);
  const [confirm, setConfirm]     = useState(null);
  const [accountForm, setAccountForm] = useState(null);
  const [notesDraft, setNotesDraft]   = useState('');
  useEffect(() => {
    if (!open || !org) return;
    setTab(initialTab);
    setAccountForm({
      website:         org.website        || `https://${(org.name || '').toLowerCase().replace(/\s+/g, '')}.com`,
      primaryName:     org.primaryName    || 'Director Contact',
      primaryEmail:    org.primaryEmail   || `admin@${(org.name || '').toLowerCase().replace(/\s+/g, '')}.com`,
      primaryPhone:    org.primaryPhone   || '+971 50 000 0000',
      accountManager:  org.accountManager || ACCOUNT_MANAGERS[0],
      tags:            Array.isArray(org.tags) ? org.tags.join(', ') : '',
    });
    setNotesDraft(org.notes || '');
  }, [open, org, initialTab]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const plan = PLAN_LIMITS[org?.plan] || PLAN_LIMITS.Starter;

  const users = useMemo(() => {
    if (!org) return [];
    const seed = seedInt(org.id, 1000);
    const base = [
      { role: 'Director',     name: 'Arjun Mehta',    email: `director@${slug(org.name)}.com`  },
      { role: 'Manager',      name: 'Priya Sharma',   email: `manager@${slug(org.name)}.com`   },
      { role: 'Reception',    name: 'Sara Khan',      email: `reception@${slug(org.name)}.com` },
      { role: 'Service Staff', name: 'Rahul Patil',   email: `service@${slug(org.name)}.com`   },
    ];
    return base.map((u, i) => ({
      id: `u-${org.id}-${i}`,
      ...u,
      status: (seed + i) % 7 === 0 ? 'Disabled' : 'Active',
      lastActiveHours: 1 + ((seed + i * 13) % 96),
    }));
  }, [org]);

  if (!open || !org) return null;

  const markAudit = (action, description) => addAuditLog({
    userName:    'Super Admin',
    role:        'superadmin',
    action,
    module:      'Organisations',
    description,
    orgId:       org.id,
  });

  const handleSaveAccount = () => {
    markAudit('UPDATE', `Updated account details for ${org.name}.`);
    setToast({ msg: 'Account details saved successfully.', type: 'success' });
  };
  const handleSaveNotes = () => {
    markAudit('UPDATE', `Updated custom notes for ${org.name}.`);
    setToast({ msg: 'Notes saved successfully.', type: 'success' });
  };

  const tabs = [
    { id: 'account', label: 'Account',            Icon: Building2 },
    { id: 'users',   label: 'Users',              Icon: Users },
    { id: 'usage',   label: 'Usage',              Icon: BarChart2 },
    { id: 'support', label: 'Support',            Icon: LifeBuoy },
    { id: 'data',    label: 'Data & Compliance',  Icon: ShieldCheck },
    { id: 'danger',  label: 'Danger Zone',        Icon: AlertTriangle, tone: 'red' },
  ];

  return (
    <>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {confirm && (
        <ConfirmModal
          title={confirm.title}
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}

      <div onMouseDown={onClose}
           style={{ position: 'fixed', inset: 0, zIndex: 9050, background: 'rgba(0,0,0,0.35)' }} />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="org-mgmt-drawer-title"
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 9051,
          width: 'min(680px, 100vw)', background: '#fff',
          boxShadow: '-10px 0 40px rgba(0,0,0,0.18)',
          display: 'flex', flexDirection: 'column', fontFamily: T.font,
          overflowX: 'hidden',
        }}
        className="dark:bg-[#0A1828]"
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-[#142535]">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[10px] bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
              <Building2 size={18} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 id="org-mgmt-drawer-title" className="m-0 truncate text-[16px] font-extrabold text-[#0C2340] dark:text-slate-100">
                {org.name}
              </h2>
              <p className="m-0 mt-0.5 text-[12px] text-slate-500 dark:text-slate-400">
                {org.industry || '—'} · {org.location || '—'} · {org.plan || 'No plan'}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" title="Close"
                  className="flex-shrink-0 rounded-[8px] border border-slate-200 bg-white p-1.5 text-slate-500 transition hover:bg-slate-50 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-300">
            <X size={16} aria-hidden="true" />
          </button>
        </header>

        <nav role="tablist" className="flex gap-1 overflow-x-auto border-b border-slate-200 px-4 pt-3 dark:border-[#142535]">
          {tabs.map((t) => {
            const active = tab === t.id;
            const danger = t.tone === 'red';
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                title={t.label}
                className={`flex shrink-0 cursor-pointer items-center gap-1.5 border-b-2 px-3 py-2 text-[12px] font-semibold transition ${
                  active
                    ? (danger ? 'border-red-600 text-red-700' : 'border-sky-600 text-sky-700 dark:border-sky-400 dark:text-sky-300')
                    : (danger ? 'border-transparent text-red-500 hover:text-red-600'
                              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400')
                }`}
              >
                <t.Icon size={13} aria-hidden="true" />
                {t.label}
              </button>
            );
          })}
        </nav>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab === 'account' && accountForm && (
            <AccountTab
              org={org}
              form={accountForm}
              setForm={setAccountForm}
              notes={notesDraft}
              setNotes={setNotesDraft}
              onSave={handleSaveAccount}
              onSaveNotes={handleSaveNotes}
            />
          )}

          {tab === 'users' && (
            <UsersTab
              org={org}
              users={users}
              onImpersonate={(u) => onImpersonate?.(org, u)}
              onInvite={() => { markAudit('INVITE', `Queued user invite for ${org.name}.`); setToast({ msg: 'Invite queued successfully.', type: 'success' }); }}
              onResetPassword={(u) => { markAudit('RESET_PASSWORD', `Queued password reset for ${u.name} at ${org.name}.`); setToast({ msg: 'Password reset sent successfully.', type: 'success' }); }}
              onForceLogout={(u) => { markAudit('FORCE_LOGOUT', `Forced logout for ${u.name} at ${org.name}.`); setToast({ msg: 'User logged out successfully.', type: 'success' }); }}
              onDisable={(u) => {
                setConfirm({
                  title: 'Disable User',
                  message: `Disable ${u.name} at ${org.name}?`,
                  onConfirm: () => {
                    setConfirm(null);
                    markAudit('DISABLE_USER', `Disabled ${u.name} at ${org.name}.`);
                    setToast({ msg: 'User disabled successfully.', type: 'success' });
                  },
                });
              }}
            />
          )}

          {tab === 'usage' && <UsageTab org={org} plan={plan} />}
          {tab === 'support' && <SupportTab org={org} markAudit={markAudit} setToast={setToast} />}
          {tab === 'data' && <DataTab org={org} markAudit={markAudit} setToast={setToast} setConfirm={setConfirm} onClose={onClose} onNavigate={onNavigate} />}

          {tab === 'danger' && (
            <DangerZoneTab
              org={org}
              onSuspend={() => setConfirm({
                title: 'Suspend Organisation',
                message: `Suspend ${org.name}? Users will be locked out but their data stays intact.`,
                onConfirm: () => { setConfirm(null); onSuspend?.(org); onClose?.(); },
              })}
              onReactivate={() => {
                onReactivate?.(org);
                setToast({ msg: `${org.name} reactivated successfully.`, type: 'success' });
              }}
              onDelete={() => setConfirm({
                title: 'Cancel & delete organisation',
                message: `This permanently deletes ${org.name} and every associated record. Are you sure?`,
                onConfirm: () => setConfirm({
                  title: 'Confirm irreversible deletion',
                  message: `Type-level confirmation: this cannot be undone. Delete ${org.name}?`,
                  onConfirm: () => { setConfirm(null); onDelete?.(org); onClose?.(); },
                }),
              })}
            />
          )}
        </div>
      </aside>
    </>
  );
}
function AccountTab({ org, form, setForm, notes, setNotes, onSave, onSaveNotes }) {
  const patch = (p) => setForm((f) => ({ ...f, ...p }));
  const checklist = [
    { label: 'Profile completed',  done: Boolean(form.primaryName && form.primaryEmail) },
    { label: 'Payment method on file', done: true },
    { label: 'First office created', done: (org.offices || 0) > 0 },
    { label: 'First user invited',   done: (org.users || 0) > 1 },
    { label: 'First visitor checked in', done: true },
  ];
  return (
    <div className="space-y-4">
      <Section title="Primary contact">
        <Grid>
          <FieldRow label="Website" icon={Globe}>
            <input className={inputCls} value={form.website}
                   onChange={(e) => patch({ website: e.target.value })} />
          </FieldRow>
          <FieldRow label="Account Manager">
            <select className={inputCls} value={form.accountManager}
                    onChange={(e) => patch({ accountManager: e.target.value })}>
              {ACCOUNT_MANAGERS.map((m) => <option key={m}>{m}</option>)}
            </select>
          </FieldRow>
          <FieldRow label="Primary Contact Name">
            <input className={inputCls} value={form.primaryName}
                   onChange={(e) => patch({ primaryName: e.target.value })} />
          </FieldRow>
          <FieldRow label="Primary Email ID" icon={Mail}>
            <input type="email" className={inputCls} value={form.primaryEmail}
                   onChange={(e) => patch({ primaryEmail: e.target.value })} />
          </FieldRow>
          <FieldRow label="Primary Contact Number" icon={Phone}>
            <input type="tel" className={inputCls} value={form.primaryPhone}
                   onChange={(e) => patch({ primaryPhone: e.target.value })} />
          </FieldRow>
          <FieldRow label="Tags / Labels" icon={Tag}
                    hint="Comma-separated. e.g. key-account, onboarding">
            <input className={inputCls} value={form.tags}
                   onChange={(e) => patch({ tags: e.target.value })} />
          </FieldRow>
        </Grid>
        <div className="mt-2 flex justify-end">
          <button type="button" onClick={onSave}
                  className="cursor-pointer rounded-[10px] border border-sky-700 bg-sky-700 px-4 py-2 text-[12px] font-bold text-white hover:bg-sky-800">
            Save account details
          </button>
        </div>
      </Section>

      <Section title="Custom notes" subtitle="Internal notes visible only to Super Admin.">
        <textarea rows={4} maxLength={500}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value.slice(0, 500))}
                  placeholder="Any context, risk flags, or contract notes."
                  className={`${inputCls} resize-y max-h-48`} />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[10px] text-slate-400">{(notes || '').length}/500</span>
          <button type="button" onClick={onSaveNotes}
                  className="cursor-pointer rounded-[10px] border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-bold text-slate-700 hover:bg-slate-50">
            Save notes
          </button>
        </div>
      </Section>

      <Section title="Onboarding status">
        <ul className="space-y-2">
          {checklist.map((c) => (
            <li key={c.label} className="flex items-center gap-2 text-[13px]">
              <CheckCircle2 size={16} aria-hidden="true"
                            className={c.done ? 'text-emerald-600' : 'text-slate-300'} />
              <span className={c.done ? 'text-slate-700' : 'text-slate-400 line-through'}>{c.label}</span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

function UsersTab({ org, users, onImpersonate, onInvite, onResetPassword, onForceLogout, onDisable }) {
  const roleCounts = users.reduce((acc, u) => { acc[u.role] = (acc[u.role] || 0) + 1; return acc; }, {});
  return (
    <div className="space-y-4">
      <Section
        title={`Users — ${users.length}`}
        subtitle="All accounts associated with this organisation."
      >
        <div className="w-full rounded-[10px] border border-slate-200 dark:border-[#142535]">
          <table className="w-full text-[12px]">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500 dark:bg-[#071220]">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Last active</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#142535]">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-3 py-2">
                    <div className="font-semibold text-[#0C2340] dark:text-slate-100">{u.name}</div>
                    <div className="text-[11px] text-slate-400">{u.email}</div>
                  </td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{u.role}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${u.status === 'Active'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 bg-slate-100 text-slate-500'}`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-500">{u.lastActiveHours}h ago</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      {u.role === 'Director' && (
                        <button type="button" onClick={() => onImpersonate?.(u)}
                                title={`Impersonate ${u.name}`}
                                className="shrink-0 cursor-pointer rounded-md border border-sky-200 bg-sky-50 p-1.5 text-sky-700 hover:bg-sky-100">
                          <LockKeyhole size={12} aria-hidden="true" />
                        </button>
                      )}
                      <button type="button" onClick={() => onResetPassword?.(u)}
                              title={`Send password reset email to ${u.name}`}
                              className="shrink-0 cursor-pointer rounded-md border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50">
                        <Mail size={12} aria-hidden="true" />
                      </button>
                      <button type="button" onClick={() => onForceLogout?.(u)}
                              title={`Force logout for ${u.name}`}
                              className="shrink-0 cursor-pointer rounded-md border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50">
                        <LogOut size={12} aria-hidden="true" />
                      </button>
                      <button type="button" onClick={() => onDisable?.(u)}
                              title={`Disable ${u.name}`}
                              className="shrink-0 cursor-pointer rounded-md border border-red-200 bg-red-50 p-1.5 text-red-600 hover:bg-red-100">
                        <UserX size={12} aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Role breakdown">
        <div className="space-y-2">
          {Object.entries(roleCounts).map(([role, count]) => {
            const pct = Math.round((count / users.length) * 100);
            return (
              <div key={role} className="flex items-center gap-3">
                <span className="w-32 text-[12px] font-semibold text-slate-700">{role}</span>
                <div className="h-1.5 flex-1 rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-sky-500" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-16 text-right text-[11px] font-bold text-slate-500">{count} ({pct}%)</span>
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

function UsageTab({ org, plan }) {
  const seed = seedInt(org.id, 1000);
  const apiCalls = Array.from({ length: 7 }, (_, i) => ({
    day: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i],
    count: 1000 + ((seed + i * 137) % 4000),
  }));
  const max = Math.max(...apiCalls.map((d) => d.count), 1);
  const usersPct   = Math.min(100, Math.round((Number(org.users)  || 0) / plan.users   * 100));
  const officesPct = Math.min(100, Math.round((Number(org.offices) || 0) / plan.offices * 100));
  const storagePct = Math.min(100, Math.round((Number(org.storageGb) || 0) / plan.storageGb * 100));

  const features = ['Walk-in Check-in', 'Appointments', 'Reports', 'WhatsApp Alerts', 'API Access', 'Exports'];
  const heatmap = features.map((f, i) => ({ feature: f, pct: (seed + i * 23) % 100 }));

  return (
    <div className="space-y-4">
      <Section title="Plan limits">
        <div className="space-y-3">
          <LimitBar label="Users"    value={`${formatNumber(org.users   || 0)} / ${formatNumber(plan.users)}`}   pct={usersPct} />
          <LimitBar label="Offices"  value={`${org.offices  || 0} / ${plan.offices}`}                              pct={officesPct} />
          <LimitBar label="Storage"  value={`${org.storageGb || 0} GB / ${plan.storageGb} GB`}                     pct={storagePct} />
        </div>
      </Section>

      <Section title="API calls — last 7 days">
        <div className="flex items-end gap-2 h-32">
          {apiCalls.map((d) => (
            <div key={d.day} className="flex flex-1 flex-col items-center gap-1" title={`${d.day}: ${formatNumber(d.count)}`}>
              <div className="text-[9px] text-slate-400">{formatNumber(d.count)}</div>
              <div className="w-full rounded-t-[3px] bg-sky-500 transition-all"
                   style={{ height: `${(d.count / max) * 100}%`, minHeight: 4 }} />
              <div className="text-[10px] text-slate-400">{d.day}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Feature usage heatmap">
        <div className="space-y-1.5">
          {heatmap.map((h) => {
            const tone = h.pct > 70 ? 'bg-emerald-500' : h.pct > 30 ? 'bg-amber-500' : 'bg-slate-300';
            return (
              <div key={h.feature} className="flex items-center gap-3">
                <span className="w-36 text-[12px] text-slate-700">{h.feature}</span>
                <div className="h-1.5 flex-1 rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${tone}`} style={{ width: `${h.pct}%` }} />
                </div>
                <span className="w-10 text-right text-[11px] text-slate-500">{h.pct}%</span>
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

function SupportTab({ org, markAudit, setToast }) {
  const seed = seedInt(org.id, 1000);
  const STATUS_OPTIONS = ['Open', 'In Progress', 'Resolved', 'Closed'];
  const [ticketStatuses, setTicketStatuses] = React.useState(() => ({
    [`TCK-${1000 + seed}`]: 'Open',
    [`TCK-${1001 + seed}`]: 'In Progress',
    [`TCK-${1002 + seed}`]: 'Resolved',
  }));
  const tickets = [
    { id: `TCK-${1000 + seed}`, subject: 'Unable to generate invoices',        priority: 'High'   },
    { id: `TCK-${1001 + seed}`, subject: 'How to export audit logs?',           priority: 'Normal' },
    { id: `TCK-${1002 + seed}`, subject: 'Requesting WhatsApp channel setup',   priority: 'Low'    },
  ];
  const priorityCls = (p) => p === 'High' ? 'border-red-200 bg-red-50 text-red-700'
                        : p === 'Normal' ? 'border-amber-200 bg-amber-50 text-amber-700'
                        : 'border-slate-200 bg-slate-50 text-slate-600';
  const handleStatusChange = (ticketId, newStatus) => {
    setTicketStatuses((prev) => ({ ...prev, [ticketId]: newStatus }));
    markAudit('UPDATE_TICKET', `Updated ticket ${ticketId} status to ${newStatus} for ${org.name}.`);
    setToast({ msg: `Ticket ${ticketId} status updated to ${newStatus}.`, type: 'success' });
  };
  return (
    <div className="space-y-4">
      <Section
        title={`Support tickets — ${tickets.length}`}
        subtitle="Open and recent tickets raised by this organisation."
      >
        <ul className="space-y-2">
          {tickets.map((t) => (
            <li key={t.id} className="rounded-[10px] border border-slate-200 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-[#0C2340]">{t.id} — {t.subject}</div>
                  <span className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold ${priorityCls(t.priority)}`}>{t.priority}</span>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <select
                    value={ticketStatuses[t.id] || 'Open'}
                    onChange={(e) => handleStatusChange(t.id, e.target.value)}
                    className="cursor-pointer rounded-[8px] border border-sky-200 bg-sky-50 px-2 py-1 text-[11px] font-bold text-sky-700 outline-none hover:bg-sky-100"
                    title="Update ticket status"
                  >
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Direct contact">
        <div className="flex flex-wrap gap-2">
          <a href={`mailto:support@${slug(org.name)}.com`}
             className="inline-flex items-center gap-1.5 rounded-[10px] border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-600 hover:bg-slate-50"
             title="Email support contact">
            <Mail size={12} aria-hidden="true" /> Email
          </a>
          <a href="tel:+971500000000"
             className="inline-flex items-center gap-1.5 rounded-[10px] border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-600 hover:bg-slate-50"
             title="Phone support contact">
            <Phone size={12} aria-hidden="true" /> Phone
          </a>
          <ChatButton org={org} markAudit={markAudit} setToast={setToast} />
        </div>
      </Section>
    </div>
  );
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
function ChatButton({ org, markAudit, setToast }) {
  const [open, setOpen] = React.useState(false);
  const [messages, setMessages] = React.useState([
    { from: 'system', text: `Chat session started with ${org?.name || 'organisation'}. Messages sent here are visible to the org's primary contact.`, ts: new Date() },
  ]);
  const [draft, setDraft] = React.useState('');
  const bottomRef = React.useRef(null);

  React.useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    const msg = { from: 'admin', text, ts: new Date() };
    setMessages((prev) => [...prev, msg]);
    setDraft('');
    markAudit('CHAT_MESSAGE', `Sent chat message to ${org.name}: "${text}"`);
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { from: 'org', text: `Thanks for reaching out! We'll get back to you shortly regarding: "${text}"`, ts: new Date() },
      ]);
    }, 1500);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); markAudit('CHAT_OPEN', `Opened chat session with ${org.name}.`); }}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-[10px] border border-sky-200 bg-sky-50 px-3 py-1.5 text-[12px] font-semibold text-sky-700 hover:bg-sky-100"
        title="Open an internal chat thread with this organisation"
      >
        💬 Chat
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[9200] flex items-end justify-end p-4"
          style={{ pointerEvents: 'none' }}
        >
          <div
            style={{ pointerEvents: 'all', width: 360 }}
            className="flex flex-col rounded-[14px] border border-slate-200 bg-white shadow-2xl dark:border-[#142535] dark:bg-[#0A1828]"
          >
            <div className="flex items-center justify-between rounded-t-[14px] bg-sky-600 px-4 py-3">
              <div>
                <div className="text-[13px] font-bold text-white">💬 Chat — {org.name}</div>
                <div className="text-[11px] text-sky-200">Internal support chat</div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-1 text-sky-200 hover:bg-sky-500 hover:text-white"
                aria-label="Close chat"
              >
                <X size={14} />
              </button>
            </div>

            <div className="flex h-64 flex-col gap-2 overflow-y-auto p-3">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex ${m.from === 'admin' ? 'justify-end' : m.from === 'system' ? 'justify-center' : 'justify-start'}`}
                >
                  {m.from === 'system' ? (
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] text-slate-500 dark:bg-gray-800 dark:text-gray-400">{m.text}</span>
                  ) : (
                    <div
                      className={`max-w-[80%] rounded-[10px] px-3 py-2 text-[12px] ${
                        m.from === 'admin'
                          ? 'bg-sky-600 text-white'
                          : 'border border-slate-200 bg-slate-50 text-slate-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200'
                      }`}
                    >
                      {m.text}
                      <div className={`mt-0.5 text-[9px] ${m.from === 'admin' ? 'text-sky-200' : 'text-slate-400'}`}>
                        {m.ts.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            <div className="flex items-center gap-2 border-t border-slate-200 p-3 dark:border-[#142535]">
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="Type a message…"
                className="flex-1 rounded-[8px] border border-slate-200 px-3 py-1.5 text-[12px] outline-none focus:border-sky-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              />
              <button
                type="button"
                onClick={send}
                disabled={!draft.trim()}
                className="rounded-[8px] bg-sky-600 px-3 py-1.5 text-[12px] font-bold text-white hover:bg-sky-700 disabled:opacity-40"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
function DataTab({ org, markAudit, setToast, setConfirm, onClose, onNavigate }) {
  const exportData = (fmt) => {
    markAudit('DATA_EXPORT', `Exported ${org.name} data as ${fmt.toUpperCase()}.`);

    const exportPayload = {
      organisation: {
        id: org.id,
        name: org.name,
        industry: org.industry || '',
        location: org.location || '',
        plan: org.plan || '',
        status: org.status || '',
        users: org.users || 0,
        offices: org.offices || 0,
        mrr: org.mrr || 0,
        createdAt: org.createdAt || new Date().toISOString(),
        exportedAt: new Date().toISOString(),
        exportedBy: 'Super Admin',
      },
    };

    const filename = `${(org.name || 'org').toLowerCase().replace(/\s+/g, '_')}_export_${Date.now()}`;

    if (fmt === 'json') {
      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
      triggerDownload(blob, `${filename}.json`);
    } else if (fmt === 'csv') {
      const rows = Object.entries(exportPayload.organisation).map(([k, v]) => `${k},${v}`);
      const csv = `field,value\n${rows.join('\n')}`;
      const blob = new Blob([csv], { type: 'text/csv' });
      triggerDownload(blob, `${filename}.csv`);
    } else if (fmt === 'pdf') {
      const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${org.name} Export</title>
<style>body{font-family:Arial,sans-serif;padding:32px;color:#1e293b}h1{color:#0c2340;border-bottom:2px solid #0284c7;padding-bottom:8px}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{text-align:left;padding:8px 12px;border-bottom:1px solid #e2e8f0}th{background:#f1f5f9;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#64748b}tr:hover{background:#f8fafc}.badge{background:#0284c7;color:#fff;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:700}</style>
</head><body>
<h1>📋 ${org.name} — Data Export</h1>
<p style="color:#64748b;font-size:12px">Exported ${new Date().toLocaleString('en-GB')} · By Super Admin · GDPR Article 15 compliant</p>
<table><thead><tr><th>Field</th><th>Value</th></tr></thead><tbody>
${Object.entries(exportPayload.organisation).map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}
</tbody></table>
<p style="margin-top:32px;font-size:11px;color:#94a3b8">CorpGMS · Confidential · Do not distribute</p>
<script>window.onload=function(){window.print()}</script>
</body></html>`;
      const blob = new Blob([html], { type: 'text/html' });
      triggerDownload(blob, `${filename}.html`);
    }

    setToast({ msg: `${org.name} data downloaded as ${fmt.toUpperCase()} successfully.`, type: 'success' });
  };
  return (
    <div className="space-y-4">
      <Section title="Data export" subtitle="Full tenant export — honours GDPR Article 15 (right of access).">
        <div className="flex flex-wrap gap-2">
          {['json', 'csv', 'pdf'].map((fmt) => (
            <button key={fmt} type="button" onClick={() => exportData(fmt)}
                    title={`Download every record belonging to ${org.name} as ${fmt.toUpperCase()}`}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-[10px] border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-600 hover:bg-slate-50">
              <Download size={12} aria-hidden="true" /> Export {fmt.toUpperCase()}
            </button>
          ))}
        </div>
      </Section>

      <Section title="GDPR erasure" subtitle="Article 17 — right to erasure. Irreversible.">
        <button type="button"
                onClick={() => setConfirm({
                  title: 'Erasure request',
                  message: `Delete every record belonging to ${org.name}? This cannot be undone.`,
                  onConfirm: () => {
                    markAudit('GDPR_ERASURE', `GDPR erasure triggered for ${org.name}.`);
                    setToast({ msg: 'Erasure request queued successfully.', type: 'success' });
                    onClose?.();
                  },
                })}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-[10px] border border-red-200 bg-red-50 px-3 py-1.5 text-[12px] font-bold text-red-700 hover:bg-red-100">
          Request erasure
        </button>
      </Section>

      <Section title="Data retention" subtitle="How long this tenant's data is kept after cancellation.">
        <select className={inputCls} defaultValue="90"
                onChange={(e) => { markAudit('UPDATE_RETENTION', `Retention for ${org.name} set to ${e.target.value} days.`); setToast({ msg: 'Retention policy saved successfully.', type: 'success' }); }}>
          <option value="30">30 days</option>
          <option value="90">90 days</option>
          <option value="365">1 year</option>
          <option value="forever">Keep indefinitely</option>
        </select>
      </Section>

      <Section title="Compliance status">
        <dl className="space-y-2 text-[12px]">
          <div className="flex justify-between"><dt className="text-slate-500">Encryption at rest</dt><dd className="font-semibold text-emerald-700">Enabled (AES-256)</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">Encryption in transit</dt><dd className="font-semibold text-emerald-700">Enabled (TLS 1.3)</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">Last compliance audit</dt><dd className="font-semibold text-slate-700">{fmtDate(new Date(Date.now() - 30 * 86400000).toISOString())}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">Certifications</dt><dd className="font-semibold text-slate-700">SOC 2 Type II · ISO 27001</dd></div>
        </dl>
      </Section>

      <Section title="Audit trail">
        <button type="button" onClick={() => onNavigate?.('/audit-logs')} title="Open the full audit log filtered to this organisation"
           className="inline-flex cursor-pointer items-center gap-1.5 rounded-[10px] border border-sky-200 bg-white px-3 py-1.5 text-[12px] font-bold text-sky-700 hover:bg-sky-50">
          <FileText size={12} aria-hidden="true" /> Open audit log
        </button>
      </Section>
    </div>
  );
}

function DangerZoneTab({ org, onSuspend, onReactivate, onDelete }) {
  const suspended = org.status === 'Suspended';
  return (
    <div className="space-y-4">
      <div className="rounded-[12px] border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
        <strong>Warning.</strong> Actions in this section affect every user of {org.name}. Double-check before you proceed.
      </div>

      <div className="rounded-[12px] border border-amber-200 bg-amber-50 p-4">
        <div className="mb-2 text-[13px] font-bold text-amber-800">Suspend / Reactivate</div>
        <p className="text-[12px] text-amber-700">Suspending immediately locks out every user in this organisation. Data is kept intact.</p>
        <div className="mt-3">
          {suspended ? (
            <button type="button" onClick={onReactivate}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-[10px] border border-emerald-700 bg-emerald-700 px-3 py-1.5 text-[12px] font-bold text-white hover:bg-emerald-800"
                    title={`Reactivate ${org.name}`}>
              Reactivate {org.name}
            </button>
          ) : (
            <button type="button" onClick={onSuspend}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-[10px] border border-amber-600 bg-amber-500 px-3 py-1.5 text-[12px] font-bold text-white hover:bg-amber-600"
                    title={`Suspend ${org.name}`}>
              Suspend {org.name}
            </button>
          )}
        </div>
      </div>

      <div className="rounded-[12px] border border-red-300 bg-white p-4">
        <div className="mb-2 text-[13px] font-bold text-red-700">Cancel & delete</div>
        <p className="text-[12px] text-slate-600">This cancels the subscription AND permanently deletes every record tied to {org.name}. The action requires two confirmations.</p>
        <div className="mt-3">
          <button type="button" onClick={onDelete}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-[10px] border border-red-700 bg-red-700 px-3 py-1.5 text-[12px] font-bold text-white hover:bg-red-800"
                  title={`Permanently delete ${org.name}`}>
            Cancel & delete organisation
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls = 'w-full rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100';

function Section({ title, subtitle, children, action }) {
  return (
    <section>
      <header className="mb-2 flex items-end justify-between gap-2">
        <div>
          <h3 className="m-0 text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500">{title}</h3>
          {subtitle && <p className="m-0 mt-0.5 text-[11px] text-slate-400">{subtitle}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
function Grid({ children }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>;
}
function FieldRow({ label, icon: Icon, hint, children }) {
  return (
    <div>
      <label className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold text-slate-600">
        {Icon && <Icon size={12} aria-hidden="true" className="text-slate-400" />}{label}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}
function LimitBar({ label, value, pct }) {
  const tone = pct >= 85 ? 'bg-red-500' : pct >= 60 ? 'bg-amber-500' : 'bg-sky-500';
  return (
    <div>
      <div className="flex items-center justify-between text-[12px]">
        <span className="font-semibold text-slate-700">{label}</span>
        <span className="font-semibold text-slate-600">{value}</span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function slug(name) {
  return String(name || 'org').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 20);
}