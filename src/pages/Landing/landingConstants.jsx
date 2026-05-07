import React from 'react';

export const P       = '#5a4bd1';
export const PL      = '#6c5ce7';
export const PD      = '#00cec9';
export const PBG     = '#eef2f9';
export const PBORDER = '#e9e4ff';
export const DARK    = '#0f172a';
export const MID     = '#4C6080';
export const MUTED   = '#8AACC0';

export const DEMO_ROLES = [
  { id:'superadmin', label:'Super Admin',   name:'Super Admin',  email:'superadmin@corpgms.com', password:'123456', icon:'🛡️', color:'#DC2626', bg:'#FEF2F2', border:'#FECACA', badge:'Platform',  desc:'Full platform control'    },
  { id:'director',   label:'Director',      name:'Arjun Mehta',  email:'director@corpgms.com',   password:'123456', icon:'👑', color:'#5a4bd1', bg:'#eef2f9', border:'#e9e4ff', badge:'Executive', desc:'Organisation owner'        },
  { id:'manager',    label:'Manager',       name:'Priya Sharma', email:'manager@corpgms.com',    password:'123456', icon:'🏢', color:'#059669', bg:'#ECFDF5', border:'#A7F3D0', badge:'Management', desc:'Operations & reporting'   },
  { id:'reception',  label:'Reception',     name:'Sara Khan',    email:'reception@corpgms.com',  password:'123456', icon:'🛎️', color:'#0891B2', bg:'#ECFEFF', border:'#A5F3FC', badge:'Front Desk', desc:'Guest check-in'           },
  { id:'service',    label:'Service Staff', name:'Rahul Patil',  email:'service@corpgms.com',    password:'123456', icon:'⚙️', color:'#D97706', bg:'#FFFBEB', border:'#FDE68A', badge:'Operations', desc:'Pantry, AV & logistics'  },
];

export const LM_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const PLANS_REG = [
  {
    id:'starter',
    label:'Starter',
    price:'Free',
    priceValue: 0,
    yearlyPrice: 0,
    badge:'Free Forever',
    color:'#64748B', bg:'#F8FAFC', border:'#E2E8F0', icon:'🌱',
    description:'Perfect for small offices getting started with visitor management.',
    features:[
      'Guest Log',
      'Walk-in Check-in',
      'Basic Appointments',
      'Email Notifications',
      'Basic Reports',
    ],
    maxGuests: 50,
    maxStaff: 5,
    maxOffices: 1,
  },
  {
    id:'professional',
    label:'Professional',
    price:'₹2,999',
    priceValue: 2999,
    yearlyPrice: 28799,
    badge:'Most Popular',
    color:'#5a4bd1', bg:'#eef2f9', border:'#c4b8ff', icon:'🚀',
    description:'For growing companies that need advanced features and multi-office control.',
    features:[
      'Guest Management',
      'Appointments Scheduling',
      'Staff Management',
      'Multi-Office Support',
      'WhatsApp Notifications',
      'Advanced Reports',
      'Custom Branding',
      'Room Bookings',
    ],
    maxGuests: 5000,
    maxStaff: 25,
    maxOffices: 5,
  },
  {
    id:'enterprise',
    label:'Enterprise',
    price:'₹9,999',
    priceValue: 9999,
    yearlyPrice: 95988,
    badge:'Best Value',
    color:'#7C3AED', bg:'#F5F3FF', border:'#C4B5FD', icon:'🏢',
    description:'Unlimited everything for large enterprises with multiple sites.',
    features:[
      'Unlimited Guests',
      'Unlimited Staff',
      'Unlimited Offices',
      'Single Sign-On (SSO)',
      'Dedicated Account Manager',
      'Priority Support',
      'Custom Integrations',
      'White-label',
    ],
    maxGuests: 0,
    maxStaff: 0,
    maxOffices: 0,
  },
];

export const INDUSTRIES = ['Technology','Finance & Banking','Healthcare','Manufacturing','Education','Retail & E-Commerce','Real Estate','Consulting','Government','Hospitality','Other'];
export const ORG_SIZES  = ['1–10 employees','11–50 employees','51–200 employees','201–500 employees','501–1000 employees','1000+ employees'];
export const COUNTRIES  = ['India','United States','United Kingdom','Canada','Australia','Singapore','UAE','Germany','France','Other'];

export const CITIES_BY_COUNTRY = {
  'India': [
    'Mumbai','Delhi','Bengaluru','Hyderabad','Pune','Chennai','Kolkata','Ahmedabad','Surat','Jaipur',
    'Lucknow','Kanpur','Nagpur','Indore','Thane','Bhopal','Visakhapatnam','Patna','Vadodara','Ludhiana',
    'Agra','Nashik','Faridabad','Meerut','Rajkot','Varanasi','Aurangabad','Amritsar','Navi Mumbai','Ranchi',
    'Coimbatore','Jodhpur','Madurai','Raipur','Kota','Chandigarh','Guwahati','Solapur','Mysuru','Other',
  ],
  'United States': [
    'New York','Los Angeles','Chicago','Houston','Phoenix','Philadelphia','San Antonio','San Diego','Dallas','San Jose',
    'Austin','Jacksonville','Fort Worth','Columbus','Charlotte','San Francisco','Indianapolis','Seattle','Denver','Washington D.C.',
    'Boston','Nashville','Baltimore','Oklahoma City','Las Vegas','Portland','Memphis','Louisville','Milwaukee','Albuquerque',
    'Tucson','Atlanta','Miami','Other',
  ],
  'United Kingdom': [
    'London','Birmingham','Manchester','Leeds','Glasgow','Liverpool','Edinburgh','Bristol','Sheffield','Cardiff',
    'Belfast','Newcastle','Nottingham','Leicester','Coventry','Bradford','Brighton','Southampton','Aberdeen','Dundee','Other',
  ],
  'Canada': [
    'Toronto','Montreal','Vancouver','Calgary','Edmonton','Ottawa','Winnipeg','Quebec City','Hamilton','Kitchener',
    'London','Halifax','Victoria','Windsor','Oshawa','Other',
  ],
  'Australia': [
    'Sydney','Melbourne','Brisbane','Perth','Adelaide','Gold Coast','Canberra','Newcastle','Wollongong','Hobart','Darwin','Cairns','Other',
  ],
  'Singapore': ['Singapore','Other'],
  'UAE': ['Dubai','Abu Dhabi','Sharjah','Ajman','Ras Al Khaimah','Fujairah','Other'],
  'Germany': [
    'Berlin','Hamburg','Munich','Cologne','Frankfurt','Stuttgart','Düsseldorf','Leipzig','Dortmund','Essen',
    'Bremen','Dresden','Hannover','Nuremberg','Duisburg','Other',
  ],
  'France': [
    'Paris','Marseille','Lyon','Toulouse','Nice','Nantes','Strasbourg','Montpellier','Bordeaux','Lille','Rennes','Reims','Other',
  ],
  'Other': ['Other'],
};

export const REG_INP = (err) => ({
  width:'100%', padding:'10px 13px', borderRadius:9, fontSize:13,
  fontFamily:"'Plus Jakarta Sans',sans-serif", color:DARK, outline:'none',
  border:`1.5px solid ${err ? '#EF4444' : PBORDER}`,
  background:'#FAFCFF', transition:'border-color .2s', boxSizing:'border-box',
});

export const REG_SEL = (err) => ({
  ...REG_INP(err),
  cursor:'pointer',
  appearance:'none',
  backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%238AACC0' strokeWidth='1.5' fill='none' strokeLinecap='round'/%3E%3C/svg%3E")`,
  backgroundRepeat:'no-repeat',
  backgroundPosition:'right 12px center',
  paddingRight:32,
});

export const REG_LBL = {
  display:'block', fontSize:11, fontWeight:800, letterSpacing:'0.06em',
  textTransform:'uppercase', color:'#64748B', marginBottom:5,
};

export const ErrMsg = ({ msg }) => msg
  ? <p style={{ marginTop:4, fontSize:11, fontWeight:600, color:'#EF4444' }}>{msg}</p>
  : null;
