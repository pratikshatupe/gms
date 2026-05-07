import React, { useMemo } from 'react';
import {
  ArrowLeft, Sparkles, Building2, Clock, Tag, Hash,
  CheckCircle2, XCircle, Users, BadgeIndianRupee, Pencil,
  Trash2, MapPin, UserRound, Star, ShieldCheck, CalendarCheck,
} from 'lucide-react';
import { useCollection, STORAGE_KEYS } from '../../store';
import { MOCK_OFFICES, MOCK_STAFF } from '../../data/mockData';
import { resolveCurrencyForOrg, formatServicePrice } from './AddServiceDrawer';

/* ── helpers ─────────────────────────────────────────────────── */

function CategoryBadge({ category }) {
  const cfg = {
    'Refreshment': 'border-amber-500/30 bg-amber-500/10 text-amber-400',
    'IT Support':  'border-sky-500/30   bg-sky-500/10   text-sky-400',
    'Facility':    'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
    'Admin':       'border-violet-500/30 bg-violet-500/10 text-violet-400',
    'Security':    'border-red-500/30    bg-red-500/10    text-red-400',
    'Other':       'border-slate-500/30  bg-slate-500/10  text-slate-400',
  }[category] || 'border-slate-500/30 bg-slate-500/10 text-slate-400';
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold ${cfg}`}>
      {category || 'Other'}
    </span>
  );
}

function StatusBadge({ status }) {
  const active = status === 'Active';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${
      active
        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
        : 'border-slate-500/30 bg-slate-500/10 text-slate-400'
    }`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {status || 'Active'}
    </span>
  );
}

function InfoCard({ title, icon: Icon, children, accent = 'sky' }) {
  const colors = {
    sky:     'bg-sky-500/10 text-sky-400',
    amber:   'bg-amber-500/10 text-amber-400',
    emerald: 'bg-emerald-500/10 text-emerald-400',
    violet:  'bg-violet-500/10 text-violet-400',
  };
  return (
    <div className="rounded-[14px] border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <span className={`inline-flex h-7 w-7 items-center justify-center rounded-[8px] ${colors[accent] || colors.sky}`}>
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
      <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-[var(--app-text-subtle)]">
        {label}
      </span>
      <span className={`text-right text-[12px] font-semibold text-[var(--app-text)] ${mono ? 'font-mono' : ''}`}>
        {value ?? '—'}
      </span>
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────── */

export default function ServiceDetailPage({ service, onBack, onEdit, onDelete, canEdit, canDelete }) {
  const [offices] = useCollection(STORAGE_KEYS.OFFICES, MOCK_OFFICES);
  const [staff]   = useCollection(STORAGE_KEYS.STAFF,   MOCK_STAFF);

  const availableOffices = useMemo(() => {
    const ids = Array.isArray(service?.availableOfficeIds) ? service.availableOfficeIds : [];
    return ids.length
      ? offices.filter((o) => ids.includes(o.id))
      : [];
  }, [offices, service]);

  const assignedStaff = useMemo(() => {
    const ids = Array.isArray(service?.assignedStaffIds) ? service.assignedStaffIds : [];
    return ids.length ? staff.filter((s) => ids.includes(s.id)) : [];
  }, [staff, service]);

  if (!service) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--app-bg)]">
        <p className="text-[var(--app-text-muted)]">Service not found.</p>
      </div>
    );
  }

  const currency    = resolveCurrencyForOrg(null);
  const priceLabel  = service.chargeable
    ? `${formatServicePrice(service.price, currency)} / ${service.priceUnit || 'flat'}`
    : 'Free';
  const createdDate = service.createdAt
    ? new Date(service.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';
  const updatedDate = service.updatedAt
    ? new Date(service.updatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

  return (
    <div className="w-full min-h-screen bg-[var(--app-bg)] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5">

        {/* ── Breadcrumb ── */}
        <nav className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--app-text-subtle)]">
          <button type="button" onClick={onBack}
            className="flex cursor-pointer items-center gap-1 rounded-[6px] px-1.5 py-0.5 transition hover:bg-[var(--app-surface)] hover:text-sky-400">
            <ArrowLeft size={12} aria-hidden="true" /> Services
          </button>
          <span className="text-[var(--app-border)]">/</span>
          <span className="text-[var(--app-text)]">{service.name}</span>
        </nav>

        {/* ── Header ── */}
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[12px] border border-sky-500/30 bg-sky-500/10 text-3xl">
              {service.icon || '⚙️'}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-[Outfit,sans-serif] text-[22px] font-extrabold text-[var(--app-text)]">
                  {service.name}
                </h1>
                <StatusBadge status={service.status} />
                {service.createdAt && (Date.now() - new Date(service.createdAt).getTime()) < 48 * 3600 * 1000 && (
                  <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-emerald-400">
                    New
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <CategoryBadge category={service.category} />
                {service.code && (
                  <span className="font-mono text-[11px] text-[var(--app-text-subtle)]">#{service.code}</span>
                )}
              </div>
              {service.description && (
                <p className="mt-1.5 text-[12px] text-[var(--app-text-muted)]">{service.description}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canEdit && (
              <button type="button" onClick={() => onEdit?.(service)}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-[10px] border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-[12px] font-bold text-sky-400 transition hover:bg-sky-500/20">
                <Pencil size={13} aria-hidden="true" /> Edit
              </button>
            )}
            {canDelete && (
              <button type="button" onClick={() => onDelete?.(service)}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-[10px] border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] font-bold text-red-400 transition hover:bg-red-500/20">
                <Trash2 size={13} aria-hidden="true" /> Delete
              </button>
            )}
          </div>
        </header>

        {/* ── Body grid ── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

          {/* Left — 2/3 */}
          <div className="flex flex-col gap-4 lg:col-span-2">

            {/* Service Details */}
            <InfoCard title="Service Details" icon={Sparkles}>
              <div className="grid grid-cols-1 gap-0 sm:grid-cols-2">
                <div className="sm:border-r sm:border-[var(--app-border)] sm:pr-5">
                  <Row label="Service Code"  value={service.code}     mono />
                  <Row label="Category"      value={service.category} />
                  <Row label="Status"        value={service.status}   />
                  <Row label="Created"       value={createdDate}      />
                </div>
                <div className="sm:pl-5">
                  <Row label="Price"         value={priceLabel}       />
                  <Row label="Duration"      value={service.estimatedTimeMinutes ? `${service.estimatedTimeMinutes} min` : '—'} />
                  <Row label="Chargeable"    value={service.chargeable ? 'Yes' : 'No'} />
                  <Row label="Last Updated"  value={updatedDate}      />
                </div>
              </div>
            </InfoCard>

            {/* Available Offices */}
            <InfoCard title="Available Offices" icon={Building2} accent="emerald">
              {availableOffices.length === 0 ? (
                <p className="text-[12px] text-[var(--app-text-subtle)]">
                  {(service.availableOfficeIds || []).length === 0 ? 'Available at all offices.' : 'No offices found.'}
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {availableOffices.map((o) => (
                    <div key={o.id}
                      className="flex items-center gap-3 rounded-[10px] border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-2.5">
                      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                        <Building2 size={13} aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px] font-bold text-[var(--app-text)]">{o.name}</div>
                        <div className="font-mono text-[10px] text-[var(--app-text-subtle)]">{o.code}</div>
                      </div>
                      {o.address?.city && (
                        <div className="flex items-center gap-1 text-[10px] text-[var(--app-text-subtle)] shrink-0">
                          <MapPin size={9} aria-hidden="true" />
                          {o.address.city}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </InfoCard>

            {/* Assigned Staff */}
            <InfoCard title="Assigned Staff" icon={Users} accent="violet">
              {assignedStaff.length === 0 ? (
                <p className="text-[12px] text-[var(--app-text-subtle)]">No staff assigned to this service.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {assignedStaff.map((s) => (
                    <div key={s.id}
                      className="flex items-center gap-3 rounded-[10px] border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-2.5">
                      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-violet-500/20 bg-violet-500/10 text-[13px]">
                        {(s.fullName || s.name || '?').charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px] font-bold text-[var(--app-text)]">{s.fullName || s.name}</div>
                        {s.emailId && <div className="text-[10px] text-[var(--app-text-subtle)]">{s.emailId}</div>}
                      </div>
                      {s.role && (
                        <span className="text-[10px] font-semibold text-[var(--app-text-subtle)] shrink-0">{s.role}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </InfoCard>
          </div>

          {/* Right — 1/3 */}
          <div className="flex flex-col gap-4">

            {/* Quick Stats */}
            <InfoCard title="Quick Stats" icon={Star}>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Offices',  value: availableOffices.length || 'All', icon: Building2,   color: 'emerald' },
                  { label: 'Staff',    value: assignedStaff.length || 0,         icon: UserRound,   color: 'violet'  },
                  { label: 'Duration', value: service.estimatedTimeMinutes ? `${service.estimatedTimeMinutes}m` : '—', icon: Clock, color: 'amber' },
                  { label: 'Price',    value: service.chargeable ? `₹${service.price}` : 'Free',   icon: BadgeIndianRupee, color: 'sky' },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div key={label}
                    className={`flex flex-col items-center justify-center gap-1 rounded-[10px] border border-${color}-500/20 bg-${color}-500/10 p-3`}>
                    <Icon size={16} className={`text-${color}-400`} aria-hidden="true" />
                    <div className={`text-[15px] font-extrabold text-${color}-400`}>{String(value)}</div>
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--app-text-subtle)]">{label}</div>
                  </div>
                ))}
              </div>
            </InfoCard>

            {/* Pricing */}
            <InfoCard title="Pricing" icon={BadgeIndianRupee} accent="amber">
              <div className="flex flex-col gap-2">
                <div className={`flex items-center justify-center gap-3 rounded-[10px] border p-4 ${
                  service.chargeable
                    ? 'border-amber-500/30 bg-amber-500/10'
                    : 'border-emerald-500/30 bg-emerald-500/10'
                }`}>
                  {service.chargeable ? (
                    <>
                      <BadgeIndianRupee size={20} className="shrink-0 text-amber-400" aria-hidden="true" />
                      <div className="text-center">
                        <div className="text-[18px] font-extrabold text-amber-400">
                          {formatServicePrice(service.price, currency)}
                        </div>
                        <div className="text-[10px] text-[var(--app-text-subtle)] uppercase tracking-wide">
                          per {service.priceUnit || 'flat'}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={20} className="shrink-0 text-emerald-400" aria-hidden="true" />
                      <div className="text-center">
                        <div className="text-[18px] font-extrabold text-emerald-400">Free</div>
                        <div className="text-[10px] text-[var(--app-text-subtle)] uppercase tracking-wide">
                          No charge
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </InfoCard>

            {/* Availability */}
            <InfoCard title="Availability" icon={ShieldCheck} accent="emerald">
              <div className="flex flex-col gap-2">
                <div className={`flex items-center gap-3 rounded-[10px] border p-3 ${
                  service.status === 'Active'
                    ? 'border-emerald-500/30 bg-emerald-500/8'
                    : 'border-slate-500/30 bg-slate-500/8'
                }`}>
                  {service.status === 'Active' ? (
                    <CheckCircle2 size={18} className="shrink-0 text-emerald-400" aria-hidden="true" />
                  ) : (
                    <XCircle size={18} className="shrink-0 text-slate-400" aria-hidden="true" />
                  )}
                  <div>
                    <div className="text-[12px] font-bold text-[var(--app-text)]">
                      {service.status === 'Active' ? 'Currently Available' : 'Currently Unavailable'}
                    </div>
                    <div className="text-[11px] text-[var(--app-text-muted)]">
                      {availableOffices.length > 0
                        ? `${availableOffices.length} office${availableOffices.length > 1 ? 's' : ''}`
                        : 'All offices'}
                    </div>
                  </div>
                </div>
              </div>
            </InfoCard>

            {/* Service ID */}
            <div className="rounded-[14px] border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
              <div className="mb-2 flex items-center gap-2">
                <Hash size={12} className="text-[var(--app-text-subtle)]" aria-hidden="true" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--app-text-subtle)]">Service ID</span>
              </div>
              <code className="block break-all font-mono text-[11px] text-[var(--app-text-muted)]">{service.id}</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}