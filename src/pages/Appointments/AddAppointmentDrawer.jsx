import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X, UserRound, Calendar, Sparkles, Mail, Loader2, AlertTriangle,
} from 'lucide-react';
import { Field, SearchableSelect, Toast } from '../../components/ui';
import { useCollection, STORAGE_KEYS } from '../../store';
import {
  MOCK_APPOINTMENTS, stampLegacyAliases,
} from '../../data/mockAppointments';
import {
  MOCK_ORGANIZATIONS, MOCK_OFFICES, MOCK_STAFF, MOCK_ROOMS, MOCK_SERVICES,
} from '../../data/mockData';
import { addAuditLog } from '../../utils/auditLogger';
import { useNotificationTriggers } from '../../utils/notificationTriggers';
import { previewEmail, generateAppointmentInviteEmail } from '../../utils/emailTemplates';
/* Phase 2 strict validators for visitor identity fields. */
import {
  validateName as validatePersonNameStrict,
  validateEmail as validateEmailStrict,
  validatePhoneIndian,
} from '../../utils/validators';
import {
  byOrg, VISITOR_TYPES, APPROVAL_MODES, DEFAULT_CHECKIN_SETTINGS,
  resolveApprovalRequired, detectRoomConflict, detectHostConflict,
  todayIso, addDaysIso, getTimezoneAbbr, to12hAmPm,
} from '../../utils/appointmentState';
import {
  resolveCurrencyForOrg, formatServicePrice,
} from '../Services/AddServiceDrawer';

export const DURATION_PRESETS = [
  { label: '15 minutes', mins: 15 },
  { label: '30 minutes', mins: 30 },
  { label: '45 minutes', mins: 45 },
  { label: '1 hour', mins: 60 },
  { label: '2 hours', mins: 120 },
];

export const VISITOR_TYPE_META = Object.freeze({
  Regular: { icon: '👤', tone: 'violet' },
  VIP: { icon: '⭐', tone: 'amber' },
  Vendor: { icon: '🧰', tone: 'blue' },
  Delivery: { icon: '📦', tone: 'teal' },
});

export const INVITATION_DEFAULT = Object.freeze({
  sendEmail: true,
  includeQRCode: true,
  smsReminder: false,
});

const isBlank = (v) => v == null || String(v).trim().length === 0;
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const NAME_RE = /^[A-Za-z .'-]+$/;
const COMPANY_RE = /^[A-Za-z0-9 .,&()'/-]+$/;
const DESIGNATION_RE = /^[A-Za-z0-9 .,&()'/-]+$/;

function normalizeSpaces(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function sanitizePersonName(value) {
  return String(value || '')
    .replace(/[^A-Za-z .'-]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^\s+/g, '')
    /* Phase 2 spec: visitor name max 50 characters. */
    .slice(0, 50);
}

function sanitizeEmail(value) {
  /* Phase 2 spec: lowercase + strip ALL whitespace (not just trim). */
  return String(value || '').replace(/\s+/g, '').toLowerCase().slice(0, 200);
}

function sanitizePhone(value) {
  let v = String(value || '').replace(/[^\d+\s-]/g, '');
  v = v.replace(/(?!^)\+/g, '');
  v = v.replace(/\s+/g, ' ').trim();
  return v.slice(0, 20);
}

function sanitizeCompanyName(value) {
  return String(value || '')
    .replace(/[^A-Za-z0-9 .,&()'/-]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^\s+/g, '')
    .slice(0, 100);
}

function sanitizeDesignation(value) {
  return String(value || '')
    .replace(/[^A-Za-z0-9 .,&()'/-]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^\s+/g, '')
    .slice(0, 80);
}

function sanitizeCount(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 2);
  if (digits === '') return '';
  const n = Math.min(10, Number(digits));
  return String(n);
}

function sanitizeTextArea(value, max = 500) {
  return String(value || '').replace(/\s+/g, ' ').trimStart().slice(0, max);
}

function sanitizeInvitation(value) {
  return {
    sendEmail: Boolean(value?.sendEmail),
    includeQRCode: Boolean(value?.includeQRCode),
    smsReminder: Boolean(value?.smsReminder),
  };
}

export function validateAppointmentForm(form, opts = {}) {
  const {
    userOffices = [],
    orgStaff = [],
    orgRooms = [],
    orgServices = [],
  } = opts;

  const e = {};
  const v = form.visitor || {};

  const visitorName = normalizeSpaces(v.fullName);
  const email = sanitizeEmail(v.emailId);
  const contact = sanitizePhone(v.contactNumber);
  const contactDigits = contact.replace(/\D/g, '');
  const companyName = normalizeSpaces(v.companyName);
  const designation = normalizeSpaces(v.designation);
  const purpose = normalizeSpaces(form.purpose);
  const notes = normalizeSpaces(form.notes);

  const officeIds = new Set((userOffices || []).map((o) => o.id));
  const activeStaffIds = new Set(
    (orgStaff || []).filter((s) => s?.status !== 'Inactive').map((s) => s.id)
  );
  const activeRoomIdsForOffice = new Set(
    (orgRooms || [])
      .filter(
        (r) =>
          r?.officeId === form.officeId &&
          String(r?.status || 'Active') === 'Active' &&
          r?.bookableByVisitors !== false
      )
      .map((r) => r.id)
  );
  const activeServiceIdsForOffice = new Set(
    (orgServices || [])
      .filter(
        (s) =>
          s?.status === 'Active' &&
          Array.isArray(s.availableOfficeIds) &&
          s.availableOfficeIds.includes(form.officeId)
      )
      .map((s) => s.id)
  );

  /* Phase 2 spec: 2–50 letters/spaces/dots/hyphens/apostrophes,
   * starting with a letter. */
  const nameErr = validatePersonNameStrict(visitorName, { label: 'Visitor Name', min: 2, max: 50 });
  if (nameErr) e['visitor.fullName'] = nameErr;

  /* Visitor email is conditionally required: blank is fine ONLY when
   * the user has explicitly turned off "Send invitation email" on the
   * Invitation card. The strict format check still runs whenever a
   * value is present so a typo doesn't slip through. */
  const wantsInviteEmail = Boolean(form.invitation?.sendEmail);
  if (!email) {
    if (wantsInviteEmail) {
      e['visitor.emailId'] = 'Email ID is required when "Send invitation email" is enabled.';
    }
  } else {
    const emailErr = validateEmailStrict(email, { label: 'Email ID' });
    if (emailErr) e['visitor.emailId'] = emailErr;
  }

  /* Phase 2 spec: exactly 10 digits, starts with 6/7/8/9, blocks known
   * fakes. The setField pipeline still allows users to type spaces/
   * hyphens — the validator strips non-digits internally. */
  const phoneErr = validatePhoneIndian(contactDigits, { label: 'Contact Number' });
  if (phoneErr) e['visitor.contactNumber'] = phoneErr;

  if (companyName && companyName.length > 100) {
    e['visitor.companyName'] = 'Company Name must be 100 characters or fewer.';
  } else if (companyName && !COMPANY_RE.test(companyName)) {
    e['visitor.companyName'] = 'Company Name contains unsupported characters.';
  }

  if (designation && designation.length > 80) {
    e['visitor.designation'] = 'Designation must be 80 characters or fewer.';
  } else if (designation && !DESIGNATION_RE.test(designation)) {
    e['visitor.designation'] = 'Designation contains unsupported characters.';
  }

  if (!VISITOR_TYPES.includes(v.visitorType)) {
    e['visitor.visitorType'] = 'Visitor Type is required.';
  }

  if (v.visitorType !== 'Delivery') {
    const acc = Number(v.accompanyingCount);
    if (
      v.accompanyingCount === '' ||
      !Number.isFinite(acc) ||
      !Number.isInteger(acc) ||
      acc < 0 ||
      acc > 10
    ) {
      e['visitor.accompanyingCount'] = 'Accompanying Count must be 0 to 10.';
    }
  }

  if (isBlank(form.officeId)) {
    e.officeId = 'Office is required.';
  } else if (!officeIds.has(form.officeId)) {
    e.officeId = 'Selected office is invalid.';
  }

  if (v.visitorType !== 'Delivery') {
    if (isBlank(form.hostUserId)) {
      e.hostUserId = 'Host is required.';
    } else if (!activeStaffIds.has(form.hostUserId)) {
      e.hostUserId = 'Selected host is invalid.';
    }
  }

  if (isBlank(form.purpose)) {
    e.purpose = 'Purpose of Visit is required.';
  } else if (purpose.length < 10) {
    e.purpose = 'Purpose of Visit must be at least 10 characters.';
  } else if (purpose.length > 500) {
    e.purpose = 'Purpose of Visit must be 500 characters or fewer.';
  }

  if (isBlank(form.scheduledDate)) {
    e.scheduledDate = 'Scheduled Date is required.';
  } else {
    const d = new Date(`${form.scheduledDate}T00:00:00`);
    const today = new Date(`${todayIso()}T00:00:00`);
    const max = new Date(`${addDaysIso(180)}T00:00:00`);
    if (Number.isNaN(d.getTime())) {
      e.scheduledDate = 'Please enter a valid Scheduled Date.';
    } else if (d < today) {
      e.scheduledDate = 'Scheduled Date cannot be in the past.';
    } else if (d > max) {
      e.scheduledDate = 'Scheduled Date cannot be more than 180 days in the future.';
    }
  }

  if (isBlank(form.startTime) || !/^\d{2}:\d{2}$/.test(form.startTime)) {
    e.startTime = 'Start Time is required.';
  }

  if (isBlank(form.endTime) || !/^\d{2}:\d{2}$/.test(form.endTime)) {
    e.endTime = 'End Time is required.';
  }

  if (form.startTime && form.endTime && form.endTime <= form.startTime) {
    e.endTime = 'End Time must be later than Start Time.';
  }

  if (form.roomId && !activeRoomIdsForOffice.has(form.roomId)) {
    e.roomId = 'Selected room is invalid for the chosen office.';
  }

  if (!Array.isArray(form.servicesPrebooked)) {
    e.servicesPrebooked = 'Selected services are invalid.';
  } else {
    const invalidService = form.servicesPrebooked.some((id) => !activeServiceIdsForOffice.has(id));
    if (invalidService) {
      e.servicesPrebooked = 'One or more selected services are invalid for this office.';
    }
  }

  if (notes.length > 500) {
    e.notes = 'Notes must be 500 characters or fewer.';
  }

  return e;
}

export function emptyAppointmentShape() {
  return {
    officeId: '',
    hostUserId: '',
    roomId: '',
    visitor: {
      fullName: '',
      emailId: '',
      contactNumber: '',
      companyName: '',
      designation: '',
      visitorType: 'Regular',
      accompanyingCount: 0,
    },
    purpose: '',
    scheduledDate: todayIso(),
    startTime: '10:00',
    endTime: '11:00',
    servicesPrebooked: [],
    notes: '',
    invitation: { ...INVITATION_DEFAULT },
  };
}

export function estimateServiceCost(serviceIds, services, currency) {
  if (!Array.isArray(serviceIds) || serviceIds.length === 0) {
    return { amount: 0, chargeable: 0, formatted: formatServicePrice(0, currency) };
  }

  let amount = 0;
  let chargeable = 0;

  for (const id of serviceIds) {
    const svc = services.find((s) => s?.id === id);
    if (!svc || !svc.chargeable) continue;
    chargeable += 1;
    amount += Number(svc.price) || 0;
  }

  return {
    amount,
    chargeable,
    formatted: formatServicePrice(amount, currency),
  };
}

export default function AddAppointmentDrawer({
  open, onClose, onCreated, currentUser, prefillDate,
}) {
  const [appointments, addAppt] = useCollection(STORAGE_KEYS.APPOINTMENTS, MOCK_APPOINTMENTS);
  const { fireVipPending } = useNotificationTriggers();
  const [officesAll] = useCollection(STORAGE_KEYS.OFFICES, MOCK_OFFICES);
  const [staffAll] = useCollection(STORAGE_KEYS.STAFF, MOCK_STAFF);
  const [roomsAll] = useCollection(STORAGE_KEYS.ROOMS, MOCK_ROOMS);
  const [servicesAll] = useCollection(STORAGE_KEYS.SERVICES, MOCK_SERVICES);
  const [orgsAll] = useCollection(STORAGE_KEYS.ORGANIZATIONS, MOCK_ORGANIZATIONS);
  const orgId = currentUser?.organisationId || currentUser?.orgId || null;

  const userOffices = useMemo(
    () =>
      byOrg(officesAll, currentUser)
        .filter((o) => String(o?.status || 'Active') !== 'Inactive')
        .sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [officesAll, currentUser]
  );

  const orgStaff = useMemo(() => byOrg(staffAll, currentUser), [staffAll, currentUser]);
  const orgRooms = useMemo(() => byOrg(roomsAll, currentUser), [roomsAll, currentUser]);
  const orgServices = useMemo(() => byOrg(servicesAll, currentUser), [servicesAll, currentUser]);
  const orgAppointments = useMemo(() => byOrg(appointments, currentUser), [appointments, currentUser]);
  const org = useMemo(
    () => (orgsAll || []).find((o) => o?.id === orgId) || null,
    [orgsAll, orgId]
  );
  const currency = resolveCurrencyForOrg(org);

  const [form, setForm] = useState(() => {
    const base = emptyAppointmentShape();
    if (userOffices.length === 1) base.officeId = userOffices[0].id;
    if (prefillDate) base.scheduledDate = prefillDate;
    return base;
  });

  const [errors, setErrors] = useState({});
  const [allowDoubleBook, setAllowDouble] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [typeChangeConfirm, setTypeConfirm] = useState(null);
  const closeBtnRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const base = emptyAppointmentShape();
    if (userOffices.length === 1) base.officeId = userOffices[0].id;
    if (prefillDate) base.scheduledDate = prefillDate;
    setForm(base);
    setErrors({});
    setSaving(false);
    setAllowDouble(false);
    setTypeConfirm(null);
  }, [open, userOffices, prefillDate]);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape' && !saving) onClose?.();
    };
    document.addEventListener('keydown', onKey);
    const t = window.setTimeout(() => closeBtnRef.current?.focus(), 30);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
      window.clearTimeout(t);
    };
  }, [open, saving, onClose]);

  if (!open) return null;

  const setField = (path, value) => {
    let nextValue = value;

    if (path === 'visitor.fullName') nextValue = sanitizePersonName(value);
    if (path === 'visitor.emailId') nextValue = sanitizeEmail(value);
    if (path === 'visitor.contactNumber') nextValue = sanitizePhone(value);
    if (path === 'visitor.companyName') nextValue = sanitizeCompanyName(value);
    if (path === 'visitor.designation') nextValue = sanitizeDesignation(value);
    if (path === 'visitor.accompanyingCount') nextValue = sanitizeCount(value);
    if (path === 'purpose') nextValue = sanitizeTextArea(value, 500);
    if (path === 'notes') nextValue = sanitizeTextArea(value, 500);
    if (path === 'invitation') nextValue = sanitizeInvitation(value);

    setForm((f) => {
      const next = { ...f };
      const parts = path.split('.');
      if (parts.length === 1) {
        next[parts[0]] = nextValue;
      } else {
        next[parts[0]] = { ...next[parts[0]], [parts[1]]: nextValue };
      }
      return next;
    });

    if (errors[path]) {
      setErrors((e) => {
        const n = { ...e };
        delete n[path];
        return n;
      });
    }
  };

  const toggleService = (svcId) => {
    setForm((f) => {
      const set = new Set(f.servicesPrebooked || []);
      if (set.has(svcId)) set.delete(svcId);
      else set.add(svcId);
      return { ...f, servicesPrebooked: [...set] };
    });

    if (errors.servicesPrebooked) {
      setErrors((e) => {
        const n = { ...e };
        delete n.servicesPrebooked;
        return n;
      });
    }
  };

  const requestTypeChange = (newType) => {
    const current = form.visitor?.visitorType;
    if (current === newType) return;

    const hadDeps =
      form.hostUserId || form.roomId || (form.servicesPrebooked || []).length > 0;

    if (hadDeps && (current === 'Delivery' || newType === 'Delivery')) {
      setTypeConfirm(newType);
      return;
    }

    commitTypeChange(newType);
  };

  const commitTypeChange = (newType) => {
    setForm((f) => ({
      ...f,
      visitor: {
        ...f.visitor,
        visitorType: newType,
      },
      ...(newType === 'Delivery'
        ? { hostUserId: '', roomId: '', servicesPrebooked: [] }
        : {}),
    }));
    setTypeConfirm(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;

    const cleanedForm = {
      ...form,
      visitor: {
        ...form.visitor,
        fullName: normalizeSpaces(form.visitor?.fullName),
        emailId: sanitizeEmail(form.visitor?.emailId),
        contactNumber: sanitizePhone(form.visitor?.contactNumber),
        companyName: normalizeSpaces(form.visitor?.companyName),
        designation: normalizeSpaces(form.visitor?.designation),
        accompanyingCount:
          form.visitor?.accompanyingCount === ''
            ? 0
            : Number(form.visitor?.accompanyingCount || 0),
      },
      purpose: normalizeSpaces(form.purpose),
      notes: normalizeSpaces(form.notes),
      invitation: sanitizeInvitation(form.invitation),
    };

    const e = validateAppointmentForm(cleanedForm, {
      userOffices,
      orgStaff,
      orgRooms,
      orgServices,
    });

    if (Object.keys(e).length) {
      setErrors(e);
      setToast({ type: 'error', msg: 'Please fix the highlighted fields and try again.' });
      return;
    }

    const roomConflicts = detectRoomConflict(cleanedForm, orgAppointments);
    const hostConflicts = detectHostConflict(cleanedForm, orgAppointments);

    if (!allowDoubleBook && (roomConflicts.length || hostConflicts.length)) {
      const nextErrors = {};
      if (roomConflicts.length) {
        const c = roomConflicts[0];
        nextErrors.roomId = `${(orgRooms.find((r) => r.id === cleanedForm.roomId) || {}).name || 'This room'} is booked by ${c.visitor?.fullName || c.guestName || 'another visitor'} ${to12hAmPm(c.startTime)} – ${to12hAmPm(c.endTime)}.`;
      }
      if (hostConflicts.length) {
        const c = hostConflicts[0];
        const hostName =
          (orgStaff.find((s) => s.id === cleanedForm.hostUserId) || {}).fullName ||
          (orgStaff.find((s) => s.id === cleanedForm.hostUserId) || {}).name ||
          'The host';
        nextErrors.hostUserId = `${hostName} has another meeting ${to12hAmPm(c.startTime)} – ${to12hAmPm(c.endTime)}.`;
      }
      nextErrors.__conflict = true;
      setErrors(nextErrors);
      setToast({ type: 'error', msg: 'Scheduling conflict detected. Review the flagged fields.' });
      return;
    }

    setSaving(true);
    await new Promise((r) => setTimeout(r, 800));

    const nextSeq =
      (appointments || [])
        .map((a) => Number(String(a?.id || '').replace(/\D/g, '')))
        .filter((n) => Number.isFinite(n))
        .reduce((a, b) => Math.max(a, b), 0) + 1;

    const id = `APT-${String(nextSeq).padStart(5, '0')}`;
    const now = new Date().toISOString();
    const author = currentUser?.name || 'Unknown';

    const approvalDecision = resolveApprovalRequired({
      draft: cleanedForm,
      org,
      operator: currentUser,
      orgStaff,
    });

    const record = stampLegacyAliases({
      id,
      orgId,
      officeId: cleanedForm.officeId,
      roomId: cleanedForm.roomId || null,
      hostUserId: cleanedForm.hostUserId || null,
      visitor: { ...cleanedForm.visitor },
      purpose: cleanedForm.purpose,
      scheduledDate: cleanedForm.scheduledDate,
      startTime: cleanedForm.startTime,
      endTime: cleanedForm.endTime,
      servicesPrebooked: [...(cleanedForm.servicesPrebooked || [])],
      notes: cleanedForm.notes,
      invitation: { ...cleanedForm.invitation },
      status: approvalDecision.initialStatus,
      approvalRequired: approvalDecision.approvalRequired,
      approvalMode: approvalDecision.approvalMode,
      approvedBy: approvalDecision.selfApproved ? author : null,
      approvedAt: approvalDecision.selfApproved ? now : null,
      checkedInAt: null,
      checkedInBy: null,
      checkedOutAt: null,
      checkedOutBy: null,
      startedAt: null,
      startedBy: null,
      cancelledAt: null,
      cancelledBy: null,
      cancellationReason: null,
      noShowAt: null,
      noShowBy: null,
      feedback: null,
      isRecurring: false,
      createdAt: now,
      createdBy: author,
      updatedAt: now,
      updatedBy: author,
    });

    addAppt(record);

    /* Bug 3 fix: actually send the invitation email when the user has
       opted in via the form toggle. previewEmail() logs the envelope
       AND POSTs to /api/v1/notifications/dispatch which triggers the
       backend SMTP send (or the dev fallback). */
    if (record.invitation?.sendEmail && record.visitor?.emailId) {
      try {
        const inviteEnvelope = generateAppointmentInviteEmail({
          visitorName:   record.visitor.fullName,
          scheduledDate: record.scheduledDate,
          startTime:     record.startTime,
          purpose:       record.purpose,
          orgName:       org?.name,
          orgCountry:    org?.country,
        });
        previewEmail({ to: record.visitor.emailId, ...inviteEnvelope });
      } catch (err) {
        console.error('[Appointments] failed to dispatch invitation email:', err);
      }
    }

    addAuditLog({
      userName: author,
      role: (currentUser?.role || '').toString(),
      action: 'APPOINTMENT_CREATED',
      module: 'Appointments',
      description: `Created ${record.visitor.visitorType} appointment ${id} for ${record.visitor.fullName} on ${record.scheduledDate} ${record.startTime}. Status: ${record.status}${approvalDecision.approvalMode ? ` (approval: ${approvalDecision.approvalMode})` : ''}.`,
      orgId,
    });

    if (approvalDecision.selfApprovedReason === 'VIP_SELF_APPROVED_SOLE_DIRECTOR') {
      addAuditLog({
        userName: author,
        role: (currentUser?.role || '').toString(),
        action: 'VIP_SELF_APPROVED',
        module: 'Appointments',
        description: `VIP appointment ${id} auto-approved — sole Director in the organisation.`,
        orgId,
      });
    }

    if (allowDoubleBook && (roomConflicts.length || hostConflicts.length)) {
      addAuditLog({
        userName: author,
        role: (currentUser?.role || '').toString(),
        action: roomConflicts.length ? 'APPOINTMENT_DOUBLE_BOOKED' : 'HOST_DOUBLE_BOOKED',
        module: 'Appointments',
        description: `Double-book override for ${id}. Room conflicts: ${roomConflicts.map((c) => c.id).join(', ') || 'none'}. Host conflicts: ${hostConflicts.map((c) => c.id).join(', ') || 'none'}.`,
        orgId,
      });
    }

    if (
      record.visitor?.visitorType === 'VIP' &&
      !approvalDecision.selfApproved &&
      approvalDecision.approvalRequired
    ) {
      const orgRecord = orgsAll.find((o) => o.id === orgId) || null;
      const directorEmails = (staffAll || [])
        .filter(
          (s) =>
            s.orgId === orgId &&
            (s.role || '').toLowerCase() === 'director' &&
            (s.email || s.emailId)
        )
        .map((s) => s.email || s.emailId);

      fireVipPending({
        apt: {
          id,
          visitorName: record.visitor.fullName,
          date: record.scheduledDate,
          timeStart: record.startTime,
          organisationId: orgId,
        },
        org: orgRecord,
        directorEmails,
      });
    }

    setSaving(false);
    onCreated?.(record);
  };

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-apt-title"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget && !saving) onClose?.();
        }}
        className="fixed inset-0 z-[9100] flex justify-end bg-black/45"
      >
        <aside
          className="flex h-full w-full max-w-[760px] flex-col bg-white shadow-2xl dark:bg-[#0A1828] sm:w-[760px]"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <Header
            closeBtnRef={closeBtnRef}
            title="New Appointment"
            subtitle="Schedule a visitor — invitation email can be sent automatically."
            onClose={onClose}
            disabled={saving}
          />

          <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
              <AppointmentFormBody
                form={form}
                errors={errors}
                setField={setField}
                onRequestTypeChange={requestTypeChange}
                onToggleService={toggleService}
                userOffices={userOffices}
                orgStaff={orgStaff}
                orgRooms={orgRooms}
                orgServices={orgServices}
                org={org}
                currency={currency}
                mode="create"
              />

              {errors.__conflict && !allowDoubleBook && (
                <div className="mt-3 rounded-[10px] border border-amber-300 bg-amber-50 px-3 py-2 dark:border-amber-500/30 dark:bg-amber-500/10">
                  <div className="flex items-start gap-2">
                    <AlertTriangle
                      size={14}
                      aria-hidden="true"
                      className="mt-0.5 shrink-0 text-amber-700 dark:text-amber-300"
                    />
                    <div className="flex-1">
                      <p className="text-[12px] font-bold text-amber-800 dark:text-amber-200">
                        Scheduling conflict detected.
                      </p>
                      <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">
                        Fix the flagged fields, or allow double-booking to proceed anyway.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setAllowDouble(true);
                          setErrors({});
                        }}
                        className="mt-2 inline-flex cursor-pointer items-center rounded-[8px] border border-sky-700 bg-sky-50 px-3 py-1 text-[11px] font-bold text-sky-700 transition hover:bg-sky-100 dark:border-sky-400/40 dark:bg-sky-500/15 dark:text-sky-300"
                      >
                        Proceed anyway
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <Footer saving={saving} submitLabel="Create Appointment" onCancel={onClose} />
          </form>
        </aside>
      </div>

      {typeChangeConfirm && (
        <TypeChangeConfirm
          newType={typeChangeConfirm}
          onCancel={() => setTypeConfirm(null)}
          onConfirm={() => commitTypeChange(typeChangeConfirm)}
        />
      )}

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
}

export function Header({ closeBtnRef, title, subtitle, onClose, disabled }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-gradient-to-r from-sky-700 to-sky-800 px-5 py-4 text-white dark:border-[#142535]">
      <div className="min-w-0">
        <h2 id="add-apt-title" className="font-[Outfit,sans-serif] text-[16px] font-extrabold leading-tight">
          {title}
        </h2>
        {subtitle && <p className="mt-1 text-[12px] opacity-85">{subtitle}</p>}
      </div>
      <button
        ref={closeBtnRef}
        type="button"
        onClick={onClose}
        disabled={disabled}
        aria-label="Close drawer"
        title="Close"
        className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md bg-white/15 text-white transition hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

export function Footer({ saving, submitLabel, onCancel }) {
  return (
    <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-[#142535] dark:bg-[#071220]">
      <button
        type="button"
        onClick={onCancel}
        disabled={saving}
        className="cursor-pointer rounded-[10px] border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40 dark:border-[#142535] dark:bg-[#0A1828] dark:text-slate-200"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={saving}
        className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-sky-700 bg-gradient-to-r from-sky-600 to-sky-800 px-5 py-2.5 text-[13px] font-bold text-white shadow-sm transition hover:from-sky-700 hover:to-sky-900 disabled:opacity-40"
      >
        {saving && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
        {saving ? 'Saving…' : submitLabel}
      </button>
    </div>
  );
}

export function AppointmentFormBody({
  form,
  errors,
  setField,
  onRequestTypeChange,
  onToggleService,
  userOffices,
  orgStaff,
  orgRooms,
  orgServices,
  org,
  currency,
  mode,
}) {
  const isEdit = mode === 'edit';
  const visitorType = form.visitor?.visitorType || 'Regular';
  const isDelivery = visitorType === 'Delivery';

  const activeStaff = useMemo(
    () =>
      (orgStaff || [])
        .filter((s) => s?.status !== 'Inactive')
        .sort((a, b) => (a.fullName || a.name || '').localeCompare(b.fullName || b.name || '')),
    [orgStaff]
  );

  const roomOptions = useMemo(() => {
    if (!form.officeId) return [];
    return (orgRooms || []).filter(
      (r) =>
        r?.officeId === form.officeId &&
        String(r.status || 'Active') === 'Active' &&
        r.bookableByVisitors !== false
    );
  }, [orgRooms, form.officeId]);

  const serviceOptions = useMemo(() => {
    if (!form.officeId) return [];
    return (orgServices || []).filter(
      (s) =>
        s?.status === 'Active' &&
        Array.isArray(s.availableOfficeIds) &&
        s.availableOfficeIds.includes(form.officeId)
    );
  }, [orgServices, form.officeId]);

  const office = (userOffices || []).find((o) => o?.id === form.officeId);
  const tzAbbr = getTimezoneAbbr(office?.operations?.timezone);
  const cost = estimateServiceCost(form.servicesPrebooked, serviceOptions, currency);

  const purposeLen = (form.purpose || '').length;
  const notesLen = (form.notes || '').length;

  return (
    <>
      <SectionHeader Icon={UserRound} title="Visitor Details" />

      <div data-field="visitor.visitorType">
        <Field label="Visitor Type" required error={errors['visitor.visitorType']}>
          <div role="radiogroup" aria-label="Visitor Type" className="flex flex-wrap gap-2">
            {VISITOR_TYPES.map((t) => {
              const active = visitorType === t;
              const meta = VISITOR_TYPE_META[t];
              return (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => onRequestTypeChange(t)}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-[10px] border px-3 py-2 text-[12px] font-bold transition ${
                    active
                      ? meta.tone === 'amber'
                        ? 'border-amber-700 bg-amber-600 text-white'
                        : meta.tone === 'blue'
                        ? 'border-blue-700 bg-blue-600 text-white'
                        : meta.tone === 'teal'
                        ? 'border-teal-700 bg-teal-600 text-white'
                        : 'border-sky-700 bg-sky-700 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-300'
                  }`}
                >
                  <span aria-hidden="true">{meta.icon}</span>
                  {t}
                </button>
              );
            })}
          </div>
        </Field>
      </div>

      <div className={twoColCls()}>
        <div data-field="visitor.fullName">
          <Field label="Visitor Name" required error={errors['visitor.fullName']}>
            <input
              type="text"
              value={form.visitor.fullName}
              onChange={(e) => setField('visitor.fullName', e.target.value)}
              onPaste={(e) => {
                e.preventDefault();
                const pasted = e.clipboardData.getData('text');
                setField('visitor.fullName', `${form.visitor.fullName}${pasted}`);
              }}
              placeholder="Enter Visitor Name"
              maxLength={100}
              className={inputCls(errors['visitor.fullName'])}
            />
          </Field>
        </div>

        <div data-field="visitor.contactNumber">
          <Field label="Contact Number" required error={errors['visitor.contactNumber']}>
            <input
              type="tel"
              value={form.visitor.contactNumber}
              onChange={(e) => setField('visitor.contactNumber', e.target.value)}
              placeholder="Enter Contact Number"
              maxLength={20}
              className={inputCls(errors['visitor.contactNumber'])}
            />
          </Field>
        </div>
      </div>

      <div className={twoColCls()}>
        <div data-field="visitor.emailId">
          <Field label="Email ID" error={errors['visitor.emailId']}>
            <input
              type="email"
              value={form.visitor.emailId}
              onChange={(e) => setField('visitor.emailId', e.target.value)}
              placeholder="Enter Email ID"
              maxLength={100}
              className={inputCls(errors['visitor.emailId'])}
            />
          </Field>
        </div>

        <div data-field="visitor.companyName">
          <Field label="Company Name" error={errors['visitor.companyName']}>
            <input
              type="text"
              value={form.visitor.companyName}
              onChange={(e) => setField('visitor.companyName', e.target.value)}
              placeholder="Enter Company Name"
              maxLength={100}
              className={inputCls(errors['visitor.companyName'])}
            />
          </Field>
        </div>
      </div>

      {!isDelivery && (
        <div className={twoColCls()}>
          <div data-field="visitor.designation">
            <Field label="Designation" error={errors['visitor.designation']}>
              <input
                type="text"
                value={form.visitor.designation}
                onChange={(e) => setField('visitor.designation', e.target.value)}
                placeholder="Enter Designation"
                maxLength={80}
                className={inputCls(errors['visitor.designation'])}
              />
            </Field>
          </div>

          <div data-field="visitor.accompanyingCount">
            <Field
              label="Accompanying Visitors"
              hint="0 to 10 additional guests."
              error={errors['visitor.accompanyingCount']}
            >
              <input
                type="number"
                min={0}
                max={10}
                step={1}
                value={form.visitor.accompanyingCount}
                onChange={(e) => setField('visitor.accompanyingCount', e.target.value)}
                placeholder="Enter count"
                className={inputCls(errors['visitor.accompanyingCount'])}
              />
            </Field>
          </div>
        </div>
      )}

      <SectionHeader Icon={Calendar} title="Meeting" />

      <div className={twoColCls()}>
        <div data-field="officeId">
          <Field label="Office" required error={errors.officeId}>
            <SearchableSelect
              value={form.officeId}
              onChange={(v) => setField('officeId', v)}
              options={(userOffices || []).map((o) => ({
                value: o.id,
                label: `${o.name} (${o.code})`,
              }))}
              placeholder={userOffices.length ? 'Select Office' : 'No offices available'}
              searchPlaceholder="Search office…"
              disabled={userOffices.length === 0 || isEdit}
              error={Boolean(errors.officeId)}
            />
          </Field>
        </div>

        {!isDelivery && (
          <div data-field="hostUserId">
            <Field
              label={isDelivery ? 'Received By' : 'Host'}
              required={!isDelivery}
              error={errors.hostUserId}
              hint={tzAbbr ? `Times displayed in ${tzAbbr}.` : undefined}
            >
              <SearchableSelect
                value={form.hostUserId}
                onChange={(v) => setField('hostUserId', v)}
                options={activeStaff.map((s) => ({
                  value: s.id,
                  label: `${s.fullName || s.name} — ${s.role}`,
                }))}
                placeholder="Select Host"
                searchPlaceholder="Search staff…"
                error={Boolean(errors.hostUserId)}
              />
            </Field>
          </div>
        )}
      </div>

      <div data-field="purpose">
        <Field
          label="Purpose of Visit"
          required
          error={errors.purpose}
          hint={`${purposeLen.toLocaleString('en-GB')} / 500 characters. Minimum 10.`}
        >
          <textarea
            value={form.purpose}
            onChange={(e) => setField('purpose', e.target.value)}
            placeholder="Enter Purpose of Visit"
            rows={3}
            maxLength={500}
            className={`${inputCls(errors.purpose)} resize-none`}
          />
        </Field>
      </div>

      <div className={twoColCls()}>
        <div data-field="scheduledDate">
          <Field label="Scheduled Date" required error={errors.scheduledDate}>
            <input
              type="date"
              value={form.scheduledDate}
              onChange={(e) => setField('scheduledDate', e.target.value)}
              min={todayIso()}
              max={addDaysIso(180)}
              className={inputCls(errors.scheduledDate)}
            />
          </Field>
        </div>

        <div data-field="startTime">
          <Field label="Start Time" required error={errors.startTime}>
            <div className="flex items-center gap-2">
              <input
                type="time"
                step={60}
                value={form.startTime}
                onChange={(e) => setField('startTime', e.target.value)}
                className={inputCls(errors.startTime)}
              />
              <span className="shrink-0 text-[12px] font-semibold text-slate-500 dark:text-slate-400">
                {to12hAmPm(form.startTime)} {tzAbbr}
              </span>
            </div>
          </Field>
        </div>
      </div>

      <div data-field="endTime">
        <Field label="End Time" required error={errors.endTime}>
          <div className="flex items-center gap-2">
            <input
              type="time"
              step={60}
              value={form.endTime}
              onChange={(e) => setField('endTime', e.target.value)}
              className={inputCls(errors.endTime)}
            />
            <span className="shrink-0 text-[12px] font-semibold text-slate-500 dark:text-slate-400">
              {to12hAmPm(form.endTime)} {tzAbbr}
            </span>
          </div>
        </Field>
      </div>

      {!isDelivery && (
        <div data-field="roomId">
          <Field
            label="Room"
            error={errors.roomId}
            hint={form.officeId ? 'Pick a bookable room at the selected office.' : 'Select Office first.'}
          >
            <SearchableSelect
              value={form.roomId || ''}
              onChange={(v) => setField('roomId', v)}
              options={[
                { value: '', label: '— No room —' },
                ...roomOptions.map((r) => ({
                  value: r.id,
                  label: `${r.name} · seats ${r.seatingCapacity}`,
                })),
              ]}
              placeholder={form.officeId ? 'Select Room' : 'Select Office first'}
              searchPlaceholder="Search room…"
              disabled={!form.officeId}
              error={Boolean(errors.roomId)}
            />
          </Field>
        </div>
      )}

      {!isDelivery && (
        <>
          <SectionHeader Icon={Sparkles} title="Services (optional)" />

          {!form.officeId ? (
            <p className="rounded-[10px] border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-[12px] text-slate-500 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-400">
              Select Office first to see available services.
            </p>
          ) : serviceOptions.length === 0 ? (
            <p className="rounded-[10px] border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-[12px] text-slate-500 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-400">
              No services configured at this office yet.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {serviceOptions.map((s) => {
                  const checked = (form.servicesPrebooked || []).includes(s.id);
                  const unitLabel = s.chargeable
                    ? ` · ${formatServicePrice(s.price, currency)}${s.priceUnit === 'flat' ? '' : ` ${s.priceUnit.replace('per ', '/ ')}`}`
                    : ' · Free';

                  return (
                    <label
                      key={s.id}
                      className={`flex cursor-pointer items-center gap-2 rounded-[10px] border px-3 py-2 text-[12px] font-semibold transition ${
                        checked
                          ? 'border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-400/40 dark:bg-sky-500/15 dark:text-sky-200'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggleService(s.id)}
                        className="h-4 w-4 cursor-pointer accent-sky-600"
                      />
                      <span className="text-[14px]" aria-hidden="true">
                        {s.icon || '•'}
                      </span>
                      <span className="min-w-0 truncate">
                        {s.name}
                        {unitLabel}
                      </span>
                    </label>
                  );
                })}
              </div>

              {errors.servicesPrebooked && (
                <p className="mt-2 text-[11px] font-semibold text-red-600 dark:text-red-400">
                  {errors.servicesPrebooked}
                </p>
              )}

              {cost.chargeable > 0 && (
                <p className="mt-3 rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-300">
                  Estimated cost:{' '}
                  <strong className="text-sky-700 dark:text-sky-300">{cost.formatted}</strong>. Final charges are based on actual usage and appear on the invoice.
                </p>
              )}
            </>
          )}
        </>
      )}

      <SectionHeader Icon={Mail} title="Notes and Invitation" />

      <div data-field="notes">
        <Field
          label="Notes"
          hint={`${notesLen.toLocaleString('en-GB')} / 500 characters.`}
          error={errors.notes}
        >
          <textarea
            value={form.notes || ''}
            onChange={(e) => setField('notes', e.target.value)}
            placeholder="Optional notes for the host or reception"
            rows={2}
            maxLength={500}
            className={`${inputCls(errors.notes)} resize-none`}
          />
        </Field>
      </div>

      <div className="space-y-1.5">
        <label className="flex items-center gap-2 text-[13px] text-slate-700 dark:text-slate-200">
          <input
            type="checkbox"
            checked={Boolean(form.invitation?.sendEmail)}
            onChange={(e) =>
              setField('invitation', {
                ...form.invitation,
                sendEmail: e.target.checked,
              })
            }
            className="h-4 w-4 cursor-pointer accent-sky-600"
          />
          Send invitation email to visitor.
        </label>

        <label className="flex items-center gap-2 text-[13px] text-slate-700 dark:text-slate-200">
          <input
            type="checkbox"
            checked={Boolean(form.invitation?.includeQRCode)}
            onChange={(e) =>
              setField('invitation', {
                ...form.invitation,
                includeQRCode: e.target.checked,
              })
            }
            className="h-4 w-4 cursor-pointer accent-sky-600"
          />
          Include QR code for fast-track check-in.
        </label>

        <label className="flex items-center gap-2 text-[13px] text-slate-700 dark:text-slate-200">
          <input
            type="checkbox"
            checked={Boolean(form.invitation?.smsReminder)}
            onChange={(e) =>
              setField('invitation', {
                ...form.invitation,
                smsReminder: e.target.checked,
              })
            }
            className="h-4 w-4 cursor-pointer accent-sky-600"
          />
          Send SMS reminder 1 hour before visit.
        </label>
      </div>
    </>
  );
}

function TypeChangeConfirm({ newType, onCancel, onConfirm }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      className="fixed inset-0 z-[9550] flex items-center justify-center bg-black/55 p-4"
    >
      <div className="w-full max-w-md rounded-[14px] border border-slate-200 bg-white shadow-2xl dark:border-[#142535] dark:bg-[#0A1828]">
        <div className="border-b border-slate-200 px-5 py-4 dark:border-[#142535]">
          <h3 className="font-[Outfit,sans-serif] text-[15px] font-extrabold text-[#0C2340] dark:text-slate-100">
            Change visitor type to {newType}?
          </h3>
        </div>

        <div className="px-5 py-4 text-[13px] text-slate-700 dark:text-slate-200">
          Changing visitor type will clear host, room, and service selections. Continue?
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-[#142535] dark:bg-[#071220]">
          <button
            type="button"
            onClick={onCancel}
            className="cursor-pointer rounded-[10px] border border-slate-200 bg-white px-4 py-2 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-[#142535] dark:bg-[#0A1828] dark:text-slate-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-sky-700 bg-sky-700 px-4 py-2 text-[13px] font-bold text-white hover:bg-sky-800"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

export function SectionHeader({ Icon, title }) {
  return (
    <h3 className="mb-3 mt-2 inline-flex items-center gap-2 font-[Outfit,sans-serif] text-[12px] font-extrabold uppercase tracking-[0.08em] text-sky-700 dark:text-sky-300">
      {Icon && <Icon size={14} aria-hidden="true" />}
      {title}
    </h3>
  );
}

export function inputCls(hasError) {
  const base =
    'w-full rounded-[10px] border bg-white px-3 py-2 text-[13px] text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:bg-[#071220] dark:text-slate-200';
  return hasError
    ? `${base} border-red-400 focus:border-red-500 focus:ring-red-100 dark:border-red-500/40`
    : `${base} border-slate-200 dark:border-[#142535]`;
}

export function twoColCls() {
  return 'grid grid-cols-1 gap-3 sm:grid-cols-2';
}

void APPROVAL_MODES;
void DEFAULT_CHECKIN_SETTINGS;