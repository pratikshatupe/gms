import React, { useEffect, useMemo, useState } from 'react';
import { Award, Check, Copy, Gift, Link2, Mail, MessageCircle, RefreshCw, TrendingUp, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCollection, STORAGE_KEYS } from '../../store';
import { ensureCodeForUser, getReferralSummary, REFERRAL_REWARD } from '../../api/referralsApi';
import {
  REFERRAL_STATUS,
  REFEREE_DISCOUNT_PERCENT,
  REFERRAL_ROTATE_AFTER,
  rotateUserReferralCode,
} from '../../utils/referrals';

export default function ReferralPage() {
  const { user, updateUser } = useAuth();

  /* useCollection gives us reactive cross-tab updates whenever a new
   * referral lands or a conversion fires from anywhere in the app. */
  const [referrals] = useCollection(STORAGE_KEYS.REFERRALS, []);

  const [code, setCode] = useState(() => user?.referralCode || null);
  const [toast, setToast] = useState(null);
  const [copied, setCopied] = useState({ code: false, link: false });

  /* Make sure the logged-in user has a code persisted. Generate once if missing. */
  useEffect(() => {
    if (!user) return;
    if (user.referralCode) {
      setCode(user.referralCode);
      return;
    }
    const next = ensureCodeForUser(user);
    if (next) {
      setCode(next);
      updateUser?.({ referralCode: next });
    }
  }, [user, updateUser]);

  /* Recompute summary whenever the referrals collection or our code changes. */
  const summary = useMemo(() => getReferralSummary(code), [code, referrals]);

  /* Bug 12 — once a code reaches REFERRAL_ROTATE_AFTER signups, rotate to a
     fresh code automatically so the referrer always has live capacity. The
     old code is preserved in referralCodeHistory so existing links remain
     attributable. */
  useEffect(() => {
    if (!user || !code) return;
    if ((summary.totalSignups || 0) < REFERRAL_ROTATE_AFTER) return;
    const next = rotateUserReferralCode(user);
    if (next && next !== code) {
      setCode(next);
      updateUser?.({ referralCode: next });
      setToast(`Code refreshed — you've passed ${REFERRAL_ROTATE_AFTER} signups. New code is ${next}.`);
    }
  }, [summary.totalSignups, code, user, updateUser]);

  const shareSubject = `Get ${REFEREE_DISCOUNT_PERCENT}% off your first CorpGMS plan`;
  const shareBody = code
    ? `Hi,\n\nUse my referral code ${code} to get ${REFEREE_DISCOUNT_PERCENT}% off your first CorpGMS subscription.\n\nSign up here: ${summary.link}\n\nThanks!`
    : '';
  const shareEmailHref = code
    ? `mailto:?subject=${encodeURIComponent(shareSubject)}&body=${encodeURIComponent(shareBody)}`
    : null;
  const shareWhatsAppHref = code
    ? `https://wa.me/?text=${encodeURIComponent(`${shareSubject}. ${summary.link}`)}`
    : null;

  /* Auto-clear toast. */
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const copy = async (value, kind) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Fallback for older browsers / restricted contexts.
      const ta = document.createElement('textarea');
      ta.value = value;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch { /* ignore */ }
      document.body.removeChild(ta);
    }
    setCopied((c) => ({ ...c, [kind]: true }));
    setToast(kind === 'code' ? 'Referral code copied' : 'Referral link copied');
    setTimeout(() => setCopied((c) => ({ ...c, [kind]: false })), 1800);
  };

  return (
    <div className="flex w-full min-w-0 flex-col gap-6">
      {/* Header */}
      <header>
        <h1 className="font-[Outfit,sans-serif] text-[22px] font-extrabold text-[#0C2340] dark:text-slate-100 m-0">
          Refer &amp; Earn
        </h1>
        <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">
          Share your referral link. Earn ₹{REFERRAL_REWARD} when a referred organisation completes its first subscription payment.
        </p>
      </header>

      {/* Code + link card */}
      <ReferralHeroCard
        code={summary.code}
        link={summary.link}
        reward={summary.reward}
        refereeDiscountPercent={REFEREE_DISCOUNT_PERCENT}
        rotateAfter={REFERRAL_ROTATE_AFTER}
        totalSignups={summary.totalSignups}
        copied={copied}
        onCopy={copy}
        shareEmailHref={shareEmailHref}
        shareWhatsAppHref={shareWhatsAppHref}
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard Icon={Users}      tone="#0284C7" label="Total Signups"    value={summary.totalSignups} />
        <StatCard Icon={TrendingUp} tone="#059669" label="Converted"        value={summary.totalConverted} />
        <StatCard Icon={Gift}       tone="#F59E0B" label="Pending Rewards"  value={summary.pendingRewards} />
        <StatCard Icon={Award}      tone="#5a4bd1" label="Total Earned (₹)" value={summary.totalEarned.toLocaleString('en-IN')} />
      </div>

      {/* History */}
      <section className="rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm dark:border-[#142535] dark:bg-[#0A1828]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="font-[Outfit,sans-serif] text-[15px] font-extrabold text-[#0C2340] dark:text-slate-100 m-0">
            Referral History
          </h3>
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            {summary.history.length} record{summary.history.length === 1 ? '' : 's'}
          </span>
        </div>

        {summary.history.length === 0 ? (
          <EmptyHistory />
        ) : (
          <ReferralHistoryTable rows={summary.history} />
        )}
      </section>

      {/* Footer hint */}
      <div className="rounded-[12px] border border-sky-200 bg-sky-50 px-4 py-3 text-[13px] text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200">
        <strong>How it works:</strong> Share your link. When a friend signs up and completes their first paid subscription, you earn ₹{REFERRAL_REWARD} as reward credit.
      </div>

      {/* Toast */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-6 right-6 z-[200] flex items-center gap-2 rounded-[10px] border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-[13px] font-semibold text-emerald-700 shadow-lg dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200"
        >
          <Check size={15} aria-hidden="true" /> {toast}
        </div>
      )}
    </div>
  );
}

/* ─── Subcomponents ─── */

function ReferralHeroCard({
  code, link, reward, refereeDiscountPercent, rotateAfter, totalSignups,
  copied, onCopy, shareEmailHref, shareWhatsAppHref,
}) {
  const remaining = Math.max(0, (rotateAfter || 0) - (totalSignups || 0));
  return (
    <div
      className="relative overflow-hidden rounded-[16px] p-6 text-white shadow-lg"
      style={{ background: 'linear-gradient(135deg, #6c5ce7 0%, #5a4bd1 50%, #00cec9 100%)' }}
    >
      <div className="text-[12px] font-semibold uppercase tracking-wider opacity-80">
        Your Referral Code
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <span className="font-mono text-[28px] font-extrabold tracking-[3px]">
          {code || '—'}
        </span>
        <button
          type="button"
          onClick={() => onCopy(code, 'code')}
          disabled={!code}
          className="inline-flex items-center gap-2 rounded-[10px] border border-white/30 bg-white/15 px-3 py-1.5 text-[13px] font-semibold backdrop-blur-sm transition hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {copied.code ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy code</>}
        </button>
      </div>

      {/* Bug 12 — explicit rewards summary so the referrer can see what
          they get AND what the referred org receives. */}
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="rounded-[10px] bg-white/10 px-3 py-2 text-[13px]">
          <div className="text-[11px] uppercase tracking-wider opacity-75">You earn</div>
          <div className="mt-0.5 font-semibold">₹{reward} per converted referral</div>
        </div>
        <div className="rounded-[10px] bg-white/10 px-3 py-2 text-[13px]">
          <div className="text-[11px] uppercase tracking-wider opacity-75">They get</div>
          <div className="mt-0.5 font-semibold">{refereeDiscountPercent}% off their first plan</div>
        </div>
      </div>

      <div className="mt-3 text-[12px] opacity-85 inline-flex items-center gap-2">
        <RefreshCw size={12} aria-hidden="true" />
        Auto-renews after {rotateAfter} uses · {remaining > 0
          ? `${remaining} use${remaining === 1 ? '' : 's'} until a fresh code is generated`
          : 'a fresh code will be generated on the next signup'}.
      </div>

      <div className="mt-5 rounded-[12px] bg-black/25 p-3">
        <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider opacity-90">
          <Link2 size={12} aria-hidden="true" /> Shareable link
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={link}
            readOnly
            onClick={(e) => e.target.select()}
            className="min-w-0 flex-1 rounded-[8px] border border-white/15 bg-black/30 px-3 py-2 font-mono text-[12px] text-white outline-none"
          />
          <button
            type="button"
            onClick={() => onCopy(link, 'link')}
            disabled={!link}
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-[8px] border border-white/30 bg-white/15 px-3 py-2 text-[13px] font-semibold backdrop-blur-sm transition hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {copied.link ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy link</>}
          </button>
        </div>

        {/* Bug 12 — Email and WhatsApp share buttons. */}
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={shareEmailHref || '#'}
            onClick={(e) => { if (!shareEmailHref) e.preventDefault(); }}
            aria-disabled={!shareEmailHref}
            title="Share via Email"
            className={`inline-flex items-center gap-2 rounded-[8px] border border-white/30 px-3 py-2 text-[13px] font-semibold transition ${shareEmailHref ? 'bg-white text-[#5a4bd1] hover:bg-white/90' : 'bg-white/10 opacity-50 cursor-not-allowed'}`}
          >
            <Mail size={14} aria-hidden="true" /> Share via Email
          </a>
          <a
            href={shareWhatsAppHref || '#'}
            onClick={(e) => { if (!shareWhatsAppHref) e.preventDefault(); }}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!shareWhatsAppHref}
            title="Share via WhatsApp"
            className={`inline-flex items-center gap-2 rounded-[8px] border border-white/30 px-3 py-2 text-[13px] font-semibold transition ${shareWhatsAppHref ? 'bg-[#25D366] text-white hover:bg-[#1ea756]' : 'bg-white/10 opacity-50 cursor-not-allowed'}`}
          >
            <MessageCircle size={14} aria-hidden="true" /> Share via WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}

function StatCard({ Icon, tone, label, value }) {
  return (
    <div className="rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-[#142535] dark:bg-[#0A1828]">
      <div
        className="inline-flex h-9 w-9 items-center justify-center rounded-[10px]"
        style={{ background: `${tone}15`, color: tone }}
      >
        <Icon size={18} aria-hidden="true" />
      </div>
      <div className="mt-3 font-[Outfit,sans-serif] text-[24px] font-extrabold text-[#0C2340] dark:text-slate-100">
        {value}
      </div>
      <div className="mt-0.5 text-[12px] font-semibold text-slate-500 dark:text-slate-400">
        {label}
      </div>
    </div>
  );
}

function ReferralHistoryTable({ rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse">
        <thead>
          <tr className="bg-slate-50 dark:bg-[#142535]">
            <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">User Name</th>
            <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Date</th>
            <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Status</th>
            <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500">Reward</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-slate-100 dark:border-[#142535]">
              <td className="px-4 py-3">
                <div className="text-[13px] font-semibold text-[#0C2340] dark:text-slate-100">
                  {r.userName}
                </div>
                {r.userEmail && (
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">{r.userEmail}</div>
                )}
              </td>
              <td className="px-4 py-3 text-[12px] font-mono text-slate-600 dark:text-slate-300">
                {new Date(r.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </td>
              <td className="px-4 py-3">
                <StatusPill status={r.status} />
              </td>
              <td className="px-4 py-3 text-right">
                {r.status === REFERRAL_STATUS.CONVERTED ? (
                  <span className="text-[13px] font-bold text-emerald-600">+₹{r.reward}</span>
                ) : (
                  <span className="text-[12px] text-slate-400">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusPill({ status }) {
  const map = {
    [REFERRAL_STATUS.PENDING]:   { bg: '#FEF3C7', fg: '#92400E', label: 'Pending' },
    [REFERRAL_STATUS.CONVERTED]: { bg: '#DCFCE7', fg: '#166534', label: 'Converted' },
  };
  const tone = map[status] || { bg: '#F1F5F9', fg: '#475569', label: status || '—' };
  return (
    <span
      className="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold"
      style={{ background: tone.bg, color: tone.fg }}
    >
      {tone.label}
    </span>
  );
}

function EmptyHistory() {
  return (
    <div className="flex flex-col items-center justify-center gap-1 py-10 text-center">
      <Gift size={28} className="text-slate-300" aria-hidden="true" />
      <div className="text-[13px] font-semibold text-slate-600 dark:text-slate-300">
        No referrals yet
      </div>
      <div className="text-[12px] text-slate-400">
        Share your link with friends to start earning rewards.
      </div>
    </div>
  );
}
