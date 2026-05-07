import React from 'react';

const STATUS_TONE = {
  Available:            'border-emerald-200 bg-emerald-50 text-emerald-700',
  Occupied:             'border-red-200 bg-red-50 text-red-700',
  'Under Maintenance':  'border-amber-200 bg-amber-50 text-amber-700',
};

export function RoomStatusPill({ status }) {
  const cls = STATUS_TONE[status] || 'border-slate-200 bg-slate-100 text-slate-600';
  return (
    <span className={`inline-flex whitespace-nowrap items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${cls}`}>
      {status}
    </span>
  );
}

export default function RoomCard({ room, todaysBookings = 0, onBook, onToggleMaintenance }) {
  const isMaintenance = room.status === 'Under Maintenance';
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="truncate text-sm font-bold text-slate-800">{room.name}</h4>
          <p className="text-xs text-slate-500">
            {room.floor || '—'} · Capacity: {room.capacity}
          </p>
        </div>
        <RoomStatusPill status={room.status} />
      </div>

      {Array.isArray(room.amenities) && room.amenities.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {room.amenities.map((a) => (
            <span
              key={a}
              className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-600"
            >
              {a}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between text-xs">
        <span className="text-slate-500">
          {todaysBookings === 0
            ? 'No bookings today'
            : `${todaysBookings} booking${todaysBookings > 1 ? 's' : ''} today`}
        </span>
        <div className="flex gap-2">
          {onToggleMaintenance && (
            <button
              type="button"
              onClick={() => onToggleMaintenance(room)}
              className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
            >
              {isMaintenance ? 'Mark Available' : 'Maintenance'}
            </button>
          )}
          <button
            type="button"
            onClick={() => onBook?.(room)}
            disabled={isMaintenance}
            className="rounded-md border border-sky-700 bg-sky-700 px-3 py-1 text-[11px] font-semibold text-white transition hover:bg-sky-800 disabled:opacity-50"
          >
            Book
          </button>
        </div>
      </div>
    </div>
  );
}
