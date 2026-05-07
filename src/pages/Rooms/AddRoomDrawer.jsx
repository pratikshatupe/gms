import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X, DoorOpen, Users, Sparkles, CalendarClock, FileText, Loader2,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import { Field, SearchableSelect, Toast } from '../../components/ui';
import { useCollection, STORAGE_KEYS } from '../../store';
import { MOCK_ROOMS, MOCK_OFFICES } from '../../data/mockData';
import { addAuditLog } from '../../utils/auditLogger';

export const ROOM_TYPES = [
  'Conference Room', 'Meeting Room', 'Cabin',
  'Training Room', 'Lobby', 'Cafeteria', 'Other',
];

export const AMENITIES = [
  'Projector', 'Whiteboard', 'Video Conferencing', 'Air Conditioning',
  'Wi-Fi', 'Speaker Phone', 'TV Screen', 'Coffee Machine',
];

export const ROOM_STATUSES = ['Active', 'Inactive', 'Under Maintenance'];

export const DEFAULT_BOOKING_RULES = Object.freeze({
  minBookingMinutes: 30,
  maxBookingMinutes: 240,
  requiresApproval: false,
  advanceBookingDays: 7,
});

export function byOrg(records, user) {
  if (!Array.isArray(records)) return [];
  const role = String(user?.role || '').toLowerCase();
  if (role === 'superadmin') return records;
  const orgId = user?.organisationId || user?.orgId || null;
  if (!orgId) return [];
  return records.filter((r) => !r?.orgId || r.orgId === orgId);
}

const isBlank = (v) => v == null || String(v).trim().length === 0;
const ROOM_NAME_RE = /^(?=.*[A-Za-z])[A-Za-z .,&()'/-]+$/;
const FLOOR_RE = /^[A-Za-z0-9 -]+$/;

function normalizeSpaces(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function sanitizeRoomName(value) {
  return String(value || '')
    .replace(/[^A-Za-z .,&()'/-]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^\s+/g, '')
    .slice(0, 100);
}

function sanitizeRoomCode(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, 20);
}

function sanitizeFloor(value) {
  return String(value || '')
    .replace(/[^A-Za-z0-9 -]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^\s+/g, '')
    .slice(0, 10);
}

function sanitizeDigits(value, maxLength = 4) {
  return String(value || '').replace(/\D/g, '').slice(0, maxLength);
}

function sanitizeDescription(value) {
  return String(value || '').slice(0, 500);
}

export function validateRoomForm(form, allRooms, userOffices = [], opts = {}) {
  const { excludeId = null } = opts;
  const e = {};

  const name = normalizeSpaces(form.name);
  const code = sanitizeRoomCode(form.code);
  const floor = normalizeSpaces(form.floor);
  const officeId = String(form.officeId || '').trim();
  const desc = String(form.description || '').trim();

  const validOfficeIds = new Set(
    (userOffices || [])
      .filter((o) => String(o?.status || 'Active') !== 'Inactive')
      .map((o) => o.id)
  );

  if (isBlank(name)) {
    e.name = 'Room Name is required.';
  } else if (name.length < 2) {
    e.name = 'Room Name must be at least 2 characters.';
  } else if (name.length > 100) {
    e.name = 'Room Name must be 100 characters or fewer.';
  } else if (!ROOM_NAME_RE.test(name)) {
    e.name = 'Room Name must contain letters only. Numbers are not allowed.';
  } else {
    const dupName = (allRooms || []).find(
      (r) =>
        r &&
        r.officeId === officeId &&
        normalizeSpaces(r.name).toLowerCase() === name.toLowerCase() &&
        r.id !== excludeId
    );
    if (dupName) e.name = 'Room Name already exists within this office.';
  }

  if (isBlank(code)) {
    e.code = 'Room Code is required.';
  } else if (code.length < 3 || code.length > 20) {
    e.code = 'Room Code must be 3 to 20 characters.';
  } else if (!/^[A-Z0-9-]+$/.test(code)) {
    e.code = 'Room Code accepts letters, digits and hyphens only.';
  } else {
    const dup = (allRooms || []).find(
      (r) =>
        r &&
        r.officeId === officeId &&
        String(r.code || '').toUpperCase() === code &&
        r.id !== excludeId
    );
    if (dup) e.code = 'Room Code must be unique within this office.';
  }

  if (isBlank(form.type) || !ROOM_TYPES.includes(form.type)) {
    e.type = 'Room Type is required.';
  }

  if (isBlank(officeId)) {
    e.officeId = 'Office is required.';
  } else if (!validOfficeIds.has(officeId)) {
    e.officeId = 'Selected office is invalid.';
  }

  if (isBlank(floor)) {
    e.floor = 'Floor is required.';
  } else if (floor.length < 1 || floor.length > 10) {
    e.floor = 'Floor must be 1 to 10 characters.';
  } else if (!FLOOR_RE.test(floor)) {
    e.floor = 'Floor contains unsupported characters.';
  }

  const cap = form.seatingCapacity;
  if (cap == null || cap === '') {
    e.seatingCapacity = 'Seating Capacity is required.';
  } else {
    const n = Number(cap);
    if (!Number.isFinite(n) || !Number.isInteger(n)) {
      e.seatingCapacity = 'Seating Capacity must be a whole number.';
    } else if (n < 1) {
      e.seatingCapacity = 'Seating Capacity must be at least 1.';
    } else if (n > 500) {
      e.seatingCapacity = 'Seating Capacity must be 500 or fewer.';
    }
  }

  if (typeof form.bookableByVisitors !== 'boolean') {
    e.bookableByVisitors = 'Bookable by Visitors is required.';
  }

  if (!ROOM_STATUSES.includes(form.status)) {
    e.status = 'Status is required.';
  }

  const rules = form.bookingRules || {};
  const minM = Number(rules.minBookingMinutes);
  const maxM = Number(rules.maxBookingMinutes);
  const adv = Number(rules.advanceBookingDays);

  if (!Number.isFinite(minM) || minM < 15 || minM > 480) {
    e['bookingRules.minBookingMinutes'] = 'Minimum Booking Duration must be 15 to 480 minutes.';
  }

  if (!Number.isFinite(maxM) || maxM < 30 || maxM > 1440) {
    e['bookingRules.maxBookingMinutes'] = 'Maximum Booking Duration must be 30 to 1440 minutes.';
  }

  if (Number.isFinite(minM) && Number.isFinite(maxM) && maxM <= minM) {
    e['bookingRules.maxBookingMinutes'] = 'Maximum Booking Duration must be greater than Minimum Booking Duration.';
  }

  if (!Number.isFinite(adv) || adv < 0 || adv > 90) {
    e['bookingRules.advanceBookingDays'] = 'Advance Booking Window must be 0 to 90 days.';
  }

  if (desc.length > 500) {
    e.description = 'Description must be 500 characters or fewer.';
  }

  return e;
}

export function emptyRoomShape() {
  return {
    name: '',
    code: '',
    type: '',
    officeId: '',
    floor: '',
    seatingCapacity: '',
    amenities: [],
    bookableByVisitors: true,
    status: 'Active',
    bookingRules: { ...DEFAULT_BOOKING_RULES },
    description: '',
    imageUrl: '',
  };
}

export default function AddRoomDrawer({ open, onClose, onCreated, currentUser }) {
  const [rooms, addRoom] = useCollection(STORAGE_KEYS.ROOMS, MOCK_ROOMS);
  const [officesAll] = useCollection(STORAGE_KEYS.OFFICES, MOCK_OFFICES);
  const orgId = currentUser?.organisationId || currentUser?.orgId || null;

  const userOffices = useMemo(
    () =>
      byOrg(officesAll, currentUser).filter(
        (o) => String(o?.status || 'Active') !== 'Inactive'
      ),
    [officesAll, currentUser]
  );

  const [form, setForm] = useState(() => {
    const base = emptyRoomShape();
    if (userOffices.length === 1) base.officeId = userOffices[0].id;
    return base;
  });

  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const closeBtnRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const base = emptyRoomShape();
    if (userOffices.length === 1) base.officeId = userOffices[0].id;
    setForm(base);
    setErrors({});
    setSaving(false);
    setRulesOpen(false);
  }, [open, userOffices]);

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

    if (path === 'name') nextValue = sanitizeRoomName(value);
    if (path === 'code') nextValue = sanitizeRoomCode(value);
    if (path === 'floor') nextValue = sanitizeFloor(value);
    if (path === 'seatingCapacity') nextValue = sanitizeDigits(value, 3);
    if (path === 'bookingRules.minBookingMinutes') nextValue = sanitizeDigits(value, 4);
    if (path === 'bookingRules.maxBookingMinutes') nextValue = sanitizeDigits(value, 4);
    if (path === 'bookingRules.advanceBookingDays') nextValue = sanitizeDigits(value, 2);
    if (path === 'description') nextValue = sanitizeDescription(value);

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

  const toggleAmenity = (amenity) => {
    setForm((f) => {
      const set = new Set(f.amenities || []);
      if (set.has(amenity)) set.delete(amenity);
      else set.add(amenity);
      return { ...f, amenities: AMENITIES.filter((a) => set.has(a)) };
    });
  };

  const handleCodeBlur = () => {
    if (form.code) setField('code', sanitizeRoomCode(form.code));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;

    const cleanedForm = {
      ...form,
      name: normalizeSpaces(form.name),
      code: sanitizeRoomCode(form.code),
      floor: normalizeSpaces(form.floor),
      description: String(form.description || '').trim(),
      bookingRules: {
        minBookingMinutes: Number(form.bookingRules.minBookingMinutes),
        maxBookingMinutes: Number(form.bookingRules.maxBookingMinutes),
        requiresApproval: Boolean(form.bookingRules.requiresApproval),
        advanceBookingDays: Number(form.bookingRules.advanceBookingDays),
      },
    };

    const e = validateRoomForm(cleanedForm, rooms, userOffices);

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
      (rooms || [])
        .map((r) => Number(String(r?.id || '').replace(/\D/g, '')))
        .filter((n) => Number.isFinite(n))
        .reduce((a, b) => Math.max(a, b), 0) + 1;

    const id = `ROOM-${String(nextSeq).padStart(5, '0')}`;
    const now = new Date().toISOString();
    const author = currentUser?.name || 'Unknown';
    const selectedOffice = officesAll.find((o) => o.id === cleanedForm.officeId);
    const recordOrgId = selectedOffice?.orgId || orgId;

    const record = {
      id,
      orgId: recordOrgId,
      officeId: cleanedForm.officeId,
      name: cleanedForm.name,
      code: cleanedForm.code,
      type: cleanedForm.type,
      floor: cleanedForm.floor,
      seatingCapacity: Number(cleanedForm.seatingCapacity),
      amenities: [...cleanedForm.amenities],
      bookableByVisitors: Boolean(cleanedForm.bookableByVisitors),
      bookingRules: {
        minBookingMinutes: Number(cleanedForm.bookingRules.minBookingMinutes),
        maxBookingMinutes: Number(cleanedForm.bookingRules.maxBookingMinutes),
        requiresApproval: Boolean(cleanedForm.bookingRules.requiresApproval),
        advanceBookingDays: Number(cleanedForm.bookingRules.advanceBookingDays),
      },
      status: cleanedForm.status,
      description: cleanedForm.description,
      imageUrl: String(cleanedForm.imageUrl || '').trim(),
      createdAt: now,
      createdBy: author,
      updatedAt: now,
      updatedBy: author,
    };

    addRoom(record);

    addAuditLog({
      userName: author,
      role: (currentUser?.role || '').toString(),
      action: 'CREATE',
      module: 'Rooms',
      description: `Created room ${record.name} (${record.code}) at office ${selectedOffice?.name || cleanedForm.officeId}.`,
      orgId: recordOrgId,
    });

    setSaving(false);
    onCreated?.(record);
  };

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-room-title"
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
            title="Add Room"
            subtitle="Add a meeting room, cabin or common area to one of your offices."
            onClose={onClose}
            disabled={saving}
          />

          <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
              <RoomFormBody
                form={form}
                errors={errors}
                setField={setField}
                onToggleAmenity={toggleAmenity}
                onCodeBlur={handleCodeBlur}
                userOffices={userOffices}
                codeImmutable={false}
                officeImmutable={false}
                rulesOpen={rulesOpen}
                setRulesOpen={setRulesOpen}
              />
            </div>

            <Footer saving={saving} submitLabel="Save Room" onCancel={onClose} />
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
        <h2 id="add-room-title" className="font-[Outfit,sans-serif] text-[16px] font-extrabold leading-tight">
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

export function RoomFormBody({
  form,
  errors,
  setField,
  onToggleAmenity,
  onCodeBlur,
  userOffices,
  codeImmutable,
  officeImmutable,
  rulesOpen,
  setRulesOpen,
}) {
  const descLen = (form.description || '').length;

  return (
    <>
      <SectionHeader Icon={DoorOpen} title="Basic Details" />

      <div data-field="name">
        <Field label="Room Name" required error={errors.name}>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setField('name', e.target.value)}
            onPaste={(e) => {
              e.preventDefault();
              const pasted = e.clipboardData.getData('text');
              setField('name', `${form.name}${pasted}`);
            }}
            placeholder="Enter Room Name"
            maxLength={100}
            className={inputCls(errors.name)}
          />
        </Field>
      </div>

      <div className={twoColCls()}>
        <div data-field="code">
          <Field
            label="Room Code"
            required
            error={errors.code}
            hint={codeImmutable ? 'Cannot be changed.' : 'Uppercase letters, digits and hyphens. Unique within the selected office.'}
          >
            <input
              type="text"
              value={form.code}
              onChange={(e) => setField('code', e.target.value)}
              onBlur={onCodeBlur}
              placeholder="Enter Room Code (e.g. CONF-A)"
              maxLength={20}
              disabled={codeImmutable}
              className={`${inputCls(errors.code)} ${codeImmutable ? 'opacity-40 cursor-not-allowed' : ''}`}
            />
          </Field>
        </div>

        <div data-field="type">
          <Field label="Room Type" required error={errors.type}>
            <SearchableSelect
              value={form.type}
              onChange={(v) => setField('type', v)}
              options={ROOM_TYPES.map((t) => ({ value: t, label: t }))}
              placeholder="Select Room Type"
              error={Boolean(errors.type)}
            />
          </Field>
        </div>
      </div>

      <div className={twoColCls()}>
        <div data-field="officeId">
          <Field
            label="Office"
            required
            error={errors.officeId}
            hint={officeImmutable ? 'Contact admin to transfer this room to another office.' : undefined}
          >
            <SearchableSelect
              value={form.officeId}
              onChange={(v) => setField('officeId', v)}
              options={userOffices.map((o) => ({ value: o.id, label: `${o.name} (${o.code})` }))}
              placeholder={userOffices.length ? 'Select Office' : 'No offices available'}
              searchPlaceholder="Search office…"
              disabled={officeImmutable || userOffices.length === 0}
              error={Boolean(errors.officeId)}
            />
          </Field>
        </div>

        <div data-field="floor">
          <Field label="Floor" required error={errors.floor} hint="Examples: Ground, 1st, 2nd, Mezzanine.">
            <input
              type="text"
              value={form.floor}
              onChange={(e) => setField('floor', e.target.value)}
              placeholder="Enter Floor"
              maxLength={10}
              className={inputCls(errors.floor)}
            />
          </Field>
        </div>
      </div>

      <SectionHeader Icon={Users} title="Capacity and Availability" />

      <div data-field="seatingCapacity">
        <Field label="Seating Capacity" required error={errors.seatingCapacity} hint="Whole number between 1 and 500.">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={500}
            step={1}
            value={form.seatingCapacity}
            onChange={(e) => setField('seatingCapacity', e.target.value)}
            placeholder="Enter Seating Capacity"
            className={inputCls(errors.seatingCapacity)}
          />
        </Field>
      </div>

      <Field label="Bookable by Visitors" required error={errors.bookableByVisitors}>
        <div role="radiogroup" aria-label="Bookable by Visitors" className="flex gap-2">
          {[
            { v: true, label: 'Yes' },
            { v: false, label: 'No' },
          ].map((opt) => {
            const active = form.bookableByVisitors === opt.v;
            return (
              <button
                key={String(opt.v)}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setField('bookableByVisitors', opt.v)}
                className={`cursor-pointer rounded-[10px] border px-4 py-2 text-[12px] font-bold transition ${
                  active
                    ? 'border-sky-700 bg-sky-700 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-300'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Status" required error={errors.status}>
        <div role="radiogroup" aria-label="Status" className="flex flex-wrap gap-2">
          {ROOM_STATUSES.map((s) => {
            const active = form.status === s;
            const activeCls =
              s === 'Active'
                ? 'border-emerald-700 bg-emerald-700 text-white'
                : s === 'Under Maintenance'
                ? 'border-amber-700 bg-amber-700 text-white'
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

      <SectionHeader Icon={Sparkles} title="Amenities (optional)" />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {AMENITIES.map((a) => {
          const checked = form.amenities.includes(a);
          return (
            <label
              key={a}
              className={`flex cursor-pointer items-center gap-2 rounded-[10px] border px-3 py-2 text-[12px] font-semibold transition ${
                checked
                  ? 'border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-400/40 dark:bg-sky-500/15 dark:text-sky-200'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-300'
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggleAmenity(a)}
                className="h-4 w-4 cursor-pointer accent-sky-600"
              />
              {a}
            </label>
          );
        })}
      </div>

      <div className="mt-4">
        <button
          type="button"
          onClick={() => setRulesOpen((o) => !o)}
          aria-expanded={rulesOpen}
          className="mb-3 inline-flex cursor-pointer items-center gap-2 font-[Outfit,sans-serif] text-[12px] font-extrabold uppercase tracking-[0.08em] text-sky-700 dark:text-sky-300"
        >
          <CalendarClock size={14} aria-hidden="true" />
          Booking Rules (optional)
          {rulesOpen ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
        </button>

        {rulesOpen && (
          <>
            <div className={twoColCls()}>
              <div data-field="bookingRules.minBookingMinutes">
                <Field label="Minimum Booking Duration" hint="Minutes, 15–480." error={errors['bookingRules.minBookingMinutes']}>
                  <input
                    type="number"
                    min={15}
                    max={480}
                    step={5}
                    value={form.bookingRules.minBookingMinutes}
                    onChange={(e) => setField('bookingRules.minBookingMinutes', e.target.value)}
                    placeholder="Enter Minimum Duration"
                    className={inputCls(errors['bookingRules.minBookingMinutes'])}
                  />
                </Field>
              </div>

              <div data-field="bookingRules.maxBookingMinutes">
                <Field label="Maximum Booking Duration" hint="Minutes, 30–1440." error={errors['bookingRules.maxBookingMinutes']}>
                  <input
                    type="number"
                    min={30}
                    max={1440}
                    step={5}
                    value={form.bookingRules.maxBookingMinutes}
                    onChange={(e) => setField('bookingRules.maxBookingMinutes', e.target.value)}
                    placeholder="Enter Maximum Duration"
                    className={inputCls(errors['bookingRules.maxBookingMinutes'])}
                  />
                </Field>
              </div>
            </div>

            <div className={twoColCls()}>
              <div data-field="bookingRules.advanceBookingDays">
                <Field label="Advance Booking Window" hint="Days, 0–90." error={errors['bookingRules.advanceBookingDays']}>
                  <input
                    type="number"
                    min={0}
                    max={90}
                    step={1}
                    value={form.bookingRules.advanceBookingDays}
                    onChange={(e) => setField('bookingRules.advanceBookingDays', e.target.value)}
                    placeholder="Enter Advance Window"
                    className={inputCls(errors['bookingRules.advanceBookingDays'])}
                  />
                </Field>
              </div>

              <Field label="Requires Approval">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-700 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={Boolean(form.bookingRules.requiresApproval)}
                    onChange={(e) => setField('bookingRules.requiresApproval', e.target.checked)}
                    className="h-4 w-4 cursor-pointer accent-sky-600"
                  />
                  Require host approval before confirming the booking.
                </label>
              </Field>
            </div>
          </>
        )}
      </div>

      <SectionHeader Icon={FileText} title="Description (optional)" />
      <div data-field="description">
        <Field label="Description" hint={`${descLen.toLocaleString('en-GB')} / 500 characters.`} error={errors.description}>
          <textarea
            value={form.description || ''}
            onChange={(e) => setField('description', e.target.value)}
            placeholder="Enter Description"
            rows={4}
            maxLength={500}
            className={`${inputCls(errors.description)} resize-none`}
          />
        </Field>
      </div>
    </>
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