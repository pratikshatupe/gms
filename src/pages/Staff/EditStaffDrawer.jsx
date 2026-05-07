import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { Toast } from '../../components/ui';
import { useCollection, STORAGE_KEYS } from '../../store';
import { MOCK_STAFF, MOCK_OFFICES } from '../../data/mockData';
import { addAuditLog } from '../../utils/auditLogger';
import {
  validateStaffForm,
  emptyStaffShape,
  byOrg,
  Header,
  Footer,
  StaffFormBody,
  rolesAvailableTo,
} from './AddStaffDrawer';

function normalizeSpaces(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function sanitizePersonName(value) {
  return String(value || '')
    .replace(/[^A-Za-z .'-]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^\s+/g, '')
    .slice(0, 100);
}

function sanitizePhone10(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.slice(-10);
}

function sanitizeDesignation(value) {
  return String(value || '')
    .replace(/[^A-Za-z0-9/&(),.\- ]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^\s+/g, '')
    .slice(0, 50);
}

function validateExact10DigitPhone(value) {
  return /^\d{10}$/.test(String(value || ''));
}

function hydrate(row) {
  if (!row) return emptyStaffShape();
  const base = emptyStaffShape();

  return {
    ...base,
    fullName: row.fullName || row.name || '',
    emailId: row.emailId || row.email || '',
    contactNumber: sanitizePhone10(row.contactNumber || row.phone || ''),
    dateOfBirth: row.dateOfBirth || '',
    gender: row.gender || '',
    designation: row.designation || '',
    employeeId: row.employeeId || '',
    officeId: row.officeId || '',
    role: row.role || '',
    reportingToUserId: row.reportingToUserId || '',
    joiningDate: row.joiningDate || '',
    sendInviteEmail: false,
    status: row.status || 'Active',
  };
}

function diffSummary(before, after) {
  const lines = [];
  const keys = [
    'fullName',
    'contactNumber',
    'dateOfBirth',
    'gender',
    'designation',
    'officeId',
    'role',
    'reportingToUserId',
    'joiningDate',
    'status',
  ];

  for (const k of keys) {
    const beforeVal = k === 'contactNumber'
      ? sanitizePhone10(before?.[k] || before?.phone || '')
      : (before?.[k] || '');
    const afterVal = after?.[k] || '';

    if (beforeVal !== afterVal) {
      lines.push(`${k}: ${beforeVal || '—'} → ${afterVal || '—'}`);
    }
  }

  return lines.join('; ');
}

export default function EditStaffDrawer({
  open,
  staffRow,
  onClose,
  onUpdated,
  currentUser,
}) {
  const [staff, , updateStaff] = useCollection(STORAGE_KEYS.STAFF, MOCK_STAFF);
  const [officesAll] = useCollection(STORAGE_KEYS.OFFICES, MOCK_OFFICES);

  const userOffices = useMemo(
    () =>
      byOrg(officesAll, currentUser)
        .filter((o) => String(o?.status || 'Active') !== 'Inactive')
        .sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [officesAll, currentUser]
  );

  const orgStaff = useMemo(() => byOrg(staff, currentUser), [staff, currentUser]);

  const [form, setForm] = useState(() => hydrate(staffRow));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [demoteConfirm, setDemoteConfirm] = useState(false);
  const closeBtnRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setForm(hydrate(staffRow));
    setErrors({});
    setSaving(false);
    setDemoteConfirm(false);
  }, [open, staffRow]);

  useEffect(() => {
    if (!open) return undefined;

    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e) => {
      if (e.key === 'Escape' && !saving) {
        if (demoteConfirm) setDemoteConfirm(false);
        else onClose?.();
      }
    };

    document.addEventListener('keydown', onKey);
    const t = window.setTimeout(() => closeBtnRef.current?.focus(), 30);

    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
      window.clearTimeout(t);
    };
  }, [open, saving, demoteConfirm, onClose]);

  if (!open || !staffRow) return null;

  const setField = (key, value) => {
    let nextValue = value;

    if (key === 'fullName') nextValue = sanitizePersonName(value);
    if (key === 'contactNumber') nextValue = sanitizePhone10(value);
    if (key === 'designation') nextValue = sanitizeDesignation(value);
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

  const isDemotion =
    staffRow.role === 'Director' && form.role && form.role !== 'Director';

  const lastDirectorBlock = useMemo(() => {
    if (!isDemotion) return false;

    const activeDirectors = (orgStaff || []).filter(
      (s) =>
        s &&
        s.id !== staffRow.id &&
        s.role === 'Director' &&
        String(s.status || 'Active') !== 'Inactive'
    ).length;

    return activeDirectors === 0;
  }, [isDemotion, orgStaff, staffRow]);

  const doSave = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 800));

    const now = new Date().toISOString();
    const author = currentUser?.name || 'Unknown';
    const roleChanged = form.role !== staffRow.role;

    const cleanedForm = {
      ...form,
      fullName: normalizeSpaces(form.fullName),
      contactNumber: sanitizePhone10(form.contactNumber),
      designation: normalizeSpaces(form.designation),
    };

    const patch = {
      emailId: staffRow.emailId,
      employeeId: staffRow.employeeId,
      orgId: staffRow.orgId,

      fullName: cleanedForm.fullName,
      name: cleanedForm.fullName,
      contactNumber: cleanedForm.contactNumber,
      dateOfBirth: cleanedForm.dateOfBirth || '',
      gender: cleanedForm.gender || '',
      designation: cleanedForm.designation,
      officeId: cleanedForm.officeId,
      role: cleanedForm.role,
      reportingToUserId: cleanedForm.reportingToUserId || null,
      joiningDate: cleanedForm.joiningDate,
      status: cleanedForm.status,
      updatedAt: now,
      updatedBy: author,
    };

    updateStaff(staffRow.id, patch);

    const summary = diffSummary(staffRow, { ...staffRow, ...patch });
    addAuditLog({
      userName: author,
      role: (currentUser?.role || '').toString(),
      action: roleChanged ? 'ROLE_CHANGED' : 'UPDATE',
      module: 'Staff',
      description: `Updated staff ${patch.fullName} (${staffRow.employeeId})${summary ? ` — ${summary}` : ''}.`,
      orgId: staffRow.orgId,
    });

    setSaving(false);
    setDemoteConfirm(false);

    if (roleChanged) {
      setToast({
        type: 'success',
        msg: 'Role updated. Changes take effect on next login.',
      });
      window.setTimeout(() => onUpdated?.({ ...staffRow, ...patch }), 1400);
    } else {
      onUpdated?.({ ...staffRow, ...patch });
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;

    const cleanedPhone = sanitizePhone10(form.contactNumber);

    if (!validateExact10DigitPhone(cleanedPhone)) {
      setErrors((prev) => ({
        ...prev,
        contactNumber: 'Contact Number must be exactly 10 digits.',
      }));
      setToast({
        type: 'error',
        msg: 'Contact Number must be exactly 10 digits.',
      });
      return;
    }

    const formToCheck = {
      ...form,
      fullName: normalizeSpaces(form.fullName),
      emailId: staffRow.emailId,
      employeeId: staffRow.employeeId,
      contactNumber: cleanedPhone,
      designation: normalizeSpaces(form.designation),
    };

    const e = validateStaffForm(formToCheck, orgStaff, staffRow.orgId, userOffices, {
      excludeId: staffRow.id,
      operatorRole: currentUser?.role || 'Director',
      operatorUserId: currentUser?.id,
    });

    if (Object.keys(e).length) {
      const nextErrors = { ...e };

      if (!validateExact10DigitPhone(cleanedPhone)) {
        nextErrors.contactNumber = 'Contact Number must be exactly 10 digits.';
      }

      setErrors(nextErrors);
      setToast({ type: 'error', msg: 'Please fix the highlighted fields and try again.' });
      return;
    }

    if (isDemotion && lastDirectorBlock) {
      setToast({
        type: 'error',
        msg: 'Cannot demote the last Director. Your organisation must have at least one active Director at all times.',
      });
      return;
    }

    if (isDemotion) {
      setDemoteConfirm(true);
      return;
    }

    await doSave();
  };

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-staff-title"
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
            title={`Edit Staff — ${staffRow.fullName || staffRow.name || ''}`}
            subtitle={`Employee ID: ${staffRow.employeeId || '—'} (immutable) · Email ID locked.`}
            onClose={onClose}
            disabled={saving}
          />

          <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
              <StaffFormBody
                form={form}
                errors={{
                  ...errors,
                  contactNumber: errors.contactNumber,
                }}
                setField={setField}
                userOffices={userOffices}
                orgStaff={orgStaff}
                operatorRole={currentUser?.role}
                operatorUserId={currentUser?.id}
                mode="edit"
                editingStaff={staffRow}
              />
            </div>

            <Footer
              saving={saving}
              submitLabel="Save Changes"
              onCancel={onClose}
            />
          </form>
        </aside>
      </div>

      {demoteConfirm && (
        <DemoteConfirmModal
          staffName={staffRow.fullName || staffRow.name || 'this Director'}
          newRole={form.role}
          saving={saving}
          onCancel={() => setDemoteConfirm(false)}
          onConfirm={doSave}
        />
      )}

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
}

function DemoteConfirmModal({
  staffName,
  newRole,
  saving,
  onCancel,
  onConfirm,
}) {
  const cancelRef = useRef(null);

  useEffect(() => {
    const t = window.setTimeout(() => cancelRef.current?.focus(), 20);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="demote-title"
      aria-describedby="demote-desc"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onCancel();
      }}
      className="fixed inset-0 z-[9550] flex items-center justify-center bg-black/55 p-4"
    >
      <div className="w-full max-w-md rounded-[14px] border border-slate-200 bg-white shadow-2xl dark:border-[#142535] dark:bg-[#0A1828]">
        <div className="flex min-w-0 items-start justify-between gap-3 border-b border-red-200 bg-red-50 px-5 py-4 dark:border-red-500/30 dark:bg-red-500/10">
          <div className="flex min-w-0 items-start gap-3">
            <span
              aria-hidden="true"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"
            >
              <AlertTriangle size={20} />
            </span>

            <div className="min-w-0">
              <h3
                id="demote-title"
                className="font-[Outfit,sans-serif] text-[16px] font-extrabold text-red-800 dark:text-red-200"
              >
                Confirm Role Change
              </h3>
              <p className="mt-0.5 text-[12px] font-semibold text-red-700 dark:text-red-300">
                Demoting {staffName} to {newRole}.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            aria-label="Close dialog"
            title="Close"
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-red-300 dark:hover:bg-red-500/20"
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>

        <div className="px-5 py-4">
          <p id="demote-desc" className="text-[13px] text-slate-700 dark:text-slate-200">
            This will remove organisational admin rights from{' '}
            <strong className="text-red-700 dark:text-red-300">{staffName}</strong>.
            They will lose access to Staff management, Settings, and Roles & Permissions.
          </p>
          <p className="mt-2 text-[12px] text-slate-500 dark:text-slate-400">
            Continue?
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-[#142535] dark:bg-[#071220]">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="cursor-pointer rounded-[10px] border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#142535] dark:bg-[#0A1828] dark:text-slate-200"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={saving}
            className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-red-700 bg-red-600 px-5 py-2.5 text-[13px] font-bold text-white shadow-sm transition hover:border-red-800 hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
            {saving ? 'Saving…' : 'Confirm Demotion'}
          </button>
        </div>
      </div>
    </div>
  );
}

void rolesAvailableTo;