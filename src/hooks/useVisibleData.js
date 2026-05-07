import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAppointments } from '../context/AppointmentContext';
import { useNotifications } from '../context/NotificationContext';
import {
  filterAppointments,
  filterGuestLog,
  filterNotifications,
  filterServices,
  filterByOrg,
  computeScopedMetrics,
} from '../utils/visibilityFilters';

/**
 * One-stop role-aware data hooks.
 *
 * Pages import these instead of reading raw context data, so components
 * never see rows outside their role's scope. Super Admin short-circuits
 * inside the filter functions — no filtering cost, no data loss.
 *
 * Every hook wraps its computation in useMemo keyed on the underlying
 * dataset + user identity, so renders stay cheap.
 */

/** Identify the logged-in user's staff record (used by service/reception filters). */
function useCurrentStaffId() {
  const { user } = useAuth();
  const { staff } = useAppointments();
  return useMemo(() => {
    if (!user) return null;
    if (user.staffId) return user.staffId;
    const match = staff.find(
      (s) => s.name?.toLowerCase() === (user.name || '').toLowerCase(),
    );
    return match ? match.id : null;
  }, [user, staff]);
}

export function useVisibleGuestLog() {
  const { user } = useAuth();
  const { guestLog, staff } = useAppointments();
  return useMemo(
    () => filterGuestLog(guestLog, user, staff),
    [guestLog, user, staff],
  );
}

export function useVisibleAppointments() {
  const { user } = useAuth();
  const { appointments, staff } = useAppointments();
  return useMemo(
    () => filterAppointments(appointments, user, staff),
    [appointments, user, staff],
  );
}

export function useVisibleServices() {
  const { user } = useAuth();
  const { services, staff } = useAppointments();
  return useMemo(
    () => filterServices(services, user, staff),
    [services, user, staff],
  );
}

export function useVisibleNotifications() {
  const { user } = useAuth();
  const { notifications } = useNotifications();
  const currentStaffId = useCurrentStaffId();
  return useMemo(
    () => filterNotifications(notifications, user, currentStaffId),
    [notifications, user, currentStaffId],
  );
}

/**
 * Org-scoped collections. Rooms, bookings and staff are physical resources
 * each tenant owns privately, so every caller gets the org-filtered view.
 * Super Admin short-circuits inside filterByOrg and sees everything.
 */
export function useVisibleRooms() {
  const { user } = useAuth();
  const { rooms } = useAppointments();
  return useMemo(() => filterByOrg(rooms, user), [rooms, user]);
}

export function useVisibleBookings() {
  const { user } = useAuth();
  const { bookings } = useAppointments();
  return useMemo(() => filterByOrg(bookings, user), [bookings, user]);
}

export function useVisibleStaff() {
  const { user } = useAuth();
  const { staff } = useAppointments();
  return useMemo(() => filterByOrg(staff, user), [staff, user]);
}

/**
 * Metrics derived from the already-filtered datasets, so Dashboard stats
 * can never leak counts from outside the user's scope.
 */
export function useScopedMetrics() {
  const guestLog     = useVisibleGuestLog();
  const appointments = useVisibleAppointments();
  const services     = useVisibleServices();
  return useMemo(
    () => computeScopedMetrics({ guestLog, appointments, services }),
    [guestLog, appointments, services],
  );
}
