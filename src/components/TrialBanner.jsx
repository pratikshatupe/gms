import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCollection, STORAGE_KEYS } from '../store';
import { MOCK_ORGANIZATIONS } from '../data/mockData';

/**
 * Bug 20 — persistent trial banner.
 *
 * Looks up the current user's organisation in the live cgms_organizations
 * collection and shows the days remaining when subscriptionStatus is Trial
 * (or status === 'Trial'). Clicking the banner takes the user to the
 * subscription upgrade page.
 *
 * Render anywhere inside the authenticated app shell — the component is a
 * no-op when the user is not logged in or not on a trial.
 */
export default function TrialBanner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orgs] = useCollection(STORAGE_KEYS.ORGANIZATIONS, MOCK_ORGANIZATIONS);

  const trial = useMemo(() => {
    if (!user) return null;
    const list = Array.isArray(orgs) ? orgs : [];
    const org = list.find((o) =>
      String(o?.id || '').toLowerCase() === String(user.organisationId || '').toLowerCase()
      || String(o?.adminEmail || '').toLowerCase() === String(user.email || '').toLowerCase()
    );
    if (!org) return null;
    const status = String(org.subscriptionStatus || org.status || '').toLowerCase();
    if (status !== 'trial') return null;
    const trialEnd = org.trialEndsAt ? new Date(org.trialEndsAt).getTime() : null;
    if (!trialEnd) return null;
    const remaining = Math.max(0, Math.ceil((trialEnd - Date.now()) / (24 * 60 * 60 * 1000)));
    return { org, remaining };
  }, [orgs, user]);

  if (!trial) return null;

  const isLastDay = trial.remaining <= 1;
  const tone = isLastDay
    ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-700/50'
    : 'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-900/20 dark:text-sky-200 dark:border-sky-700/50';

  return (
    <button
      type="button"
      onClick={() => navigate('/subscription')}
      title="Open Subscription to upgrade your plan"
      className={`flex w-full items-center justify-center gap-2 border-b px-4 py-2.5 text-[13px] font-semibold transition hover:brightness-95 ${tone}`}
    >
      <Sparkles size={14} aria-hidden="true" />
      Your free trial ends in <strong>{trial.remaining} day{trial.remaining === 1 ? '' : 's'}</strong>. Upgrade now to continue.
    </button>
  );
}
