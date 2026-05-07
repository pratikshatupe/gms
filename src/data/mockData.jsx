// NOTE: Toast and ConfirmModal used to live here — they are now canonical
// primitives at `src/components/ui/`. This module is data-only going forward.

/* ───────── LOCAL STORAGE HELPER ───────── */
export const ls = {
  get: (k, def) => {
    try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; }
  },
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
};

/* ───────── USERS — matches Login.jsx exactly ─────────
 * Identity fields (staffId/officeId/organisationId) drive role-based data
 * visibility. Super Admin uses 'all' so filters short-circuit.
 */
export const MOCK_USERS = [
  { id: 'director',   email: 'director@corpgms.com',   password: '123456', name: 'Arjun Mehta',  icon: '👑', label: 'Director',      badge: 'Executive',        color: '#0284C7', staffId: 'staff-1', organisationId: 'org-1', officeId: 'all' },
  { id: 'manager',    email: 'manager@corpgms.com',     password: '123456', name: 'Priya Sharma', icon: '🏢', label: 'Manager',       badge: 'Management',       color: '#059669', staffId: 'staff-2', organisationId: 'org-1', officeId: 'Dubai HQ' },
  { id: 'reception',  email: 'reception@corpgms.com',   password: '123456', name: 'Sara Khan',    icon: '🛎️', label: 'Reception',     badge: 'Front Desk',       color: '#0891B2', staffId: 'staff-3', organisationId: 'org-1', officeId: 'Abu Dhabi Branch' },
  { id: 'service',    email: 'service@corpgms.com',     password: '123456', name: 'Rahul Patil',  icon: '⚙️', label: 'Service Staff', badge: 'Operations',       color: '#D97706', staffId: 'staff-4', organisationId: 'org-1', officeId: 'Dubai HQ' },
  { id: 'superadmin', email: 'superadmin@corpgms.com',  password: '123456', name: 'Super Admin',  icon: '🛡️', label: 'Super Admin',   badge: 'Platform Control', color: '#DC2626', staffId: null,      organisationId: 'all',   officeId: 'all' },
];

/* ───────── ROLES & PERMISSIONS ───────── */
export const ROLES = [
  { id: 'superadmin', name: 'Super Admin',   permissions: ['all'] },
  { id: 'director',   name: 'Director',      permissions: ['all'] },
  { id: 'manager',    name: 'Manager',       permissions: ['dashboard','guest-log','walkin','appointments','rooms','staff','services','reports','notifications'] },
  { id: 'reception',  name: 'Reception',     permissions: ['dashboard','walkin','appointments','guest-log','notifications'] },
  { id: 'service',    name: 'Service Staff', permissions: ['dashboard','services','notifications'] },
];

/* ───────── ORGANISATIONS ───────── */
/*  Canonical organisation list — single source of truth for every Super
 *  Admin surface (Dashboard, Subscription, Reports). India-only entries
 *  have been removed; Mumbai / Pune tenants have been rebranded to their
 *  UAE equivalents per the product doc. */
export const MOCK_ORGANIZATIONS = [
  /* UAE (10) */
  { id: 'org-emir',  name: 'Emirates Group',        industry: 'Aviation',    location: 'Dubai, UAE',           country: 'United Arab Emirates', plan: 'Enterprise',   mrr: 8999, status: 'Active', users: 120 },
  { id: 'org-fal',   name: 'Falcon Enterprises',    industry: 'Logistics',   location: 'Abu Dhabi, UAE',       country: 'United Arab Emirates', plan: 'Enterprise',   mrr: 8999, status: 'Active', users: 96  },
  { id: 'org-zen',   name: 'Zenith Healthcare',     industry: 'Healthcare',  location: 'Sharjah, UAE',         country: 'United Arab Emirates', plan: 'Professional', mrr: 4999, status: 'Active', users: 58  },
  { id: 'org-aln',   name: 'Al Noor Education',     industry: 'Education',   location: 'Dubai, UAE',           country: 'United Arab Emirates', plan: 'Professional', mrr: 4999, status: 'Active', users: 42  },
  { id: 'org-sun',   name: 'Sunshine Hotels',       industry: 'Hospitality', location: 'Ras Al Khaimah, UAE',  country: 'United Arab Emirates', plan: 'Starter',      mrr: 1999, status: 'Active', users: 12  },
  { id: 'org-acme',  name: 'Acme Trading',          industry: 'Retail',      location: 'Sharjah, UAE',         country: 'United Arab Emirates', plan: 'Professional', mrr: 4999, status: 'Active', users: 36, settings: { checkIn: { approvalWorkflow: 'Auto', approvalTimeoutMinutes: 15 } } },
  { id: 'org-dgd',   name: 'Dubai Gold & Diamond',  industry: 'Jewellery',   location: 'Dubai, UAE',           country: 'United Arab Emirates', plan: 'Enterprise',   mrr: 8999, status: 'Active', users: 74  },
  { id: 'org-tcme',  name: 'TechCorp Middle East',  industry: 'IT',          location: 'Dubai, UAE',           country: 'United Arab Emirates', plan: 'Starter',      mrr: 1999, status: 'Active', users: 18  },
  { id: 'org-isu',   name: 'Innovate Solutions UAE',industry: 'Consulting',  location: 'Abu Dhabi, UAE',       country: 'United Arab Emirates', plan: 'Starter',      mrr: 1999, status: 'Active', users: 14  },
  { id: 'org-arab',  name: 'Arabian Oasis',         industry: 'Real Estate', location: 'Dubai, UAE',           country: 'United Arab Emirates', plan: 'Professional', mrr: 4999, status: 'Active', users: 28  },

  /* Trials (2) */
  { id: 'org-nex',   name: 'Nexus Ventures',        industry: 'Finance',     location: 'Dubai, UAE',           country: 'United Arab Emirates', plan: 'Professional', mrr: 0,    status: 'Trial',  users: 6,  trialDaysLeft: 12, settings: { checkIn: { approvalWorkflow: 'Host', approvalTimeoutMinutes: 30 } } },
  { id: 'org-oas',   name: 'Oasis Logistics',       industry: 'Logistics',   location: 'Abu Dhabi, UAE',       country: 'United Arab Emirates', plan: 'Starter',      mrr: 0,    status: 'Trial',  users: 4,  trialDaysLeft: 5  },

  /* International (3) */
  { id: 'org-mmd',   name: 'Mumbai Diamonds Pvt Ltd', industry: 'Jewellery', location: 'Mumbai, India',        country: 'India',                plan: 'Professional', mrr: 4999, status: 'Active', users: 31 },
  { id: 'org-ryh',   name: 'Riyadh Holdings',       industry: 'Investments', location: 'Riyadh, Saudi Arabia', country: 'Saudi Arabia',         plan: 'Enterprise',   mrr: 8999, status: 'Active', users: 52 },
  { id: 'org-lon',   name: 'London Advisory Ltd',   industry: 'Consulting',  location: 'London, United Kingdom', country: 'United Kingdom',     plan: 'Starter',      mrr: 1999, status: 'Active', users:  8 },
];

/* ───────── OFFICES ─────────
 * Schema v2 (2026-04-19 upgrade). The previous simple shape
 * ({ id, name, location, org, status }) has been replaced with a
 * richer domain model driven by the Offices module:
 *
 *   {
 *     id:         'OFC-XXXXX',                 // human-readable auto ID
 *     orgId:      <tenant>,                    // FK for tenant isolation
 *     name:       string (2..100),
 *     code:       string, A-Z 0-9 -, 3..20, UNIQUE per org, immutable
 *     type:       'HQ' | 'Branch' | 'Warehouse' | 'Regional Office' | 'Other',
 *     address: { line1, line2, country, state, city, postalCode },
 *     contact: { contactNumber, emailId, managerName },
 *     operations: {
 *       openTime:     'HH:mm' 24h,
 *       closeTime:    'HH:mm' 24h, strictly > openTime,
 *       workingDays:  ['Mon','Tue',...],       // at least one day
 *       timezone:     IANA e.g. 'Asia/Kolkata',
 *       maxCapacity:  number 10..10000,
 *     },
 *     status:     'Active' | 'Inactive',
 *     createdAt,  createdBy,  updatedAt,  updatedBy
 *   }
 *
 * Because the schema is incompatible, the storage key has been bumped
 * to 'cgms_offices_v2' (see src/store/keys.js). Dev browsers carrying
 * the old v1 cache automatically fall back to this seed on next read. */
export const MOCK_OFFICES = [
  {
    id:    'OFC-00001',
    orgId: 'org-acme',
    name:  'Pune Headquarters',
    code:  'PUN-HQ-01',
    type:  'HQ',
    address: {
      line1:       'Plot 42, MG Road',
      line2:       'Near Deccan Gymkhana',
      country:     'India',
      state:       'Maharashtra',
      city:        'Pune',
      postalCode:  '411001',
    },
    contact: {
      contactNumber: '+91 20 2612 3456',
      emailId:       'pune@acmetrading.com',
      managerName:   'Priya Deshmukh',
    },
    operations: {
      openTime:    '09:00',
      closeTime:   '18:00',
      workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      timezone:    'Asia/Kolkata',
      maxCapacity: 500,
    },
    status:    'Active',
    createdAt: '2026-01-15T09:10:00.000Z',
    createdBy: 'seed',
    updatedAt: '2026-01-15T09:10:00.000Z',
    updatedBy: 'seed',
  },
  {
    id:    'OFC-00002',
    orgId: 'org-acme',
    name:  'Mumbai Branch',
    code:  'MUM-BR-01',
    type:  'Branch',
    address: {
      line1:       'Level 12, Nariman Point',
      line2:       '',
      country:     'India',
      state:       'Maharashtra',
      city:        'Mumbai',
      postalCode:  '400021',
    },
    contact: {
      contactNumber: '+91 22 2204 8765',
      emailId:       'mumbai@acmetrading.com',
      managerName:   'Anil Kapoor',
    },
    operations: {
      openTime:    '09:30',
      closeTime:   '18:30',
      workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      timezone:    'Asia/Kolkata',
      maxCapacity: 250,
    },
    status:    'Active',
    createdAt: '2026-02-02T10:30:00.000Z',
    createdBy: 'seed',
    updatedAt: '2026-02-02T10:30:00.000Z',
    updatedBy: 'seed',
  },
  {
    id:    'OFC-00003',
    orgId: 'org-nex',
    name:  'Dubai Corporate Office',
    code:  'DXB-HQ-01',
    type:  'HQ',
    address: {
      line1:       'Sheikh Zayed Road, Tower 2, Level 28',
      line2:       '',
      country:     'United Arab Emirates',
      state:       'Dubai',
      city:        'Dubai',
      postalCode:  '12345',
    },
    contact: {
      contactNumber: '+971 4 123 4567',
      emailId:       'dubai@nexusventures.ae',
      managerName:   'Fatima Al Maktoum',
    },
    operations: {
      openTime:    '08:00',
      closeTime:   '17:00',
      workingDays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu'],
      timezone:    'Asia/Dubai',
      maxCapacity: 300,
    },
    status:    'Active',
    createdAt: '2026-02-20T07:45:00.000Z',
    createdBy: 'seed',
    updatedAt: '2026-02-20T07:45:00.000Z',
    updatedBy: 'seed',
  },
];

/* ───────── SUBSCRIPTION PLANS ───────── */
export const SUBSCRIPTION_PLANS = [
  {
    id: 1, name: 'Starter', price: 4999, yearlyPrice: 3999,
    desc: 'Perfect for small offices getting started with visitor management.',
    offices: 1, users: 5, visitors: '500', color: '#0891B2', featured: false,
    features: [
      { label: 'Walk-in Check-in',           included: true  },
      { label: 'Appointment Scheduling',      included: true  },
      { label: 'Basic Reports',               included: true  },
      { label: 'Email Notifications',         included: true  },
      { label: 'WhatsApp Notifications',      included: false },
      { label: 'Multi-Office Management',     included: false },
      { label: 'Advanced Analytics',          included: false },
      { label: 'Priority Support',            included: false },
    ],
  },
  {
    id: 2, name: 'Professional', price: 12999, yearlyPrice: 10399,
    desc: 'For growing companies that need advanced features and multi-office control.',
    offices: 5, users: 25, visitors: '5000', color: '#0284C7', featured: true,
    features: [
      { label: 'Walk-in Check-in',           included: true },
      { label: 'Appointment Scheduling',      included: true },
      { label: 'Advanced Reports',            included: true },
      { label: 'Email Notifications',         included: true },
      { label: 'WhatsApp Notifications',      included: true },
      { label: 'Multi-Office Management',     included: true },
      { label: 'Advanced Analytics',          included: true },
      { label: 'Priority Support',            included: false },
    ],
  },
  {
    id: 3, name: 'Enterprise', price: 24999, yearlyPrice: 19999,
    desc: 'Unlimited scale, dedicated support, and full platform control.',
    offices: 'Unlimited', users: 'Unlimited', visitors: 'Unlimited', color: '#D97706', featured: false,
    features: [
      { label: 'Walk-in Check-in',           included: true },
      { label: 'Appointment Scheduling',      included: true },
      { label: 'Advanced Reports',            included: true },
      { label: 'Email Notifications',         included: true },
      { label: 'WhatsApp Notifications',      included: true },
      { label: 'Multi-Office Management',     included: true },
      { label: 'Advanced Analytics',          included: true },
      { label: 'Priority Support',            included: true },
    ],
  },
];

/* ───────── NOTIFICATIONS (org-level, shown to non-Super-Admin roles) ───────── */
export const NOTIFICATIONS = [
  { id: 1, title: 'Visitor Check-in',  message: 'Ravi Kapoor arrived at Reception.',       time: '2 min ago',  type: 'info',    read: false },
  { id: 2, title: 'Service Completed', message: 'Tea served to Board Room A.',             time: '10 min ago', type: 'success', read: false },
  { id: 3, title: 'New Appointment',   message: 'Meeting scheduled for 2:00 PM.',          time: '30 min ago', type: 'warning', read: true  },
  { id: 4, title: 'Room Booking',      message: 'Conference Room 1 booked by Priya.',      time: '1 hr ago',   type: 'info',    read: true  },
];

/* ───────── SUPER ADMIN PLATFORM METRICS ─────────
 * Snapshot the SaaS owner sees across Dashboard and Reports. INR values
 * use en-GB locale formatting at the UI boundary. */
export const PLATFORM_METRICS = {
  /* New-shape fields driving the Super Admin Dashboard KPIs. */
  mrr:                482450,   /* INR this month */
  arr:               5789400,
  growthRate:           18.3,
  churnRate:             2.3,
  mrrChangePct:         12.0,   /* vs last month */
  lastMonthMrrDelta:  52000,
  activeOrgs:            147,
  newThisMonth:           23,
  lostThisMonth:           3,
  uptime:              99.97,
  apiResponseMs:         184,
  errorRate:            0.04,
  failedLogins:           47,
  storageUsedGB:        62.4,
  storageTotalGB:        500,

  /* Legacy fields used by SuperAdminReports — kept for backwards compat. */
  mrrPrev:       451200,
  signups:           23,
  signupsPrev:       18,
  churn:            2.3,
  churnTarget:      3.0,
  arpu:            3282,
  arpuPrev:        3070,
  orgStatus: {
    active:    12,
    trial:      2,
    suspended:  0,
    cancelled:  1,
  },
  planDistribution: [
    { plan: 'Starter',      count: 4, tone: '#10B981' },
    { plan: 'Professional', count: 6, tone: '#0EA5E9' },
    { plan: 'Enterprise',   count: 4, tone: '#D97706' },
    { plan: 'Trial',        count: 2, tone: '#2563EB' },
  ],
  platformUsage: {
    visitors:       38420,
    appointments:   14620,
    peakHour:       '10:00 AM',
    apiCalls:       1284210,
    storageUsedGb:    62.4,
    storageQuotaGb:    500,
  },
  platformHealth: {
    uptime:          99.97,
    uptimeTarget:    99.90,
    avgResponseMs:     184,
    responseTarget:    200,
    errorRate:        0.04,
    errorTarget:       1.0,
    failedLogins:        47,
  },
};

/* MRR line — last 6 months of platform-wide recurring revenue + active-org count. */
export const MRR_HISTORY = [
  { month: 'Nov', mrr: 310000, activeOrgs:  92 },
  { month: 'Dec', mrr: 340000, activeOrgs: 103 },
  { month: 'Jan', mrr: 380000, activeOrgs: 118 },
  { month: 'Feb', mrr: 412000, activeOrgs: 127 },
  { month: 'Mar', mrr: 454000, activeOrgs: 138 },
  { month: 'Apr', mrr: 482450, activeOrgs: 147 },
];

/* Critical alerts — each block is shown as a colour-coded card if its count > 0. */
export const CRITICAL_ALERTS = {
  failedPayments: { count: 3, amountAed: 12490, orgs: ['Acme Trading', 'Dubai Gold & Diamond', 'Mumbai Diamonds Pvt Ltd'] },
  trialsExpiring: { count: 2,                    orgs: ['Nexus Ventures', 'Oasis Logistics']                          },
  renewalRisks:   { count: 2,                    orgs: ['Sunshine Hotels', 'London Advisory Ltd']                      },
};

/* Ten-event recent activity feed shown in the dashboard footer row. */
export const PLATFORM_ACTIVITY = [
  { type: 'signup',   org: 'Nexus Ventures',         detail: 'signed up for Professional Trial', at: '2 min ago' },
  { type: 'payment',  org: 'Emirates Group',         detail: 'payment successful — ₹8,999',   at: '15 min ago' },
  { type: 'failed',   org: 'Acme Trading',           detail: 'payment failed — retry scheduled', at: '1 hr ago' },
  { type: 'upgrade',  org: 'Falcon Enterprises',     detail: 'upgraded Starter → Professional',  at: '3 hr ago' },
  { type: 'cancel',   org: 'London Advisory Ltd',    detail: 'cancelled subscription',           at: 'Yesterday' },
  { type: 'signup',   org: 'Oasis Logistics',        detail: 'signed up for Starter Trial',      at: 'Yesterday' },
  { type: 'payment',  org: 'Falcon Enterprises',     detail: 'payment successful — ₹8,999',   at: '2 days ago' },
  { type: 'upgrade',  org: 'Zenith Healthcare',      detail: 'upgraded to Professional yearly',  at: '3 days ago' },
  { type: 'failed',   org: 'Mumbai Diamonds',        detail: 'payment failed — 2nd attempt',     at: '4 days ago' },
  { type: 'signup',   org: 'Arabian Oasis',          detail: 'signed up for Professional',       at: '5 days ago' },
];

/* Platform-wide geographic distribution — counts and percentages of active orgs. */
export const GEO_DISTRIBUTION = [
  { country: 'United Arab Emirates', code: 'AE', flag: '🇦🇪', count: 112, pct: 76 },
  { country: 'India',                code: 'IN', flag: '🇮🇳', count:  24, pct: 16 },
  { country: 'Saudi Arabia',         code: 'SA', flag: '🇸🇦', count:   8, pct:  5 },
  { country: 'United Kingdom',       code: 'GB', flag: '🇬🇧', count:   2, pct:  1 },
  { country: 'Others',               code: '',   flag: '🌍', count:   1, pct:  2 },
];

/* Seeded support tickets — used by the Admin Organisations Management
 * module. Every row references an org by name so filtering lines up. */
export const SUPPORT_TICKETS = [
  { id: 'TCK-2041', org: 'Emirates Group',        subject: 'SSO redirect loops after Okta rollout',            priority: 'High',   status: 'Open',        created: '2026-04-18T08:15:00Z' },
  { id: 'TCK-2042', org: 'Acme Trading',          subject: 'Invoice not generated for March cycle',             priority: 'High',   status: 'Open',        created: '2026-04-17T14:30:00Z' },
  { id: 'TCK-2043', org: 'Falcon Enterprises',    subject: 'API rate-limit too strict during import',           priority: 'Normal', status: 'In Progress', created: '2026-04-16T10:05:00Z' },
  { id: 'TCK-2044', org: 'Zenith Healthcare',     subject: 'WhatsApp template pending approval',                priority: 'Normal', status: 'In Progress', created: '2026-04-15T09:45:00Z' },
  { id: 'TCK-2045', org: 'Sunshine Hotels',       subject: 'How to export audit logs as PDF?',                  priority: 'Low',    status: 'Open',        created: '2026-04-15T06:20:00Z' },
  { id: 'TCK-2046', org: 'Dubai Gold & Diamond',  subject: 'Custom branding colour update',                     priority: 'Low',    status: 'Resolved',    created: '2026-04-12T11:10:00Z' },
  { id: 'TCK-2047', org: 'Al Noor Education',     subject: 'Bulk invite spreadsheet format',                    priority: 'Normal', status: 'Resolved',    created: '2026-04-10T13:00:00Z' },
  { id: 'TCK-2048', org: 'Nexus Ventures',        subject: 'Trial extension request',                           priority: 'Normal', status: 'Open',        created: '2026-04-19T07:30:00Z' },
  { id: 'TCK-2049', org: 'Mumbai Diamonds Pvt Ltd', subject: 'Card payment declined repeatedly',                 priority: 'High',   status: 'In Progress', created: '2026-04-18T16:40:00Z' },
  { id: 'TCK-2050', org: 'Arabian Oasis',         subject: 'Multi-office reporting shows wrong totals',         priority: 'Normal', status: 'Resolved',    created: '2026-04-08T10:00:00Z' },
];

/* Top-10 organisations by MRR — read from MOCK_ORGANIZATIONS so the two
 * surfaces never drift, with a stable fallback when no orgs are configured. */
export const PLATFORM_TOP_ORGS = MOCK_ORGANIZATIONS
  .filter((o) => o.status !== 'Trial')
  .slice()
  .sort((a, b) => (Number(b.mrr) || 0) - (Number(a.mrr) || 0))
  .slice(0, 10);

/* ───────── SUPER ADMIN PLATFORM NOTIFICATIONS ─────────
 * Platform-level events that only the SaaS owner (Super Admin) sees.
 * Each row carries `category` (Tenants/Billing/Security/Support) and
 * `severity` (critical/warning/info). India org names + INR amounts
 * keep the demo consistent with the product doc. */
export const SUPER_ADMIN_NOTIFICATIONS = [
  /* Tenants */
  { id: 'sa-1',  category: 'Tenants',  severity: 'info',     title: 'New organisation registered', message: 'Falcon Group started a 14-day trial on the Professional plan.',               entity: 'Falcon Group',        time: '3 min ago',  timestamp: '2026-04-19T09:12:00Z', read: false, status: 'Unread' },
  { id: 'sa-2',  category: 'Tenants',  severity: 'warning',  title: 'Trial expiring in 3 days',    message: 'Sunshine Hotels trial ends 22 April 2026 — no card on file.',                 entity: 'Sunshine Hotels',     time: '25 min ago', timestamp: '2026-04-19T08:50:00Z', read: false, status: 'Unread' },
  { id: 'sa-3',  category: 'Tenants',  severity: 'info',     title: 'Plan upgrade',                 message: 'Zenith Ltd upgraded from Starter to Professional (monthly).',                 entity: 'Zenith Ltd',          time: '1 hr ago',   timestamp: '2026-04-19T08:15:00Z', read: false, status: 'Unread' },
  { id: 'sa-4',  category: 'Tenants',  severity: 'warning',  title: 'Subscription cancelled',       message: 'Acme UAE cancelled Enterprise subscription — reason: cost.',                   entity: 'Acme UAE',            time: '2 hr ago',   timestamp: '2026-04-19T07:00:00Z', read: true,  status: 'Actioned' },
  { id: 'sa-5',  category: 'Tenants',  severity: 'info',     title: 'Plan downgrade',               message: 'Emirates Tech moved from Professional to Starter for the next billing cycle.', entity: 'Emirates Tech',       time: '4 hr ago',   timestamp: '2026-04-19T05:10:00Z', read: true,  status: 'Actioned' },

  /* Billing */
  { id: 'sa-6',  category: 'Billing',  severity: 'info',     title: 'Payment successful',           message: 'Zenith Ltd · ₹3,990 · Professional (yearly renewal).',                      entity: 'Zenith Ltd',          time: '15 min ago', timestamp: '2026-04-19T09:00:00Z', read: false, status: 'Unread' },
  { id: 'sa-7',  category: 'Billing',  severity: 'critical', title: 'Payment failed',               message: 'Falcon Group card ending 4242 declined. Retry #2 of 3 scheduled for 21 April.', entity: 'Falcon Group',        time: '40 min ago', timestamp: '2026-04-19T08:35:00Z', read: false, status: 'Unread' },
  { id: 'sa-8',  category: 'Billing',  severity: 'info',     title: 'Invoice generated',            message: 'INV-2026-0412 for Acme UAE · ₹79,800 · due 25 April 2026.',                 entity: 'Acme UAE',            time: '3 hr ago',   timestamp: '2026-04-19T06:00:00Z', read: true,  status: 'Actioned' },
  { id: 'sa-9',  category: 'Billing',  severity: 'warning',  title: 'Renewal upcoming',             message: 'Sunshine Hotels renewal on 30 April — ₹2,990 will be charged.',             entity: 'Sunshine Hotels',     time: '6 hr ago',   timestamp: '2026-04-19T03:15:00Z', read: true,  status: 'Actioned' },
  { id: 'sa-10', category: 'Billing',  severity: 'info',     title: 'Refund processed',             message: '₹450 refunded to Emirates Tech for partial month (plan change).',           entity: 'Emirates Tech',       time: '1 day ago',  timestamp: '2026-04-18T09:05:00Z', read: true,  status: 'Actioned' },
  { id: 'sa-11', category: 'Billing',  severity: 'critical', title: 'Chargeback received',          message: '₹7,990 chargeback from Palm Consulting (case #CB-2287). Evidence due 26 April.', entity: 'Palm Consulting', time: '2 days ago', timestamp: '2026-04-17T10:20:00Z', read: false, status: 'Unread' },

  /* Security */
  { id: 'sa-12', category: 'Security', severity: 'warning',  title: 'Unusual login activity',       message: 'Director login for Zenith Ltd from new country (UK). Requires review.',         entity: 'Zenith Ltd',          time: '22 min ago', timestamp: '2026-04-19T08:52:00Z', read: false, status: 'Unread' },
  { id: 'sa-13', category: 'Security', severity: 'critical', title: 'Failed login spike',           message: 'Falcon Group saw 48 failed logins in 10 minutes — likely credential stuffing.',  entity: 'Falcon Group',        time: '1 hr ago',   timestamp: '2026-04-19T08:12:00Z', read: false, status: 'Unread' },
  { id: 'sa-14', category: 'Security', severity: 'warning',  title: 'Storage >80%',                 message: 'Acme UAE is using 82% of 10 GB storage quota.',                                entity: 'Acme UAE',            time: '3 hr ago',   timestamp: '2026-04-19T06:45:00Z', read: true,  status: 'Actioned' },
  { id: 'sa-15', category: 'Security', severity: 'critical', title: 'Service downtime detected',    message: 'API latency >5s for 4 minutes in ap-south-1. Auto-recovered.',                 entity: 'Platform',            time: '5 hr ago',   timestamp: '2026-04-19T04:30:00Z', read: true,  status: 'Actioned' },
  { id: 'sa-16', category: 'Security', severity: 'warning',  title: 'API error rate elevated',      message: 'Error rate 2.1% on /appointments endpoint — threshold 1%.',                    entity: 'Platform',            time: '7 hr ago',   timestamp: '2026-04-19T02:18:00Z', read: true,  status: 'Actioned' },

  /* Support */
  { id: 'sa-17', category: 'Support',  severity: 'critical', title: 'New support ticket · High',    message: 'Acme UAE cannot generate invoices — all Director accounts blocked.',           entity: 'Acme UAE',            time: '8 min ago',  timestamp: '2026-04-19T09:07:00Z', read: false, status: 'Unread' },
  { id: 'sa-18', category: 'Support',  severity: 'info',     title: 'New support ticket · Normal',  message: 'Falcon Group asks how to export audit logs as PDF.',                           entity: 'Falcon Group',        time: '50 min ago', timestamp: '2026-04-19T08:25:00Z', read: false, status: 'Unread' },
  { id: 'sa-19', category: 'Support',  severity: 'warning',  title: 'GDPR deletion request',        message: 'Emirates Tech requested deletion of ex-employee Samer Al Hassan (EID #3412).', entity: 'Emirates Tech',       time: '2 hr ago',   timestamp: '2026-04-19T07:15:00Z', read: false, status: 'Unread' },
  { id: 'sa-20', category: 'Support',  severity: 'info',     title: 'Customer feedback',            message: 'Zenith Ltd rated onboarding 5/5 — "WhatsApp alerts changed our front desk".', entity: 'Zenith Ltd',          time: '1 day ago',  timestamp: '2026-04-18T11:40:00Z', read: true,  status: 'Actioned' },
];

/* ───────── VISITORS ───────── */
export const MOCK_VISITORS = [
  { id: 1, name: 'Ravi Kapoor',     company: 'TechCorp',       phone: '+971 50 987 6543', email: 'ravi@techcorp.com',   type: 'Appointment', status: 'inside',       checkIn: '09:15 AM', host: 'Arjun Mehta',  office: 'Dubai HQ',         purpose: 'Business Meeting'       },
  { id: 2, name: 'Meera Joshi',     company: 'Innovate',       phone: '+971 50 111 2233', email: 'meera@innovate.com',  type: 'Appointment', status: 'checked-out',  checkIn: '10:00 AM', checkOut: '11:30 AM', host: 'Priya Sharma', office: 'Dubai HQ',         purpose: 'Consultation'           },
  { id: 3, name: 'Vikram Singh',    company: 'Freelancer',     phone: '+971 55 444 5566', email: 'vikram@mail.com',     type: 'Walk-in',     status: 'inside',       checkIn: '10:30 AM', host: 'Arjun Mehta',  office: 'Abu Dhabi Branch', purpose: 'Site Visit'             },
  { id: 4, name: 'Ahmed Al Rashid', company: 'Emirates Group', phone: '+971 50 123 4567', email: 'ahmed@emirates.com',  type: 'Appointment', status: 'expected',     checkIn: '02:00 PM', host: 'Arjun Mehta',  office: 'Dubai Office',     purpose: 'Partnership Discussion' },
  { id: 5, name: 'Sarah Johnson',   company: 'McKinsey & Co',  phone: '+971 55 987 6543', email: 'sarah@mckinsey.com',  type: 'Walk-in',     status: 'checked-out',  checkIn: '09:00 AM', checkOut: '10:45 AM', host: 'Priya Sharma', office: 'Sharjah Branch',   purpose: 'Product Demo'           },
];

/* ───────── ROOMS ───────── */
/* Schema v1 (2026-04-19 upgrade). Previous simple shape
 * ({ id, name, capacity, status, floor, amenities }) replaced with
 * a tenant-aware, office-scoped model driven by the Rooms module:
 *
 *   {
 *     id:         'ROOM-XXXXX',
 *     orgId:      <tenant>,
 *     officeId:   <office FK, inherits tenant via the parent office>,
 *     name:       string (2..100),
 *     code:       string, A-Z 0-9 -, 3..20, UNIQUE per office, immutable,
 *     type:       enum (Conference Room | Meeting Room | Cabin | Training Room | Lobby | Cafeteria | Other),
 *     floor:      string (1..10) — free text (e.g. Ground, 1st, Mezzanine),
 *     seatingCapacity: number (1..500),
 *     amenities:  array of strings from the canonical amenity list,
 *     bookableByVisitors: boolean,
 *     bookingRules: {
 *       minBookingMinutes, maxBookingMinutes,
 *       requiresApproval, advanceBookingDays,
 *     },
 *     status:      'Active' | 'Inactive' | 'Under Maintenance',
 *     description, imageUrl,
 *     createdAt, createdBy, updatedAt, updatedBy
 *   }
 *
 * Storage key bumped to 'cgms_rooms_v1' (see src/store/keys.js) so
 * dev browsers auto-fall back to this seed instead of reading the
 * now-incompatible v0 payload. */
export const MOCK_ROOMS = [
  {
    id: 'ROOM-00001',
    orgId: 'org-acme', officeId: 'OFC-00001',
    name: 'Conference Room A', code: 'CONF-A',
    type: 'Conference Room', floor: '2nd',
    seatingCapacity: 12,
    amenities: ['Projector', 'Whiteboard', 'Video Conferencing', 'Air Conditioning', 'Wi-Fi'],
    bookableByVisitors: true,
    bookingRules: { minBookingMinutes: 30, maxBookingMinutes: 240, requiresApproval: false, advanceBookingDays: 7 },
    status: 'Active',
    description: 'Primary conference room for client meetings and presentations.',
    imageUrl: '',
    createdAt: '2026-01-16T09:10:00.000Z', createdBy: 'seed',
    updatedAt: '2026-01-16T09:10:00.000Z', updatedBy: 'seed',
  },
  {
    id: 'ROOM-00002',
    orgId: 'org-acme', officeId: 'OFC-00001',
    name: 'Meeting Room 1', code: 'MTG-01',
    type: 'Meeting Room', floor: '1st',
    seatingCapacity: 6,
    amenities: ['Whiteboard', 'TV Screen', 'Wi-Fi'],
    bookableByVisitors: true,
    bookingRules: { minBookingMinutes: 30, maxBookingMinutes: 240, requiresApproval: false, advanceBookingDays: 7 },
    status: 'Active',
    description: '',
    imageUrl: '',
    createdAt: '2026-01-16T09:12:00.000Z', createdBy: 'seed',
    updatedAt: '2026-01-16T09:12:00.000Z', updatedBy: 'seed',
  },
  {
    id: 'ROOM-00003',
    orgId: 'org-acme', officeId: 'OFC-00001',
    name: 'CEO Cabin', code: 'CAB-01',
    type: 'Cabin', floor: '3rd',
    seatingCapacity: 4,
    amenities: ['Air Conditioning', 'Coffee Machine'],
    bookableByVisitors: false,
    bookingRules: { minBookingMinutes: 30, maxBookingMinutes: 240, requiresApproval: false, advanceBookingDays: 7 },
    status: 'Active',
    description: 'Executive cabin, restricted access.',
    imageUrl: '',
    createdAt: '2026-01-16T09:14:00.000Z', createdBy: 'seed',
    updatedAt: '2026-01-16T09:14:00.000Z', updatedBy: 'seed',
  },
  {
    id: 'ROOM-00004',
    orgId: 'org-acme', officeId: 'OFC-00002',
    name: 'Boardroom', code: 'BOARD-01',
    type: 'Conference Room', floor: '12th',
    seatingCapacity: 16,
    amenities: ['Projector', 'Whiteboard', 'Video Conferencing', 'Air Conditioning', 'Wi-Fi', 'TV Screen'],
    bookableByVisitors: true,
    bookingRules: { minBookingMinutes: 30, maxBookingMinutes: 240, requiresApproval: true, advanceBookingDays: 7 },
    status: 'Active',
    description: '',
    imageUrl: '',
    createdAt: '2026-02-03T10:30:00.000Z', createdBy: 'seed',
    updatedAt: '2026-02-03T10:30:00.000Z', updatedBy: 'seed',
  },
  {
    id: 'ROOM-00005',
    orgId: 'org-acme', officeId: 'OFC-00002',
    name: 'Training Hall', code: 'TRN-01',
    type: 'Training Room', floor: '11th',
    seatingCapacity: 30,
    amenities: ['Projector', 'Whiteboard', 'Air Conditioning', 'Wi-Fi', 'Speaker Phone'],
    bookableByVisitors: true,
    bookingRules: { minBookingMinutes: 30, maxBookingMinutes: 240, requiresApproval: false, advanceBookingDays: 7 },
    status: 'Under Maintenance',
    description: '',
    imageUrl: '',
    createdAt: '2026-02-03T10:32:00.000Z', createdBy: 'seed',
    updatedAt: '2026-02-03T10:32:00.000Z', updatedBy: 'seed',
  },
  {
    id: 'ROOM-00006',
    orgId: 'org-nex', officeId: 'OFC-00003',
    name: 'Executive Suite', code: 'EXEC-01',
    type: 'Conference Room', floor: '28th',
    seatingCapacity: 20,
    amenities: ['Projector', 'Video Conferencing', 'Air Conditioning', 'Wi-Fi'],
    bookableByVisitors: true,
    bookingRules: { minBookingMinutes: 30, maxBookingMinutes: 240, requiresApproval: false, advanceBookingDays: 7 },
    status: 'Active',
    description: '',
    imageUrl: '',
    createdAt: '2026-02-21T08:00:00.000Z', createdBy: 'seed',
    updatedAt: '2026-02-21T08:00:00.000Z', updatedBy: 'seed',
  },
];

/* ───────── STAFF ─────────
 * Schema v1 (2026-04-19 upgrade). Previous shape had a flat
 * { id, name, role, email, phone, status, office, orgId } record;
 * the Director-owned Staff module CRUDs a richer domain model:
 *
 *   {
 *     id:         'USR-XXXXX',                 // human-readable auto ID
 *     orgId:      <tenant>,                    // FK
 *     officeId:   <office FK>,                 // user's primary office
 *     fullName:   string (2..100),
 *     name:       legacy alias for fullName — remove in Module 3 refactor
 *     emailId:    valid email, UNIQUE per org, becomes the login
 *     contactNumber:    string ("+<code> <local>"),
 *     dateOfBirth: optional 'YYYY-MM-DD' (past),
 *     gender:     'Male' | 'Female' | 'Other' | '',
 *     designation: string (2..50),
 *     employeeId:  string (3..20), UNIQUE per org, case-insensitive,
 *     role:       matrix role key ('Director' | 'Manager' | …),
 *     reportingToUserId: optional FK to another staff row,
 *     joiningDate:     'YYYY-MM-DD' (-5y .. +90d),
 *     accessStatus:    'Invited' | 'Pending' | 'Active' | 'Inactive',
 *     tempPassword:    plain text in mock store; null once changed,
 *     mustChangePassword: boolean,
 *     status:     'Active' | 'Inactive',       // employment status
 *     createdAt, createdBy, updatedAt, updatedBy
 *   }
 *
 * Storage key bumped to 'cgms_staff_v1' so dev browsers carrying the
 * v0 payload fall back to this seed. Demo login emails are preserved
 * verbatim so "log in as Arjun Mehta" keeps working against the
 * existing hard-coded demo users in Login.jsx.
 *
 * Role values use the matrix form ('Director', 'Manager', 'Reception',
 * 'Service Staff') rather than the lowercase auth form — the matrix
 * form is what Roles & Permissions displays and what the UI needs. */
export const MOCK_STAFF = [
  {
    id: 'USR-00001', orgId: 'org-acme', officeId: 'OFC-00001',
    fullName: 'Arjun Mehta', name: 'Arjun Mehta',
    emailId: 'director@corpgms.com', contactNumber: '+91 98200 11111',
    dateOfBirth: '1985-03-12', gender: 'Male',
    designation: 'Director of Operations', employeeId: 'ACM-001',
    role: 'Director', reportingToUserId: null,
    joiningDate: '2022-04-01',
    accessStatus: 'Active', tempPassword: null, mustChangePassword: false,
    status: 'Active',
    createdAt: '2022-04-01T09:00:00.000Z', createdBy: 'seed',
    updatedAt: '2022-04-01T09:00:00.000Z', updatedBy: 'seed',
  },
  {
    id: 'USR-00002', orgId: 'org-acme', officeId: 'OFC-00001',
    fullName: 'Priya Sharma', name: 'Priya Sharma',
    emailId: 'manager@corpgms.com', contactNumber: '+91 98200 22222',
    dateOfBirth: '1989-07-22', gender: 'Female',
    designation: 'Office Manager', employeeId: 'ACM-002',
    role: 'Manager', reportingToUserId: 'USR-00001',
    joiningDate: '2022-06-15',
    accessStatus: 'Active', tempPassword: null, mustChangePassword: false,
    status: 'Active',
    createdAt: '2022-06-15T09:00:00.000Z', createdBy: 'seed',
    updatedAt: '2022-06-15T09:00:00.000Z', updatedBy: 'seed',
  },
  {
    id: 'USR-00003', orgId: 'org-acme', officeId: 'OFC-00002',
    fullName: 'Sara Khan', name: 'Sara Khan',
    emailId: 'reception@corpgms.com', contactNumber: '+91 98200 33333',
    dateOfBirth: '1994-11-03', gender: 'Female',
    designation: 'Front Desk Executive', employeeId: 'ACM-003',
    role: 'Reception', reportingToUserId: 'USR-00002',
    joiningDate: '2023-01-10',
    accessStatus: 'Active', tempPassword: null, mustChangePassword: false,
    status: 'Active',
    createdAt: '2023-01-10T09:00:00.000Z', createdBy: 'seed',
    updatedAt: '2023-01-10T09:00:00.000Z', updatedBy: 'seed',
  },
  {
    id: 'USR-00004', orgId: 'org-acme', officeId: 'OFC-00001',
    fullName: 'Rahul Patil', name: 'Rahul Patil',
    emailId: 'service@corpgms.com', contactNumber: '+91 98200 44444',
    dateOfBirth: '1992-05-19', gender: 'Male',
    designation: 'Facility Executive', employeeId: 'ACM-004',
    role: 'Service Staff', reportingToUserId: 'USR-00002',
    joiningDate: '2023-03-05',
    accessStatus: 'Active', tempPassword: null, mustChangePassword: false,
    status: 'Active',
    createdAt: '2023-03-05T09:00:00.000Z', createdBy: 'seed',
    updatedAt: '2023-03-05T09:00:00.000Z', updatedBy: 'seed',
  },
  {
    id: 'USR-00005', orgId: 'org-acme', officeId: 'OFC-00002',
    fullName: 'Anita Desai', name: 'Anita Desai',
    emailId: 'anita.desai@acmetrading.com', contactNumber: '+91 98200 55555',
    dateOfBirth: '1990-09-27', gender: 'Female',
    designation: 'Branch Manager', employeeId: 'ACM-005',
    role: 'Manager', reportingToUserId: 'USR-00001',
    joiningDate: '2024-08-12',
    accessStatus: 'Active', tempPassword: null, mustChangePassword: false,
    status: 'Active',
    createdAt: '2024-08-12T09:00:00.000Z', createdBy: 'seed',
    updatedAt: '2024-08-12T09:00:00.000Z', updatedBy: 'seed',
  },
  {
    id: 'USR-00006', orgId: 'org-acme', officeId: 'OFC-00002',
    fullName: 'Kamal Singh', name: 'Kamal Singh',
    emailId: 'kamal.singh@acmetrading.com', contactNumber: '+91 98200 66666',
    dateOfBirth: '1996-02-14', gender: 'Male',
    designation: 'Facility Assistant', employeeId: 'ACM-006',
    role: 'Service Staff', reportingToUserId: 'USR-00005',
    joiningDate: '2025-11-20',
    accessStatus: 'Active', tempPassword: null, mustChangePassword: false,
    status: 'Active',
    createdAt: '2025-11-20T09:00:00.000Z', createdBy: 'seed',
    updatedAt: '2025-11-20T09:00:00.000Z', updatedBy: 'seed',
  },
  /* Nexus Ventures — tenant isolation test rows. */
  {
    id: 'USR-00007', orgId: 'org-nex', officeId: 'OFC-00003',
    fullName: 'Fatima Al Zaabi', name: 'Fatima Al Zaabi',
    emailId: 'fatima.alzaabi@nexusventures.ae', contactNumber: '+971 50 100 0001',
    dateOfBirth: '1987-12-01', gender: 'Female',
    designation: 'Head of Finance', employeeId: 'NEX-001',
    role: 'Director', reportingToUserId: null,
    joiningDate: '2022-07-01',
    accessStatus: 'Active', tempPassword: null, mustChangePassword: false,
    status: 'Active',
    createdAt: '2022-07-01T07:00:00.000Z', createdBy: 'seed',
    updatedAt: '2022-07-01T07:00:00.000Z', updatedBy: 'seed',
  },
  {
    id: 'USR-00008', orgId: 'org-nex', officeId: 'OFC-00003',
    fullName: 'Hassan Al Maktoum', name: 'Hassan Al Maktoum',
    emailId: 'hassan.am@nexusventures.ae', contactNumber: '+971 50 100 0002',
    dateOfBirth: '1993-04-18', gender: 'Male',
    designation: 'Reception Lead', employeeId: 'NEX-002',
    role: 'Reception', reportingToUserId: 'USR-00007',
    joiningDate: '2024-09-05',
    accessStatus: 'Active', tempPassword: null, mustChangePassword: false,
    status: 'Active',
    createdAt: '2024-09-05T07:00:00.000Z', createdBy: 'seed',
    updatedAt: '2024-09-05T07:00:00.000Z', updatedBy: 'seed',
  },
];

/* ───────── APPOINTMENTS ─────────
 * Module 3 (v1) consolidated the Appointments mock data in
 * src/data/mockAppointments.js to eliminate the duplicate-export bug
 * (two files exporting MOCK_APPOINTMENTS with different shapes).
 *
 * This file re-exports MOCK_APPOINTMENTS from the canonical source so
 * any caller still doing `import { MOCK_APPOINTMENTS } from '../../data/mockData'`
 * continues to work. Also re-exports stampLegacyAliases so mutation
 * helpers in the new module can stay DRY. */
export { MOCK_APPOINTMENTS, stampLegacyAliases } from './mockAppointments';

/* ───────── WALK-INS ───────── */
export const MOCK_WALKINS = [
  { id: 1, name: 'Vikram Singh', company: 'Freelancer',   phone: '+971 55 444 5566', purpose: 'Meeting',   checkIn: '10:30 AM', status: 'inside',      host: 'Arjun Mehta',  badge: 'W-001' },
  { id: 2, name: 'Neha Gupta',   company: 'Startup Co',   phone: '+971 56 123 4567', purpose: 'Interview', checkIn: '11:00 AM', status: 'inside',      host: 'Priya Sharma', badge: 'W-002' },
  { id: 3, name: 'Suresh Nair',  company: 'Self',         phone: '+971 52 222 3344', purpose: 'Delivery',  checkIn: '09:45 AM', status: 'checked-out', host: 'Sara Khan',    badge: 'W-003' },
  { id: 4, name: 'Anita Desai',  company: 'BizSolutions', phone: '+971 54 987 6543', purpose: 'Site Visit',checkIn: '08:30 AM', status: 'checked-out', host: 'Arjun Mehta',  badge: 'W-004' },
];

/* ───────── SERVICES ─────────
 * Schema v1 (2026-04-19 upgrade). The previous shape — a log of
 * individual service *requests* linked to specific visitors — has
 * been replaced with a catalogue of service *definitions* that
 * appointments and walk-ins reference. The Director-owned Services
 * module CRUDs this catalogue; the per-visit execution/status log
 * lives in the Appointments module.
 *
 *   {
 *     id:         'SVC-XXXXX',
 *     orgId:      <tenant>,
 *     name:       string (2..50),
 *     code:       string, A-Z 0-9 -, 3..20, UNIQUE per org,
 *     category:   'Refreshment' | 'IT Support' | 'Facility' |
 *                 'Administrative' | 'Other',
 *     icon:       single-emoji string (validated by grapheme count),
 *     estimatedTimeMinutes: 1..120,
 *     chargeable: boolean,
 *     price:      number 0..999,999, required if chargeable,
 *     priceUnit:  'flat' | 'per page' | 'per hour' | 'per minute',
 *     availableOfficeIds: array of office IDs (min 1),
 *     assignedStaffIds:   array of user IDs (optional — wired once
 *                         the Staff module ships),
 *     status:     'Active' | 'Inactive',
 *     description, createdAt, createdBy, updatedAt, updatedBy
 *   }
 *
 * Storage key bumped to 'cgms_services_v1' so dev browsers holding
 * the v0 payload fall back to this seed automatically. */
export const MOCK_SERVICES = [
  {
    id: 'SVC-00001', orgId: 'org-acme',
    name: 'Tea', code: 'TEA-01', category: 'Refreshment', icon: '☕',
    estimatedTimeMinutes: 3,
    chargeable: false, price: 0, priceUnit: 'flat',
    availableOfficeIds: ['OFC-00001', 'OFC-00002'],
    assignedStaffIds: [],
    status: 'Active',
    description: 'Complimentary masala chai and plain tea.',
    createdAt: '2026-01-16T09:10:00.000Z', createdBy: 'seed',
    updatedAt: '2026-01-16T09:10:00.000Z', updatedBy: 'seed',
  },
  {
    id: 'SVC-00002', orgId: 'org-acme',
    name: 'Coffee', code: 'COF-01', category: 'Refreshment', icon: '☕',
    estimatedTimeMinutes: 3,
    chargeable: false, price: 0, priceUnit: 'flat',
    availableOfficeIds: ['OFC-00001', 'OFC-00002'],
    assignedStaffIds: [],
    status: 'Active',
    description: 'Freshly brewed filter coffee and cappuccino.',
    createdAt: '2026-01-16T09:12:00.000Z', createdBy: 'seed',
    updatedAt: '2026-01-16T09:12:00.000Z', updatedBy: 'seed',
  },
  {
    id: 'SVC-00003', orgId: 'org-acme',
    name: 'Water', code: 'WTR-01', category: 'Refreshment', icon: '💧',
    estimatedTimeMinutes: 1,
    chargeable: false, price: 0, priceUnit: 'flat',
    availableOfficeIds: ['OFC-00001', 'OFC-00002'],
    assignedStaffIds: [],
    status: 'Active',
    description: '',
    createdAt: '2026-01-16T09:14:00.000Z', createdBy: 'seed',
    updatedAt: '2026-01-16T09:14:00.000Z', updatedBy: 'seed',
  },
  {
    id: 'SVC-00004', orgId: 'org-acme',
    name: 'Printing', code: 'PRNT-01', category: 'IT Support', icon: '🖨',
    estimatedTimeMinutes: 5,
    chargeable: true, price: 5, priceUnit: 'per page',
    availableOfficeIds: ['OFC-00001'],
    assignedStaffIds: [],
    status: 'Active',
    description: 'A4 black and white printing for visitor documents.',
    createdAt: '2026-01-17T10:30:00.000Z', createdBy: 'seed',
    updatedAt: '2026-01-17T10:30:00.000Z', updatedBy: 'seed',
  },
  {
    id: 'SVC-00005', orgId: 'org-acme',
    name: 'Parking', code: 'PARK-01', category: 'Facility', icon: '🅿️',
    estimatedTimeMinutes: 2,
    chargeable: true, price: 50, priceUnit: 'per hour',
    availableOfficeIds: ['OFC-00001', 'OFC-00002'],
    assignedStaffIds: [],
    status: 'Active',
    description: '',
    createdAt: '2026-01-17T10:35:00.000Z', createdBy: 'seed',
    updatedAt: '2026-01-17T10:35:00.000Z', updatedBy: 'seed',
  },
  {
    id: 'SVC-00006', orgId: 'org-nex',
    name: 'Valet Parking', code: 'VALET-01', category: 'Facility', icon: '🚗',
    estimatedTimeMinutes: 3,
    chargeable: true, price: 75, priceUnit: 'per hour',
    availableOfficeIds: ['OFC-00003'],
    assignedStaffIds: [],
    status: 'Active',
    description: '',
    createdAt: '2026-02-21T08:10:00.000Z', createdBy: 'seed',
    updatedAt: '2026-02-21T08:10:00.000Z', updatedBy: 'seed',
  },
  {
    id: 'SVC-00007', orgId: 'org-nex',
    name: 'Premium Coffee', code: 'PREM-COF-01', category: 'Refreshment', icon: '☕',
    estimatedTimeMinutes: 5,
    chargeable: true, price: 25, priceUnit: 'flat',
    availableOfficeIds: ['OFC-00003'],
    assignedStaffIds: [],
    status: 'Active',
    description: '',
    createdAt: '2026-02-21T08:12:00.000Z', createdBy: 'seed',
    updatedAt: '2026-02-21T08:12:00.000Z', updatedBy: 'seed',
  },
];

/* ───────── CHART DATA ───────── */
export const VISITOR_CHART_DATA = [
  { day: 'Mon', visitors: 32 },
  { day: 'Tue', visitors: 45 },
  { day: 'Wed', visitors: 28 },
  { day: 'Thu', visitors: 56 },
  { day: 'Fri', visitors: 63 },
  { day: 'Sat', visitors: 18 },
  { day: 'Sun', visitors: 9  },
];

export const MONTHLY_DATA = [
  { month: 'Jan', guests: 320 },
  { month: 'Feb', guests: 410 },
  { month: 'Mar', guests: 390 },
  { month: 'Apr', guests: 520 },
  { month: 'May', guests: 480 },
  { month: 'Jun', guests: 610 },
  { month: 'Jul', guests: 540 },
  { month: 'Aug', guests: 590 },
  { month: 'Sep', guests: 670 },
  { month: 'Oct', guests: 720 },
  { month: 'Nov', guests: 690 },
  { month: 'Dec', guests: 780 },
];

export const OFFICE_CHART_DATA = [
  { name: 'Dubai HQ',         visitors: 210 },
  { name: 'Abu Dhabi Branch', visitors: 145 },
  { name: 'Sharjah Branch',   visitors: 190 },
  { name: 'Dubai Office',     visitors: 98  },
];

/* ───────── CONSTANTS ─────────
 * Single source of truth — do NOT redeclare these locally inside pages.
 * Sprint 3 spec:
 *   SERVICE_TYPES       — the specific request that is being delivered.
 *   SERVICE_CATEGORIES  — the department fulfilling it (Pantry/Logistics/Facility only).
 *   SERVICE_STATUSES    — lifecycle states for a service request.
 */
export const SERVICE_TYPES      = ['Tea','Coffee','Water','Snacks','Lunch','Parking','Projector Setup','AV Equipment','Wi-Fi Access','Other'];
export const SERVICE_CATEGORIES = ['Pantry','Logistics','Facility'];
export const SERVICE_STATUSES   = ['Pending','In Progress','Completed'];
export const VISITOR_TYPES      = ['Walk-in','Appointment','Vendor','Delivery','Contractor'];
export const PURPOSES           = ['Business Meeting','Product Demo','Consultation','Interview','Partnership Discussion','Site Visit','Delivery','Other'];

/* Sprint 4 — appointment constants. */
export const APPOINTMENT_STATUSES  = ['pending','confirmed','cancelled'];
export const APPOINTMENT_DURATIONS = ['15 Minutes','30 Minutes','45 Minutes','1 Hour','2 Hours'];

export const STATUS_COLORS = {
  Pending:        { bg: '#FFFBEB', text: '#92400E', border: '#FDE68A' },
  'In Progress':  { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  Completed:      { bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0' },
  confirmed:      { bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0' },
  pending:        { bg: '#FFFBEB', text: '#92400E', border: '#FDE68A' },
  cancelled:      { bg: '#FEF2F2', text: '#991B1B', border: '#FECACA' },
  inside:         { bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0' },
  'checked-out':  { bg: '#F3F4F6', text: '#374151', border: '#E5E7EB' },
  expected:       { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  available:      { bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0' },
  occupied:       { bg: '#FEF2F2', text: '#991B1B', border: '#FECACA' },
  maintenance:    { bg: '#FFFBEB', text: '#92400E', border: '#FDE68A' },
  'under-maintenance': { bg: '#FFFBEB', text: '#92400E', border: '#FDE68A' },
  active:         { bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0' },
  inactive:       { bg: '#F3F4F6', text: '#374151', border: '#E5E7EB' },
  waiting:        { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
};

/* ───────── ACCESS REQUESTS — public "Request Organisation Access" inbox ─────────
 * Seed for the Super Admin → Access Requests page. Mixes Pending (India + UAE),
 * an archived Approved row, and a Rejected row carrying the reason text. Times
 * are derived from `Date.now()` so the relative-time renderers ("2 hours ago")
 * stay current across sessions. */
export const MOCK_ACCESS_REQUESTS = [
  {
    id:            'REQ-2026-00142',
    status:        'Pending',
    submittedAt:   Date.now() - 2 * 3600 * 1000,
    orgName:       'Saraswat Logistics Pvt Ltd',
    country:       'India',
    companySize:   '51-200',
    industry:      'Logistics',
    businessEmail: 'priya.menon@saraswatlogistics.in',
    countryCode:   'IN',
    contactNumber: '9820012345',
    gstOrLicense:  '27AABCS1234N1Z2',
    ownerName:     'Priya Menon',
    designation:   'Head of Operations',
    city:          'Mumbai',
    leadSource:    'Google Search',
    message:       'We operate three warehouses across Mumbai and Pune and need centralised visitor logging with WhatsApp host alerts. Looking for a 30-day pilot before signing annual.',
    internalNotes: [],
    metadata: {
      ipAddress: '203.0.113.42',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36',
    },
    reviewedBy:       null,
    reviewedAt:       null,
    rejectionReason:  null,
  },
  {
    id:            'REQ-2026-00141',
    status:        'Pending',
    submittedAt:   Date.now() - 5 * 3600 * 1000,
    orgName:       'Al Manara Hospitality LLC',
    country:       'United Arab Emirates',
    companySize:   '200+',
    industry:      'Hospitality',
    businessEmail: 'fatima.alzaabi@almanara-hospitality.ae',
    countryCode:   'AE',
    contactNumber: '501234567',
    gstOrLicense:  'CN-1098765',
    ownerName:     'Fatima Al Zaabi',
    designation:   'Group IT Director',
    city:          'Dubai',
    leadSource:    'Referral',
    message:       'Referred by Emirates Group team. Need a multi-property rollout across our 7 hotels in Dubai and Abu Dhabi by end of Q2. Please share Enterprise pricing in INR.',
    internalNotes: [],
    metadata: {
      ipAddress: '94.200.10.18',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    },
    reviewedBy:       null,
    reviewedAt:       null,
    rejectionReason:  null,
  },
  {
    id:            'REQ-2026-00118',
    status:        'Approved',
    submittedAt:   Date.now() - 14 * 24 * 3600 * 1000,
    orgName:       'Mumbai Diamonds Pvt Ltd',
    country:       'India',
    companySize:   '11-50',
    industry:      'Retail',
    businessEmail: 'admin@mumbaidiamonds.in',
    countryCode:   'IN',
    contactNumber: '9870098765',
    gstOrLicense:  '27AAACM5678P1Z9',
    ownerName:     'Vikram Shah',
    designation:   'Director',
    city:          'Mumbai',
    leadSource:    'Event',
    message:       'Met at the Bharat Tex expo, ready to start with the Professional plan.',
    internalNotes: [
      { text: 'Shortlisted from Bharat Tex expo lead sheet.', author: 'Anita Desai', timestamp: Date.now() - 13 * 24 * 3600 * 1000 },
    ],
    metadata: {
      ipAddress: '49.205.10.7',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0',
    },
    reviewedBy:       'Super Admin',
    reviewedAt:       Date.now() - 12 * 24 * 3600 * 1000,
    rejectionReason:  null,
    createdOrgId:     'org-mmd',
  },
  {
    id:            'REQ-2026-00097',
    status:        'Rejected',
    submittedAt:   Date.now() - 25 * 24 * 3600 * 1000,
    orgName:       'QuickTest Demo Co.',
    country:       'India',
    companySize:   '1-10',
    industry:      'Other',
    businessEmail: 'tester@quicktestdemo.in',
    countryCode:   'IN',
    contactNumber: '9000099999',
    gstOrLicense:  '',
    ownerName:     'Test User',
    designation:   'Developer',
    city:          'Bengaluru',
    leadSource:    'Other',
    message:       'Looking around to evaluate the platform.',
    internalNotes: [
      { text: 'Test/demo organisation — no GST provided, no clear use case.', author: 'Super Admin', timestamp: Date.now() - 24 * 24 * 3600 * 1000 },
    ],
    metadata: {
      ipAddress: '157.49.0.5',
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Firefox/120.0',
    },
    reviewedBy:       'Super Admin',
    reviewedAt:       Date.now() - 24 * 24 * 3600 * 1000,
    rejectionReason:  'GST Number was not supplied and no business use case was provided. Please re-submit when you have a registered organisation and an active project.',
  },
];

/* ───────── SHARED UI COMPONENTS ───────── */

export function Badge({ status }) {
  const key   = status?.toLowerCase?.() ?? '';
  const found = STATUS_COLORS[key] || STATUS_COLORS[status] || { bg: '#F3F4F6', text: '#374151', border: '#E5E7EB' };
  return (
    <span style={{
      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
      background: found.bg, color: found.text, border: `1px solid ${found.border}`,
      display: 'inline-block', textTransform: 'capitalize',
    }}>
      {status}
    </span>
  );
}

