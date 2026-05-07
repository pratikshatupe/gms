/**
 * Shared formatting helpers.
 * Platform uses INR (₹) as the default display currency.
 */

/** INR currency — en-IN grouping (e.g. "₹4,82,450"). */
export function formatAed(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '₹0';
  return `₹${n.toLocaleString('en-IN')}`;
}

/** en-GB grouping ("4,82,450" → "482,450") for plain numeric counts. */
export function formatNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('en-GB');
}

/** Percentage with configurable precision — defaults to one decimal. */
export function formatPercent(value, decimals = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return `0.${'0'.repeat(decimals)}%`;
  return `${n.toFixed(decimals)}%`;
}
