import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { MOCK_APPOINTMENTS, STAFF_LIST } from '../data/mockAppointments';
import { MOCK_SERVICES, SERVICE_TYPES } from '../data/mockServices';
import { MOCK_ROOMS, MOCK_BOOKINGS } from '../data/mockRooms';
import { getUserOrgId } from '../utils/visibilityFilters';
import { hasPermission, PermissionError } from '../utils/defaultPermissions';
import { useNotifications } from './NotificationContext';
import { useLog } from './LogContext';
import { useAuth } from './AuthContext';
import {
  createAppointmentImpl,
  updateAppointmentImpl,
  approveAppointmentImpl,
  rejectAppointmentImpl,
  deleteAppointmentImpl,
} from './appointmentCrud';
import {
  checkInAppointmentImpl,
  checkOutAppointmentImpl,
  checkOutVisitorImpl,
  recordGuestResponseImpl,
} from './appointmentStatus';
import {
  createServiceImpl,
  startServiceImpl,
  completeServiceImpl,
  updateServiceImpl,
  deleteServiceImpl,
} from './serviceActions';
import {
  findConflictImpl,
  createBookingImpl,
  cancelBookingImpl,
  deleteBookingImpl,
  updateRoomStatusImpl,
} from './roomActions';
import {
  runReminderCheck,
  walkInCheckInImpl,
  markNoShowImpl,
  computeMetrics,
} from './appointmentMisc';

const AppointmentContext = createContext(null);

function makeId(prefix = 'id') {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const nowIso = () => new Date().toISOString();

export function AppointmentProvider({ children, initial = MOCK_APPOINTMENTS }) {
  const [appointments, setAppointments] = useState(initial);
  const [guestLog, setGuestLog] = useState(() =>
    (initial || [])
      .filter((a) => a.status === 'Inside')
      .map((a) => ({
        id: makeId('gl'),
        appointmentId: a.id,
        guestName: a.guestName,
        company: a.companyName,
        contactNumber: a.contactNumber,
        host: a.host,
        purpose: a.purpose,
        type: 'Appointment',
        checkInTime: nowIso(),
        checkOutTime: null,
        status: 'Inside',
      })),
  );
  const [services, setServices] = useState(MOCK_SERVICES);
  const [rooms, setRooms] = useState(MOCK_ROOMS);
  const [bookings, setBookings] = useState(MOCK_BOOKINGS);
  const [toasts, setToasts] = useState([]);
  const [loading, setLoading] = useState(true);

  const { addNotification } = useNotifications();
  const { addLog } = useLog();
  const { user } = useAuth();
  const orgIdRef = useRef(getUserOrgId(user) || 'org-1');
  useEffect(() => {
    orgIdRef.current = getUserOrgId(user) || 'org-1';
  }, [user]);
  const resolveOrgId = useCallback(() => orgIdRef.current, []);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    runReminderCheck(appointments, addLog);
    const id = setInterval(() => runReminderCheck(appointments, addLog), 60_000);
    return () => clearInterval(id);
  }, [appointments, addLog]);

  const notify = useCallback((message, type = 'success') => {
    const id = makeId('toast');
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const guard = useCallback((moduleKey, action) => {
    const role = (user?.role || '').toString();
    const orgId = user?.organisationId || user?.orgId || null;
    if (hasPermission(role, moduleKey, action, { orgId })) return true;
    notify(`Permission denied: your role cannot ${action} on ${moduleKey}.`, 'error');
    throw new PermissionError(moduleKey, action, role || 'anonymous');
  }, [user, notify]);

  /* Appointment CRUD */
  const createAppointment = useCallback(
    (form) => createAppointmentImpl(form, { setAppointments, resolveOrgId, notify, addNotification, addLog, guard }),
    [resolveOrgId, notify, addNotification, addLog, guard],
  );
  const updateAppointment = useCallback(
    (id, patch) => updateAppointmentImpl(id, patch, { setAppointments, notify, addLog, guard }),
    [notify, addLog, guard],
  );
  const approveAppointment = useCallback(
    (id) => approveAppointmentImpl(id, { setAppointments, notify, addNotification, addLog, guard }),
    [notify, addNotification, addLog, guard],
  );
  const rejectAppointment = useCallback(
    (id) => rejectAppointmentImpl(id, { setAppointments, notify, addNotification, addLog, guard }),
    [notify, addNotification, addLog, guard],
  );
  const deleteAppointment = useCallback(
    (id) => deleteAppointmentImpl(id, { setAppointments, setGuestLog, notify, addLog, guard }),
    [notify, addLog, guard],
  );

  /* Status transitions */
  const checkInAppointment = useCallback(
    (id) => checkInAppointmentImpl(id, { setAppointments, setGuestLog, resolveOrgId, notify, addNotification, addLog, guard }),
    [resolveOrgId, notify, addNotification, addLog, guard],
  );
  const checkOutAppointment = useCallback(
    (id) => checkOutAppointmentImpl(id, { setAppointments, setGuestLog, notify, addLog, guard }),
    [notify, addLog, guard],
  );
  const checkOutVisitor = useCallback(
    (guestLogId) => checkOutVisitorImpl(guestLogId, { setAppointments, setGuestLog, notify, addLog, guard }),
    [notify, addLog, guard],
  );
  const recordGuestResponse = useCallback(
    (id, response) => recordGuestResponseImpl(id, response, { setAppointments, notify, addNotification, addLog, guard }),
    [notify, addNotification, addLog, guard],
  );

  /* Walk-in + misc */
  const walkInCheckIn = useCallback(
    (form) => walkInCheckInImpl(form, { setGuestLog, resolveOrgId, notify, addNotification, addLog, guard }),
    [resolveOrgId, notify, addNotification, addLog, guard],
  );
  const markNoShow = useCallback(
    (id) => markNoShowImpl(id, { setAppointments, notify, addLog, guard }),
    [notify, addLog, guard],
  );

  /* Services */
  const createService = useCallback(
    (form) => createServiceImpl(form, { setServices, guestLog, resolveOrgId, notify, addNotification, addLog, guard }),
    [guestLog, resolveOrgId, notify, addNotification, addLog, guard],
  );
  const startService = useCallback(
    (id, actor = {}) => startServiceImpl(id, actor, { setServices, notify, addNotification, addLog, guard }),
    [notify, addNotification, addLog, guard],
  );
  const completeService = useCallback(
    (id, actor = {}) => completeServiceImpl(id, actor, { setServices, notify, addNotification, addLog, guard }),
    [notify, addNotification, addLog, guard],
  );
  const updateService = useCallback(
    (id, patch) => updateServiceImpl(id, patch, { setServices, notify, addLog, guard }),
    [notify, addLog, guard],
  );
  const deleteService = useCallback(
    (id) => deleteServiceImpl(id, { setServices, notify, addLog, guard }),
    [notify, addLog, guard],
  );

  /* Rooms + Bookings */
  const findConflict = useCallback(
    (draft, skipId = null) => findConflictImpl(draft, skipId, bookings),
    [bookings],
  );
  const createBooking = useCallback(
    (form) => createBookingImpl(form, { setBookings, rooms, findConflict, resolveOrgId, notify, addNotification, addLog, guard }),
    [rooms, findConflict, resolveOrgId, notify, addNotification, addLog, guard],
  );
  const cancelBooking = useCallback(
    (id) => cancelBookingImpl(id, { setBookings, notify, addLog, guard }),
    [notify, addLog, guard],
  );
  const deleteBooking = useCallback(
    (id) => deleteBookingImpl(id, { setBookings, notify, addLog, guard }),
    [notify, addLog, guard],
  );
  const updateRoomStatus = useCallback(
    (id, status) => updateRoomStatusImpl(id, status, { setRooms, notify, addLog, guard }),
    [notify, addLog, guard],
  );

  const metrics = useMemo(
    () => computeMetrics({ appointments, guestLog, services, rooms, bookings }),
    [appointments, guestLog, services, rooms, bookings],
  );

  const value = useMemo(() => ({
    appointments, guestLog, services, serviceTypes: SERVICE_TYPES, staff: STAFF_LIST,
    toasts, loading, metrics, notify, dismissToast,
    createAppointment, updateAppointment, deleteAppointment,
    approveAppointment, rejectAppointment,
    checkInAppointment, checkOutAppointment, markNoShow, recordGuestResponse,
    walkInCheckIn, checkOutVisitor,
    createService, updateService, startService, completeService, deleteService,
    rooms, bookings, createBooking, cancelBooking, deleteBooking, updateRoomStatus, findConflict,
  }), [
    appointments, guestLog, services, toasts, loading, metrics, notify, dismissToast,
    createAppointment, updateAppointment, deleteAppointment,
    approveAppointment, rejectAppointment,
    checkInAppointment, checkOutAppointment, markNoShow, recordGuestResponse,
    walkInCheckIn, checkOutVisitor,
    createService, updateService, startService, completeService, deleteService,
    rooms, bookings, createBooking, cancelBooking, deleteBooking, updateRoomStatus, findConflict,
  ]);

  return (
    <AppointmentContext.Provider value={value}>
      {children}
    </AppointmentContext.Provider>
  );
}

export function useAppointments() {
  const ctx = useContext(AppointmentContext);
  if (!ctx) {
    throw new Error('useAppointments must be used inside <AppointmentProvider>');
  }
  return ctx;
}

export function ToastHost() {
  const { toasts, dismissToast } = useAppointments();
  if (!toasts.length) return null;
  const tone = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    info:    'border-blue-200 bg-blue-50 text-blue-700',
    warn:    'border-amber-200 bg-amber-50 text-amber-700',
    error:   'border-red-200 bg-red-50 text-red-700',
  };
  return (
    <div className="fixed right-4 top-4 z-[10000] flex flex-col gap-2">
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => dismissToast(t.id)}
          className={`max-w-sm rounded-lg border px-4 py-3 text-left text-sm shadow-lg ${tone[t.type] || tone.success}`}
        >
          {t.message}
        </button>
      ))}
    </div>
  );
}
