export const ROOM_STATUSES = ['Available', 'Occupied', 'Under Maintenance'];

export const BOOKING_STATUSES = ['Confirmed', 'Cancelled', 'Completed'];

export const MOCK_ROOMS = [
  { id: 'room-1', name: 'Board Room A',      capacity: 12, floor: '3rd Floor', status: 'Available',         amenities: ['Projector', 'Whiteboard', 'Video Conf'], orgId: 'org-1' },
  { id: 'room-2', name: 'Conference Room 1', capacity: 8,  floor: '2nd Floor', status: 'Available',         amenities: ['Projector', 'Whiteboard'],               orgId: 'org-1' },
  { id: 'room-3', name: 'Board Room B',      capacity: 10, floor: '3rd Floor', status: 'Available',         amenities: ['Projector', 'Video Conf'],               orgId: 'org-1' },
  { id: 'room-4', name: 'Meeting Room 1',    capacity: 4,  floor: '1st Floor', status: 'Available',         amenities: ['TV Screen'],                             orgId: 'org-1' },
  { id: 'room-5', name: 'Meeting Room 2',    capacity: 4,  floor: '1st Floor', status: 'Available',         amenities: ['TV Screen'],                             orgId: 'org-1' },
  { id: 'room-6', name: 'Training Hall',     capacity: 30, floor: '4th Floor', status: 'Under Maintenance', amenities: ['Projector', 'PA System'],                orgId: 'org-1' },
  /* Emirates Group (org-3) — shows multi-tenant room isolation. */
  { id: 'room-7', name: 'Skyline Boardroom', capacity: 14, floor: 'Top Floor', status: 'Available',         amenities: ['Projector', 'Video Conf'],               orgId: 'org-3' },
];

/**
 * Booking shape:
 *   {
 *     id,
 *     roomId, roomName,
 *     date:       'YYYY-MM-DD',
 *     startTime:  'HH:mm' (24h),
 *     endTime:    'HH:mm' (24h),
 *     bookedBy:   display name (creator or visitor),
 *     purpose?:   free text,
 *     appointmentId?: linked appointment id,
 *     status:     'Confirmed' | 'Cancelled' | 'Completed',
 *     createdAt:  ISO
 *   }
 */
export const MOCK_BOOKINGS = [];
