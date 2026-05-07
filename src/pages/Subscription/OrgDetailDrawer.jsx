import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, Building2, CreditCard, Clock, Users, MapPin,
  PauseCircle, AlertTriangle, BadgePercent, PlusCircle, Send,
} from 'lucide-react';

const ClockIcon = Clock;
import { Toast, ConfirmModal } from '../../components/ui';
import { addAuditLog } from '../../utils/auditLogger';
import { safeGet } from '../../utils/storage';

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

const fmtAED  = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN');
};
const daysUntil = (iso) => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.round((t - Date.now()) / (24 * 60 * 60 * 1000));
};

/**
 * OrgDetailDrawer — right-side sliding panel that shows an organisation's
 * full subscription record across four tabs (Overview / Payments /
 * Activity / Actions).
 *
 * Props:
 *   open       boolean
 *   org        organisation object (from migrateOrganization)
 *   plan       matched plan object (for usage limits) — optional
 *   onClose()
 *   onChangePlan(org)       → Super Admin opens the change-plan modal
 *   onPauseSubscription(org)
 *   onCancelSubscription(org)
 *   onSendAnnouncement(org)
 */
export default function OrgDetailDrawer({
  open,
  org,
  plan,
  onClose,
  onChangePlan,
  onPauseSubscription,
  onCancelSubscription,
  onSendAnnouncement,
}) {
  const navigate = useNavigate();
  const [tab, setTab]     = useState('overview');
  const [toast, setToast] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [creditsOpen, setCreditsOpen]   = useState(false);

  /* Reset tab when switching orgs. */
  useEffect(() => { if (open) setTab('overview'); }, [open, org?.id]);

  /* Close on Esc. */
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  /* Audit log for this specific org — filtered from the persisted log. */
  const orgActivity = useMemo(() => {
    if (!org) return [];
    const all = safeGet('audit_logs', []);
    if (!Array.isArray(all)) return [];
    const needle = String(org.name || '').toLowerCase();
    return all
      .filter((e) => {
        if (!e) return false;
        const hay = `${e.description || ''} ${e.orgId || ''}`.toLowerCase();
        return (e.orgId && e.orgId === org.id) || hay.includes(needle);
      })
      .slice(0, 20);
  }, [org]);

  if (!open || !org) return null;

  const daysToRenewal = daysUntil(org.endDate);
  const trialDays     = daysUntil(org.trialEndsAt);

  const usage = buildUsageRows(org, plan);
  const payments = buildPaymentHistory(org);
  const totalPaid = payments
    .filter((p) => p.status === 'Paid')
    .reduce((sum, p) => sum + p.amount, 0);

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'payments', label: 'Payments' },
    { id: 'activity', label: 'Activity' },
    { id: 'actions',  label: 'Actions'  },
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

      {/* Backdrop */}
      <div
        onMouseDown={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 9050, background: 'rgba(0,0,0,0.35)' }}
      />

      {/* Drawer */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="org-drawer-title"
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 9051,
          width: 'min(600px, 100vw)', background: '#fff', boxShadow: '-10px 0 40px rgba(0,0,0,0.18)', overflowX: 'hidden',
          display: 'flex', flexDirection: 'column',
          fontFamily: T.font,
        }}
        className="dark:bg-[#0A1828]"
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-[#142535]">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[10px] bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
              <Building2 size={18} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 id="org-drawer-title" className="m-0 truncate text-[16px] font-extrabold text-[#0C2340] dark:text-slate-100">
                {org.name}
              </h2>
              <p className="m-0 mt-0.5 text-[12px] text-slate-500 dark:text-slate-400">
                {org.industry || '—'} · {org.location || '—'}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close drawer" title="Close"
                  className="flex-shrink-0 rounded-[8px] border border-slate-200 bg-white p-1.5 text-slate-500 transition hover:bg-slate-50 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-300 dark:hover:bg-[#1E1E3F]">
            <X size={16} aria-hidden="true" />
          </button>
        </header>

        {/* Tabs */}
        <nav className="flex gap-2 border-b border-slate-200 px-5 pt-3 dark:border-[#142535]" role="tablist">
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                className={`cursor-pointer border-b-2 px-3 py-2 text-[13px] font-semibold transition ${
                  active ? 'border-sky-600 text-sky-700 dark:border-sky-400 dark:text-sky-300'
                         : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </nav>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab === 'overview' && (
            <div className="space-y-4">
              <section>
                <h3 className="m-0 mb-2 text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400">Plan</h3>
                <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-4 dark:border-[#142535] dark:bg-[#071220]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/30 dark:bg-sky-500/10 dark:text-sky-300">
                      {org.plan || '—'}
                    </span>
                    <span className="text-[13px] font-bold text-[#0C2340] dark:text-slate-100">
                      {fmtAED(org.price || org.mrr || 0)} per {org.billingCycle === 'yearly' ? 'Year' : 'Month'}
                    </span>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[12px]">
                    <div className="flex flex-col">
                      <dt className="text-slate-500 dark:text-slate-400">Since</dt>
                      <dd className="font-semibold text-slate-700 dark:text-slate-200">{fmtDate(org.startDate)}</dd>
                    </div>
                    <div className="flex flex-col">
                      <dt className="text-slate-500 dark:text-slate-400">Next renewal</dt>
                      <dd className="font-semibold text-slate-700 dark:text-slate-200">
                        {fmtDate(org.endDate)}
                        {daysToRenewal != null && Number.isFinite(daysToRenewal) && (
                          <span className={`ml-2 text-[11px] font-bold ${daysToRenewal <= 7 ? 'text-amber-600 dark:text-amber-300' : 'text-slate-400'}`}>
                            {daysToRenewal >= 0 ? `in ${daysToRenewal}d` : `${Math.abs(daysToRenewal)}d overdue`}
                          </span>
                        )}
                      </dd>
                    </div>
                    {org.effectiveStatus === 'Trial' && trialDays != null && (
                      <div className="flex flex-col col-span-2">
                        <dt className="text-slate-500 dark:text-slate-400">Trial ends</dt>
                        <dd className="font-semibold text-amber-700 dark:text-amber-300">
                          {fmtDate(org.trialEndsAt)} · in {trialDays}d
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
              </section>

              <section>
                <h3 className="m-0 mb-2 text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400">Usage</h3>
                <div className="space-y-2">
                  {usage.map((u) => (
                    <div key={u.label}>
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5">
                          <u.Icon size={12} aria-hidden="true" className="text-slate-400" />{u.label}
                        </span>
                        <span className="font-semibold text-slate-600 dark:text-slate-300">{u.display}</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-slate-100 dark:bg-[#142535]">
                        <div
                          className={`h-full rounded-full ${u.pct >= 85 ? 'bg-red-500' : u.pct >= 60 ? 'bg-amber-500' : 'bg-sky-500'}`}
                          style={{ width: `${Math.min(100, u.pct)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {tab === 'payments' && (
            <div className="space-y-3">
              <div className="rounded-[12px] border border-slate-200 bg-slate-50 px-4 py-3 dark:border-[#142535] dark:bg-[#071220] flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Total paid (lifetime)</div>
                  <div className="mt-1 text-[18px] font-black text-[#0C2340] dark:text-slate-100 font-['Outfit',sans-serif]">{fmtAED(totalPaid)}</div>
                </div>
                <button type="button"
                        onClick={() => setToast({ msg: 'Invoice bundle prepared for download.', type: 'success' })}
                        title="Download every invoice for this organisation as a ZIP"
                        className="cursor-pointer rounded-[8px] border border-sky-200 bg-white px-3 py-1.5 text-[12px] font-bold text-sky-700 hover:bg-sky-50 dark:bg-transparent">
                  Download All Invoices
                </button>
              </div>

              <div className="overflow-x-auto rounded-[12px] border border-slate-200 dark:border-[#142535]">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500 dark:bg-[#071220]">
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Invoice</th>
                      <th className="px-3 py-2">Amount</th>
                      <th className="px-3 py-2">Method</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#142535]">
                    {payments.map((p) => (
                      <tr key={p.id} className={p.status === 'Failed' ? 'bg-red-50/60 dark:bg-red-500/5' : ''}>
                        <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{fmtDate(p.date)}</td>
                        <td className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200">{p.invoice}</td>
                        <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{fmtAED(p.amount)}</td>
                        <td className="px-3 py-2 text-slate-700 dark:text-slate-200 text-[11px] font-semibold">
                          {p.paymentMethod
                            ? (p.paymentMethod === 'UPI' ? 'UPI'
                              : p.paymentMethod === 'CARD' ? 'Card'
                              : p.paymentMethod === 'NETBANKING' ? 'Net Banking'
                              : p.paymentMethod)
                            : '—'}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                            p.status === 'Paid'    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300' :
                            p.status === 'Pending' ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300' :
                                                     'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300'
                          }`}>{p.status}</span>
                        </td>
                        <td className="px-3 py-2">
                          {p.status === 'Failed' ? (
                            <button type="button" title={`Retry payment ${p.invoice}`}
                                    onClick={() => {
                                      setToast({ msg: `Retry queued for ${p.invoice}.`, type: 'success' });
                                      addAuditLog({ userName: 'Super Admin', role: 'superadmin', action: 'BILLING_RETRY', module: 'Subscription',
                                                    description: `Queued retry for invoice ${p.invoice} (${org.name}).` });
                                    }}
                                    className="cursor-pointer rounded-[6px] border border-red-300 bg-white px-2 py-0.5 text-[10px] font-bold text-red-700 hover:bg-red-50 dark:bg-transparent">
                              Retry
                            </button>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {payments.length === 0 && (
                      <tr><td colSpan={6} className="px-3 py-4 text-center text-slate-400">No invoices yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'activity' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="m-0 text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400">Last 20 events</h3>
                <button type="button"
                  onClick={() => { onClose?.(); navigate('/audit-logs'); }}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-bold text-sky-700 hover:bg-sky-100"
                  title="View full audit trail">
                  📋 View Full Trail
                </button>
              </div>
              {orgActivity.length === 0 ? (
                <p className="text-[12px] text-slate-400">No audit events for this organisation yet.</p>
              ) : (
                <ol className="relative ml-2 space-y-3 border-l border-slate-200 pl-4 dark:border-[#142535]">
                  {orgActivity.map((e, i) => (
                    <li key={e.id || `${e.timestamp}-${i}`} className="relative">
                      <span className="absolute -left-[22px] top-1 inline-block h-2.5 w-2.5 rounded-full bg-sky-500 ring-2 ring-white dark:ring-[#0A1828]" aria-hidden="true" />
                      <div className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">
                        {e.action || '—'} · <span className="font-normal text-slate-500 dark:text-slate-400">{e.module || '—'}</span>
                      </div>
                      <div className="text-[12px] text-slate-600 dark:text-slate-300">{e.description || ''}</div>
                      <div className="text-[11px] text-slate-400">{fmtDate(e.timestamp)} · {e.userName || 'System'}</div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}

          {tab === 'actions' && (
            <div className="space-y-3">
              <ActionRow
                Icon={CreditCard} title="Change Plan"
                description="Open the plan editor to switch this organisation to a different tier or billing cycle."
                cta="Change Plan" tone={T.purple}
                onClick={() => onChangePlan?.(org)}
              />
              <ActionRow
                Icon={BadgePercent} title="Apply Discount"
                description="Offer a percentage or fixed-₹ discount on this org's next renewal."
                cta="Apply Discount" tone={T.blue}
                onClick={() => setDiscountOpen(true)}
              />
              <ActionRow
                Icon={PlusCircle} title="Add Credits"
                description="Credit the org's account (e.g. for service-level credits or goodwill)."
                cta="Add Credits" tone={T.green}
                onClick={() => setCreditsOpen(true)}
              />
              <ActionRow
                Icon={PauseCircle} title="Pause Subscription"
                description="Pauses billing until the org reactivates. Their users remain signed in."
                cta="Pause" tone={T.amber}
                onClick={() => setConfirm({
                  title: 'Pause Subscription',
                  message: `Pause ${org.name}'s subscription?`,
                  onConfirm: () => { setConfirm(null); onPauseSubscription?.(org); },
                })}
              />
              <ActionRow
                Icon={AlertTriangle} title="Cancel Subscription" destructive
                description={`Cancel ${org.name}'s subscription. They will retain access until ${fmtDate(org.endDate)}.`}
                cta="Cancel" tone={T.red}
                onClick={() => setConfirm({
                  title: 'Cancel Subscription',
                  message: `Cancel ${org.name}'s subscription? They will retain access until ${fmtDate(org.endDate)}.`,
                  onConfirm: () => { setConfirm(null); onCancelSubscription?.(org); onClose?.(); },
                })}
              />
              <ActionRow
                Icon={Send} title="Send Announcement"
                description="Broadcast a message to every user in this organisation."
                cta="Send" tone={T.purple}
                onClick={() => onSendAnnouncement?.(org)}
              />
            </div>
          )}
        </div>
      </aside>

      {discountOpen && (
        <SimpleInputModal
          title={`Apply discount to ${org.name}`}
          label="Discount"
          placeholder="e.g. 10% or ₹500"
          onSave={(value) => {
            setDiscountOpen(false);
            setToast({ msg: `Discount applied successfully.`, type: 'success' });
            addAuditLog({ userName: 'Super Admin', role: 'superadmin', action: 'DISCOUNT_APPLIED', module: 'Subscription',
                          description: `Applied discount "${value}" to ${org.name}.` });
          }}
          onCancel={() => setDiscountOpen(false)}
        />
      )}
      {creditsOpen && (
        <SimpleInputModal
          title={`Add credits to ${org.name}`}
          label="Credits (₹)"
          placeholder="e.g. 500"
          onSave={(value) => {
            setCreditsOpen(false);
            setToast({ msg: `Credits added successfully.`, type: 'success' });
            addAuditLog({ userName: 'Super Admin', role: 'superadmin', action: 'CREDITS_ADDED', module: 'Subscription',
                          description: `Added ₹${value} credits to ${org.name}.` });
          }}
          onCancel={() => setCreditsOpen(false)}
        />
      )}
    </>
  );
}

/* ─── Internal helpers ──────────────────────────────────────────────── */

function ActionRow({ Icon, title, description, cta, tone, destructive, onClick }) {
  return (
    <div className={`rounded-[12px] border p-4 ${destructive ? 'border-red-200 dark:border-red-500/30' : 'border-slate-200 dark:border-[#142535]'} bg-white dark:bg-[#071220]`}>
      <div className="flex items-start gap-3">
        <Icon size={18} aria-hidden="true" style={{ color: tone }} className="mt-0.5 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-bold text-[#0C2340] dark:text-slate-100">{title}</div>
          <div className="mt-0.5 text-[12px] text-slate-500 dark:text-slate-400">{description}</div>
        </div>
        <button type="button" onClick={onClick} title={title}
                style={{ borderColor: tone, color: destructive ? '#fff' : tone, background: destructive ? tone : '#fff' }}
                className={`flex-shrink-0 cursor-pointer rounded-[8px] border px-3 py-1.5 text-[11px] font-bold transition ${destructive ? 'hover:opacity-90' : 'hover:bg-slate-50'}`}>
          {cta}
        </button>
      </div>
    </div>
  );
}

function SimpleInputModal({ title, label, placeholder, onSave, onCancel }) {
  const [value, setValue] = useState('');
  return (
    <div role="dialog" aria-modal="true"
         style={{ position: 'fixed', inset: 0, zIndex: 9100, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
         onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div style={{ width: '100%', maxWidth: 420, background: '#fff', borderRadius: 14, padding: 20, fontFamily: T.font }}>
        <h3 className="m-0 text-[15px] font-extrabold text-[#0C2340]">{title}</h3>
        <label className="mt-3 block text-[12px] font-bold text-slate-600">{label}<span className="text-red-500">*</span></label>
        <input
          autoFocus value={value} onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="mt-1 w-full rounded-[10px] border border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
        />
        <div className="mt-4 flex gap-2 justify-end">
          <button onClick={onCancel}
                  className="cursor-pointer rounded-[10px] border border-slate-200 bg-white px-4 py-2 text-[12px] font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
          <button
            onClick={() => { if (!value.trim()) return; onSave(value.trim()); }}
            disabled={!value.trim()}
            className="cursor-pointer rounded-[10px] border border-sky-700 bg-sky-700 px-4 py-2 text-[12px] font-bold text-white hover:bg-sky-800 disabled:opacity-50 disabled:cursor-not-allowed">Save</button>
        </div>
      </div>
    </div>
  );
}

/* Deterministic usage rows — the demo seed doesn't carry live counters,
 * so we derive believable figures from the plan's cap + the org's users. */
function buildUsageRows(org, plan) {
  const maxUsers      = plan?.users       != null ? Number(plan.users)       : 50;
  const maxOffices    = plan?.offices     != null ? Number(plan.offices)     : 5;
  const maxVisitors   = plan?.visitors    != null ? Number(plan.visitors)    : 5000;
  const maxStorage    = plan?.maxStorageGb != null ? Number(plan.maxStorageGb) : 25;

  /* Pseudo-stable jitter tied to the org id so the numbers don't change
   * every render but also aren't identical across rows. */
  const seed = String(org?.id || org?.name || '')
    .split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const factor = 0.35 + ((seed % 40) / 100);   /* 0.35..0.74 */

  const users    = Math.min(maxUsers,    Math.max(1, Number(org.users) || Math.round(maxUsers * factor)));
  const offices  = Math.min(maxOffices,  Math.max(1, Math.round(maxOffices * factor)));
  const visitors = Math.min(maxVisitors, Math.max(1, Math.round(maxVisitors * factor)));
  const storage  = Math.min(maxStorage,  Math.max(0.2, Math.round((maxStorage * factor) * 10) / 10));

  return [
    { label: 'Users',                Icon: Users,       value: users,    cap: maxUsers,    display: `${users} / ${maxUsers}`,        pct: (users / maxUsers) * 100 },
    { label: 'Offices',              Icon: MapPin,      value: offices,  cap: maxOffices,  display: `${offices} / ${maxOffices}`,    pct: (offices / maxOffices) * 100 },
    { label: 'Visitors this month',  Icon: ClockIcon,   value: visitors, cap: maxVisitors, display: `${visitors.toLocaleString('en-IN')} / ${maxVisitors.toLocaleString('en-IN')}`, pct: (visitors / maxVisitors) * 100 },
    { label: 'Storage',              Icon: CreditCard,  value: storage,  cap: maxStorage,  display: `${storage} GB / ${maxStorage} GB`, pct: (storage / maxStorage) * 100 },
  ];
}

/* Synthesise 6 months of realistic payment history from the org's
 * subscription start date + current price, then merge in any real
 * Pay-Now receipts saved at signup time so the very first transaction
 * shows up in the Payments tab.
 */
function buildPaymentHistory(org) {
  const start = new Date(org.startDate || Date.now()).getTime();
  const monthly = Number(org.price) || Number(org.mrr) || 0;
  const now = Date.now();
  const rows = [];

  /* Real receipts from cgms_subscriptions_v1, persisted at signup. */
  let realPayments = [];
  try {
    const subs = JSON.parse(localStorage.getItem('cgms_subscriptions_v1') || '[]');
    const orgSubs = (subs || []).filter((s) => s.organisationId === org?.id);
    for (const s of orgSubs) {
      for (const p of s.payments || []) {
        realPayments.push({
          id:       p.transactionId || p.id || `RCPT-${s.id}-${realPayments.length + 1}`,
          date:     p.paidAt || s.startDate,
          invoice:  p.transactionId || `INV-${new Date(p.paidAt || Date.now()).getFullYear()}-${String(realPayments.length + 1).padStart(4, '0')}`,
          amount:   Number(p.amount) || 0,
          status:   p.status === 'SUCCESS' ? 'Paid' : (p.status || 'Paid'),
          paymentMethod: p.paymentMethod,
        });
      }
    }
  } catch { /* localStorage unavailable — non-fatal */ }

  if (monthly > 0) {
    let month = start;
    let idx = 1;
    while (month <= now && rows.length < 12) {
      const d = new Date(month);
      const status = rows.length === 0 && org.effectiveStatus === 'Active'
        ? (Math.floor(seed(org.id) / 7) % 8 === 0 ? 'Failed' : 'Paid')
        : 'Paid';
      rows.push({
        id:       `inv-${org.id}-${idx}`,
        date:     d.toISOString(),
        invoice:  `INV-${d.getFullYear()}-${String(idx).padStart(4, '0')}`,
        amount:   monthly,
        status,
      });
      month = d.setMonth(d.getMonth() + 1) && d.getTime();
      idx += 1;
    }
  }

  const merged = [...realPayments, ...rows.reverse()];
  const seen = new Set();
  return merged
    .filter((r) => { if (seen.has(r.id)) return false; seen.add(r.id); return true; })
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

function seed(s) {
  return String(s || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
}
