import React, { useEffect, useRef, useState } from 'react';
import { APPOINTMENT_PURPOSES, STAFF_LIST } from '../data/mockAppointments';
import { validatePhone, PHONE_ERROR_MSG } from '../utils/validators';

export const ID_TYPES = [
  'Emirates ID',
  'Passport',
  'Driving Licence',
  'Other',
];

const EMPTY_FORM = Object.freeze({
  guestName: '',
  contactNumber: '',
  companyName: '',
  purpose: '',
  host: '',
  idType: '',
  idNumber: '',
  photoDataUrl: '',
});

function validate(form) {
  const errors = {};
  if (!form.guestName.trim())     errors.guestName     = 'Guest Name is required.';
  if (!form.contactNumber.trim()) errors.contactNumber = 'Contact Number is required.';
  else if (!validatePhone(form.contactNumber.trim()))
    errors.contactNumber = PHONE_ERROR_MSG;
  if (!form.companyName.trim())   errors.companyName   = 'Company Name is required.';
  if (!form.purpose)              errors.purpose       = 'Purpose is required.';
  if (!form.host)                 errors.host          = 'Host is required.';
  if (form.idType && !form.idNumber.trim()) {
    errors.idNumber = 'ID Number is required when ID Type is selected.';
  }
  return errors;
}

const inputBase =
  'w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-700 outline-none transition ' +
  'placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100';

function fieldClass(hasError) {
  return `${inputBase} ${hasError ? 'border-red-400 focus:ring-red-100' : 'border-slate-200'}`;
}

function PhotoCapture({ value, onChange }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState('');

  const stopStream = () => {
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setActive(false);
  };

  useEffect(() => {
    return () => stopStream();
  }, []);

  const startCamera = async () => {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera is not supported by this browser. Use upload instead.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setActive(true);
    } catch (e) {
      setError(e?.name === 'NotAllowedError'
        ? 'Camera permission denied. Use upload instead.'
        : 'Could not start camera. Use upload instead.');
    }
  };

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const size = Math.min(video.videoWidth || 320, video.videoHeight || 320, 360);
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const sx = Math.max(0, (video.videoWidth  - size) / 2);
    const sy = Math.max(0, (video.videoHeight - size) / 2);
    ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    onChange(dataUrl);
    stopStream();
  };

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file.');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setError('Image must be under 3 MB.');
      return;
    }
    setError('');
    const reader = new FileReader();
    reader.onload = () => onChange(String(reader.result || ''));
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const clear = () => onChange('');

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-start gap-3">
        <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white">
          {value ? (
            <img src={value} alt="Visitor" className="h-full w-full object-cover" />
          ) : active ? (
            <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
          ) : (
            <span className="text-[10px] font-semibold text-slate-400">No photo</span>
          )}
        </div>
        <div className="flex flex-1 flex-wrap gap-2 text-xs">
          {!value && !active && (
            <>
              <button
                type="button"
                onClick={startCamera}
                className="rounded-lg border border-sky-200 bg-white px-3 py-1.5 font-semibold text-sky-700 hover:bg-sky-50"
              >
                📷 Start Camera
              </button>
              <label className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-600 hover:bg-slate-50">
                Upload
                <input type="file" accept="image/*" className="hidden" onChange={onFile} />
              </label>
            </>
          )}
          {active && (
            <>
              <button
                type="button"
                onClick={capture}
                className="rounded-lg border border-sky-700 bg-sky-700 px-3 py-1.5 font-semibold text-white hover:bg-sky-800"
              >
                Capture
              </button>
              <button
                type="button"
                onClick={stopStream}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
            </>
          )}
          {value && (
            <>
              <button
                type="button"
                onClick={clear}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-600 hover:bg-slate-50"
              >
                Retake
              </button>
            </>
          )}
          {error && <p className="w-full text-[11px] text-red-500">{error}</p>}
        </div>
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

export default function WalkInForm({
  staff = STAFF_LIST,
  onSubmit,
  submitting = false,
  onReset,
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});

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
    const nextErrors = validate(form);
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    onSubmit({
      guestName:     form.guestName.trim(),
      contactNumber: form.contactNumber.trim(),
      companyName:   form.companyName.trim(),
      purpose:       form.purpose,
      host:          form.host,
      idType:        form.idType,
      idNumber:      form.idNumber.trim(),
      photoDataUrl:  form.photoDataUrl,
    });
    setForm(EMPTY_FORM);
    onReset?.();
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
            placeholder="e.g. Vikram Singh"
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
            minLength={10}
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
            placeholder="e.g. Freelancer"
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

        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-semibold text-slate-600">
            Host<span className="text-red-500">*</span>
          </label>
          <select
            value={form.host}
            onChange={(e) => patch({ host: e.target.value })}
            className={fieldClass(errors.host)}
          >
            <option value="">Select host</option>
            {staff.map((s) => (
              <option key={s.id} value={s.name}>
                {s.name} — {s.role}
              </option>
            ))}
          </select>
          {errors.host && <p className="mt-1 text-xs text-red-500">{errors.host}</p>}
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">
            ID Type
          </label>
          <select
            value={form.idType}
            onChange={(e) => patch({ idType: e.target.value })}
            className={fieldClass(false)}
          >
            <option value="">Not verified</option>
            {ID_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">
            ID Number
          </label>
          <input
            type="text"
            value={form.idNumber}
            onChange={(e) => patch({ idNumber: e.target.value })}
            placeholder="ID / passport / licence number"
            className={fieldClass(errors.idNumber)}
            maxLength={40}
            disabled={!form.idType}
          />
          {errors.idNumber && <p className="mt-1 text-xs text-red-500">{errors.idNumber}</p>}
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-semibold text-slate-600">
            Visitor Photo (optional)
          </label>
          <PhotoCapture
            value={form.photoDataUrl}
            onChange={(url) => patch({ photoDataUrl: url })}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg border border-sky-700 bg-sky-700 px-5 py-2 text-sm font-semibold text-white transition hover:bg-sky-800 disabled:opacity-60"
        >
          {submitting ? 'Checking in…' : 'Check In Walk-in Visitor'}
        </button>
      </div>
    </form>
  );
}
