import React from 'react';
import ThemeToggle from '../../components/ThemeToggle';
import { P, PL, PD, PBG, PBORDER, DARK, MID, MUTED } from './landingConstants';
import { Counter } from './landingUtils';

const STATS = [
  { val:'500',     suffix:'+', label:'Companies Trust Us' },
  { val:'2000000', suffix:'+', label:'Visitors Managed' },
  { val:'99.9',    suffix:'%', label:'Uptime SLA' },
  { val:'4.9',     suffix:'★', label:'Customer Rating' },
];

export function LandingNav({ isDark, scrollY, onEnterApp, onSignUp }) {
  const navBg     = isDark
    ? (scrollY > 40 ? 'rgba(3,10,18,0.97)' : 'rgba(3,10,18,0.88)')
    : (scrollY > 40 ? 'rgba(255,255,255,0.97)' : 'rgba(255,255,255,0.88)');
  const navBorder = isDark
    ? (scrollY > 40 ? 'rgba(108,92,231,0.22)' : '1px solid transparent')
    : (scrollY > 40 ? `1px solid ${PBORDER}` : '1px solid transparent');
  const navShadow = isDark
    ? (scrollY > 40 ? '0 2px 24px rgba(0,0,0,0.5)' : 'none')
    : (scrollY > 40 ? '0 2px 24px rgba(108,92,231,0.08)' : 'none');
  const navLinkColor = isDark ? '#7EB8D6' : MID;
  const navLogoTitle = isDark ? '#e9e4ff' : DARK;
  const navLogoSub   = isDark ? 'rgba(162,155,254,0.5)' : MUTED;

  return (
    <nav style={{
      position:'fixed', top:0, left:0, right:0, zIndex:998,
      padding:'0 clamp(14px,4vw,52px)', height:'66px',
      display:'flex', alignItems:'center', justifyContent:'space-between', gap:'8px',
      background: navBg, backdropFilter:'blur(22px)',
      borderBottom: navBorder, transition:'all 0.3s ease', boxShadow: navShadow,
    }}>
      <div style={{ position:'absolute', top:0, left:0, right:0, height:'2.5px',
        background:`linear-gradient(90deg,${P},${PL},#6c5ce7,#06B6D4)` }} />

      <a href="#" style={{ display:'flex', alignItems:'center', gap:'11px', textDecoration:'none', flexShrink:0 }}>
        <div style={{ width:'36px', height:'36px', borderRadius:'11px',
          background:`linear-gradient(135deg,${PL},${PD})`, display:'flex', alignItems:'center',
          justifyContent:'center', fontWeight:900, fontSize:'16px', color:'white',
          boxShadow:`0 3px 14px rgba(108,92,231,.38)`, fontFamily:'Outfit,sans-serif' }}>G</div>
        <div>
          <div style={{ fontFamily:'Outfit,sans-serif', fontWeight:800, fontSize:'15px',
            color: navLogoTitle, letterSpacing:'-0.3px' }}>CorpGMS</div>
          <div style={{ fontSize:'10px', color: navLogoSub, fontWeight:500 }}>Guest Management</div>
        </div>
      </a>

      <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
        <div className="nav-links" style={{ display:'flex', gap:'2px' }}>
          {[['#modules','Modules'],['#how','How It Works'],['#pricing','Pricing']].map(([h,l]) => (
            <a key={h} href={h} className="nav-link" style={{ padding:'7px 13px', fontSize:'13px',
              color: navLinkColor, textDecoration:'none', borderRadius:'8px',
              transition:'all 0.2s', fontWeight:500 }}>{l}</a>
          ))}
        </div>

        <button className="nav-signup-btn" onClick={onSignUp}
          style={{ padding:'8px 15px', borderRadius:'9px',
            border: isDark ? '1px solid rgba(108,92,231,0.3)' : `1px solid ${PBORDER}`,
            background: isDark ? 'rgba(108,92,231,0.1)' : PBG,
            color: isDark ? '#c4b8ff' : P,
            cursor:'pointer', fontSize:'13px', fontWeight:600, fontFamily:'inherit',
            transition:'all 0.2s', marginLeft:'4px' }}>✨ Sign Up</button>

        <button className="nav-cta-btn" onClick={onEnterApp}
          style={{ padding:'9px 22px', borderRadius:'9px', border:'none', cursor:'pointer',
            fontFamily:'Outfit,sans-serif', fontWeight:700, fontSize:'13px',
            background:`linear-gradient(135deg,${PL},${PD})`, color:'#fff',
            boxShadow:`0 3px 14px rgba(108,92,231,.33)`, transition:'all 0.2s', marginLeft:'4px' }}>Log In</button>

        <ThemeToggle style={{ marginLeft:'8px', width:38, height:38, borderRadius:10 }} />
      </div>
    </nav>
  );
}

export default function LandingHero({ isDark, scrollY, onEnterApp, onRegister }) {
  const btnPrimary = {
    padding:'13px 30px', fontSize:'14px', borderRadius:'11px',
    fontFamily:'Outfit,sans-serif', fontWeight:700, border:'none', cursor:'pointer',
    background:`linear-gradient(135deg,${PL},${PD})`, color:'#fff',
    boxShadow:`0 5px 18px rgba(108,92,231,0.35)`, transition:'all 0.2s',
  };
  const btnOutline = {
    padding:'13px 26px', fontSize:'14px', borderRadius:'11px',
    fontFamily:'Outfit,sans-serif', fontWeight:600, cursor:'pointer',
    border:`1.5px solid rgba(108,92,231,0.35)`, background:'transparent',
    color: P, transition:'all 0.2s',
  };

  return (
    <section style={{ minHeight:'100vh', display:'flex', alignItems:'center', position:'relative',
      padding:'clamp(90px,14vh,130px) clamp(16px,5vw,64px) 70px', overflow:'hidden' }}>
      <div style={{ position:'absolute', inset:0, zIndex:0,
        backgroundImage:"url('https://images.unsplash.com/photo-1497366216548-37526070297c?w=1600&q=80')",
        backgroundSize:'cover', backgroundPosition:'center 40%', backgroundRepeat:'no-repeat',
        transform:`translate3d(0,${scrollY*.25}px,0) scale(${1+Math.min(scrollY,400)*.0003})`,
        willChange:'transform' }} />
      <div className="hero-img-overlay" style={{ position:'absolute', inset:0, zIndex:1 }} />
      <div style={{ position:'absolute', inset:0, zIndex:2,
        backgroundImage:`radial-gradient(${PL}18 1px,transparent 1px)`,
        backgroundSize:'30px 30px', pointerEvents:'none' }} />
      <div className="orb" style={{ width:'600px', height:'600px', top:'-100px', right:'-60px', zIndex:2,
        transform:`translate3d(0,${scrollY*-.1}px,0)` }} />
      <div className="orb" style={{ width:'400px', height:'400px', bottom:'60px', left:'-80px', zIndex:2,
        transform:`translate3d(0,${scrollY*-.15}px,0)` }} />

      <div aria-hidden style={{ position:'absolute', inset:0, zIndex:2, pointerEvents:'none', overflow:'hidden' }}>
        {[{s:14,t:'12%',l:'8%',c:'#a29bfe',d:0,dur:11},{s:10,t:'22%',l:'88%',c:'#06B6D4',d:1.2,dur:9},
          {s:18,t:'55%',l:'6%',c:'#EC4899',d:.4,dur:13},{s:8,t:'68%',l:'92%',c:'#6c5ce7',d:2,dur:10},
          {s:12,t:'38%',l:'70%',c:'#6c5ce7',d:.8,dur:12},{s:6,t:'82%',l:'55%',c:'#F59E0B',d:1.6,dur:14},
          {s:16,t:'15%',l:'48%',c:'#10B981',d:2.4,dur:15}].map((p,i) => (
          <span key={i} style={{ position:'absolute', top:p.t, left:p.l, width:p.s, height:p.s, borderRadius:'50%',
            background:`radial-gradient(circle,${p.c}cc 0%,${p.c}22 60%,transparent 100%)`,
            boxShadow:`0 0 ${p.s*1.4}px ${p.c}55`,
            animation:`hero-float-${i%3} ${p.dur}s ease-in-out ${p.d}s infinite`, opacity:.8 }} />
        ))}
      </div>

      <div style={{ position:'relative', zIndex:3, maxWidth:'880px', width:'100%', margin:'0 auto', textAlign:'left' }}>
        <div style={{ display:'inline-flex', alignItems:'center', gap:'8px',
          padding:'7px 18px', borderWidth:1, borderStyle:'solid', borderRadius:'22px', marginBottom:'30px',
          fontSize:'12px', color: isDark?'#c4b8ff':P, fontWeight:700,
          borderColor: isDark?'rgba(162,155,254,0.3)':'rgba(108,92,231,0.2)',
          background: isDark?'rgba(108,92,231,0.1)':PBG,
          boxShadow: isDark?'0 2px 12px rgba(108,92,231,.25)':'0 2px 10px rgba(108,92,231,.1)',
          backdropFilter:'blur(6px)' }}>
          <span style={{ width:7, height:7, borderRadius:'50%', display:'inline-block',
            background: isDark?'#a29bfe':PL, animation:'pulse 1.6s infinite',
            boxShadow:`0 0 8px ${isDark?'#a29bfe':PL}` }} />
          Now live — WhatsApp Notifications & Multi-Office Command Centre
        </div>

        <h1 style={{ fontFamily:'Outfit,sans-serif', fontSize:'clamp(36px,6.5vw,70px)', fontWeight:900,
          lineHeight:1.06, marginBottom:'26px', letterSpacing:'-2px',
          color: isDark?'#eef2f9':DARK,
          textShadow: isDark?'0 2px 24px rgba(0,0,0,.55)':'none' }}>
          The <span className="grad-text">Smarter</span> Way to<br />Manage Every Visitor
        </h1>

        <p style={{ fontSize:'clamp(15px,1.9vw,18px)', lineHeight:1.85, marginBottom:'44px',
          maxWidth:'560px', color: isDark?'#94A3B8':MID }}>
          A powerful SaaS platform for corporate offices — check-ins, appointments, rooms,
          services, and real-time analytics, all in one stunning dashboard.
        </p>

        <div className="hero-btns" style={{ display:'flex', gap:'14px', flexWrap:'wrap', marginBottom:'20px', alignItems:'center' }}>
          <button className="btn-primary-lg" onClick={onRegister} style={{
            ...btnPrimary, padding:'15px 34px', fontSize:'15px', borderRadius:'12px',
            background: isDark?`linear-gradient(135deg,#a29bfe,#5a4bd1)`:`linear-gradient(135deg,${PL},${PD})`,
            boxShadow: isDark?'0 6px 24px rgba(108,92,231,.45)':'0 5px 18px rgba(108,92,231,.35)',
          }}>✨ Create Free Account</button>
          <a href="#pricing" style={{ ...btnOutline, padding:'15px 26px', fontSize:'15px',
            borderRadius:'12px', textDecoration:'none', display:'inline-flex', alignItems:'center',
            background: isDark?'rgba(255,255,255,.04)':'transparent',
            borderColor: isDark?'rgba(162,155,254,.45)':'rgba(108,92,231,.35)',
            color: isDark?'#c4b8ff':P }}>View Pricing</a>
        </div>
        <div style={{ marginBottom:'60px', fontSize:'14px', color: isDark?'#94A3B8':MID }}>
          Already have an account?{' '}
          <button type="button" onClick={onEnterApp} style={{ background:'transparent', border:'none', padding:0,
            color: isDark?'#a29bfe':P, fontWeight:700, cursor:'pointer', fontFamily:'inherit',
            fontSize:'14px', textDecoration:'underline', textUnderlineOffset:'3px' }}>Log In</button>
        </div>

        <div className="stats-grid" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'1px',
          background: isDark?'rgba(255,255,255,.08)':PBORDER, borderRadius:'18px', overflow:'hidden',
          borderWidth:1, borderStyle:'solid', borderColor: isDark?'rgba(255,255,255,.08)':PBORDER,
          maxWidth:'620px', boxShadow: isDark?'0 10px 30px rgba(0,0,0,.4)':'0 6px 24px rgba(108,92,231,.09)',
          backdropFilter:'blur(8px)' }}>
          {STATS.map(s => (
            <div key={s.label} style={{ padding:'clamp(14px,2vw,22px) 12px', textAlign:'center',
              background: isDark?'rgba(10,24,40,.85)':'#fff', position:'relative' }}>
              <div style={{ position:'absolute', top:0, left:0, right:0, height:'2.5px',
                background:`linear-gradient(90deg,${P},${PL})` }} />
              <div style={{ fontFamily:'Outfit,sans-serif', fontSize:'clamp(22px,3vw,30px)', fontWeight:900,
                marginBottom:5, color: isDark?'#F8FAFC':DARK }}>
                <Counter val={s.val} suffix={s.suffix} />
              </div>
              <div style={{ fontSize:'11px', fontWeight:600, color: isDark?'#94A3B8':MUTED }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
