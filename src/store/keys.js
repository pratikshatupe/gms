/**
 * Single source of truth for every localStorage key used by the app.
 * Never hardcode a 'cgms_*' string elsewhere — import from here.
 */
export const STORAGE_KEYS = Object.freeze({
  USER:          'cgms_user',
  THEME:         'cgms_theme',
  REMEMBER:      'cgms_remember',       // Login "remember email" — scalar, not a collection
  SERVICES:      'cgms_services_v1',    // v1 — enriched Service schema (code, category, chargeable+price+priceUnit, availableOfficeIds, assignedStaffIds). Suffix forces a fresh seed on dev browsers carrying the v0 shape.
  WALKINS:       'cgms_walkins',
  APPOINTMENTS:  'cgms_appointments_v1',// v1 — enriched Appointments schema (state machine, nested visitor, servicesPrebooked, timezone-aware). Suffix forces a fresh seed on dev browsers carrying the v0 shape.
  STAFF:         'cgms_staff_v1',       // v1 — enriched Staff schema (employeeId, emailId, role, reportingToUserId, accessStatus, tempPassword, mustChangePassword). Suffix forces a fresh seed on dev browsers carrying the v0 shape.
  GUEST_LOG:     'cgms_guest_log',
  ROOMS:         'cgms_rooms_v1',       // v1 — enriched Room schema (code, type, floor, amenities, bookingRules, office FK). Suffix forces a fresh seed on dev browsers carrying the pre-v1 simple shape.
  OFFICES:       'cgms_offices_v2',     // v2 — enriched Office schema (address object, operations block, timezone, capacity). The suffix prevents cache conflicts with the pre-v2 simple shape still in some dev browsers.
  ORGANIZATIONS: 'cgms_organizations',  // Tenant organisations + subscription state
  BOOKINGS:      'cgms_bookings',       // Landing page visit-booking requests
  LIVE_NOTIFS:   'cgms_live_notifs',    // Live notification feed (Topbar bell)
  NOTIFICATIONS: 'cgms_notifications',
  AUDIT_LOGS:    'audit_logs',          // Audit Logs Module — spec key (see utils/auditLogger.js)
  SETTINGS:      'cgms_settings',       // Platform-level settings (SuperAdmin) — object, not a collection
  ORG_SETTINGS:  'cgms_org_settings_v1', // Module 8 — per-org settings map { [orgId]: {...} }
  SUBSCRIPTION_PLANS: 'cgms_subscription_plans', // Super-Admin-created plans (merged with defaults)
  ANNOUNCEMENTS:      'cgms_announcements',      // Super-Admin platform-wide broadcasts
  PLATFORM_SETTINGS:  'cgms_platform_settings',  // Super-Admin platform-level config (Phase A)
  ACCESS_REQUESTS:    'cgms_access_requests_v1', // Public "Request Organisation Access" inbox
  REFERRALS:          'cgms_referrals_v1',       // Referral records: { id, referredUserId, referredBy, status, reward, createdAt, convertedAt }
  SUBSCRIPTIONS:      'cgms_subscriptions_v1',   // Subscription records per org with embedded payment history
});
