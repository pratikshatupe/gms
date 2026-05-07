export const SERVICE_STATUSES = ['Pending', 'In Progress', 'Completed'];

export const SERVICE_TYPES = [
  'Tea',
  'Coffee',
  'Water',
  'Snacks',
  'Lunch',
  'Parking',
  'Projector Setup',
  'AV Equipment',
  'Wi-Fi Access',
  'Other',
];

/**
 * Canonical service shape:
 *   {
 *     id,
 *     visitorName:     string (mirrored from guest-log entry),
 *     visitorLogId?:   guest-log entry id (optional for legacy seed rows),
 *     serviceType:     one of SERVICE_TYPES,
 *     assignedStaffId: staff id,
 *     assignedStaff:   staff name,
 *     notes?:          string,
 *     status:          one of SERVICE_STATUSES,
 *     createdAt:       ISO,
 *     startedAt?:      ISO,
 *     completedAt?:    ISO
 *   }
 *
 * Seed rows below are for demo only — real rows are created via the form.
 */
const nowIso = () => new Date().toISOString();

export const MOCK_SERVICES = [
  {
    id: 'svc-1',
    visitorName: 'Nikhil Verma',
    visitorLogId: null,
    serviceType: 'Tea',
    assignedStaffId: 'staff-4',
    assignedStaff: 'Rahul Patil',
    notes: 'Guest waiting in reception.',
    status: 'Pending',
    createdAt: nowIso(),
    orgId: 'org-1',
  },
];
