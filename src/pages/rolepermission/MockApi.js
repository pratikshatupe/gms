const STORAGE_KEY = 'roles_permissions_mock_v1';

export const PERMISSIONS = ['view', 'create', 'edit', 'delete'];

export const MODULES = [
  { id: 'users', label: 'Users', icon: '👥' },
  { id: 'roles', label: 'Roles', icon: '🛡️' },
  { id: 'reports', label: 'Reports', icon: '📊' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

const initialRoles = [
  {
    id: 'role_1',
    name: 'Super Admin',
    description: 'Full access to all modules',
    color: '#38BDF8',
    userCount: 12,
    permissions: {
      users: ['view', 'create', 'edit', 'delete'],
      roles: ['view', 'create', 'edit', 'delete'],
      reports: ['view', 'create', 'edit', 'delete'],
      settings: ['view', 'create', 'edit', 'delete'],
    },
  },
  {
    id: 'role_2',
    name: 'Manager',
    description: 'Manage users and reports',
    color: '#60A5FA',
    userCount: 8,
    permissions: {
      users: ['view', 'edit'],
      roles: ['view'],
      reports: ['view', 'create'],
      settings: ['view'],
    },
  },
  {
    id: 'role_3',
    name: 'Viewer',
    description: 'Read-only access',
    color: '#34D399',
    userCount: 24,
    permissions: {
      users: ['view'],
      roles: ['view'],
      reports: ['view'],
      settings: [],
    },
  },
];

let roles = loadRoles();

function loadRoles() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(initialRoles);

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return structuredClone(initialRoles);

    return parsed;
  } catch {
    return structuredClone(initialRoles);
  }
}

function saveRoles(nextRoles) {
  roles = nextRoles;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextRoles));
  } catch {
    // ignore localStorage errors
  }
}

function delay(fn, min = 200, max = 500) {
  const wait = Math.floor(Math.random() * (max - min + 1)) + min;

  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        resolve(fn());
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Mock API error'));
      }
    }, wait);
  });
}

function generateId() {
  return `role_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function normalizePermissions(input = {}) {
  const output = {};

  for (const module of MODULES) {
    const perms = Array.isArray(input[module.id]) ? input[module.id] : [];
    output[module.id] = [...new Set(perms.filter((p) => PERMISSIONS.includes(p)))];
  }

  return output;
}

function normalizeRole(role = {}) {
  return {
    id: role.id || generateId(),
    name: String(role.name || '').trim(),
    description: String(role.description || '').trim(),
    color: role.color || '#94A3B8',
    userCount: Number.isFinite(role.userCount) ? role.userCount : 0,
    permissions: normalizePermissions(role.permissions),
  };
}

function validateRoleInput(role) {
  if (!role || typeof role !== 'object') {
    throw new Error('Invalid role payload');
  }

  if (!String(role.name || '').trim()) {
    throw new Error('Role name is required');
  }
}

export function getRoles() {
  return delay(() => structuredClone(roles));
}

export function getPermissions() {
  return delay(() => structuredClone(PERMISSIONS));
}

export function addRole(role) {
  return delay(() => {
    validateRoleInput(role);

    const nextRole = normalizeRole(role);

    const duplicate = roles.some(
      (r) => r.name.trim().toLowerCase() === nextRole.name.toLowerCase()
    );

    if (duplicate) {
      throw new Error('Role name already exists');
    }

    const created = {
      ...nextRole,
      id: generateId(),
    };

    roles = [created, ...roles];
    saveRoles(roles);

    return structuredClone(created);
  });
}

export function createRole(role) {
  return addRole(role);
}

export function updateRole(id, updatedRole) {
  return delay(() => {
    if (!id) throw new Error('Role id is required');
    validateRoleInput(updatedRole);

    const index = roles.findIndex((r) => r.id === id);
    if (index === -1) throw new Error('Role not found');

    const duplicate = roles.some(
      (r) =>
        r.id !== id &&
        r.name.trim().toLowerCase() === String(updatedRole.name || '').trim().toLowerCase()
    );

    if (duplicate) {
      throw new Error('Another role with the same name already exists');
    }

    const current = roles[index];
    const nextRole = normalizeRole({
      ...current,
      ...updatedRole,
      id,
    });

    roles[index] = nextRole;
    saveRoles(roles);

    return structuredClone(nextRole);
  });
}

export function deleteRole(id) {
  return delay(() => {
    if (!id) throw new Error('Role id is required');

    const exists = roles.some((r) => r.id === id);
    if (!exists) throw new Error('Role not found');

    roles = roles.filter((r) => r.id !== id);
    saveRoles(roles);

    return { success: true, id };
  });
}

export function cloneRole(id) {
  return delay(() => {
    if (!id) throw new Error('Role id is required');

    const original = roles.find((r) => r.id === id);
    if (!original) throw new Error('Role not found');

    const cloned = {
      ...structuredClone(original),
      id: generateId(),
      name: `Copy of ${original.name}`,
    };

    roles = [cloned, ...roles];
    saveRoles(roles);

    return structuredClone(cloned);
  });
}

export function resetMockRoles() {
  roles = structuredClone(initialRoles);
  saveRoles(roles);
  return structuredClone(roles);
}