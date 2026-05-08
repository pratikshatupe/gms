import React, { useState, useEffect, useRef } from 'react';
import { Eye, EyeOff, ArrowLeft, Mail, KeyRound, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { STORAGE_KEYS } from '../store';
import { safeGet } from '../utils/storage';
import { MOCK_STAFF } from '../data/mockData';
import { sha256Hex } from '../utils/passwordValidation';
import { validateEmail, validatePasswordStrict, sanitizeEmail } from '../utils/validators';
import { addAuditLog } from '../utils/auditLogger';
import { backendLogin, clearAuthTokens, setAuthTokens } from '../api/http';

// ⚠️ INTERNAL ONLY — never expose to UI
const ROLES = [
  { id:'superadmin', label:'Super Admin',   name:'Super Admin',  email:'superadmin@corpgms.com', password:'123456', staffId:null,     organisationId:'all',      officeId:'all' },
  { id:'director',   label:'Director',      name:'Arjun Mehta',  email:'director@corpgms.com',   password:'123456', staffId:'staff-1', organisationId:'org-acme', officeId:'all' },
  { id:'manager',    label:'Manager',       name:'Priya Sharma', email:'manager@corpgms.com',    password:'123456', staffId:'staff-2', organisationId:'org-acme', officeId:'OFC-00001' },
  { id:'reception',  label:'Reception',     name:'Sara Khan',    email:'reception@corpgms.com',  password:'123456', staffId:'staff-3', organisationId:'org-acme', officeId:'OFC-00002' },
  { id:'service',    label:'Service Staff', name:'Rahul Patil',  email:'service@corpgms.com',    password:'123456', staffId:'staff-4', organisationId:'org-acme', officeId:'OFC-00001' },
];

/**
 * One-shot legacy-cache migration. Removes only stale pre-v3 permission keys,
 * and only when at least one of them is actually present. NEVER touches the
 * current `role_permissions_dynamic.v3` matrix or `current_role`, so saved
 * permissions survive every login/logout/refresh.
 */
function bustPermissionCache() {
  const STALE = [
    'role_permissions_dynamic.v1',
    'role_permissions_dynamic.v2',
    'role_permissions.v6',
    'role_permissions.v5',
    'role_permissions.v4',
    'role_permissions.v3',
    'role_permissions.v2',
    'role_permissions',
  ];
  try {
    const hasLegacy = STALE.some((k) => localStorage.getItem(k) != null);
    if (!hasLegacy) return;
    STALE.forEach((k) => localStorage.removeItem(k));
  } catch {}
}

/* ── helpers ── */
function generateOTP() { return String(Math.floor(100000 + Math.random() * 900000)); }

function findAccountByEmail(email) {
  const lower = email.toLowerCase();
  try {
    const reg = JSON.parse(localStorage.getItem('cgms_registered_users') || '[]');
    const u = reg.find(u => (u.email||u.emailId||'').toLowerCase() === lower);
    if (u) return { source:'registered', user:u };
  } catch {}
  const demo = ROLES.find(r => r.email.toLowerCase() === lower);
  if (demo) return { source:'demo', user:demo };
  try {
    const staff = safeGet(STORAGE_KEYS.STAFF, MOCK_STAFF);
    if (Array.isArray(staff)) {
      const s = staff.find(s => s && (s.emailId||'').toLowerCase() === lower && String(s.status||'Active') !== 'Inactive');
      if (s) return { source:'staff', user:s };
    }
  } catch {}
  return null;
}

async function saveNewPassword(email, newPassword, source) {
  const lower = email.toLowerCase();
  if (source === 'registered') {
    try {
      const reg = JSON.parse(localStorage.getItem('cgms_registered_users') || '[]');
      const idx = reg.findIndex(u => (u.email||u.emailId||'').toLowerCase() === lower);
      if (idx !== -1) { reg[idx].password = newPassword; localStorage.setItem('cgms_registered_users', JSON.stringify(reg)); }
    } catch {}
  } else if (source === 'demo') {
    try {
      const overrides = JSON.parse(localStorage.getItem('cgms_demo_pw_overrides') || '{}');
      overrides[lower] = newPassword;
      localStorage.setItem('cgms_demo_pw_overrides', JSON.stringify(overrides));
    } catch {}
  } else if (source === 'staff') {
    try {
      const staff = safeGet(STORAGE_KEYS.STAFF, MOCK_STAFF);
      if (Array.isArray(staff)) {
        const idx = staff.findIndex(s => s && (s.emailId||'').toLowerCase() === lower);
        if (idx !== -1) {
          let hash = null; try { hash = await sha256Hex(newPassword); } catch {}
          staff[idx].passwordHash = hash;
          staff[idx].tempPassword = null;
          staff[idx].mustChangePassword = false;
          localStorage.setItem(STORAGE_KEYS.STAFF, JSON.stringify(staff));
        }
      }
    } catch {}
  }
}

/* ── Orb decoration ── */
function Orb({ size, top, left, delay, color }) {
  return <div style={{ position:'absolute', width:size, height:size, borderRadius:'50%', top, left, background:`radial-gradient(circle at 35% 35%, ${color}55, ${color}11)`, animation:`orbFloat ${3+delay}s ease-in-out ${delay}s infinite alternate`, pointerEvents:'none', filter:'blur(1px)' }} />;
}

/* ── Typewriter ── */
function Typewriter({ texts }) {
  const [idx,setIdx]=useState(0),[displayed,setDisplayed]=useState(''),[deleting,setDeleting]=useState(false),[charIdx,setCharIdx]=useState(0);
  useEffect(()=>{
    const current=texts[idx]; let timeout;
    if(!deleting&&charIdx<current.length) timeout=setTimeout(()=>{setDisplayed(current.slice(0,charIdx+1));setCharIdx(c=>c+1);},60);
    else if(!deleting&&charIdx===current.length) timeout=setTimeout(()=>setDeleting(true),2200);
    else if(deleting&&charIdx>0) timeout=setTimeout(()=>{setDisplayed(current.slice(0,charIdx-1));setCharIdx(c=>c-1);},35);
    else if(deleting&&charIdx===0){setDeleting(false);setIdx(i=>(i+1)%texts.length);}
    return()=>clearTimeout(timeout);
  },[charIdx,deleting,idx,texts]);
  return <span>{displayed}<span style={{borderRight:'2px solid rgba(162,155,254,0.9)',marginLeft:2,animation:'blink 1s step-end infinite'}}>&nbsp;</span></span>;
}

/* ════════════════════════════════════
   FORGOT PASSWORD MODAL
   Steps: 1=email  2=otp  3=newpass  4=done
   ════════════════════════════════════ */
function ForgotPasswordModal({ onClose }) {
  const [step, setStep]               = useState(1);
  const [fpEmail, setFpEmail]         = useState('');
  const [otp, setOtp]                 = useState(['','','','','','']);
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [otpExpiry, setOtpExpiry]     = useState(null);
  const [otpTimer, setOtpTimer]       = useState(0);
  const [newPass, setNewPass]         = useState('');
  const [confPass, setConfPass]       = useState('');
  const [showNew, setShowNew]         = useState(false);
  const [showConf, setShowConf]       = useState(false);
  const [err, setErr]                 = useState('');
  const [loading, setLoading]         = useState(false);
  const [account, setAccount]         = useState(null);
  const otpRefs = useRef([]);

  /* countdown */
  useEffect(()=>{
    if(!otpExpiry) return;
    const tick = setInterval(()=>{
      const left = Math.max(0, Math.round((otpExpiry - Date.now())/1000));
      setOtpTimer(left);
      if(left===0) clearInterval(tick);
    },1000);
    return ()=>clearInterval(tick);
  },[otpExpiry]);

  const fmt = s => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;

  /* Step 1 */
  const handleSendOtp = () => {
    setErr('');
    const emailErr = validateEmail(fpEmail, { label: 'Email ID' });
    if (emailErr) return setErr(emailErr);
    setLoading(true);
    setTimeout(()=>{
      const found = findAccountByEmail(fpEmail.trim());
      setLoading(false);
      if(!found) return setErr('No account found with this Email ID.');
      setAccount(found);
      const code = generateOTP();
      setGeneratedOtp(code);
      setOtpExpiry(Date.now() + 10*60*1000);
      setOtpTimer(600);
      console.info(`[CorpGMS] OTP for ${fpEmail}: ${code}`);
      try { sessionStorage.setItem('cgms_debug_otp', code); } catch {}
      setStep(2);
    }, 900);
  };

  /* Step 2 */
  const handleOtpChange = (val, i) => {
    if(!/^\d*$/.test(val)) return;
    const next=[...otp]; next[i]=val.slice(-1); setOtp(next); setErr('');
    if(val && i<5) otpRefs.current[i+1]?.focus();
  };
  const handleOtpKeyDown = (e, i) => {
    if(e.key==='Backspace' && !otp[i] && i>0) otpRefs.current[i-1]?.focus();
  };
  const handleVerifyOtp = () => {
    setErr('');
    const entered = otp.join('');
    if(entered.length<6) return setErr('Enter the complete 6-digit OTP.');
    if(otpTimer===0) return setErr('OTP expired. Please resend.');
    if(entered !== generatedOtp) return setErr('Incorrect OTP. Please try again.');
    setStep(3);
  };
  const handleResendOtp = () => {
    const code = generateOTP();
    setGeneratedOtp(code); setOtpExpiry(Date.now()+10*60*1000); setOtpTimer(600);
    setOtp(['','','','','','']); setErr('');
    console.info(`[CorpGMS] Resent OTP for ${fpEmail}: ${code}`);
    try { sessionStorage.setItem('cgms_debug_otp', code); } catch {}
  };

  /* Step 3 */
  const strength = (() => {
    if(!newPass) return 0; let s=0;
    if(newPass.length>=6) s++; if(newPass.length>=10) s++;
    if(/[A-Z]/.test(newPass)) s++; if(/[0-9]/.test(newPass)) s++;
    if(/[^A-Za-z0-9]/.test(newPass)) s++; return s;
  })();
  const strengthLabel = ['','Weak','Fair','Good','Strong','Very Strong'][strength];
  const strengthColor = ['','#EF4444','#F97316','#EAB308','#22C55E','#10B981'][strength];

  const handleResetPassword = async () => {
    setErr('');
    /* Phase 2 spec: 8+ with upper/lower/digit/special. The strength
     * meter above is a hint only — this is the hard gate. */
    const pwErr = validatePasswordStrict(newPass, { label: 'New password' });
    if (pwErr) return setErr(pwErr);
    if (newPass !== confPass) return setErr('Passwords do not match.');
    setLoading(true);
    await saveNewPassword(fpEmail.trim(), newPass, account?.source);
    try { addAuditLog({ userName:fpEmail, role:'unknown', action:'PASSWORD_RESET', module:'Auth', description:`Password reset via OTP for ${fpEmail}.`, orgId:'' }); } catch {}
    setLoading(false);
    setStep(4);
  };

  return (
    <div style={{ position:'fixed', inset:0, zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(10,15,44,0.75)', backdropFilter:'blur(7px)', animation:'fadeUp .25s ease' }}>
      <div style={{ width:'100%', maxWidth:430, margin:'0 16px', background:'#fff', borderRadius:24, boxShadow:'0 32px 80px rgba(108,92,231,.25)', overflow:'hidden', animation:'slideInRight .3s ease' }}>

        {/* header gradient */}
        <div style={{ background:'linear-gradient(135deg,#6c5ce7,#5a4bd1,#00cec9)', padding:'26px 28px 22px', position:'relative' }}>
          <button type="button" onClick={onClose} style={{ position:'absolute', top:14, right:14, background:'rgba(255,255,255,.18)', border:'none', borderRadius:8, width:30, height:30, cursor:'pointer', color:'#fff', fontSize:15, display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1 }}>✕</button>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
            <div style={{ width:40, height:40, borderRadius:12, background:'rgba(255,255,255,.2)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <KeyRound size={20} color="#fff" />
            </div>
            <div>
              <div style={{ fontFamily:'Outfit,sans-serif', fontWeight:800, fontSize:17, color:'#fff' }}>Reset Password</div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,.7)' }}>
                {step===1&&'Step 1 of 3 — Verify your email'}
                {step===2&&'Step 2 of 3 — Enter OTP'}
                {step===3&&'Step 3 of 3 — Create new password'}
                {step===4&&'Done!'}
              </div>
            </div>
          </div>
          {step<4 && (
            <div style={{ display:'flex', gap:5 }}>
              {[1,2,3].map(s=>(
                <div key={s} style={{ height:3, borderRadius:4, flex:1, background: step>s?'rgba(255,255,255,.95)': step===s?'rgba(255,255,255,.85)':'rgba(255,255,255,.22)', transition:'all .35s' }} />
              ))}
            </div>
          )}
        </div>

        <div style={{ padding:'26px 28px 24px' }}>

          {/* ── STEP 1: Email ── */}
          {step===1 && (
            <div style={{ animation:'fadeUp .3s ease' }}>
              <p style={{ fontSize:13, color:'#4C4A7A', marginBottom:18, lineHeight:1.65 }}>Enter your registered Email ID. We'll send a 6-digit OTP to verify your identity.</p>
              <label style={{ fontSize:12, fontWeight:700, color:'#5a4bd1', textTransform:'uppercase', letterSpacing:'.08em', display:'block', marginBottom:7 }}>Email ID *</label>
              <div style={{ position:'relative', marginBottom:4 }}>
                <Mail size={15} style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', opacity:.38, pointerEvents:'none' }} />
                <input className="inp-field" type="email" value={fpEmail} onChange={e=>{setFpEmail(e.target.value);setErr('');}} onKeyDown={e=>e.key==='Enter'&&handleSendOtp()} placeholder="Enter your Email ID" autoFocus style={{ paddingLeft:44 }} />
              </div>
              {err&&<p style={{ fontSize:12, color:'#EF4444', fontWeight:500, margin:'6px 0 0' }}>{err}</p>}
              <button className="submit-btn" style={{ marginTop:18 }} onClick={handleSendOtp} disabled={loading}>
                {loading?<><span style={{ width:16,height:16,border:'2px solid rgba(255,255,255,.35)',borderTopColor:'#fff',borderRadius:'50%',display:'inline-block',animation:'spin .7s linear infinite' }}/>Sending OTP…</>:<><Mail size={14}/>Send OTP</>}
              </button>
            </div>
          )}

          {/* ── STEP 2: OTP ── */}
          {step===2 && (
            <div style={{ animation:'fadeUp .3s ease' }}>
              <div style={{ background:'#F0FDF4', border:'1px solid #BBF7D0', borderRadius:10, padding:'10px 14px', fontSize:12, color:'#15803D', marginBottom:18, display:'flex', gap:8, alignItems:'flex-start' }}>
                <ShieldCheck size={14} style={{ flexShrink:0, marginTop:1 }} />
                <span>OTP sent to <strong>{fpEmail}</strong>. Check inbox (and spam).</span>
              </div>
              <label style={{ fontSize:12, fontWeight:700, color:'#5a4bd1', textTransform:'uppercase', letterSpacing:'.08em', display:'block', marginBottom:12 }}>6-Digit OTP *</label>
              <div style={{ display:'flex', gap:8, marginBottom:8 }}>
                {otp.map((digit,i)=>(
                  <input key={i} ref={el=>otpRefs.current[i]=el} value={digit}
                    onChange={e=>handleOtpChange(e.target.value,i)}
                    onKeyDown={e=>handleOtpKeyDown(e,i)}
                    maxLength={1} inputMode="numeric"
                    style={{ width:'100%', height:52, borderRadius:10, border:`2px solid ${err?'#EF4444':digit?'#6c5ce7':'#e9e4ff'}`, background:digit?'#f4f0ff':'#f4f7fc', fontSize:22, fontWeight:800, textAlign:'center', fontFamily:'Outfit,sans-serif', color:'#0f172a', outline:'none', transition:'border-color .18s', caretColor:'transparent' }}
                  />
                ))}
              </div>
              {err&&<p style={{ fontSize:12, color:'#EF4444', fontWeight:500, marginBottom:6 }}>{err}</p>}
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#9B99C4', marginBottom:18 }}>
                <span>{otpTimer>0?<>Expires in <strong style={{ color:otpTimer<60?'#EF4444':'#5a4bd1' }}>{fmt(otpTimer)}</strong></>:<span style={{ color:'#EF4444' }}>OTP expired</span>}</span>
                <button type="button" onClick={handleResendOtp} style={{ background:'none', border:'none', color:'#6c5ce7', fontWeight:700, fontSize:12, cursor:'pointer', padding:0, fontFamily:'inherit' }}>Resend OTP</button>
              </div>
              <button className="submit-btn" onClick={handleVerifyOtp}><ShieldCheck size={14}/> Verify OTP</button>
              <button type="button" onClick={()=>{setStep(1);setErr('');setOtp(['','','','','','']);}} style={{ width:'100%', marginTop:10, padding:'11px', borderRadius:12, border:'1.5px solid #e9e4ff', background:'transparent', color:'#5a4bd1', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                <ArrowLeft size={13}/> Back
              </button>
            </div>
          )}

          {/* ── STEP 3: New Password ── */}
          {step===3 && (
            <div style={{ animation:'fadeUp .3s ease' }}>
              <p style={{ fontSize:13, color:'#4C4A7A', marginBottom:16, lineHeight:1.65 }}>OTP verified ✅ — create a strong new password for <strong>{fpEmail}</strong>.</p>

              <label style={{ fontSize:12, fontWeight:700, color:'#5a4bd1', textTransform:'uppercase', letterSpacing:'.08em', display:'block', marginBottom:7 }}>New Password *</label>
              <div style={{ position:'relative', marginBottom:4 }}>
                <KeyRound size={14} style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', opacity:.38, pointerEvents:'none' }} />
                <input className="inp-field" type={showNew?'text':'password'} value={newPass} onChange={e=>{setNewPass(e.target.value);setErr('');}} placeholder="Min 8 chars · upper · lower · number · symbol" style={{ paddingLeft:44, paddingRight:44 }} autoFocus />
                <button className="eye-btn" type="button" onClick={()=>setShowNew(p=>!p)}>{showNew?<EyeOff size={15}/>:<Eye size={15}/>}</button>
              </div>
              {newPass && (
                <div style={{ marginBottom:12 }}>
                  <div style={{ display:'flex', gap:3, marginBottom:3 }}>
                    {[1,2,3,4,5].map(i=>(<div key={i} style={{ flex:1, height:3, borderRadius:4, background:i<=strength?strengthColor:'#e9e4ff', transition:'all .25s' }} />))}
                  </div>
                  <div style={{ fontSize:11, color:strengthColor, fontWeight:700 }}>{strengthLabel}</div>
                </div>
              )}

              <label style={{ fontSize:12, fontWeight:700, color:'#5a4bd1', textTransform:'uppercase', letterSpacing:'.08em', display:'block', marginBottom:7 }}>Confirm Password *</label>
              <div style={{ position:'relative', marginBottom:4 }}>
                <KeyRound size={14} style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', opacity:.38, pointerEvents:'none' }} />
                <input className="inp-field" type={showConf?'text':'password'} value={confPass} onChange={e=>{setConfPass(e.target.value);setErr('');}} placeholder="Re-enter new password" style={{ paddingLeft:44, paddingRight:44 }} onKeyDown={e=>e.key==='Enter'&&handleResetPassword()} />
                <button className="eye-btn" type="button" onClick={()=>setShowConf(p=>!p)}>{showConf?<EyeOff size={15}/>:<Eye size={15}/>}</button>
              </div>
              {confPass && newPass && (
                <div style={{ fontSize:12, fontWeight:600, marginBottom:4, color:newPass===confPass?'#22C55E':'#EF4444' }}>
                  {newPass===confPass?'✓ Passwords match':'✗ Passwords do not match'}
                </div>
              )}
              {err&&<p style={{ fontSize:12, color:'#EF4444', fontWeight:500, marginBottom:4 }}>{err}</p>}
              <button className="submit-btn" style={{ marginTop:14 }} onClick={handleResetPassword} disabled={loading}>
                {loading?<><span style={{ width:16,height:16,border:'2px solid rgba(255,255,255,.35)',borderTopColor:'#fff',borderRadius:'50%',display:'inline-block',animation:'spin .7s linear infinite' }}/>Saving…</>:<>🔐 Reset Password</>}
              </button>
            </div>
          )}

          {/* ── STEP 4: Done ── */}
          {step===4 && (
            <div style={{ animation:'fadeUp .3s ease', textAlign:'center', padding:'8px 0' }}>
              <div style={{ width:70, height:70, borderRadius:'50%', background:'#F0FDF4', border:'3px solid #22C55E', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 18px' }}>
                <CheckCircle2 size={36} color="#22C55E" />
              </div>
              <h3 style={{ fontFamily:'Outfit,sans-serif', fontWeight:900, fontSize:21, color:'#0f172a', marginBottom:8 }}>Password Reset!</h3>
              <p style={{ fontSize:13, color:'#4C4A7A', lineHeight:1.7, marginBottom:22 }}>Your password has been updated successfully.<br/>Log in now with your new credentials.</p>
              <button className="submit-btn" onClick={onClose}>← Back to Login</button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════
   MAIN LOGIN
   ════════════════════════════════════ */
export default function Login({ onBackToLanding, onLogin }) {
  const [email,setEmail]         = useState('');
  const [password,setPassword]   = useState('');
  const [showPass,setShowPass]   = useState(false);
  const [rememberMe,setRememberMe] = useState(false);
  const [errors,setErrors]       = useState({});
  const [loading,setLoading]     = useState(false);
  const [attempts,setAttempts]   = useState(0);
  const [locked,setLocked]       = useState(false);
  const [lockTimer,setLockTimer] = useState(0);
  const [showForgot,setShowForgot] = useState(false);
  const emailRef = useRef(null);

  useEffect(()=>{ bustPermissionCache(); },[]);

  useEffect(()=>{
    try {
      const prefill = JSON.parse(sessionStorage.getItem('cgms_reg_prefill') || 'null');
      if(prefill?.email && prefill?.password){ setEmail(prefill.email); setPassword(prefill.password); sessionStorage.removeItem('cgms_reg_prefill'); return; }
    } catch {}
    try {
      const s = JSON.parse(localStorage.getItem(STORAGE_KEYS.REMEMBER) || 'null');
      if(s?.email){ setEmail(s.email); setRememberMe(true); }
    } catch {}
  },[]);

  useEffect(()=>{
    if(!locked||lockTimer<=0) return;
    const t = setTimeout(()=>setLockTimer(prev=>{ if(prev<=1){setLocked(false);setAttempts(0);return 0;} return prev-1; }),1000);
    return()=>clearTimeout(t);
  },[locked,lockTimer]);

  const validate = () => {
    const e = {};
    /* Email uses the shared validator so format rules stay consistent
     * across Login / ForgotPassword / Registration. */
    const emailErr = validateEmail(email, { label: 'Email ID' });
    if (emailErr) e.email = emailErr;
    /* Login keeps the lenient min-6 rule for back-compat with demo
     * accounts. The strict 8+ rule is enforced on password CREATION
     * paths (ForgotPassword reset, ChangePassword, Registration). */
    if (!password.trim()) e.password = 'Password is required.';
    else if (password.length < 6) e.password = 'Password must be at least 6 characters.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault(); if(locked) return; if(!validate()) return;
    setLoading(true);
    /* Clear any stale tokens so a failed-then-retry attempt cannot reuse a
     * previous user's session. Real tokens are written below if backend
     * authentication succeeds. */
    clearAuthTokens();
    /* Await the backend login and explicitly persist tokens so that the
     * Coupons / Referrals / Subscription admin calls have an Authorization
     * header on the very first navigation after login. The demo
     * localStorage flow below still runs if the backend is unreachable.
     *
     * Fallback: when the backend is offline OR the provided credentials
     * don't exist in the real DB, install a static demo token for the
     * Super Admin account so admin-only screens (Coupons, Plans,
     * Referrals) remain usable in dev. The backend's authenticate
     * middleware recognises this token and grants superadmin scope. */
    try {
      const data = await backendLogin({ email, password });
      if (data?.tokens && data?.user) {
        /* Real backend session — persist tokens AND honour the user the API
           returned. Previously the user object was discarded and the flow
           fell through to localStorage matching, so a real DB user with no
           localStorage twin saw the frontend's "Invalid credentials" message
           even though the API succeeded. We also map the backend's
           `organizationId` / `officeId` (which may arrive populated) onto
           the legacy `organisationId` / `orgId` fields the rest of the app
           still reads from, so the Subscription page resolves the tenant. */
        setAuthTokens(data.tokens);
        const u = data.user;
        const orgRaw = u.organizationId ?? u.organisationId ?? null;
        const orgId  = orgRaw && typeof orgRaw === 'object' ? (orgRaw._id || orgRaw.id || '') : (orgRaw || '');
        const offRaw = u.officeId ?? null;
        const officeId = offRaw && typeof offRaw === 'object' ? (offRaw._id || offRaw.id || '') : (offRaw || '');
        const role = String(u.role || '').toLowerCase().replace(/_/g, '');
        const normalised = {
          ...u,
          id:             role,
          role,
          organisationId: orgId,
          orgId,
          officeId,
        };
        if (rememberMe) localStorage.setItem(STORAGE_KEYS.REMEMBER, JSON.stringify({ email }));
        else localStorage.removeItem(STORAGE_KEYS.REMEMBER);
        setLoading(false);
        onLogin(normalised);
        return;
      }
      if ((email || '').toLowerCase() === 'superadmin@corpgms.com'
       || (email || '').toLowerCase() === 'admin@example.com') {
        try { localStorage.setItem('cgms_access_token', 'super-admin-demo-token'); } catch {}
      }
    } catch {
      if ((email || '').toLowerCase() === 'superadmin@corpgms.com'
       || (email || '').toLowerCase() === 'admin@example.com') {
        try { localStorage.setItem('cgms_access_token', 'super-admin-demo-token'); } catch {}
      }
    }
    setTimeout(()=>{
      setLoading(false);
      try {
        const regUsers = JSON.parse(localStorage.getItem('cgms_registered_users') || '[]');
        const regMatch = regUsers.find(u=>(u.email||u.emailId||'').toLowerCase()===email.toLowerCase()&&u.password===password);
        if(regMatch){ if(rememberMe) localStorage.setItem(STORAGE_KEYS.REMEMBER,JSON.stringify({email})); else localStorage.removeItem(STORAGE_KEYS.REMEMBER); onLogin({...regMatch,role:regMatch.role||'director',id:regMatch.role||'director'}); return; }
      } catch {}
      const demoOverrides = (() => { try { return JSON.parse(localStorage.getItem('cgms_demo_pw_overrides')||'{}'); } catch { return {}; } })();
      const demoMatch = ROLES.find(r=>{ const pw=demoOverrides[r.email.toLowerCase()]||r.password; return r.email.toLowerCase()===email.toLowerCase()&&pw===password; });
      if(demoMatch){ if(rememberMe) localStorage.setItem(STORAGE_KEYS.REMEMBER,JSON.stringify({email})); else localStorage.removeItem(STORAGE_KEYS.REMEMBER); onLogin({...demoMatch,role:demoMatch.id}); return; }
      const liveStaff=safeGet(STORAGE_KEYS.STAFF,MOCK_STAFF);
      const candidates=Array.isArray(liveStaff)?liveStaff.filter(s=>s&&String(s.status||'Active')!=='Inactive'&&(s.emailId||'').toLowerCase()===email.toLowerCase()):[];
      (async()=>{
        let staffMatch=null,matchKind=null;
        if(candidates.length>0){
          let inputHash=null; try{inputHash=await sha256Hex(password);}catch{}
          for(const s of candidates){if(s.passwordHash&&inputHash&&s.passwordHash===inputHash){staffMatch=s;matchKind='permanent';break;}}
          if(!staffMatch){for(const s of candidates){if(s.tempPassword&&s.tempPassword===password){staffMatch=s;matchKind='temp';break;}}}
        }
        if(staffMatch){
          if(rememberMe) localStorage.setItem(STORAGE_KEYS.REMEMBER,JSON.stringify({email})); else localStorage.removeItem(STORAGE_KEYS.REMEMBER);
          const authRole=String(staffMatch.role||'').toLowerCase().replace(/\s+staff$/,'').replace(/\s+/g,'');
          onLogin({id:staffMatch.id,staffId:staffMatch.id,name:staffMatch.fullName||staffMatch.name,email:staffMatch.emailId,label:staffMatch.role,role:authRole,organisationId:staffMatch.orgId,officeId:staffMatch.officeId,mustChangePassword:matchKind==='temp'||Boolean(staffMatch.mustChangePassword),notificationPrefs:staffMatch.notificationPrefs||null});
          addAuditLog({userName:staffMatch.fullName||staffMatch.name||staffMatch.emailId,role:authRole,action:matchKind==='permanent'?'LOGIN_WITH_PERMANENT_PASSWORD':'LOGIN_WITH_TEMP_PASSWORD',module:'Auth',description:`${staffMatch.emailId} logged in.`,orgId:staffMatch.orgId});
          return;
        }
        const next=attempts+1; setAttempts(next);
        if(next>=5){setLocked(true);setLockTimer(900);setErrors({general:'Account locked. Try again in 15 minutes.'});}
        else{const r=5-next;setErrors({general:`Invalid Email ID or password. ${r} ${r===1?'attempt':'attempts'} remaining.`});}
      })();
    },900);
  };

  const PARTICLES=[{x:8,y:12,d:0},{x:92,y:8,d:.5},{x:15,y:88,d:1},{x:85,y:82,d:1.5},{x:45,y:5,d:.3},{x:55,y:95,d:.8},{x:3,y:50,d:1.2},{x:97,y:45,d:.7},{x:25,y:30,d:1.8},{x:75,y:70,d:.2},{x:60,y:20,d:1.1},{x:40,y:75,d:.6}];

  return (
    <div className="cgms-login-page" style={{ minHeight:'100vh', display:'flex', fontFamily:"'Plus Jakarta Sans',sans-serif", overflow:'hidden', position:'relative', background:'var(--app-bg)', color:'var(--app-text)' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        @keyframes orbFloat{from{transform:translate(0,0) scale(1)}to{transform:translate(12px,-18px) scale(1.08)}}
        @keyframes particlePulse{from{opacity:.2;transform:scale(1)}to{opacity:.9;transform:scale(1.8)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideInRight{from{opacity:0;transform:translateX(32px)}to{opacity:1;transform:translateX(0)}}
        @keyframes blink{0%,100%{border-color:transparent}50%{border-color:rgba(162,155,254,.8)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes gradMove{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
        @keyframes shimmerLine{0%{left:-60%}100%{left:160%}}
        @keyframes pulse-ring{0%{box-shadow:0 0 0 0 rgba(108,92,231,.45)}70%{box-shadow:0 0 0 10px rgba(14,165,233,0)}100%{box-shadow:0 0 0 0 rgba(14,165,233,0)}}
        .inp-field{width:100%;padding:13px 14px 13px 44px;border-radius:12px;font-size:14px;border:1.5px solid #e9e4ff;background:#f4f7fc;color:#0f172a;font-family:inherit;transition:border-color .2s,box-shadow .2s,background .2s;outline:none;}
        .inp-field:focus{border-color:#6c5ce7;box-shadow:0 0 0 3.5px rgba(108,92,231,.14);background:#fff;}
        .inp-field.err{border-color:#EF4444;}
        .submit-btn{width:100%;padding:14px;border-radius:12px;border:none;background:linear-gradient(135deg,#6c5ce7,#5a4bd1,#00cec9);background-size:200% 200%;color:#fff;font-size:15px;font-weight:700;font-family:'Outfit',sans-serif;cursor:pointer;box-shadow:0 6px 22px rgba(108,92,231,.38);transition:transform .2s,box-shadow .2s;display:flex;align-items:center;justify-content:center;gap:10px;animation:gradMove 4s ease infinite;position:relative;overflow:hidden;}
        .submit-btn::after{content:'';position:absolute;top:0;width:60%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.13),transparent);animation:shimmerLine 2.5s ease-in-out infinite;}
        .submit-btn:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 10px 30px rgba(108,92,231,.50);}
        .submit-btn:active:not(:disabled){transform:scale(.98);}
        .submit-btn:disabled{background:#E5E7EB;color:#9CA3AF;box-shadow:none;cursor:not-allowed;animation:none;}
        .submit-btn:disabled::after{display:none;}
        .back-btn{display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:9px;border:1.5px solid #e9e4ff;background:transparent;color:#94a3b8;cursor:pointer;font-size:13px;font-weight:600;font-family:inherit;transition:all .2s;margin-bottom:32px;}
        .back-btn:hover{background:#eef2f9;color:#5a4bd1;border-color:#c4b8ff;}
        .eye-btn{position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;opacity:.5;padding:4px;color:#0f172a;transition:opacity .2s;display:flex;align-items:center;}
        .eye-btn:hover{opacity:.85;}
        .logo-g{animation:pulse-ring 2.5s cubic-bezier(.455,.03,.515,.955) infinite;}
        @media(max-width:900px){.left-panel{display:none!important;}.right-panel{padding:28px 20px!important;}}
      `}</style>

      {showForgot && <ForgotPasswordModal onClose={()=>setShowForgot(false)} />}

      {/* LEFT PANEL */}
      <div className="left-panel" style={{ width:'44%', background:'linear-gradient(135deg,#0a0f2c 0%,#1a1f4e 40%,#2d1b69 70%,#1a0a3e 100%)', display:'flex', flexDirection:'column', justifyContent:'center', padding:'clamp(44px,6vw,84px)', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', inset:0, backgroundImage:'radial-gradient(rgba(108,92,231,.15) 1px, transparent 1px)', backgroundSize:'26px 26px', pointerEvents:'none' }} />
        <Orb size="380px" top="-100px" left="-80px"  delay={0}   color="#6c5ce7" />
        <Orb size="280px" top="55%"    left="60%"    delay={1.2} color="#00cec9" />
        <Orb size="220px" top="20%"    left="70%"    delay={0.6} color="#0369A1" />
        <Orb size="160px" top="80%"    left="-20px"  delay={1.8} color="#5a4bd1" />
        {PARTICLES.map((p,i)=>(<div key={i} style={{ position:'absolute', width:3, height:3, borderRadius:'50%', top:`${p.y}%`, left:`${p.x}%`, background:'rgba(162,155,254,.65)', animation:`particlePulse ${2+p.d}s ease-in-out ${p.d}s infinite alternate`, pointerEvents:'none' }} />))}
        <div style={{ position:'relative', zIndex:2 }}>
          <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:40, animation:'fadeUp .6s ease both' }}>
            <div className="logo-g" style={{ width:50, height:50, borderRadius:16, background:'linear-gradient(135deg,#a29bfe,#6c5ce7,#00cec9)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, fontWeight:900, color:'#fff', fontFamily:'Outfit,sans-serif', boxShadow:'0 6px 24px rgba(108,92,231,.5)' }}>G</div>
            <div>
              <div style={{ fontFamily:'Outfit,sans-serif', fontWeight:900, fontSize:18, color:'#fff', letterSpacing:'-.3px' }}>CorpGMS</div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,.45)', fontWeight:500 }}>Corporate Guest Management</div>
            </div>
          </div>
          <div style={{ animation:'fadeUp .6s .1s ease both', opacity:0, animationFillMode:'forwards' }}>
            <h1 style={{ fontFamily:'Outfit,sans-serif', fontSize:'clamp(30px,3.4vw,46px)', fontWeight:900, color:'#fff', lineHeight:1.1, letterSpacing:'-1.2px', marginBottom:16 }}>
              Manage guests.<br />
              <span style={{ background:'linear-gradient(90deg,#a29bfe,#6c5ce7,#55efc4)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>
                <Typewriter texts={['Effortlessly.','Intelligently.','Securely.','At scale.']} />
              </span>
            </h1>
            <p style={{ fontSize:14, color:'rgba(255,255,255,.55)', lineHeight:1.9, maxWidth:310 }}>One platform for walk-ins, appointments, rooms, services, and full audit trails — across every office.</p>
          </div>
          <div style={{ marginTop:36, display:'flex', flexDirection:'column', gap:14, animation:'fadeUp .6s .2s ease both', opacity:0, animationFillMode:'forwards' }}>
            {[{icon:'⚡',text:'Check-in in under 30 seconds'},{icon:'🔒',text:'Role-based access & full audit trail'},{icon:'🌐',text:'Multi-office dashboard in one view'},{icon:'📊',text:'Live analytics & instant exports'}].map(f=>(
              <div key={f.text} style={{ display:'flex', alignItems:'center', gap:13 }}>
                <div style={{ width:34, height:34, borderRadius:10, background:'rgba(108,92,231,.22)', border:'1px solid rgba(108,92,231,.35)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, flexShrink:0 }}>{f.icon}</div>
                <span style={{ fontSize:13, color:'rgba(255,255,255,.65)', fontWeight:500 }}>{f.text}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop:40, padding:'18px 20px', borderRadius:16, background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.08)', backdropFilter:'blur(12px)', animation:'fadeUp .6s .3s ease both', opacity:0, animationFillMode:'forwards' }}>
            <div style={{ display:'flex', gap:2, marginBottom:10 }}>{[0,1,2,3,4].map(i=><span key={i} style={{ color:'#FBBF24', fontSize:12 }}>★</span>)}</div>
            <p style={{ fontSize:13, color:'rgba(255,255,255,.78)', lineHeight:1.65, fontStyle:'italic' }}>"CorpGMS reduced our visitor check-in time by <strong style={{ color:'#fff' }}>70%</strong>. The multi-office dashboard is a game changer."</p>
            <div style={{ fontSize:11, color:'rgba(255,255,255,.4)', marginTop:10, fontWeight:500 }}>— Anika Reddy, Operations Lead · Infosys</div>
          </div>
          <div style={{ marginTop:36, paddingTop:24, borderTop:'1px solid rgba(255,255,255,.09)', display:'flex', gap:32, animation:'fadeUp .6s .4s ease both', opacity:0, animationFillMode:'forwards' }}>
            {[['500+','Companies'],['2M+','Visitors'],['99.9%','Uptime']].map(([v,l])=>(
              <div key={l}><div style={{ fontFamily:'Outfit,sans-serif', fontWeight:900, fontSize:22, color:'#fff' }}>{v}</div><div style={{ fontSize:11, color:'rgba(255,255,255,.38)', fontWeight:500, marginTop:3 }}>{l}</div></div>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="right-panel" style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center', padding:'clamp(32px,5vw,72px)', overflowY:'auto', background:'#FFFFFF', animation:'slideInRight .55s .1s ease both', opacity:0, animationFillMode:'forwards' }}>
        <div style={{ maxWidth:440, width:'100%', margin:'0 auto' }}>
          <button className="back-btn" onClick={onBackToLanding}>← Back to Home</button>
          <div style={{ marginBottom:30 }}>
            <p style={{ fontSize:11, color:'#9B99C4', fontWeight:700, textTransform:'uppercase', letterSpacing:'.12em', marginBottom:7 }}>CorpGMS · Secure Access</p>
            <h2 style={{ fontFamily:'Outfit,sans-serif', fontSize:'clamp(26px,2.8vw,34px)', fontWeight:900, color:'#0f172a', letterSpacing:'-.8px', marginBottom:8 }}>Log In to Your Account</h2>
            <p style={{ fontSize:14, color:'#4C4A7A', lineHeight:1.6 }}>Enter your credentials to access your workspace.</p>
          </div>

          {errors.general && (
            <div style={{ padding:'11px 15px', borderRadius:11, background:'#FEF2F2', border:'1px solid #FECACA', fontSize:13, color:'#DC2626', marginBottom:18, fontWeight:500, display:'flex', alignItems:'flex-start', gap:8 }}>
              <span style={{ flexShrink:0 }}>⚠️</span>
              <div>{errors.general}{locked&&<div style={{ fontSize:11, marginTop:4, color:'#9B1C1C' }}>Retry in: {lockTimer}s</div>}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div style={{ marginBottom:18 }}>
              <label style={{ fontSize:12, fontWeight:700, color:'#5a4bd1', textTransform:'uppercase', letterSpacing:'.08em', display:'block', marginBottom:7 }}>Email ID *</label>
              <div style={{ position:'relative' }}>
                <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', fontSize:15, opacity:.38, pointerEvents:'none' }}>✉</span>
                <input ref={emailRef} className={`inp-field${errors.email?' err':''}`} type="email" value={email} onChange={e=>{setEmail(sanitizeEmail(e.target.value));setErrors(p=>({...p,email:undefined,general:undefined}));}} placeholder="Enter your Email ID" maxLength={120} autoComplete="email" />
              </div>
              {errors.email&&<span style={{ fontSize:12, color:'#EF4444', display:'block', marginTop:5, fontWeight:500 }}>{errors.email}</span>}
            </div>

            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:12, fontWeight:700, color:'#5a4bd1', textTransform:'uppercase', letterSpacing:'.08em', display:'block', marginBottom:7 }}>Password *</label>
              <div style={{ position:'relative' }}>
                <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', fontSize:15, opacity:.38, pointerEvents:'none' }}>🔒</span>
                <input className={`inp-field${errors.password?' err':''}`} style={{ paddingRight:46 }} type={showPass?'text':'password'} value={password} onChange={e=>{setPassword(e.target.value);setErrors(p=>({...p,password:undefined,general:undefined}));}} placeholder="Enter your Password" maxLength={64} autoComplete="current-password" />
                <button className="eye-btn" type="button" onClick={()=>setShowPass(p=>!p)}>{showPass?<EyeOff size={16}/>:<Eye size={16}/>}</button>
              </div>
              {errors.password&&<span style={{ fontSize:12, color:'#EF4444', display:'block', marginTop:5, fontWeight:500 }}>{errors.password}</span>}
            </div>

            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:26 }}>
              <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:13, color:'#4C4A7A', fontWeight:500 }}>
                <input type="checkbox" checked={rememberMe} onChange={e=>setRememberMe(e.target.checked)} style={{ width:15, height:15, accentColor:'#6c5ce7', cursor:'pointer' }} />
                Remember Me
              </label>
              {/* ✅ Working Forgot Password */}
              <button
                type="button"
                onClick={()=>setShowForgot(true)}
                style={{ fontSize:13, color:'#6c5ce7', fontWeight:600, background:'none', border:'none', cursor:'pointer', padding:0, fontFamily:'inherit' }}
                onMouseEnter={e=>e.currentTarget.style.textDecoration='underline'}
                onMouseLeave={e=>e.currentTarget.style.textDecoration='none'}
              >
                Forgot Password?
              </button>
            </div>

            <button type="submit" className="submit-btn" disabled={loading||locked}>
              {loading?(<><span style={{ width:17,height:17,border:'2px solid rgba(255,255,255,.35)',borderTopColor:'#fff',borderRadius:'50%',display:'inline-block',animation:'spin .7s linear infinite' }}/>Logging in…</>):locked?(`⏳ Locked — wait ${lockTimer}s`):(<>🔐 Log In</>)}
            </button>
          </form>

          <p style={{ textAlign:'center', fontSize:12, color:'#c4b8ff', marginTop:32 }}>© 2025 CorpGMS by BIZZFLY · All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}