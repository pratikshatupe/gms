/**
 * Centralised role-based data visibility.
 *
 * Roles (lowercase on user.role):
 *   superadmin  → all data, no filter (short-circuit)
 *   director    → full organisation, all offices
 *   manager     → only their assigned office
 *   reception   → office + their own assignments (walk-ins, hosted visits)
 *   service     → only rows assigned to them
 *
 * All functions are pure — they take a `user` and the raw dataset and return
 * the subset the user is allowed to see. Components should never see rows
 * outside their scope.
 *
 * Records in the mock data do not all carry an `officeId` directly, so we
 * resolve host → staff → officeId via the staffList parameter. If a record
 * carries its own `officeId`, that wins.
 */

export const ROLE = Object.freeze({
  SUPER_ADMIN: 'superadmin',
  DIRECTOR:    'director',
  MANAGER:     'manager',
  RECEPTION:   'reception',
  SERVICE:     'service',
});

const roleOf = (user) => (user?.role || '').toString().toLowerCase();

/**
 * Single read path for the user's organisation. Login stores it as
 * `organisationId`; newer code may set `orgId`. We accept both so nothing
 * breaks during the migration window.
 */
export function getUserOrgId(user) {
  return user?.organisationId || user?.orgId || null;
}

/**
 * Multi-tenant gate — the primary isolation boundary. Runs BEFORE role
 * filters. Super Admin short-circuits (sees all orgs); every other role is
 * restricted to their own organisation.
 *
 * Fails closed — a non-SuperAdmin user with no resolvable orgId sees
 * nothing, so tampering with the persisted user record (e.g. blanking out
 * `organisationId` or setting it to the sentinel `'all'`) cannot leak
 * another tenant's data. The `'all'` sentinel is reserved for SuperAdmin,
 * who has already short-circuited above.
 *
 * Records without an `orgId` are treated as legacy rows and pass through
 * so the app keeps working while data migration completes. New rows must
 * always carry an orgId (enforced at create-time via resolveOrgId).
 */
export function filterByOrg(records, user) {
  if (!Array.isArray(records)) return [];
  const role = roleOf(user);
  if (role === ROLE.SUPER_ADMIN) return records;
  const myOrg = getUserOrgId(user);
  if (!myOrg || myOrg === 'all') return []; /* fail closed */
  return records.filter((r) => !r?.orgId || r.orgId === myOrg);
}

/** Super Admin / Director bypass office-level filtering. */
const bypassesOfficeFilter = (user) => {
  const role = roleOf(user);
  if (role === ROLE.SUPER_ADMIN) return true;
  if (role === ROLE.DIRECTOR) return true;
  if (user?.officeId === 'all') return true;
  return false;
};

/** Build a quick host-name → officeId lookup from a staff list. */
function buildStaffOfficeIndex(staffList = []) {
  const byName = new Map();
  const byId   = new Map();
  for (const s of staffList) {
    if (s?.name)     byName.set(s.name.toLowerCase(), s.officeId || null);
    if (s?.id)       byId.set(s.id, s.officeId || null);
  }
  return { byName, byId };
}

/** Resolve a record's officeId, falling back to its host's office. */
function resolveOfficeId(record, staffIndex) {
  if (record?.officeId) return record.officeId;
  if (record?.office)   return record.office; /* some rows use plain `office` */
  if (record?.hostId && staffIndex.byId.has(record.hostId)) {
    return staffIndex.byId.get(record.hostId);
  }
  if (record?.host && staffIndex.byName.has(record.host.toLowerCase())) {
    return staffIndex.byName.get(record.host.toLowerCase());
  }
  return null;
}

/* ─── Generic office scoping ─────────────────────────────────────────── */

/**
 * Restrict a dataset to the user's office. Super Admin & Director bypass.
 * Records whose office cannot be resolved are kept only for Super Admin /
 * Director (so you never silently drop data at executive levels).
 */
export function filterByOffice(records, user, staffList = []) {
  if (!Array.isArray(records)) return [];
  /* Org gate first — a Manager must never see another org's rows even if
     the office IDs happen to match. */
  const orgScoped = filterByOrg(records, user);
  if (bypassesOfficeFilter(user)) return orgScoped;

  const myOffice = user?.officeId;
  if (!myOffice) return []; /* Unknown office → see nothing. */

  const idx = buildStaffOfficeIndex(staffList);
  return orgScoped.filter((r) => {
    const officeId = resolveOfficeId(r, idx);
    if (!officeId) return false;
    return officeId === myOffice;
  });
}

/* ─── Guest Log ──────────────────────────────────────────────────────── */

/**
 * Guest Log visibility:
 *   superadmin/director → everything
 *   manager             → entries for their office (resolved via host)
 *   reception           → entries for their office, plus walk-ins or visits
 *                         where they are the host
 *   service             → none (service staff don't use the guest log)
 */
export function filterGuestLog(guestLog, user, staffList = []) {
  if (!Array.isArray(guestLog)) return [];
  const role = roleOf(user);

  if (role === ROLE.SUPER_ADMIN) return guestLog;

  /* Org gate — must run before any role-level broadening. */
  const orgScoped = filterByOrg(guestLog, user);
  if (role === ROLE.DIRECTOR) return orgScoped;
  if (role === ROLE.SERVICE)  return [];

  if (role === ROLE.MANAGER) {
    return filterByOffice(orgScoped, user, staffList);
  }

  if (role === ROLE.RECEPTION) {
    const idx = buildStaffOfficeIndex(staffList);
    const myOffice = user?.officeId;
    const myName   = (user?.name || '').toLowerCase();
    return orgScoped.filter((g) => {
      const officeId = resolveOfficeId(g, idx);
      const sameOffice = officeId && myOffice && officeId === myOffice;
      const myOwnRow   = (g.host || '').toLowerCase() === myName
                        || (g.type || '').toLowerCase() === 'walk-in';
      return sameOffice || myOwnRow;
    });
  }

  return [];
}

/* ─── Appointments ───────────────────────────────────────────────────── */

/**
 * Appointment visibility:
 *   superadmin/director → everything
 *   manager             → appointments for their office (via host)
 *   reception           → appointments for their office, plus any where
 *                         they are the host
 *   service             → only appointments with an assignedService targeted
 *                         at them (by staffId match on the linked service row)
 */
export function filterAppointments(appointments, user, staffList = []) {
  if (!Array.isArray(appointments)) return [];
  const role = roleOf(user);

  if (role === ROLE.SUPER_ADMIN) return appointments;

  const orgScoped = filterByOrg(appointments, user);
  if (role === ROLE.DIRECTOR) return orgScoped;

  if (role === ROLE.MANAGER) {
    return filterByOffice(orgScoped, user, staffList);
  }

  if (role === ROLE.RECEPTION) {
    const idx = buildStaffOfficeIndex(staffList);
    const myOffice = user?.officeId;
    const myName   = (user?.name || '').toLowerCase();
    return orgScoped.filter((a) => {
      const officeId = resolveOfficeId(a, idx);
      const sameOffice = officeId && myOffice && officeId === myOffice;
      const myOwnRow   = (a.host || '').toLowerCase() === myName;
      return sameOffice || myOwnRow;
    });
  }

  if (role === ROLE.SERVICE) {
    /* Service Staff don't own appointments — they act on service rows. But
       they should still see the appointments they're linked to so they have
       context for their tasks. */
    const myStaffId = user?.staffId;
    if (!myStaffId) return [];
    return orgScoped.filter((a) => a.assignedStaffId === myStaffId);
  }

  return [];
}

/* ─── Services ───────────────────────────────────────────────────────── */

/**
 * Service visibility:
 *   superadmin/director/manager → everything in their scope
 *   reception                   → services for their office
 *   service                     → only rows assigned to them
 */
export function filterServices(services, user, staffList = []) {
  if (!Array.isArray(services)) return [];
  const role = roleOf(user);

  if (role === ROLE.SUPER_ADMIN) return services;

  const orgScoped = filterByOrg(services, user);
  if (role === ROLE.DIRECTOR) return orgScoped;

  if (role === ROLE.SERVICE) {
    const myStaffId = user?.staffId;
    if (!myStaffId) return [];
    return orgScoped.filter((s) => s.assignedStaffId === myStaffId);
  }

  if (role === ROLE.MANAGER || role === ROLE.RECEPTION) {
    /* Scope services by the assignee's office (the staff member doing the
       work), which matches how Manager/Reception naturally think about
       service requests "at their office". */
    const idx = buildStaffOfficeIndex(staffList);
    const myOffice = user?.officeId;
    if (!myOffice) return [];
    return orgScoped.filter((s) => {
      if (s.officeId) return s.officeId === myOffice;
      const assigneeOffice = idx.byId.get(s.assignedStaffId)
        || idx.byName.get((s.assignedStaff || '').toLowerCase());
      return assigneeOffice === myOffice;
    });
  }

  return [];
}

/* ─── Notifications ──────────────────────────────────────────────────── */

/**
 * Notifications:
 *   superadmin → all
 *   service    → only those targeted at them by staffId
 *   others     → only those where their role is in `notification.roles`
 *
 * The contextual `visibleNotifications()` from NotificationContext already
 * does 90% of this. We wrap it here so every page imports from one place.
 */
export function filterNotifications(notifications, user, currentStaffId) {
  if (!Array.isArray(notifications)) return [];
  const role = roleOf(user);

  if (role === ROLE.SUPER_ADMIN) return notifications;

  return notifications.filter((n) => {
    if (role === ROLE.SERVICE) {
      return n.staffId && n.staffId === currentStaffId;
    }
    if (!n.roles || n.roles.length === 0) return true;
    return n.roles.includes(role);
  });
}

/* ─── Dashboard stats ────────────────────────────────────────────────── */

/**
 * Role-safe metrics derived entirely from the already-filtered datasets.
 * Components should call this instead of computing off the unfiltered data.
 */
export function computeScopedMetrics({ guestLog, appointments, services }) {
  const gl  = Array.isArray(guestLog)     ? guestLog     : [];
  const ap  = Array.isArray(appointments) ? appointments : [];
  const sv  = Array.isArray(services)     ? services     : [];

  const todayKey = new Date().toISOString().slice(0, 10);
  const nowMs    = Date.now();
  const inOneHr  = nowMs + 60 * 60 * 1000;

  const upcomingSoon = ap.filter((a) => {
    if (!a.date || !a.time) return false;
    const when = new Date(`${a.date}T${a.time}`).getTime();
    return when >= nowMs && when <= inOneHr;
  }).length;

  return {
    total:       gl.length,
    inside:      gl.filter((g) => g.status === 'Inside').length,
    checkedOut:  gl.filter((g) => g.status === 'Checked Out').length,
    todayCount:  ap.filter((a) => a.date === todayKey).length,
    upcomingSoon,
    services: {
      total:      sv.length,
      pending:    sv.filter((s) => s.status === 'Pending').length,
      inProgress: sv.filter((s) => s.status === 'In Progress').length,
      completed:  sv.filter((s) => s.status === 'Completed').length,
    },
  };
}
