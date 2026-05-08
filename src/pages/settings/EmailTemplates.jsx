import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Mail, Eye, RotateCcw, Save, GripVertical, Plus, X, FilePlus } from 'lucide-react';
import { Toast } from '../../components/ui';
import { apiJson } from '../../api/http';
import {
  EMAIL_TEMPLATE_KEY,
  generateAppointmentInviteEmail,
  generateStaffInviteEmail,
  generateWelcomeEmail,
  generateWalkInArrivalEmail,
} from '../../utils/emailTemplates';
import { useAuth } from '../../context/AuthContext';
import { useBranding } from '../../context/BrandingContext';

const UNSUBSCRIBE_HTML = `<p style="font-size:11px;color:#94A3B8;text-align:center;margin-top:16px;">
  Don't want these emails?
  <a href="{{unsubscribeUrl}}" style="color:#0284C7;">Unsubscribe</a>
</p>`;

let __blockSeq = 0;
const blockId = () => `b${Date.now().toString(36)}${(++__blockSeq).toString(36)}`;

/* Split a saved body into editable blocks. Splits at paragraph / table /
 * heading / div boundaries so authors can reorder coherent chunks. Anything
 * that doesn't yield clean blocks falls back to a single block holding the
 * whole body. */
function bodyToBlocks(body) {
  const src = String(body || '').trim();
  if (!src) return [{ id: blockId(), html: '' }];
  const re = /<\s*(p|table|h1|h2|h3|h4|div|ul|ol)\b[\s\S]*?<\/\s*\1\s*>/gi;
  const matches = src.match(re);
  if (!matches || matches.length === 0) {
    return [{ id: blockId(), html: src }];
  }
  /* Verify the matches reconstitute most of the body — if not, treat as one block. */
  const joined = matches.join('').replace(/\s+/g, '');
  const flat   = src.replace(/\s+/g, '');
  if (joined.length < flat.length * 0.75) {
    return [{ id: blockId(), html: src }];
  }
  return matches.map((html) => ({ id: blockId(), html: html.trim() }));
}

function blocksToBody(blocks) {
  return (blocks || [])
    .map((b) => (b && b.html != null ? String(b.html).trim() : ''))
    .filter(Boolean)
    .join('\n');
}

const STORAGE_KEY        = EMAIL_TEMPLATE_KEY;
const CUSTOM_STORAGE_KEY = 'cgms_custom_email_templates';

/* Tokens that are auto-supported on every custom template — wired up to
 * the live AuthContext / BrandingContext / current-org snapshot in the
 * preview so the author sees real values rather than placeholder text. */
const CUSTOM_DEFAULT_TOKENS = ['{{organizationName}}', '{{recipientName}}', '{{platformName}}', '{{ownerEmail}}', '{{website}}'];

function slugifyKey(name) {
  const base = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
    .slice(0, 40);
  return base ? `custom_${base}` : `custom_${Date.now().toString(36)}`;
}

function escapeHtmlSimple(value) {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fillCustomTokens(text, vars) {
  return String(text || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, name) => {
    if (vars && Object.prototype.hasOwnProperty.call(vars, name) && vars[name] != null && vars[name] !== '') {
      return String(vars[name]);
    }
    /* Leave the placeholder visible in the preview so the author can see
     * which token is unfilled, instead of an empty gap. */
    return `{{${name}}}`;
  });
}

/* Render a custom template's preview. Uses the same visual chrome the
 * built-in shell uses so the author sees a representative envelope.
 * `ctxVars` carries the live AuthContext / BrandingContext / org values
 * so {{organizationName}}, {{recipientName}}, etc. are filled with real
 * data when available — placeholders are kept for any unknown token. */
function renderCustomPreview({ subject, body, ctxVars }) {
  const subjectFilled = fillCustomTokens(subject || '', ctxVars);
  const bodyFilled    = fillCustomTokens(body    || '', ctxVars);
  const platform = escapeHtmlSimple(ctxVars.platformName || 'CorpGMS');
  const orgLine  = escapeHtmlSimple(ctxVars.organizationName || ctxVars.tagline || '');
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${escapeHtmlSimple(subjectFilled)}</title></head>
<body style="margin:0;padding:0;background:#E0F2FE;font-family:'Plus Jakarta Sans',Arial,sans-serif;color:#0C2340;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#E0F2FE;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="background:#FFFFFF;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(14,165,233,0.10);">
        <tr><td style="background:linear-gradient(135deg,#0EA5E9,#0D9488);padding:24px 28px;color:#FFFFFF;">
          <div style="font-family:Outfit,sans-serif;font-weight:800;font-size:18px;letter-spacing:-0.3px;">${platform}</div>
          ${orgLine ? `<div style="font-size:12px;opacity:0.85;margin-top:2px;">${orgLine}</div>` : ''}
        </td></tr>
        <tr><td style="padding:28px;">${bodyFilled}</td></tr>
        <tr><td style="background:#F0F9FF;padding:18px 28px;border-top:1px solid #BAE6FD;font-size:12px;color:#6B7280;">
          <div style="color:#9CA3AF;">© ${platform} — All rights reserved.</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  return { subject: subjectFilled, html, text: bodyFilled.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() };
}

function loadCustomList() {
  try {
    const raw = localStorage.getItem(CUSTOM_STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((c) => c && c.key && c.label) : [];
  } catch { return []; }
}

function saveCustomList(arr) {
  try { localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(arr || [])); } catch { /* ignore */ }
}

/* ────────────────────────────────────────────────────────────────────
 *  Catalogue of editable email types. Each entry knows:
 *   - the storage key the email generator looks up
 *   - the default subject + body that ships with the app
 *   - the available {{tokens}} the editor may insert
 *   - sample data + a renderer that produces a live envelope so the
 *     preview pane shows exactly what the recipient will see
 * ────────────────────────────────────────────────────────────────── */

const TEMPLATES = [
  {
    key: 'appointmentInvite',
    label: 'Appointment Confirmation',
    description: 'Sent to the visitor when an appointment is created.',
    tokens: ['{{visitorName}}', '{{scheduledDate}}', '{{startTime}}', '{{dateTime}}', '{{purpose}}', '{{orgName}}'],
    defaults: {
      subject: 'Appointment confirmed: {{purpose}} on {{scheduledDate}}',
      body: `
    <p style="margin:0 0 12px;font-size:14px;line-height:1.7;color:#374151;">
      Hello <strong style="color:#0C2340;">{{visitorName}}</strong>,
    </p>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:#374151;">
      Your appointment has been confirmed. Here are your details:
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"
           style="width:100%;background:#F0F9FF;border-radius:10px;padding:16px 20px;margin-bottom:20px;">
      <tr>
        <td style="font-size:13px;color:#6B7280;padding:6px 0;width:130px;">Date &amp; Time</td>
        <td style="font-size:14px;color:#0C2340;font-weight:700;padding:6px 0;">{{dateTime}}</td>
      </tr>
      <tr>
        <td style="font-size:13px;color:#6B7280;padding:6px 0;">Purpose</td>
        <td style="font-size:14px;color:#0C2340;font-weight:700;padding:6px 0;">{{purpose}}</td>
      </tr>
      <tr>
        <td style="font-size:13px;color:#6B7280;padding:6px 0;">Organisation</td>
        <td style="font-size:14px;color:#0C2340;font-weight:700;padding:6px 0;">{{orgName}}</td>
      </tr>
    </table>
    <p style="margin:0;font-size:13px;color:#6B7280;">Please carry a valid photo ID and arrive on time.</p>`.trim(),
    },
    render: () =>
      generateAppointmentInviteEmail({
        visitorName: 'Anika Reddy',
        scheduledDate: '2026-05-20',
        startTime: '10:30',
        purpose: 'Quarterly business review',
        orgName: 'Infosys Bengaluru',
        orgCountry: 'India',
        visitorEmail: 'anika.reddy@example.com',
      }),
  },
  {
    key: 'staffInvite',
    label: 'Staff Invitation',
    description: 'Sent to a new team member when Director / Super Admin invites them.',
    tokens: ['{{staffName}}', '{{orgName}}', '{{role}}', '{{designation}}', '{{joiningDate}}', '{{tempPassword}}', '{{emailId}}', '{{loginUrl}}'],
    defaults: {
      subject: 'You have been invited to {{orgName}} on CorpGMS.',
      body: `
    <p style="margin:0 0 12px 0;font-size:14px;line-height:1.7;color:#374151;">Hello {{staffName}},</p>
    <p style="margin:0 0 14px 0;font-size:14px;line-height:1.7;color:#374151;">
      You have been invited to join <strong style="color:#0C2340;">{{orgName}}</strong> on CorpGMS as a <strong>{{role}}</strong>.
      Your account is ready — log in using the credentials below.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background:#E0F2FE;border:1px solid #BAE6FD;border-radius:10px;padding:14px 16px;margin:0 0 18px 0;">
      <tr><td style="font-size:12px;color:#6B7280;padding:2px 0;">Login URL</td>
          <td style="font-size:13px;color:#0C2340;font-weight:700;padding:2px 0;text-align:right;">{{loginUrl}}</td></tr>
      <tr><td style="font-size:12px;color:#6B7280;padding:2px 0;">Email ID</td>
          <td style="font-size:13px;color:#0C2340;font-weight:700;padding:2px 0;text-align:right;">{{emailId}}</td></tr>
      <tr><td style="font-size:12px;color:#6B7280;padding:2px 0;">Temporary Password</td>
          <td style="font-size:13px;color:#0C2340;font-weight:700;font-family:monospace;padding:2px 0;text-align:right;">{{tempPassword}}</td></tr>
      <tr><td style="font-size:12px;color:#6B7280;padding:2px 0;">Role</td>
          <td style="font-size:13px;color:#0C2340;font-weight:700;padding:2px 0;text-align:right;">{{role}}</td></tr>
    </table>
    <p style="margin:0 0 8px 0;font-size:13px;color:#B45309;font-weight:700;">Important: change this password on first login.</p>`.trim(),
    },
    render: () =>
      generateStaffInviteEmail(
        {
          fullName: 'Priya Sharma',
          emailId: 'priya.sharma@example.com',
          role: 'Manager',
          designation: 'Front Office Lead',
          joiningDate: '2026-05-15',
        },
        'Cgms@Temp01',
        { name: 'Infosys Bengaluru', country: 'India' },
      ),
  },
  {
    key: 'welcome',
    label: 'Organisation Welcome',
    description: 'Sent to the org owner when Super Admin creates a new account.',
    tokens: ['{{ownerName}}', '{{orgName}}', '{{ownerEmail}}', '{{tempPassword}}', '{{planLabel}}', '{{loginUrl}}'],
    defaults: {
      subject: 'Welcome to CorpGMS — {{orgName}} account is ready.',
      body: `
    <p style="margin:0 0 12px 0;font-size:14px;line-height:1.7;color:#374151;">Hello {{ownerName}},</p>
    <p style="margin:0 0 16px 0;font-size:14px;line-height:1.7;color:#374151;">
      Your CorpGMS account for <strong style="color:#0C2340;">{{orgName}}</strong> is now active.
      Log in straight away with the credentials below.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background:#E0F2FE;border:1px solid #BAE6FD;border-radius:10px;padding:14px 16px;margin:0 0 18px 0;">
      <tr><td style="font-size:12px;color:#6B7280;padding:2px 0;">Login URL</td>
          <td style="font-size:13px;color:#0C2340;font-weight:700;padding:2px 0;text-align:right;">{{loginUrl}}</td></tr>
      <tr><td style="font-size:12px;color:#6B7280;padding:2px 0;">Email ID</td>
          <td style="font-size:13px;color:#0C2340;font-weight:700;padding:2px 0;text-align:right;">{{ownerEmail}}</td></tr>
      <tr><td style="font-size:12px;color:#6B7280;padding:2px 0;">Temporary Password</td>
          <td style="font-size:13px;color:#0C2340;font-weight:700;font-family:monospace;padding:2px 0;text-align:right;">{{tempPassword}}</td></tr>
      <tr><td style="font-size:12px;color:#6B7280;padding:2px 0;">Plan</td>
          <td style="font-size:13px;color:#0C2340;font-weight:700;padding:2px 0;text-align:right;">{{planLabel}}</td></tr>
    </table>
    <p style="margin:0 0 8px 0;font-size:13px;color:#B45309;font-weight:700;">Important: change your password immediately on first login.</p>`.trim(),
    },
    render: () =>
      generateWelcomeEmail(
        { name: 'Infosys Bengaluru', country: 'India', plan: 'Professional' },
        { fullName: 'Anika Reddy', email: 'anika.reddy@example.com' },
        'Cgms@Temp01',
        'India',
      ),
  },
  {
    key: 'walkInArrival',
    label: 'Walk-in Arrival',
    description: 'Sent to a walk-in visitor when reception captures their email.',
    tokens: ['{{visitorName}}', '{{orgName}}', '{{officeName}}', '{{hostName}}', '{{badgeNumber}}'],
    defaults: {
      subject: 'Welcome to {{orgName}} — your visit is being processed.',
      body: `
    <p style="margin:0 0 12px;font-size:14px;line-height:1.7;color:#374151;">
      Hello <strong style="color:#0C2340;">{{visitorName}}</strong>,
    </p>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:#374151;">
      Thank you for visiting <strong style="color:#0C2340;">{{orgName}}</strong> — {{officeName}}. Your check-in is complete.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"
           style="width:100%;background:#F0F9FF;border-radius:10px;padding:16px 20px;margin-bottom:20px;">
      <tr>
        <td style="font-size:13px;color:#6B7280;padding:6px 0;width:130px;">Badge No.</td>
        <td style="font-size:14px;color:#0C2340;font-weight:700;padding:6px 0;">{{badgeNumber}}</td>
      </tr>
      <tr>
        <td style="font-size:13px;color:#6B7280;padding:6px 0;">Host</td>
        <td style="font-size:14px;color:#0C2340;font-weight:700;padding:6px 0;">{{hostName}}</td>
      </tr>
      <tr>
        <td style="font-size:13px;color:#6B7280;padding:6px 0;">Organisation</td>
        <td style="font-size:14px;color:#0C2340;font-weight:700;padding:6px 0;">{{orgName}}</td>
      </tr>
    </table>
    <p style="margin:0;font-size:13px;color:#6B7280;">Please return your visitor badge at reception when you leave.</p>`.trim(),
    },
    render: () =>
      generateWalkInArrivalEmail({
        visitorName: 'Rohan Verma',
        visitorEmail: 'rohan.verma@example.com',
        orgName: 'Infosys Bengaluru',
        officeName: 'BLR-EC2',
        orgCountry: 'India',
        hostName: 'Priya Sharma',
        badgeNumber: 'B-00427',
      }),
  },
];

function readTemplates(templates) {
  const list = Array.isArray(templates) ? templates : TEMPLATES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const out = {};
    for (const t of list) {
      const stored  = parsed?.[t.key] || {};
      /* Defensive: subject and body must be plain strings. If a malformed
       * payload stored an object/array (e.g. the whole envelope), fall
       * back to the default so the editor never round-trips garbage. */
      const subject = (typeof stored.subject === 'string' && stored.subject)
        ? stored.subject
        : t.defaults.subject;
      const storedBody = typeof stored.body === 'string' ? stored.body.trim() : '';
      const isJsonShaped = storedBody.startsWith('{') || storedBody.startsWith('[');
      const body = (storedBody && !isJsonShaped) ? stored.body : t.defaults.body;
      const blocks  = Array.isArray(stored.blocks) && stored.blocks.length > 0
        ? stored.blocks.map((b) => ({ id: b?.id || blockId(), html: String(b?.html || '') }))
        : bodyToBlocks(body);
      out[t.key] = {
        subject,
        body,
        blocks,
        includeUnsubscribe: Boolean(stored.includeUnsubscribe),
      };
    }
    return out;
  } catch {
    const out = {};
    for (const t of list) {
      out[t.key] = {
        ...t.defaults,
        blocks: bodyToBlocks(t.defaults.body),
        includeUnsubscribe: false,
      };
    }
    return out;
  }
}

export default function EmailTemplates() {
  const { user } = useAuth();
  const branding = useBranding();

  /* Custom templates the user has authored. Stored separately from the
   * built-in TEMPLATES catalogue (cgms_custom_email_templates) because the
   * shape carries metadata (label, description, tokens) we don't want
   * mixed with the per-tenant subject/body overrides. The actual
   * subject/body still flows through the same draft/persisted pipeline
   * keyed by `t.key`, so backend sync and dirty-tracking are unchanged. */
  const [customTemplates, setCustomTemplates] = useState(() => loadCustomList());

  /* Effective list = built-ins + custom. Each custom entry is normalised
   * to the same shape as built-ins (key/label/description/tokens/defaults),
   * with `isCustom: true` so the preview renderer can branch. */
  const allTemplates = useMemo(() => {
    const customMeta = customTemplates.map((c) => ({
      key:         c.key,
      label:       c.label,
      description: c.description || 'Custom template',
      tokens:      Array.isArray(c.tokens) && c.tokens.length ? c.tokens : CUSTOM_DEFAULT_TOKENS,
      defaults:    {
        subject: c.defaultSubject || `${c.label} — {{organizationName}}`,
        body:    c.defaultBody    || '<p>Your custom content here. You can use {{recipientName}}, {{organizationName}}, {{platformName}}.</p>',
      },
      isCustom: true,
    }));
    return [...TEMPLATES, ...customMeta];
  }, [customTemplates]);

  const allTemplatesByKey = useMemo(() => {
    const m = {};
    for (const t of allTemplates) m[t.key] = t;
    return m;
  }, [allTemplates]);

  const [activeKey, setActiveKey] = useState(TEMPLATES[0].key);
  /* Seed draft and persisted from the SAME read so freshly-generated block
   * ids don't make the dirty-check fire on mount. */
  const [draft, setDraft] = useState(() => readTemplates(allTemplates));
  const [persisted, setPersisted] = useState(() => JSON.parse(JSON.stringify(draft)));
  const [toast, setToast] = useState(null);

  /* Seed any custom-template entries that were added since the last read. */
  useEffect(() => {
    setDraft((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const t of allTemplates) {
        if (!next[t.key]) {
          changed = true;
          next[t.key] = {
            ...t.defaults,
            blocks: bodyToBlocks(t.defaults.body),
            includeUnsubscribe: false,
          };
        }
      }
      return changed ? next : prev;
    });
    setPersisted((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const t of allTemplates) {
        if (!next[t.key]) {
          changed = true;
          next[t.key] = {
            ...t.defaults,
            blocks: bodyToBlocks(t.defaults.body),
            includeUnsubscribe: false,
          };
        }
      }
      return changed ? next : prev;
    });
  }, [allTemplates]);

  /* Live values for the preview tokens. Pulled from the AuthContext +
   * BrandingContext so {{organizationName}}, {{recipientName}} etc. show
   * the actual user / org instead of "Acme Corp" / "John Doe". When the
   * editor is opened by an unauthenticated user (e.g. Super Admin demo
   * with no DB user), we fall back to the branding-derived defaults. */
  const ctxVars = useMemo(() => {
    const orgFromUser =
      (user && (user.organizationId || user.organisationId || user.organization)) || null;
    const orgName =
      (orgFromUser && (orgFromUser.name || orgFromUser.legalName)) ||
      user?.orgName ||
      branding?.name ||
      'Your Organisation';
    const recipientName = user?.name || user?.fullName || 'there';
    return {
      organizationName: orgName,
      orgName,
      recipientName,
      visitorName: recipientName,
      ownerName: recipientName,
      staffName: recipientName,
      platformName: branding?.name || 'CorpGMS',
      ownerEmail: user?.email || '',
      website: orgFromUser?.website || '',
      logoUrl:  orgFromUser?.logoUrl || branding?.logoDataUrl || '',
      tagline:  branding?.tagline || '',
    };
  }, [user, branding]);

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(persisted),
    [draft, persisted],
  );

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY) {
        const next = readTemplates(allTemplates);
        setPersisted(next);
        setDraft(next);
      }
      if (e.key === CUSTOM_STORAGE_KEY) {
        setCustomTemplates(loadCustomList());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [allTemplates]);

  /* Pull persisted templates from the backend on mount and merge into
   * localStorage so the editor and the server stay in sync across
   * browsers / devices. Missing endpoint or network errors are silent —
   * the local copy remains the source of truth in that case. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiJson('/email-templates', { method: 'GET' });
        const remote = res?.data?.templates || res?.templates || {};
        if (cancelled || !remote || !Object.keys(remote).length) return;

        const localRaw = localStorage.getItem(STORAGE_KEY);
        const local = localRaw ? JSON.parse(localRaw) : {};
        const merged = { ...local };
        for (const k of Object.keys(remote)) {
          const r = remote[k] || {};
          merged[k] = {
            ...(local[k] || {}),
            subject: r.subject || (local[k]?.subject ?? ''),
            body:    r.body    || (local[k]?.body    ?? ''),
          };
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        const next = readTemplates(allTemplates);
        setPersisted(next);
        setDraft(next);
      } catch {
        /* offline / endpoint missing — keep local copy */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const meta = allTemplatesByKey[activeKey] || allTemplates[0];
  const current = draft[activeKey] || { subject: '', body: '', blocks: [], includeUnsubscribe: false };

  /* If the active key got removed (e.g. user deleted a custom template),
   * fall back to the first built-in. */
  useEffect(() => {
    if (!allTemplatesByKey[activeKey]) {
      setActiveKey(TEMPLATES[0].key);
    }
  }, [allTemplatesByKey, activeKey]);

  /* "+ New Template" modal state. */
  const [showNewModal,  setShowNewModal]  = useState(false);
  const [newName,       setNewName]       = useState('');
  const [newKey,        setNewKey]        = useState('');
  const [newKeyDirty,   setNewKeyDirty]   = useState(false);
  const [newSubject,    setNewSubject]    = useState('');
  const [newError,      setNewError]      = useState('');

  const openNewModal = () => {
    setNewName('');
    setNewKey('');
    setNewKeyDirty(false);
    setNewSubject('');
    setNewError('');
    setShowNewModal(true);
  };

  const handleNewNameChange = (val) => {
    setNewName(val);
    if (!newKeyDirty) setNewKey(slugifyKey(val));
  };

  const handleCreateCustomTemplate = () => {
    setNewError('');
    const label = newName.trim();
    if (!label) return setNewError('Template name is required.');
    const key = (newKey || slugifyKey(label)).trim();
    if (!key) return setNewError('Template key is required.');
    if (allTemplatesByKey[key]) return setNewError('A template with this key already exists.');
    const subject = newSubject.trim() || `${label} — {{organizationName}}`;
    const entry = {
      key,
      label,
      description: 'Custom template',
      tokens: CUSTOM_DEFAULT_TOKENS,
      defaultSubject: subject,
      defaultBody:    `<p>Hello {{recipientName}},</p>\n<p>This is a custom email from <strong>{{organizationName}}</strong>.</p>\n<p>— Sent via {{platformName}}</p>`,
      createdAt: new Date().toISOString(),
    };
    const nextList = [...customTemplates, entry];
    setCustomTemplates(nextList);
    saveCustomList(nextList);
    /* Make sure the draft + persisted maps know about the new key right
     * away so the editor can switch to it without a stale-key flash. */
    const seed = {
      subject: entry.defaultSubject,
      body:    entry.defaultBody,
      blocks:  bodyToBlocks(entry.defaultBody),
      includeUnsubscribe: false,
    };
    setDraft((d) => ({ ...d, [key]: seed }));
    setPersisted((p) => ({ ...p, [key]: JSON.parse(JSON.stringify(seed)) }));
    setActiveKey(key);
    setShowNewModal(false);
    setToast({ type: 'success', msg: `Custom template "${label}" created.` });
  };

  const handleDeleteCustomTemplate = (key) => {
    if (!key || !key.startsWith('custom_')) return;
    const next = customTemplates.filter((c) => c.key !== key);
    setCustomTemplates(next);
    saveCustomList(next);
    setDraft((d) => { const n = { ...d }; delete n[key]; return n; });
    setPersisted((p) => { const n = { ...p }; delete n[key]; return n; });
    if (activeKey === key) setActiveKey(TEMPLATES[0].key);
  };

  /* Drag-state for the block editor. dragSrcRef holds the index of the
   * block being dragged; dragOverIdx triggers a visual indicator on the
   * row currently underneath the cursor. */
  const dragSrcRef = useRef(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  const setField = (path, value) => {
    setDraft((d) => ({
      ...d,
      [activeKey]: { ...d[activeKey], [path]: value },
    }));
  };

  const setBlocks = (mutator) => {
    setDraft((d) => {
      const cur    = d[activeKey] || {};
      const blocks = typeof mutator === 'function'
        ? mutator(Array.isArray(cur.blocks) ? cur.blocks : [])
        : mutator;
      const body = blocksToBody(blocks);
      return { ...d, [activeKey]: { ...cur, blocks, body } };
    });
  };

  const handleBlockChange = (idx, html) => {
    setBlocks((bs) => bs.map((b, i) => (i === idx ? { ...b, html } : b)));
  };

  const handleAddBlock = () => {
    setBlocks((bs) => [...bs, { id: blockId(), html: '<p></p>' }]);
  };

  const handleDeleteBlock = (idx) => {
    setBlocks((bs) => (bs.length <= 1 ? [{ id: blockId(), html: '' }] : bs.filter((_, i) => i !== idx)));
  };

  const handleDragStart = (idx) => (e) => {
    dragSrcRef.current = idx;
    /* Required by Firefox to fire dragend reliably. */
    try { e.dataTransfer.setData('text/plain', String(idx)); } catch { /* ignore */ }
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (idx) => (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIdx !== idx) setDragOverIdx(idx);
  };

  const handleDragLeave = () => {
    setDragOverIdx(null);
  };

  const handleDrop = (idx) => (e) => {
    e.preventDefault();
    const src = dragSrcRef.current;
    dragSrcRef.current = null;
    setDragOverIdx(null);
    if (src == null || src === idx) return;
    setBlocks((bs) => {
      const next = bs.slice();
      const [moved] = next.splice(src, 1);
      next.splice(idx, 0, moved);
      return next;
    });
  };

  const handleDragEnd = () => {
    dragSrcRef.current = null;
    setDragOverIdx(null);
  };

  const handleSave = () => {
    try {
      /* Persist the assembled body so the email generator (which reads
       * `body`) stays in sync with the block editor. When the unsubscribe
       * toggle is on, append the canonical unsubscribe footer so every
       * sent email carries it. */
      const toSave = {};
      for (const k of Object.keys(draft)) {
        const t = draft[k] || {};
        const blocks = Array.isArray(t.blocks) ? t.blocks : [];
        const assembled = blocksToBody(blocks);
        const body = t.includeUnsubscribe
          ? `${assembled}\n${UNSUBSCRIBE_HTML}`
          : assembled;
        toSave[k] = {
          subject: t.subject || '',
          body,
          blocks,
          includeUnsubscribe: Boolean(t.includeUnsubscribe),
        };
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
      setDraft(toSave);
      setPersisted(toSave);
      setToast({ type: 'success', msg: 'Email templates saved.' });

      /* Also push to the backend so the next email dispatched server-side
       * (notification.service.js → email.templates.js → loadDbTemplate)
       * picks up the user's customisations. Failures are logged but
       * don't undo the local save — the editor stays usable offline. */
      apiJson('/email-templates', {
        method: 'PUT',
        body: JSON.stringify({ templates: toSave }),
      }).catch((err) => {
        console.warn('[email-templates] backend sync failed:', err && err.message);
      });
    } catch {
      setToast({ type: 'error', msg: 'Could not save (storage quota or private mode).' });
    }
  };

  const handleResetActive = () => {
    setDraft((d) => ({
      ...d,
      [activeKey]: {
        ...meta.defaults,
        blocks: bodyToBlocks(meta.defaults.body),
        includeUnsubscribe: false,
      },
    }));
  };

  const insertToken = (token) => {
    setBlocks((bs) => {
      if (!bs.length) return [{ id: blockId(), html: token }];
      const last = bs[bs.length - 1];
      const next = bs.slice(0, -1);
      next.push({ ...last, html: `${last.html || ''}${token}` });
      return next;
    });
  };

  /* Build live preview by temporarily writing the draft to localStorage,
   * calling the real generator (which reads the override), then
   * restoring the previously-persisted state. This means the preview is
   * pixel-identical to the email the recipient will receive. The body
   * sent to the generator is assembled from the block editor and, when
   * the unsubscribe toggle is on, suffixed with the unsubscribe footer. */
  const previewEnvelope = useMemo(() => {
    /* Custom templates have no `meta.render()`. Render inline using the
     * live AuthContext / BrandingContext values so the author sees the
     * preview filled with real org / user data instead of placeholders. */
    if (meta && meta.isCustom) {
      const t = draft[activeKey] || {};
      const assembled = blocksToBody(t.blocks || []);
      const withUnsub = t.includeUnsubscribe
        ? `${assembled}\n${UNSUBSCRIBE_HTML}`
        : assembled;
      return renderCustomPreview({
        subject: t.subject || '',
        body:    withUnsub,
        ctxVars,
      });
    }

    let original = null;
    try {
      original = localStorage.getItem(STORAGE_KEY);
      const toWrite = {};
      for (const k of Object.keys(draft)) {
        const t = draft[k] || {};
        const assembled = blocksToBody(t.blocks || []);
        const withUnsub = t.includeUnsubscribe
          ? `${assembled}\n${UNSUBSCRIBE_HTML}`
          : assembled;
        toWrite[k] = { subject: t.subject || '', body: withUnsub };
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toWrite));
    } catch { /* ignore */ }
    let envelope = { subject: '', html: '', text: '' };
    try {
      envelope = (meta && meta.render && meta.render()) || envelope;
      /* For built-in templates, post-process the rendered envelope to
       * substitute the live org / user context tokens that survived the
       * sample-data render — so authors of customised built-ins also see
       * their actual organisation, not "Acme Corp" / "John Doe". */
      if (envelope && envelope.html) {
        envelope = {
          ...envelope,
          subject: fillCustomTokens(envelope.subject, ctxVars),
          html:    fillCustomTokens(envelope.html,    ctxVars),
        };
      }
    } catch (err) {
      envelope = {
        subject: '(preview failed)',
        html: `<pre style="padding:16px;color:#B45309;">${(err && err.message) || err}</pre>`,
      };
    } finally {
      try {
        if (original == null) localStorage.removeItem(STORAGE_KEY);
        else localStorage.setItem(STORAGE_KEY, original);
      } catch { /* ignore */ }
    }
    return envelope;
  }, [draft, meta, activeKey, ctxVars]);

  return (
    <div className="cgms-email-templates cgms-email-templates-page" style={{ padding: 28, background: 'var(--app-bg)', minHeight: '100vh', fontFamily: "'Outfit','Plus Jakarta Sans',sans-serif", color: 'var(--app-text)' }}>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0C2340' }}>Email Templates</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#94A3B8' }}>
            Customise every transactional email the platform sends. Saved templates are picked up automatically by the next email of that type.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={handleResetActive}
            style={btnStyle('#94A3B8', true)}
            title="Reset this template to default"
          >
            <RotateCcw size={13} style={{ marginRight: 6, verticalAlign: '-2px' }} />
            Reset {meta.label}
          </button>
          <button
            onClick={handleSave}
            disabled={!dirty}
            style={btnStyle('#0284C7', false, !dirty)}
            title={dirty ? 'Save all templates' : 'No changes to save'}
          >
            <Save size={13} style={{ marginRight: 6, verticalAlign: '-2px' }} />
            Save All
          </button>
        </div>
      </div>

      {/* Type picker */}
      <div role="tablist" aria-label="Email template type" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18, alignItems: 'center' }}>
        {allTemplates.map((t) => {
          const on = t.key === activeKey;
          return (
            <span key={t.key} style={{ display: 'inline-flex', alignItems: 'center' }}>
              <button
                role="tab"
                aria-selected={on}
                onClick={() => setActiveKey(t.key)}
                style={{
                  padding: '8px 14px',
                  borderRadius: t.isCustom ? '10px 0 0 10px' : 10,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  background: on ? '#0284C7' : 'var(--app-surface,#fff)',
                  color: on ? '#fff' : '#475569',
                  border: `1.5px solid ${on ? '#0284C7' : '#E2E8F0'}`,
                  borderRight: t.isCustom ? 'none' : `1.5px solid ${on ? '#0284C7' : '#E2E8F0'}`,
                  transition: 'all .15s ease',
                }}
              >
                {t.label}{t.isCustom ? ' ★' : ''}
              </button>
              {t.isCustom && (
                <button
                  type="button"
                  onClick={() => handleDeleteCustomTemplate(t.key)}
                  aria-label={`Delete custom template ${t.label}`}
                  title="Delete custom template"
                  style={{
                    padding: '8px 8px',
                    borderRadius: '0 10px 10px 0',
                    fontSize: 12,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    background: on ? '#0284C7' : 'var(--app-surface,#fff)',
                    color: on ? '#fff' : '#B91C1C',
                    border: `1.5px solid ${on ? '#0284C7' : '#E2E8F0'}`,
                    borderLeft: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                >
                  <X size={12} />
                </button>
              )}
            </span>
          );
        })}
        <button
          type="button"
          onClick={openNewModal}
          style={{
            padding: '8px 12px',
            borderRadius: 10,
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
            background: '#F0F9FF',
            color: '#0284C7',
            border: '1.5px dashed #BAE6FD',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
          title="Create a new custom email template"
        >
          <FilePlus size={13} aria-hidden="true" />
          New Template
        </button>
      </div>

      {showNewModal && (
        <NewTemplateModal
          name={newName}
          onNameChange={handleNewNameChange}
          keyValue={newKey}
          onKeyChange={(v) => { setNewKey(slugifyKey(v)); setNewKeyDirty(true); }}
          subject={newSubject}
          onSubjectChange={setNewSubject}
          error={newError}
          onCancel={() => setShowNewModal(false)}
          onCreate={handleCreateCustomTemplate}
        />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 18 }}>
        {/* ── Editor ── */}
        <section style={cardStyle()}>
          <header style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={iconWrap()}>
              <Mail size={16} color="#0284C7" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0C2340' }}>{meta.label}</div>
              <div style={{ fontSize: 12, color: '#94A3B8' }}>{meta.description}</div>
            </div>
          </header>

          <label style={labelStyle()}>Subject</label>
          <input
            type="text"
            value={current.subject}
            onChange={(e) => setField('subject', e.target.value)}
            placeholder={meta.defaults.subject}
            style={inputStyle()}
          />

          <label style={{ ...labelStyle(), marginTop: 14 }}>
            Body blocks (drag the grip handle to reorder — wrapped in branded shell)
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(current.blocks || []).map((block, idx) => {
              const isOver = dragOverIdx === idx;
              return (
                <div
                  key={block.id}
                  onDragOver={handleDragOver(idx)}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop(idx)}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    padding: 8,
                    border: `1.5px ${isOver ? 'dashed' : 'solid'} ${isOver ? '#0284C7' : '#E2E8F0'}`,
                    borderRadius: 10,
                    background: isOver ? '#F0F9FF' : 'var(--card,#fff)',
                    transition: 'border-color .15s ease, background .15s ease',
                  }}
                >
                  <button
                    type="button"
                    aria-label={`Drag block ${idx + 1} to reorder`}
                    title="Drag to reorder"
                    draggable
                    onDragStart={handleDragStart(idx)}
                    onDragEnd={handleDragEnd}
                    style={{
                      cursor: 'grab',
                      border: 'none',
                      background: '#F8FAFC',
                      color: '#94A3B8',
                      borderRadius: 8,
                      padding: '6px 4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <GripVertical size={14} aria-hidden="true" />
                  </button>
                  <textarea
                    value={block.html}
                    onChange={(e) => handleBlockChange(idx, e.target.value)}
                    rows={Math.min(10, Math.max(3, String(block.html || '').split('\n').length + 1))}
                    spellCheck={false}
                    placeholder="<p>Block content…</p>"
                    style={{
                      ...inputStyle(),
                      flex: 1,
                      fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace',
                      fontSize: 12,
                      lineHeight: 1.55,
                      resize: 'vertical',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => handleDeleteBlock(idx)}
                    aria-label={`Delete block ${idx + 1}`}
                    title="Delete block"
                    style={{
                      cursor: 'pointer',
                      border: '1px solid #FECACA',
                      background: '#FEF2F2',
                      color: '#B91C1C',
                      borderRadius: 8,
                      width: 28,
                      height: 28,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <X size={13} aria-hidden="true" />
                  </button>
                </div>
              );
            })}
            <button
              type="button"
              onClick={handleAddBlock}
              style={{
                alignSelf: 'flex-start',
                cursor: 'pointer',
                border: '1.5px dashed #BAE6FD',
                background: '#F0F9FF',
                color: '#0284C7',
                borderRadius: 10,
                padding: '8px 12px',
                fontSize: 12,
                fontWeight: 700,
                fontFamily: 'inherit',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Plus size={13} aria-hidden="true" />
              Add Block
            </button>
          </div>

          <div
            style={{
              marginTop: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '10px 12px',
              border: '1px solid #E2E8F0',
              borderRadius: 10,
              background: 'var(--card,#fff)',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0C2340' }}>
                Include unsubscribe link in footer
              </div>
              <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2, lineHeight: 1.5 }}>
                Appends a small unsubscribe paragraph to every sent email.
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={Boolean(current.includeUnsubscribe)}
              onClick={() => setField('includeUnsubscribe', !current.includeUnsubscribe)}
              style={{
                position: 'relative',
                width: 40,
                height: 22,
                borderRadius: 999,
                border: 'none',
                cursor: 'pointer',
                background: current.includeUnsubscribe ? '#0284C7' : '#CBD5E1',
                transition: 'background .15s ease',
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  top: 2,
                  left: current.includeUnsubscribe ? 20 : 2,
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: '#fff',
                  boxShadow: '0 1px 2px rgba(15,23,42,0.2)',
                  transition: 'left .15s ease',
                }}
              />
            </button>
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.08em' }}>
              Insert token
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {meta.tokens.map((tok) => (
                <button
                  key={tok}
                  type="button"
                  onClick={() => insertToken(tok)}
                  style={tokenBtnStyle()}
                >
                  {tok}
                </button>
              ))}
            </div>
            <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 8, lineHeight: 1.5 }}>
              Tokens are replaced with real values when the email is sent. Body is the inner HTML — the CorpGMS branded header and footer are added automatically.
            </p>
          </div>
        </section>

        {/* ── Preview ── */}
        <section style={cardStyle()}>
          <header style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={iconWrap()}>
              <Eye size={16} color="#0284C7" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0C2340' }}>Live preview</div>
              <div style={{ fontSize: 12, color: '#94A3B8' }}>Rendered with sample data.</div>
            </div>
          </header>

          <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '10px 12px', marginBottom: 10, fontSize: 12, color: '#475569' }}>
            <div><strong style={{ color: '#0C2340' }}>Subject:</strong> {previewEnvelope.subject || '(empty)'}</div>
          </div>

          <iframe
            title="Email preview"
            srcDoc={previewEnvelope.html || ''}
            style={{
              width: '100%',
              height: 560,
              border: '1px solid #E2E8F0',
              borderRadius: 10,
              background: '#fff',
            }}
          />
        </section>
      </div>
    </div>
  );
}

/* ─── Inline style helpers ─── */

function cardStyle() {
  return {
    background: 'var(--card,#fff)',
    border: '1px solid var(--border,#E2E8F0)',
    borderRadius: 14,
    padding: 18,
    boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
  };
}

function inputStyle() {
  return {
    width: '100%',
    border: '1px solid #E2E8F0',
    borderRadius: 10,
    padding: '10px 12px',
    fontSize: 13,
    color: 'var(--text,#0C2340)',
    background: 'var(--card,#fff)',
    outline: 'none',
    fontFamily: 'inherit',
  };
}

function labelStyle() {
  return {
    display: 'block',
    fontSize: 12,
    fontWeight: 700,
    color: '#475569',
    marginBottom: 6,
  };
}

function btnStyle(color, outline = false, disabled = false) {
  return {
    padding: '8px 16px',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit',
    border: `1px solid ${color}`,
    background: outline ? 'var(--app-surface,#fff)' : color,
    color: outline ? color : '#fff',
    opacity: disabled ? 0.5 : 1,
    transition: 'all .15s ease',
  };
}

function iconWrap() {
  return {
    width: 32,
    height: 32,
    borderRadius: 10,
    background: '#E0F2FE',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };
}

function tokenBtnStyle() {
  return {
    padding: '5px 10px',
    borderRadius: 8,
    fontSize: 11,
    fontWeight: 700,
    color: '#0284C7',
    background: '#E0F2FE',
    border: '1px solid #BAE6FD',
    cursor: 'pointer',
    fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace',
  };
}

/* ─── New Custom Template modal ─── */
function NewTemplateModal({
  name, onNameChange,
  keyValue, onKeyChange,
  subject, onSubjectChange,
  error, onCancel, onCreate,
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(15, 23, 42, 0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(440px, 100%)',
          background: '#fff', borderRadius: 14,
          boxShadow: '0 18px 48px rgba(15, 23, 42, 0.25)',
          padding: 22,
          fontFamily: "'Outfit','Plus Jakarta Sans',sans-serif",
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#0C2340' }}>New custom template</h2>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94A3B8' }}>
              Supports <code>{'{{organizationName}}'}</code>, <code>{'{{recipientName}}'}</code>, <code>{'{{platformName}}'}</code> by default.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            style={{
              border: '1px solid #E2E8F0', background: '#fff', cursor: 'pointer',
              borderRadius: 8, width: 30, height: 30, color: '#475569',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={14} />
          </button>
        </div>

        <div style={{ marginTop: 16 }}>
          <label style={labelStyle()}>Template Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="e.g. Quarterly Newsletter"
            autoFocus
            style={inputStyle()}
          />
        </div>

        <div style={{ marginTop: 12 }}>
          <label style={labelStyle()}>Template Key (auto-slugified)</label>
          <input
            type="text"
            value={keyValue}
            onChange={(e) => onKeyChange(e.target.value)}
            placeholder="custom_quarterly_newsletter"
            style={{ ...inputStyle(), fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace' }}
          />
          <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
            Used as the storage key. Must be unique across templates.
          </p>
        </div>

        <div style={{ marginTop: 12 }}>
          <label style={labelStyle()}>Default Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => onSubjectChange(e.target.value)}
            placeholder="Hello {{recipientName}} from {{organizationName}}"
            style={inputStyle()}
          />
        </div>

        {error && (
          <p style={{ fontSize: 12, color: '#DC2626', fontWeight: 600, marginTop: 10 }}>{error}</p>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
          <button onClick={onCancel} style={btnStyle('#94A3B8', true)}>Cancel</button>
          <button onClick={onCreate} style={btnStyle('#0284C7', false)}>
            <Plus size={13} style={{ marginRight: 6, verticalAlign: '-2px' }} />
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
