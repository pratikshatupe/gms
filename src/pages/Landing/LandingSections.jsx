import React from 'react';
import { SUBSCRIPTION_PLANS } from '../../data/mockData';
import { P, PL, PD, PBG, PBORDER, DARK, MID, MUTED } from './landingConstants';
import { FadeIn } from './landingUtils';

const MODULES = [
  { icon:'📊', title:'Live Dashboard',       desc:'Real-time visitor stats, room occupancy, service alerts, and quick actions the moment you log in.',               color:'#5a4bd1', tag:'Core' },
  { icon:'📋', title:'Guest Log',            desc:'Complete visitor history with smart filters by type, date, and office. Export to Excel or PDF.',                 color:'#059669', tag:'Records' },
  { icon:'🚶', title:'Walk-in Check-in',     desc:'Instant registration with live photo capture, ID verification, badge printing, host notification.',              color:'#D97706', tag:'Front Desk' },
  { icon:'📅', title:'Appointments',         desc:'Pre-schedule visits with host assignment, document requirements, confirmations and auto-reminders.',             color:'#6c5ce7', tag:'Scheduling' },
  { icon:'🏢', title:'Venues & Rooms',       desc:'Manage boardrooms, conference rooms, and cabins with live availability calendar and utilisation reports.',        color:'#0891B2', tag:'Facilities' },
  { icon:'👥', title:'Team & Staff',         desc:'Role-based access for Directors, Managers, Service Staff, and Reception — module-level permissions.',           color:'#DC2626', tag:'HR' },
  { icon:'⚙️', title:'Services & Facilities',desc:'Pantry, parking, AV setup, logistics — all linked to visits, assigned to staff, fully trackable.',              color:'#0891B2', tag:'Operations' },
  { icon:'🌐', title:'Multi-Office',         desc:'Manage Dubai, Abu Dhabi, Sharjah and any number of locations from one central dashboard.',                       color:'#D97706', tag:'Enterprise' },
  { icon:'🔔', title:'Smart Notifications',  desc:'Email & WhatsApp alerts for check-ins, appointments, and service requests. Customisable templates.',            color:'#059669', tag:'Comms' },
  { icon:'📈', title:'Reports & Analytics',  desc:'Visitor trends, peak hours, office comparisons, duration tracking — export Excel, CSV, or PDF.',                color:'#6c5ce7', tag:'Insights' },
  { icon:'🛡️', title:'Security & Access',    desc:'Encrypted visitor data, full audit trails, role-based access, ID document verification, HTTPS.',                color:'#5a4bd1', tag:'Security' },
  { icon:'👑', title:'Super Admin Panel',    desc:'Global platform control — all organisations, subscriptions, billing, users, and system health.',                 color:'#D97706', tag:'Admin' },
];

const HOW_IT_WORKS = [
  { step:'01', icon:'🚪', title:'Visitor Arrives',    desc:'Walk-in or pre-scheduled — reception captures details, ID, and photo in seconds.' },
  { step:'02', icon:'✅', title:'Instant Check-in',   desc:'Badge prints automatically. Host gets WhatsApp + email the moment their guest is here.' },
  { step:'03', icon:'🎯', title:'Guided Stay',        desc:'Room pre-booked. Pantry, parking, AV — all service requests handled without friction.' },
  { step:'04', icon:'📊', title:'Smooth Check-out',   desc:'Visit closed, badge returned, data secured. Full visit report available instantly.' },
];

const TESTIMONIALS = [
  { name:'Rajesh Sharma', role:'CTO, Infosys Ltd',                  initials:'RS', color:'#5a4bd1', img:'https://randomuser.me/api/portraits/men/32.jpg',
    quote:'CorpGMS transformed our visitor experience across all our campuses. Check-in time dropped from 8 minutes to under 45 seconds.' },
  { name:'Priya Menon',   role:'Operations Director, TCS India',    initials:'PM', color:'#059669', img:'https://randomuser.me/api/portraits/women/44.jpg',
    quote:'The multi-office dashboard gives us visibility across 6 locations. Separate data per office yet central oversight — exactly what we needed.' },
  { name:'Anil Kapoor',   role:'Facilities Manager, Wipro Technologies', initials:'AK', color:'#6c5ce7', img:'https://randomuser.me/api/portraits/men/65.jpg',
    quote:'WhatsApp notifications are brilliant. Hosts always know the moment their visitors arrive — zero missed meetings, zero confusion at reception desks.' },
];

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

export default function LandingSections({ isDark, yearly, setYearly, onSignUp, onRegister, onEnterApp }) {
  return (
    <>
      <section id="modules" style={{ padding:'clamp(64px,9vh,108px) clamp(16px,5vw,64px)',
        maxWidth:'1320px', margin:'0 auto', background: isDark?'#050E1A':'#fff' }}>
        <FadeIn>
          <div style={{ textAlign:'center', marginBottom:'60px' }}>
            <div style={{ display:'inline-flex', padding:'5px 16px', background:PBG,
              border:`1px solid rgba(108,92,231,.2)`, borderRadius:'22px', fontSize:'11px',
              color:P, fontWeight:800, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:'18px' }}>12 Powerful Modules</div>
            <h2 style={{ fontFamily:'Outfit,sans-serif', fontSize:'clamp(28px,4.5vw,48px)', fontWeight:900,
              color: isDark?'#e9e4ff':DARK, marginBottom:'16px', letterSpacing:'-1px' }}>Built for Modern Enterprises</h2>
            <p style={{ fontSize:'16px', color: isDark?MUTED:MID, maxWidth:'520px', margin:'0 auto', lineHeight:1.75 }}>
              Every module designed to save time, impress visitors, and give your team total control.</p>
          </div>
        </FadeIn>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(min(100%,265px),1fr))', gap:'18px' }}>
          {MODULES.map((m,i) => (
            <FadeIn key={m.title} delay={Math.min(i*.04,.3)}>
              <div className="mod-card" style={{ padding:'26px', borderRadius:'18px', height:'100%',
                border:`1px solid ${isDark?'#142535':PBORDER}`,
                background: isDark?'#0D1F30':'#fff',
                position:'relative', overflow:'hidden', cursor:'default', transition:'all .3s ease' }}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=m.color;e.currentTarget.style.background=isDark?`${m.color}08`:`${m.color}04`;}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=isDark?'#142535':PBORDER;e.currentTarget.style.background=isDark?'#0D1F30':'#fff';}}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'16px' }}>
                  <div style={{ width:48, height:48, borderRadius:14, background:`${m.color}10`,
                    border:`1px solid ${m.color}20`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>{m.icon}</div>
                  <span style={{ fontSize:10, fontWeight:800, padding:'3px 11px', borderRadius:20,
                    background:`${m.color}10`, color:m.color, border:`1px solid ${m.color}18`, letterSpacing:'0.04em' }}>{m.tag}</span>
                </div>
                <h3 style={{ fontFamily:'Outfit,sans-serif', fontSize:15, fontWeight:800,
                  color: isDark?'#e9e4ff':DARK, marginBottom:9 }}>{m.title}</h3>
                <p style={{ fontSize:13, color: isDark?MUTED:MID, lineHeight:1.7 }}>{m.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      <section id="how" style={{ padding:'clamp(64px,9vh,108px) clamp(16px,5vw,64px)',
        background: isDark?'#030A12':PBG,
        borderTop:`1px solid ${isDark?'#142535':PBORDER}`, borderBottom:`1px solid ${isDark?'#142535':PBORDER}` }}>
        <div style={{ maxWidth:'1140px', margin:'0 auto' }}>
          <FadeIn>
            <div style={{ textAlign:'center', marginBottom:'60px' }}>
              <div style={{ display:'inline-flex', padding:'5px 16px',
                background: isDark?'rgba(8,145,178,0.12)':'#E0F7F4',
                border:'1px solid rgba(8,145,178,0.2)', borderRadius:'22px', fontSize:'11px',
                color:'#0891B2', fontWeight:800, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:'18px' }}>How It Works</div>
              <h2 style={{ fontFamily:'Outfit,sans-serif', fontSize:'clamp(28px,4.5vw,48px)', fontWeight:900,
                color: isDark?'#e9e4ff':DARK, marginBottom:'14px', letterSpacing:'-1px' }}>From Arrival to Check-out</h2>
              <p style={{ fontSize:'15px', color: isDark?MUTED:MID, lineHeight:1.7 }}>A smooth, professional visitor experience in 4 simple steps.</p>
            </div>
          </FadeIn>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,230px),1fr))', gap:'20px' }}>
            {HOW_IT_WORKS.map((s,i) => (
              <FadeIn key={s.step} delay={i*.1}>
                <div className="how-card" style={{ textAlign:'center', padding:'30px 22px', borderRadius:'18px',
                  border:`1px solid ${isDark?'#142535':PBORDER}`,
                  background: isDark?'#0D1F30':'#fff', transition:'all .3s', cursor:'default' }}>
                  <div style={{ width:56, height:56, borderRadius:18, background:`linear-gradient(135deg,${PL},${PD})`,
                    display:'flex', alignItems:'center', justifyContent:'center', fontSize:24,
                    margin:'0 auto 18px', boxShadow:`0 5px 18px rgba(108,92,231,.28)` }}>{s.icon}</div>
                  <div style={{ fontSize:11, fontWeight:800, color:PL, marginBottom:9,
                    letterSpacing:'0.1em', textTransform:'uppercase' }}>Step {s.step}</div>
                  <h3 style={{ fontFamily:'Outfit,sans-serif', fontSize:16, fontWeight:800,
                    color: isDark?'#e9e4ff':DARK, marginBottom:10 }}>{s.title}</h3>
                  <p style={{ fontSize:13, color: isDark?MUTED:MID, lineHeight:1.7 }}>{s.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding:'clamp(64px,9vh,108px) clamp(16px,5vw,64px)', maxWidth:'1140px', margin:'0 auto',
        background: isDark?'#050E1A':'#fff' }}>
        <FadeIn>
          <div style={{ textAlign:'center', marginBottom:'52px' }}>
            <h2 style={{ fontFamily:'Outfit,sans-serif', fontSize:'clamp(26px,4vw,44px)', fontWeight:900,
              color: isDark?'#e9e4ff':DARK, marginBottom:'14px', letterSpacing:'-0.8px' }}>See CorpGMS in Action</h2>
            <p style={{ color: isDark?MUTED:MID, fontSize:'16px', lineHeight:1.7 }}>One platform. Every visitor. Total control.</p>
          </div>
        </FadeIn>
        <FadeIn delay={0.1}>
          <div style={{ borderRadius:'22px', border:`1px solid ${isDark?'#142535':PBORDER}`,
            overflow:'hidden', background: isDark?'#0D1F30':'#fff',
            boxShadow:`0 24px 70px rgba(108,92,231,.11)` }}>
            <div style={{ padding:'10px 18px', background:`linear-gradient(135deg,${DARK},#0C3060)`,
              display:'flex', alignItems:'center', gap:'10px' }}>
              <div style={{ display:'flex', gap:'7px' }}>
                {['#E53935','#F57C00','#43A047'].map(c=><div key={c} style={{ width:11, height:11, borderRadius:'50%', background:c }} />)}
              </div>
              <div style={{ flex:1, background:'rgba(255,255,255,.09)', borderRadius:7, padding:'5px 14px',
                fontSize:11, color:'#a29bfe', fontFamily:'monospace', border:`1px solid rgba(108,92,231,.2)` }}>
                app.corpgms.io/dashboard</div>
            </div>
            <div style={{ padding:'clamp(18px,3vw,28px)', background: isDark?'#071220':'#f4f7fc' }}>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,160px),1fr))',
                gap:'13px', marginBottom:'18px' }}>
                {[{label:'Visitors Today',val:'47',color:P,icon:'🚶',tag:'+12%'},
                  {label:'Currently Inside',val:'12',color:'#059669',icon:'✅',tag:'Live'},
                  {label:'Upcoming Today',val:'8',color:'#D97706',icon:'📅',tag:'Next 2PM'},
                  {label:'Rooms Occupied',val:'5/8',color:PL,icon:'🏢',tag:'63%'}].map(c=>(
                  <div key={c.label} style={{ padding:15, borderRadius:13,
                    border:`1px solid ${isDark?'#142535':PBORDER}`,
                    background: isDark?'#0A1828':'#fff', position:'relative', overflow:'hidden', cursor:'pointer', transition:'border-color .2s' }}
                    onMouseEnter={e=>e.currentTarget.style.borderColor=c.color}
                    onMouseLeave={e=>e.currentTarget.style.borderColor=isDark?'#142535':PBORDER}>
                    <div style={{ position:'absolute', top:0, left:0, right:0, height:'2.5px', background:c.color }} />
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:11 }}>
                      <span style={{ fontSize:18 }}>{c.icon}</span>
                      <span style={{ fontSize:10, background:`${c.color}12`, color:c.color, padding:'2px 9px', borderRadius:10, fontWeight:800 }}>{c.tag}</span>
                    </div>
                    <div style={{ fontFamily:'Outfit,sans-serif', fontSize:'clamp(24px,3vw,30px)', fontWeight:900,
                      color: isDark?'#e9e4ff':DARK, marginBottom:5 }}>{c.val}</div>
                    <div style={{ fontSize:11, color:MUTED, fontWeight:500 }}>{c.label}</div>
                  </div>
                ))}
              </div>
              <div style={{ borderRadius:13, border:`1px solid ${isDark?'#142535':PBORDER}`, overflow:'hidden',
                background: isDark?'#0A1828':'#fff' }}>
                <div style={{ padding:'11px 18px', background:`linear-gradient(135deg,${DARK},#0C3060)`,
                  fontSize:12, fontWeight:800, color:'#a29bfe', textTransform:'uppercase',
                  letterSpacing:'0.07em', display:'flex', justifyContent:'space-between' }}>
                  <span>Recent Visitors</span>
                  <span style={{ color:'#34D399', animation:'pulse 2s infinite', fontSize:11 }}>● Live</span>
                </div>
                {[{name:'Ahmed Al Rashid',company:'Emirates Group',status:'Inside',color:'#059669',time:'09:15 AM',room:'Board Room A'},
                  {name:'Sarah Johnson',company:'McKinsey & Co',status:'Checked Out',color:P,time:'10:00 AM',room:'Conf. Room 1'},
                  {name:'Fatima Al Zaabi',company:'ADNOC',status:'Expected',color:'#D97706',time:'02:00 PM',room:'Board Room B'}
                ].map((v,i)=>(
                  <div key={v.name} style={{ padding:'13px 18px', display:'flex', alignItems:'center', gap:13,
                    borderTop: i>0?`1px solid ${isDark?'#142535':PBG}`:'none', transition:'background .2s' }}
                    onMouseEnter={e=>e.currentTarget.style.background=isDark?'#0A1828':PBG}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <div style={{ width:36, height:36, borderRadius:10, background:`${v.color}12`,
                      display:'flex', alignItems:'center', justifyContent:'center', fontSize:12,
                      fontWeight:800, color:v.color, flexShrink:0, border:`1px solid ${v.color}20` }}>
                      {v.name.split(' ').map(n=>n[0]).join('').slice(0,2)}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:700, color: isDark?'#e9e4ff':DARK,
                        whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{v.name}</div>
                      <div style={{ fontSize:11, color:MUTED }}>{v.company} · {v.room}</div>
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      <div style={{ fontSize:10, fontWeight:800, padding:'3px 10px', borderRadius:20,
                        background:`${v.color}12`, color:v.color, marginBottom:3 }}>{v.status}</div>
                      <div style={{ fontSize:10, color:MUTED }}>{v.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </FadeIn>
      </section>

      <section id="pricing" style={{ padding:'clamp(64px,9vh,108px) clamp(16px,5vw,64px)',
        background: isDark?'#030A12':PBG,
        borderTop:`1px solid ${isDark?'#142535':PBORDER}`, borderBottom:`1px solid ${isDark?'#142535':PBORDER}` }}>
        <div style={{ maxWidth:'1140px', margin:'0 auto' }}>
          <FadeIn>
            <div style={{ textAlign:'center', marginBottom:'52px' }}>
              <div style={{ display:'inline-flex', padding:'5px 16px',
                background: isDark?'rgba(108,92,231,0.08)':'#fff',
                border:`1px solid ${PBORDER}`, borderRadius:'22px', fontSize:11,
                color:P, fontWeight:800, letterSpacing:'0.1em', textTransform:'uppercase',
                marginBottom:18, boxShadow:`0 2px 8px rgba(108,92,231,.08)` }}>Pricing</div>
              <h2 style={{ fontFamily:'Outfit,sans-serif', fontSize:'clamp(28px,4.5vw,48px)', fontWeight:900,
                color: isDark?'#e9e4ff':DARK, marginBottom:14, letterSpacing:'-1px' }}>Simple, Transparent Pricing</h2>
              <p style={{ fontSize:15, color: isDark?MUTED:MID, marginBottom:32, lineHeight:1.7 }}>No hidden fees. Scale as you grow. Cancel anytime.</p>
              <div style={{ display:'inline-flex', alignItems:'center', gap:6, padding:5,
                background: isDark?'#0A1828':'#fff', border:`1px solid ${PBORDER}`,
                borderRadius:44, boxShadow:'0 2px 10px rgba(108,92,231,.07)' }}>
                <button onClick={()=>setYearly(false)} style={{ padding:'9px 24px', borderRadius:34, border:'none',
                  cursor:'pointer', fontSize:13, fontWeight:700,
                  background: !yearly?`linear-gradient(135deg,${PL},${PD})`:'transparent',
                  color: !yearly?'white': isDark?MUTED:MID, transition:'all .25s', fontFamily:'inherit' }}>Month</button>
                <button onClick={()=>setYearly(true)} style={{ padding:'9px 24px', borderRadius:34, border:'none',
                  cursor:'pointer', fontSize:13, fontWeight:700,
                  background: yearly?`linear-gradient(135deg,${PL},${PD})`:'transparent',
                  color: yearly?'white': isDark?MUTED:MID, transition:'all .25s', fontFamily:'inherit',
                  display:'flex', alignItems:'center', gap:7 }}>
                  Year <span style={{ fontSize:10, background:'rgba(5,150,105,.12)', color:'#059669',
                    padding:'2px 9px', borderRadius:12, fontWeight:800 }}>Save 20%</span>
                </button>
              </div>
            </div>
          </FadeIn>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,305px),1fr))', gap:22, alignItems:'start' }}>
            {SUBSCRIPTION_PLANS.map((plan,i) => (
              <FadeIn key={plan.id} delay={i*.1}>
                <div className="plan-card" style={{ padding:30, borderRadius:20, position:'relative',
                  border: plan.featured?`2px solid ${P}`:`1px solid ${isDark?'#142535':PBORDER}`,
                  background: isDark?'#0D1F30':'#fff',
                  boxShadow: plan.featured?`0 16px 48px rgba(108,92,231,.17)`:`0 2px 10px rgba(108,92,231,.05)`,
                  transition:'all .3s' }}>
                  {plan.featured && (
                    <div style={{ position:'absolute', top:-12, left:'50%', transform:'translateX(-50%)',
                      fontSize:10, fontWeight:800, padding:'5px 14px',
                      background:`linear-gradient(135deg,${PL},${PD})`, color:'white',
                      borderRadius:20, letterSpacing:'0.07em', textTransform:'uppercase',
                      whiteSpace:'nowrap', boxShadow:`0 3px 12px rgba(108,92,231,.4)` }}>⭐ Most Popular</div>
                  )}
                  <div style={{ fontSize:11, fontWeight:800, color:plan.color, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:10 }}>{plan.name}</div>
                  <div style={{ display:'flex', alignItems:'baseline', gap:5, marginBottom:10 }}>
                    <span style={{ fontFamily:'Outfit,sans-serif', fontSize:48, fontWeight:900,
                      color: isDark?'#e9e4ff':DARK, letterSpacing:'-2px' }}>
                      ₹{Number(yearly?plan.yearlyPrice:plan.price).toLocaleString('en-IN')}</span>
                    <span style={{ fontSize:13, color:MUTED }}>per Month</span>
                  </div>
                  <p style={{ fontSize:13, color: isDark?MUTED:MID, marginBottom:22, lineHeight:1.65 }}>{plan.desc}</p>
                  <div style={{ display:'flex', gap:7, marginBottom:22, flexWrap:'wrap' }}>
                    {[plan.offices==='Unlimited'?'∞ Offices':`${plan.offices} Office${plan.offices>1?'s':''}`,
                      plan.users==='Unlimited'?'∞ Users':`${plan.users} Users`,
                      plan.visitors==='Unlimited'?'∞ Visitors':`${Number(plan.visitors).toLocaleString('en-GB')} per Month`
                    ].map(t=><span key={t} style={{ fontSize:11, background:`${plan.color}10`, color:plan.color,
                      padding:'4px 11px', borderRadius:22, border:`1px solid ${plan.color}20`, fontWeight:700 }}>{t}</span>)}
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:11, marginBottom:26 }}>
                    {plan.features.map(f=>(
                      <div key={f.label} style={{ display:'flex', alignItems:'center', gap:11 }}>
                        <div style={{ width:19, height:19, borderRadius:'50%',
                          background: f.included?'rgba(5,150,105,.1)': isDark?'#071220':'#f4f7fc',
                          display:'flex', alignItems:'center', justifyContent:'center', fontSize:11,
                          color: f.included?'#059669':'#6BA3C0', flexShrink:0,
                          border:`1px solid ${f.included?'rgba(5,150,105,.22)':PBORDER}` }}>
                          {f.included?'✓':'×'}</div>
                        <span style={{ fontSize:13, color: f.included? (isDark?MUTED:MID) :'#6BA3C0' }}>{f.label}</span>
                      </div>
                    ))}
                  </div>
                  <button onClick={onSignUp} style={{ width:'100%', padding:13, fontSize:14,
                    borderRadius:11, fontFamily:'Outfit,sans-serif', fontWeight:700, cursor:'pointer',
                    ...(plan.featured
                      ? { background:`linear-gradient(135deg,${PL},${PD})`, color:'#fff', border:'none', boxShadow:`0 5px 18px rgba(108,92,231,.32)` }
                      : { background: isDark?'rgba(108,92,231,0.08)':PBG, color:P, border:`1px solid ${PBORDER}` }),
                    transition:'all .2s' }}>
                    {plan.name==='Enterprise'?'Contact Sales':'Get Started Free'}
                  </button>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding:'clamp(64px,9vh,108px) clamp(16px,5vw,64px)',
        maxWidth:'1140px', margin:'0 auto', background: isDark?'#050E1A':'#fff' }}>
        <FadeIn>
          <div style={{ textAlign:'center', marginBottom:'52px' }}>
            <h2 style={{ fontFamily:'Outfit,sans-serif', fontSize:'clamp(26px,4vw,42px)', fontWeight:900,
              color: isDark?'#e9e4ff':DARK, marginBottom:12, letterSpacing:'-0.8px' }}>Trusted by Leading Organisations</h2>
            <p style={{ fontSize:15, color: isDark?MUTED:MID, lineHeight:1.7 }}>What companies say after switching to CorpGMS.</p>
          </div>
        </FadeIn>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,305px),1fr))', gap:22 }}>
          {TESTIMONIALS.map((t,i) => (
            <FadeIn key={t.name} delay={i*.1}>
              <div className="testi-card" style={{ padding:30, height:'100%', display:'flex', flexDirection:'column',
                borderRadius:18, border:`1px solid ${isDark?'#142535':PBORDER}`,
                background: isDark?'#0D1F30':'#fff', transition:'all .3s' }}
                onMouseEnter={e=>e.currentTarget.style.borderColor=t.color}
                onMouseLeave={e=>e.currentTarget.style.borderColor=isDark?'#142535':PBORDER}>
                <div style={{ color:'#F59E0B', fontSize:14, letterSpacing:2, marginBottom:14 }}>★★★★★</div>
                <div style={{ fontSize:40, color:t.color, marginBottom:16, opacity:.35, lineHeight:1, fontFamily:'Georgia,serif' }}>"</div>
                <p style={{ fontSize:14, color: isDark?MUTED:MID, lineHeight:1.8, marginBottom:26, flex:1 }}>{t.quote}</p>
                <div style={{ display:'flex', alignItems:'center', gap:13, paddingTop:20,
                  borderTop:`1px solid ${isDark?'#142535':PBORDER}` }}>
                  <img src={t.img} alt={t.name}
                    onError={e=>{e.currentTarget.style.display='none';e.currentTarget.nextElementSibling.style.display='flex';}}
                    style={{ width:48, height:48, borderRadius:14, objectFit:'cover', flexShrink:0,
                      border:`2px solid ${t.color}30`, boxShadow:`0 3px 10px ${t.color}25` }} />
                  <div style={{ width:48, height:48, borderRadius:14, background:`${t.color}14`, display:'none',
                    alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:800,
                    color:t.color, flexShrink:0, border:`2px solid ${t.color}20` }}>{t.initials}</div>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color: isDark?'#e9e4ff':DARK }}>{t.name}</div>
                    <div style={{ fontSize:11, color:MUTED, marginTop:2 }}>{t.role}</div>
                  </div>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      <section style={{ padding:'clamp(64px,11vh,128px) clamp(16px,5vw,64px)', textAlign:'center',
        position:'relative', overflow:'hidden',
        background: isDark?'#030A12':PBG,
        borderTop:`1px solid ${isDark?'#142535':PBORDER}` }}>
        <div style={{ position:'absolute', top:0, left:0, right:0, height:'2.5px',
          background:`linear-gradient(90deg,transparent,${P},${PL},#06B6D4,transparent)` }} />
        <div style={{ position:'absolute', top:'-80px', right:'-80px', width:340, height:340, borderRadius:'50%',
          background:`radial-gradient(circle,rgba(108,92,231,.10) 0%,transparent 70%)`, pointerEvents:'none' }} />
        <div style={{ position:'absolute', bottom:'-60px', left:'-60px', width:260, height:260, borderRadius:'50%',
          background:`radial-gradient(circle,rgba(108,92,231,.08) 0%,transparent 70%)`, pointerEvents:'none' }} />
        <FadeIn>
          <div style={{ position:'relative', maxWidth:660, margin:'0 auto' }}>
            <div style={{ fontSize:56, marginBottom:22, display:'inline-block', animation:'float 3.2s ease infinite' }}>🚀</div>
            <h2 style={{ fontFamily:'Outfit,sans-serif', fontSize:'clamp(28px,5.5vw,56px)', fontWeight:900,
              color: isDark?'#e9e4ff':DARK, marginBottom:18, lineHeight:1.07, letterSpacing:'-1.5px' }}>
              Ready to Impress<br /><span className="grad-text">Every Visitor?</span>
            </h2>
            <p style={{ fontSize:17, color: isDark?MUTED:MID, lineHeight:1.75,
              maxWidth:480, margin:'0 auto 40px' }}>Start your 14-day free trial. No credit card required.</p>
            <div style={{ display:'flex', gap:14, justifyContent:'center', flexWrap:'wrap' }}>
              <button className="btn-primary-lg" onClick={onRegister}
                style={{ ...btnPrimary, padding:'16px 38px', fontSize:16, borderRadius:13 }}>
                ✨ Create Free Account</button>
              <button className="btn-outline-lg" onClick={onEnterApp}
                style={{ ...btnOutline, padding:'16px 32px', fontSize:16, borderRadius:13,
                  color: isDark?'#c4b8ff':P,
                  borderColor: isDark?'rgba(162,155,254,.4)':'rgba(108,92,231,.35)',
                  background: isDark?'rgba(108,92,231,.05)':'transparent' }}>Log In</button>
            </div>
          </div>
        </FadeIn>
      </section>

      <footer style={{ padding:'clamp(22px,3vw,36px) clamp(16px,5vw,52px)',
        borderTop:`1px solid ${isDark?'#142535':PBORDER}`,
        background: isDark?'#050E1A':'#fff' }}>
        <div style={{ maxWidth:'1140px', margin:'0 auto' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:18, marginBottom:22 }}>
            <a href="#" style={{ display:'flex', alignItems:'center', gap:11, textDecoration:'none' }}>
              <div style={{ width:32, height:32, borderRadius:9, background:`linear-gradient(135deg,${PL},${PD})`,
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:14,
                fontWeight:900, color:'white', fontFamily:'Outfit,sans-serif' }}>G</div>
              <div>
                <div style={{ fontFamily:'Outfit,sans-serif', fontWeight:800, fontSize:14, color: isDark?'#e9e4ff':DARK }}>CorpGMS</div>
                <div style={{ fontSize:10, color:MUTED, fontWeight:500 }}>Corporate Guest Management System</div>
              </div>
            </a>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
              {[['#modules','Modules'],['#how','How It Works'],['#pricing','Pricing']].map(([h,l]) => (
                <a key={h} href={h} style={{ padding:'6px 13px', fontSize:12, color:MUTED, textDecoration:'none',
                  borderRadius:8, border:`1px solid ${isDark?'#142535':PBORDER}`, transition:'all .2s', fontWeight:600 }}
                  onMouseEnter={e=>{e.target.style.color=P;e.target.style.borderColor='rgba(108,92,231,.3)';e.target.style.background=isDark?'rgba(108,92,231,.08)':PBG;}}
                  onMouseLeave={e=>{e.target.style.color=MUTED;e.target.style.borderColor=isDark?'#142535':PBORDER;e.target.style.background='transparent';}}>{l}</a>
              ))}
              <button onClick={onSignUp} style={{ padding:'6px 13px', fontSize:12,
                color:P, border:`1px solid ${PBORDER}`, borderRadius:8,
                background: isDark?'rgba(108,92,231,.08)':PBG, cursor:'pointer',
                fontFamily:'inherit', fontWeight:700 }}>✨ Sign Up Free</button>
            </div>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
            flexWrap:'wrap', gap:12, paddingTop:18, borderTop:`1px solid ${isDark?'#142535':PBORDER}` }}>
            <span style={{ fontSize:12, color: isDark?'#3A6480':'#C4C2DE' }}>
              © 2025 <span style={{ color:MUTED, cursor:'pointer', fontWeight:700 }}>CorpGMS by BIZZFLY</span> · All rights reserved.
            </span>
            <div style={{ display:'flex', gap:18 }}>
              {[{label:'Privacy',href:'/privacy'},{label:'Terms',href:'/terms'},
                {label:'Contact',href:'mailto:support@corpgms.com'},{label:'Status',href:'#'}].map(({label,href}) => (
                <a key={label} href={href} style={{ fontSize:12, color: isDark?'#3A6480':'#C4C2DE',
                  textDecoration:'none', transition:'color .2s', fontWeight:500 }}
                  onMouseEnter={e=>e.target.style.color=P}
                  onMouseLeave={e=>e.target.style.color=isDark?'#3A6480':'#C4C2DE'}>{label}</a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
