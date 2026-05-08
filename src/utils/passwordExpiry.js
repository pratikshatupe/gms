/**
 * passwordExpiry.js — frontend mirror of the backend
 * dispatchPasswordExpiryWarnings cron. Scans staff records for those
 * whose password is older than the configured `passwordExpiryDays`
 * window, fires a branded email via /api/v1/notifications/dispatch,
 * and stamps `passwordExpiryNotifiedAt` on the staff record so the
 * same user is not re-notified within a 24-hour window.
 *
 * Staff records track password age via `passwordChangedAt` (set by
 * ChangePasswordModal). Records without it fall back to `createdAt`
 * — the seed Director/Manager/Reception users have createdAt > 90
 * days ago, so a fresh save with passwordExpiryDays=90 will fire
 * emails to all of them on first run.
 */

import { generatePasswordExpiryEmail, previewEmail } from './emailTemplates';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOTIFY_DEDUPE_MS = 24 * 60 * 60 * 1000; // 1 day

function ageInDays(staff, now) {
  const stamp = staff?.passwordChangedAt || staff?.createdAt;
  if (!stamp) return null;
  const t = new Date(stamp).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.floor((now.getTime() - t) / DAY_MS);
}

function recentlyNotified(staff, now) {
  const stamp = staff?.passwordExpiryNotifiedAt;
  if (!stamp) return false;
  const t = new Date(stamp).getTime();
  if (!Number.isFinite(t)) return false;
  return now.getTime() - t < NOTIFY_DEDUPE_MS;
}

/**
 * Returns the list of staff records currently eligible for a password
 * expiry email — i.e. older than `expiryDays` and not notified within
 * the last 24 hours. Pure function; useful for previewing in tests
 * before actually dispatching.
 */
export function findExpiredPasswordStaff(staff, expiryDays, now = new Date()) {
  if (!Array.isArray(staff)) return [];
  const days = Number(expiryDays);
  if (!Number.isFinite(days) || days <= 0) return [];
  return staff.filter((s) => {
    if (!s || !s.emailId) return false;
    if (s.status && s.status !== 'Active') return false;
    if (recentlyNotified(s, now)) return false;
    const age = ageInDays(s, now);
    if (age == null) return false;
    return age >= days;
  });
}

/**
 * Dispatch password-expiry emails for every eligible staff record.
 * Uses previewEmail (POST /api/v1/notifications/dispatch) so the
 * backend SMTP transport actually delivers the message. Returns a
 * summary { sent, failed, skipped, candidates } so the caller can
 * surface a toast.
 *
 * `updateStaff(id, patch)` is the useCollection update fn for the
 * staff store. We stamp `passwordExpiryNotifiedAt` on success so the
 * same user is not pinged again within the dedupe window.
 *
 * `orgsById` is an optional { [orgId]: org } map so the email body can
 * use the recipient's organisation name and country for region pickup.
 */
export async function dispatchPasswordExpiryEmails({
  staff,
  expiryDays,
  updateStaff,
  orgsById = {},
  now = new Date(),
}) {
  const candidates = findExpiredPasswordStaff(staff, expiryDays, now);
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const s of candidates) {
    const org = orgsById?.[s.orgId] || null;
    const age = ageInDays(s, now);
    try {
      const envelope = generatePasswordExpiryEmail({
        name: s.fullName || s.name,
        emailId: s.emailId,
        expiryDays,
        orgName: org?.name,
        orgCountry: org?.country,
        ageDays: age,
      });
      const result = await previewEmail({ ...envelope, to: s.emailId });
      if (result && result.ok) {
        sent += 1;
        try {
          updateStaff?.(s.id, { passwordExpiryNotifiedAt: now.toISOString() });
        } catch {
          /* persistence is best-effort — if the update hook fails the
             dedupe just won't kick in until next time. */
        }
      } else if (result && result.skipped) {
        skipped += 1;
      } else {
        failed += 1;
        // eslint-disable-next-line no-console
        console.warn('[passwordExpiry] dispatch failed for', s.emailId, result?.error);
      }
    } catch (err) {
      failed += 1;
      // eslint-disable-next-line no-console
      console.error('[passwordExpiry] threw for', s?.emailId, err);
    }
  }

  return { sent, failed, skipped, candidates: candidates.length };
}
