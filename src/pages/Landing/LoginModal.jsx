import React, { useState, useEffect } from 'react';
import {
  P, PL, PD, PBG, PBORDER, DARK, MID, MUTED,
  DEMO_ROLES, LM_EMAIL_RE,
} from './landingConstants';

function ForgotPasswordPanel({ onBack }) {
  const [fpEmail,   setFpEmail]   = useState('');
  const [fpErr,     setFpErr]     = useState('');
  const [fpSent,    setFpSent]    = useState(false);
  const [fpBusy,    setFpBusy]    = useState(false);

  const submit = async () => {
    if (!fpEmail.trim())              { setFpErr('Email is required.'); return; }
    if (!LM_EMAIL_RE.test(fpEmail))   { setFpErr('Enter a valid email address.'); return; }
    setFpErr(''); setFpBusy(true);
    await new Promise(r => setTimeout(r, 800));
    setFpBusy(false); setFpSent(true);
  };

  const inp = (err) => ({
    width:'100%', padding:'11px 14px', borderRadius:10, fontSize:13,
    fontFamily:"'Plus Jakarta Sans',sans-serif", color: DARK, outline:'none',
    border:`1.5px solid ${err ? '#EF4444' : PBORDER}`,
    background:'#fff', transition:'border-color .2s',
  });

  return (
    <div style={{ padding:'32px 28px', display:'flex', flexDirection:'column', gap:0 }}>
      <button onClick={onBack} style={{ alignSelf:'flex-start', border:'none', background:'transparent',
        color:P, fontSize:13, fontWeight:700, cursor:'pointer', padding:0, marginBottom:20,
        display:'flex', alignItems:'center', gap:6 }}>
        ← Back to Login
      </button>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:24 }}>
        <div style={{ width:44, height:44, borderRadius:13, display:'flex', alignItems:'center',
          justifyContent:'center', fontSize:20, background:`linear-gradient(135deg,${PL},${PD})`,
          boxShadow:`0 5px 16px ${PL}55` }}>🔑</div>
        <div>
          <h2 style={{ fontFamily:'Outfit,sans-serif', fontSize:18, fontWeight:900, color:DARK, margin:0 }}>
            Forgot Password
          </h2>
          <p style={{ fontSize:12, color:MUTED, margin:'2px 0 0' }}>We'll send reset instructions to your email</p>
        </div>
      </div>

      {fpSent ? (
        <div style={{ textAlign:'center', padding:'16px 0' }}>
          <div style={{ width:64, height:64, borderRadius:'50%', margin:'0 auto 16px',
            background:`linear-gradient(135deg,#10B981,#059669)`,
            display:'flex', alignItems:'center', justifyContent:'center',
            boxShadow:'0 8px 24px rgba(16,185,129,0.35)' }}>
            <svg width="28" height="28" viewBox="0 0 52 52">
              <path d="M14 27 l8 8 l16-18" fill="none" stroke="#fff" strokeWidth="5"
                strokeLinecap="round" strokeLinejoin="round"
                style={{ strokeDasharray:60, strokeDashoffset:0 }} />
            </svg>
          </div>
          <h3 style={{ fontFamily:'Outfit,sans-serif', fontSize:16, fontWeight:800, color:DARK, marginBottom:8 }}>
            Reset Link Sent!
          </h3>
          <p style={{ fontSize:13, color:MID, lineHeight:1.6, marginBottom:20 }}>
            If <strong>{fpEmail}</strong> is registered, you'll receive a reset link shortly.
          </p>
          <button onClick={onBack} style={{ padding:'11px 28px', borderRadius:11, border:'none',
            background:`linear-gradient(135deg,${PL},${PD})`, color:'#fff',
            fontFamily:'Outfit,sans-serif', fontWeight:800, fontSize:13, cursor:'pointer',
            boxShadow:`0 6px 20px ${PL}55` }}>
            Back to Login
          </button>
        </div>
      ) : (
        <>
          <div style={{ marginBottom:20 }}>
            <label style={{ display:'block', fontSize:11, fontWeight:800, letterSpacing:'0.06em',
              textTransform:'uppercase', color:'#64748B', marginBottom:6 }}>
              Email ID <span style={{ color:'#EF4444' }}>*</span>
            </label>
            <input
              value={fpEmail} onChange={e => { setFpEmail(e.target.value); if(fpErr) setFpErr(''); }}
              placeholder="Enter Email ID" type="email" style={inp(fpErr)}
              onFocus={e => e.target.style.borderColor = PL}
              onBlur={e  => e.target.style.borderColor = fpErr ? '#EF4444' : PBORDER}
            />
            {fpErr && <p style={{ marginTop:5, fontSize:11, fontWeight:600, color:'#EF4444' }}>{fpErr}</p>}
          </div>
          <button onClick={submit} disabled={fpBusy} style={{
            width:'100%', padding:'13px', borderRadius:11, border:'none',
            background:`linear-gradient(135deg,${PL},${PD})`, color:'#fff',
            fontFamily:'Outfit,sans-serif', fontWeight:800, fontSize:14,
            cursor: fpBusy ? 'wait' : 'pointer',
            boxShadow:`0 6px 20px ${PL}55`, opacity: fpBusy ? 0.8 : 1,
            display:'flex', alignItems:'center', justifyContent:'center', gap:8,
          }}>
            {fpBusy ? (
              <><span style={{ width:14, height:14, border:'2px solid #fff',
                borderTopColor:'transparent', borderRadius:'50%',
                display:'inline-block', animation:'lm-spin .7s linear infinite' }} /> Sending…</>
            ) : 'Send Reset Link'}
          </button>
        </>
      )}
    </div>
  );
}

export default function LoginModal({ onClose, onLoginSuccess }) {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [errors,   setErrors]   = useState({});
  const [loading,  setLoading]  = useState(false);
  const [matchedRole, setMatchedRole] = useState(null);
  const [showForgot, setShowForgot]   = useState(false);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const esc = (e) => { if (e.key === 'Escape' && !loading) onClose(); };
    document.addEventListener('keydown', esc);
    return () => { document.body.style.overflow = prev; document.removeEventListener('keydown', esc); };
  }, [onClose, loading]);

  const validate = () => {
    const e = {};
    if (!email.trim())               e.email    = 'Email is required.';
    else if (!LM_EMAIL_RE.test(email)) e.email  = 'Enter a valid email address.';
    if (!password.trim())            e.password = 'Password is required.';
    else if (password.length < 6)    e.password = 'Password must be at least 6 characters.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    await new Promise(r => setTimeout(r, 600));
    setLoading(false);
    const match = DEMO_ROLES.find(
      r => r.email.toLowerCase() === email.trim().toLowerCase() && r.password === password
    );
    if (!match) {
      setErrors({ general: 'Invalid email or password. Please try again.' });
      return;
    }
    setMatchedRole(match);
    await new Promise(r => setTimeout(r, 1200));
    onLoginSuccess({ ...match, role: match.id });
  };

  const inp = (err) => ({
    width:'100%', padding:'11px 14px', borderRadius:10, fontSize:13,
    fontFamily:"'Plus Jakarta Sans',sans-serif", color: DARK, outline:'none',
    border:`1.5px solid ${err ? '#EF4444' : PBORDER}`,
    background:'#fff', transition:'border-color .2s',
  });

  return (
    <div aria-modal="true" role="dialog" style={{
      position:'fixed', inset:0, zIndex:10000,
      display:'flex', alignItems:'center', justifyContent:'center', padding:16,
      background:'rgba(5,14,26,0.72)', backdropFilter:'blur(12px)',
    }} onMouseDown={(e) => { if (e.target === e.currentTarget && !loading) onClose(); }}>

      <div style={{
        position:'relative', width:'100%', maxWidth:440,
        borderRadius:22, background:'#fff', overflow:'hidden',
        boxShadow:`0 32px 80px rgba(0,0,0,0.3), 0 0 0 1px ${PBORDER}`,
        animation:'lm-in 0.4s cubic-bezier(.22,1.2,.36,1) both',
        fontFamily:"'Plus Jakarta Sans',sans-serif",
      }}>
        <div style={{ height:4, background:`linear-gradient(90deg,${PL},${PD},#10B981)` }} />

        {showForgot ? (
          <ForgotPasswordPanel onBack={() => setShowForgot(false)} />
        ) : matchedRole ? (
          <div style={{ padding:'40px 28px', textAlign:'center' }}>
            <div style={{ width:72, height:72, borderRadius:'50%', margin:'0 auto 18px',
              background:`linear-gradient(135deg,${PL},${PD})`,
              display:'flex', alignItems:'center', justifyContent:'center', fontSize:28,
              boxShadow:`0 12px 32px ${PL}55`, animation:'lm-pop 0.5s cubic-bezier(.2,1.4,.3,1) both' }}>
              {matchedRole.icon}
            </div>
            <h2 style={{ fontFamily:'Outfit,sans-serif', fontSize:20, fontWeight:900, color:DARK, marginBottom:6 }}>
              Welcome back!
            </h2>
            <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'8px 18px',
              borderRadius:50, border:`1.5px solid ${matchedRole.border}`,
              background:matchedRole.bg, marginBottom:12 }}>
              <span style={{ fontSize:14 }}>{matchedRole.icon}</span>
              <span style={{ fontSize:13, fontWeight:800, color:matchedRole.color }}>{matchedRole.label}</span>
              <span style={{ fontSize:11, fontWeight:600, color:MID }}>— {matchedRole.desc}</span>
            </div>
            <p style={{ fontSize:13, color:MID, lineHeight:1.6 }}>
              Signing you in as <strong>{matchedRole.name}</strong>…
            </p>
            <div style={{ marginTop:20, display:'flex', justifyContent:'center' }}>
              <span style={{ width:20, height:20, border:`2.5px solid ${PL}`,
                borderTopColor:'transparent', borderRadius:'50%',
                display:'inline-block', animation:'lm-spin .7s linear infinite' }} />
            </div>
          </div>
        ) : (
          <>
            <div style={{ padding:'24px 28px 20px', borderBottom:`1px solid ${PBORDER}` }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{ width:44, height:44, borderRadius:13,
                    display:'flex', alignItems:'center', justifyContent:'center', fontSize:20,
                    background:`linear-gradient(135deg,${PL},${PD})`,
                    boxShadow:`0 5px 16px ${PL}55` }}>🔐</div>
                  <div>
                    <h2 style={{ fontFamily:'Outfit,sans-serif', fontSize:18, fontWeight:900, color:DARK, margin:0 }}>
                      Sign In to CorpGMS
                    </h2>
                    <p style={{ fontSize:12, color:MUTED, margin:'2px 0 0' }}>Enter your credentials to continue</p>
                  </div>
                </div>
                <button onClick={onClose} style={{ width:34, height:34, borderRadius:9,
                  border:`1px solid ${PBORDER}`, background:PBG, cursor:'pointer',
                  fontSize:18, color:MUTED, display:'flex', alignItems:'center', justifyContent:'center' }}
                  onMouseEnter={e=>{e.currentTarget.style.background='#FEE2E2';e.currentTarget.style.color='#DC2626';}}
                  onMouseLeave={e=>{e.currentTarget.style.background=PBG;e.currentTarget.style.color=MUTED;}}>×</button>
              </div>
            </div>

            <div style={{ padding:'24px 28px' }}>
              {errors.general && (
                <div style={{ marginBottom:16, padding:'11px 14px', borderRadius:10,
                  background:'#FEF2F2', border:'1.5px solid #FECACA',
                  fontSize:13, fontWeight:600, color:'#DC2626' }}>
                  ⚠️ {errors.general}
                </div>
              )}

              <div style={{ marginBottom:16 }}>
                <label style={{ display:'block', fontSize:11, fontWeight:800, letterSpacing:'0.06em',
                  textTransform:'uppercase', color:'#64748B', marginBottom:6 }}>
                  Email ID <span style={{ color:'#EF4444' }}>*</span>
                </label>
                <input value={email} onChange={e => { setEmail(e.target.value); if(errors.email||errors.general) setErrors({}); }}
                  placeholder="Enter Email ID" type="email" style={inp(errors.email)}
                  onFocus={e => e.target.style.borderColor = PL}
                  onBlur={e  => e.target.style.borderColor = errors.email ? '#EF4444' : PBORDER}
                  onKeyDown={e => { if(e.key==='Enter') handleLogin(); }}
                />
                {errors.email && <p style={{ marginTop:5, fontSize:11, fontWeight:600, color:'#EF4444' }}>{errors.email}</p>}
              </div>

              <div style={{ marginBottom:8 }}>
                <label style={{ display:'block', fontSize:11, fontWeight:800, letterSpacing:'0.06em',
                  textTransform:'uppercase', color:'#64748B', marginBottom:6 }}>
                  Password <span style={{ color:'#EF4444' }}>*</span>
                </label>
                <div style={{ position:'relative' }}>
                  <input value={password} onChange={e => { setPassword(e.target.value); if(errors.password||errors.general) setErrors({}); }}
                    placeholder="Your password" type={showPw ? 'text' : 'password'} style={{ ...inp(errors.password), paddingRight:42 }}
                    onFocus={e => e.target.style.borderColor = PL}
                    onBlur={e  => e.target.style.borderColor = errors.password ? '#EF4444' : PBORDER}
                    onKeyDown={e => { if(e.key==='Enter') handleLogin(); }}
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)',
                      border:'none', background:'transparent', cursor:'pointer', color:MUTED, fontSize:16, padding:2 }}>
                    {showPw ? '🙈' : '👁️'}
                  </button>
                </div>
                {errors.password && <p style={{ marginTop:5, fontSize:11, fontWeight:600, color:'#EF4444' }}>{errors.password}</p>}
              </div>

              <div style={{ textAlign:'right', marginBottom:22 }}>
                <button type="button" onClick={() => setShowForgot(true)}
                  style={{ border:'none', background:'transparent', color:P,
                    fontSize:12, fontWeight:700, cursor:'pointer', padding:0 }}
                  onMouseEnter={e => e.target.style.textDecoration='underline'}
                  onMouseLeave={e => e.target.style.textDecoration='none'}>
                  Forgot Password?
                </button>
              </div>

              <button onClick={handleLogin} disabled={loading} style={{
                width:'100%', padding:'13px', borderRadius:11, border:'none',
                background:`linear-gradient(135deg,${PL},${PD})`, color:'#fff',
                fontFamily:'Outfit,sans-serif', fontWeight:800, fontSize:14,
                cursor: loading ? 'wait' : 'pointer',
                boxShadow:`0 6px 20px ${PL}55`, opacity: loading ? 0.8 : 1,
                display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                transition:'transform .2s, box-shadow .2s',
              }}
              onMouseEnter={e => { if(!loading) { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow=`0 12px 30px ${PL}77`; }}}
              onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow=`0 6px 20px ${PL}55`; }}>
                {loading ? (
                  <><span style={{ width:14, height:14, border:'2px solid #fff',
                    borderTopColor:'transparent', borderRadius:'50%',
                    display:'inline-block', animation:'lm-spin .7s linear infinite' }} /> Signing in…</>
                ) : '🔐 Sign In'}
              </button>
            </div>
          </>
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
