import React, { useMemo } from 'react';
import {
  ArrowLeft, DoorOpen, Building2, Layers, Users, CalendarCheck,
  Wifi, Projector, MonitorPlay, Wind, Coffee, PenLine,
  ShieldCheck, Clock, Hash, MapPin, Star, CheckCircle2, XCircle,
  Pencil, Trash2,
} from 'lucide-react';
import { useCollection, STORAGE_KEYS } from '../../store';
import { MOCK_OFFICES } from '../../data/mockData';

/* ── helpers ─────────────────────────────────────────────────── */

const AMENITY_ICONS = {
  'Projector':          Projector,
  'Whiteboard':         PenLine,
  'Video Conferencing': MonitorPlay,
  'Air Conditioning':   Wind,
  'Wi-Fi':              Wifi,
  'TV Screen':          MonitorPlay,
  'Coffee Machine':     Coffee,
};

function AmenityIcon({ name }) {
  const Icon = AMENITY_ICONS[name] || Star;
  return <Icon size={13} aria-hidden="true" />;
}

function StatusBadge({ status }) {
  const cfg = {
    'Active':            'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
    'Inactive':          'border-slate-500/30 bg-slate-500/10 text-slate-400',
    'Under Maintenance': 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  }[status] || 'border-slate-500/30 bg-slate-500/10 text-slate-400';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${cfg}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {status || 'Active'}
    </span>
  );
}

function TypeBadge({ type }) {
  const cfg = {
    'Conference Room': 'border-sky-500/30 bg-sky-500/10 text-sky-400',
    'Meeting Room':    'border-blue-500/30 bg-blue-500/10 text-blue-400',
    'Cabin':           'border-amber-500/30 bg-amber-500/10 text-amber-400',
    'Training Room':   'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
    'Lobby':           'border-sky-500/30 bg-sky-500/10 text-sky-400',
    'Cafeteria':       'border-rose-500/30 bg-rose-500/10 text-rose-400',
  }[type] || 'border-slate-500/30 bg-slate-500/10 text-slate-400';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${cfg}`}>
      {type || 'Other'}
    </span>
  );
}

function InfoCard({ title, icon: Icon, children }) {
  return (
    <div className="rounded-[14px] border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-[8px] bg-sky-500/10 text-sky-400">
          <Icon size={14} aria-hidden="true" />
        </span>
        <h3 className="text-[13px] font-extrabold text-[var(--app-text)]">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Row({ label, value, mono }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[var(--app-border)] py-2.5 last:border-0">
      <span className="text-[11px] font-semibold text-[var(--app-text-subtle)] uppercase tracking-wide shrink-0">
        {label}
      </span>
      <span className={`text-right text-[12px] font-semibold text-[var(--app-text)] ${mono ? 'font-mono' : ''}`}>
        {value ?? '—'}
      </span>
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────── */

export default function RoomDetailPage({ room, onBack, onEdit, onDelete, canEdit, canDelete }) {
  const [offices] = useCollection(STORAGE_KEYS.OFFICES, MOCK_OFFICES);

  const office = useMemo(
    () => offices.find((o) => o.id === room?.officeId),
    [offices, room],
  );

  if (!room) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--app-bg)]">
        <p className="text-[var(--app-text-muted)]">Room not found.</p>
      </div>
    );
  }

  const amenities   = Array.isArray(room.amenities) ? room.amenities : [];
  const rules       = room.bookingRules || {};
  const createdDate = room.createdAt ? new Date(room.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const updatedDate = room.updatedAt ? new Date(room.updatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  const officeAddress = office?.address
    ? [office.address.line1, office.address.line2, office.address.city, office.address.country].filter(Boolean).join(', ')
    : null;

  return (
    <div className="w-full min-h-screen bg-[var(--app-bg)] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5">

        {/* ── Breadcrumb + Back ── */}
        <nav className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--app-text-subtle)]">
          <button type="button" onClick={onBack}
            className="flex cursor-pointer items-center gap-1 rounded-[6px] px-1.5 py-0.5 transition hover:bg-[var(--app-surface)] hover:text-sky-400">
            <ArrowLeft size={12} aria-hidden="true" /> Rooms
          </button>
          <span className="text-[var(--app-border)]">/</span>
          <span className="text-[var(--app-text)]">{room.name}</span>
        </nav>

        {/* ── Header ── */}
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[12px] border border-sky-500/30 bg-sky-500/10 text-sky-400">
              <DoorOpen size={22} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-[Outfit,sans-serif] text-[22px] font-extrabold text-[var(--app-text)]">
                  {room.name}
                </h1>
                <StatusBadge status={room.status} />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <TypeBadge type={room.type} />
                {room.code && (
                  <span className="font-mono text-[11px] text-[var(--app-text-subtle)]">
                    #{room.code}
                  </span>
                )}
              </div>
              {room.description && (
                <p className="mt-1.5 text-[12px] text-[var(--app-text-muted)]">{room.description}</p>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {canEdit && (
              <button type="button" onClick={() => onEdit?.(room)} title="Edit room"
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-[10px] border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-[12px] font-bold text-sky-400 transition hover:bg-sky-500/20">
                <Pencil size={13} aria-hidden="true" /> Edit
              </button>
            )}
            {canDelete && (
              <button type="button" onClick={() => onDelete?.(room)} title="Delete room"
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-[10px] border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] font-bold text-red-400 transition hover:bg-red-500/20">
                <Trash2 size={13} aria-hidden="true" /> Delete
              </button>
            )}
          </div>
        </header>

        {/* ── Body grid ── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

          {/* Left col — 2/3 */}
          <div className="flex flex-col gap-4 lg:col-span-2">

            {/* Room Details */}
            <InfoCard title="Room Details" icon={DoorOpen}>
              <div className="grid grid-cols-1 gap-0 sm:grid-cols-2">
                <div className="sm:border-r sm:border-[var(--app-border)] sm:pr-5">
                  <Row label="Room Code"    value={room.code}              mono />
                  <Row label="Type"         value={room.type} />
                  <Row label="Floor"        value={room.floor} />
                  <Row label="Capacity"     value={`${room.seatingCapacity ?? 0} seats`} />
                </div>
                <div className="sm:pl-5">
                  <Row label="Bookable by Visitors" value={room.bookableByVisitors ? 'Yes' : 'No'} />
                  <Row label="Status"       value={room.status} />
                  <Row label="Created"      value={createdDate} />
                  <Row label="Last Updated" value={updatedDate} />
                </div>
              </div>
            </InfoCard>

            {/* Booking Rules */}
            <InfoCard title="Booking Rules" icon={CalendarCheck}>
              <div className="grid grid-cols-1 gap-0 sm:grid-cols-2">
                <div className="sm:border-r sm:border-[var(--app-border)] sm:pr-5">
                  <Row label="Min Booking"
                    value={rules.minBookingMinutes != null ? `${rules.minBookingMinutes} min` : '—'} />
                  <Row label="Max Booking"
                    value={rules.maxBookingMinutes != null ? `${rules.maxBookingMinutes} min` : '—'} />
                </div>
                <div className="sm:pl-5">
                  <Row label="Requires Approval"
                    value={rules.requiresApproval ? 'Yes' : 'No'} />
                  <Row label="Advance Booking"
                    value={rules.advanceBookingDays != null ? `${rules.advanceBookingDays} days` : '—'} />
                </div>
              </div>
            </InfoCard>

            {/* Amenities */}
            <InfoCard title="Amenities" icon={Star}>
              {amenities.length === 0 ? (
                <p className="text-[12px] text-[var(--app-text-subtle)]">No amenities listed.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {amenities.map((a) => (
                    <span key={a}
                      className="inline-flex items-center gap-1.5 rounded-[8px] border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--app-text-muted)]">
                      <AmenityIcon name={a} />
                      {a}
                    </span>
                  ))}
                </div>
              )}
            </InfoCard>
          </div>

          {/* Right col — 1/3 */}
          <div className="flex flex-col gap-4">

            {/* Office Info */}
            <InfoCard title="Office" icon={Building2}>
              {office ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border border-sky-500/20 bg-sky-500/10 text-sky-400">
                      <Building2 size={14} aria-hidden="true" />
                    </span>
                    <div>
                      <div className="text-[13px] font-bold text-[var(--app-text)]">{office.name}</div>
                      <div className="font-mono text-[10px] text-[var(--app-text-subtle)]">{office.code}</div>
                    </div>
                  </div>
                  {officeAddress && (
                    <div className="flex items-start gap-1.5 rounded-[8px] bg-[var(--app-surface-muted)] px-3 py-2">
                      <MapPin size={11} className="mt-0.5 shrink-0 text-[var(--app-text-subtle)]" aria-hidden="true" />
                      <span className="text-[11px] text-[var(--app-text-muted)]">{officeAddress}</span>
                    </div>
                  )}
                  <Row label="Office Type" value={office.type} />
                </div>
              ) : (
                <p className="text-[12px] text-[var(--app-text-subtle)]">Office not found.</p>
              )}
            </InfoCard>

            {/* Quick Stats */}
            <InfoCard title="Quick Stats" icon={Layers}>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Capacity', value: room.seatingCapacity ?? 0, icon: Users, color: 'sky' },
                  { label: 'Floor',    value: room.floor || '—',         icon: Layers, color: 'violet' },
                  { label: 'Min Book', value: rules.minBookingMinutes ? `${rules.minBookingMinutes}m` : '—', icon: Clock, color: 'amber' },
                  { label: 'Advance',  value: rules.advanceBookingDays ? `${rules.advanceBookingDays}d` : '—', icon: CalendarCheck, color: 'emerald' },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div key={label}
                    className={`flex flex-col items-center justify-center rounded-[10px] border border-${color}-500/20 bg-${color}-500/8 p-3 gap-1`}>
                    <Icon size={16} className={`text-${color}-400`} aria-hidden="true" />
                    <div className={`text-[15px] font-extrabold text-${color}-400`}>{value}</div>
                    <div className="text-[10px] font-semibold text-[var(--app-text-subtle)] uppercase tracking-wide">{label}</div>
                  </div>
                ))}
              </div>
            </InfoCard>

            {/* Visitor Access */}
            <InfoCard title="Visitor Access" icon={ShieldCheck}>
              <div className="flex items-center gap-3 rounded-[10px] border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-3">
                {room.bookableByVisitors ? (
                  <>
                    <CheckCircle2 size={20} className="shrink-0 text-emerald-400" aria-hidden="true" />
                    <div>
                      <div className="text-[12px] font-bold text-[var(--app-text)]">Bookable by Visitors</div>
                      <div className="text-[11px] text-[var(--app-text-muted)]">Visitors can book this room.</div>
                    </div>
                  </>
                ) : (
                  <>
                    <XCircle size={20} className="shrink-0 text-red-400" aria-hidden="true" />
                    <div>
                      <div className="text-[12px] font-bold text-[var(--app-text)]">Staff Only</div>
                      <div className="text-[11px] text-[var(--app-text-muted)]">Visitors cannot book this room.</div>
                    </div>
                  </>
                )}
              </div>
              {rules.requiresApproval && (
                <div className="mt-2 flex items-center gap-2 rounded-[8px] border border-amber-500/20 bg-amber-500/8 px-3 py-2">
                  <ShieldCheck size={13} className="shrink-0 text-amber-400" aria-hidden="true" />
                  <span className="text-[11px] font-semibold text-amber-400">Approval required for every booking</span>
                </div>
              )}
            </InfoCard>

            {/* Room ID */}
            <div className="rounded-[14px] border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
              <div className="flex items-center gap-2 mb-2">
                <Hash size={12} className="text-[var(--app-text-subtle)]" aria-hidden="true" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--app-text-subtle)]">Room ID</span>
              </div>
              <code className="block font-mono text-[11px] text-[var(--app-text-muted)] break-all">{room.id}</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}