import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRole } from '../../context/RoleContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { addAuditLog } from '../../utils/auditLogger';
import {
  ACTIONS,
  CRITICAL_MODULE_KEYS,
  DEFAULT_PERMISSIONS,
  MODULES,
  OPERATIONAL_MODULE_KEYS,
  PLATFORM_MODULE_KEYS,
  ROLE_DESCRIPTIONS,
  ROLE_KEYS,
  ROLES,
  SUPER_ADMIN_LOCKED_MODULES,
  PERMISSIONS_STORAGE_KEY,
} from '../../utils/defaultPermissions';

/* ─── Design tokens ─── */
const getTokens = (dark) => ({
  bg:          dark ? '#0A1828' : '#F0F9FF',
  card:        dark ? '#0F2236' : '#ffffff',
  border:      dark ? '#142535' : '#E2E8F0',
  navy:        dark ? '#E2EAF4' : '#0C2340',
  text:        dark ? '#94A3B8' : '#475569',
  muted:       dark ? '#64748B' : '#94A3B8',
  purple:      '#0284C7',
  purpleLight: dark ? '#0C2340' : '#E0F2FE',
  green:       '#059669',
  red:         '#DC2626',
  amber:       '#D97706',
  font:        "'Outfit', 'Plus Jakarta Sans', sans-serif",
});

/* Role colour map — matches login page colours exactly */
const ROLE_COLORS = {
  [ROLE_KEYS.SUPER_ADMIN]:   '#DC2626',
  [ROLE_KEYS.DIRECTOR]:      '#0284C7',
  [ROLE_KEYS.MANAGER]:       '#059669',
  [ROLE_KEYS.RECEPTION]:     '#0891B2',
  [ROLE_KEYS.SERVICE_STAFF]: '#D97706',
};

const ROLE_LABELS = {
  [ROLE_KEYS.SUPER_ADMIN]:   'Super Admin',
  [ROLE_KEYS.DIRECTOR]:      'Director',
  [ROLE_KEYS.MANAGER]:       'Manager',
  [ROLE_KEYS.RECEPTION]:     'Reception',
  [ROLE_KEYS.SERVICE_STAFF]: 'Service Staff',
};

// card and btn are defined inside RolesPermissionsPage with theme awareness

const SUCCESS_MESSAGE = 'Permissions updated successfully.';
const EMPTY_PERMISSION_ERROR = 'At least one permission must be selected.';

const cloneMatrix = (src) => {
  const out = {};
  for (const r of Object.values(ROLE_KEYS)) {
    out[r] = {};
    for (const m of MODULES) {
      const row = src?.[r]?.[m.key] ?? { view: false, create: false, edit: false, delete: false };
      out[r][m.key] = { view: !!row.view, create: !!row.create, edit: !!row.edit, delete: !!row.delete };
    }
  }
  return out;
};

const matricesEqual = (a, b) => {
  for (const r of Object.values(ROLE_KEYS)) {
    for (const m of MODULES) {
      for (const act of ACTIONS) {
        if (Boolean(a?.[r]?.[m.key]?.[act]) !== Boolean(b?.[r]?.[m.key]?.[act])) return false;
      }
    }
  }
  return true;
};

function lockedRowHasAccess(row) {
  if (!row) return false;
  return Boolean(row.view || row.create || row.edit || row.delete);
}

/* ─── Module Visibility Badges ─── */
/* Shows which roles can VIEW a module as coloured pill badges */
function VisibilityBadges({ moduleKey, draft }) {
  const { theme } = useTheme();
  const T = getTokens(theme === 'dark');
  const rolesWithView = Object.values(ROLE_KEYS).filter(
    (rk) => Boolean(draft?.[rk]?.[moduleKey]?.view)
  );
  if (rolesWithView.length === 0) {
    return (
      <span style={{ fontSize: 10, color: T.muted, fontStyle: 'italic', fontWeight: 600 }}>
        No role has access
      </span>
    );
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5 }}>
      {rolesWithView.map((rk) => (
        <span
          key={rk}
          title={`${ROLE_LABELS[rk]} can view this module`}
          style={{
            fontSize: 9,
            fontWeight: 800,
            padding: '2px 7px',
            borderRadius: 20,
            background: `${ROLE_COLORS[rk]}18`,
            color: ROLE_COLORS[rk],
            border: `1px solid ${ROLE_COLORS[rk]}35`,
            letterSpacing: '0.02em',
            whiteSpace: 'nowrap',
          }}
        >
          {ROLE_LABELS[rk]}
        </span>
      ))}
    </div>
  );
}

function LockedRowSummary({ row, hasAccess }) {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const T = getTokens(dark);
  const grants = ACTIONS.filter((a) => row?.[a]);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '3px 9px', borderRadius: 999,
        background: hasAccess ? `${T.purple}15` : (dark ? '#0C1E2E' : '#F1F5F9'),
        color: hasAccess ? T.purple : T.muted,
        fontSize: 11, fontWeight: 800,
        border: `1px solid ${hasAccess ? `${T.purple}30` : T.border}`,
      }}>
        🔒 Locked — platform-enforced
      </span>
      {hasAccess ? (
        <span style={{ fontSize: 12, color: T.text, fontWeight: 600, textTransform: 'capitalize' }}>
          {grants.join(' · ')}
        </span>
      ) : (
        <span style={{ fontSize: 12, color: T.muted, fontStyle: 'italic' }}>
          No access (operational module)
        </span>
      )}
    </div>
  );
}

function Checkbox({ checked, onChange, disabled, tooltip, ariaLabel }) {
  const T = { purple: '#0284C7' };
  return (
    <label title={disabled ? tooltip : undefined} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: disabled ? 'not-allowed' : 'pointer' }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => !disabled && onChange(e.target.checked)}
        disabled={disabled}
        aria-label={ariaLabel}
        style={{ width: 18, height: 18, accentColor: T.purple, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.55 : 1 }}
      />
    </label>
  );
}

function ConfirmModal({ open, title, message, confirmLabel, onConfirm, onCancel }) {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const T = getTokens(dark);
  const card = (extra = {}) => ({ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, boxShadow: '0 1px 2px rgba(15,23,42,0.04)', padding: 20, ...extra });
  const btn = (color = T.purple, outline = false, disabled = false) => ({ padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: T.font, border: `1px solid ${color}`, background: outline ? T.card : color, color: outline ? color : '#fff', opacity: disabled ? 0.5 : 1, transition: 'all .15s ease' });
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="rp-confirm-title" style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.45)', padding: 20 }}>
      <div style={{ ...card({ padding: 24, maxWidth: 420, width: '100%' }) }}>
        <div id="rp-confirm-title" style={{ fontSize: 17, fontWeight: 800, color: T.navy, marginBottom: 6 }}>{title}</div>
        <div style={{ fontSize: 13, color: T.text, lineHeight: 1.55, marginBottom: 18, whiteSpace: 'pre-line' }}>{message}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" onClick={onCancel} style={btn(T.text, true)}>Cancel</button>
          <button type="button" onClick={onConfirm} style={btn(T.red)}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

function Toast({ toast }) {
  const { theme } = useTheme();
  const T = getTokens(theme === 'dark');
  if (!toast) return null;
  const palette = toast.kind === 'error' ? T.red : toast.kind === 'info' ? T.purple : T.green;
  return (
    <div role="status" aria-live="polite" style={{ position: 'fixed', top: 80, right: 24, zIndex: 9999, padding: '10px 16px', borderRadius: 10, background: palette, color: '#fff', fontSize: 13, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', maxWidth: 360 }}>
      {toast.msg}
    </div>
  );
}

/* ═══════════════════════════════════════════════════ */
export function RolesPermissionsPage() {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const T = getTokens(dark);
  const card = (extra = {}) => ({
    background: T.card, border: `1px solid ${T.border}`, borderRadius: 14,
    boxShadow: '0 1px 2px rgba(15,23,42,0.04)', padding: 22, ...extra,
  });
  const btn = (color = T.purple, outline = false, disabled = false) => ({
    padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: T.font,
    border: `1px solid ${color}`,
    background: outline ? T.card : color, color: outline ? color : '#fff',
    opacity: disabled ? 0.5 : 1, transition: 'all .15s ease',
  });

  const { permissions, updatePermissions, resetPermissions, currentRole } = useRole();
  const { user: authUser } = useAuth();

  const [draft, setDraft] = useState(() => cloneMatrix(permissions));
  const [activeRole, setActiveRole] = useState(ROLES[0].key);
  const [toast, setToast] = useState(null);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [validationError, setValidationError] = useState(null);
  const [moduleSearch, setModuleSearch] = useState('');
  const [pendingBulk, setPendingBulk] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [resetScope, setResetScope] = useState('role');

  useEffect(() => { setDraft(cloneMatrix(permissions)); }, [permissions]);

  const showToast = useCallback((msg, kind = 'success') => {
    setToast({ msg, kind });
    window.setTimeout(() => setToast(null), 2200);
  }, []);

  const isSuperAdminRow = activeRole === ROLE_KEYS.SUPER_ADMIN;
  const isDirty = useMemo(() => !matricesEqual(draft, permissions), [draft, permissions]);

  const toggleCell = (roleKey, moduleKey, action, value) => {
    if (roleKey === ROLE_KEYS.SUPER_ADMIN) return;
    setValidationError(null);
    let cascaded = false;
    setDraft((prev) => {
      const before = prev[roleKey][moduleKey];
      const nextRow = { ...before, [action]: value };
      if (action === 'view' && !value) {
        if (before.create || before.edit || before.delete) cascaded = true;
        nextRow.create = false; nextRow.edit = false; nextRow.delete = false;
      }
      if (action !== 'view' && value && !before.view) { cascaded = true; nextRow.view = true; }
      return { ...prev, [roleKey]: { ...prev[roleKey], [moduleKey]: nextRow } };
    });
    if (cascaded) window.setTimeout(() => showToast('Related permissions updated.', 'info'), 0);
  };

  const moduleIndex = useMemo(() => { const m = new Map(); for (const mod of MODULES) m.set(mod.key, mod); return m; }, []);

  const moduleGroups = useMemo(() => ([
    { id: 'platform', title: 'Platform Modules', subtitle: 'SaaS-owner surface — billing, tenants, audit, RBAC.', icon: '🛡️', modules: PLATFORM_MODULE_KEYS.map((k) => moduleIndex.get(k)).filter(Boolean) },
    { id: 'operational', title: 'Operational Modules', subtitle: 'Day-to-day visitor work — Director, Manager, Reception, Service Staff.', icon: '⚙️', modules: OPERATIONAL_MODULE_KEYS.map((k) => moduleIndex.get(k)).filter(Boolean) },
  ]), [moduleIndex]);

  const isCriticalModule = (key) => CRITICAL_MODULE_KEYS.includes(key);

  const applyBulkToActiveRole = (moduleKeys, mutate) => {
    if (isSuperAdminRow) return;
    setValidationError(null);
    setDraft((prev) => {
      const roleMatrix = { ...prev[activeRole] };
      for (const key of moduleKeys) {
        const before = roleMatrix[key] || { view: false, create: false, edit: false, delete: false };
        const candidate = mutate(before, key);
        if (!candidate) continue;
        const next = { ...before, ...candidate };
        if (next.view === false) { next.create = false; next.edit = false; next.delete = false; }
        if ((next.create || next.edit || next.delete) && !next.view) next.view = true;
        roleMatrix[key] = next;
      }
      return { ...prev, [activeRole]: roleMatrix };
    });
  };

  const visibleGroups = useMemo(() => {
    const q = moduleSearch.trim().toLowerCase();
    if (!q) return moduleGroups;
    return moduleGroups.map((g) => ({ ...g, modules: g.modules.filter((m) => m.label.toLowerCase().includes(q) || m.key.toLowerCase().includes(q)) })).filter((g) => g.modules.length > 0);
  }, [moduleGroups, moduleSearch]);

  const visibleModuleKeys = useMemo(() => { const out = []; for (const g of visibleGroups) for (const m of g.modules) out.push(m.key); return out; }, [visibleGroups]);

  const columnTargetValue = (action) => {
    const row = draft[activeRole] || {};
    const allOn = visibleModuleKeys.length > 0 && visibleModuleKeys.every((k) => Boolean(row[k]?.[action]));
    return !allOn;
  };

  const handleColumnBulk = (action) => {
    if (isSuperAdminRow || visibleModuleKeys.length === 0) return;
    const value = columnTargetValue(action);
    const willClearViewOnCritical = action === 'view' && value === false && visibleModuleKeys.some((k) => isCriticalModule(k) && draft[activeRole]?.[k]?.view);
    if (willClearViewOnCritical) {
      setPendingBulk({ kind: 'column', payload: { action, value }, criticalModules: visibleModuleKeys.filter((k) => isCriticalModule(k) && draft[activeRole]?.[k]?.view) });
      return;
    }
    runColumnBulk(action, value);
  };

  const runColumnBulk = (action, value) => {
    applyBulkToActiveRole(visibleModuleKeys, () => ({ [action]: value }));
    showToast(value ? `Granted ${action} on ${visibleModuleKeys.length} module${visibleModuleKeys.length === 1 ? '' : 's'}.` : `Cleared ${action} on ${visibleModuleKeys.length} module${visibleModuleKeys.length === 1 ? '' : 's'}.`, 'info');
  };

  const handleRowBulk = (moduleKey) => {
    if (isSuperAdminRow) return;
    const row = draft[activeRole]?.[moduleKey] || {};
    const allOn = ACTIONS.every((a) => Boolean(row[a]));
    const value = !allOn;
    if (!value && isCriticalModule(moduleKey) && row.view) {
      setPendingBulk({ kind: 'row', payload: { moduleKey, value }, criticalModules: [moduleKey] });
      return;
    }
    runRowBulk(moduleKey, value);
  };

  const runRowBulk = (moduleKey, value) => {
    applyBulkToActiveRole([moduleKey], () => ({ view: value, create: value, edit: value, delete: value }));
    const label = moduleIndex.get(moduleKey)?.label || moduleKey;
    showToast(value ? `${label}: full access granted.` : `${label}: all access cleared.`, 'info');
  };

  const confirmPendingBulk = () => {
    if (!pendingBulk) return;
    const { kind, payload } = pendingBulk;
    setPendingBulk(null);
    if (kind === 'column') runColumnBulk(payload.action, payload.value);
    if (kind === 'row') runRowBulk(payload.moduleKey, payload.value);
  };

  const validate = (matrix) => {
    for (const roleKey of Object.values(ROLE_KEYS)) {
      if (roleKey === ROLE_KEYS.SUPER_ADMIN) continue;
      let any = false;
      for (const m of MODULES) { for (const a of ACTIONS) { if (matrix[roleKey][m.key][a]) { any = true; break; } } if (any) break; }
      if (!any) { const label = ROLES.find((r) => r.key === roleKey)?.label || roleKey; return `${EMPTY_PERMISSION_ERROR} (${label})`; }
    }
    return null;
  };

  const handleSave = () => {
    if (isSaving) return;
    const err = validate(draft);
    if (err) { setValidationError(err); showToast(err, 'error'); return; }
    setIsSaving(true);
    window.setTimeout(() => {
      updatePermissions(draft);
      setValidationError(null);
      setIsSaving(false);
      showToast('Permissions saved successfully. Changes take effect immediately.');
    }, 320);
  };

  const handleDiscard = () => { setDraft(cloneMatrix(permissions)); setValidationError(null); showToast('Draft changes discarded.', 'info'); };

  const handleReset = (scope = 'role') => { setResetScope(scope); setConfirmResetOpen(true); };

  const confirmReset = () => {
    setConfirmResetOpen(false);
    setValidationError(null);
    if (resetScope === 'all') {
      resetPermissions();
      setDraft(cloneMatrix(DEFAULT_PERMISSIONS));
      addAuditLog({ userName: authUser?.name || 'Director', role: authUser?.role || 'director', action: 'RESET', module: 'Roles & Permissions', description: 'Reset every role permissions to factory defaults.' });
      showToast('Every role reset to defaults.', 'info');
      return;
    }
    const next = { ...permissions, [activeRole]: cloneMatrix(DEFAULT_PERMISSIONS)[activeRole] };
    updatePermissions(next);
    setDraft(cloneMatrix(next));
    addAuditLog({ userName: authUser?.name || 'Director', role: authUser?.role || 'director', action: 'RESET', module: 'Roles & Permissions', description: `Reset ${activeRoleMeta.label} permissions to default.` });
    showToast(`${activeRoleMeta.label} reset to defaults.`, 'info');
  };

  const activeRoleMeta = ROLES.find((r) => r.key === activeRole) || ROLES[0];
  const activeRow = draft[activeRole] || {};

  const counts = useMemo(() => {
    const out = {};
    const moduleHasAccess = (row, key) => { const cell = row?.[key]; return Boolean(cell && (cell.view || cell.create || cell.edit || cell.delete)); };
    for (const r of ROLES) {
      const row = draft[r.key] || {};
      let platform = 0; for (const k of PLATFORM_MODULE_KEYS) if (moduleHasAccess(row, k)) platform++;
      let operational = 0; for (const k of OPERATIONAL_MODULE_KEYS) if (moduleHasAccess(row, k)) operational++;
      out[r.key] = { platform, operational };
    }
    return out;
  }, [draft]);

  const PLATFORM_TOTAL = PLATFORM_MODULE_KEYS.length;
  const OPERATIONAL_TOTAL = OPERATIONAL_MODULE_KEYS.length;
  const TOTAL_CELLS = MODULES.length * ACTIONS.length;

  const changeCount = useMemo(() => {
    let n = 0;
    for (const r of Object.values(ROLE_KEYS)) for (const m of MODULES) for (const a of ACTIONS) if (Boolean(draft?.[r]?.[m.key]?.[a]) !== Boolean(permissions?.[r]?.[m.key]?.[a])) n++;
    return n;
  }, [draft, permissions]);

  const activeRoleSavedCells = useMemo(() => { let n = 0; for (const m of MODULES) for (const a of ACTIONS) if (permissions?.[activeRole]?.[m.key]?.[a]) n++; return n; }, [permissions, activeRole]);
  const activeRoleDefaultCells = useMemo(() => { let n = 0; for (const m of MODULES) for (const a of ACTIONS) if (DEFAULT_PERMISSIONS?.[activeRole]?.[m.key]?.[a]) n++; return n; }, [activeRole]);

  const lockedModule = (moduleKey) => isSuperAdminRow && SUPER_ADMIN_LOCKED_MODULES.includes(moduleKey);

  const tooltipFor = (roleKey, moduleKey, action) => {
    if (roleKey === ROLE_KEYS.SUPER_ADMIN) return 'Super Admin permissions are fixed and cannot be edited.';
    if (action !== 'view' && !draft[roleKey]?.[moduleKey]?.view) return 'Enable View first — write actions require View to be granted.';
    return '';
  };

  return (
    <div className="cgms-rolepermission-page" style={{ padding: 28, background: T.bg, minHeight: '100vh', fontFamily: T.font }}>
      <style>{'@keyframes cgms-rp-spin { to { transform: rotate(360deg); } }'}</style>
      <Toast toast={toast} />

      <ConfirmModal
        open={confirmResetOpen}
        title={resetScope === 'all' ? 'Reset every role to defaults?' : `Reset ${activeRoleMeta.label} to defaults?`}
        message={resetScope === 'all'
          ? 'This will discard every customisation and restore the original permission matrix for all roles. This action cannot be undone.'
          : `This will reset the ${activeRoleMeta.label} role to its factory-default permissions. You will lose any customisations you have made. This action cannot be undone.\n\nCurrent: ${activeRoleSavedCells} of ${TOTAL_CELLS} permissions.\nDefault: ${activeRoleDefaultCells} of ${TOTAL_CELLS} permissions.`}
        confirmLabel={resetScope === 'all' ? 'Yes, reset everything' : 'Yes, reset to default'}
        onConfirm={confirmReset}
        onCancel={() => setConfirmResetOpen(false)}
      />

      <ConfirmModal
        open={Boolean(pendingBulk)}
        title="Disable critical module(s)?"
        message={pendingBulk ? `This will remove access from ${pendingBulk.criticalModules.map((k) => moduleIndex.get(k)?.label || k).join(', ')} for ${activeRoleMeta.label}. Critical modules underpin admin access, audit, and RBAC — confirm to proceed.` : ''}
        confirmLabel="Yes, disable"
        onConfirm={confirmPendingBulk}
        onCancel={() => setPendingBulk(null)}
      />

      {/* ── Page Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: T.navy, margin: 0 }}>Roles &amp; Permissions</h1>
          {/* Bug 13 fix: show which company/organisation the roles belong to */}
          {(authUser?.organisationName || authUser?.organizationName || authUser?.organization?.name || authUser?.orgName) && (
            <p style={{ fontSize: 12, fontWeight: 700, color: T.purple, margin: '4px 0 0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {authUser.organisationName || authUser.organizationName || authUser.organization?.name || authUser.orgName}
            </p>
          )}
          <p style={{ fontSize: 13, color: T.muted, margin: '4px 0 0' }}>
            Manage module-level access for each role. Changes take effect across the entire application instantly once saved.
          </p>
          <Link to="/audit-logs?tab=rbac" title="Open the audit log filtered to permission-change events" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 12, fontWeight: 700, color: T.purple, textDecoration: 'none', padding: '4px 10px', borderRadius: 8, border: `1px solid ${T.purple}30`, background: T.purpleLight }}>
            📜 View permission change history →
          </Link>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" style={btn(T.text, true)} onClick={handleDiscard} disabled={!isDirty || isSaving}>Discard</button>
          <button type="button" style={btn(T.red, true, isSuperAdminRow || isSaving)} onClick={() => handleReset('role')} disabled={isSuperAdminRow || isSaving} title={isSuperAdminRow ? 'Super Admin row is locked.' : `Reset ${activeRoleMeta.label} to default permissions`}>
            Reset {activeRoleMeta.label}
          </button>
          <button type="button" style={btn(T.purple, false, !isDirty || isSaving)} onClick={handleSave} disabled={!isDirty || isSaving} aria-busy={isSaving || undefined}>
            {isSaving ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span aria-hidden="true" style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', display: 'inline-block', animation: 'cgms-rp-spin 0.7s linear infinite' }} />
                Saving…
              </span>
            ) : !isDirty ? 'No changes to save' : `Save ${changeCount} change${changeCount === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>

      {/* ── Dirty banner ── */}
      {isDirty && (
        <div style={{ ...card({ padding: 12, marginBottom: 14 }), position: 'sticky', top: 0, zIndex: 5, borderColor: `${T.amber}55`, background: dark ? '#451A03' : '#FFFBEB', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 13, color: T.amber, fontWeight: 700 }}>You have <strong>{changeCount}</strong> unsaved change{changeCount === 1 ? '' : 's'}.</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" style={btn(T.text, true, isSaving)} onClick={handleDiscard} disabled={isSaving}>Discard</button>
            <button type="button" style={btn(T.amber, false, isSaving)} onClick={handleSave} disabled={isSaving}>{isSaving ? 'Saving…' : `Save ${changeCount} change${changeCount === 1 ? '' : 's'}`}</button>
          </div>
        </div>
      )}

      {validationError && (
        <div role="alert" style={{ ...card({ padding: 12, marginBottom: 14 }), borderColor: `${T.red}55`, background: dark ? '#450A0A' : '#FEF2F2', color: T.red, fontSize: 13, fontWeight: 700 }}>
          {validationError}
        </div>
      )}

      {/* ════════════════ PERMISSION EDITOR ════════════════ */}
      {/* Role tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {ROLES.map((r) => {
            const isActive = r.key === activeRole;
            const isMine = r.key === currentRole;
            const isLocked = r.key === ROLE_KEYS.SUPER_ADMIN;
            return (
              <button key={r.key} type="button" onClick={() => setActiveRole(r.key)} style={{ padding: '10px 16px', borderRadius: 12, border: `1.5px solid ${isActive ? r.color : T.border}`, background: isActive ? `${r.color}15` : T.card, color: isActive ? r.color : T.text, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: T.font, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.color }} />
                {r.label}
                <span title={isLocked ? `Platform: ${counts[r.key].platform}/${PLATFORM_TOTAL} · Operational: ${counts[r.key].operational}/${OPERATIONAL_TOTAL} (operational denied by design)` : `Platform: ${counts[r.key].platform}/${PLATFORM_TOTAL} · Operational: ${counts[r.key].operational}/${OPERATIONAL_TOTAL}`} style={{ fontSize: 11, color: T.muted, fontWeight: 600, whiteSpace: 'nowrap' }}>
                  P {counts[r.key].platform}/{PLATFORM_TOTAL} · O {counts[r.key].operational}/{OPERATIONAL_TOTAL}
                </span>
                {isLocked && <span title="Read-only" style={{ fontSize: 9, padding: '2px 6px', borderRadius: 6, background: dark ? '#0C1E2E' : '#F1F5F9', color: T.text, fontWeight: 800 }}>LOCKED</span>}
                {isMine && <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 6, background: T.purpleLight, color: T.purple, fontWeight: 800 }}>YOU</span>}
              </button>
            );
          })}
        </div>

        {/* Permission matrix */}
        <div style={card({ padding: 0, overflow: 'hidden' })}>
          <div style={{ padding: 16, background: dark ? `linear-gradient(135deg, ${activeRoleMeta.color}20, ${activeRoleMeta.color}08)` : `linear-gradient(135deg, ${activeRoleMeta.color}15, ${activeRoleMeta.color}05)`, borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: activeRoleMeta.color }}>{activeRoleMeta.label}</div>
              <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>
                Platform: <strong style={{ color: activeRoleMeta.color }}>{counts[activeRole].platform}/{PLATFORM_TOTAL}</strong>
                {' · '}
                Operational: <strong style={{ color: activeRoleMeta.color }}>{counts[activeRole].operational}/{OPERATIONAL_TOTAL}</strong>
                {isSuperAdminRow && counts[activeRole].operational === 0 && <span style={{ color: T.muted, fontStyle: 'italic' }}> (by design)</span>}
              </div>
              {ROLE_DESCRIPTIONS[activeRole] && <p style={{ marginTop: 8, fontSize: 12, color: T.text, lineHeight: 1.6, maxWidth: 720 }}>{ROLE_DESCRIPTIONS[activeRole]}</p>}
              {isSuperAdminRow && <p style={{ marginTop: 6, fontSize: 11, color: T.muted, lineHeight: 1.5 }}>This row is locked — Super Admin permissions are platform-enforced and cannot be modified from the UI.</p>}
            </div>
            <label style={{ position: 'relative', flex: '0 0 240px' }}>
              <span aria-hidden="true" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: T.muted, pointerEvents: 'none' }}>🔍</span>
              <input type="search" value={moduleSearch} onChange={(e) => setModuleSearch(e.target.value)} placeholder="Search modules..." aria-label="Search modules" style={{ width: '100%', padding: '8px 28px 8px 28px', borderRadius: 10, border: `1px solid ${T.border}`, fontSize: 13, fontFamily: T.font, background: T.card, color: T.navy }} />
              {moduleSearch && (
                <button type="button" onClick={() => setModuleSearch('')} title="Clear search" aria-label="Clear search" style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', color: T.muted, fontSize: 14, padding: 4, lineHeight: 1 }}>×</button>
              )}
            </label>
          </div>

          <div className="cgms-rp-desktop" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
              <thead>
                <tr style={{ background: dark ? '#0C1E2E' : '#F9FAFB', borderBottom: `1px solid ${T.border}` }}>
                  <th style={headCell(T, 'left')}>Module</th>
                  {ACTIONS.map((a) => {
                    const target = isSuperAdminRow ? null : columnTargetValue(a);
                    return (
                      <th key={a} style={headCell(T, 'center', 100)}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <span>{a}</span>
                          {!isSuperAdminRow && (
                            <button type="button" onClick={() => handleColumnBulk(a)} title={target ? `Grant ${a} on every visible module` : `Clear ${a} on every visible module`} style={{ width: 18, height: 18, padding: 0, border: `1px solid ${T.border}`, background: T.card, borderRadius: 4, cursor: 'pointer', fontSize: 10, lineHeight: 1, color: T.purple, fontWeight: 800 }}>
                              {target ? '☐' : '☑'}
                            </button>
                          )}
                        </div>
                      </th>
                    );
                  })}
                  {/* NEW: Visible To column */}
                  <th style={headCell(T, 'left', 220)}>
                    <span title="Which roles can view this module (based on current draft)">👁️ Visible To</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleGroups.length === 0 && (
                  <tr>
                    <td colSpan={2 + ACTIONS.length} style={{ padding: 24, textAlign: 'center', color: T.muted, fontSize: 13 }}>
                      No modules match "{moduleSearch}".
                    </td>
                  </tr>
                )}
                {visibleGroups.map((group) => (
                  <React.Fragment key={group.id}>
                    <tr style={{ background: dark ? '#0C1E2E' : '#F1F5F9', borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}` }}>
                      <td colSpan={2 + ACTIONS.length} style={{ padding: '10px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                          <span aria-hidden="true" style={{ fontSize: 13 }}>{group.icon}</span>
                          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: T.navy }}>{group.title}</span>
                          <span style={{ fontSize: 11, color: T.muted }}>{group.subtitle}</span>
                        </div>
                      </td>
                    </tr>
                    {group.modules.map((m, idx) => {
                      const row = activeRow[m.key] || {};
                      const rowLocked = isSuperAdminRow;
                      const isLastInGroup = idx === group.modules.length - 1;
                      return (
                        <tr key={m.key} style={{ borderBottom: isLastInGroup ? 'none' : `1px solid ${T.border}`, background: rowLocked ? (dark ? '#0C1E2E' : '#F8FAFC') : T.card }}>
                          <td style={{ padding: '12px 16px', fontSize: 13 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ fontSize: 16 }}>{m.icon}</span>
                              <span style={{ fontWeight: 700, color: T.navy }}>{m.label}</span>
                              {isCriticalModule(m.key) && <span title="Critical module — disabling locks admins out of platform integrity surfaces." style={{ fontSize: 9, padding: '2px 6px', borderRadius: 6, background: '#FEF2F2', color: T.red, fontWeight: 800, border: `1px solid ${T.red}30` }}>CRITICAL</span>}
                              {rowLocked && lockedModule(m.key) && !isCriticalModule(m.key) && <span title="Critical Super Admin module — cannot be disabled." style={{ fontSize: 9, padding: '2px 6px', borderRadius: 6, background: T.purpleLight, color: T.purple, fontWeight: 800 }}>LOCKED</span>}
                              {!rowLocked && (() => {
                                const allOn = ACTIONS.every((a) => Boolean(row[a]));
                                return (
                                  <button type="button" onClick={() => handleRowBulk(m.key)} title={allOn ? `Clear all permissions on ${m.label}` : `Grant all permissions on ${m.label}`} style={{ marginLeft: 'auto', padding: '2px 8px', borderRadius: 6, border: `1px solid ${T.border}`, background: T.card, color: T.purple, fontSize: 10, fontWeight: 800, cursor: 'pointer', fontFamily: T.font, letterSpacing: '.04em' }}>
                                    {allOn ? 'Clear all' : 'Select all'}
                                  </button>
                                );
                              })()}
                            </div>
                          </td>
                          {rowLocked ? (
                            <td colSpan={ACTIONS.length} style={{ padding: '12px 16px', textAlign: 'left' }} title="Super Admin permissions are platform-enforced and cannot be modified from the UI.">
                              <LockedRowSummary row={row} hasAccess={lockedRowHasAccess(row)} />
                            </td>
                          ) : ACTIONS.map((a) => {
                            const disabled = a !== 'view' && !row.view;
                            const tip = tooltipFor(activeRole, m.key, a);
                            return (
                              <td key={a} style={{ padding: '12px 8px', textAlign: 'center' }}>
                                <Checkbox checked={Boolean(row[a])} onChange={(v) => toggleCell(activeRole, m.key, a, v)} disabled={disabled} tooltip={tip} ariaLabel={`${activeRoleMeta.label} ${m.label} ${a}`} />
                              </td>
                            );
                          })}
                          {/* Visible To cell */}
                          <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
                            <VisibilityBadges moduleKey={m.key} draft={draft} />
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card layout */}
          <div className="cgms-rp-mobile" style={{ display: 'none', padding: 12, gap: 10, flexDirection: 'column' }}>
            {visibleGroups.length === 0 && <div style={{ padding: 16, textAlign: 'center', color: T.muted, fontSize: 13 }}>No modules match "{moduleSearch}".</div>}
            {visibleGroups.map((group) => (
              <React.Fragment key={group.id}>
                <div style={{ padding: '6px 4px', display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span aria-hidden="true">{group.icon}</span>
                  <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: T.navy }}>{group.title}</span>
                </div>
                {group.modules.map((m) => {
                  const row = activeRow[m.key] || {};
                  const rowLocked = isSuperAdminRow;
                  return (
                    <div key={m.key} style={{ border: `1px solid ${T.border}`, borderRadius: 10, padding: 12, background: rowLocked ? (dark ? '#0C1E2E' : '#F8FAFC') : T.card }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 16 }}>{m.icon}</span>
                          <span style={{ fontWeight: 700, color: T.navy, fontSize: 13 }}>{m.label}</span>
                          {isCriticalModule(m.key) && <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 6, background: '#FEF2F2', color: T.red, fontWeight: 800, border: `1px solid ${T.red}30` }}>CRITICAL</span>}
                        </div>
                        {!rowLocked && (() => {
                          const allOn = ACTIONS.every((a) => Boolean(row[a]));
                          return <button type="button" onClick={() => handleRowBulk(m.key)} style={{ padding: '2px 8px', borderRadius: 6, border: `1px solid ${T.border}`, background: T.card, color: T.purple, fontSize: 10, fontWeight: 800, cursor: 'pointer', fontFamily: T.font }}>{allOn ? 'Clear all' : 'Select all'}</button>;
                        })()}
                      </div>
                      {/* Visibility badges on mobile too */}
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>👁️ Visible To:</div>
                        <VisibilityBadges moduleKey={m.key} draft={draft} />
                      </div>
                      {rowLocked ? (
                        <LockedRowSummary row={row} hasAccess={lockedRowHasAccess(row)} />
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                          {ACTIONS.map((a) => {
                            const disabled = a !== 'view' && !row.view;
                            const tip = tooltipFor(activeRole, m.key, a);
                            return (
                              <label key={a} title={disabled ? tip : undefined} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '6px 10px', borderRadius: 8, background: dark ? '#0C1E2E' : '#F9FAFB', border: `1px solid ${T.border}`, opacity: disabled ? 0.6 : 1 }}>
                                <span style={{ fontSize: 12, color: T.text, fontWeight: 600, textTransform: 'capitalize' }}>{a}</span>
                                <Checkbox checked={Boolean(row[a])} onChange={(v) => toggleCell(activeRole, m.key, a, v)} disabled={disabled} tooltip={tip} ariaLabel={`${activeRoleMeta.label} ${m.label} ${a}`} />
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>

      {/* Info box */}
      <div style={{ ...card({ marginTop: 16 }), background: T.purpleLight, border: `1px solid ${T.purple}30` }}>
        <div style={{ fontSize: 12, color: T.purple, fontWeight: 700, marginBottom: 4 }}>How it works</div>
        <div style={{ fontSize: 12, color: T.text, lineHeight: 1.6 }}>
          Changes are buffered as a draft. Clicking <strong>Save Changes</strong> commits the draft to{' '}
          <code style={{ background: T.card, padding: '2px 6px', borderRadius: 4 }}>{PERMISSIONS_STORAGE_KEY}</code>{' '}
          and broadcasts an update so every sidebar item, route guard, and action button reflects the new permissions immediately — no refresh required.
          Super Admin is a platform-owner role: operational modules are permanently denied and the row is locked.
        </div>
      </div>
    </div>
  );
}

const headCell = (T, align = 'left', width) => ({
  textAlign: align,
  padding: '12px 16px',
  fontSize: 11,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '.06em',
  color: T.muted,
  ...(width ? { width } : {}),
});

export default RolesPermissionsPage;