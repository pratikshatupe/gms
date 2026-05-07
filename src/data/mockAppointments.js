/**
 * Appointments v1 mock data + constants — Module 3.
 *
 * Canonical schema (new):
 *   {
 *     id:              'APT-XXXXX',
 *     orgId, officeId, roomId?, hostUserId,
 *     visitor: {
 *       fullName, emailId, contactNumber, companyName, designation,
 *       visitorType: 'Regular'|'VIP'|'Vendor'|'Delivery',
 *       accompanyingCount: 0..10,
 *     },
 *     purpose: string (10..500),
 *     scheduledDate: 'YYYY-MM-DD',
 *     startTime: 'HH:mm', endTime: 'HH:mm',  // office-local naive
 *     servicesPrebooked: [serviceId, ...],
 *     notes, invitation: { sendEmail, includeQRCode, smsReminder },
 *     status: 'Pending'|'Approved'|'Checked-In'|'In-Progress'
 *            |'Completed'|'Cancelled'|'No-Show',
 *     approvalRequired, approvalMode, approvedBy, approvedAt,
 *     checkedInAt, checkedInBy, checkedOutAt, checkedOutBy,
 *     startedAt, startedBy,               // In-Progress transition
 *     cancelledAt, cancelledBy, cancellationReason,
 *     noShowAt, noShowBy,
 *     feedback: { rating, notes, servicesAvailed, ratedAt, ratedBy } | null,
 *     isRecurring: false,                 // always false in v1; field reserved
 *     createdAt, createdBy, updatedAt, updatedBy
 *   }
 *
 * Legacy aliases (stamped on every row and every mutation) keep the
 * older AppointmentContext + 3 legacy components working without
 * requiring changes to them:
 *   date         = scheduledDate
 *   time         = startTime
 *   host         = staff fullName lookup
 *   hostId       = hostUserId
 *   guestName    = visitor.fullName
 *   company      = visitor.companyName
 *   companyName  = visitor.companyName
 *   contactNumber= visitor.contactNumber
 *   duration     = computed '1 Hour' equivalent
 *
 * Storage key bumped to 'cgms_appointments_v1' (see store/keys.js).
 */

/* NOTE: we intentionally do NOT top-level import from './mockData'.
 * Doing so creates a circular dependency:
 *   mockData.jsx   re-exports  → mockAppointments.js
 *   mockAppointments.js import → mockData.jsx (for MOCK_STAFF)
 * ES-module evaluation hits the re-export line before MOCK_STAFF is
 * declared, so top-level reads of MOCK_STAFF trip the TDZ. The host
 * alias stamping is instead resolved lazily at call time — either
 * from an explicit staffList argument or from localStorage if the
 * Staff module has already hydrated it. Seed rows carry host names
 * inline so module-init stamping does not depend on either.
 */

/* ── Shared constants ────────────────────────────────────────────── */

export const DOCUMENT_REQUIREMENTS = [
  'ID Copy',
  'Authorisation Letter',
  'NDA',
];

export const GUEST_RESPONSES = ['Awaiting', 'Accepted', 'Declined'];

/* Stored statuses only. "Upcoming" is a computed display pill — not
   a persisted value. See appointmentState.isUpcoming(). */
export const APPOINTMENT_STATUSES = [
  'Pending',
  'Approved',
  'Checked-In',
  'In-Progress',
  'Completed',
  'Cancelled',
  'No-Show',
];

export const APPOINTMENT_DURATIONS = [
  '15 Minutes',
  '30 Minutes',
  '45 Minutes',
  '1 Hour',
  '2 Hours',
];

export const APPOINTMENT_PURPOSES = [
  'Business Meeting',
  'Product Demo',
  'Consultation',
  'Interview',
  'Partnership Discussion',
  'Site Visit',
  'Delivery',
  'Other',
];

/**
 * @deprecated Use MOCK_STAFF from mockData.jsx. This alias exists
 * only for legacy Appointments page components not yet migrated
 * (AppointmentForm, AppointmentTable, WalkInForm, AppointmentContext).
 * Module 4 (Walk-In) and future refactors will retire these callers.
 *
 * Declared as a Proxy that lazily forwards array ops to MOCK_STAFF.
 * No top-level read of MOCK_STAFF happens here — accesses resolve
 * only when a legacy consumer iterates, so by then mockData.jsx
 * evaluation has completed and the cycle is safe to follow.
 */
function _lazyStaffList() {
  try {
    /* Dynamic require() is not available in Vite/ESM so we read
       directly from localStorage after the Staff module has hydrated.
       For fresh sessions pre-hydration, fall back to an empty array;
       legacy consumers display '—' until the staff collection is
       touched. */
    const raw = typeof localStorage !== 'undefined'
      ? localStorage.getItem('cgms_staff_v1') : null;
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((s) => ({
      id:       s?.id,
      name:     s?.fullName || s?.name,
      role:     s?.role,
      officeId: s?.officeId,
      orgId:    s?.orgId,
    }));
  } catch {
    return [];
  }
}
export const STAFF_LIST = new Proxy([], {
  get(target, prop) {
    const live = _lazyStaffList();
    return Reflect.get(live, prop);
  },
});

/* ── Helpers for seed dates ──────────────────────────────────────── */

const today = () => new Date().toISOString().slice(0, 10);
const offsetDay = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

/* ── Legacy-alias stamper ────────────────────────────────────────── */

/**
 * Map hostUserId → fullName. Lazy: tries the explicit staffList
 * argument first, falls back to localStorage (which the Staff
 * module hydrates on first mount), and finally to '—'. No
 * top-level module imports — avoids the mockData ↔ mockAppointments
 * circular dependency.
 */
function hostNameFor(hostUserId, staffList) {
  if (!hostUserId) return '—';
  if (Array.isArray(staffList)) {
    const hit = staffList.find((s) => s?.id === hostUserId);
    if (hit) return hit.fullName || hit.name || '—';
  }
  try {
    const raw = typeof localStorage !== 'undefined'
      ? localStorage.getItem('cgms_staff_v1') : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const hit = parsed.find((s) => s?.id === hostUserId);
        if (hit) return hit.fullName || hit.name || '—';
      }
    }
  } catch { /* swallow */ }
  return '—';
}

/**
 * Derive the legacy `duration` string from startTime + endTime so
 * callers that still read `apt.duration` get a sane value.
 */
function computeDurationLabel(startTime, endTime) {
  if (!startTime || !endTime) return '1 Hour';
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins <= 15) return '15 Minutes';
  if (mins <= 30) return '30 Minutes';
  if (mins <= 45) return '45 Minutes';
  if (mins <= 60) return '1 Hour';
  return '2 Hours';
}

/**
 * stampLegacyAliases — polymorphic.
 *
 *   stampLegacyAliases(apt)                  // single row, lazy host lookup
 *   stampLegacyAliases(apt, staffList)       // single row, explicit lookup
 *   stampLegacyAliases([...apts], staffList) // batch row, explicit lookup
 *
 * Runs on seed bulk-stamp at useCollection init, on every Add/Edit/
 * state-transition save, and wherever AppointmentContext +
 * appointmentReminders + visibilityFilters need legacy field names.
 *
 * The `staffList` argument is the tenant-scoped MOCK_STAFF passed in
 * by the caller. When omitted, the helper falls back to a lazy
 * localStorage read (see hostNameFor). No module-level import of
 * MOCK_STAFF — avoids the circular-dep TDZ crash.
 */
export function stampLegacyAliases(arg1, staffList) {
  if (Array.isArray(arg1)) return arg1.map((row) => _stampOne(row, staffList));
  return _stampOne(arg1, staffList);
}

function _stampOne(apt, staffList) {
  if (!apt) return apt;
  const visitor = apt.visitor || {};
  const hostName = apt.host || hostNameFor(apt.hostUserId, staffList);
  return {
    ...apt,
    /* legacy date/time aliases */
    date: apt.scheduledDate || apt.date || '',
    time: apt.startTime     || apt.time || '',
    duration: apt.duration  || computeDurationLabel(apt.startTime, apt.endTime),
    /* legacy host aliases */
    host:   hostName,
    hostId: apt.hostUserId || apt.hostId || null,
    /* legacy visitor aliases */
    guestName:     visitor.fullName     || apt.guestName     || '',
    company:       visitor.companyName  || apt.company       || '',
    companyName:   visitor.companyName  || apt.companyName   || '',
    contactNumber: visitor.contactNumber|| apt.contactNumber || '',
    email:         visitor.emailId      || apt.email         || '',
    /* legacy room alias */
    room: apt.room || apt.roomName || '',
  };
}

/* ── Seed rows ───────────────────────────────────────────────────── */
/* 14 rows covering every state-machine leaf. Acme-heavy for walkthroughs,
   one Nexus row for tenant-isolation testing.
 *
 * Seed-time host-name table — hardcoded so makeRow's stamp call doesn't
 * depend on MOCK_STAFF (would re-trigger the circular dep) or on
 * localStorage (empty on first load). Kept in lockstep with the
 * MOCK_STAFF seed in mockData.jsx. */
const SEED_HOST_NAMES = Object.freeze({
  'USR-00001': 'Arjun Mehta',
  'USR-00002': 'Priya Sharma',
  'USR-00003': 'Sara Khan',
  'USR-00004': 'Rahul Patil',
  'USR-00005': 'Anita Desai',
  'USR-00006': 'Kamal Singh',
  'USR-00007': 'Fatima Al Zaabi',
  'USR-00008': 'Hassan Al Maktoum',
});

function makeRow(partial) {
  const base = {
    orgId: 'org-acme',
    roomId: null,
    servicesPrebooked: [],
    invitation: { sendEmail: true, includeQRCode: true, smsReminder: false },
    notes: '',
    approvalRequired: false,
    approvalMode: 'Auto',
    approvedBy: null, approvedAt: null,
    checkedInAt: null, checkedInBy: null,
    checkedOutAt: null, checkedOutBy: null,
    startedAt: null, startedBy: null,
    cancelledAt: null, cancelledBy: null, cancellationReason: null,
    noShowAt: null, noShowBy: null,
    feedback: null,
    isRecurring: false,
    createdAt: new Date().toISOString(), createdBy: 'seed',
    updatedAt: new Date().toISOString(), updatedBy: 'seed',
    ...partial,
  };
  /* Seed-time host lookup uses the hardcoded SEED_HOST_NAMES table
     so module-init stamping has no dependency on MOCK_STAFF or
     localStorage state. */
  if (!base.host && base.hostUserId) {
    base.host = SEED_HOST_NAMES[base.hostUserId] || '—';
  }
  return stampLegacyAliases(base);
}

const V = (o) => ({
  fullName: '', emailId: '', contactNumber: '', companyName: '',
  designation: '', visitorType: 'Regular', accompanyingCount: 0,
  ...o,
});

export const MOCK_APPOINTMENTS = [
  /* 1. Approved, today — primary "Upcoming" demo row. */
  makeRow({
    id: 'APT-00001', officeId: 'OFC-00001', roomId: 'ROOM-00001',
    hostUserId: 'USR-00001',
    visitor: V({
      fullName: 'Ravi Kapoor', emailId: 'ravi@techcorp.com',
      contactNumber: '+91 98765 43210', companyName: 'TechCorp',
      designation: 'Head of Procurement', visitorType: 'Regular',
      accompanyingCount: 1,
    }),
    purpose: 'Quarterly business review meeting — Q4 numbers.',
    scheduledDate: today(), startTime: '10:00', endTime: '11:00',
    servicesPrebooked: ['SVC-00001'],
    status: 'Approved',
    approvalRequired: false, approvalMode: 'Auto',
  }),
  /* 2. Pending, today — waiting for approval. */
  makeRow({
    id: 'APT-00002', officeId: 'OFC-00001', roomId: 'ROOM-00002',
    hostUserId: 'USR-00002',
    visitor: V({
      fullName: 'Ahmed Al Rashid', emailId: 'ahmed@emirates.com',
      contactNumber: '+971 50 123 4567', companyName: 'Emirates Group',
      designation: 'Director', visitorType: 'VIP', accompanyingCount: 2,
    }),
    purpose: 'Partnership discussion — joint venture exploration.',
    scheduledDate: today(), startTime: '14:00', endTime: '16:00',
    servicesPrebooked: ['SVC-00001', 'SVC-00005'],
    status: 'Pending',
    approvalRequired: true, approvalMode: 'Director',
  }),
  /* 3. Pending, tomorrow — standard Pending row. */
  makeRow({
    id: 'APT-00003', officeId: 'OFC-00001', roomId: null,
    hostUserId: 'USR-00001',
    visitor: V({
      fullName: 'Meera Joshi', emailId: 'meera@innovate.com',
      contactNumber: '+91 98765 43211', companyName: 'Innovate Solutions',
      designation: 'Senior Analyst', visitorType: 'Regular',
    }),
    purpose: 'Interview for senior analyst position — second round panel.',
    scheduledDate: offsetDay(1), startTime: '09:30', endTime: '10:30',
    status: 'Pending',
    approvalRequired: true, approvalMode: 'Host',
  }),
  /* 4. Checked-In, today — currently at reception. */
  makeRow({
    id: 'APT-00004', officeId: 'OFC-00001', roomId: 'ROOM-00002',
    hostUserId: 'USR-00002',
    visitor: V({
      fullName: 'Nikhil Verma', emailId: 'nikhil@cloudscale.io',
      contactNumber: '+91 90000 11122', companyName: 'CloudScale',
      designation: 'CTO', visitorType: 'Regular',
    }),
    purpose: 'Site visit — data-centre floor walkthrough.',
    scheduledDate: today(), startTime: '16:30', endTime: '17:00',
    status: 'Checked-In',
    checkedInAt: new Date().toISOString(), checkedInBy: 'USR-00003',
    approvedAt: new Date(Date.now() - 3600000).toISOString(),
    approvedBy: 'USR-00001',
  }),
  /* 5. In-Progress, today — meeting underway. */
  makeRow({
    id: 'APT-00005', officeId: 'OFC-00001', roomId: 'ROOM-00001',
    hostUserId: 'USR-00001',
    visitor: V({
      fullName: 'Sanjay Khanna', emailId: 'sanjay@apexlegal.com',
      contactNumber: '+91 98000 22233', companyName: 'Apex Legal',
      designation: 'Partner', visitorType: 'Regular',
    }),
    purpose: 'Contract review — master services agreement.',
    scheduledDate: today(), startTime: '09:00', endTime: '10:30',
    servicesPrebooked: ['SVC-00002'],
    status: 'In-Progress',
    approvedAt: new Date(Date.now() - 7200000).toISOString(), approvedBy: 'USR-00001',
    checkedInAt: new Date(Date.now() - 5400000).toISOString(), checkedInBy: 'USR-00003',
    startedAt: new Date(Date.now() - 5000000).toISOString(), startedBy: 'USR-00001',
  }),
  /* 6. Completed, yesterday — with feedback captured. */
  makeRow({
    id: 'APT-00006', officeId: 'OFC-00001', roomId: 'ROOM-00001',
    hostUserId: 'USR-00002',
    visitor: V({
      fullName: 'Fatima Al Zaabi', emailId: 'fatima@adnoc.ae',
      contactNumber: '+971 55 111 2222', companyName: 'ADNOC',
      designation: 'VP Operations', visitorType: 'Regular',
    }),
    purpose: 'Consultation on logistics partnership renewal terms.',
    scheduledDate: offsetDay(-1), startTime: '11:00', endTime: '12:00',
    servicesPrebooked: ['SVC-00001'],
    status: 'Completed',
    approvedAt: new Date(Date.now() - 172800000).toISOString(), approvedBy: 'USR-00001',
    checkedInAt: new Date(Date.now() - 90000000).toISOString(), checkedInBy: 'USR-00003',
    checkedOutAt: new Date(Date.now() - 86400000).toISOString(), checkedOutBy: 'USR-00003',
    feedback: {
      rating: 5, notes: 'Very productive — cleared all renewal terms.',
      servicesAvailed: ['SVC-00001'],
      ratedAt: new Date(Date.now() - 86400000).toISOString(), ratedBy: 'USR-00003',
    },
  }),
  /* 7. Cancelled — with reason. */
  makeRow({
    id: 'APT-00007', officeId: 'OFC-00001', roomId: null,
    hostUserId: 'USR-00002',
    visitor: V({
      fullName: 'James Fletcher', emailId: 'james@kpmg.ae',
      contactNumber: '+971 52 333 4444', companyName: 'KPMG UAE',
      designation: 'Partner', visitorType: 'Regular',
    }),
    purpose: 'Product demo for audit tooling integration.',
    scheduledDate: offsetDay(2), startTime: '15:00', endTime: '15:45',
    status: 'Cancelled',
    cancelledAt: new Date(Date.now() - 3600000).toISOString(),
    cancelledBy: 'USR-00002',
    cancellationReason: 'Visitor rescheduled to next month — to be re-booked.',
  }),
  /* 8. No-Show — flagged. */
  makeRow({
    id: 'APT-00008', officeId: 'OFC-00001', roomId: 'ROOM-00002',
    hostUserId: 'USR-00001',
    visitor: V({
      fullName: 'Rajiv Menon', emailId: 'rajiv@startup.co',
      contactNumber: '+91 91000 33344', companyName: 'StartUp Co',
      designation: 'Founder', visitorType: 'Regular',
    }),
    purpose: 'Pitch presentation — seed funding conversation.',
    scheduledDate: offsetDay(-2), startTime: '11:00', endTime: '11:45',
    status: 'No-Show',
    approvedAt: new Date(Date.now() - 259200000).toISOString(), approvedBy: 'USR-00001',
    noShowAt: new Date(Date.now() - 172800000).toISOString(), noShowBy: 'USR-00003',
  }),
  /* 9. VIP Approved — today afternoon, second Director in org could see this. */
  makeRow({
    id: 'APT-00009', officeId: 'OFC-00002', roomId: 'ROOM-00004',
    hostUserId: 'USR-00005',
    visitor: V({
      fullName: 'Aruna Rao', emailId: 'aruna.rao@gov.in',
      contactNumber: '+91 99000 44455', companyName: 'Ministry of Commerce',
      designation: 'Joint Secretary', visitorType: 'VIP',
      accompanyingCount: 3,
    }),
    purpose: 'Policy briefing on export trade guidelines and updates.',
    scheduledDate: today(), startTime: '15:00', endTime: '16:30',
    servicesPrebooked: ['SVC-00002', 'SVC-00005'],
    status: 'Approved',
    approvalRequired: true, approvalMode: 'Director',
    approvedAt: new Date(Date.now() - 86400000).toISOString(), approvedBy: 'USR-00001',
  }),
  /* 10. Vendor visit — supplier. */
  makeRow({
    id: 'APT-00010', officeId: 'OFC-00002', roomId: 'ROOM-00005',
    hostUserId: 'USR-00006',
    visitor: V({
      fullName: 'Deepak Rao', emailId: 'deepak@avpro.in',
      contactNumber: '+91 97000 55566', companyName: 'AV Pro Services',
      designation: 'Account Manager', visitorType: 'Vendor',
    }),
    purpose: 'Quarterly service review for AV maintenance contract.',
    scheduledDate: offsetDay(3), startTime: '14:00', endTime: '15:00',
    status: 'Approved',
  }),
  /* 11. Delivery — courier, no host, no room. */
  makeRow({
    id: 'APT-00011', officeId: 'OFC-00001', roomId: null,
    hostUserId: null,
    visitor: V({
      fullName: 'Aakash Delivery', emailId: '',
      contactNumber: '+91 96000 66677', companyName: 'BlueDart Express',
      designation: 'Courier', visitorType: 'Delivery',
      accompanyingCount: 0,
    }),
    purpose: 'Document delivery — signed agreements from legal counsel.',
    scheduledDate: today(), startTime: '13:00', endTime: '13:15',
    status: 'Completed',
    checkedInAt: new Date(Date.now() - 3600000).toISOString(), checkedInBy: 'USR-00003',
    checkedOutAt: new Date(Date.now() - 3540000).toISOString(), checkedOutBy: 'USR-00003',
  }),
  /* 12. Pending Host approval (Host mode, for testing Host-mode flow). */
  makeRow({
    id: 'APT-00012', officeId: 'OFC-00002', roomId: 'ROOM-00004',
    hostUserId: 'USR-00005',
    visitor: V({
      fullName: 'Lakshmi Iyer', emailId: 'lakshmi@consulting.in',
      contactNumber: '+91 95000 77788', companyName: 'Iyer Consulting',
      designation: 'Principal Consultant', visitorType: 'Regular',
    }),
    purpose: 'Consulting engagement kickoff meeting.',
    scheduledDate: offsetDay(2), startTime: '10:00', endTime: '11:30',
    status: 'Pending',
    approvalRequired: true, approvalMode: 'Host',
  }),
  /* 13. Another Approved today, same room as APT-00001 — demonstrates
     conflict detection when creating a new appointment. */
  makeRow({
    id: 'APT-00013', officeId: 'OFC-00001', roomId: 'ROOM-00001',
    hostUserId: 'USR-00002',
    visitor: V({
      fullName: 'Kunal Shah', emailId: 'kunal@growth.co',
      contactNumber: '+91 94000 88899', companyName: 'Growth Capital',
      designation: 'Principal', visitorType: 'Regular',
    }),
    purpose: 'Investor update meeting — portfolio review.',
    scheduledDate: today(), startTime: '15:30', endTime: '16:30',
    status: 'Approved',
  }),
  /* 14. Nexus — tenant-isolation row. Director at Dubai HQ. */
  makeRow({
    id: 'APT-00014', orgId: 'org-nex', officeId: 'OFC-00003', roomId: 'ROOM-00006',
    hostUserId: 'USR-00007',
    visitor: V({
      fullName: 'Omar Al Habtoor', emailId: 'omar@alhabtoor.ae',
      contactNumber: '+971 50 999 0001', companyName: 'Al Habtoor Group',
      designation: 'Investment Director', visitorType: 'VIP',
      accompanyingCount: 1,
    }),
    purpose: 'Strategic investment review — regional expansion plan.',
    scheduledDate: today(), startTime: '10:00', endTime: '11:30',
    servicesPrebooked: ['SVC-00006'],
    status: 'Approved',
    approvalRequired: true, approvalMode: 'Director',
    approvedBy: 'USR-00007',
    approvedAt: new Date(Date.now() - 172800000).toISOString(),
  }),
];
