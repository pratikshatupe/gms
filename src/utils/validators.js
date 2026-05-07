/**
 * Shared form validators.
 *
 * Keep logic here small and framework-agnostic — pages import these
 * directly and surface errors in their own state.
 */

/**
 * Phone number validator.
 * Rule: exactly 10 digits, no spaces, no dashes, no country code.
 * Returns `true` when valid.
 */
export function validatePhone(phone) {
  return /^[0-9]{10}$/.test(String(phone ?? '').trim());
}

/** Convenience error string — keep copy consistent across pages. */
export const PHONE_ERROR_MSG = 'Please enter a valid Contact Number.';
