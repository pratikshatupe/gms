import React, { useEffect, useState } from 'react';
import {
  APPOINTMENT_DURATIONS,
  APPOINTMENT_PURPOSES,
  APPOINTMENT_STATUSES,
  DOCUMENT_REQUIREMENTS,
  STAFF_LIST,
} from '../data/mockAppointments';
import { validatePhone, PHONE_ERROR_MSG } from '../utils/validators';

const EMPTY_FORM = Object.freeze({
  guestName: '',
  contactNumber: '',
  companyName: '',
  purpose: '',
  hostId: '',
  date: '',
  time: '',
  duration: '1 Hour',
  notes: '',
  status: 'Pending',
  documentRequirements: [],
});

function validate(form) {
  const errors = {};
  if (!form.guestName.trim())     errors.guestName     = 'Guest name is required.';
  if (!form.contactNumber.trim()) errors.contactNumber = 'Contact number is required.';
  else if (!validatePhone(form.contactNumber.trim()))
    errors.contactNumber = PHONE_ERROR_MSG;
  if (!form.companyName.trim())   errors.companyName   = 'Company name is required.';
  if (!form.purpose)              errors.purpose       = 'Purpose is required.';
  if (!form.hostId)               errors.hostId        = 'Host is required.';
  if (!form.date)                 errors.date          = 'Date is required.';
  if (!form.time)                 errors.time          = 'Time is required.';
  if (!APPOINTMENT_DURATIONS.includes(form.duration))
    errors.duration = 'Duration is required.';
  return errors;
}

const inputBase =
  'w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-700 outline-none transition ' +
  'placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100';

function fieldClass(hasError) {
  return `${inputBase} ${hasError ? 'border-red-400 focus:ring-red-100' : 'border-slate-200'}`;
}

export default function AppointmentForm({
  initialValue = null,
  staff = STAFF_LIST,
  onSubmit,
  onCancel,
  submitting = false,
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!initialValue) {
      setForm(EMPTY_FORM);
      return;
    }
    setForm({
      guestName:     initialValue.guestName ?? '',
      contactNumber: initialValue.contactNumber ?? '',
      companyName:   initialValue.companyName ?? '',
      purpose:       initialValue.purpose ?? '',
      hostId:        initialValue.hostId ?? '',
      date:          initialValue.date ?? '',
      time:          initialValue.time ?? '',
      duration:      initialValue.duration ?? '1 Hour',
      notes:         initialValue.notes ?? '',
      status:        initialValue.status ?? 'Pending',
      documentRequirements: Array.isArray(initialValue.documentRequirements)
        ? initialValue.documentRequirements
        : [],
    });
    setErrors({});
  }, [initialValue]);

  const patch = (patchObj) => {
    setForm((f) => ({ ...f, ...patchObj }));
    setErrors((prev) => {
      const next = { ...prev };
      Object.keys(patchObj).forEach((k) => delete next[k]);
      return next;
    });
  };

  const toggleDocument = (doc) => {
    setForm((f) => {
      const current = Array.isArray(f.documentRequirements) ? f.documentRequirements : [];
      const nextList = current.includes(doc)
        ? current.filter((d) => d !== doc)
        : [...current, doc];
      return { ...f, documentRequirements: nextList };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const nextErrors = validate(form);
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    const host = staff.find((s) => s.id === form.hostId);
    onSubmit({
      ...form,
      host: host ? host.name : '',
      guestName: form.guestName.trim(),
      contactNumber: form.contactNumber.trim(),
      companyName: form.companyName.trim(),
      notes: form.notes.trim(),
      documentRequirements: Array.isArray(form.documentRequirements)
        ? form.documentRequirements
        : [],
    });
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">
            Guest Name<span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.guestName}
            onChange={(e) => patch({ guestName: e.target.value })}
            placeholder="e.g. Ravi Kapoor"
            className={fieldClass(errors.guestName)}
            maxLength={80}
          />
          {errors.guestName && <p className="mt-1 text-xs text-red-500">{errors.guestName}</p>}
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">
            Contact Number<span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            inputMode="numeric"
            value={form.contactNumber}
            onChange={(e) =>
              patch({ contactNumber: e.target.value.replace(/\D/g, '').slice(0, 10) })
            }
            placeholder="Enter Contact Number"
            className={fieldClass(errors.contactNumber)}
            maxLength={10}
          />
          {errors.contactNumber && (
            <p className="mt-1 text-xs text-red-500">{errors.contactNumber}</p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">
            Company Name<span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.companyName}
            onChange={(e) => patch({ companyName: e.target.value })}
            placeholder="e.g. TechCorp"
            className={fieldClass(errors.companyName)}
            maxLength={80}
          />
          {errors.companyName && <p className="mt-1 text-xs text-red-500">{errors.companyName}</p>}
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">
            Purpose<span className="text-red-500">*</span>
          </label>
          <select
            value={form.purpose}
            onChange={(e) => patch({ purpose: e.target.value })}
            className={fieldClass(errors.purpose)}
          >
            <option value="">Select purpose</option>
            {APPOINTMENT_PURPOSES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          {errors.purpose && <p className="mt-1 text-xs text-red-500">{errors.purpose}</p>}
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">
            Host<span className="text-red-500">*</span>
          </label>
          <select
            value={form.hostId}
            onChange={(e) => patch({ hostId: e.target.value })}
            className={fieldClass(errors.hostId)}
          >
            <option value="">Select host</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — {s.role}
              </option>
            ))}
          </select>
          {errors.hostId && <p className="mt-1 text-xs text-red-500">{errors.hostId}</p>}
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">
            Duration<span className="text-red-500">*</span>
          </label>
          <select
            value={form.duration}
            onChange={(e) => patch({ duration: e.target.value })}
            className={fieldClass(errors.duration)}
          >
            {APPOINTMENT_DURATIONS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          {errors.duration && <p className="mt-1 text-xs text-red-500">{errors.duration}</p>}
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">
            Date<span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={form.date}
            onChange={(e) => patch({ date: e.target.value })}
            className={fieldClass(errors.date)}
          />
          {errors.date && <p className="mt-1 text-xs text-red-500">{errors.date}</p>}
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">
            Time<span className="text-red-500">*</span>
          </label>
          <input
            type="time"
            value={form.time}
            onChange={(e) => patch({ time: e.target.value })}
            className={fieldClass(errors.time)}
          />
          {errors.time && <p className="mt-1 text-xs text-red-500">{errors.time}</p>}
        </div>

        {initialValue && (
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Status</label>
            <select
              value={form.status}
              onChange={(e) => patch({ status: e.target.value })}
              className={fieldClass(false)}
            >
              {APPOINTMENT_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div>
        <span className="mb-1 block text-xs font-semibold text-slate-600">
          Required Documents (optional)
        </span>
        <p className="mb-2 text-[11px] text-slate-400">
          Guest will be asked to bring these on arrival.
        </p>
        <div className="flex flex-wrap gap-2">
          {DOCUMENT_REQUIREMENTS.map((doc) => {
            const checked = (form.documentRequirements || []).includes(doc);
            return (
              <label
                key={doc}
                className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                  checked
                    ? 'border-sky-400 bg-sky-50 text-sky-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleDocument(doc)}
                  className="h-3.5 w-3.5 accent-sky-600"
                />
                {doc}
              </label>
            );
          })}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-600">Notes (optional)</label>
        <textarea
          value={form.notes}
          onChange={(e) => patch({ notes: e.target.value })}
          rows={3}
          maxLength={500}
          placeholder="Any additional context for reception…"
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
          disabled={submitting}
          className="rounded-lg border border-sky-700 bg-sky-700 px-5 py-2 text-sm font-semibold text-white transition hover:bg-sky-800 disabled:opacity-60"
        >
          {submitting ? 'Saving…' : initialValue ? 'Update Appointment' : 'Create Appointment'}
        </button>
      </div>
    </form>
  );
}
