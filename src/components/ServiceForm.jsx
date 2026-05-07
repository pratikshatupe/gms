import React, { useEffect, useMemo, useState } from 'react';

const EMPTY_FORM = Object.freeze({
  visitorLogId:    '',
  serviceType:     '',
  assignedStaffId: '',
  notes:           '',
});

function validate(form, { editMode }) {
  const errors = {};
  /* Visitor is locked in edit mode, so we skip that check. */
  if (!editMode && !form.visitorLogId) {
    errors.visitorLogId = 'Please choose a visitor (must be currently inside).';
  }
  if (!form.serviceType)     errors.serviceType     = 'Please choose a service type.';
  if (!form.assignedStaffId) errors.assignedStaffId = 'Please assign a staff member.';
  return errors;
}

const inputBase =
  'w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-700 outline-none transition ' +
  'placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100';

function fieldClass(hasError) {
  return `${inputBase} ${hasError ? 'border-red-400 focus:ring-red-100' : 'border-slate-200'}`;
}

/**
 * `staff` is expected to be pre-filtered to users whose role is "Service Staff"
 * — the form does not re-filter. This keeps the component role-agnostic and
 * lets the caller decide the eligibility policy.
 *
 * `initialValue` turns the form into edit mode. The visitor field becomes
 * read-only (the request is bound to a specific guest-log entry) and the
 * submit button becomes "Update Service".
 */
export default function ServiceForm({
  initialValue = null,
  insideVisitors = [],
  serviceTypes = [],
  staff = [],
  onSubmit,
  onCancel,
  submitting = false,
}) {
  const editMode = Boolean(initialValue);
  const [form, setForm] = useState(() =>
    initialValue
      ? {
          visitorLogId:    initialValue.visitorLogId || '',
          serviceType:     initialValue.serviceType || '',
          assignedStaffId: initialValue.assignedStaffId || '',
          notes:           initialValue.notes || '',
        }
      : EMPTY_FORM,
  );
  const [errors, setErrors] = useState({});

  /* Re-seed the form whenever the edit target changes. */
  useEffect(() => {
    if (!initialValue) return;
    setForm({
      visitorLogId:    initialValue.visitorLogId || '',
      serviceType:     initialValue.serviceType || '',
      assignedStaffId: initialValue.assignedStaffId || '',
      notes:           initialValue.notes || '',
    });
    setErrors({});
  }, [initialValue]);

  /* Create mode only: if the selected visitor is no longer "Inside"
     (e.g. checked out in another tab), clear the selection so the form
     cannot submit stale data. */
  useEffect(() => {
    if (editMode) return;
    if (!form.visitorLogId) return;
    const stillValid = insideVisitors.some((v) => v.id === form.visitorLogId);
    if (!stillValid) {
      setForm((f) => ({ ...f, visitorLogId: '' }));
    }
  }, [editMode, insideVisitors, form.visitorLogId]);

  const selectedVisitor = useMemo(
    () => insideVisitors.find((v) => v.id === form.visitorLogId) || null,
    [insideVisitors, form.visitorLogId],
  );

  const patch = (patchObj) => {
    setForm((f) => ({ ...f, ...patchObj }));
    setErrors((prev) => {
      const next = { ...prev };
      Object.keys(patchObj).forEach((k) => delete next[k]);
      return next;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const nextErrors = validate(form, { editMode });
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    onSubmit({
      visitorLogId:    form.visitorLogId,
      serviceType:     form.serviceType,
      assignedStaffId: form.assignedStaffId,
      notes:           form.notes.trim(),
    });
    if (!editMode) setForm(EMPTY_FORM);
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {!editMode && insideVisitors.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          No visitors currently on-site. Service requests can only be raised for visitors
          whose status is <strong>Inside</strong>.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-semibold text-slate-600">
            Visitor {!editMode && <span className="text-red-500">*</span>}
          </label>
          {editMode ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {initialValue?.visitorName || '—'}
              <span className="ml-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                (locked)
              </span>
            </div>
          ) : (
            <>
              <select
                value={form.visitorLogId}
                onChange={(e) => patch({ visitorLogId: e.target.value })}
                disabled={insideVisitors.length === 0}
                className={fieldClass(errors.visitorLogId)}
              >
                <option value="">Select a visitor currently inside</option>
                {insideVisitors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.guestName}{v.company ? ` — ${v.company}` : ''}{v.host ? ` · Host: ${v.host}` : ''}
                  </option>
                ))}
              </select>
              {errors.visitorLogId && (
                <p className="mt-1 text-xs text-red-500">{errors.visitorLogId}</p>
              )}
              {selectedVisitor && (
                <p className="mt-1 text-[11px] text-slate-500">
                  {selectedVisitor.type || 'Guest'} · Contact: {selectedVisitor.contactNumber || '—'}
                </p>
              )}
            </>
          )}
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">
            Service Type <span className="text-red-500">*</span>
          </label>
          <select
            value={form.serviceType}
            onChange={(e) => patch({ serviceType: e.target.value })}
            className={fieldClass(errors.serviceType)}
          >
            <option value="">Select service type</option>
            {serviceTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          {errors.serviceType && <p className="mt-1 text-xs text-red-500">{errors.serviceType}</p>}
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">
            Assigned Staff <span className="text-red-500">*</span>
          </label>
          <select
            value={form.assignedStaffId}
            onChange={(e) => patch({ assignedStaffId: e.target.value })}
            disabled={staff.length === 0}
            className={fieldClass(errors.assignedStaffId)}
          >
            <option value="">
              {staff.length === 0 ? 'No service staff available' : 'Select a service staff member'}
            </option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {staff.length === 0 && (
            <p className="mt-1 text-xs text-amber-600">
              Add a user with role "Service Staff" in the Staff module to assign requests.
            </p>
          )}
          {errors.assignedStaffId && (
            <p className="mt-1 text-xs text-red-500">{errors.assignedStaffId}</p>
          )}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-600">Notes (optional)</label>
        <textarea
          value={form.notes}
          onChange={(e) => patch({ notes: e.target.value })}
          rows={3}
          maxLength={500}
          placeholder="Any detail the service staff should know…"
          className={`${fieldClass(false)} resize-y`}
        />
      </div>

      <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="rounded-lg border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting || (!editMode && insideVisitors.length === 0) || staff.length === 0}
          className="rounded-lg border border-sky-700 bg-sky-700 px-5 py-2 text-sm font-semibold text-white transition hover:bg-sky-800 disabled:opacity-60"
        >
          {submitting
            ? (editMode ? 'Saving…' : 'Creating…')
            : (editMode ? 'Update Service' : 'Create Service Request')}
        </button>
      </div>
    </form>
  );
}
