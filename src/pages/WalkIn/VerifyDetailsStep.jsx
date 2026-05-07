import React, { useMemo } from 'react';
import {
  UserRound, Phone, Mail, Building2, AlertTriangle,
} from 'lucide-react';
import { Field, SearchableSelect } from '../../components/ui';
import {
  VISITOR_TYPES, to12hAmPm, getTimezoneAbbr,
} from '../../utils/appointmentState';
import { VISITOR_TYPE_META } from '../Appointments/AddAppointmentDrawer';

const NAME_RE = /^[A-Za-z .'-]+$/;
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

const isBlank = (v) => v == null || String(v).trim().length === 0;


export function validateStep1(form) {
  const e = {};
  const v = form.visitor || {};

  if (isBlank(v.fullName)) e['visitor.fullName'] = 'Visitor Name is required.';
  else if (v.fullName.trim().length < 2 || v.fullName.length > 100) e['visitor.fullName'] = 'Visitor Name must be 2 to 100 characters.';
  else if (!NAME_RE.test(v.fullName.trim())) e['visitor.fullName'] = 'Visitor Name accepts letters, spaces and .\'- only.';

  if (isBlank(v.contactNumber)) e['visitor.contactNumber'] = 'Contact Number is required.';
  else {
    const digits = v.contactNumber.replace(/[^0-9]/g, '');
    if (!/^\+?[\d\s-]+$/.test(v.contactNumber)) e['visitor.contactNumber'] = 'Contact Number accepts digits, spaces and hyphens only.';
    else if (digits.length !== 10) e['visitor.contactNumber'] = 'Contact Number must be exactly 10 digits.';
  }

  if (isBlank(v.emailId)) e['visitor.emailId'] = 'Email ID is required.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.emailId.trim())) e['visitor.emailId'] = 'Please enter a valid Email ID.';

  if (!VISITOR_TYPES.includes(v.visitorType)) e['visitor.visitorType'] = 'Visitor Type is required.';

  if (v.visitorType !== 'Delivery') {
    if (isBlank(form.hostUserId)) e.hostUserId = 'Host is required.';
    const acc = Number(v.accompanyingCount);
    if (!Number.isFinite(acc) || acc < 0 || acc > 10) e['visitor.accompanyingCount'] = 'Accompanying Count must be 0 to 10.';
  }

  const p = (form.purpose || '').trim();
  if (isBlank(form.purpose)) e.purpose = 'Purpose of Visit is required.';
  else if (p.length < 10) e.purpose = 'Purpose of Visit must be at least 10 characters.';
  else if (p.length > 500) e.purpose = 'Purpose of Visit must be 500 characters or fewer.';

  return e;
}

export default function VerifyDetailsStep({
  form, errors, setField, onRequestTypeChange,
  orgStaff, orgRooms, office, roomConflict,
  userOffices,
}) {
  const visitorType = form.visitor?.visitorType || 'Regular';
  const isDelivery  = visitorType === 'Delivery';
  const tzAbbr      = getTimezoneAbbr(office?.operations?.timezone);

  const hostOptions = useMemo(
    () => (orgStaff || [])
      .filter((s) => s?.status !== 'Inactive' && (!office || s?.officeId === office?.id || !s?.officeId))
      .sort((a, b) => (a.fullName || a.name || '').localeCompare(b.fullName || b.name || '')),
    [orgStaff, office],
  );

  const roomOptions = useMemo(
    () => (orgRooms || []).filter((r) =>
      r?.officeId === office?.id
      && String(r.status || 'Active') === 'Active'
      && r.bookableByVisitors !== false,
    ),
    [orgRooms, office],
  );

  const purposeLen = (form.purpose || '').length;

  return (
    <>
      {Array.isArray(userOffices) && userOffices.length > 0 && (
        <div data-field="officeId" className="mb-4">
          <Field label="Office" required error={errors['officeId']}>
            <SearchableSelect
              value={form.officeId || ''}
              onChange={(v) => setField('officeId', v)}
              options={userOffices.map((o) => ({ value: o.id, label: `${o.name}${o.code ? ` (${o.code})` : ''}` }))}
              placeholder="Select Office"
            />
          </Field>
        </div>
      )}

      <div data-field="visitor.visitorType" className="mb-4">
        <Field label="Visitor Type" required error={errors['visitor.visitorType']}>
          <div role="radiogroup" aria-label="Visitor Type" className="flex flex-wrap gap-2">
            {VISITOR_TYPES.map((t) => {
              const active = visitorType === t;
              const meta = VISITOR_TYPE_META[t];
              return (
                <button
                  key={t} type="button" role="radio" aria-checked={active}
                  onClick={() => onRequestTypeChange(t)}
                  className={`cursor-pointer rounded-[10px] border px-3 py-2 text-[12px] font-bold transition inline-flex items-center gap-1.5 ${active
                    ? (meta.tone === 'amber'  ? 'border-amber-700 bg-amber-600 text-white'
                      : meta.tone === 'blue'  ? 'border-blue-700 bg-blue-600 text-white'
                      : meta.tone === 'teal'  ? 'border-teal-700 bg-teal-600 text-white'
                      : 'border-sky-700 bg-sky-700 text-white')
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-300'}`}
                >
                  <span aria-hidden="true">{meta.icon}</span>
                  {t}
                </button>
              );
            })}
          </div>
        </Field>
      </div>

      <SectionHeader Icon={UserRound} title="Visitor" />
      <div className={twoColCls()}>
        <div data-field="visitor.fullName">
          <Field label="Visitor Name" required error={errors['visitor.fullName']}>
            <input type="text" value={form.visitor.fullName}
              onChange={(e) => setField('visitor.fullName', e.target.value)}
              placeholder="Enter Visitor Name" maxLength={100}
              className={inputCls(errors['visitor.fullName'])} />
          </Field>
        </div>
        <div data-field="visitor.contactNumber">
          <Field label="Contact Number" required error={errors['visitor.contactNumber']}>
            <div className="relative">
              <Phone size={13} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="tel" value={form.visitor.contactNumber}
                onChange={(e) => setField('visitor.contactNumber', e.target.value.replace(/[^0-9+\s-]/g, ''))}
                placeholder="Enter Contact Number" maxLength={20}
                className={`${inputCls(errors['visitor.contactNumber'])} pl-8`} />
            </div>
          </Field>
        </div>
      </div>
      <div className={twoColCls()}>
        <div data-field="visitor.emailId">
          <Field label="Email ID" error={errors['visitor.emailId']}>
            <div className="relative">
              <Mail size={13} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="email" value={form.visitor.emailId}
                onChange={(e) => setField('visitor.emailId', e.target.value)}
                placeholder="Enter Email ID" maxLength={100}
                className={`${inputCls(errors['visitor.emailId'])} pl-8`} />
            </div>
          </Field>
        </div>
        <div data-field="visitor.companyName">
          <Field label="Company Name">
            <input type="text" value={form.visitor.companyName}
              onChange={(e) => setField('visitor.companyName', e.target.value)}
              placeholder="Enter Company Name" maxLength={100}
              className={inputCls()} />
          </Field>
        </div>
      </div>
      {!isDelivery && (
        <div data-field="visitor.accompanyingCount">
          <Field label="Accompanying Visitors" hint="0 to 10 additional guests." error={errors['visitor.accompanyingCount']}>
            <input type="number" min={0} max={10} step={1}
              value={form.visitor.accompanyingCount}
              onChange={(e) => setField('visitor.accompanyingCount', e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="Enter count"
              className={inputCls(errors['visitor.accompanyingCount'])} />
          </Field>
     
        </div>
      )}

      <SectionHeader Icon={Building2} title="Meeting" />
      {!isDelivery && (
        <div data-field="hostUserId">
          <Field label={isDelivery ? 'Received By' : 'Host'} required={!isDelivery} error={errors.hostUserId}
                hint={tzAbbr ? `Times displayed in ${tzAbbr}.` : undefined}>
            <SearchableSelect value={form.hostUserId}
              onChange={(v) => setField('hostUserId', v)}
              options={hostOptions.map((s) => ({ value: s.id, label: `${s.fullName || s.name} — ${s.role}` }))}
              placeholder="Select Host"
              searchPlaceholder="Search staff…"
              error={Boolean(errors.hostUserId)} />
          </Field>
        </div>
      )}

      <div data-field="purpose">
        <Field label="Purpose of Visit" required error={errors.purpose}
              hint={`${purposeLen.toLocaleString('en-GB')} / 500 characters. Minimum 10.`}>
          <textarea value={form.purpose}
            onChange={(e) => setField('purpose', e.target.value.slice(0, 500))}
            placeholder="Enter Purpose of Visit" rows={2} maxLength={500}
            className={`${inputCls(errors.purpose)} resize-none`} />
        </Field>
      </div>

      {!isDelivery && (
        <div data-field="roomId">
          <Field label="Room" hint="Optional. Room assignment can be changed after check-in.">
            <SearchableSelect value={form.roomId || ''}
              onChange={(v) => setField('roomId', v)}
              options={[{ value: '', label: '— No room —' },
                ...roomOptions.map((r) => ({ value: r.id, label: `${r.name} · seats ${r.seatingCapacity}` }))]}
              placeholder={office ? 'Select Room' : 'No office context'}
              searchPlaceholder="Search room…"
              disabled={!office} />
          </Field>
          {roomConflict && (
            <div className="mt-1 rounded-[10px] border border-amber-300 bg-amber-50 px-3 py-2 dark:border-amber-500/30 dark:bg-amber-500/10">
              <div className="flex items-start gap-2 text-[12px] text-amber-800 dark:text-amber-200">
                <AlertTriangle size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-amber-700 dark:text-amber-300" />
                <div>
                  <strong className="font-bold">{roomConflict.roomName || 'This room'}</strong> is currently occupied by{' '}
                  <strong>{roomConflict.conflictingVisitor || 'another visitor'}</strong>
                  {roomConflict.startTime && roomConflict.endTime
                    ? ` (${to12hAmPm(roomConflict.startTime)} – ${to12hAmPm(roomConflict.endTime)})`
                    : ''}. Room assignment can be changed post-check-in if needed.
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {isDelivery && (
        <p className="rounded-[10px] border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-500 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-400">
          Host and Room are not required for delivery check-ins. Reception can assign a &ldquo;Received By&rdquo; staff member on the appointment detail page post-check-in.
        </p>
      )}
    </>
  );
}

function SectionHeader({ Icon, title }) {
  return (
    <h3 className="mb-3 mt-4 inline-flex items-center gap-2 font-[Outfit,sans-serif] text-[12px] font-extrabold uppercase tracking-[0.08em] text-sky-700 dark:text-sky-300">
      {Icon && <Icon size={14} aria-hidden="true" />}
      {title}
    </h3>
  );
}

function inputCls(hasError) {
  const base = 'w-full rounded-[10px] border bg-white px-3 py-2 text-[13px] text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:bg-[#071220] dark:text-slate-200';
  return hasError
    ? `${base} border-red-400 focus:border-red-500 focus:ring-red-100 dark:border-red-500/40`
    : `${base} border-slate-200 dark:border-[#142535]`;
}

function twoColCls() { return 'grid grid-cols-1 gap-3 sm:grid-cols-2 mb-2'; }