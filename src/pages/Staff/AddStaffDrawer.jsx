import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X, UserRound, Briefcase, Shield, Loader2, Copy, Check, Mail,
} from 'lucide-react';
import { Field, SearchableSelect, Toast } from '../../components/ui';
import { useCollection, STORAGE_KEYS } from '../../store';
import {
  MOCK_STAFF, MOCK_OFFICES, MOCK_ORGANIZATIONS,
} from '../../data/mockData';
import { addAuditLog } from '../../utils/auditLogger';
import { generateTempPassword, DIAL_CODES } from '../../utils/requestValidation';
import { generateStaffInviteEmail, previewEmail } from '../../utils/emailTemplates';

export const ALL_STAFF_ROLES = ['Director', 'Manager', 'Reception', 'Service Staff'];

export function rolesAvailableTo(operatorRole) {
  const r = String(operatorRole || '').toLowerCase();
  if (r === 'superadmin') return ALL_STAFF_ROLES;
  return ALL_STAFF_ROLES.filter((role) => role !== 'Director');
}

export const GENDERS = ['Male', 'Female', 'Other'];
export const ACCESS_STATUSES = ['Invited', 'Pending', 'Active', 'Inactive'];
export const STAFF_STATUSES = ['Active', 'Inactive'];

export const DESIGNATIONS_SUGGESTED = {
  Director: ['Director', 'Chief Executive Officer', 'Chief Operating Officer'],
  Manager: ['Office Manager', 'Branch Manager', 'Operations Manager'],
  Reception: ['Front Desk Executive', 'Receptionist', 'Reception Lead'],
  'Service Staff': ['Facility Executive', 'Pantry Assistant', 'Driver'],
};

export function byOrg(records, user) {
  if (!Array.isArray(records)) return [];
  const role = String(user?.role || '').toLowerCase();
  if (role === 'superadmin') return records;
  const orgId = user?.organisationId || user?.orgId || null;
  if (!orgId) return [];
  return records.filter((r) => !r?.orgId || r.orgId === orgId);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function subtractYearsIso(years) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString().slice(0, 10);
}

function normalizeSpaces(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function sanitizeName(value) {
  return String(value || '')
    .replace(/[^A-Za-z .'-]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^\s+/g, '');
}

function sanitizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function sanitizePhone(value) {
  let v = String(value || '').replace(/[^\d+\s-]/g, '');
  v = v.replace(/(?!^)\+/g, '');
  v = v.replace(/\s+/g, ' ').trim();
  return v;
}

function sanitizeEmployeeId(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, 20);
}

function sanitizeDesignation(value) {
  return String(value || '')
    .replace(/[^A-Za-z0-9/&(),.\- ]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^\s+/g, '');
}

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

export function detectReportingCycle(candidateReportingTo, newStaffId, allStaff, maxHops = 20) {
  if (!candidateReportingTo) return { cycle: false };
  if (candidateReportingTo === newStaffId) {
    return { cycle: true, chain: [newStaffId, newStaffId] };
  }

  const byId = new Map((allStaff || []).map((s) => [s.id, s]));
  const visited = new Set();
  const chain = [];
  let cursor = candidateReportingTo;

  for (let i = 0; i < maxHops && cursor; i += 1) {
    if (visited.has(cursor)) {
      chain.push(cursor);
      return { cycle: true, chain };
    }
    visited.add(cursor);
    chain.push(cursor);

    if (cursor === newStaffId) {
      return { cycle: true, chain };
    }

    const node = byId.get(cursor);
    cursor = node?.reportingToUserId || null;
  }

  return { cycle: false };
}

const isBlank = (v) => v == null || String(v).trim().length === 0;
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const NAME_RE = /^[A-Za-z .'-]+$/;
const DESIGNATION_RE = /^[A-Za-z0-9/&(),.\- ]+$/;
const EMPLOYEE_ID_RE = /^[A-Z0-9-]+$/;

export function validateStaffForm(form, allStaff, orgId, offices = [], opts = {}) {
  const { excludeId = null, operatorRole = 'Director' } = opts;
  const e = {};

  const fullName = normalizeSpaces(form.fullName);
  const email = sanitizeEmail(form.emailId);
  const contact = sanitizePhone(form.contactNumber);
  const contactDigits = digitsOnly(contact);
  const designation = normalizeSpaces(form.designation);
  const empId = sanitizeEmployeeId(form.employeeId);
  const officeId = String(form.officeId || '').trim();
  const role = String(form.role || '').trim();
  const reportingToUserId = String(form.reportingToUserId || '').trim();
  const joiningDate = String(form.joiningDate || '').trim();
  const status = String(form.status || '').trim();

  if (isBlank(fullName)) {
    e.fullName = 'Full Name is required.';
  } else if (fullName.length < 2 || fullName.length > 100) {
    e.fullName = 'Full Name must be 2 to 100 characters.';
  } else if (!NAME_RE.test(fullName)) {
    e.fullName = 'Full Name accepts letters only.';
  }

  if (isBlank(email)) {
    e.emailId = 'Email ID is required.';
  } else if (email.length > 100) {
    e.emailId = 'Email ID must be 100 characters or fewer.';
  } else if (!EMAIL_RE.test(email)) {
    e.emailId = 'Please enter a valid Email ID.';
  } else {
    const dup = (allStaff || []).find(
      (s) =>
        s &&
        s.orgId === orgId &&
        sanitizeEmail(s.emailId) === email &&
        s.id !== excludeId
    );
    if (dup) e.emailId = 'Email ID already exists in your organisation.';
  }

  if (isBlank(contact)) {
    e.contactNumber = 'Contact Number is required.';
  } else if (!/^\+?[\d\s-]+$/.test(contact)) {
    e.contactNumber = 'Contact Number accepts digits, spaces and hyphens only.';
  } else if (contactDigits.length < 7 || contactDigits.length > 15) {
    e.contactNumber = 'Contact Number must be 7 to 15 digits.';
  } else if (/^0+$/.test(contactDigits)) {
    e.contactNumber = 'Contact Number cannot be all zeros.';
  }

  if (form.dateOfBirth) {
    const dob = new Date(`${form.dateOfBirth}T00:00:00`);
    const today = new Date(`${todayIso()}T00:00:00`);
    if (Number.isNaN(dob.getTime())) {
      e.dateOfBirth = 'Please enter a valid Date of Birth.';
    } else if (dob > today) {
      e.dateOfBirth = 'Date of Birth must be in the past.';
    }
  }

  if (form.gender && !GENDERS.includes(form.gender)) {
    e.gender = 'Gender is invalid.';
  }

  if (isBlank(designation)) {
    e.designation = 'Designation is required.';
  } else if (designation.length < 2 || designation.length > 50) {
    e.designation = 'Designation must be 2 to 50 characters.';
  } else if (!DESIGNATION_RE.test(designation)) {
    e.designation = 'Designation contains invalid characters.';
  }

  if (isBlank(empId)) {
    e.employeeId = 'Employee ID is required.';
  } else if (empId.length < 3 || empId.length > 20) {
    e.employeeId = 'Employee ID must be 3 to 20 characters.';
  } else if (!EMPLOYEE_ID_RE.test(empId)) {
    e.employeeId = 'Employee ID allows only letters, numbers and dash.';
  } else {
    const dup = (allStaff || []).find(
      (s) =>
        s &&
        s.orgId === orgId &&
        sanitizeEmployeeId(s.employeeId) === empId &&
        s.id !== excludeId
    );
    if (dup) e.employeeId = 'Employee ID already exists in your organisation.';
  }

  if (isBlank(officeId)) {
    e.officeId = 'Office is required.';
  } else {
    const office = (offices || []).find((o) => String(o?.id) === officeId);
    if (!office) {
      e.officeId = 'Selected office is invalid.';
    } else if (String(office?.status || 'Active') === 'Inactive') {
      e.officeId = 'Inactive office cannot be assigned.';
    }
  }

  const availableRoles = rolesAvailableTo(operatorRole);
  if (isBlank(role)) {
    e.role = 'Role is required.';
  } else if (!ALL_STAFF_ROLES.includes(role)) {
    e.role = 'Role is invalid.';
  } else if (!availableRoles.includes(role)) {
    e.role = 'Only Super Admin can invite a Director.';
  }

  if (reportingToUserId) {
    const reportingUser = (allStaff || []).find((s) => s?.id === reportingToUserId);

    if (!reportingUser) {
      e.reportingToUserId = 'Selected manager is invalid.';
    } else if (reportingUser.status === 'Inactive') {
      e.reportingToUserId = 'Inactive manager cannot be selected.';
    } else if (excludeId && reportingToUserId === excludeId) {
      e.reportingToUserId = 'A staff member cannot report to themselves.';
    } else {
      const check = detectReportingCycle(reportingToUserId, excludeId || '__new__', allStaff);
      if (check.cycle) {
        const byId = new Map((allStaff || []).map((s) => [s.id, s]));
        const pretty = check.chain.map((id) => {
          if (id === excludeId || id === '__new__') return fullName || 'This user';
          return byId.get(id)?.fullName || id;
        });
        e.reportingToUserId = `Reporting line creates a cycle: ${pretty.join(' → ')}.`;
      }
    }
  }

  if (isBlank(joiningDate)) {
    e.joiningDate = 'Joining Date is required.';
  } else {
    const j = new Date(`${joiningDate}T00:00:00`);
    if (Number.isNaN(j.getTime())) {
      e.joiningDate = 'Please enter a valid Joining Date.';
    } else {
      const min = new Date(`${subtractYearsIso(5)}T00:00:00`);
      const max = new Date(`${addDaysIso(90)}T00:00:00`);
      if (j < min) {
        e.joiningDate = 'Joining Date cannot be more than 5 years in the past.';
      } else if (j > max) {
        e.joiningDate = 'Joining Date cannot be more than 90 days in the future.';
      }
    }
  }

  if (!STAFF_STATUSES.includes(status)) {
    e.status = 'Status is required.';
  }

  return e;
}

export function emptyStaffShape() {
  return {
    fullName: '',
    emailId: '',
    contactNumber: '',
    dateOfBirth: '',
    gender: '',
    designation: '',
    employeeId: '',
    officeId: '',
    role: '',
    reportingToUserId: '',
    joiningDate: todayIso(),
    sendInviteEmail: true,
    status: 'Active',
  };
}

export function deriveAccessStatus(joiningDate) {
  if (!joiningDate) return 'Pending';
  const j = new Date(`${joiningDate}T00:00:00`);
  const today = new Date(`${todayIso()}T00:00:00`);
  if (j > today) return 'Invited';
  return 'Pending';
}

export default function AddStaffDrawer({ open, onClose, onCreated, currentUser }) {
  const [staff, addStaff] = useCollection(STORAGE_KEYS.STAFF, MOCK_STAFF);
  const [officesAll] = useCollection(STORAGE_KEYS.OFFICES, MOCK_OFFICES);
  const [orgsAll] = useCollection(STORAGE_KEYS.ORGANIZATIONS, MOCK_ORGANIZATIONS);
  const orgId = currentUser?.organisationId || currentUser?.orgId || null;

  const userOffices = useMemo(
    () =>
      byOrg(officesAll, currentUser)
        .filter((o) => String(o?.status || 'Active') !== 'Inactive')
        .sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [officesAll, currentUser]
  );

  const orgStaff = useMemo(() => byOrg(staff, currentUser), [staff, currentUser]);

  const org = useMemo(
    () => (orgsAll || []).find((o) => o?.id === orgId) || null,
    [orgsAll, orgId]
  );

  const [form, setForm] = useState(() => {
    const base = emptyStaffShape();
    if (userOffices.length === 1) base.officeId = userOffices[0].id;
    return base;
  });

  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [reveal, setReveal] = useState(null);
  const closeBtnRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const base = emptyStaffShape();
    if (userOffices.length === 1) base.officeId = userOffices[0].id;
    setForm(base);
    setErrors({});
    setSaving(false);
    setReveal(null);
  }, [open, userOffices]);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e) => {
      if (e.key === 'Escape' && !saving && !reveal) onClose?.();
    };

    document.addEventListener('keydown', onKey);
    const t = window.setTimeout(() => closeBtnRef.current?.focus(), 30);

    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
      window.clearTimeout(t);
    };
  }, [open, saving, reveal, onClose]);

  if (!open) return null;

  const setField = (key, value) => {
    let nextValue = value;

    if (key === 'fullName') nextValue = sanitizeName(value).slice(0, 100);
    if (key === 'emailId') nextValue = sanitizeEmail(value).slice(0, 100);
    if (key === 'contactNumber') nextValue = sanitizePhone(value).slice(0, 20);
    if (key === 'designation') nextValue = sanitizeDesignation(value).slice(0, 50);
    if (key === 'employeeId') nextValue = sanitizeEmployeeId(value);
    if (key === 'reportingToUserId') nextValue = value || '';
    if (key === 'officeId') nextValue = value || '';
    if (key === 'joiningDate') nextValue = value || '';
    if (key === 'dateOfBirth') nextValue = value || '';

    setForm((f) => ({ ...f, [key]: nextValue }));

    if (errors[key]) {
      setErrors((e) => {
        const n = { ...e };
        delete n[key];
        return n;
      });
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;

    const cleanedForm = {
      ...form,
      fullName: normalizeSpaces(form.fullName),
      emailId: sanitizeEmail(form.emailId),
      contactNumber: sanitizePhone(form.contactNumber),
      designation: normalizeSpaces(form.designation),
      employeeId: sanitizeEmployeeId(form.employeeId),
    };

    const e = validateStaffForm(cleanedForm, orgStaff, orgId, userOffices, {
      operatorRole: currentUser?.role || 'Director',
      operatorUserId: currentUser?.id,
    });

    if (Object.keys(e).length) {
      setErrors(e);
      setToast({ type: 'error', msg: 'Please fix the highlighted fields and try again.' });

      window.setTimeout(() => {
        const firstKey = Object.keys(e)[0];
        const el = document.querySelector(
          `[data-field="${firstKey}"] input, [data-field="${firstKey}"] textarea, [data-field="${firstKey}"] button`
        );
        if (el && typeof el.focus === 'function') el.focus();
      }, 0);

      return;
    }

    setSaving(true);
    await new Promise((r) => setTimeout(r, 800));

    const nextSeq =
      (staff || [])
        .map((s) => Number(String(s?.id || '').replace(/\D/g, '')))
        .filter((n) => Number.isFinite(n))
        .reduce((a, b) => Math.max(a, b), 0) + 1;

    const id = `USR-${String(nextSeq).padStart(5, '0')}`;
    const now = new Date().toISOString();
    const author = currentUser?.name || 'Unknown';
    const tempPassword = generateTempPassword();
    const accessStatus = deriveAccessStatus(cleanedForm.joiningDate);

    const record = {
      id,
      orgId,
      officeId: cleanedForm.officeId,
      fullName: cleanedForm.fullName,
      name: cleanedForm.fullName,
      emailId: cleanedForm.emailId,
      contactNumber: cleanedForm.contactNumber,
      dateOfBirth: cleanedForm.dateOfBirth || '',
      gender: cleanedForm.gender || '',
      designation: cleanedForm.designation,
      employeeId: cleanedForm.employeeId,
      role: cleanedForm.role,
      reportingToUserId: cleanedForm.reportingToUserId || null,
      joiningDate: cleanedForm.joiningDate,
      accessStatus,
      tempPassword,
      mustChangePassword: true,
      status: cleanedForm.status,
      createdAt: now,
      createdBy: author,
      updatedAt: now,
      updatedBy: author,
    };

    addStaff(record);

    addAuditLog({
      userName: author,
      role: (currentUser?.role || '').toString(),
      action: 'CREATE',
      module: 'Staff',
      description: `Invited staff ${record.fullName} (${record.employeeId}) as ${record.role}. Access status: ${accessStatus}.`,
      orgId,
    });

    if (cleanedForm.sendInviteEmail) {
      previewEmail(generateStaffInviteEmail(record, tempPassword, org));
    }

    setSaving(false);
    setReveal({ staff: record, tempPassword });
  };

  if (reveal) {
    return (
      <>
        <TempPasswordReveal
          title="New Temporary Password Generated"
          intro={`Share this password with ${reveal.staff.fullName} via a secure channel. They must change it on their next login.`}
          emailId={reveal.staff.emailId}
          tempPassword={reveal.tempPassword}
          onDone={() => {
            onCreated?.(reveal.staff);
          }}
        />
        {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      </>
    );
  }

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-staff-title"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget && !saving) onClose?.();
        }}
        className="fixed inset-0 z-[9100] flex justify-end bg-black/45"
      >
        <aside
          className="flex h-full w-full max-w-[720px] flex-col bg-white shadow-2xl dark:bg-[#0A1828] sm:w-[720px]"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <Header
            closeBtnRef={closeBtnRef}
            title="Invite Staff"
            subtitle="Add a team member and optionally send them an invitation email with login credentials."
            onClose={onClose}
            disabled={saving}
          />

          <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
              <StaffFormBody
                form={form}
                errors={errors}
                setField={setField}
                userOffices={userOffices}
                orgStaff={orgStaff}
                operatorRole={currentUser?.role}
                operatorUserId={currentUser?.id}
                mode="create"
              />
            </div>

            <Footer saving={saving} submitLabel="Send Invite" onCancel={onClose} />
          </form>
        </aside>
      </div>

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
}

export function Header({ closeBtnRef, title, subtitle, onClose, disabled }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-gradient-to-r from-sky-700 to-sky-800 px-5 py-4 text-white dark:border-[#142535]">
      <div className="min-w-0">
        <h2 id="add-staff-title" className="font-[Outfit,sans-serif] text-[16px] font-extrabold leading-tight">
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
        className="cursor-pointer rounded-[10px] border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#142535] dark:bg-[#0A1828] dark:text-slate-200"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={saving}
        className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-sky-700 bg-gradient-to-r from-sky-600 to-sky-800 px-5 py-2.5 text-[13px] font-bold text-white shadow-sm transition hover:from-sky-700 hover:to-sky-900 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {saving && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
        {saving ? 'Saving…' : submitLabel}
      </button>
    </div>
  );
}

export function StaffFormBody({
  form,
  errors,
  setField,
  userOffices,
  orgStaff,
  operatorRole,
  operatorUserId,
  mode,
  editingStaff,
}) {
  const isEdit = mode === 'edit';
  const availableRoles = useMemo(() => rolesAvailableTo(operatorRole), [operatorRole]);
  const isSelf = isEdit && editingStaff && editingStaff.id === operatorUserId;
  const roleLocked = isSelf;

  const reportingOptions = useMemo(() => {
    const pool = (orgStaff || [])
      .filter((s) => s && s.status !== 'Inactive')
      .filter((s) => !isEdit || s.id !== editingStaff?.id)
      .sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));

    return pool.map((s) => ({
      value: s.id,
      label: `${s.fullName} — ${s.role}${s.designation ? `, ${s.designation}` : ''}`,
    }));
  }, [orgStaff, isEdit, editingStaff]);

  return (
    <>
      <SectionHeader Icon={UserRound} title="Personal Details" />

      <div className={twoColCls()}>
        <div data-field="fullName">
          <Field label="Full Name" required error={errors.fullName}>
            <input
              type="text"
              value={form.fullName}
              onChange={(e) => setField('fullName', e.target.value)}
              onPaste={(e) => {
                e.preventDefault();
                const pasted = e.clipboardData.getData('text');
                setField('fullName', `${form.fullName}${pasted}`);
              }}
              placeholder="Enter Full Name"
              maxLength={100}
              className={inputCls(errors.fullName)}
            />
          </Field>
        </div>

        <div data-field="emailId">
          <Field
            label="Email ID"
            required
            error={errors.emailId}
            hint={isEdit ? 'Cannot be changed.' : 'Becomes the login for this staff member.'}
          >
            <input
              type="email"
              value={form.emailId}
              onChange={(e) => setField('emailId', e.target.value)}
              placeholder="Enter Email ID"
              maxLength={100}
              disabled={isEdit}
              className={`${inputCls(errors.emailId)} ${isEdit ? 'cursor-not-allowed opacity-40' : ''}`}
            />
          </Field>
        </div>
      </div>

      <div className={twoColCls()}>
        <div data-field="contactNumber">
          <Field label="Contact Number" required error={errors.contactNumber}>
            <input
              type="tel"
              value={form.contactNumber}
              onChange={(e) => setField('contactNumber', e.target.value)}
              placeholder="Enter Contact Number"
              maxLength={20}
              className={inputCls(errors.contactNumber)}
            />
          </Field>
        </div>

        <div data-field="dateOfBirth">
          <Field label="Date of Birth" hint="Optional." error={errors.dateOfBirth}>
            <input
              type="date"
              value={form.dateOfBirth}
              onChange={(e) => setField('dateOfBirth', e.target.value)}
              max={todayIso()}
              className={inputCls(errors.dateOfBirth)}
            />
          </Field>
        </div>
      </div>

      <Field label="Gender" hint="Optional.">
        <div role="radiogroup" aria-label="Gender" className="flex flex-wrap gap-2">
          {GENDERS.map((g) => {
            const active = form.gender === g;
            return (
              <button
                key={g}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setField('gender', active ? '' : g)}
                className={`cursor-pointer rounded-[10px] border px-3 py-1.5 text-[12px] font-bold transition ${
                  active
                    ? 'border-sky-700 bg-sky-700 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-300'
                }`}
              >
                {g}
              </button>
            );
          })}
        </div>
      </Field>

      <SectionHeader Icon={Briefcase} title="Employment" />

      <div className={twoColCls()}>
        <div data-field="employeeId">
          <Field
            label="Employee ID"
            required
            error={errors.employeeId}
            hint={isEdit ? 'Cannot be changed.' : 'Unique within your organisation. Use letters, numbers and dash only.'}
          >
            <input
              type="text"
              value={form.employeeId}
              onChange={(e) => setField('employeeId', e.target.value)}
              placeholder="Enter Employee ID"
              maxLength={20}
              disabled={isEdit}
              className={`${inputCls(errors.employeeId)} ${isEdit ? 'cursor-not-allowed opacity-40' : ''}`}
            />
          </Field>
        </div>

        <div data-field="designation">
          <Field label="Designation" required error={errors.designation}>
            <input
              type="text"
              value={form.designation}
              onChange={(e) => setField('designation', e.target.value)}
              placeholder="Enter Designation"
              maxLength={50}
              className={inputCls(errors.designation)}
            />
          </Field>
        </div>
      </div>

      <div className={twoColCls()}>
        <div data-field="officeId">
          <Field label="Office" required error={errors.officeId}>
            <SearchableSelect
              value={form.officeId}
              onChange={(v) => setField('officeId', v)}
              options={userOffices.map((o) => ({ value: o.id, label: `${o.name} (${o.code})` }))}
              placeholder={userOffices.length ? 'Select Office' : 'No offices available'}
              searchPlaceholder="Search office…"
              disabled={userOffices.length === 0}
              error={Boolean(errors.officeId)}
            />
          </Field>
        </div>

        <div data-field="joiningDate">
          <Field label="Joining Date" required error={errors.joiningDate} hint="Up to 5 years in the past or 90 days in the future.">
            <input
              type="date"
              value={form.joiningDate}
              onChange={(e) => setField('joiningDate', e.target.value)}
              min={subtractYearsIso(5)}
              max={addDaysIso(90)}
              className={inputCls(errors.joiningDate)}
            />
          </Field>
        </div>
      </div>

      <SectionHeader Icon={Shield} title="Role and Reporting" />

      <div className={twoColCls()}>
        <div data-field="role">
          <Field
            label="Role"
            required
            error={errors.role}
            hint={
              roleLocked
                ? 'You cannot change your own role.'
                : String(operatorRole || '').toLowerCase() === 'superadmin'
                ? undefined
                : 'To add another Director, contact your Super Admin.'
            }
          >
            <SearchableSelect
              value={form.role}
              onChange={(v) => setField('role', v)}
              options={availableRoles.map((r) => ({ value: r, label: r }))}
              placeholder="Select Role"
              disabled={roleLocked}
              error={Boolean(errors.role)}
            />
          </Field>
        </div>

        <div data-field="reportingToUserId">
          <Field label="Reporting To" hint="Optional." error={errors.reportingToUserId}>
            <SearchableSelect
              value={form.reportingToUserId || ''}
              onChange={(v) => setField('reportingToUserId', v || '')}
              options={[{ value: '', label: '— No manager —' }, ...reportingOptions]}
              placeholder="Select Manager"
              searchPlaceholder="Search staff…"
              error={Boolean(errors.reportingToUserId)}
            />
          </Field>
        </div>
      </div>

      <Field label="Status" required error={errors.status}>
        <div role="radiogroup" aria-label="Employment status" className="flex gap-2">
          {STAFF_STATUSES.map((s) => {
            const active = form.status === s;
            const activeCls =
              s === 'Active'
                ? 'border-emerald-700 bg-emerald-700 text-white'
                : 'border-slate-600 bg-slate-600 text-white';

            return (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setField('status', s)}
                className={`cursor-pointer rounded-[10px] border px-4 py-2 text-[12px] font-bold transition ${
                  active
                    ? activeCls
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-300'
                }`}
              >
                {s}
              </button>
            );
          })}
        </div>
      </Field>

      {!isEdit && (
        <>
          <SectionHeader Icon={Mail} title="Invitation" />
          <label className="flex items-start gap-2 rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-700 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-200">
            <input
              type="checkbox"
              checked={Boolean(form.sendInviteEmail)}
              onChange={(e) => setField('sendInviteEmail', e.target.checked)}
              className="mt-0.5 h-4 w-4 cursor-pointer accent-sky-600"
            />
            <span>
              <span className="font-bold">Send invitation email with login credentials.</span>
              <span className="mt-1 block text-[11px] text-slate-500 dark:text-slate-400">
                A secure temporary password will be generated and shown to you on the next screen.
              </span>
            </span>
          </label>
        </>
      )}
    </>
  );
}

export function TempPasswordReveal({ title, intro, emailId, tempPassword, onDone }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(tempPassword);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="temp-pwd-title"
      className="fixed inset-0 z-[9600] flex items-center justify-center bg-black/55 p-4"
    >
      <div className="w-full max-w-md rounded-[14px] border border-slate-200 bg-white shadow-2xl dark:border-[#142535] dark:bg-[#0A1828]">
        <div className="border-b border-slate-200 bg-gradient-to-r from-sky-700 to-sky-800 px-5 py-4 text-white dark:border-[#142535]">
          <h3 id="temp-pwd-title" className="font-[Outfit,sans-serif] text-[16px] font-extrabold leading-tight">
            {title}
          </h3>
        </div>

        <div className="px-5 py-5">
          <p className="text-[13px] text-slate-700 dark:text-slate-200">{intro}</p>

          {emailId && (
            <div className="mt-4 flex items-center justify-between gap-2 rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] dark:border-[#142535] dark:bg-[#071220]">
              <span className="font-bold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400">Email ID</span>
              <span className="truncate font-mono text-[12px] text-[#0C2340] dark:text-slate-100">{emailId}</span>
            </div>
          )}

          <div className="mt-3 rounded-[10px] border-2 border-sky-300 bg-sky-50 p-3 dark:border-sky-400/40 dark:bg-sky-500/10">
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-sky-700 dark:text-sky-300">
              Temporary Password
            </div>

            <div className="flex items-center gap-2">
              <code className="flex-1 break-all rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-center font-mono text-[15px] font-bold tracking-wider text-[#0C2340] dark:border-[#142535] dark:bg-[#0A1828] dark:text-slate-100">
                {tempPassword}
              </code>

              <button
                type="button"
                onClick={copy}
                className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-[10px] border border-sky-700 bg-sky-700 px-3 py-2 text-[12px] font-bold text-white transition hover:bg-sky-800"
                title="Copy password to clipboard"
              >
                {copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          <p className="mt-3 rounded-[10px] border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
            This password will not be shown again. Copy it now before closing this dialog.
          </p>
        </div>

        <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-[#142535] dark:bg-[#071220]">
          <button
            type="button"
            onClick={onDone}
            className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-sky-700 bg-gradient-to-r from-sky-600 to-sky-800 px-5 py-2.5 text-[13px] font-bold text-white shadow-sm transition hover:from-sky-700 hover:to-sky-900"
          >
            I have shared the password
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

void DIAL_CODES;