import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area,
} from 'recharts';
import {
  Badge, MOCK_SERVICES, MOCK_WALKINS, MOCK_APPOINTMENTS, MOCK_ROOMS,
  VISITOR_CHART_DATA, MONTHLY_DATA,
} from '../../data/mockData';
import { useCollection, STORAGE_KEYS } from '../../store';
import { to12Hour } from '../../utils/datetime';

const CARD = {
  background: '#fff',
  borderRadius: 14,
  padding: '18px 20px',
  boxShadow: '0 1px 6px rgba(2,132,199,0.07)',
  border: '1px solid #BAE6FD',
};

const STAT_COLORS = ['#0284C7', '#0891B2', '#059669', '#D97706', '#EF4444', '#0EA5E9'];

export default function DirectorDashboard({ setActivePage, currentUser }) {
  const [services]     = useCollection(STORAGE_KEYS.SERVICES,     MOCK_SERVICES);
  const [walkins]      = useCollection(STORAGE_KEYS.WALKINS,      MOCK_WALKINS);
  const [appointments] = useCollection(STORAGE_KEYS.APPOINTMENTS, MOCK_APPOINTMENTS);

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const stats = [
    { label: 'Total Guests Today',     value: walkins.length + appointments.length,                     icon: '👥', page: 'guest-log'    },
    { label: 'Confirmed Appointments', value: appointments.filter(a => a.status === 'confirmed').length, icon: '📅', page: 'appointments' },
    { label: 'Rooms Occupied',         value: MOCK_ROOMS.filter(r => r.status === 'occupied').length,   icon: '🏢', page: 'rooms'        },
    { label: 'Service Requests',       value: services.length,                                          icon: '🛎️', page: 'services'     },
    { label: 'Pending Services',       value: services.filter(s => s.status === 'Pending').length,      icon: '⏳', page: 'services'     },
    { label: 'Walk-ins Today',         value: walkins.length,                                            icon: '🚶', page: 'walkin'       },
  ];

  return (
    <div className="flex w-full min-w-0 flex-col"
         style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* ── Header ── */}
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <span className="text-3xl">👑</span>
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-[#0C2340] m-0">
              Good Morning, {currentUser?.name || 'Director'}
            </h2>
            <p className="text-sm text-[#94A3B8] mt-1">{today} — Full Platform Overview</p>
          </div>
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-sky-50 border border-sky-200 text-xs text-sky-700 font-bold mt-1">
          {currentUser?.icon} {currentUser?.label} · {currentUser?.badge}
        </div>
      </div>

      {/* ── Stats Grid ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {stats.map((s, i) => (
          <div
            key={s.label}
            onClick={() => setActivePage(s.page)}
            className="rounded-[14px] cursor-pointer transition-all duration-200 hover:-translate-y-1"
            style={{
              ...CARD,
              borderLeft: `4px solid ${STAT_COLORS[i]}`,
            }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 8px 24px ${STAT_COLORS[i]}22`; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 6px rgba(2,132,199,0.07)'; }}
          >
            <div className="text-2xl mb-2">{s.icon}</div>
            <div className="text-2xl sm:text-3xl font-black leading-none" style={{ color: STAT_COLORS[i], fontFamily: 'Outfit,sans-serif' }}>
              {s.value}
            </div>
            <div className="text-[11px] text-[#94A3B8] mt-1 font-medium leading-tight">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Charts ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        <div style={CARD}>
          <h3 className="text-sm font-bold text-[#0C2340] mb-4">📊 Weekly Visitor Trend</h3>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={VISITOR_CHART_DATA}>
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9B99C4' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9B99C4' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #BAE6FD', fontSize: 12 }} />
              <Area type="monotone" dataKey="visitors" stroke="#0EA5E9" fill="#E0F2FE" strokeWidth={2.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div style={CARD}>
          <h3 className="text-sm font-bold text-[#0C2340] mb-4">📈 Monthly Summary</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={MONTHLY_DATA}>
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9B99C4' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9B99C4' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #BAE6FD', fontSize: 12 }} />
              <Bar dataKey="guests" fill="#0EA5E9" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Lists ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div style={CARD}>
          <h3 className="text-sm font-bold text-[#0C2340] mb-3">🚶 Recent Walk-ins</h3>
          {walkins.length === 0 ? (
            <p className="text-[12px] text-slate-400 py-2">No walk-ins recorded yet.</p>
          ) : walkins.slice(0, 5).map((w, i) => (
            <div key={w.id} className="flex justify-between items-center py-2.5"
                 style={{ borderBottom: i < 4 ? '1px solid #E0F2FE' : 'none' }}>
              <div className="min-w-0 mr-2">
                <div className="text-[13px] font-semibold text-[#0C2340] truncate">{w.name}</div>
                <div className="text-[11px] text-[#9B99C4]">{w.company || '—'}</div>
              </div>
              <Badge status={w.status} />
            </div>
          ))}
          <button onClick={() => setActivePage('walkin')}
                  className="mt-3 text-xs text-sky-500 font-bold bg-transparent border-0 cursor-pointer w-full text-left hover:text-sky-700 transition-colors">
            View All Walk-ins →
          </button>
        </div>

        <div style={CARD}>
          <h3 className="text-sm font-bold text-[#0C2340] mb-3">📅 Upcoming Appointments</h3>
          {appointments.length === 0 ? (
            <p className="text-[12px] text-slate-400 py-2">No appointments scheduled yet.</p>
          ) : appointments.slice(0, 5).map((a, i) => (
            <div key={a.id} className="flex justify-between items-center py-2.5"
                 style={{ borderBottom: i < 4 ? '1px solid #E0F2FE' : 'none' }}>
              <div className="min-w-0 mr-2">
                <div className="text-[13px] font-semibold text-[#0C2340] truncate">{a.visitorName}</div>
                <div className="text-[11px] text-[#9B99C4]">
                  {(to12Hour(a.time) || a.time)}{a.room ? ` · ${a.room}` : ''}
                </div>
              </div>
              <Badge status={a.status} />
            </div>
          ))}
          <button onClick={() => setActivePage('appointments')}
                  className="mt-3 text-xs text-sky-500 font-bold bg-transparent border-0 cursor-pointer w-full text-left hover:text-sky-700 transition-colors">
            View All Appointments →
          </button>
        </div>
      </div>
    </div>
  );
}