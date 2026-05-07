import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { orgNameFor, roleLabel, normaliseRole } from '../../utils/sessionContext';
import NotificationBell from '../NotificationBell';
import ProfileDropdown from './ProfileDropdown';

const PAGE_TITLES = {
  dashboard:            'Dashboard',
  'guest-log':          'Guest Log',
  walkin:               'Walk-in Check-in',
  appointments:         'Appointments',
  rooms:                'Venues & Rooms',
  staff:                'Team & Staff',
  services:             'Services',
  offices:              'Offices',
  notifications:        'Notifications',
  reports:              'Reports & Analytics',
  settings:             'Settings',
  subscription:         'Subscription Plans',
  admin:                'Organisations Management',
  'roles-permissions':  'Roles & Permissions',
  'audit-logs':         'Audit Logs',
};

const SEARCH_ROUTES = [
  { keywords:['dashboard','home','overview','live','stats'],        page:'dashboard',     label:'Dashboard',            icon:'📊' },
  { keywords:['guest','log','visitor','history','record','check'],  page:'guest-log',     label:'Guest Log',            icon:'📋' },
  { keywords:['walk','walkin','walk-in','new visitor','checkin'],   page:'walkin',        label:'Walk-in Check-in',     icon:'🚶' },
  { keywords:['appointment','schedule','booking','meeting'],        page:'appointments',  label:'Appointments',         icon:'📅' },
  { keywords:['room','venue','board','conference','cabin','hall'],  page:'rooms',         label:'Venues & Rooms',       icon:'🏢' },
  { keywords:['staff','team','employee','user','member','role'],    page:'staff',         label:'Team & Staff',         icon:'👥' },
  { keywords:['service','pantry','parking','av','facility'],        page:'services',      label:'Services & Facilities',icon:'⚙️' },
  { keywords:['office','location','branch','dubai'],                page:'offices',       label:'Offices',              icon:'🌐' },
  { keywords:['notification','alert','bell','message'],             page:'notifications', label:'Notifications',        icon:'🔔' },
  { keywords:['report','analytics','chart','export','data'],        page:'reports',       label:'Reports & Analytics',  icon:'📈' },
  { keywords:['subscription','plan','billing','payment','upgrade'], page:'subscription',  label:'Subscription Plans',   icon:'💎' },
  { keywords:['admin','super','system','platform','global'],        page:'admin',         label:'Admin Panel',          icon:'🛡️' },
  { keywords:['role','permission','access','rbac'],                 page:'roles-permissions', label:'Roles & Permissions', icon:'🔐' },
  { keywords:['settings','preference','config'],                     page:'settings',      label:'Settings',             icon:'⚙️' },
];

export default function Topbar({
  activePage,
  setActivePage,
  isMobile,
  onMenuClick,
  collapsed,
  setCollapsed,
  user,
  onLogout,
  theme = 'light',
  onToggleTheme,
}) {
  const { logout } = useAuth();

  const [search, setSearch]                 = useState('');
  const [suggestions, setSuggestions]       = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [focusedIdx, setFocusedIdx]         = useState(-1);
  const searchRef = useRef(null);

  useEffect(() => {
    const q = search.trim().toLowerCase();
    if (!q) { setSuggestions([]); return; }
    const matches = SEARCH_ROUTES.filter(r =>
      r.keywords.some(k => k.includes(q) || q.includes(k)) ||
      r.label.toLowerCase().includes(q)
    );
    setSuggestions(matches.slice(0,6));
  }, [search]);

  const navigate = (page) => {
    setActivePage(page);
    setSearch('');
    setSuggestions([]);
    setShowSuggestions(false);
    setFocusedIdx(-1);
  };

  const handleKeyDown = (e) => {
    if (!suggestions.length) return;
    if (e.key === 'ArrowDown')  { e.preventDefault(); setFocusedIdx(i => Math.min(i+1, suggestions.length-1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setFocusedIdx(i => Math.max(i-1, 0)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const t = focusedIdx >= 0 ? suggestions[focusedIdx] : suggestions[0];
      if (t) navigate(t.page);
    } else if (e.key === 'Escape') { setShowSuggestions(false); setSearch(''); }
  };

  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowSuggestions(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <>
      <style>{`
        .topbar-root {
          height: 60px;
          background: var(--tb-bg);
          border-bottom: 1px solid var(--tb-border);
          display: flex;
          align-items: center;
          padding: 0 16px;
          gap: 10px;
          position: sticky;
          top: 0;
          z-index: 50;
          flex-shrink: 0;
        }
        .topbar-root::before {
          content:'';
          position:absolute; top:0; left:0; right:0; height:2px;
          background: linear-gradient(90deg, #6c5ce7, #a29bfe, #00cec9);
        }
        .topbar-menu-btn { transition: border-color 0.2s, background 0.2s; }
        .topbar-menu-btn:hover { border-color: rgba(108,92,231,0.5) !important; background: rgba(108,92,231,0.20) !important; }
        .topbar-menu-btn:hover span { background: #c4b8ff !important; }
        .topbar-icon-btn { transition: border-color 0.2s, background 0.2s; }
        .topbar-icon-btn:hover { border-color: rgba(108,92,231,0.45) !important; background: rgba(108,92,231,0.18) !important; }
        .search-suggestion-item:hover { background: rgba(108,92,231,0.12) !important; }
        @keyframes slideDown { from { opacity:0; transform: translateY(-8px); } to { opacity:1; transform: translateY(0); } }
        .dropdown-anim { animation: slideDown 0.18s ease; }
      `}</style>

      <header className="topbar-root">
        <button
          onClick={isMobile ? onMenuClick : () => setCollapsed?.(c => !c)}
          title={isMobile ? 'Open menu' : collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="topbar-menu-btn"
          style={{
            width:'34px', height:'34px', flexShrink:0,
            background: 'var(--tb-btn-bg)',
            border: '1px solid var(--tb-btn-border)',
            borderRadius:'9px', cursor:'pointer',
            display:'flex', flexDirection:'column',
            alignItems:'center', justifyContent:'center', gap:'4px',
            padding:0,
          }}
        >
          {[0,1,2].map(i => (
            <span key={i} style={{
              display:'block',
              width: i === 1 ? '10px' : '14px',
              height:'1.5px',
              background: 'var(--tb-icon-color)',
              borderRadius:'2px',
              transition:'all 0.2s',
            }} />
          ))}
        </button>

        <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', gap:2 }}>
          <h1 style={{
            fontFamily:'Outfit, sans-serif',
            fontSize:'15px', fontWeight:700,
            color: 'var(--tb-text)',
            whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
            margin:0,
          }}>
            {PAGE_TITLES[activePage] || 'Dashboard'}
          </h1>
          {!isMobile && user && (() => {
            const isSuperAdmin = normaliseRole(user.role) === 'superadmin';
            const orgDisplay = isSuperAdmin ? 'All Organizations' : orgNameFor(user);
            return (
              <div style={{
                display:'flex', alignItems:'center', gap:8,
                fontSize:11, color:'rgba(162,155,254,0.75)',
                whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
              }}>
                <span style={{ fontWeight:600 }} title={orgDisplay}>
                  {orgDisplay}
                </span>
                <span aria-hidden="true" style={{ opacity:0.5 }}>·</span>
                <span style={{
                  background:'rgba(108,92,231,0.18)',
                  color:'#c4b8ff',
                  padding:'1px 8px',
                  borderRadius:6,
                  fontWeight:700,
                  letterSpacing:0.2,
                }}>
                  {roleLabel(user.role)}
                </span>
              </div>
            );
          })()}
        </div>

        <div ref={searchRef} style={{ position:'relative', flexShrink:0 }}>
          <div style={{
            display:'flex', alignItems:'center', gap:'8px',
            padding:'7px 12px',
            background: 'var(--tb-btn-bg)',
            border:`1px solid ${showSuggestions ? '#6c5ce7' : 'var(--tb-btn-border)'}`,
            borderRadius:'9px', transition:'border-color 0.2s',
            width: isMobile ? '120px' : '220px',
          }}>
            <span style={{ fontSize:'13px', flexShrink:0 }}>🔍</span>
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setShowSuggestions(true); setFocusedIdx(-1); }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={handleKeyDown}
              placeholder={isMobile ? 'Search…' : 'Search pages… (Enter)'}
              style={{
                background:'transparent', border:'none', outline:'none',
                fontSize:'12px', color:'var(--tb-text)', width:'100%', fontFamily:'inherit',
              }}
            />
            {search && (
              <button
                onClick={() => { setSearch(''); setSuggestions([]); }}
                title="Clear search"
                style={{
                  background:'none', border:'none', cursor:'pointer',
                  color:'rgba(162,155,254,0.65)', padding:0, fontSize:'14px',
                  flexShrink:0, lineHeight:1,
                }}
              >
                ×
              </button>
            )}
            {!search && !isMobile && (
              <span style={{
                fontSize:'10px', color:'rgba(162,155,254,0.65)',
                background:'rgba(108,92,231,0.14)', padding:'1px 5px',
                borderRadius:'4px', flexShrink:0,
              }}>⌘K</span>
            )}
          </div>

          {showSuggestions && suggestions.length > 0 && (
            <div className="dropdown-anim" style={{
              position:'absolute', top:'42px', left:0, right:0,
              background:'var(--tb-bg)',
              border:'1px solid rgba(108,92,231,0.28)',
              borderRadius:'12px',
              boxShadow:'0 16px 40px rgba(0,0,0,0.5)',
              zIndex:300, overflow:'hidden',
            }}>
              <div style={{
                padding:'6px 10px 4px',
                fontSize:'10px', color:'rgba(162,155,254,0.6)',
                fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em',
              }}>
                Navigate to
              </div>
              {suggestions.map((s, i) => (
                <div
                  key={s.page}
                  onMouseDown={() => navigate(s.page)}
                  className="search-suggestion-item"
                  style={{
                    display:'flex', alignItems:'center', gap:'10px',
                    padding:'10px 12px', cursor:'pointer',
                    background: i === focusedIdx ? 'rgba(108,92,231,0.18)' : 'transparent',
                    borderLeft: i === focusedIdx ? '2px solid #6c5ce7' : '2px solid transparent',
                    transition:'all 0.1s',
                  }}
                >
                  <span style={{ fontSize:'16px' }}>{s.icon}</span>
                  <div>
                    <div style={{ fontSize:'13px', fontWeight:600, color:'var(--tb-text)' }}>{s.label}</div>
                    <div style={{ fontSize:'10px', color:'rgba(162,155,254,0.55)' }}>Press Enter to navigate</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'Switch to Light mode' : 'Switch to Dark mode'}
          aria-label="Toggle theme"
          className="topbar-icon-btn"
          style={{
            width:'36px', height:'36px', borderRadius:'9px',
            background: 'var(--tb-btn-bg)',
            border: '1px solid var(--tb-btn-border)',
            display:'flex', alignItems:'center', justifyContent:'center',
            cursor:'pointer', flexShrink:0, fontSize:'15px',
          }}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>

        <NotificationBell
          user={user}
          setActivePage={setActivePage}
          isMobile={isMobile}
          variant="dark"
        />

        <ProfileDropdown
          user={user}
          onLogout={onLogout || logout}
          isMobile={isMobile}
        />
      </header>
    </>
  );
}
