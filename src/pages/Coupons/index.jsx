import React, { useState, useEffect } from 'react';
import { Plus, Tag, Trash2, ToggleLeft, ToggleRight, Copy, Check, X } from 'lucide-react';
import { apiFetch, apiJson } from '../../api/http';
import { ConfirmModal, Toast } from '../../components/ui';

const EMPTY = {
  code: '', description: '', discountType: 'PERCENTAGE', discountValue: '',
  applicablePlans: [], usageLimit: '', validFrom: '', validUntil: '',
  minOrderAmount: '', maxDiscountAmount: '',
};

/* Shared Tailwind class fragments. Centralised so every input/select on
 * this page picks up the same dark-mode-aware tokens; the page used to
 * hard-code colours in inline style objects which `dark:` could never
 * override. */
const inputClasses =
  'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 ' +
  'placeholder:text-slate-400 outline-none transition-colors ' +
  'focus:border-primary-500 focus:bg-white focus:ring-2 focus:ring-primary-500/20 ' +
  'dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 ' +
  'dark:placeholder:text-slate-500 dark:focus:bg-slate-800 dark:focus:border-primary-400';

const labelClasses =
  'mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300';

const cardClasses =
  'rounded-xl border border-slate-200 bg-white p-5 shadow-sm ' +
  'dark:border-slate-800 dark:bg-slate-900';

const iconBtnClasses =
  'inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 ' +
  'text-slate-500 transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 ' +
  'dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 ' +
  'dark:hover:border-primary-400/60 dark:hover:bg-slate-700 dark:hover:text-primary-200';

export default function CouponsPage() {
  const [coupons, setCoupons]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState(EMPTY);
  const [saving, setSaving]     = useState(false);
  const [copied, setCopied]     = useState(null);
  const [error, setError]       = useState('');
  const [toast, setToast]       = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  useEffect(() => { fetchCoupons(); }, []);

  async function fetchCoupons() {
    setLoading(true);
    try {
      const data = await apiJson('/coupons');
      setCoupons(data?.data || []);
    } catch (e) {
      console.error('[Coupons] fetch failed:', e);
    }
    setLoading(false);
  }

  async function saveCoupon() {
    setSaving(true); setError('');

    if (!form.code.trim()) { setError('Coupon code is required.'); setSaving(false); return; }
    const dv = Number(form.discountValue);
    if (!Number.isFinite(dv) || dv <= 0) { setError('Enter a valid discount value greater than 0.'); setSaving(false); return; }
    if (form.discountType === 'PERCENTAGE' && dv > 100) { setError('Percentage discount cannot exceed 100.'); setSaving(false); return; }

    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        description: form.description || '',
        discountType: form.discountType,
        discountValue: dv,
        applicablePlans: form.applicablePlans || [],
        usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
        minOrderAmount: Number(form.minOrderAmount) || 0,
        maxDiscountAmount: form.maxDiscountAmount ? Number(form.maxDiscountAmount) : null,
      };
      if (form.validFrom)  payload.validFrom  = form.validFrom;
      if (form.validUntil) payload.validUntil = form.validUntil;

      const data = await apiJson('/coupons', { method: 'POST', body: JSON.stringify(payload) });
      if (data?.data) setCoupons((p) => [data.data, ...p]);
      setShowForm(false);
      setForm(EMPTY);
      setToast({ msg: 'Coupon created successfully.', type: 'success' });
    } catch (e) {
      console.error('[Coupons] saveCoupon failed:', e);
      setError(e.message || 'Failed to create coupon.');
    }
    setSaving(false);
  }

  async function toggleCoupon(id, current) {
    try {
      await apiJson(`/coupons/${id}/toggle`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !current }),
      });
      setCoupons((p) => p.map((c) => c._id === id ? { ...c, isActive: !current } : c));
      setToast({ msg: `Coupon ${!current ? 'activated' : 'deactivated'} successfully.`, type: 'success' });
    } catch (e) {
      setToast({ msg: e.message || 'Could not update coupon.', type: 'error' });
    }
  }

  async function deleteCoupon(id) {
    try {
      await apiFetch(`/coupons/${id}`, { method: 'DELETE' });
      setCoupons((p) => p.filter((c) => c._id !== id));
      setToast({ msg: 'Coupon deleted successfully.', type: 'success' });
    } catch (e) {
      setToast({ msg: e.message || 'Could not delete coupon.', type: 'error' });
    } finally {
      setPendingDelete(null);
    }
  }

  function copyCode(code) {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {pendingDelete && (
        <ConfirmModal
          title="Delete Coupon"
          message={`Are you sure you want to delete the coupon "${pendingDelete.code}"? This cannot be undone.`}
          onConfirm={() => deleteCoupon(pendingDelete._id)}
          onCancel={() => setPendingDelete(null)}
        />
      )}

      {/* Header — title left, action button right; stacks on mobile so the
          New Coupon button never crashes into the title. */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-xl font-bold text-slate-900 sm:text-2xl dark:text-white">
            Coupon Codes
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Create discount codes for subscription checkout
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-400"
        >
          <Plus size={16} /> New Coupon
        </button>
      </div>

      {showForm && (
        <div className={`${cardClasses} mb-4`}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Create Coupon</h3>
            <button
              onClick={() => setShowForm(false)}
              aria-label="Close"
              className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <X size={18} />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
            <Field label="Code *" value={form.code} onChange={(v) => setForm((p) => ({ ...p, code: v.toUpperCase() }))} placeholder="e.g. LAUNCH50" />
            <Field label="Description" value={form.description} onChange={(v) => setForm((p) => ({ ...p, description: v }))} />

            <div>
              <label className={labelClasses}>Discount Type *</label>
              <select
                value={form.discountType}
                onChange={(e) => setForm((p) => ({ ...p, discountType: e.target.value }))}
                className={inputClasses}
              >
                <option value="PERCENTAGE">Percentage (%)</option>
                <option value="FLAT">Flat Amount (₹)</option>
              </select>
            </div>

            <Field
              label="Discount Value *"
              value={form.discountValue}
              onChange={(v) => setForm((p) => ({ ...p, discountValue: v }))}
              placeholder={form.discountType === 'PERCENTAGE' ? 'e.g. 20' : 'e.g. 500'}
              type="number"
            />
            <Field label="Usage Limit (blank = unlimited)" value={form.usageLimit} onChange={(v) => setForm((p) => ({ ...p, usageLimit: v }))} type="number" />
            <Field label="Min Order Amount (₹)" value={form.minOrderAmount} onChange={(v) => setForm((p) => ({ ...p, minOrderAmount: v }))} type="number" />
            <Field label="Valid From" value={form.validFrom} onChange={(v) => setForm((p) => ({ ...p, validFrom: v }))} type="date" />
            <Field label="Valid Until (blank = never)" value={form.validUntil} onChange={(v) => setForm((p) => ({ ...p, validUntil: v }))} type="date" />
          </div>

          <div className="mt-4">
            <label className={labelClasses}>Applicable Plans (blank = all plans)</label>
            <div className="mt-1 flex flex-wrap gap-3">
              {['Starter', 'Professional', 'Enterprise'].map((pl) => (
                <label
                  key={pl}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700 transition-colors hover:border-primary-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-primary-400/60"
                >
                  <input
                    type="checkbox"
                    checked={form.applicablePlans.includes(pl)}
                    onChange={(e) => setForm((p) => ({
                      ...p,
                      applicablePlans: e.target.checked
                        ? [...p.applicablePlans, pl]
                        : p.applicablePlans.filter((x) => x !== pl),
                    }))}
                    className="accent-primary-500"
                  />
                  {pl}
                </label>
              ))}
            </div>
          </div>

          {error && (
            <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">{error}</p>
          )}

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              onClick={() => setShowForm(false)}
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              onClick={saveCoupon}
              disabled={saving}
              className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-emerald-500 dark:hover:bg-emerald-400"
            >
              {saving ? 'Saving...' : 'Create Coupon'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="mt-10 text-center text-sm text-slate-500 dark:text-slate-400">Loading coupons...</p>
      ) : coupons.length === 0 ? (
        <div className="py-16 text-center text-slate-400 dark:text-slate-500">
          <Tag size={40} className="mx-auto mb-3 opacity-50" />
          <p className="text-sm">No coupons yet. Create your first coupon above.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {coupons.map((c) => (
            <div
              key={c._id}
              className={`${cardClasses} flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-5`}
            >
              <div className="flex min-w-0 flex-wrap items-center gap-3 sm:gap-4">
                {/* Coupon code pill — mono font, contrast tuned for both modes. */}
                <div
                  className={
                    c.isActive
                      ? 'rounded-md bg-emerald-50 px-3 py-1.5 dark:bg-emerald-500/15'
                      : 'rounded-md bg-slate-100 px-3 py-1.5 dark:bg-slate-800'
                  }
                >
                  <span
                    className={
                      'font-mono text-base font-bold tracking-wide ' +
                      (c.isActive
                        ? 'text-emerald-700 dark:text-emerald-300'
                        : 'text-slate-400 dark:text-slate-500')
                    }
                  >
                    {c.code}
                  </span>
                </div>

                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {c.discountType === 'PERCENTAGE' ? `${c.discountValue}% off` : `₹${c.discountValue} off`}
                    {c.applicablePlans?.length > 0 && (
                      <span className="font-normal text-slate-500 dark:text-slate-400"> · {c.applicablePlans.join(', ')}</span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Used {c.usedCount}{c.usageLimit ? `/${c.usageLimit}` : ''} times
                    {c.validUntil && ` · Expires ${new Date(c.validUntil).toLocaleDateString()}`}
                  </div>
                </div>
              </div>

              {/* Action row — wraps on small screens instead of overflowing. */}
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <button onClick={() => copyCode(c.code)} className={iconBtnClasses} title="Copy code" aria-label="Copy coupon code">
                  {copied === c.code ? <Check size={15} className="text-emerald-600 dark:text-emerald-400" /> : <Copy size={15} />}
                </button>
                <button
                  onClick={() => toggleCoupon(c._id, c.isActive)}
                  className={iconBtnClasses}
                  title={c.isActive ? 'Deactivate' : 'Activate'}
                  aria-label={c.isActive ? 'Deactivate coupon' : 'Activate coupon'}
                >
                  {c.isActive
                    ? <ToggleRight size={18} className="text-emerald-600 dark:text-emerald-400" />
                    : <ToggleLeft  size={18} className="text-slate-400 dark:text-slate-500" />}
                </button>
                <button
                  onClick={() => setPendingDelete(c)}
                  title={`Delete coupon ${c.code}`}
                  aria-label={`Delete coupon ${c.code}`}
                  className="inline-flex items-center justify-center rounded-lg border border-rose-200 bg-rose-50 p-2 text-rose-600 transition-colors hover:border-rose-300 hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div>
      <label className={labelClasses}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={inputClasses}
      />
    </div>
  );
}
