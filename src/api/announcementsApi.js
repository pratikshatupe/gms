/**
 * Announcement API client. Thin wrapper over apiJson() in src/api/http.js
 * so calls automatically attach the access token and refresh on 401.
 *
 * Server contract (matches backend/src/routes/Announcement.routes.js):
 *
 *   GET    /announcements/my              → list visible to current user
 *   POST   /announcements                  → create (Super Admin only)
 *   PATCH  /announcements/:id/dismiss      → dismiss for THIS user only
 *   PATCH  /announcements/:id/read         → mark read for THIS user only
 *   DELETE /announcements/:id              → global delete (Super Admin only)
 *   GET    /announcements                  → full log (Super Admin only)
 */

import { apiJson } from './http';

function unwrap(json) {
  if (!json) return null;
  if (json.data !== undefined) return json.data;
  return json;
}

export async function listMyAnnouncements({ includeDismissed = false } = {}) {
  const qs = includeDismissed ? '?includeDismissed=true' : '';
  const json = await apiJson(`/announcements/my${qs}`);
  const data = unwrap(json);
  return Array.isArray(data) ? data : [];
}

export async function listAllAnnouncements() {
  const json = await apiJson('/announcements');
  const data = unwrap(json);
  return Array.isArray(data) ? data : [];
}

/**
 * Create + dispatch an announcement. Payload shape mirrors the backend
 * Announcement model:
 *
 *   {
 *     title, body, type?,
 *     recipients: { type, organisationIds?, roles?, userIds? },
 *     channels:   { inApp, email, sms },
 *     schedule:   { sendNow: true, scheduledAt: null }
 *   }
 *
 * Returns { announcement, summary } where summary has totalRecipients,
 * emailsSent, emailsFailed, smsSkipped, smsReason.
 */
export async function createAnnouncement(payload) {
  const json = await apiJson('/announcements', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return {
    announcement: unwrap(json),
    summary: json?.summary || { totalRecipients: 0, emailsSent: 0, emailsFailed: 0 },
    message: json?.message || '',
  };
}

export async function dismissAnnouncement(id) {
  return apiJson(`/announcements/${encodeURIComponent(id)}/dismiss`, {
    method: 'PATCH',
  });
}

export async function markAnnouncementRead(id) {
  return apiJson(`/announcements/${encodeURIComponent(id)}/read`, {
    method: 'PATCH',
  });
}

export async function deleteAnnouncementGlobal(id) {
  return apiJson(`/announcements/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
