/**
 * passwordValidation.js — shared password primitives (Module 8).
 *
 * Consumed by:
 *   - ChangePasswordModal (self-serve in Security tab)
 *   - Module 11 ForcePasswordChangeGate (future)
 *   - Login reset flow (future)
 *   - Staff ResetPasswordModal (admin reset — uses generateTempPassword, not these rules)
 *
 * Keep rules centralised so the UI strength meter + field validator + server
 * check can never drift.
 *
 * TODO (production auth phase) — replace SHA-256 client hashing with
 *   bcrypt/argon2 behind a backend API. Client-side SHA-256 is insufficient
 *   for production but fine as a mock during local-only development.
 */

export const PASSWORD_MIN_LENGTH = 8;

/** Each rule = { id, label, test(pw) } — order controls the checklist. */
export const PASSWORD_RULES = Object.freeze([
  { id: 'length',    label: 'At least 8 characters',          test: (p) => (p || '').length >= PASSWORD_MIN_LENGTH },
  { id: 'uppercase', label: 'At least one uppercase letter',  test: (p) => /[A-Z]/.test(p || '') },
  { id: 'lowercase', label: 'At least one lowercase letter',  test: (p) => /[a-z]/.test(p || '') },
  { id: 'digit',     label: 'At least one digit',             test: (p) => /\d/.test(p || '') },
  { id: 'symbol',    label: 'At least one special character', test: (p) => /[^A-Za-z0-9]/.test(p || '') },
]);

/** True only when every rule passes. */
export function isPasswordStrong(pw) {
  return PASSWORD_RULES.every((r) => r.test(pw));
}

/**
 * Derive a 4-segment strength score (0–4).
 *   0 empty · 1 Weak · 2 Fair · 3 Good · 4 Strong
 * Score counts rule passes and clamps to 4. The bar visual uses the
 * same value.
 */
export function passwordStrength(pw) {
  if (!pw) return { score: 0, label: 'Empty', colour: '#CBD5E1' };
  const passed = PASSWORD_RULES.filter((r) => r.test(pw)).length;
  if (passed <= 2) return { score: 1, label: 'Weak',   colour: '#DC2626' };
  if (passed === 3) return { score: 2, label: 'Fair',  colour: '#D97706' };
  if (passed === 4) return { score: 3, label: 'Good',  colour: '#2563EB' };
  return                { score: 4, label: 'Strong', colour: '#059669' };
}

/**
 * Validate a change-password attempt. Returns `{ ok: true }` or
 * `{ ok: false, field, message }` so the caller can aim the error at
 * the right input. Messages use British English and end with full stops
 * per spec.
 *
 * @param {object} args
 * @param {string} args.current        — value typed in "Current Password"
 * @param {string} args.next           — value typed in "New Password"
 * @param {string} args.confirm        — value typed in "Confirm New Password"
 * @param {string} [args.tempPassword] — legacy temp password (must not equal)
 * @param {string} [args.currentHash]  — existing passwordHash, for comparison
 */
export async function validateChangePassword({
  current, next, confirm, tempPassword = null, currentHash = null,
}) {
  if (!current || current.length === 0) {
    return { ok: false, field: 'current', message: 'Please enter your current password.' };
  }
  if (!next || next.length === 0) {
    return { ok: false, field: 'next', message: 'Please enter a new password.' };
  }
  if (!confirm || confirm.length === 0) {
    return { ok: false, field: 'confirm', message: 'Please confirm your new password.' };
  }
  if (next !== confirm) {
    return { ok: false, field: 'confirm', message: 'New password and confirmation do not match.' };
  }

  for (const rule of PASSWORD_RULES) {
    if (!rule.test(next)) {
      const messages = {
        length:    `Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`,
        uppercase: 'Password must contain at least one uppercase letter.',
        lowercase: 'Password must contain at least one lowercase letter.',
        digit:     'Password must contain at least one digit.',
        symbol:    'Password must contain at least one special character.',
      };
      return { ok: false, field: 'next', message: messages[rule.id] };
    }
  }

  if (next === current) {
    return { ok: false, field: 'next', message: 'New password cannot be the same as your current password.' };
  }
  if (tempPassword && next === tempPassword) {
    return { ok: false, field: 'next', message: 'New password cannot be the same as your temporary password.' };
  }

  /* Verify the current password matches what's on file. Support both
     legacy plaintext tempPassword and new passwordHash. */
  if (currentHash) {
    const hash = await sha256Hex(current);
    if (hash !== currentHash) {
      return { ok: false, field: 'current', message: 'Current password is incorrect.' };
    }
  } else if (tempPassword && current !== tempPassword) {
    return { ok: false, field: 'current', message: 'Current password is incorrect.' };
  } else if (!tempPassword && !currentHash) {
    /* No on-file credential at all — demo user logging in with a hardcoded
       ROLES password. Accept the declared current value as the authority. */
  }

  return { ok: true };
}

/**
 * SHA-256 hex digest using the SubtleCrypto API. Returns a 64-char
 * lowercase hex string. Throws if SubtleCrypto is unavailable (very old
 * browser / insecure context).
 */
export async function sha256Hex(value) {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('SubtleCrypto is not available in this context.');
  }
  const data = new TextEncoder().encode(String(value ?? ''));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
