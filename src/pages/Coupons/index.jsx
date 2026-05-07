import React, { useState, useEffect } from 'react';
import { Plus, Tag, Trash2, ToggleLeft, ToggleRight, Copy, Check, X } from 'lucide-react';
import { apiFetch, apiJson } from '../../api/http';
import { ConfirmModal, Toast } from '../../components/ui';

const EMPTY = {
  code: '', description: '', discountType: 'PERCENTAGE', discountValue: '',
  applicablePlans: [], usageLimit: '', validFrom: '', validUntil: '',
  minOrderAmount: '', maxDiscountAmount: '',
};

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
    <div style={{ padding: 28, maxWidth: 1000, margin: '0 auto' }}>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {pendingDelete && (
        <ConfirmModal
          title="Delete Coupon"
          message={`Are you sure you want to delete the coupon "${pendingDelete.code}"? This cannot be undone.`}
          onConfirm={() => deleteCoupon(pendingDelete._id)}
          onCancel={() => setPendingDelete(null)}
        />
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0C2340', margin: 0 }}>Coupon Codes</h1>
          <p style={{ color: '#64748B', fontSize: 13, marginTop: 4 }}>Create discount codes for subscription checkout</p>
        </div>
        <button onClick={() => setShowForm(true)} style={btnStyle('#0284C7')}>
          <Plus size={16} /> New Coupon
        </button>
      </div>

      {showForm && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Create Coupon</h3>
            <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
          </div>
          <div style={gridStyle}>
            <Field label="Code *" value={form.code} onChange={(v) => setForm((p) => ({ ...p, code: v.toUpperCase() }))} placeholder="e.g. LAUNCH50" />
            <Field label="Description" value={form.description} onChange={(v) => setForm((p) => ({ ...p, description: v }))} />
            <div>
              <label style={labelStyle}>Discount Type *</label>
              <select value={form.discountType} onChange={(e) => setForm((p) => ({ ...p, discountType: e.target.value }))} style={inputStyle}>
                <option value="PERCENTAGE">Percentage (%)</option>
                <option value="FLAT">Flat Amount (₹)</option>
              </select>
            </div>
            <Field label="Discount Value *" value={form.discountValue} onChange={(v) => setForm((p) => ({ ...p, discountValue: v }))} placeholder={form.discountType === 'PERCENTAGE' ? 'e.g. 20' : 'e.g. 500'} type="number" />
            <Field label="Usage Limit (blank = unlimited)" value={form.usageLimit} onChange={(v) => setForm((p) => ({ ...p, usageLimit: v }))} type="number" />
            <Field label="Min Order Amount (₹)" value={form.minOrderAmount} onChange={(v) => setForm((p) => ({ ...p, minOrderAmount: v }))} type="number" />
            <Field label="Valid From" value={form.validFrom} onChange={(v) => setForm((p) => ({ ...p, validFrom: v }))} type="date" />
            <Field label="Valid Until (blank = never)" value={form.validUntil} onChange={(v) => setForm((p) => ({ ...p, validUntil: v }))} type="date" />
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={labelStyle}>Applicable Plans (blank = all plans)</label>
            <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
              {['Starter', 'Professional', 'Enterprise'].map((pl) => (
                <label key={pl} style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.applicablePlans.includes(pl)}
                    onChange={(e) => setForm((p) => ({
                      ...p,
                      applicablePlans: e.target.checked
                        ? [...p.applicablePlans, pl]
                        : p.applicablePlans.filter((x) => x !== pl),
                    }))}
                  />
                  {pl}
                </label>
              ))}
            </div>
          </div>
          {error && <p style={{ color: '#DC2626', fontSize: 13, marginTop: 10 }}>{error}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
            <button onClick={() => setShowForm(false)} style={btnStyle('#64748B')}>Cancel</button>
            <button onClick={saveCoupon} disabled={saving} style={btnStyle('#059669')}>
              {saving ? 'Saving...' : 'Create Coupon'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ color: '#64748B', textAlign: 'center', marginTop: 40 }}>Loading coupons...</p>
      ) : coupons.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#94A3B8' }}>
          <Tag size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
          <p>No coupons yet. Create your first coupon above.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {coupons.map((c) => (
            <div key={c._id} style={{ ...cardStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ background: c.isActive ? '#ECFDF5' : '#F1F5F9', borderRadius: 8, padding: '6px 12px' }}>
                  <span style={{ fontWeight: 700, fontSize: 15, color: c.isActive ? '#059669' : '#94A3B8', fontFamily: 'monospace' }}>{c.code}</span>
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#1E293B' }}>
                    {c.discountType === 'PERCENTAGE' ? `${c.discountValue}% off` : `₹${c.discountValue} off`}
                    {c.applicablePlans?.length > 0 && <span style={{ color: '#64748B', fontWeight: 400 }}> · {c.applicablePlans.join(', ')}</span>}
                  </div>
                  <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>
                    Used {c.usedCount}{c.usageLimit ? `/${c.usageLimit}` : ''} times
                    {c.validUntil && ` · Expires ${new Date(c.validUntil).toLocaleDateString()}`}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => copyCode(c.code)} style={iconBtn} title="Copy code">
                  {copied === c.code ? <Check size={15} color="#059669" /> : <Copy size={15} />}
                </button>
                <button onClick={() => toggleCoupon(c._id, c.isActive)} style={iconBtn} title={c.isActive ? 'Deactivate' : 'Activate'}>
                  {c.isActive ? <ToggleRight size={18} color="#059669" /> : <ToggleLeft size={18} color="#94A3B8" />}
                </button>
                <button onClick={() => setPendingDelete(c)} style={{ ...iconBtn, color: '#DC2626', borderColor: 'rgba(220,38,38,0.3)', background: 'rgba(220,38,38,0.08)' }} title={`Delete coupon ${c.code}`}>
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
      <label style={labelStyle}>{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />
    </div>
  );
}

const cardStyle  = { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 20, marginBottom: 12 };
const gridStyle  = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 18px' };
const labelStyle = { fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 5 };
const inputStyle = { width: '100%', padding: '8px 11px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 13, color: '#1E293B', outline: 'none', boxSizing: 'border-box', background: '#F8FAFC' };
const iconBtn    = { background: 'none', border: '1px solid #E2E8F0', borderRadius: 7, padding: '5px 8px', cursor: 'pointer', color: '#64748B', display: 'flex', alignItems: 'center' };
const btnStyle   = (bg) => ({ background: bg, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 });
