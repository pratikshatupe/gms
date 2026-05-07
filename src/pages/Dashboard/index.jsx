import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Building2, BadgeCheck } from 'lucide-react';
import { isToday } from '../../utils/storage';
import { useCollection, STORAGE_KEYS } from '../../store';
import { orgNameFor, roleLabel } from '../../utils/sessionContext';
import DirectorDashboard from './DirectorDashboard';

const MOCK_VISITORS = [
  { id: 1, name: 'Ahmed Al Rashid', company: 'Emirates Group', status: 'inside', date: '2026-04-16', purpose: 'Meeting', checkin: '09:15' },
  { id: 2, name: 'Sarah Johnson', company: 'McKinsey', status: 'checked-out', date: '2026-04-16', purpose: 'Consultation', checkin: '10:00' },
  { id: 3, name: 'Fatima Al Zaabi', company: 'ADNOC', status: 'expected', date: '2026-04-16', purpose: 'Site Visit', checkin: '14:00' },
  { id: 4, name: 'Rajesh Patel', company: 'TCS', status: 'inside', date: '2026-04-16', purpose: 'Interview', checkin: '11:30' },
  { id: 5, name: 'Maria Lopez', company: 'Google', status: 'expected', date: '2026-04-16', purpose: 'Demo', checkin: '15:30' },
];

const VISITOR_CHART_DATA = [
  { day: 'Mon', walkin: 12, appointed: 8 },
  { day: 'Tue', walkin: 15, appointed: 10 },
  { day: 'Wed', walkin: 18, appointed: 12 },
  { day: 'Thu', walkin: 14, appointed: 15 },
  { day: 'Fri', walkin: 20, appointed: 18 },
  { day: 'Sat', walkin: 8, appointed: 5 },
  { day: 'Sun', walkin: 6, appointed: 4 },
];

const MONTHLY_DATA = [
  { month: 'Oct', visitors: 120 },
  { month: 'Nov', visitors: 145 },
  { month: 'Dec', visitors: 180 },
  { month: 'Jan', visitors: 210 },
  { month: 'Feb', visitors: 195 },
  { month: 'Mar', visitors: 230 },
];

const MOCK_ROOMS = [
  { id: 1, name: 'Board Room A', office: 'Dubai HQ', capacity: 12, status: 'occupied' },
  { id: 2, name: 'Conf Room 1', office: 'Dubai HQ', capacity: 8, status: 'available' },
  { id: 3, name: 'Board Room B', office: 'Dubai HQ', capacity: 10, status: 'reserved' },
  { id: 4, name: 'Training Room', office: 'Dubai HQ', capacity: 20, status: 'available' },
  { id: 5, name: 'AV Studio', office: 'Dubai HQ', capacity: 6, status: 'under-maintenance' },
];

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-[12px] px-3 py-2.5 shadow-lg text-[12px] font-[system-ui,sans-serif]">
      <div className="text-slate-400 mb-1.5">{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color }} className="font-semibold">
          {p.name}: <span className="text-slate-700">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

const statusStyle = {
  inside: { label: 'Inside', color: '#15803D', bg: '#ECFDF5', border: '#86EFAC' },
  'checked-out': { label: 'Checked Out', color: '#6B7280', bg: '#F9FAFB', border: '#E5E7EB' },
  expected: { label: 'Expected', color: '#0EA5E9', bg: '#E0F2FE', border: '#BAE6FD' },
  'no-show': { label: 'No Show', color: '#DC2626', bg: '#FEF2F2', border: '#FCA5A5' },
};

export default function Dashboard({ user, setActivePage }) {
  const role = (user?.role || '').toLowerCase();

  /* Director gets their own dedicated dashboard */
  if (role === 'director') {
    return <DirectorDashboard setActivePage={setActivePage} currentUser={user} />;
  }

  const navigate = useNavigate();
  const [liveWalkins] = useCollection(STORAGE_KEYS.WALKINS,  []);
  const [liveBookings] = useCollection(STORAGE_KEYS.BOOKINGS, []);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isTablet, setIsTablet] = useState(window.innerWidth < 1100);

  useEffect(() => {
    const h = () => {
      setIsMobile(window.innerWidth < 768);
      setIsTablet(window.innerWidth < 1100);
    };
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  const liveCount = useMemo(
    () => liveBookings.filter(b => b?.status === 'New').length + liveWalkins.length,
    [liveBookings, liveWalkins],
  );

  /* Today = live walkins created today (by createdAt ISO) + seed demo rows for the seed demo date */
  const { today, inside, expected, allRecent } = useMemo(() => {
    const walkinsToday = liveWalkins.filter(v => isToday(v.createdAt));
    const seedToday = MOCK_VISITORS.filter(v => v.date === '2026-04-16');
    const merged = [...walkinsToday, ...seedToday];
    const recent = [
      ...liveWalkins.slice(0, 3).map(w => ({ ...w, _live: true })),
      ...seedToday.slice(0, 6),
    ].slice(0, 6);
    return {
      today:    merged,
      inside:   merged.filter(v => v.status === 'inside'),
      expected: merged.filter(v => v.status === 'expected'),
      allRecent: recent,
    };
  }, [liveWalkins]);
  const available = MOCK_ROOMS.filter(r => r.status === 'available');

  const metrics = [
    { label: 'Visitors Today', value: today.length, sub: '↑ 18% from yesterday', color: '#0284C7', icon: '👥' },
    { label: 'Currently Inside', value: inside.length, sub: 'Real-time tracking', color: '#15803D', icon: '📍' },
    { label: 'Expected Today', value: expected.length, sub: 'Next 24 hours', color: '#B45309', icon: '⏰' },
    { label: 'Rooms Available', value: available.length, sub: `of ${MOCK_ROOMS.length} total`, color: '#0369A1', icon: '🏠' },
  ];

  const roomColors = {
    available: '#15803D',
    occupied: '#DC2626',
    reserved: '#B45309',
    'under-maintenance': '#6B7280',
  };

  const companyName = orgNameFor(user);
  const roleDisplay = roleLabel(user?.role);

  return (
    <div className="flex w-full min-w-0 flex-col bg-slate-50">

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-[Outfit,sans-serif] text-[20px] font-extrabold text-[#0C2340] mb-1">
            Good morning{user?.name ? `, ${user.name.split(' ')[0]}!` : ''} 👋
          </h2>
          <p className="text-[13px] text-slate-400 font-medium">
            Thursday, April 16 · Dubai HQ ·{' '}
            <span className="text-sky-500 font-semibold">Live Data</span>
          </p>
        </div>
        {liveCount > 0 && (
          <button
            onClick={() => navigate('/notifications')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-[10px] border border-red-200 bg-red-50 text-red-600 font-bold text-[13px] hover:bg-red-100 transition"
          >
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
            {liveCount} new alert{liveCount !== 1 ? 's' : ''}
          </button>
        )}
      </div>

      {/* Session context — Current Company / Current Role */}
      <div className="mb-6 flex flex-wrap items-stretch gap-3">
        <div className="flex flex-1 min-w-[220px] items-center gap-3 rounded-[14px] border border-sky-100 bg-white p-3.5 shadow-sm">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[10px] bg-sky-50 text-sky-600">
            <Building2 size={18} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Current Company</div>
            <div className="truncate text-[14px] font-extrabold text-[#0C2340]" title={companyName}>{companyName}</div>
          </div>
        </div>
        <div className="flex flex-1 min-w-[220px] items-center gap-3 rounded-[14px] border border-amber-100 bg-white p-3.5 shadow-sm">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[10px] bg-amber-50 text-amber-600">
            <BadgeCheck size={18} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Current Role</div>
            <div className="truncate text-[14px] font-extrabold text-[#0C2340]" title={roleDisplay}>{roleDisplay}</div>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="bg-white border border-slate-200 rounded-[14px] shadow-sm hover:shadow-md transition p-5 relative overflow-hidden"
          >
            <div
              className="absolute inset-0 opacity-[0.04] pointer-events-none"
              style={{ background: `radial-gradient(circle at top right, ${m.color}, transparent 60%)` }}
            />
            <div className="flex justify-between items-start mb-3">
              <div
                className="w-11 h-11 rounded-[10px] flex items-center justify-center text-xl"
                style={{ background: `${m.color}14`, border: `1px solid ${m.color}20` }}
              >
                {m.icon}
              </div>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">
                ● Live
              </span>
            </div>
            <div className="font-[Outfit,sans-serif] text-[32px] font-extrabold text-[#0C2340] leading-none mb-1">
              {m.value}
            </div>
            <div className="text-[13px] font-semibold text-slate-600 mb-0.5">{m.label}</div>
            <div className="text-[12px] font-semibold" style={{ color: m.color }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className={`grid ${isTablet ? 'grid-cols-1' : 'grid-cols-2'} gap-4 mb-6`}>
        <div className="bg-white border border-slate-200 rounded-[14px] shadow-sm hover:shadow-md transition p-5" style={{ height: 280 }}>
          <div className="mb-4">
            <div className="font-[Outfit,sans-serif] text-[15px] font-extrabold text-[#0C2340]">Weekly Traffic</div>
            <div className="text-[12px] text-slate-400">Walk-ins vs Appointments</div>
          </div>
          <ResponsiveContainer width="100%" height="80%">
            <BarChart data={VISITOR_CHART_DATA} barSize={18} barGap={4}>
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94A3B8', fontWeight: 600 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94A3B8', fontWeight: 600 }} axisLine={false} tickLine={false} width={32} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(14,165,233,0.06)' }} />
              <Bar dataKey="walkin" fill="#0284C7" radius={[6, 6, 0, 0]} name="Walk-in" />
              <Bar dataKey="appointed" fill="#10B981" radius={[6, 6, 0, 0]} name="Appointed" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border border-slate-200 rounded-[14px] shadow-sm hover:shadow-md transition p-5" style={{ height: 280 }}>
          <div className="mb-4">
            <div className="font-[Outfit,sans-serif] text-[15px] font-extrabold text-[#0C2340]">Monthly Growth</div>
            <div className="text-[12px] text-slate-400">6-month visitor trend</div>
          </div>
          <ResponsiveContainer width="100%" height="80%">
            <AreaChart data={MONTHLY_DATA}>
              <defs>
                <linearGradient id="dashGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0284C7" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#0284C7" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94A3B8', fontWeight: 600 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94A3B8', fontWeight: 600 }} axisLine={false} tickLine={false} width={32} />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey="visitors"
                stroke="#0284C7"
                strokeWidth={2.5}
                fill="url(#dashGrad)"
                name="Visitors"
                dot={{ fill: '#0284C7', strokeWidth: 2, r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Visitors — full width so the table never stretches against
           the side panels and leaves blank space below itself. */}
      <div className="w-full min-w-0 mb-6">
        <div className="bg-white border border-slate-200 rounded-[14px] shadow-sm hover:shadow-md transition overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
            <div className="font-[Outfit,sans-serif] text-[15px] font-extrabold text-[#0C2340]">Recent Visitors</div>
            <button
              onClick={() => navigate('/guest-logs')}
              className="px-4 py-2 rounded-[10px] border border-slate-200 bg-white text-slate-700 text-[12px] font-semibold hover:bg-slate-50 transition"
            >
              View All →
            </button>
          </div>

          {isMobile ? (
            <div className="p-4 flex flex-col gap-3">
              {allRecent.slice(0, 4).map(v => {
                const s = statusStyle[v.status] || statusStyle.expected;
                const initials = v.name?.split(' ').slice(0, 2).map(n => n[0]).join('').slice(0, 2) || 'VD';
                return (
                  <div
                    key={v.id}
                    className="flex items-center gap-3 p-3 rounded-[10px] border border-slate-100"
                    style={{ background: v._live ? '#E0F2FE' : '#FAFAFA' }}
                  >
                    <div
                      className="w-10 h-10 rounded-[10px] flex items-center justify-center text-[12px] font-bold shrink-0"
                      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
                    >
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-bold text-[#0C2340] truncate">{v.name}</div>
                      <div className="text-[11px] text-slate-400">{v.company} · {v.purpose}</div>
                    </div>
                    <span
                      className="text-[10px] font-bold px-2 py-1 rounded-full shrink-0"
                      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
                    >
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <>
            {/* Desktop table */}
            <div className="hidden sm:block w-full">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">Visitor</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">Purpose</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400 w-24">Check-in</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400 w-32">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {allRecent.map(v => {
                    const s = statusStyle[v.status] || statusStyle.expected;
                    const initials = v.name?.split(' ').slice(0, 2).map(n => n[0]).join('').slice(0, 2) || 'VD';
                    return (
                      <tr key={v.id} className="border-t border-slate-100 hover:bg-slate-50 transition" style={{ background: v._live ? 'rgba(14,165,233,0.03)' : 'transparent' }}>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-[8px] flex items-center justify-center text-[11px] font-bold shrink-0" style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>{initials}</div>
                            <div><div className="text-[13px] font-bold text-[#0C2340]">{v.name}</div><div className="text-[11px] text-slate-400">{v.company}</div></div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-[13px] text-slate-600">{v.purpose || 'Meeting'}</td>
                        <td className="px-4 py-3.5 font-mono text-[12px] font-semibold text-slate-600">{v.checkin || '—'}</td>
                        <td className="px-4 py-3.5"><span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>{s.label}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Mobile cards */}
            <div className="block sm:hidden divide-y divide-slate-100">
              {allRecent.map(v => {
                const s = statusStyle[v.status] || statusStyle.expected;
                const initials = v.name?.split(' ').slice(0, 2).map(n => n[0]).join('').slice(0, 2) || 'VD';
                return (
                  <div key={v.id} className="px-4 py-3 flex items-center gap-3" style={{ background: v._live ? 'rgba(14,165,233,0.03)' : 'transparent' }}>
                    <div className="w-9 h-9 rounded-[8px] flex items-center justify-center text-[11px] font-bold shrink-0" style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>{initials}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-bold text-[#0C2340] truncate">{v.name}</div>
                      <div className="text-[11px] text-slate-400">{v.purpose || 'Meeting'} · {v.checkin || '—'}</div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>{s.label}</span>
                  </div>
                );
              })}
            </div>
            </>
          )}
        </div>
      </div>

      {/* Side panels — Quick Actions / Room Status / Top Utilised
           split into a responsive grid so each card sizes to its content
           and no column drags the row taller than it needs to be. */}
      <div className="grid w-full min-w-0 gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 items-start">

          {/* Quick Actions */}
          <div className="bg-white border border-slate-200 rounded-[14px] shadow-sm hover:shadow-md transition p-5">
            <div className="font-[Outfit,sans-serif] text-[15px] font-extrabold text-[#0C2340] mb-4">Quick Actions</div>
            <div className={`grid ${isTablet && !isMobile ? 'grid-cols-2' : 'grid-cols-1'} gap-2.5`}>
              {[
                { icon: '🚶', label: 'New Walk-in', page: '/walkin', color: '#0284C7' },
                { icon: '📅', label: 'Appointments', page: '/appointments', color: '#15803D' },
                { icon: '⚙️', label: 'Services', page: '/services', color: '#B45309' },
                { icon: '📊', label: 'Reports', page: '/reports', color: '#0369A1' },
              ].map(action => (
                <button
                  key={action.label}
                  onClick={() => navigate(action.page)}
                  className="flex items-center gap-3 p-3.5 rounded-[10px] border border-slate-200 bg-white text-left hover:bg-slate-50 hover:border-sky-200 transition group"
                >
                  <div
                    className="w-10 h-10 rounded-[8px] flex items-center justify-center text-[17px] shrink-0"
                    style={{ background: `${action.color}12`, border: `1px solid ${action.color}20` }}
                  >
                    {action.icon}
                  </div>
                  <span className="text-[13px] font-semibold text-slate-700 flex-1">{action.label}</span>
                  <span className="text-[16px] text-slate-300 group-hover:text-sky-500 transition">→</span>
                </button>
              ))}
            </div>
          </div>

          {/* Room Status */}
          <div className="bg-white border border-slate-200 rounded-[14px] shadow-sm hover:shadow-md transition p-5">
            <div className="flex justify-between items-center mb-4">
              <div className="font-[Outfit,sans-serif] text-[15px] font-extrabold text-[#0C2340]">Room Status</div>
              <button
                onClick={() => navigate('/rooms')}
                className="px-3 py-1.5 rounded-[8px] border border-slate-200 bg-white text-slate-600 text-[11px] font-semibold hover:bg-slate-50 transition"
              >
                All Rooms →
              </button>
            </div>
            <div className="flex flex-col gap-2.5">
              {MOCK_ROOMS.slice(0, 5).map(room => {
                const color = roomColors[room.status] || '#6B7280';
                return (
                  <div
                    key={room.id}
                    className="flex justify-between items-center p-3 rounded-[10px] border"
                    style={{ borderColor: `${color}20`, background: `${color}04` }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-semibold text-[#0C2340] truncate">{room.name}</div>
                      <div className="text-[11px] text-slate-400">{room.office} · Cap {room.capacity}</div>
                    </div>
                    <span
                      className="text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 ml-2"
                      style={{ background: `${color}12`, color, border: `1px solid ${color}25` }}
                    >
                      {room.status.replace('-', ' ')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Utilised Rooms — links to Reports (Rule 67). */}
          <div className="bg-white border border-slate-200 rounded-[14px] shadow-sm hover:shadow-md transition p-5">
            <div className="flex justify-between items-center mb-4">
              <div className="font-[Outfit,sans-serif] text-[15px] font-extrabold text-[#0C2340]">Top Utilised Rooms</div>
              <button
                onClick={() => navigate('/reports#room-utilisation')}
                className="px-3 py-1.5 rounded-[8px] border border-slate-200 bg-white text-slate-600 text-[11px] font-semibold hover:bg-slate-50 transition"
                title="Open full utilisation report"
              >
                Report →
              </button>
            </div>
            <div className="flex flex-col gap-2.5">
              {(() => {
                /* Deterministic weekly-occupancy approximation — same formula
                 * the Reports page uses so both surfaces agree. */
                const weeklyHours = 45;
                const score = (r) => {
                  const seed = (r.name || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
                  const base = r.status === 'occupied' ? 0.85 : r.status === 'reserved' ? 0.65 : r.status === 'under-maintenance' ? 0 : 0.35;
                  const jitter = ((seed % 7) - 3) / 45;
                  return Math.max(0, Math.min(1, base + jitter));
                };
                return [...MOCK_ROOMS]
                  .map((r) => ({ ...r, pct: Math.round(score(r) * 100), hours: Math.round(score(r) * weeklyHours) }))
                  .sort((a, b) => b.pct - a.pct)
                  .slice(0, 3)
                  .map((room) => (
                    <div key={room.id} className="rounded-[10px] border border-slate-100 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-semibold text-[#0C2340]">{room.name}</div>
                          <div className="text-[11px] text-slate-400">{room.office} · {room.hours}h this week</div>
                        </div>
                        <span className="shrink-0 text-[12px] font-bold text-sky-700">{room.pct}%</span>
                      </div>
                      <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-sky-500" style={{ width: `${room.pct}%` }} />
                      </div>
                    </div>
                  ));
              })()}
            </div>
          </div>
      </div>
    </div>
  );
}