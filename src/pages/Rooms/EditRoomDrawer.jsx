import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Toast } from '../../components/ui';
import { useCollection, STORAGE_KEYS } from '../../store';
import { MOCK_ROOMS, MOCK_OFFICES } from '../../data/mockData';
import { addAuditLog } from '../../utils/auditLogger';
import {
  validateRoomForm,
  emptyRoomShape,
  DEFAULT_BOOKING_RULES,
  byOrg,
  Header,
  Footer,
  RoomFormBody,
  AMENITIES,
} from './AddRoomDrawer';

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

function hydrate(room) {
  if (!room) return emptyRoomShape();
  const base = emptyRoomShape();

  return {
    name: room.name || '',
    code: room.code || '',
    type: room.type || '',
    officeId: room.officeId || '',
    floor: room.floor || '',
    seatingCapacity: room.seatingCapacity ?? '',
    amenities: AMENITIES.filter(
      (a) => Array.isArray(room.amenities) && room.amenities.includes(a)
    ),
    bookableByVisitors:
      typeof room.bookableByVisitors === 'boolean' ? room.bookableByVisitors : true,
    status: room.status || 'Active',
    bookingRules: {
      ...DEFAULT_BOOKING_RULES,
      ...(room.bookingRules || {}),
    },
    description: room.description || '',
    imageUrl: room.imageUrl || '',
  };
}

function diffSummary(before, after) {
  const lines = [];
  const scalarKeys = [
    'name',
    'type',
    'floor',
    'seatingCapacity',
    'bookableByVisitors',
    'status',
  ];

  for (const k of scalarKeys) {
    if (before?.[k] !== after?.[k]) {
      lines.push(`${k}: ${before?.[k]} → ${after?.[k]}`);
    }
  }

  const beforeAm = JSON.stringify((before?.amenities || []).slice().sort());
  const afterAm = JSON.stringify((after?.amenities || []).slice().sort());
  if (beforeAm !== afterAm) lines.push('amenities updated');

  const beforeR = JSON.stringify(before?.bookingRules || {});
  const afterR = JSON.stringify(after?.bookingRules || {});
  if (beforeR !== afterR) lines.push('bookingRules updated');

  return lines.join('; ');
}

export default function EditRoomDrawer({
  open,
  room,
  onClose,
  onUpdated,
  currentUser,
}) {
  const [rooms, , updateRoom] = useCollection(STORAGE_KEYS.ROOMS, MOCK_ROOMS);
  const [officesAll] = useCollection(STORAGE_KEYS.OFFICES, MOCK_OFFICES);

  const userOffices = useMemo(() => {
    const scoped = byOrg(officesAll, currentUser);
    const includesCurrent = scoped.some((o) => o?.id === room?.officeId);
    if (includesCurrent || !room) return scoped;
    const current = officesAll.find((o) => o?.id === room.officeId);
    return current ? [...scoped, current] : scoped;
  }, [officesAll, currentUser, room]);

  const [form, setForm] = useState(() => hydrate(room));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [rulesOpen, setRulesOpen] = useState(true);
  const closeBtnRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setForm(hydrate(room));
    setErrors({});
    setSaving(false);
    setRulesOpen(true);
  }, [open, room]);

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

  if (!open || !room) return null;

  const setField = (path, value) => {
    let nextValue = value;

    if (path === 'name') nextValue = sanitizeRoomName(value);
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

      return {
        ...f,
        amenities: AMENITIES.filter((a) => set.has(a)),
      };
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;

    const formToCheck = {
      ...form,
      code: room.code,
      officeId: room.officeId,
      name: normalizeSpaces(form.name),
      floor: normalizeSpaces(form.floor),
      description: String(form.description || '').trim(),
      bookingRules: {
        minBookingMinutes: Number(form.bookingRules.minBookingMinutes),
        maxBookingMinutes: Number(form.bookingRules.maxBookingMinutes),
        requiresApproval: Boolean(form.bookingRules.requiresApproval),
        advanceBookingDays: Number(form.bookingRules.advanceBookingDays),
      },
    };

    const e = validateRoomForm(formToCheck, rooms, userOffices, {
      excludeId: room.id,
    });

    if (Object.keys(e).length) {
      setErrors(e);
      setToast({ type: 'error', msg: 'Please fix the highlighted fields and try again.' });
      return;
    }

    setSaving(true);
    await new Promise((r) => setTimeout(r, 800));

    const now = new Date().toISOString();
    const author = currentUser?.name || 'Unknown';

    const patch = {
      code: room.code,
      officeId: room.officeId,
      orgId: room.orgId,
      name: normalizeSpaces(form.name),
      type: form.type,
      floor: normalizeSpaces(form.floor),
      seatingCapacity: Number(form.seatingCapacity),
      amenities: [...form.amenities],
      bookableByVisitors: Boolean(form.bookableByVisitors),
      bookingRules: {
        minBookingMinutes: Number(form.bookingRules.minBookingMinutes),
        maxBookingMinutes: Number(form.bookingRules.maxBookingMinutes),
        requiresApproval: Boolean(form.bookingRules.requiresApproval),
        advanceBookingDays: Number(form.bookingRules.advanceBookingDays),
      },
      status: form.status,
      description: String(form.description || '').trim(),
      imageUrl: String(form.imageUrl || '').trim(),
      updatedAt: now,
      updatedBy: author,
    };

    updateRoom(room.id, patch);

    const summary = diffSummary(room, { ...room, ...patch });
    addAuditLog({
      userName: author,
      role: (currentUser?.role || '').toString(),
      action: 'UPDATE',
      module: 'Rooms',
      description: `Updated room ${patch.name} (${room.code})${summary ? ` — ${summary}` : ''}.`,
      orgId: room.orgId,
    });

    setSaving(false);
    onUpdated?.({ ...room, ...patch });
  };

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-room-title"
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
            title={`Edit Room — ${room.name}`}
            subtitle={`Room Code: ${room.code} (immutable).`}
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
                onCodeBlur={() => {}}
                userOffices={userOffices}
                codeImmutable
                officeImmutable
                rulesOpen={rulesOpen}
                setRulesOpen={setRulesOpen}
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

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
}