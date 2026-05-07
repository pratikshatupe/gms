import React from 'react';
import { P, PL, PD, PBG, PBORDER } from './landingConstants';

export default function LandingStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
      @keyframes float       { 0%,100%{transform:translateY(0)}   50%{transform:translateY(-9px)} }
      @keyframes pulse       { 0%,100%{opacity:1}                 50%{opacity:0.35} }
      @keyframes shimmer     { 0%{background-position:200% center} 100%{background-position:-200% center} }
      @keyframes hero-float-0 { 0%,100%{transform:translate3d(0,0,0) scale(1);opacity:.55}    50%{transform:translate3d(18px,-28px,0) scale(1.2);opacity:1} }
      @keyframes hero-float-1 { 0%,100%{transform:translate3d(0,0,0) scale(1);opacity:.5}     50%{transform:translate3d(-22px,-34px,0) scale(1.15);opacity:.95} }
      @keyframes hero-float-2 { 0%,100%{transform:translate3d(0,0,0) scale(.9);opacity:.4}    50%{transform:translate3d(10px,-42px,0) scale(1.25);opacity:.85} }
      *, *::before, *::after  { box-sizing:border-box; margin:0; padding:0; }
      @media(max-width:640px){
        .nav-links { display:none !important; }
        .hero-btns { flex-direction:column !important; align-items:stretch !important; }
        .stats-grid { grid-template-columns:repeat(2,1fr) !important; }
        .nav-signup-btn { display:none !important; }
      }
      .mod-card  { transform:translateY(0); }
      .mod-card::before {
        content:''; position:absolute; inset:-1px; border-radius:18px; padding:1px;
        pointer-events:none; opacity:0;
        background:linear-gradient(135deg,${PL},#06B6D4,#EC4899);
        -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);
        -webkit-mask-composite:xor; mask-composite:exclude; transition:opacity .35s;
      }
      .mod-card:hover::before   { opacity:1; }
      .mod-card:hover           { transform:translateY(-5px) !important; box-shadow:0 16px 36px rgba(108,92,231,.12) !important; }
      .testi-card:hover         { transform:translateY(-4px); box-shadow:0 12px 30px rgba(108,92,231,.1); }
      .nav-link:hover           { color:${P} !important; background:${PBG} !important; }
      .btn-primary-lg:hover     { box-shadow:0 10px 30px rgba(108,92,231,.5) !important; transform:translateY(-2px); }
      .btn-outline-lg:hover     { background:${PBG} !important; border-color:${PL} !important; }
      .nav-signup-btn:hover     { background:${PBG} !important; border-color:${P} !important; color:${PD} !important; }
      .nav-cta-btn:hover        { box-shadow:0 8px 22px rgba(108,92,231,.5) !important; transform:translateY(-1px); }
      .scroll-top-btn           { position:fixed; bottom:28px; right:28px; z-index:990; width:44px; height:44px; border-radius:13px; border:none; cursor:pointer; background:linear-gradient(135deg,${PL},${PD}); color:#fff; font-size:18px; display:flex; align-items:center; justify-content:center; box-shadow:0 5px 18px rgba(108,92,231,.42); transition:all .2s; }
      .scroll-top-btn:hover     { transform:translateY(-3px); box-shadow:0 10px 26px rgba(108,92,231,.55); }
      .grad-text                { background:linear-gradient(135deg,${P} 0%,${PL} 50%,#6c5ce7 100%); background-size:200% auto; -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; animation:shimmer 4s linear infinite; }

      .hero-img-overlay         { position:absolute; inset:0; backdrop-filter:blur(1px);
                                  background:linear-gradient(to right,rgba(255,255,255,1) 0%,rgba(255,255,255,.95) 38%,rgba(255,255,255,.55) 65%,rgba(255,255,255,.05) 100%); }
      @media(max-width:768px)   { .hero-img-overlay { background:linear-gradient(to bottom,rgba(255,255,255,.15) 0%,rgba(255,255,255,.88) 48%,rgba(255,255,255,1) 100%); } }

      [data-theme="dark"] .hero-img-overlay { background:linear-gradient(to right,rgba(5,14,26,.93) 0%,rgba(5,14,26,.80) 40%,rgba(5,14,26,.55) 68%,rgba(5,14,26,.22) 100%); backdrop-filter:blur(2px); }
      @media(max-width:768px)   { [data-theme="dark"] .hero-img-overlay { background:linear-gradient(to bottom,rgba(5,14,26,.45) 0%,rgba(5,14,26,.82) 48%,rgba(5,14,26,.96) 100%); } }
      [data-theme="dark"] .btn-primary-lg:hover { box-shadow:0 12px 34px rgba(108,92,231,.55) !important; }
      [data-theme="dark"] .btn-outline-lg:hover { background:rgba(108,92,231,.14) !important; border-color:#a29bfe !important; color:#eef2f9 !important; }

      .orb { position:absolute; border-radius:50%; background:radial-gradient(circle,rgba(108,92,231,.12) 0%,rgba(108,92,231,0) 70%); pointer-events:none; }
      .plan-card:hover { transform:translateY(-4px); }
      .how-card:hover  { border-color:${P} !important; transform:translateY(-5px); box-shadow:0 10px 30px rgba(108,92,231,.13) !important; }
      input,select,textarea { font-family:'Plus Jakarta Sans',sans-serif; }
    `}</style>
  );
}
