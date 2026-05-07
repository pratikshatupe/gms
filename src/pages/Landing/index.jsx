import React, { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import LoginModal from './LoginModal';
import RegistrationModal from './RegistrationModal';
import LandingStyles from './LandingStyles';
import LandingHero, { LandingNav } from './LandingHero';
import LandingSections from './LandingSections';
import ChatbotWidget from '../../components/Chatbot/ChatbotWidget';
import { getReferralFromURL } from '../../utils/referrals';

export default function Landing({ onEnterApp, onLogin }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [yearly,    setYearly]    = useState(false);
  const [scrollY,   setScrollY]   = useState(0);
  const [showSignUp,    setShowSignUp]    = useState(false);
  const [showRegister,  setShowRegister]  = useState(false);
  const [toast,     setToast]     = useState(null);

  useEffect(() => {
    const h = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  /* If the visitor arrived via a referral link (?ref=CODE), drop them
   * straight into the registration modal so the code is captured at signup. */
  useEffect(() => {
    if (getReferralFromURL()) {
      setShowRegister(true);
      setToast('You were referred — finish signing up to credit your friend.');
    }
  }, []);

  const openSignUp   = () => setShowSignUp(true);
  const openRegister = () => setShowRegister(true);

  return (
    <div className="cgms-landing-page" style={{ minHeight:'100vh',
      background: isDark ? '#050E1A' : '#FFFFFF',
      overflowX:'hidden', fontFamily:"'Plus Jakarta Sans', sans-serif" }}>

      {showSignUp && (
        <LoginModal
          onClose={() => setShowSignUp(false)}
          onLoginSuccess={(role) => {
            setShowSignUp(false);
            if (onLogin) onLogin(role);
            else if (onEnterApp) onEnterApp();
          }}
        />
      )}

      {showRegister && (
        <RegistrationModal
          onClose={() => setShowRegister(false)}
          onSuccess={() => {
            setShowRegister(false);
            if (onEnterApp) onEnterApp();
          }}
          onLoginAndEnter={(userData) => {
            setShowRegister(false);
            if (onLogin) onLogin(userData);
            else if (onEnterApp) onEnterApp();
          }}
        />
      )}

      {toast && (
        <div role="status" style={{ position:'fixed', top:22, right:22, zIndex:10000,
          minWidth:280, maxWidth:380, padding:'14px 16px',
          background:'#ECFDF5', color:'#15803D', border:'1px solid #86EFAC',
          borderRadius:12, boxShadow:'0 10px 30px rgba(0,0,0,0.12)',
          display:'flex', alignItems:'flex-start', gap:10, fontSize:13, fontWeight:600 }}>
          <div style={{ flex:1 }}>{toast}</div>
          <button onClick={() => setToast(null)} style={{ border:'none', background:'transparent',
            cursor:'pointer', fontSize:16, color:'#15803D' }}>×</button>
        </div>
      )}

      <LandingStyles />

      {scrollY > 400 && (
        <button className="scroll-top-btn" onClick={() => window.scrollTo({ top:0, behavior:'smooth' })} title="Scroll to top">↑</button>
      )}

      <LandingNav isDark={isDark} scrollY={scrollY} onEnterApp={onEnterApp} onSignUp={openSignUp} />
      <LandingHero isDark={isDark} scrollY={scrollY} onEnterApp={onEnterApp} onRegister={openRegister} />
      <LandingSections
        isDark={isDark}
        yearly={yearly}
        setYearly={setYearly}
        onSignUp={openSignUp}
        onRegister={openRegister}
        onEnterApp={onEnterApp}
      />
      <ChatbotWidget variant="floating" />
    </div>
  );
}

