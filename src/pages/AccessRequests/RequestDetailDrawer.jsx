import React, { useEffect, useRef, useState } from 'react';
import {
  X, Building2, User, MapPin, Mail, Phone, Globe2, FileText,
  MessageSquare, Monitor, Smartphone, Loader2, CheckCircle2,
  XCircle, HelpCircle, StickyNote,
} from 'lucide-react';
import { addAuditLog } from '../../utils/auditLogger';
import { parseUserAgent } from '../../utils/requestValidation';
import {
  generateRejectionEmail, generateInfoRequestEmail, previewEmail,
} from '../../utils/emailTemplates';
import { useNotifications } from '../../context/NotificationContext';
import AddOrgDrawer from '../Admin/AddOrgDrawer';

/**
 * RequestDetailDrawer — right-side slide-in shown when a Super Admin
 * clicks a row in the Access Requests inbox. Provides three terminal
 * actions:
 *
 *   • Reject              → opens reason modal, sends rejection email,
 *                            stamps reviewedBy/reviewedAt.
 *   • Request Info        → opens compose modal with question list,
 *                            sets status to "InfoRequested".
 *   • Approve & Create    → opens AddOrgDrawer pre-filled from the
 *                            request, marks the request "Approved" on
 *                            successful org creation.
 *
 * Internal Notes are private to the operator team and stored on the
 * request record itself (no separate collection needed for the mock
 * store).
 *
 * AM/PM is uppercase. All success / error messages end with full stops.
 */

function fmtDateTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '—';
  /* en-GB → 19/04/2026, 14:32:08 — convert 24h to 12h with uppercase AM/PM. */
  const datePart = d.toLocaleDateString('en-GB');
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${datePart}, ${h}:${m} ${ampm}`;
}

const STATUS_LABEL = {
  Pending:        'Pending',
  Approved:       'Approved',
  Rejected:       'Rejected',
  InfoRequested:  'Info Requested',
};

const STATUS_STYLES = {
  Pending:        'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
  Approved:       'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300',
  Rejected:       'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300',
  InfoRequested:  'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300',
};

export default function RequestDetailDrawer({
  request,
  currentUser,
  onClose,
  onUpdate,
  onToast,
}) {
  const closeBtnRef = useRef(null);
  const [showApprove, setShowApprove] = useState(false);
  const [confirm, setConfirm]         = useState(null);   /* 'reject' | 'info' | null */
  const [reasonText, setReasonText]   = useState('');
  const [submitting, setSubmitting]   = useState(false);
  const [noteText, setNoteText]       = useState('');
  const { addNotification }           = useNotifications();

  /* Esc close, body scroll lock, autofocus close button. */
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (confirm) setConfirm(null);
        else if (showApprove) setShowApprove(false);
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
  }, [confirm, showApprove, onClose]);

  if (!request) return null;

  const { browser, os } = parseUserAgent(request?.metadata?.userAgent || '');
  const operatorName = currentUser?.name || 'Super Admin';
  const operatorRole = currentUser?.role || 'superadmin';

  const addNote = () => {
    const text = noteText.trim();
    if (!text) return;
    const note = { text, author: operatorName, timestamp: Date.now() };
    onUpdate?.({ internalNotes: [...(request.internalNotes || []), note] });
    setNoteText('');
    addAuditLog({
      userName:    operatorName,
      role:        operatorRole,
      action:      'NOTE',
      module:      'Access Requests',
      description: `Added internal note on ${request.id}.`,
    });
  };

  const handleReject = async () => {
    const reason = reasonText.trim();
    if (!reason) {
      onToast?.('A rejection reason is required.', 'error');
      return;
    }
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 600));
    onUpdate?.({
      status:          'Rejected',
      reviewedBy:      operatorName,
      reviewedAt:      Date.now(),
      rejectionReason: reason,
    });
    previewEmail(generateRejectionEmail(request, reason));
    addAuditLog({
      userName:    operatorName,
      role:        operatorRole,
      action:      'REJECT',
      module:      'Access Requests',
      description: `Rejected ${request.id} (${request.orgName}) — ${reason.slice(0, 80)}.`,
    });
    setSubmitting(false);
    setConfirm(null);
    setReasonText('');
    onToast?.(`Request ${request.id} rejected and email sent.`);
    onClose?.();
  };

  const handleRequestInfo = async () => {
    const questions = reasonText.trim();
    if (!questions) {
      onToast?.('Please describe what additional information is required.', 'error');
      return;
    }
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 600));
    onUpdate?.({
      status:          'InfoRequested',
      reviewedBy:      operatorName,
      reviewedAt:      Date.now(),
    });
    previewEmail(generateInfoRequestEmail(request, questions));
    addAuditLog({
      userName:    operatorName,
      role:        operatorRole,
      action:      'INFO_REQUEST',
      module:      'Access Requests',
      description: `Requested additional info for ${request.id} (${request.orgName}).`,
    });
    setSubmitting(false);
    setConfirm(null);
    setReasonText('');
    onToast?.(`Information request emailed to ${request.businessEmail}.`);
  };

  const handleApproveSuccess = (createdOrg) => {
    onUpdate?.({
      status:          'Approved',
      reviewedBy:      operatorName,
      reviewedAt:      Date.now(),
      createdOrgId:    createdOrg?.id || null,
    });
    addAuditLog({
      userName:    operatorName,
      role:        operatorRole,
      action:      'APPROVE',
      module:      'Access Requests',
      description: `Approved ${request.id} → created organisation ${createdOrg?.name || ''}.`,
    });
    addNotification?.({
      type:    'check-in',
      title:   'New organisation activated',
      message: `${createdOrg?.name || request.orgName} has been onboarded.`,
      roles:   ['superadmin'],
    });
    onToast?.(`${createdOrg?.name || request.orgName} created successfully.`);
    setShowApprove(false);
    onClose?.();
  };

  const isTerminal = request.status === 'Approved' || request.status === 'Rejected';

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="req-drawer-title"
        onMouseDown={(e) => { if (e.target === e.currentTarget && !submitting) onClose?.(); }}
        className="fixed inset-0 z-[9000] flex justify-end bg-black/45"
      >
        <aside
          className="flex h-full w-full max-w-[640px] flex-col bg-white shadow-2xl dark:bg-[#0A1828] sm:w-[640px]"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-gradient-to-r from-sky-700 to-sky-800 px-5 py-4 text-white dark:border-[#142535]">
            <div className="min-w-0">
              <h2 id="req-drawer-title" className="font-[Outfit,sans-serif] text-[16px] font-extrabold leading-tight">
                Request {request.id}
              </h2>
              <div className="mt-1 flex items-center gap-2">
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLES[request.status]}`}>
                  {STATUS_LABEL[request.status]}
                </span>
                <span className="text-[11px] opacity-80">
                  Submitted {fmtDateTime(request.submittedAt)}
                </span>
              </div>
            </div>
            <button
              ref={closeBtnRef}
              type="button"
              onClick={onClose}
              aria-label="Close drawer"
              title="Close"
              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md bg-white/15 text-white transition hover:bg-white/25"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>

          {/* Body */}
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            <Section title="Organisation Details" Icon={Building2}>
              <Pair label="Organisation Name" value={request.orgName} />
              <Pair label="Country" value={request.country} />
              <Pair label="Industry" value={request.industry || '—'} />
              <Pair label="Company Size" value={request.companySize} />
              <Pair label="GST / Trade License" value={request.gstOrLicense || '—'} mono />
              <Pair label="Lead Source" value={request.leadSource || '—'} />
            </Section>

            <Section title="Contact Person" Icon={User}>
              <Pair label="Full Name" value={request.ownerName} />
              <Pair label="Designation" value={request.designation} />
              <Pair label="City" value={request.city || '—'} />
              <Pair
                label="Email ID"
                value={request.businessEmail}
                Icon={Mail}
                action={<a href={`mailto:${request.businessEmail}`} className="text-[11px] font-bold text-sky-700 hover:underline dark:text-sky-300">Send email</a>}
              />
              <Pair
                label="Contact Number"
                value={`+${request.countryCode || ''} ${request.contactNumber || ''}`}
                Icon={Phone}
              />
            </Section>

            <Section title="Submission Metadata" Icon={Monitor}>
              <Pair label="IP Address" value={request?.metadata?.ipAddress || '—'} mono />
              <Pair label="Browser" value={browser} />
              <Pair label="Operating System" value={os} />
              {isTerminal && (
                <>
                  <Pair label="Reviewed By" value={request.reviewedBy || '—'} />
                  <Pair label="Reviewed At" value={fmtDateTime(request.reviewedAt)} />
                </>
              )}
            </Section>

            {request.message && (
              <Section title="Message from Requester" Icon={MessageSquare}>
                <blockquote className="rounded-[10px] border-l-4 border-sky-400 bg-sky-50 px-4 py-3 text-[13px] italic text-slate-700 dark:bg-sky-500/10 dark:text-slate-200">
                  “{request.message}”
                </blockquote>
              </Section>
            )}

            {request.status === 'Rejected' && request.rejectionReason && (
              <Section title="Rejection Reason" Icon={XCircle}>
                <div className="rounded-[10px] border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                  {request.rejectionReason}
                </div>
              </Section>
            )}

            <Section title="Internal Notes (private)" Icon={StickyNote}>
              <ul className="mb-3 space-y-2">
                {(request.internalNotes || []).length === 0 && (
                  <li className="rounded-[8px] border border-dashed border-slate-200 px-3 py-2 text-[12px] italic text-slate-400 dark:border-[#142535]">
                    No internal notes yet.
                  </li>
                )}
                {(request.internalNotes || []).map((n, idx) => (
                  <li
                    key={idx}
                    className="rounded-[8px] border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-600 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-300"
                  >
                    <p className="m-0 leading-snug">{n.text}</p>
                    <p className="mt-1 text-[10px] font-semibold text-slate-400">
                      — {n.author} · {fmtDateTime(n.timestamp)}.
                    </p>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Add a private note (visible to platform admins only)"
                  rows={2}
                  className="flex-1 rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-200"
                />
                <button
                  type="button"
                  onClick={addNote}
                  disabled={!noteText.trim()}
                  className="inline-flex shrink-0 cursor-pointer items-center justify-center rounded-[10px] border border-sky-700 bg-sky-700 px-3 py-2 text-[12px] font-bold text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-50"
                  title="Save internal note"
                >
                  Save Note
                </button>
              </div>
            </Section>
          </div>

          {/* Footer actions */}
          {!isTerminal ? (
            <div className="flex flex-wrap gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-[#142535] dark:bg-[#071220]">
              <button
                type="button"
                onClick={() => { setConfirm('reject'); setReasonText(''); }}
                disabled={submitting}
                className="inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-red-200 bg-red-50 px-4 py-2.5 text-[13px] font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
              >
                <XCircle size={14} aria-hidden="true" /> Reject
              </button>
              <button
                type="button"
                onClick={() => { setConfirm('info'); setReasonText(''); }}
                disabled={submitting}
                className="inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-blue-200 bg-blue-50 px-4 py-2.5 text-[13px] font-bold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300"
              >
                <HelpCircle size={14} aria-hidden="true" /> Request Info
              </button>
              <button
                type="button"
                onClick={() => setShowApprove(true)}
                disabled={submitting}
                className="inline-flex flex-[1.4] cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-sky-700 bg-gradient-to-r from-sky-600 to-sky-800 px-4 py-2.5 text-[13px] font-bold text-white shadow-sm transition hover:from-sky-700 hover:to-sky-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CheckCircle2 size={14} aria-hidden="true" /> Approve &amp; Create Account
              </button>
            </div>
          ) : (
            <div className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-[12px] text-slate-500 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-400">
              This request was {STATUS_LABEL[request.status].toLowerCase()} by {request.reviewedBy || '—'} on {fmtDateTime(request.reviewedAt)}.
            </div>
          )}
        </aside>
      </div>

      {/* Reject / Info modal */}
      {confirm && (
        <div
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => { if (e.target === e.currentTarget && !submitting) setConfirm(null); }}
          className="fixed inset-0 z-[9500] flex items-center justify-center bg-black/55 p-4"
        >
          <div className="w-full max-w-md rounded-[14px] border border-slate-200 bg-white p-6 shadow-2xl dark:border-[#142535] dark:bg-[#0A1828]">
            <h3 className="m-0 font-[Outfit,sans-serif] text-[16px] font-extrabold text-[#0C2340] dark:text-slate-100">
              {confirm === 'reject' ? 'Reject access request' : 'Request additional information'}
            </h3>
            <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">
              {confirm === 'reject'
                ? 'Provide a clear reason — it will be included in the rejection email to the requester.'
                : 'List the questions or documents you need from the requester.'}
            </p>
            <label className="mt-4 mb-1.5 block text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400">
              {confirm === 'reject' ? 'Rejection Reason' : 'Information Needed'}
              <span aria-hidden="true" className="text-red-500">*</span>
            </label>
            <textarea
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              rows={5}
              autoFocus
              placeholder={confirm === 'reject'
                ? 'Enter rejection reason (will be sent to the requester)'
                : 'Enter what additional information you need (one per line is fine)'}
              className="w-full rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-200"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirm(null)}
                disabled={submitting}
                className="cursor-pointer rounded-[10px] border border-slate-200 bg-white px-4 py-2 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirm === 'reject' ? handleReject : handleRequestInfo}
                disabled={submitting || !reasonText.trim()}
                className={`inline-flex cursor-pointer items-center gap-2 rounded-[10px] border px-4 py-2 text-[13px] font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${confirm === 'reject'
                  ? 'border-red-600 bg-red-600 hover:bg-red-700'
                  : 'border-blue-600 bg-blue-600 hover:bg-blue-700'}`}
              >
                {submitting && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
                {confirm === 'reject' ? 'Confirm Reject' : 'Send Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approve & Create Account → AddOrgDrawer with prefill */}
      {showApprove && (
        <AddOrgDrawer
          open
          prefillFromRequest={request}
          currentUser={currentUser}
          onClose={() => setShowApprove(false)}
          onCreated={handleApproveSuccess}
        />
      )}
    </>
  );
}

/* ── Layout helpers ───────────────────────────────────────────────── */
function Section({ title, Icon, children }) {
  return (
    <section className="mb-5">
      <h3 className="mb-3 inline-flex items-center gap-2 font-[Outfit,sans-serif] text-[12px] font-extrabold uppercase tracking-[0.08em] text-sky-700 dark:text-sky-300">
        {Icon && <Icon size={14} aria-hidden="true" />}
        {title}
      </h3>
      <div className="rounded-[12px] border border-slate-200 bg-white px-4 py-3 dark:border-[#142535] dark:bg-[#071220]">
        {children}
      </div>
    </section>
  );
}

function Pair({ label, value, mono = false, Icon, action }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 py-2 last:border-b-0 dark:border-[#142535]">
      <div className="flex min-w-0 items-center gap-2 text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400">
        {Icon && <Icon size={12} aria-hidden="true" />}
        {label}
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <div className={`text-right text-[13px] ${mono ? 'font-mono' : 'font-semibold'} text-[#0C2340] dark:text-slate-100`}>
          {value}
        </div>
        {action}
      </div>
    </div>
  );
}
