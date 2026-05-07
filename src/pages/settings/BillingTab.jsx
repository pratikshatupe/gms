import React, { useMemo } from 'react';
import { CreditCard, ExternalLink, Building2, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCollection, STORAGE_KEYS } from '../../store';
import { MOCK_ORGANIZATIONS } from '../../data/mockData';

function PlanBadge({ tier }) {
  const styles = {
    Trial:        'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
    Starter:      'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300',
    Professional: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300',
    Enterprise:   'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300',
  };
  const cls = styles[tier] || 'border-slate-200 bg-slate-100 text-slate-500 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-400';
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-[0.04em] ${cls}`}>
      {tier || 'Unknown'}
    </span>
  );
}

export default function BillingTab({ canEdit = true, setActivePage }) {
  const { user } = useAuth();
  const [orgs] = useCollection(STORAGE_KEYS.ORGANIZATIONS, MOCK_ORGANIZATIONS);

  const orgId = user?.organisationId || user?.orgId;
  const org   = useMemo(() => (orgs || []).find((o) => o?.id === orgId) || null, [orgs, orgId]);

  const plan          = org?.subscriptionTier || org?.plan || 'Trial';
  const planStartedAt = org?.subscriptionStartedAt || org?.createdAt;
  const trialEndsAt   = org?.trialEndsAt;
  const seatLimit     = org?.seatLimit ?? '—';
  const paymentMethod = org?.billingPaymentMethod || 'Not configured';
  const billingEmail  = org?.billingEmail || org?.contactEmail || '—';

  if (!org) {
    return (
      <div className="rounded-[14px] border border-slate-200 bg-white p-10 text-center shadow-sm dark:border-[#142535] dark:bg-[#0A1828]">
        <p className="text-[13px] text-slate-400 dark:text-slate-500">
          Billing details require a logged-in tenant user with an active organisation.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {!canEdit && (
        <div role="status" className="flex items-center gap-2 rounded-[10px] border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] font-semibold text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          <AlertTriangle size={14} /> You can view billing details. Plan changes are restricted to Directors.
        </div>
      )}

      {/* Plan summary */}
      <section className="rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm dark:border-[#142535] dark:bg-[#0A1828]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400">
              <CreditCard size={18} />
            </span>
            <div>
              <h2 className="text-[15px] font-extrabold text-[#0C2340] dark:text-slate-100">Current Plan</h2>
              <div className="mt-2 flex flex-wrap items-center gap-2.5">
                <PlanBadge tier={plan} />
                {trialEndsAt && plan === 'Trial' && (
                  <span className="text-[12px] font-bold text-amber-600 dark:text-amber-400">
                    Trial ends on {new Date(trialEndsAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}.
                  </span>
                )}
              </div>
              <p className="mt-2 text-[12px] text-slate-400 dark:text-slate-500">
                For plan changes, invoice history, and payment management, open the Subscription module.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { if (canEdit) setActivePage?.('subscription'); }}
            disabled={!canEdit}
            title={canEdit ? 'Manage your subscription' : 'Plan changes require Director access'}
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-sky-700 bg-sky-600 px-4 py-2 text-[13px] font-bold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Manage Subscription <ExternalLink size={13} />
          </button>
        </div>
      </section>

      {/* Billing snapshot */}
      <section className="rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm dark:border-[#142535] dark:bg-[#0A1828]">
        <h2 className="text-[15px] font-extrabold text-[#0C2340] dark:text-slate-100">Billing Snapshot</h2>
        <p className="mt-0.5 text-[12px] text-slate-400 dark:text-slate-500">Read-only summary. Edit these in the Subscription module.</p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Stat label="Organisation" value={org?.name || '—'} icon={<Building2 size={14} />} />
          <Stat label="Seat Limit" value={seatLimit} />
          <Stat label="Plan Started" value={planStartedAt ? new Date(planStartedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'} />
          <Stat label="Payment Method" value={paymentMethod} />
          <Stat label="Billing Email ID" value={billingEmail} />
          <Stat label="Country" value={org?.country || '—'} />
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, icon }) {
  return (
    <div className="rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-3 dark:border-[#142535] dark:bg-[#071220]">
      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400">
        {icon}{label}
      </div>
      <div className="text-[14px] font-bold text-[#0C2340] dark:text-slate-100">{value}</div>
    </div>
  );
}