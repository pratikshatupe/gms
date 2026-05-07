import { STAFF_LIST } from '../data/mockAppointments';
import { authorizeTransition } from '../utils/servicePermissions';

const nowIso = () => new Date().toISOString();

function makeId(prefix = 'id') {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createServiceImpl(form, { setServices, guestLog, resolveOrgId, notify, addNotification, addLog, guard }) {
  guard('services', 'create');
  const visitor = form.visitorLogId
    ? guestLog.find((g) => g.id === form.visitorLogId)
    : null;
  if (!visitor || visitor.status !== 'Inside') {
    notify('Cannot create service: visitor is not checked in.', 'error');
    return null;
  }
  const staff = STAFF_LIST.find((s) => s.id === form.assignedStaffId);
  if (!staff) {
    notify('Cannot create service: please select a valid staff member.', 'error');
    return null;
  }
  if ((staff.role || '').toLowerCase() !== 'service staff') {
    notify('Services can only be assigned to Service Staff.', 'error');
    return null;
  }
  const next = {
    id:              makeId('svc'),
    visitorName:     visitor.guestName,
    visitorLogId:    visitor.id,
    serviceType:     form.serviceType,
    assignedStaffId: staff.id,
    assignedStaff:   staff.name,
    assignedTo:      staff.name,
    notes:           (form.notes || '').trim(),
    status:          'Pending',
    createdAt:       nowIso(),
    orgId:           visitor.orgId || form.orgId || resolveOrgId(),
  };
  setServices((prev) => [...prev, next]);
  notify('Service request created successfully.', 'success');
  addNotification({
    message: `New service request: ${next.serviceType} for ${next.visitorName}.`,
    type: 'service',
    staffId: next.assignedStaffId,
  });
  addLog({
    action:   'Service Created',
    module:   'Services',
    metadata: {
      visitorName:   next.visitorName,
      serviceType:   next.serviceType,
      assignedStaff: next.assignedStaff,
    },
  });
  return next;
}

export function startServiceImpl(id, actor, { setServices, notify, addNotification, addLog, guard }) {
  guard('services', 'edit');
  setServices((prev) => {
    const svc = prev.find((s) => s.id === id);
    if (!svc) return prev;
    if (!authorizeTransition(actor, svc)) {
      notify('You are not permitted to start this service.', 'error');
      return prev;
    }
    if (svc.status !== 'Pending') {
      notify(
        svc.status === 'In Progress'
          ? 'This service is already in progress.'
          : 'Only pending services can be started.',
        'error',
      );
      return prev;
    }
    notify('Service started', 'info');
    addNotification({
      message: `Service started: ${svc.serviceType} for ${svc.visitorName}.`,
      type: 'service',
      staffId: svc.assignedStaffId,
    });
    addLog({
      action:   'Service Started',
      module:   'Services',
      metadata: {
        visitorName:   svc.visitorName,
        serviceType:   svc.serviceType,
        assignedStaff: svc.assignedStaff,
      },
    });
    return prev.map((s) =>
      s.id === id ? { ...s, status: 'In Progress', startedAt: nowIso() } : s,
    );
  });
}

export function completeServiceImpl(id, actor, { setServices, notify, addNotification, addLog, guard }) {
  guard('services', 'edit');
  setServices((prev) => {
    const svc = prev.find((s) => s.id === id);
    if (!svc) return prev;
    if (!authorizeTransition(actor, svc)) {
      notify('You are not permitted to complete this service.', 'error');
      return prev;
    }
    if (svc.status !== 'In Progress') {
      notify(
        svc.status === 'Pending'
          ? 'Start the service before completing it.'
          : 'This service is already completed.',
        'error',
      );
      return prev;
    }
    notify('Service completed', 'success');
    addNotification({
      message: `Service completed: ${svc.serviceType} for ${svc.visitorName}.`,
      type: 'service',
      staffId: svc.assignedStaffId,
    });
    addLog({
      action:   'Service Completed',
      module:   'Services',
      metadata: {
        visitorName:   svc.visitorName,
        serviceType:   svc.serviceType,
        assignedStaff: svc.assignedStaff,
      },
    });
    return prev.map((s) =>
      s.id === id ? { ...s, status: 'Completed', completedAt: nowIso() } : s,
    );
  });
}

export function updateServiceImpl(id, patch, { setServices, notify, addLog, guard }) {
  guard('services', 'edit');
  const next = {};
  if (typeof patch.serviceType === 'string') next.serviceType = patch.serviceType;
  if (typeof patch.notes === 'string')       next.notes       = patch.notes.trim();
  if (typeof patch.assignedStaffId === 'string') {
    const staff = STAFF_LIST.find((s) => s.id === patch.assignedStaffId);
    if (!staff) {
      notify('Cannot update service: please select a valid staff member.', 'error');
      return;
    }
    if ((staff.role || '').toLowerCase() !== 'service staff') {
      notify('Services can only be assigned to Service Staff.', 'error');
      return;
    }
    next.assignedStaffId = staff.id;
    next.assignedStaff   = staff.name;
    next.assignedTo      = staff.name;
  }
  if (Object.keys(next).length === 0) return;
  setServices((prev) => {
    const svc = prev.find((s) => s.id === id);
    if (svc) {
      addLog({
        action:   'Service Updated',
        module:   'Services',
        metadata: {
          visitorName: svc.visitorName,
          serviceType: next.serviceType || svc.serviceType,
        },
      });
    }
    return prev.map((s) => (s.id === id ? { ...s, ...next } : s));
  });
  notify('Service updated successfully.', 'success');
}

export function deleteServiceImpl(id, { setServices, notify, addLog, guard }) {
  guard('services', 'delete');
  setServices((prev) => {
    const svc = prev.find((s) => s.id === id);
    if (svc) {
      addLog({
        action:   'Service Deleted',
        module:   'Services',
        metadata: { visitorName: svc.visitorName, serviceType: svc.serviceType },
      });
    }
    return prev.filter((s) => s.id !== id);
  });
  notify('Service removed.', 'success');
}
