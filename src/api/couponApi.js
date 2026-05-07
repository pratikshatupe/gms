/**
 * Coupon HTTP client used by the signup flow. Always returns the
 * standardised envelope { valid, coupon?, message? } so callers can
 * branch on `valid` without juggling fetch errors.
 */
const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

async function postJSON(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  let json = null;
  try { json = await res.json(); } catch { /* non-JSON response */ }
  if (!json) {
    return { valid: false, message: `Network error (${res.status})` };
  }
  return json;
}

export async function applyCoupon({ couponCode, organizationSize, selectedPlan }) {
  if (!couponCode || !couponCode.trim()) {
    return { valid: false, message: 'Please enter a coupon code' };
  }
  try {
    return await postJSON('/coupons/apply', {
      couponCode: couponCode.trim().toUpperCase(),
      organizationSize: organizationSize || '',
      selectedPlan: selectedPlan || '',
    });
  } catch {
    return { valid: false, message: 'Could not reach server. Try again.' };
  }
}

export async function redeemCoupon({ couponCode, organizationSize, selectedPlan }) {
  if (!couponCode) return { valid: false, message: 'No coupon to redeem' };
  try {
    return await postJSON('/coupons/redeem', {
      couponCode: couponCode.trim().toUpperCase(),
      organizationSize: organizationSize || '',
      selectedPlan: selectedPlan || '',
    });
  } catch {
    return { valid: false, message: 'Could not record coupon usage' };
  }
}
