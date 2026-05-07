/**
 * Central role-based access control for the Services module.
 *
 * One source of truth — the page, the table, the context, and any future
 * consumer should import from here instead of duplicating role checks.
 *
 * Role matrix:
 *
 *   ┌───────────────┬────────┬────────┬─────────┬──────────┬────────┬──────┐
 *   │ Role          │ View   │ Create │ Assign  │ Start    │ Complete │ Del  │
 *   ├───────────────┼────────┼────────┼─────────┼──────────┼──────────┼──────┤
 *   │ Super Admin   │ all    │  ✓     │  ✓      │  any     │  any     │  ✓   │
 *   │ Reception     │ all    │  ✓     │  ✓      │  ✗       │  ✗       │  ✗   │
 *   │ Manager       │ all    │  ✗     │  ✗      │  ✗       │  ✗       │  ✗   │
 *   │ Service Staff │ own    │  ✗     │  ✗      │  if own  │  if own  │  ✗   │
 *   │ Other         │ none   │  ✗     │  ✗      │  ✗       │  ✗       │  ✗   │
 *   └───────────────┴────────┴────────┴─────────┴──────────┴──────────┴──────┘
 */

export const ROLES = Object.freeze({
  SUPER_ADMIN: 'superadmin',
  RECEPTION:   'reception',
  SERVICE:     'service',
  MANAGER:     'manager',
});

const roleOf = (user) => (user?.role || '').toString().toLowerCase();

export const isSuperAdmin    = (user) => roleOf(user) === ROLES.SUPER_ADMIN;
export const isReception     = (user) => roleOf(user) === ROLES.RECEPTION;
export const isServiceStaff  = (user) => roleOf(user) === ROLES.SERVICE;
export const isManager       = (user) => roleOf(user) === ROLES.MANAGER;

/* ─── Scope ───────────────────────────────────────────────────── */
export function canViewAllServices(user) {
  return isSuperAdmin(user) || isReception(user) || isManager(user);
}

/** Returns the services `user` is permitted to see. */
export function visibleServices(user, services, actorStaffId) {
  if (canViewAllServices(user)) return services;
  if (isServiceStaff(user)) {
    if (!actorStaffId) return [];
    return services.filter((s) => s.assignedStaffId === actorStaffId);
  }
  return []; /* Unrecognised roles see nothing. */
}

/* ─── Mutations ───────────────────────────────────────────────── */
export function canCreateService(user) {
  return isSuperAdmin(user) || isReception(user);
}

/* Assignment is part of the create form; same permission. */
export const canAssignService = canCreateService;

/* Editing a service record (service type, assignee, notes) — same privileges
   as creating one. Status transitions are governed separately. */
export const canEditService = canCreateService;

export function canDeleteService(user) {
  return isSuperAdmin(user);
}

/**
 * Per-row transition permission. The status guard is also applied so the
 * caller can use the result directly for button visibility.
 */
export function canStartService(user, service, actorStaffId) {
  if (!service || service.status !== 'Pending') return false;
  if (isSuperAdmin(user)) return true;
  return isServiceStaff(user) && Boolean(actorStaffId) && service.assignedStaffId === actorStaffId;
}

export function canCompleteService(user, service, actorStaffId) {
  if (!service || service.status !== 'In Progress') return false;
  if (isSuperAdmin(user)) return true;
  return isServiceStaff(user) && Boolean(actorStaffId) && service.assignedStaffId === actorStaffId;
}

/**
 * Whether the logged-in user can *at least* transition the row. Useful for
 * deciding if we should render any action column at all for this row.
 */
export function canTransitionRow(user, service, actorStaffId) {
  return (
    canStartService(user, service, actorStaffId) ||
    canCompleteService(user, service, actorStaffId)
  );
}

/**
 * Backend-style authorization used inside context actions. Mirrors the
 * UI predicates so a console-driven call cannot bypass the UI hiding.
 */
export function authorizeTransition(actor, service) {
  const role = (actor?.actorRole || '').toLowerCase();
  if (role === ROLES.SUPER_ADMIN) return true;
  if (!actor?.actorStaffId) return false;
  return service.assignedStaffId === actor.actorStaffId;
}
