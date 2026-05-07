const nowIso = () => new Date().toISOString();

function makeId(prefix = 'id') {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const rangesOverlap = (aStart, aEnd, bStart, bEnd) =>
  aStart < bEnd && bStart < aEnd;

export function findConflictImpl(draft, skipId, bookings) {
  return bookings.find((b) =>
    b.id !== skipId &&
    b.status !== 'Cancelled' &&
    b.roomId === draft.roomId &&
    b.date === draft.date &&
    rangesOverlap(draft.startTime, draft.endTime, b.startTime, b.endTime),
  ) || null;
}

export function createBookingImpl(form, { setBookings, rooms, findConflict, resolveOrgId, notify, addNotification, addLog, guard }) {
  guard('rooms', 'create');
  const room = rooms.find((r) => r.id === form.roomId);
  if (!room) {
    notify('Select a valid room.', 'error');
    return null;
  }
  if ((room.status || '').toLowerCase() === 'under maintenance') {
    notify('This room is under maintenance.', 'error');
    return null;
  }
  if (!form.date || !form.startTime || !form.endTime) {
    notify('Please fill date and time.', 'error');
    return null;
  }
  if (form.startTime >= form.endTime) {
    notify('End time must be later than start time.', 'error');
    return null;
  }
  if (!(form.bookedBy || '').trim()) {
    notify('Please enter who the booking is for.', 'error');
    return null;
  }
  const draft = {
    roomId:    room.id,
    roomName:  room.name,
    date:      form.date,
    startTime: form.startTime,
    endTime:   form.endTime,
  };
  const clash = findConflict(draft);
  if (clash) {
    notify(
      `Double booking: ${room.name} is already reserved ${clash.startTime}–${clash.endTime} on ${clash.date}.`,
      'error',
    );
    return null;
  }
  const next = {
    id: makeId('bk'),
    ...draft,
    bookedBy:      form.bookedBy.trim(),
    purpose:       (form.purpose || '').trim(),
    appointmentId: form.appointmentId || null,
    status:        'Confirmed',
    createdAt:     nowIso(),
    orgId:         room.orgId || resolveOrgId(),
  };
  setBookings((prev) => [next, ...prev]);
  notify(`Booking confirmed: ${room.name} on ${next.date}.`, 'success');
  addNotification({
    message: `Room booked: ${room.name} on ${next.date} at ${next.startTime} for ${next.bookedBy}.`,
    type: 'appointment',
  });
  addLog({
    action:   'Room Booking Created',
    module:   'Rooms',
    metadata: {
      room:      room.name,
      date:      next.date,
      time:      `${next.startTime}–${next.endTime}`,
      bookedBy:  next.bookedBy,
    },
  });
  return next;
}

export function cancelBookingImpl(id, { setBookings, notify, addLog, guard }) {
  guard('rooms', 'edit');
  setBookings((prev) => {
    const bk = prev.find((b) => b.id === id);
    if (!bk || bk.status === 'Cancelled') return prev;
    addLog({
      action:   'Room Booking Cancelled',
      module:   'Rooms',
      metadata: { room: bk.roomName, date: bk.date, bookedBy: bk.bookedBy },
    });
    notify(`Booking cancelled: ${bk.roomName} on ${bk.date}.`, 'warn');
    return prev.map((b) => (b.id === id ? { ...b, status: 'Cancelled' } : b));
  });
}

export function deleteBookingImpl(id, { setBookings, notify, addLog, guard }) {
  guard('rooms', 'delete');
  setBookings((prev) => {
    const bk = prev.find((b) => b.id === id);
    if (bk) {
      addLog({
        action:   'Room Booking Deleted',
        module:   'Rooms',
        metadata: { room: bk.roomName, date: bk.date, bookedBy: bk.bookedBy },
      });
    }
    return prev.filter((b) => b.id !== id);
  });
  notify('Booking removed.', 'success');
}

export function updateRoomStatusImpl(id, status, { setRooms, notify, addLog, guard }) {
  guard('rooms', 'edit');
  setRooms((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
  notify('Room status updated.', 'success');
  addLog({
    action:   'Room Status Updated',
    module:   'Rooms',
    metadata: { roomId: id, status },
  });
}
