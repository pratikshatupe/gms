import React, { useState, useEffect } from 'react';
import {
  P, PL, PD, PBG, PBORDER, DARK, MID, MUTED,
  LM_EMAIL_RE, PLANS_REG, INDUSTRIES, ORG_SIZES, COUNTRIES, CITIES_BY_COUNTRY,
  REG_INP, REG_SEL, REG_LBL, ErrMsg,
} from './landingConstants';
import {
  generateUniqueReferralCode,
  getAllReferralCodes,
  getReferralFromURL,
  findUserByReferralCode,
} from '../../utils/referrals';
import { createReferralOnSignup } from '../../api/referralsApi';
import { applyCoupon as applyCouponApi, redeemCoupon } from '../../api/couponApi';
import { fetchPlans } from '../../api/plansApi';
import { useCollection, STORAGE_KEYS } from '../../store';

const PLAN_PRICE_MAP = { starter: 0, professional: 2999, enterprise: 9999 };

/** Format a price (number) in INR for display. */
function fmtPrice(value) {
  const n = Number(value) || 0;
  if (n === 0) return 'Free';
  return `₹${n.toLocaleString('en-IN')}`;
}

/** Limit value formatter — 0 means "unlimited" by convention. */
function fmtLimit(value) {
  const n = Number(value) || 0;
  if (n === 0) return 'Unlimited';
  return n.toLocaleString('en-IN');
}

const BANKS = [
  'State Bank of India', 'HDFC Bank', 'ICICI Bank', 'Axis Bank',
  'Kotak Mahindra Bank', 'Punjab National Bank', 'Yes Bank', 'IndusInd Bank',
  'IDFC FIRST Bank', 'Bank of Baroda',
];

const UPI_RE  = /^[\w.\-]{2,}@[a-zA-Z]{2,}$/;
const CARD_RE = /^\d{16}$/;
const CVV_RE  = /^\d{3,4}$/;
const EXP_RE  = /^(0[1-9]|1[0-2])\/(\d{2})$/;

/* Mod-10 (Luhn) check used by Step 4 (Payment). Rejects typos that pass
   the length regex but aren't a real card number. */
function luhnCheck(digits) {
  if (!digits || !/^\d+$/.test(digits)) return false;
  let sum = 0, alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

/* Lightweight network detection from leading digits — drives the inline
   brand badge in the Card field. Returns null when no network matches. */
function detectCardType(digits) {
  if (!digits) return null;
  if (/^4/.test(digits))                  return 'visa';
  if (/^(5[1-5]|2[2-7])/.test(digits))    return 'mastercard';
  if (/^(34|37)/.test(digits))            return 'amex';
  if (/^(60|65|81|82)/.test(digits))      return 'rupay';
  return null;
}

const CARD_BRAND_STYLES = {
  visa:       { label: 'VISA',  bg: '#1A1F71', fg: '#F7B600' },
  mastercard: { label: 'MC',    bg: '#EB001B', fg: '#F79E1B' },
  amex:       { label: 'AMEX',  bg: '#2E77BC', fg: '#FFFFFF' },
  rupay:      { label: 'RuPay', bg: '#097B36', fg: '#FFFFFF' },
};

const UPI_APPS = [
  { id: 'gpay',    label: 'GPay',    icon: '🟢', suffix: '@okicici' },
  { id: 'phonepe', label: 'PhonePe', icon: '🟣', suffix: '@ybl' },
  { id: 'paytm',   label: 'Paytm',   icon: '🔵', suffix: '@paytm' },
];

const WALLETS = [
  { id: 'paytm',     label: 'Paytm Wallet', icon: '🅿️' },
  { id: 'phonepe',   label: 'PhonePe',      icon: '🟣' },
  { id: 'amazonpay', label: 'Amazon Pay',   icon: '🅰️' },
  { id: 'mobikwik',  label: 'Mobikwik',     icon: '🟠' },
];

/**
 * Bug 20 — merge the Super Admin–authored plans (cgms_subscription_plans)
 * with the marketing-page defaults so the registration "Choose Plan" step
 * reflects every active plan and accurate prices, instead of the hardcoded
 * three-tier list. Custom plans appear after the defaults.
 */
function buildLivePlans(stored, fallback, backend = []) {
  const live = Array.isArray(stored) ? stored : [];
  const out = fallback.map((p) => ({ ...p }));
  const knownIds = new Set(out.map((p) => p.id));

  /* Merge any backend-provided plans first — they are authoritative for
     features and limits. */
  for (const p of backend) {
    if (!p || !p.name) continue;
    const id = (p.code || p.name || '').toString().toLowerCase().replace(/\s+/g, '-');
    const enriched = {
      _id:         p._id || p.id,
      id,
      label:       p.name,
      icon:        p.icon || '✨',
      badge:       p.status === 'Active' ? (p.mostPopular ? 'Most Popular' : (p.code || 'Active')) : (p.status || 'Active'),
      price:       Number(p.price) > 0 ? `₹${Number(p.price).toLocaleString('en-IN')}` : 'Free',
      color:       p.badgeColour || '#0284C7',
      bg:          'rgba(2,132,199,0.06)',
      features:    Array.isArray(p.features) ? p.features : [],
      priceValue:  Number(p.price) || 0,
      yearlyPrice: Number(p.yearlyPrice) || 0,
      description: p.description || '',
      maxGuests:   Number(p.maxGuests) || 0,
      maxStaff:    Number(p.maxStaff) || 0,
      maxOffices:  Number(p.maxOffices) || 0,
    };
    const existingIdx = out.findIndex((x) => x.id === id);
    if (existingIdx >= 0) out[existingIdx] = { ...out[existingIdx], ...enriched };
    else { out.push(enriched); knownIds.add(id); }
  }

  /* Then merge SuperAdmin-authored localStorage plans (used in demo). */
  for (const p of live) {
    if (!p || !p.name) continue;
    const id = (p.code || p.name || `plan-${p.id || ''}`).toString().toLowerCase().replace(/\s+/g, '-');
    if (knownIds.has(id)) {
      const existing = out.find((x) => x.id === id);
      if (existing) {
        existing.label = p.name;
        existing.price = p.price === 0 ? 'Free' : `₹${Number(p.price || 0).toLocaleString('en-IN')}`;
        if (Array.isArray(p.features) && p.features.length) existing.features = p.features.map((f) => (typeof f === 'string' ? f : f?.label)).filter(Boolean);
        if (p.maxGuests   != null) existing.maxGuests   = Number(p.maxGuests)   || 0;
        if (p.maxStaff    != null) existing.maxStaff    = Number(p.maxStaff)    || 0;
        if (p.maxOffices  != null) existing.maxOffices  = Number(p.maxOffices)  || 0;
        if (p.description) existing.description = p.description;
        if (p.yearlyPrice != null) existing.yearlyPrice = Number(p.yearlyPrice) || 0;
      }
      continue;
    }
    out.push({
      id,
      label:    p.name,
      icon:     '✨',
      badge:    p.status || 'Active',
      price:    Number(p.price) > 0 ? `₹${Number(p.price).toLocaleString('en-IN')}` : 'Free',
      color:    p.badgeColour || '#0284C7',
      bg:       'rgba(2,132,199,0.06)',
      features: Array.isArray(p.features) ? p.features.map((f) => (typeof f === 'string' ? f : f?.label)).filter(Boolean) : [],
      priceValue:  Number(p.price) || 0,
      yearlyPrice: Number(p.yearlyPrice) || 0,
      description: p.description || '',
      maxGuests:   Number(p.maxGuests)  || 0,
      maxStaff:    Number(p.maxStaff)   || 0,
      maxOffices:  Number(p.maxOffices) || 0,
    });
    knownIds.add(id);
  }
  return out;
}

const ONLY_LETTERS_RE = /^[a-zA-Z][a-zA-Z0-9 .,\-&()]*$/;
const PHONE_RE        = /^[+]?[\d\s\-(). ]{7,15}$/;
const WEBSITE_RE      = /^(https?:\/\/)?([\w-]+\.)+[\w-]+(\/[\w\-./?%&=]*)?$/;
const NAME_ONLY_RE    = /^[a-zA-Z\s'-]+$/;

/* Tiny inline row used by Step 4 (Payment) order summary. */
function SummaryRow({ k, v, bold = false, highlight = false }) {
  return (
    <div style={{
      display:'flex', justifyContent:'space-between', alignItems:'center',
      fontSize: bold ? 14 : 12,
      color: highlight ? '#059669' : (bold ? DARK : MID),
      fontWeight: bold ? 800 : 600,
      padding: '2px 0',
    }}>
      <span>{k}</span>
      <span>{v}</span>
    </div>
  );
}

/* ── Step 1: Organization Details — defined OUTSIDE modal to prevent remount on each render ── */
function RegStep1({
  orgName, setOrgName, orgSlug, setOrgSlug, industry, setIndustry,
  orgSize, setOrgSize, country, setCountry, city, setCity, address, setAddress,
  website, setWebsite, gstin, setGstin, errs, setErrs,
  /* coupon props */
  couponCode, setCouponCode, couponStatus, couponMessage, appliedCoupon,
  onApplyCoupon, onRemoveCoupon,
}) {
  const cityOptions = CITIES_BY_COUNTRY[country] || ['Other'];

  const handleCountryChange = (e) => {
    const newCountry = e.target.value;
    setCountry(newCountry);
    const newCities = CITIES_BY_COUNTRY[newCountry] || ['Other'];
    if (!newCities.includes(city)) setCity('');
    setErrs(v => ({ ...v, city: null }));
  };

  return (
    <div style={{ padding:'20px 28px 24px', display:'flex', flexDirection:'column', gap:14 }}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <div style={{ gridColumn:'1/-1' }}>
          <label style={REG_LBL}>Organization Name <span style={{color:'#EF4444'}}>*</span></label>
          <input value={orgName} onChange={e => { setOrgName(e.target.value); setErrs(v => ({...v, orgName:null})); }}
            placeholder="e.g. Acme Technologies Pvt. Ltd." style={REG_INP(errs.orgName)}
            onFocus={e => e.target.style.borderColor=PL} onBlur={e => e.target.style.borderColor=errs.orgName?'#EF4444':PBORDER} />
          <ErrMsg msg={errs.orgName} />
        </div>
        <div style={{ gridColumn:'1/-1' }}>
          <label style={REG_LBL}>Workspace URL (auto-generated)</label>
          <div style={{ display:'flex', alignItems:'center', borderRadius:9, border:`1.5px solid ${PBORDER}`, background:'#F1F5F9', overflow:'hidden' }}>
            <span style={{ padding:'10px 12px', fontSize:12, color:MUTED, borderRight:`1px solid ${PBORDER}`, whiteSpace:'nowrap', background:'#E8F0FE' }}>corpgms.com/</span>
            <input value={orgSlug} onChange={e => setOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,''))}
              placeholder="your-org" style={{ ...REG_INP(false), border:'none', background:'transparent', flex:1 }} />
          </div>
        </div>
        <div>
          <label style={REG_LBL}>Industry <span style={{color:'#EF4444'}}>*</span></label>
          <select value={industry} onChange={e => { setIndustry(e.target.value); setErrs(v => ({...v, industry:null})); }} style={REG_SEL(errs.industry)}>
            <option value="">Select Industry</option>
            {INDUSTRIES.map(i => <option key={i}>{i}</option>)}
          </select>
          <ErrMsg msg={errs.industry} />
        </div>
        <div>
          <label style={REG_LBL}>Organization Size <span style={{color:'#EF4444'}}>*</span></label>
          <select value={orgSize} onChange={e => { setOrgSize(e.target.value); setErrs(v => ({...v, orgSize:null})); }} style={REG_SEL(errs.orgSize)}>
            <option value="">Select Size</option>
            {ORG_SIZES.map(s => <option key={s}>{s}</option>)}
          </select>
          <ErrMsg msg={errs.orgSize} />
        </div>
        <div>
          <label style={REG_LBL}>Country</label>
          <select value={country} onChange={handleCountryChange} style={REG_SEL(false)}>
            {COUNTRIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label style={REG_LBL}>City <span style={{color:'#EF4444'}}>*</span></label>
          <select value={city} onChange={e => { setCity(e.target.value); setErrs(v => ({...v, city:null})); }} style={REG_SEL(errs.city)}>
            <option value="">Select City</option>
            {cityOptions.map(c => <option key={c}>{c}</option>)}
          </select>
          <ErrMsg msg={errs.city} />
        </div>
        <div style={{ gridColumn:'1/-1' }}>
          <label style={REG_LBL}>Office Address</label>
          <input value={address} onChange={e => setAddress(e.target.value)}
            placeholder="Street address, building, floor…" style={REG_INP(false)}
            onFocus={e => e.target.style.borderColor=PL} onBlur={e => e.target.style.borderColor=PBORDER} />
        </div>
        <div>
          <label style={REG_LBL}>Website</label>
          <input value={website} onChange={e => { setWebsite(e.target.value); setErrs(v => ({...v, website:null})); }}
            placeholder="https://yourcompany.com" style={REG_INP(errs.website)}
            onFocus={e => e.target.style.borderColor=PL} onBlur={e => e.target.style.borderColor=errs.website?'#EF4444':PBORDER} />
          <ErrMsg msg={errs.website} />
        </div>
        <div>
          <label style={REG_LBL}>GSTIN (optional)</label>
          <input value={gstin} onChange={e => setGstin(e.target.value.toUpperCase())}
            placeholder="22AAAAA0000A1Z5" style={REG_INP(false)}
            onFocus={e => e.target.style.borderColor=PL} onBlur={e => e.target.style.borderColor=PBORDER} />
        </div>

        {/* ── Coupon Code (Optional) — validated via backend /coupons/apply ── */}
        <div style={{ gridColumn:'1/-1' }}>
          <label style={REG_LBL}>Coupon Code (Optional)</label>
          <div style={{ display:'flex', gap:8 }}>
            <input
              value={couponCode}
              onChange={e => setCouponCode(e.target.value.toUpperCase())}
              placeholder="Enter coupon code"
              maxLength={30}
              disabled={couponStatus === 'applied' || couponStatus === 'validating'}
              style={{
                ...REG_INP(false),
                flex:1,
                background: couponStatus === 'applied' ? '#F1F5F9' : undefined,
                cursor: couponStatus === 'applied' ? 'not-allowed' : 'text',
              }}
              onFocus={e => e.target.style.borderColor=PL}
              onBlur={e => e.target.style.borderColor=PBORDER}
            />
            {couponStatus === 'applied' ? (
              <button
                type="button"
                onClick={onRemoveCoupon}
                style={{
                  padding:'10px 16px', borderRadius:9,
                  border:`1.5px solid #FCA5A5`, background:'#FEF2F2',
                  color:'#DC2626', fontSize:12, fontWeight:700, cursor:'pointer',
                  whiteSpace:'nowrap',
                }}
              >
                Remove
              </button>
            ) : (
              <button
                type="button"
                onClick={onApplyCoupon}
                disabled={couponStatus === 'validating' || !couponCode.trim()}
                style={{
                  padding:'10px 18px', borderRadius:9, border:'none',
                  background: couponStatus === 'validating'
                    ? '#94A3B8'
                    : `linear-gradient(135deg,${PL},${PD})`,
                  color:'#fff', fontSize:12, fontWeight:800,
                  cursor: couponStatus === 'validating' || !couponCode.trim() ? 'not-allowed' : 'pointer',
                  opacity: !couponCode.trim() ? 0.6 : 1, whiteSpace:'nowrap',
                }}
              >
                {couponStatus === 'validating' ? 'Validating…' : 'Apply'}
              </button>
            )}
          </div>

          {/* Status + discount summary */}
          {couponStatus === 'applied' && appliedCoupon && (
            <div style={{
              marginTop:8, padding:'10px 12px', borderRadius:9,
              background:'#ECFDF5', border:'1.5px solid #A7F3D0',
              fontSize:12, color:'#065F46',
            }}>
              <div style={{ fontWeight:700, marginBottom:2 }}>
                ✓ {appliedCoupon.message || 'Coupon applied'}
              </div>
              <div style={{ fontSize:11, color:'#047857' }}>
                Code: <strong>{appliedCoupon.code}</strong>
                {appliedCoupon.discountType === 'PERCENTAGE'
                  ? ` · ${appliedCoupon.discountValue}% off`
                  : appliedCoupon.discountType === 'FREE_PLAN'
                  ? ' · Free plan'
                  : ` · ₹${appliedCoupon.discountValue} off`}
              </div>
            </div>
          )}
          {couponStatus === 'invalid' && couponMessage && (
            <div style={{
              marginTop:8, padding:'10px 12px', borderRadius:9,
              background:'#FEF2F2', border:'1.5px solid #FCA5A5',
              fontSize:12, color:'#991B1B', fontWeight:600,
            }}>
              ✕ {couponMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Step 2: Admin Account — defined OUTSIDE modal ── */
function RegStep2({ firstName, setFirstName, lastName, setLastName, adminEmail, setAdminEmail, phone, setPhone, jobTitle, setJobTitle, adminPw, setAdminPw, confirmPw, setConfirmPw, showPw1, setShowPw1, showPw2, setShowPw2, agree, setAgree, errs, setErrs }) {
  return (
    <div style={{ padding:'20px 28px 24px', display:'flex', flexDirection:'column', gap:14 }}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <div>
          <label style={REG_LBL}>First Name <span style={{color:'#EF4444'}}>*</span></label>
          <input value={firstName}
            onChange={e => {
              const v = e.target.value;
              if (/^[a-zA-Z\s'-]*$/.test(v) || v === '') {
                setFirstName(v);
                setErrs(p => ({ ...p, firstName: null }));
              }
            }}
            placeholder="Arjun" style={REG_INP(errs.firstName)}
            onFocus={e => e.target.style.borderColor=PL} onBlur={e => e.target.style.borderColor=errs.firstName?'#EF4444':PBORDER} />
          <ErrMsg msg={errs.firstName} />
        </div>
        <div>
          <label style={REG_LBL}>Last Name <span style={{color:'#EF4444'}}>*</span></label>
          <input value={lastName}
            onChange={e => {
              const v = e.target.value;
              if (/^[a-zA-Z\s'-]*$/.test(v) || v === '') {
                setLastName(v);
                setErrs(p => ({ ...p, lastName: null }));
              }
            }}
            placeholder="Mehta" style={REG_INP(errs.lastName)}
            onFocus={e => e.target.style.borderColor=PL} onBlur={e => e.target.style.borderColor=errs.lastName?'#EF4444':PBORDER} />
          <ErrMsg msg={errs.lastName} />
        </div>
        <div style={{ gridColumn:'1/-1' }}>
          <label style={REG_LBL}>Work Email <span style={{color:'#EF4444'}}>*</span></label>
          <input value={adminEmail} onChange={e => { setAdminEmail(e.target.value); setErrs(v => ({...v, adminEmail:null})); }}
            placeholder="arjun@yourcompany.com" type="email" style={REG_INP(errs.adminEmail)}
            onFocus={e => e.target.style.borderColor=PL} onBlur={e => e.target.style.borderColor=errs.adminEmail?'#EF4444':PBORDER} />
          <ErrMsg msg={errs.adminEmail} />
        </div>
        <div>
          <label style={REG_LBL}>Phone Number <span style={{color:'#EF4444'}}>*</span></label>
          <input value={phone} onChange={e => { setPhone(e.target.value); setErrs(v => ({...v, phone:null})); }}
            placeholder="+91 98765 43210" style={REG_INP(errs.phone)}
            onFocus={e => e.target.style.borderColor=PL} onBlur={e => e.target.style.borderColor=errs.phone?'#EF4444':PBORDER} />
          <ErrMsg msg={errs.phone} />
        </div>
        <div>
          <label style={REG_LBL}>Job Title <span style={{color:'#EF4444'}}>*</span></label>
          <input value={jobTitle} onChange={e => { setJobTitle(e.target.value); setErrs(v => ({...v, jobTitle:null})); }}
            placeholder="e.g. IT Manager, Director" style={REG_INP(errs.jobTitle)}
            onFocus={e => e.target.style.borderColor=PL} onBlur={e => e.target.style.borderColor=errs.jobTitle?'#EF4444':PBORDER} />
          <ErrMsg msg={errs.jobTitle} />
        </div>
        <div>
          <label style={REG_LBL}>Password <span style={{color:'#EF4444'}}>*</span></label>
          <div style={{ position:'relative' }}>
            <input value={adminPw} onChange={e => { setAdminPw(e.target.value); setErrs(v => ({...v, adminPw:null})); }}
              placeholder="Min. 8 characters" type={showPw1?'text':'password'} style={{ ...REG_INP(errs.adminPw), paddingRight:40 }}
              onFocus={e => e.target.style.borderColor=PL} onBlur={e => e.target.style.borderColor=errs.adminPw?'#EF4444':PBORDER} />
            <button type="button" onClick={() => setShowPw1(v => !v)} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', border:'none', background:'transparent', cursor:'pointer', fontSize:14, color:MUTED }}>{showPw1?'🙈':'👁️'}</button>
          </div>
          <ErrMsg msg={errs.adminPw} />
        </div>
        <div>
          <label style={REG_LBL}>Confirm Password <span style={{color:'#EF4444'}}>*</span></label>
          <div style={{ position:'relative' }}>
            <input value={confirmPw} onChange={e => { setConfirmPw(e.target.value); setErrs(v => ({...v, confirmPw:null})); }}
              placeholder="Re-enter password" type={showPw2?'text':'password'} style={{ ...REG_INP(errs.confirmPw), paddingRight:40 }}
              onFocus={e => e.target.style.borderColor=PL} onBlur={e => e.target.style.borderColor=errs.confirmPw?'#EF4444':PBORDER} />
            <button type="button" onClick={() => setShowPw2(v => !v)} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', border:'none', background:'transparent', cursor:'pointer', fontSize:14, color:MUTED }}>{showPw2?'🙈':'👁️'}</button>
          </div>
          <ErrMsg msg={errs.confirmPw} />
        </div>
        {adminPw && (
          <div style={{ gridColumn:'1/-1' }}>
            {(() => {
              const s = [adminPw.length>=8, /[A-Z]/.test(adminPw), /[0-9]/.test(adminPw), /[^A-Za-z0-9]/.test(adminPw)].filter(Boolean).length;
              const labels = ['Weak','Fair','Good','Strong'];
              const colors = ['#EF4444','#F59E0B','#3B82F6','#10B981'];
              return (
                <div>
                  <div style={{ display:'flex', gap:3, marginBottom:4 }}>
                    {[1,2,3,4].map(i => <div key={i} style={{ flex:1, height:4, borderRadius:2, background: i<=s ? colors[s-1] : '#E2E8F0', transition:'background .3s' }} />)}
                  </div>
                  <span style={{ fontSize:11, fontWeight:700, color:colors[s-1] }}>Password strength: {labels[s-1]}</span>
                </div>
              );
            })()}
          </div>
        )}
        <div style={{ gridColumn:'1/-1' }}>
          <label style={{ display:'flex', alignItems:'flex-start', gap:10, cursor:'pointer', fontSize:12, color:MID, lineHeight:1.5 }}>
            <input type="checkbox" checked={agree} onChange={e => { setAgree(e.target.checked); setErrs(v => ({...v, agree:null})); }}
              style={{ width:16, height:16, marginTop:1, accentColor:P, cursor:'pointer', flexShrink:0 }} />
            I agree to the <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color:P, fontWeight:700, textDecoration:'underline', cursor:'pointer' }}>Terms of Service</a> and <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color:P, fontWeight:700, textDecoration:'underline', cursor:'pointer' }}>Privacy Policy</a>. I confirm I am authorized to register this organization.
          </label>
          <ErrMsg msg={errs.agree} />
        </div>
      </div>
    </div>
  );
}

export default function RegistrationModal({ onClose, onSuccess, onLoginAndEnter }) {
  const [step, setStep]     = useState(1);
  const [busy, setBusy]     = useState(false);
  const [errs, setErrs]     = useState({});
  const [selectedPlan, setSelectedPlan] = useState('professional');

  /* Bug 20 — live plans from the Super Admin's plan catalogue. Falls back to
     PLANS_REG when there are no custom plans yet. Also fetches the backend
     /plans catalogue once on mount so features/limits/description ride
     directly from the Plan model. */
  const [customPlansLive] = useCollection(STORAGE_KEYS.SUBSCRIPTION_PLANS, []);
  const [backendPlans, setBackendPlans] = useState([]);
  useEffect(() => {
    let alive = true;
    fetchPlans().then((rows) => { if (alive) setBackendPlans(rows || []); });
    return () => { alive = false; };
  }, []);
  const livePlans = React.useMemo(
    () => buildLivePlans(customPlansLive, PLANS_REG, backendPlans),
    [customPlansLive, backendPlans],
  );

  /* Billing cycle for the Choose Plan / Payment summary. */
  const [billingCycle, setBillingCycle] = useState('monthly');

  /* Payment step state. */
  const [paymentMethod,  setPaymentMethod]  = useState('UPI');
  const [upiId,          setUpiId]          = useState('');
  const [upiAppHint,     setUpiAppHint]     = useState(null);
  const [upiVerifying,   setUpiVerifying]   = useState(false);
  const [upiVerified,    setUpiVerified]    = useState(false);
  const [cardNumber,     setCardNumber]     = useState('');
  const [cardholderName, setCardholderName] = useState('');
  const [cardExpiry,     setCardExpiry]     = useState('');
  const [cardCvv,        setCardCvv]        = useState('');
  const [bankName,       setBankName]       = useState('State Bank of India');
  const [walletProvider, setWalletProvider] = useState('');
  const [paying,         setPaying]         = useState(false);
  const [paymentError,   setPaymentError]   = useState('');
  const [createdOrgRef,  setCreatedOrgRef]  = useState(null);

  /* Editing the UPI ID always invalidates the prior verification badge —
     otherwise users could verify, then change the handle, and submit. */
  useEffect(() => { setUpiVerified(false); }, [upiId]);

  const [orgName,     setOrgName]     = useState('');
  const [orgSlug,     setOrgSlug]     = useState('');
  const [industry,    setIndustry]    = useState('');
  const [orgSize,     setOrgSize]     = useState('');
  const [country,     setCountry]     = useState('India');
  const [city,        setCity]        = useState('');
  const [address,     setAddress]     = useState('');
  const [website,     setWebsite]     = useState('');
  const [gstin,       setGstin]       = useState('');

  const [firstName,   setFirstName]   = useState('');
  const [lastName,    setLastName]    = useState('');
  const [adminEmail,  setAdminEmail]  = useState('');
  const [phone,       setPhone]       = useState('');
  const [jobTitle,    setJobTitle]    = useState('');
  const [adminPw,     setAdminPw]     = useState('');
  const [confirmPw,   setConfirmPw]   = useState('');
  const [showPw1,     setShowPw1]     = useState(false);
  const [showPw2,     setShowPw2]     = useState(false);
  const [agree,       setAgree]       = useState(false);
  /* ── Coupon state ──
     couponCode      — raw input value
     couponStatus    — 'idle' | 'validating' | 'applied' | 'invalid'
     couponMessage   — server-supplied error message when status is 'invalid'
     appliedCoupon   — full coupon details from /coupons/apply, persisted
                       across all 4 steps. Cleared on Remove. */
  const [couponCode,    setCouponCode]    = useState('');
  const [couponStatus,  setCouponStatus]  = useState('idle');
  const [couponMessage, setCouponMessage] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);

  const handleApplyCoupon = async () => {
    const code = (couponCode || '').trim().toUpperCase();
    if (!code) return;
    setCouponStatus('validating');
    setCouponMessage('');
    const planLabel = ({ starter: 'Starter', professional: 'Professional', enterprise: 'Enterprise' })[selectedPlan] || 'Starter';
    const result = await applyCouponApi({
      couponCode: code,
      organizationSize: orgSize,
      selectedPlan: planLabel,
    });
    if (result?.valid && result.coupon) {
      setAppliedCoupon(result.coupon);
      setCouponStatus('applied');
      setCouponMessage('');
    } else {
      setAppliedCoupon(null);
      setCouponStatus('invalid');
      setCouponMessage(result?.message || 'Invalid Coupon Code');
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponStatus('idle');
    setCouponMessage('');
  };

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const esc = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
    document.addEventListener('keydown', esc);
    return () => { document.body.style.overflow = prev; document.removeEventListener('keydown', esc); };
  }, [onClose, busy]);

  useEffect(() => {
    setOrgSlug(orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
  }, [orgName]);

  const isOrgNameTaken = (name) => {
    try {
      const norm = name.trim().toLowerCase();
      const DEMOS = ['acme technologies', 'acme', 'corpgms'];
      if (DEMOS.includes(norm)) return true;
      const a = JSON.parse(localStorage.getItem('cgms_organizations') || '[]');
      const b = JSON.parse(localStorage.getItem('cgms_registered_orgs') || '[]');
      return [...a, ...b].some(o => (o.name || '').trim().toLowerCase() === norm);
    } catch { return false; }
  };

  const isEmailTaken = (email) => {
    try {
      const norm = email.trim().toLowerCase();
      const DEMOS = ['superadmin@corpgms.com','director@corpgms.com','manager@corpgms.com',
                     'reception@corpgms.com','service@corpgms.com'];
      if (DEMOS.includes(norm)) return true;
      const users = JSON.parse(localStorage.getItem('cgms_registered_users') || '[]');
      return users.some(u => (u.email || u.emailId || '').trim().toLowerCase() === norm);
    } catch { return false; }
  };

  const validateStep1 = () => {
    const e = {};
    if (!orgName.trim())
      e.orgName = 'Organization name is required.';
    else if (orgName.trim().length < 3)
      e.orgName = 'Organization name must be at least 3 characters.';
    else if (!ONLY_LETTERS_RE.test(orgName.trim()))
      e.orgName = 'Organization name cannot start with numbers or special characters.';
    else if (isOrgNameTaken(orgName))
      e.orgName = 'This organization name is already registered. Please use a unique name.';

    if (!industry)  e.industry = 'Please select your industry.';
    if (!orgSize)   e.orgSize  = 'Please select organization size.';
    if (!city)      e.city     = 'Please select your city.';

    if (website && !WEBSITE_RE.test(website.trim()))
      e.website = 'Please enter a valid website URL (e.g. https://yourcompany.com).';

    setErrs(e);
    return Object.keys(e).length === 0;
  };

  const validateStep2 = () => {
    const e = {};

    if (!firstName.trim())
      e.firstName = 'First name is required.';
    else if (!NAME_ONLY_RE.test(firstName.trim()))
      e.firstName = 'First name must contain letters only — no numbers or symbols.';

    if (!lastName.trim())
      e.lastName = 'Last name is required.';
    else if (!NAME_ONLY_RE.test(lastName.trim()))
      e.lastName = 'Last name must contain letters only — no numbers or symbols.';

    if (!adminEmail.trim())
      e.adminEmail = 'Email is required.';
    else if (!LM_EMAIL_RE.test(adminEmail))
      e.adminEmail = 'Enter a valid email address.';
    else if (isEmailTaken(adminEmail))
      e.adminEmail = 'This email is already registered. Please use a different email.';

    if (!phone.trim())
      e.phone = 'Phone number is required.';
    else if (!PHONE_RE.test(phone.trim()))
      e.phone = 'Enter a valid phone number (7–15 digits).';

    if (!jobTitle.trim())
      e.jobTitle = 'Job title is required.';
    else if (/^\d/.test(jobTitle.trim()))
      e.jobTitle = 'Job title must not start with a number.';

    if (!adminPw)
      e.adminPw = 'Password is required.';
    else if (adminPw.length < 8)
      e.adminPw = 'Password must be at least 8 characters.';

    if (!confirmPw)
      e.confirmPw = 'Please confirm your password.';
    else if (confirmPw !== adminPw)
      e.confirmPw = 'Passwords do not match.';

    if (!agree) e.agree = 'You must accept the terms to continue.';

    setErrs(e);
    return Object.keys(e).length === 0;
  };

  const validatePayment = () => {
    const e = {};
    const planObj = livePlans.find((p) => p.id === selectedPlan);
    const basePrice = planObj?.priceValue || PLAN_PRICE_MAP[selectedPlan] || 0;
    /* Free plans don't need payment validation. */
    if (basePrice === 0) {
      setErrs(e);
      return true;
    }
    if (paymentMethod === 'UPI') {
      if (!upiId.trim()) e.upiId = 'UPI ID is required.';
      else if (!UPI_RE.test(upiId.trim())) e.upiId = 'Enter a valid UPI ID, e.g. name@bank.';
    } else if (paymentMethod === 'CARD') {
      const digitsOnly = cardNumber.replace(/\s+/g, '');
      if (!digitsOnly)                    e.cardNumber = 'Card number is required.';
      else if (!CARD_RE.test(digitsOnly)) e.cardNumber = 'Card number must be 16 digits.';
      else if (!luhnCheck(digitsOnly))    e.cardNumber = 'This card number is invalid (failed Luhn check).';
      if (!cardholderName.trim())                       e.cardholderName = 'Cardholder name is required.';
      else if (!NAME_ONLY_RE.test(cardholderName.trim())) e.cardholderName = 'Name must contain letters only.';
      if (!cardExpiry)                  e.cardExpiry = 'Expiry is required.';
      else if (!EXP_RE.test(cardExpiry)) e.cardExpiry = 'Expiry must be in MM/YY format.';
      if (!cardCvv)                  e.cardCvv = 'CVV is required.';
      else if (!CVV_RE.test(cardCvv)) e.cardCvv = 'CVV must be 3 or 4 digits.';
    } else if (paymentMethod === 'NETBANKING') {
      if (!bankName) e.bankName = 'Please select a bank.';
    } else if (paymentMethod === 'WALLET') {
      if (!walletProvider) e.walletProvider = 'Please select a wallet provider.';
    }
    setErrs(e);
    return Object.keys(e).length === 0;
  };

  /* Persist a new organisation + subscription record, then advance to
     the success screen. Called from Step 4 (Payment) once the form
     has validated. Failures abort silently — the modal stays open
     so the user can retry. */
  const persistOrganisation = async (txn) => {
      // Save new Organization — format matching MOCK_ORGANIZATIONS shape so SuperAdmin panel shows it
      const orgId = 'org-' + orgSlug + '-' + Date.now();
      const planLabels = { starter: 'Starter', professional: 'Professional', enterprise: 'Enterprise' };
      const planMrr    = PLAN_PRICE_MAP;
      const now = new Date().toISOString();

      /* Recompute the discount locally from the validated coupon for the
         summary. The backend authoritative copy comes from /coupons/redeem
         below — we never trust this number for billing. */
      const planLabel = planLabels[selectedPlan] || 'Starter';
      const basePrice = planMrr[selectedPlan] || 0;
      let discountSnapshot = null;
      if (appliedCoupon && basePrice > 0) {
        const t = (appliedCoupon.discountType || '').toUpperCase();
        let discount = 0;
        if (t === 'PERCENTAGE')      discount = Math.round((Number(appliedCoupon.discountValue) / 100) * basePrice);
        else if (t === 'FLAT' || t === 'FIXED') discount = Math.min(Number(appliedCoupon.discountValue), basePrice);
        else if (t === 'FREE_PLAN')  discount = basePrice;
        discountSnapshot = {
          code:           appliedCoupon.code,
          discountType:   appliedCoupon.discountType,
          discountValue:  appliedCoupon.discountValue,
          discountAmount: discount,
          planPrice:      basePrice,
          finalAmount:    Math.max(0, basePrice - discount),
          appliedAt:      now,
        };
      }

      /* Bug 20 — every new organisation gets a 7-day free trial regardless
         of the plan picked. The dashboard banner reads trialEndsAt and
         shows the days remaining; daily trial reminder emails are
         dispatched by the backend cron in jobs/platform.job.js. */
      const TRIAL_DAYS = 7;
      const trialStartIso = now;
      const trialEndIso = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();

      const newOrg = {
        id:          orgId,
        name:        orgName,
        slug:        orgSlug,
        industry,
        size:        orgSize,
        location:    city + ', ' + country,
        country,
        city,
        address,
        website,
        gstin,
        plan:        planLabel,
        planId:      selectedPlan,
        mrr:         discountSnapshot ? discountSnapshot.finalAmount : basePrice,
        status:      'Trial',
        subscriptionStatus: 'Trial',
        trialStartedAt: trialStartIso,
        trialEndsAt:    trialEndIso,
        trialDaysLeft:  TRIAL_DAYS,
        users:       1,
        adminName:    firstName + ' ' + lastName,
        adminEmail,
        adminPhone:   phone,
        adminTitle:   jobTitle,
        primaryName:  firstName + ' ' + lastName,
        primaryEmail: adminEmail,
        primaryPhone: phone,
        createdAt:   now,
        registeredAt: now,
        couponCode:      appliedCoupon ? appliedCoupon.code : null,
        appliedDiscount: discountSnapshot,
      };

      /* Fire-and-forget: tell the backend a real organisation was created
         so it can increment usedCount under the maxUses cap. The frontend
         display already used the validated discount; if redeem fails, the
         org still exists locally — usedCount just isn't bumped. */
      if (appliedCoupon) {
        redeemCoupon({
          couponCode: appliedCoupon.code,
          organizationSize: orgSize,
          selectedPlan: planLabel,
        }).catch(() => { /* non-fatal */ });
      }

      // Save to cgms_organizations (same key SuperAdmin panel reads)
      try {
        const existingOrgs = JSON.parse(localStorage.getItem('cgms_organizations') || 'null');
        const base = Array.isArray(existingOrgs) ? existingOrgs : [];
        base.unshift(newOrg);
        localStorage.setItem('cgms_organizations', JSON.stringify(base));
      } catch(e) {}

      try {
        const regOrgs = JSON.parse(localStorage.getItem('cgms_registered_orgs') || '[]');
        regOrgs.push(newOrg);
        localStorage.setItem('cgms_registered_orgs', JSON.stringify(regOrgs));
      } catch(e) {}

      // Push SuperAdmin notification into cgms.notifications.v1
      try {
        const notifKey = 'cgms.notifications.v1';
        const existing = JSON.parse(localStorage.getItem(notifKey) || '[]');
        const notif = {
          id:        'notif-neworg-' + Date.now(),
          title:     'New Organisation Registered',
          message:   orgName + ' has registered on CorpGMS. Plan: ' + (planLabels[selectedPlan] || 'Starter') + '. Industry: ' + industry + '. Admin: ' + firstName + ' ' + lastName + ' (' + adminEmail + '). City: ' + city + ', ' + country + '.',
          type:      'system_alert',
          severity:  'success',
          icon:      '🏢',
          actorName: firstName + ' ' + lastName,
          roles:     ['superadmin'],
          orgId:     null,
          link:      { page: 'admin' },
          timestamp: now,
          isRead:    false,
        };
        existing.unshift(notif);
        localStorage.setItem(notifKey, JSON.stringify(existing));
        window.dispatchEvent(new Event('notifications-updated'));
      } catch(e) {}

      // Create default Head Office so Staff/Appointments work immediately
      const officeId = 'OFC-' + orgId;
      const newOffice = {
        id: officeId,
        orgId: orgId,
        name: orgName + ' - Head Office',
        code: orgSlug.toUpperCase().slice(0, 6) + '-HQ',
        type: 'HQ',
        status: 'Active',
        address: { line1: address || '–', city, country, state: '', postalCode: '' },
        contact: { contactNumber: phone, emailId: adminEmail, managerName: firstName + ' ' + lastName },
        operations: {
          openTime: '09:00', closeTime: '18:00',
          workingDays: ['Mon','Tue','Wed','Thu','Fri'],
          timezone: country === 'India' ? 'Asia/Kolkata' : 'UTC',
          maxCapacity: 100,
        },
        createdAt: now,
      };
      try {
        const existingOffices = JSON.parse(localStorage.getItem('cgms_offices_v2') || '[]');
        existingOffices.push(newOffice);
        localStorage.setItem('cgms_offices_v2', JSON.stringify(existingOffices));
      } catch(e) {}

      const referredByCode = getReferralFromURL();
      const referrer = referredByCode ? findUserByReferralCode(referredByCode) : null;
      const newUserId = 'usr-' + Date.now();
      const ownReferralCode = generateUniqueReferralCode(
        firstName + lastName,
        getAllReferralCodes(),
      );

      const newUser = {
        id: newUserId,
        staffId: 'staff-' + Date.now(),
        fullName: firstName + ' ' + lastName,
        name: firstName + ' ' + lastName,
        email: adminEmail,
        emailId: adminEmail,
        phone,
        jobTitle,
        password: adminPw,
        role: 'director',
        organisationId: orgId,
        orgId,
        officeId,
        icon: '\u{1F451}',
        label: 'Director',
        color: '#5a4bd1',
        bg: '#eef2f9',
        border: '#e9e4ff',
        badge: 'Executive',
        desc: 'Organisation owner',
        status: 'Active',
        createdAt: new Date().toISOString(),
        referralCode: ownReferralCode,
        referredBy: referrer ? referredByCode : null,
      };
      try {
        const existingUsers = JSON.parse(localStorage.getItem('cgms_registered_users') || '[]');
        existingUsers.push(newUser);
        localStorage.setItem('cgms_registered_users', JSON.stringify(existingUsers));
      } catch(e) {}

      if (referrer) {
        createReferralOnSignup({
          referredUserId: newUserId,
          referredBy: referredByCode,
        });
      }

      /* Persist a Subscription record (with payment ledger) so the
         tenant Subscription page and the Super-Admin overview render the
         new tenant immediately, and the user can see the receipt. */
      try {
        const planObj = livePlans.find((p) => p.id === selectedPlan);
        const planLabelOut = planObj?.label || planLabels[selectedPlan] || 'Starter';
        const cycleAmount = billingCycle === 'yearly'
          ? Number(planObj?.yearlyPrice) || (basePrice * 12)
          : basePrice;
        const finalAmount = discountSnapshot ? discountSnapshot.finalAmount : cycleAmount;
        const cycleEnd = new Date();
        if (billingCycle === 'yearly') cycleEnd.setFullYear(cycleEnd.getFullYear() + 1);
        else cycleEnd.setMonth(cycleEnd.getMonth() + 1);

        const subId = 'sub-' + orgId;
        const payments = [];
        if (txn && finalAmount > 0) {
          payments.push({
            id:            'pay-' + Date.now(),
            transactionId: txn.transactionId,
            amount:        finalAmount,
            currency:      'INR',
            paymentMethod: txn.paymentMethod,
            methodDetails: txn.methodDetails || {},
            status:        'SUCCESS',
            paidAt:        now,
          });
        }
        const subRecord = {
          id:             subId,
          organisationId: orgId,
          orgName,
          planId:         planObj?._id || selectedPlan,
          planName:       planLabelOut,
          amount:         finalAmount,
          currency:       'INR',
          billingCycle,
          status:         finalAmount === 0 ? 'trial' : 'active',
          startDate:      now,
          endDate:        cycleEnd.toISOString(),
          autoRenew:      true,
          paymentMethod:  txn?.paymentMethod || null,
          payments,
          createdAt:      now,
        };
        const existingSubs = JSON.parse(localStorage.getItem('cgms_subscriptions_v1') || '[]');
        existingSubs.unshift(subRecord);
        localStorage.setItem('cgms_subscriptions_v1', JSON.stringify(existingSubs));
      } catch (_e) { /* localStorage unavailable — non-fatal */ }

      /* Used by the Step 5 success card to render the receipt details. */
      const nextBillingIso = (() => {
        const d = new Date();
        if (billingCycle === 'yearly') d.setFullYear(d.getFullYear() + 1);
        else d.setMonth(d.getMonth() + 1);
        return d.toISOString();
      })();
      setCreatedOrgRef({
        orgId,
        planLabel,
        transactionId: txn?.transactionId || null,
        nextBillingDate: nextBillingIso,
      });
      setBusy(false);
      setStep(5);
  };

  const nextStep = async () => {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    if (step === 3) {
      /* Just advance — actual creation happens after payment in Step 4. */
      setErrs({});
      setStep(4);
      return;
    }
    if (step === 4) {
      if (!validatePayment()) return;
      setPaymentError('');
      setBusy(true);
      setPaying(true);
      try {
        /* Simulated payment delay. */
        await new Promise(r => setTimeout(r, 1200));
        const planObj = livePlans.find((p) => p.id === selectedPlan);
        const basePrice = planObj?.priceValue || PLAN_PRICE_MAP[selectedPlan] || 0;
        const cycleAmount = billingCycle === 'yearly'
          ? Number(planObj?.yearlyPrice) || (basePrice * 12)
          : basePrice;
        const cardDigits = cardNumber.replace(/\s+/g, '');
        const txn = cycleAmount > 0 ? {
          transactionId: `TXN-${Date.now()}-${Math.random().toString(36).slice(2,8).toUpperCase()}`,
          paymentMethod,
          methodDetails:
            paymentMethod === 'UPI'        ? { upiId, verified: upiVerified, app: upiAppHint || null } :
            paymentMethod === 'CARD'       ? {
              cardLast4: cardDigits.slice(-4),
              cardholderName,
              cardType: detectCardType(cardDigits),
            } :
            paymentMethod === 'NETBANKING' ? { bankName } :
            paymentMethod === 'WALLET'     ? { walletProvider } : {},
        } : null;
        await persistOrganisation(txn);
      } catch (err) {
        setPaymentError(err?.message || 'Payment failed. Please try again.');
        setBusy(false);
      }
      setPaying(false);
      return;
    }
    setErrs({});
    setStep(s => s + 1);
  };

  const STEPS = ['Organization','Admin Account','Choose Plan','Payment','Done'];

  const StepBar = () => (
    <div style={{ display:'flex', alignItems:'center', gap:0, padding:'18px 28px 0' }}>
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done    = step > n;
        const current = step === n;
        return (
          <React.Fragment key={n}>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', minWidth:0 }}>
              <div style={{
                width:30, height:30, borderRadius:'50%', fontSize:12, fontWeight:800,
                display:'flex', alignItems:'center', justifyContent:'center',
                background: done ? '#10B981' : current ? `linear-gradient(135deg,${PL},${PD})` : '#E2E8F0',
                color: (done || current) ? '#fff' : '#94A3B8',
                boxShadow: current ? `0 4px 12px ${PL}55` : 'none',
                transition:'all .3s',
              }}>
                {done ? '✓' : n}
              </div>
              <span style={{ fontSize:10, fontWeight:700, color: current ? P : done ? '#10B981' : '#94A3B8', marginTop:4, whiteSpace:'nowrap' }}>{label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ flex:1, height:2, background: step > n ? '#10B981' : '#E2E8F0', margin:'0 6px 18px', transition:'background .3s' }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );

  const Step3 = () => {
    const activePlan = livePlans.find((p) => p.id === selectedPlan) || livePlans[0];
    const activeBasePrice = activePlan?.priceValue || PLAN_PRICE_MAP[activePlan?.id] || 0;
    const activeYearlyPrice = activePlan?.yearlyPrice || activeBasePrice * 12;
    const cycleAmount = billingCycle === 'yearly' ? activeYearlyPrice : activeBasePrice;
    let activeDiscount = null;
    if (appliedCoupon && cycleAmount > 0) {
      const t = (appliedCoupon.discountType || '').toUpperCase();
      let d = 0;
      if (t === 'PERCENTAGE')               d = Math.round((Number(appliedCoupon.discountValue) / 100) * cycleAmount);
      else if (t === 'FLAT' || t === 'FIXED') d = Math.min(Number(appliedCoupon.discountValue), cycleAmount);
      else if (t === 'FREE_PLAN')           d = cycleAmount;
      activeDiscount = { discount: d, finalAmt: Math.max(0, cycleAmount - d) };
    }

    return (
      <div style={{ padding:'20px 28px 24px' }}>
        <p style={{ fontSize:13, color:MID, marginBottom:14, lineHeight:1.5 }}>
          Choose the plan that best fits your organization. Click any plan to see what&apos;s included. You can upgrade anytime.
        </p>

        {appliedCoupon && (
          <div style={{
            marginBottom:14, padding:'10px 12px', borderRadius:9,
            background:'#ECFDF5', border:'1.5px solid #A7F3D0',
            display:'flex', alignItems:'center', justifyContent:'space-between', gap:8,
          }}>
            <div style={{ fontSize:12, color:'#065F46' }}>
              <strong>{appliedCoupon.code}</strong> applied · {appliedCoupon.message || 'Discount active'}
            </div>
            <button
              type="button"
              onClick={handleRemoveCoupon}
              style={{
                padding:'4px 10px', borderRadius:6, border:'1px solid #FCA5A5',
                background:'#FEF2F2', color:'#DC2626', fontSize:11, fontWeight:700, cursor:'pointer',
              }}
            >
              Remove
            </button>
          </div>
        )}

        {/* Billing cycle toggle */}
        <div role="radiogroup" aria-label="Billing cycle"
          style={{ display:'inline-flex', gap:4, padding:4, marginBottom:14,
            background:'#F1F5F9', border:`1px solid ${PBORDER}`, borderRadius:10 }}>
          {[
            { value:'monthly', label:'Monthly' },
            { value:'yearly',  label:'Yearly · Save 20%' },
          ].map((c) => {
            const active = billingCycle === c.value;
            return (
              <button key={c.value} type="button" onClick={() => setBillingCycle(c.value)}
                role="radio" aria-checked={active}
                style={{
                  padding:'6px 14px', borderRadius:8, border:'none',
                  background: active ? `linear-gradient(135deg,${PL},${PD})` : 'transparent',
                  color: active ? '#fff' : MID,
                  fontFamily:'Outfit,sans-serif', fontWeight:800, fontSize:11,
                  cursor:'pointer',
                }}>
                {c.label}
              </button>
            );
          })}
        </div>

        {/* Two-column layout — plan list on the left, detail panel on the right.
            On narrow screens the detail panel falls below the list. */}
        <div className="reg-plan-grid" style={{
          display:'grid', gridTemplateColumns:'1fr 1.1fr', gap:16, alignItems:'start',
        }}>
          <div style={{ display:'flex', flexDirection:'column', gap:10, minWidth:0 }}>
            {livePlans.map(plan => {
              const active = selectedPlan === plan.id;
              const basePrice = plan.priceValue || PLAN_PRICE_MAP[plan.id] || 0;
              const cyclePrice = billingCycle === 'yearly'
                ? (plan.yearlyPrice || basePrice * 12)
                : basePrice;
              let discountedDisplay = null;
              if (appliedCoupon && cyclePrice > 0) {
                const t = (appliedCoupon.discountType || '').toUpperCase();
                let discount = 0;
                if (t === 'PERCENTAGE')               discount = Math.round((Number(appliedCoupon.discountValue) / 100) * cyclePrice);
                else if (t === 'FLAT' || t === 'FIXED') discount = Math.min(Number(appliedCoupon.discountValue), cyclePrice);
                else if (t === 'FREE_PLAN')           discount = cyclePrice;
                discountedDisplay = { discount, finalAmt: Math.max(0, cyclePrice - discount) };
              }
              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedPlan(plan.id)}
                  aria-pressed={active}
                  style={{
                    textAlign:'left',
                    border:`2px solid ${active ? plan.color : '#E2E8F0'}`,
                    borderRadius:12, padding:'14px 16px', cursor:'pointer',
                    background: active ? plan.bg : '#FAFCFF',
                    transition:'all .2s',
                    boxShadow: active ? `0 4px 16px ${plan.color}22` : 'none',
                  }}
                >
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
                      <span style={{ fontSize:22 }}>{plan.icon}</span>
                      <div style={{ minWidth:0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <span style={{ fontFamily:'Outfit,sans-serif', fontWeight:800, fontSize:14, color:DARK }}>{plan.label}</span>
                          <span style={{ fontSize:10, fontWeight:800, padding:'2px 8px', borderRadius:20, background:plan.color, color:'#fff', whiteSpace:'nowrap' }}>{plan.badge}</span>
                        </div>
                        {discountedDisplay && discountedDisplay.discount > 0 ? (
                          <span style={{ fontSize:13, fontWeight:800, color:plan.color, display:'flex', alignItems:'center', gap:6 }}>
                            <span style={{ textDecoration:'line-through', color:MUTED, fontSize:11, fontWeight:600 }}>
                              {fmtPrice(cyclePrice)}
                            </span>
                            <span>{fmtPrice(discountedDisplay.finalAmt)}/{billingCycle === 'yearly' ? 'yr' : 'mo'}</span>
                          </span>
                        ) : (
                          <span style={{ fontSize:13, fontWeight:800, color:plan.color }}>
                            {cyclePrice > 0 ? `${fmtPrice(cyclePrice)}/${billingCycle === 'yearly' ? 'yr' : 'mo'}` : 'Free'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{
                      width:20, height:20, borderRadius:'50%',
                      border:`2px solid ${active ? plan.color : '#CBD5E1'}`,
                      background: active ? plan.color : '#fff',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      flexShrink:0,
                    }}>
                      {active && <div style={{ width:8, height:8, borderRadius:'50%', background:'#fff' }} />}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Detail panel — features, limits, "Select This Plan" CTA. */}
          <div style={{
            border:`2px solid ${activePlan?.color || PBORDER}`,
            borderRadius:14,
            background: activePlan?.bg || '#FAFCFF',
            padding:'18px 18px 16px',
            position:'sticky', top:0,
            minWidth:0,
          }}>
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:10, marginBottom:8 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
                <span style={{ fontSize:30 }}>{activePlan?.icon}</span>
                <div style={{ minWidth:0 }}>
                  <h3 style={{ margin:0, fontFamily:'Outfit,sans-serif', fontWeight:900, fontSize:17, color:DARK }}>{activePlan?.label}</h3>
                  <span style={{ fontSize:10, fontWeight:800, padding:'2px 8px', borderRadius:20, background:activePlan?.color, color:'#fff', whiteSpace:'nowrap' }}>{activePlan?.badge}</span>
                </div>
              </div>
              <div style={{ textAlign:'right' }}>
                {activeDiscount && activeDiscount.discount > 0 ? (
                  <>
                    <div style={{ fontSize:11, color:MUTED, textDecoration:'line-through', fontWeight:600 }}>
                      {fmtPrice(cycleAmount)}
                    </div>
                    <div style={{ fontSize:18, fontWeight:900, color:activePlan?.color }}>
                      {fmtPrice(activeDiscount.finalAmt)}<span style={{ fontSize:11, color:MID, marginLeft:2 }}>/{billingCycle === 'yearly' ? 'yr' : 'mo'}</span>
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize:18, fontWeight:900, color:activePlan?.color }}>
                    {cycleAmount > 0 ? <>{fmtPrice(cycleAmount)}<span style={{ fontSize:11, color:MID, marginLeft:2 }}>/{billingCycle === 'yearly' ? 'yr' : 'mo'}</span></> : 'Free'}
                  </div>
                )}
                <div style={{ fontSize:10, color:MUTED, fontWeight:600, textTransform:'uppercase', letterSpacing:'.06em' }}>
                  {billingCycle === 'yearly' ? 'Annual billing' : 'Monthly billing'}
                </div>
              </div>
            </div>

            {activePlan?.description && (
              <p style={{ margin:'4px 0 12px', fontSize:12, color:MID, lineHeight:1.55 }}>
                {activePlan.description}
              </p>
            )}

            {/* Limits */}
            <div style={{
              display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:8,
              marginBottom:14, padding:10, borderRadius:10,
              background:'#fff', border:`1px solid ${PBORDER}`,
            }}>
              {[
                { label:'Max Guests',  value:fmtLimit(activePlan?.maxGuests) },
                { label:'Max Staff',   value:fmtLimit(activePlan?.maxStaff) },
                { label:'Max Offices', value:fmtLimit(activePlan?.maxOffices) },
              ].map((m) => (
                <div key={m.label} style={{ textAlign:'center' }}>
                  <div style={{ fontSize:14, fontWeight:900, color:DARK, fontFamily:'Outfit,sans-serif' }}>{m.value}</div>
                  <div style={{ fontSize:10, color:MUTED, fontWeight:700, textTransform:'uppercase', letterSpacing:'.05em' }}>{m.label}</div>
                </div>
              ))}
            </div>

            {/* Features / Modules */}
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:11, fontWeight:800, color:MID, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>
                What&apos;s included
              </div>
              {Array.isArray(activePlan?.features) && activePlan.features.length > 0 ? (
                <ul style={{ margin:0, padding:0, listStyle:'none', display:'flex', flexDirection:'column', gap:6 }}>
                  {activePlan.features.map((f) => (
                    <li key={f} style={{ display:'flex', alignItems:'flex-start', gap:8, fontSize:12.5, color:MID, lineHeight:1.5 }}>
                      <span style={{
                        width:18, height:18, borderRadius:'50%',
                        background:'#10B98122', color:'#059669',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        flexShrink:0, fontSize:11, fontWeight:900,
                      }}>✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ margin:0, fontSize:12, color:MUTED, fontStyle:'italic' }}>
                  Feature list will appear once the plan catalogue loads.
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => { setErrs({}); setStep(4); }}
              style={{
                width:'100%', padding:'11px 14px', borderRadius:10, border:'none',
                background:`linear-gradient(135deg,${PL},${PD})`, color:'#fff',
                fontFamily:'Outfit,sans-serif', fontWeight:800, fontSize:13, cursor:'pointer',
                boxShadow:`0 6px 20px ${PL}44`,
              }}
            >
              Select {activePlan?.label} Plan →
            </button>
          </div>
        </div>

        <style>{`
          @media (max-width: 720px) {
            .reg-plan-grid { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </div>
    );
  };

  const Step4Payment = () => {
    const planObj = livePlans.find((p) => p.id === selectedPlan) || livePlans[0];
    const basePrice = planObj?.priceValue || PLAN_PRICE_MAP[planObj?.id] || 0;
    const yearlyPrice = planObj?.yearlyPrice || basePrice * 12;
    const cycleAmount = billingCycle === 'yearly' ? yearlyPrice : basePrice;
    let discountedAmount = cycleAmount;
    let discountValue = 0;
    if (appliedCoupon && cycleAmount > 0) {
      const t = (appliedCoupon.discountType || '').toUpperCase();
      if (t === 'PERCENTAGE')               discountValue = Math.round((Number(appliedCoupon.discountValue) / 100) * cycleAmount);
      else if (t === 'FLAT' || t === 'FIXED') discountValue = Math.min(Number(appliedCoupon.discountValue), cycleAmount);
      else if (t === 'FREE_PLAN')           discountValue = cycleAmount;
      discountedAmount = Math.max(0, cycleAmount - discountValue);
    }

    const formatCardInput = (val) => {
      const digits = val.replace(/\D+/g, '').slice(0, 16);
      return digits.replace(/(.{4})/g, '$1 ').trim();
    };
    const formatExpiryInput = (val) => {
      const digits = val.replace(/\D+/g, '').slice(0, 4);
      if (digits.length <= 2) return digits;
      return digits.slice(0, 2) + '/' + digits.slice(2);
    };

    const cardDigits = cardNumber.replace(/\s+/g, '');
    const cardType   = detectCardType(cardDigits);
    const brandStyle = cardType ? CARD_BRAND_STYLES[cardType] : null;

    const verifyUpi = async () => {
      const id = (upiId || '').trim();
      if (!UPI_RE.test(id)) {
        setErrs(v => ({ ...v, upiId: 'Enter a valid UPI ID, e.g. name@bank.' }));
        return;
      }
      setUpiVerifying(true);
      /* Simulated VPA lookup — real integrations would hit the PSP here. */
      await new Promise(r => setTimeout(r, 800));
      setUpiVerified(true);
      setUpiVerifying(false);
    };

    const pickUpiApp = (app) => {
      setUpiAppHint(app.id);
      setUpiId((prev) => {
        const at = prev.indexOf('@');
        const handle = at >= 0 ? prev.slice(0, at) : prev;
        return handle + app.suffix;
      });
      setErrs(v => ({ ...v, upiId: null }));
    };

    return (
      <div style={{ padding:'20px 28px 24px', display:'flex', flexDirection:'column', gap:14 }}>
        <p style={{ fontSize:13, color:MID, margin:0, lineHeight:1.5 }}>
          Review your order and complete the payment to activate <strong>{planObj?.label}</strong>.
        </p>

        {/* Order summary */}
        <div style={{
          border:`1.5px solid ${PBORDER}`, borderRadius:12, padding:14,
          background:'#FAFCFF', display:'flex', flexDirection:'column', gap:6,
        }}>
          <div style={{ fontSize:11, fontWeight:800, color:MID, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:4 }}>
            Order Summary
          </div>
          <SummaryRow k={`${planObj?.label} Plan (${billingCycle === 'yearly' ? 'Annual' : 'Monthly'})`} v={fmtPrice(cycleAmount)} />
          {discountValue > 0 && (
            <SummaryRow k={`Coupon ${appliedCoupon?.code || ''}`} v={`-${fmtPrice(discountValue)}`} highlight />
          )}
          <div style={{ height:1, background:PBORDER, margin:'6px 0' }} />
          <SummaryRow k="Total Due" v={discountedAmount > 0 ? fmtPrice(discountedAmount) : 'Free'} bold />
          <div style={{ fontSize:11, color:MUTED, fontWeight:600 }}>
            Renews automatically on {new Date(Date.now() + (billingCycle === 'yearly' ? 365 : 30) * 86400000).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}.
          </div>
        </div>

        {discountedAmount === 0 ? (
          <div style={{
            padding:'14px 16px', borderRadius:12,
            background:'#F0FDF4', border:'1.5px solid #A7F3D0',
            fontSize:13, color:'#065F46', fontWeight:600, lineHeight:1.5,
          }}>
            🎉 No payment required for this plan. Click <strong>Pay Now</strong> to provision your organisation.
          </div>
        ) : (
          <>
            {paymentError && (
              <div style={{
                padding:'10px 12px', borderRadius:9,
                background:'#FEF2F2', border:'1.5px solid #FCA5A5',
                fontSize:12, color:'#991B1B', fontWeight:600,
                display:'flex', alignItems:'center', gap:8,
              }}>
                <span style={{ fontSize:14 }}>⚠️</span>
                <span>{paymentError}</span>
              </div>
            )}

            {/* Payment method tabs */}
            <div role="radiogroup" aria-label="Payment Method"
              style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {[
                { id:'CARD',       label:'Card',         icon:'💳' },
                { id:'UPI',        label:'UPI',          icon:'📱' },
                { id:'NETBANKING', label:'Net Banking',  icon:'🏦' },
                { id:'WALLET',     label:'Wallet',       icon:'👛' },
              ].map((m) => {
                const active = paymentMethod === m.id;
                return (
                  <button key={m.id} type="button"
                    onClick={() => { setPaymentMethod(m.id); setErrs({}); setPaymentError(''); }}
                    role="radio" aria-checked={active}
                    style={{
                      flex:'1 1 120px',
                      padding:'10px 12px', borderRadius:10,
                      border:`2px solid ${active ? PL : PBORDER}`,
                      background: active ? PBG : '#fff',
                      color: active ? P : MID,
                      fontFamily:'Outfit,sans-serif', fontSize:13, fontWeight:800,
                      cursor:'pointer', display:'inline-flex', alignItems:'center', gap:8,
                      justifyContent:'center',
                    }}>
                    <span style={{ fontSize:16 }}>{m.icon}</span> {m.label}
                  </button>
                );
              })}
            </div>

            {/* Per-method form */}
            {paymentMethod === 'UPI' && (
              <div>
                <label style={REG_LBL}>UPI ID <span style={{color:'#EF4444'}}>*</span></label>
                <div style={{ display:'flex', gap:8 }}>
                  <input
                    value={upiId}
                    onChange={e => { setUpiId(e.target.value); setErrs(v => ({ ...v, upiId:null })); }}
                    placeholder="yourname@okicici"
                    style={{ ...REG_INP(errs.upiId), flex:1 }}
                    onFocus={e => e.target.style.borderColor=PL}
                    onBlur={e => e.target.style.borderColor=errs.upiId?'#EF4444':PBORDER}
                  />
                  <button
                    type="button"
                    onClick={verifyUpi}
                    disabled={upiVerifying || !upiId.trim()}
                    style={{
                      padding:'10px 18px', borderRadius:9, border:'none',
                      background: upiVerified
                        ? '#10B981'
                        : upiVerifying
                        ? '#94A3B8'
                        : `linear-gradient(135deg,${PL},${PD})`,
                      color:'#fff', fontSize:12, fontWeight:800,
                      cursor: upiVerifying || !upiId.trim() ? 'not-allowed' : 'pointer',
                      opacity: !upiId.trim() ? 0.6 : 1, whiteSpace:'nowrap',
                      display:'inline-flex', alignItems:'center', gap:6,
                    }}
                  >
                    {upiVerified ? '✓ Verified' : upiVerifying ? 'Verifying…' : 'Verify'}
                  </button>
                </div>
                <ErrMsg msg={errs.upiId} />

                <div style={{ marginTop:10 }}>
                  <div style={{ fontSize:11, fontWeight:800, color:MID, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>
                    Popular Apps
                  </div>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    {UPI_APPS.map((app) => {
                      const active = upiAppHint === app.id;
                      return (
                        <button
                          key={app.id}
                          type="button"
                          onClick={() => pickUpiApp(app)}
                          aria-pressed={active}
                          style={{
                            padding:'8px 12px', borderRadius:9,
                            border:`2px solid ${active ? PL : PBORDER}`,
                            background: active ? PBG : '#fff',
                            color: active ? P : DARK,
                            fontSize:12, fontWeight:700, cursor:'pointer',
                            display:'inline-flex', alignItems:'center', gap:6,
                          }}
                        >
                          <span style={{ fontSize:14 }}>{app.icon}</span> {app.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <p style={{ margin:'8px 0 0', fontSize:11, color:MUTED }}>
                  You&apos;ll receive a payment request on your UPI app — approve to complete.
                </p>
              </div>
            )}

            {paymentMethod === 'CARD' && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={REG_LBL}>Card Number <span style={{color:'#EF4444'}}>*</span></label>
                  <div style={{ position:'relative' }}>
                    <input
                      value={cardNumber}
                      onChange={e => { setCardNumber(formatCardInput(e.target.value)); setErrs(v => ({ ...v, cardNumber:null })); }}
                      placeholder="1234 5678 9012 3456"
                      inputMode="numeric"
                      style={{ ...REG_INP(errs.cardNumber), paddingRight: brandStyle ? 78 : 13 }}
                      onFocus={e => e.target.style.borderColor=PL}
                      onBlur={e => e.target.style.borderColor=errs.cardNumber?'#EF4444':PBORDER}
                    />
                    {brandStyle && (
                      <span
                        aria-label={`${brandStyle.label} card`}
                        style={{
                          position:'absolute', right:10, top:'50%', transform:'translateY(-50%)',
                          padding:'3px 8px', borderRadius:6,
                          background: brandStyle.bg, color: brandStyle.fg,
                          fontFamily:'Outfit,sans-serif', fontSize:10, fontWeight:900,
                          letterSpacing:'.05em', pointerEvents:'none',
                        }}
                      >
                        {brandStyle.label}
                      </span>
                    )}
                  </div>
                  <ErrMsg msg={errs.cardNumber} />
                </div>
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={REG_LBL}>Cardholder Name <span style={{color:'#EF4444'}}>*</span></label>
                  <input
                    value={cardholderName}
                    onChange={e => {
                      const v = e.target.value;
                      if (/^[a-zA-Z\s'-]*$/.test(v) || v === '') {
                        setCardholderName(v);
                        setErrs(p => ({ ...p, cardholderName: null }));
                      }
                    }}
                    placeholder="Name as printed on card"
                    style={REG_INP(errs.cardholderName)}
                    onFocus={e => e.target.style.borderColor=PL}
                    onBlur={e => e.target.style.borderColor=errs.cardholderName?'#EF4444':PBORDER}
                  />
                  <ErrMsg msg={errs.cardholderName} />
                </div>
                <div>
                  <label style={REG_LBL}>Expiry (MM/YY) <span style={{color:'#EF4444'}}>*</span></label>
                  <input
                    value={cardExpiry}
                    onChange={e => { setCardExpiry(formatExpiryInput(e.target.value)); setErrs(v => ({ ...v, cardExpiry:null })); }}
                    placeholder="MM/YY"
                    inputMode="numeric"
                    style={REG_INP(errs.cardExpiry)}
                    onFocus={e => e.target.style.borderColor=PL}
                    onBlur={e => e.target.style.borderColor=errs.cardExpiry?'#EF4444':PBORDER}
                  />
                  <ErrMsg msg={errs.cardExpiry} />
                </div>
                <div>
                  <label style={REG_LBL}>CVV <span style={{color:'#EF4444'}}>*</span></label>
                  <input
                    value={cardCvv}
                    onChange={e => { setCardCvv(e.target.value.replace(/\D+/g,'').slice(0,4)); setErrs(v => ({ ...v, cardCvv:null })); }}
                    placeholder="123"
                    type="password"
                    inputMode="numeric"
                    style={REG_INP(errs.cardCvv)}
                    onFocus={e => e.target.style.borderColor=PL}
                    onBlur={e => e.target.style.borderColor=errs.cardCvv?'#EF4444':PBORDER}
                  />
                  <ErrMsg msg={errs.cardCvv} />
                </div>
              </div>
            )}

            {paymentMethod === 'NETBANKING' && (
              <div>
                <label style={REG_LBL}>Select Bank <span style={{color:'#EF4444'}}>*</span></label>
                <select
                  value={bankName}
                  onChange={e => { setBankName(e.target.value); setErrs(v => ({ ...v, bankName:null })); }}
                  style={REG_SEL(errs.bankName)}
                >
                  {BANKS.map((b) => <option key={b}>{b}</option>)}
                </select>
                <ErrMsg msg={errs.bankName} />
                <button
                  type="button"
                  onClick={nextStep}
                  disabled={busy}
                  style={{
                    marginTop:10, padding:'10px 16px', borderRadius:9, border:'none',
                    background: busy ? '#94A3B8' : `linear-gradient(135deg,${PL},${PD})`,
                    color:'#fff', fontFamily:'Outfit,sans-serif', fontSize:12, fontWeight:800,
                    cursor: busy ? 'wait' : 'pointer',
                    display:'inline-flex', alignItems:'center', gap:8,
                  }}
                >
                  {busy ? 'Redirecting…' : '🏦 Proceed to Bank →'}
                </button>
                <p style={{ margin:'8px 0 0', fontSize:11, color:MUTED }}>
                  You&apos;ll be redirected to your bank&apos;s secure site to complete the payment.
                </p>
              </div>
            )}

            {paymentMethod === 'WALLET' && (
              <div>
                <label style={REG_LBL}>Select Wallet <span style={{color:'#EF4444'}}>*</span></label>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:8 }}>
                  {WALLETS.map((w) => {
                    const active = walletProvider === w.id;
                    return (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => { setWalletProvider(w.id); setErrs(v => ({ ...v, walletProvider:null })); }}
                        aria-pressed={active}
                        style={{
                          padding:'10px 12px', borderRadius:10,
                          border:`2px solid ${active ? PL : PBORDER}`,
                          background: active ? PBG : '#fff',
                          color: active ? P : DARK,
                          fontSize:12, fontWeight:700, cursor:'pointer',
                          display:'inline-flex', alignItems:'center', gap:8,
                          justifyContent:'flex-start',
                        }}
                      >
                        <span style={{ fontSize:16 }}>{w.icon}</span> {w.label}
                      </button>
                    );
                  })}
                </div>
                <ErrMsg msg={errs.walletProvider} />
                <p style={{ margin:'8px 0 0', fontSize:11, color:MUTED }}>
                  We&apos;ll redirect you to the wallet provider to authorise the payment.
                </p>
              </div>
            )}
          </>
        )}

        <div style={{
          padding:'10px 12px', borderRadius:9,
          background:'#EFF6FF', border:'1.5px solid #93C5FD',
          fontSize:11, color:'#1E40AF', fontWeight:600, lineHeight:1.5,
        }}>
          🔒 This is a simulated checkout for demo purposes. No real payment is processed and no card data is stored.
        </div>
      </div>
    );
  };

  const Step5 = () => {
    const txnId          = createdOrgRef?.transactionId || null;
    const nextBillingIso = createdOrgRef?.nextBillingDate || null;
    const nextBillingFmt = nextBillingIso
      ? new Date(nextBillingIso).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })
      : null;
    const planLabelOut = livePlans.find(p => p.id === selectedPlan)?.label
      || PLANS_REG.find(p => p.id === selectedPlan)?.label;
    const methodLabel =
      paymentMethod === 'UPI'        ? 'UPI'
      : paymentMethod === 'CARD'     ? 'Card'
      : paymentMethod === 'NETBANKING' ? 'Net Banking'
      : paymentMethod === 'WALLET'   ? 'Wallet'
      : '—';

    return (
      <div style={{ padding:'36px 28px', textAlign:'center' }}>
        <div style={{ width:80, height:80, borderRadius:'50%', margin:'0 auto 20px',
          background:'linear-gradient(135deg,#10B981,#059669)',
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:36,
          boxShadow:'0 12px 36px rgba(16,185,129,0.38)',
          animation:'lm-pop 0.6s cubic-bezier(.2,1.4,.3,1) both' }}>
          ✅
        </div>
        <h2 style={{ fontFamily:'Outfit,sans-serif', fontSize:22, fontWeight:900, color:DARK, marginBottom:8 }}>
          Payment Successful — Organization Created! 🎉
        </h2>
        <p style={{ fontSize:13, color:MID, lineHeight:1.7, marginBottom:20 }}>
          Welcome to <strong>CorpGMS</strong>! Your organization <strong>{orgName}</strong> has been set up successfully.<br />
          A verification email has been sent to <strong>{adminEmail}</strong>.
        </p>
        <div style={{ background:'#F0FDF4', border:'1.5px solid #A7F3D0', borderRadius:12, padding:'14px 18px', marginBottom:22, textAlign:'left' }}>
          <p style={{ margin:0, fontSize:12, fontWeight:700, color:'#059669', marginBottom:8 }}>📋 Your Account Summary</p>
          {[
            ['Organization', orgName],
            ['Plan Activated', planLabelOut],
            ['Billing Cycle', billingCycle === 'yearly' ? 'Annual' : 'Monthly'],
            ['Payment Method', methodLabel],
            ...(txnId ? [['Transaction ID', txnId]] : []),
            ...(nextBillingFmt ? [['Next Billing Date', nextBillingFmt]] : []),
            ...(appliedCoupon ? [['Coupon Applied', `${appliedCoupon.code} · ${appliedCoupon.message || 'Discount active'}`]] : []),
            ['Admin Email', adminEmail],
            ['Workspace', `corpgms.com/${orgSlug}`],
          ].map(([k, v]) => (
            <div key={k} style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:MID, marginBottom:4, gap:12 }}>
              <span style={{ fontWeight:600, flexShrink:0 }}>{k}:</span>
              <span style={{ fontWeight:700, color:DARK, textAlign:'right', wordBreak:'break-all' }}>{v}</span>
            </div>
          ))}
        </div>
        <button onClick={() => {
            const regUsers = JSON.parse(localStorage.getItem('cgms_registered_users') || '[]');
            const me = regUsers[regUsers.length - 1];
            if (me && onLoginAndEnter) { onLoginAndEnter({ ...me, role: 'director', id: 'director' }); }
            else if (onSuccess) { onSuccess(); } else { onClose(); }
          }} style={{
          width:'100%', padding:'13px', borderRadius:11, border:'none',
          background:`linear-gradient(135deg,${PL},${PD})`, color:'#fff',
          fontFamily:'Outfit,sans-serif', fontWeight:800, fontSize:14, cursor:'pointer',
          boxShadow:`0 6px 20px ${PL}55`,
        }}>
          🚀 Go to Dashboard
        </button>
      </div>
    );
  };

  const Step4 = () => (
    <div style={{ padding:'36px 28px', textAlign:'center' }}>
      <div style={{ width:80, height:80, borderRadius:'50%', margin:'0 auto 20px',
        background:'linear-gradient(135deg,#10B981,#059669)',
        display:'flex', alignItems:'center', justifyContent:'center', fontSize:36,
        boxShadow:'0 12px 36px rgba(16,185,129,0.38)',
        animation:'lm-pop 0.6s cubic-bezier(.2,1.4,.3,1) both' }}>
        ✅
      </div>
      <h2 style={{ fontFamily:'Outfit,sans-serif', fontSize:22, fontWeight:900, color:DARK, marginBottom:8 }}>
        Organization Created! 🎉
      </h2>
      <p style={{ fontSize:13, color:MID, lineHeight:1.7, marginBottom:20 }}>
        Welcome to <strong>CorpGMS</strong>! Your organization <strong>{orgName}</strong> has been set up successfully.<br />
        A verification email has been sent to <strong>{adminEmail}</strong>.
      </p>
      <div style={{ background:'#F0FDF4', border:'1.5px solid #A7F3D0', borderRadius:12, padding:'14px 18px', marginBottom:22, textAlign:'left' }}>
        <p style={{ margin:0, fontSize:12, fontWeight:700, color:'#059669', marginBottom:8 }}>📋 Your Account Summary</p>
        {[
          ['Organization', orgName],
          ['Plan', PLANS_REG.find(p => p.id === selectedPlan)?.label],
          ...(appliedCoupon ? [['Coupon Applied', `${appliedCoupon.code} · ${appliedCoupon.message || 'Discount active'}`]] : []),
          ['Admin Email', adminEmail],
          ['Workspace', `corpgms.com/${orgSlug}`],
        ].map(([k, v]) => (
          <div key={k} style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:MID, marginBottom:4 }}>
            <span style={{ fontWeight:600 }}>{k}:</span>
            <span style={{ fontWeight:700, color:DARK }}>{v}</span>
          </div>
        ))}
      </div>
      <button onClick={() => {
          const regUsers = JSON.parse(localStorage.getItem('cgms_registered_users') || '[]');
          const me = regUsers[regUsers.length - 1];
          if (me && onLoginAndEnter) { onLoginAndEnter({ ...me, role: 'director', id: 'director' }); }
          else if (onSuccess) { onSuccess(); } else { onClose(); }
        }} style={{
        width:'100%', padding:'13px', borderRadius:11, border:'none',
        background:`linear-gradient(135deg,${PL},${PD})`, color:'#fff',
        fontFamily:'Outfit,sans-serif', fontWeight:800, fontSize:14, cursor:'pointer',
        boxShadow:`0 6px 20px ${PL}55`,
      }}>
        🚀 Enter Dashboard
      </button>
    </div>
  );

  return (
    <div aria-modal="true" role="dialog" style={{
      position:'fixed', inset:0, zIndex:10000,
      display:'flex', alignItems:'center', justifyContent:'center', padding:16,
      background:'rgba(5,14,26,0.72)', backdropFilter:'blur(12px)',
    }} onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>

      <div style={{
        position:'relative', width:'100%',
        maxWidth: step === 3 ? 820 : step === 4 ? 640 : 580,
        borderRadius:22, background:'#fff', overflow:'hidden',
        boxShadow:`0 32px 80px rgba(0,0,0,0.3), 0 0 0 1px ${PBORDER}`,
        animation:'lm-in 0.4s cubic-bezier(.22,1.2,.36,1) both',
        fontFamily:"'Plus Jakarta Sans',sans-serif",
        maxHeight:'92vh', display:'flex', flexDirection:'column',
      }}>
        <div style={{ height:4, background:`linear-gradient(90deg,${PL},${PD},#10B981)`, flexShrink:0 }} />

        {step < 5 && (
          <div style={{ padding:'20px 28px 0', borderBottom:`1px solid ${PBORDER}`, flexShrink:0 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ width:44, height:44, borderRadius:13,
                  display:'flex', alignItems:'center', justifyContent:'center', fontSize:20,
                  background:`linear-gradient(135deg,${PL},${PD})`,
                  boxShadow:`0 5px 16px ${PL}55` }}>🏢</div>
                <div>
                  <h2 style={{ fontFamily:'Outfit,sans-serif', fontSize:18, fontWeight:900, color:DARK, margin:0 }}>
                    Create Your Organization
                  </h2>
                  <p style={{ fontSize:12, color:MUTED, margin:'2px 0 0' }}>
                    {step === 1 ? 'Tell us about your company'
                      : step === 2 ? 'Set up your admin account'
                      : step === 3 ? 'Pick a plan and review what’s included'
                      : 'Complete the payment to provision your organisation'}
                  </p>
                </div>
              </div>
              <button onClick={onClose} disabled={busy} style={{ width:34, height:34, borderRadius:9,
                border:`1px solid ${PBORDER}`, background:PBG, cursor:'pointer',
                fontSize:18, color:MUTED, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}
                onMouseEnter={e=>{e.currentTarget.style.background='#FEE2E2';e.currentTarget.style.color='#DC2626';}}
                onMouseLeave={e=>{e.currentTarget.style.background=PBG;e.currentTarget.style.color=MUTED;}}>×</button>
            </div>
            <StepBar />
          </div>
        )}

        <div style={{ overflowY:'auto', flex:1 }}>
          {step === 1 && <RegStep1 orgName={orgName} setOrgName={setOrgName} orgSlug={orgSlug} setOrgSlug={setOrgSlug} industry={industry} setIndustry={setIndustry} orgSize={orgSize} setOrgSize={setOrgSize} country={country} setCountry={setCountry} city={city} setCity={setCity} address={address} setAddress={setAddress} website={website} setWebsite={setWebsite} gstin={gstin} setGstin={setGstin} errs={errs} setErrs={setErrs} couponCode={couponCode} setCouponCode={setCouponCode} couponStatus={couponStatus} couponMessage={couponMessage} appliedCoupon={appliedCoupon} onApplyCoupon={handleApplyCoupon} onRemoveCoupon={handleRemoveCoupon} />}
          {step === 2 && <RegStep2 firstName={firstName} setFirstName={setFirstName} lastName={lastName} setLastName={setLastName} adminEmail={adminEmail} setAdminEmail={setAdminEmail} phone={phone} setPhone={setPhone} jobTitle={jobTitle} setJobTitle={setJobTitle} adminPw={adminPw} setAdminPw={setAdminPw} confirmPw={confirmPw} setConfirmPw={setConfirmPw} showPw1={showPw1} setShowPw1={setShowPw1} showPw2={showPw2} setShowPw2={setShowPw2} agree={agree} setAgree={setAgree} errs={errs} setErrs={setErrs} />}
          {step === 3 && <Step3 />}
          {step === 4 && <Step4Payment />}
          {step === 5 && <Step5 />}
        </div>

        {step < 5 && (
          <div style={{ padding:'14px 28px 20px', borderTop:`1px solid ${PBORDER}`, flexShrink:0,
            display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, background:'#FAFCFF' }}>
            {step > 1 ? (
              <button onClick={() => setStep(s => s-1)} disabled={busy} style={{
                padding:'11px 22px', borderRadius:10, border:`1.5px solid ${PBORDER}`,
                background:'#fff', color:DARK, fontFamily:'Outfit,sans-serif',
                fontWeight:700, fontSize:13, cursor:'pointer',
              }}>
                ← Back
              </button>
            ) : <div />}
            <button onClick={nextStep} disabled={busy} style={{
              padding:'11px 28px', borderRadius:10, border:'none',
              background:`linear-gradient(135deg,${PL},${PD})`, color:'#fff',
              fontFamily:'Outfit,sans-serif', fontWeight:800, fontSize:13,
              cursor: busy ? 'wait' : 'pointer',
              boxShadow:`0 6px 20px ${PL}44`, opacity: busy ? 0.8 : 1,
              display:'flex', alignItems:'center', gap:8,
            }}>
              {busy ? (
                <><span style={{ width:13, height:13, border:'2px solid #fff', borderTopColor:'transparent', borderRadius:'50%', display:'inline-block', animation:'lm-spin .7s linear infinite' }} />
                  {paying ? 'Processing payment…' : 'Creating…'}</>
              ) : step === 3 ? 'Continue to Payment →'
                : step === 4 ? '\u{1F512} Pay Now & Create Organization'
                : 'Continue →'}
            </button>
          </div>
        )}

        <style>{`
          @keyframes lm-in  { from{opacity:0;transform:scale(.93) translateY(16px)} to{opacity:1;transform:scale(1) translateY(0)} }
          @keyframes lm-pop { 0%{transform:scale(0);opacity:0} 60%{transform:scale(1.15);opacity:1} 100%{transform:scale(1);opacity:1} }
          @keyframes lm-spin { to{transform:rotate(360deg)} }
        `}</style>
      </div>
    </div>
  );
}
