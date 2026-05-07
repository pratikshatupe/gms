import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ACTIONS,
  AUTH_ROLE_TO_KEY,
  CURRENT_ROLE_STORAGE_KEY,
  DEFAULT_PERMISSIONS,
  LEGACY_PERMISSIONS_KEYS,
  MODULES,
  PERMISSIONS_STORAGE_KEY,
  ROLE_KEYS,
  SUPER_ADMIN_LOCKED_MODULES,
} from '../utils/defaultPermissions';
import {
  addRbacAuditLogs,
  diffRoleMatrix,
  getCurrentUserSnapshot,
} from '../utils/rbacAuditLogger';
import {
  ORG_OVERRIDES_STORAGE_KEY,
  clearOrgOverrides,
  readOrgOverrides,
  resolveRow,
  setOrgOverride as writeOrgOverride,
} from '../utils/orgPermissions';

/**
 * Global Role & Permission System — single source of truth.
 *
 *   currentRole       (one of ROLE_KEYS)
 *   permissions       ({ [role]: { [module]: { view, create, edit, delete } } })
 *   hasPermission()   (module, action) → boolean
 *
 * PERSISTENCE CONTRACT
 *   - Writes go to localStorage[PERMISSIONS_STORAGE_KEY] only via
 *     updatePermissions(). Once a value is saved, it survives refresh,
 *     logout, login, role-switch and direct-URL navigation. NOTHING in
 *     this app overwrites a saved value with the static defaults except
 *     an explicit "Reset to defaults" click in the Roles & Permissions
 *     editor.
 *   - The static `DEFAULT_PERMISSIONS` map is consulted ONLY when a
 *     specific (role, module) cell is missing from the persisted matrix.
 *     This lets us add new modules in code without forcing a one-time
 *     migration, while never silently downgrading something a Director
 *     already saved.
 *   - Two roles get save-time floors so the platform can never lock
 *     itself out:
 *       SuperAdmin → forced back to spec defaults on every save;
 *                    SUPER_ADMIN_LOCKED_MODULES get `view` pinned on.
 *       Director   → `roles-permissions` is forced to all-true on save,
 *                    so the Director can never accidentally remove their
 *                    own ability to manage the matrix. Director can still
 *                    save anything they want for any other (role, module).
 *     READS never re-apply these floors — saved values are returned as-is.
 */

const RoleContext = createContext(null);

const safeRead = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

const safeWrite = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* quota / private mode — non-fatal */ }
};

/**
 * Hydrate the in-memory matrix from the persisted matrix, filling missing
 * cells from DEFAULT_PERMISSIONS. Persisted values always win for cells
 * that exist; defaults are only used to fill gaps (newly added modules /
 * roles a saved snapshot doesn't know about).
 */
const hydrateFromStorage = (persisted) => {
  const out = {};
  for (const role of Object.values(ROLE_KEYS)) {
    out[role] = {};
    for (const m of MODULES) {
      const fromPersisted = persisted?.[role]?.[m.key];
      if (fromPersisted) {
        out[role][m.key] = {
          view:   Boolean(fromPersisted.view),
          create: Boolean(fromPersisted.create),
          edit:   Boolean(fromPersisted.edit),
          delete: Boolean(fromPersisted.delete),
        };
      } else {
        out[role][m.key] = { ...DEFAULT_PERMISSIONS[role][m.key] };
      }
    }
  }
  return out;
};

/**
 * Apply save-time floors to a candidate matrix. Mutates and returns the
 * candidate. Floors are deliberately minimal — only the two cells that
 * would lock the platform out if cleared:
 *   - SuperAdmin row: reset to spec defaults; SUPER_ADMIN_LOCKED_MODULES
 *     get `view: true`.
 *   - Director.roles-permissions: pinned to {view, create, edit, delete}
 *     all true so the matrix editor itself remains reachable.
 */
const applySaveFloors = (candidate) => {
  const superAdminDefaults = DEFAULT_PERMISSIONS[ROLE_KEYS.SUPER_ADMIN];
  candidate[ROLE_KEYS.SUPER_ADMIN] = {};
  for (const m of MODULES) {
    candidate[ROLE_KEYS.SUPER_ADMIN][m.key] = { ...superAdminDefaults[m.key] };
  }
  for (const locked of SUPER_ADMIN_LOCKED_MODULES) {
    const row = candidate[ROLE_KEYS.SUPER_ADMIN][locked]
      || { view: false, create: false, edit: false, delete: false };
    candidate[ROLE_KEYS.SUPER_ADMIN][locked] = { ...row, view: true };
  }
  if (!candidate[ROLE_KEYS.DIRECTOR]) candidate[ROLE_KEYS.DIRECTOR] = {};
  candidate[ROLE_KEYS.DIRECTOR]['roles-permissions'] = {
    view: true, create: true, edit: true, delete: true,
  };
  return candidate;
};

/**
 * Find the most recent persisted matrix. Prefers the current key, then
 * walks the legacy list so a tenant's saved edits survive a key bump.
 * Returns null if nothing has ever been saved.
 */
const readPersistedMatrix = () => {
  const current = safeRead(PERMISSIONS_STORAGE_KEY, null);
  if (current) return current;
  for (const legacy of LEGACY_PERMISSIONS_KEYS) {
    const legacyVal = safeRead(legacy, null);
    if (legacyVal) return legacyVal;
  }
  return null;
};

export function RoleProvider({ children, role: roleProp }) {
  const [permissions, setPermissions] = useState(() =>
    hydrateFromStorage(readPersistedMatrix()),
  );

  const [currentRole, setCurrentRoleState] = useState(() => {
    try { return localStorage.getItem(CURRENT_ROLE_STORAGE_KEY) || ROLE_KEYS.SUPER_ADMIN; }
    catch { return ROLE_KEYS.SUPER_ADMIN; }
  });

  /* Seed defaults to localStorage on the very first run so the editor reads
     the same shape it writes. After this, only the editor (or an explicit
     reset) ever writes the matrix — no provider re-init can clobber it. */
  useEffect(() => {
    if (!safeRead(PERMISSIONS_STORAGE_KEY, null)) {
      const seeded = applySaveFloors(hydrateFromStorage(null));
      safeWrite(PERMISSIONS_STORAGE_KEY, seeded);
      setPermissions(seeded);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* Auth → role bridge. */
  useEffect(() => {
    if (!roleProp) return;
    const mapped = AUTH_ROLE_TO_KEY[roleProp.toLowerCase()];
    if (mapped && mapped !== currentRole) {
      setCurrentRoleState(mapped);
      try { localStorage.setItem(CURRENT_ROLE_STORAGE_KEY, mapped); } catch {}
    }
  }, [roleProp, currentRole]);

  /* Cross-tab + cross-component sync. */
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === PERMISSIONS_STORAGE_KEY) {
        setPermissions(hydrateFromStorage(safeRead(PERMISSIONS_STORAGE_KEY, null)));
      }
      if (e.key === CURRENT_ROLE_STORAGE_KEY && e.newValue) {
        setCurrentRoleState(e.newValue);
      }
    };
    const onLocal = () => {
      setPermissions(hydrateFromStorage(safeRead(PERMISSIONS_STORAGE_KEY, null)));
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('rbac:permissions-updated', onLocal);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('rbac:permissions-updated', onLocal);
    };
  }, []);

  const setRole = useCallback((nextRole) => {
    if (!nextRole || !Object.values(ROLE_KEYS).includes(nextRole)) return;
    setCurrentRoleState(nextRole);
    try { localStorage.setItem(CURRENT_ROLE_STORAGE_KEY, nextRole); } catch {}
  }, []);

  const updatePermissions = useCallback((next) => {
    const previous  = permissions;
    const incoming  = typeof next === 'function' ? next(previous) : next;
    const candidate = applySaveFloors(hydrateFromStorage(incoming));

    setPermissions(candidate);
    safeWrite(PERMISSIONS_STORAGE_KEY, candidate);
    window.dispatchEvent(new Event('rbac:permissions-updated'));

    /* Audit — one log per role whose matrix actually changed. */
    try {
      const actor = getCurrentUserSnapshot();
      const entries = [];
      for (const roleKey of Object.values(ROLE_KEYS)) {
        const before = previous?.[roleKey]  || {};
        const after  = candidate?.[roleKey] || {};
        const changes = diffRoleMatrix(before, after, MODULES, ACTIONS);
        if (changes.length === 0) continue;
        entries.push({
          targetRole:        roleKey,
          beforePermissions: before,
          afterPermissions:  after,
          changes,
          orgId:             actor.orgId,
        });
      }
      if (entries.length) addRbacAuditLogs(entries);
    } catch { /* logging must never block a save */ }
  }, [permissions]);

  const setPermission = useCallback((role, moduleKey, action, value) => {
    updatePermissions((prev) => ({
      ...prev,
      [role]: {
        ...prev[role],
        [moduleKey]: { ...prev[role]?.[moduleKey], [action]: value },
      },
    }));
  }, [updatePermissions]);

  const resetPermissions = useCallback(() => {
    updatePermissions(DEFAULT_PERMISSIONS);
  }, [updatePermissions]);

  /* Org-override sync. */
  const [orgOverrides, setOrgOverrides] = useState(() => readOrgOverrides());
  useEffect(() => {
    const refresh = () => setOrgOverrides(readOrgOverrides());
    const onStorage = (e) => { if (e.key === ORG_OVERRIDES_STORAGE_KEY) refresh(); };
    window.addEventListener('rbac:org-overrides-updated', refresh);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('rbac:org-overrides-updated', refresh);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  /**
   * hasPermission(moduleKey, action, opts?)
   *
   *   opts.role   override which role to check (defaults to currentRole)
   *   opts.orgId  override which org to check overrides for
   *
   * Resolution: org override (if any) → saved matrix → DEFAULT_PERMISSIONS.
   */
  const hasPermission = useCallback((moduleKey, action = 'view', opts = {}) => {
    const role = opts.role || currentRole;
    if (!role || !moduleKey) return false;

    let orgId = opts.orgId;
    if (orgId === undefined) {
      try {
        const raw = localStorage.getItem('cgms_user');
        const u = raw ? JSON.parse(raw) : null;
        orgId = u?.organisationId || u?.orgId || null;
      } catch { orgId = null; }
    }

    const row = resolveRow({
      role,
      orgId,
      moduleKey,
      defaultsByRole: permissions,
      orgOverrides,
    });
    return Boolean(row?.[action]);
  }, [permissions, currentRole, orgOverrides]);

  const setOrgOverride = useCallback((orgId, role, moduleKey, action, value) => {
    writeOrgOverride(orgId, role, moduleKey, action, value);
    setOrgOverrides(readOrgOverrides());
  }, []);

  const clearOrg = useCallback((orgId) => {
    clearOrgOverrides(orgId);
    setOrgOverrides(readOrgOverrides());
  }, []);

  const value = useMemo(() => ({
    currentRole,
    setRole,
    permissions,
    orgOverrides,
    setOrgOverride,
    clearOrgOverrides: clearOrg,
    setPermission,
    updatePermissions,
    resetPermissions,
    hasPermission,
    MODULES,
    ACTIONS,
    ROLE_KEYS,
  }), [currentRole, setRole, permissions, orgOverrides, setOrgOverride, clearOrg, setPermission, updatePermissions, resetPermissions, hasPermission]);

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error('useRole must be used inside RoleProvider');
  return ctx;
}

/* Convenience predicate hook so JSX guards stay terse:
     {can('services','delete') && <DeleteButton />} */
export function useCan() {
  const { hasPermission } = useRole();
  return hasPermission;
}
