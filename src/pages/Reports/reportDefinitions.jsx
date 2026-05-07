import React from 'react';
import {
  UserRound, CalendarDays, Users, DoorOpen, Sparkles, Shield,
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import {
  buildTodayVisitorReport, buildWeeklySummary, buildStaffPerformance,
  buildRoomUtilisation, buildServiceUsage,
} from '../../utils/reportAnalytics';
import {
  formatDateGB, formatDateTime, to12hAmPm, displayStatus,
  getTimezoneAbbr,
} from '../../utils/appointmentState';
import { pdfStatusPill } from '../../utils/reportExporters';

/**
 * reportDefinitions — declarative registry of the 6 reports.
 *
 * Each entry:
 *   {
 *     key, title, description, Icon,
 *     category: 'core' | 'stretch',
 *     defaultRange: 'today' | 'week' | 'last30' | 'last7',
 *     lockedRange?: boolean,
 *     hasChart: boolean,
 *     permissionsNote?: string,
 *     externalLink?: { page, queryParams },   // delegated reports (Audit)
 *     build: (appointments, ctx) => reportData,
 *     renderSummary: (data, ctx) => JSX,
 *     renderCharts:  (data, ctx) => JSX | null,
 *     renderTable:   (data, ctx) => JSX,
 *     csvColumns:    [{ key, label, getter, format? }],
 *     pdfColumns:    [{ key, label, width, getter, format? }],
 *   }
 *
 * Add a new report by pushing one more entry to this file. No other
 * file changes required.
 */

const PIE_COLORS = ['#0EA5E9', '#2563EB', '#10B981', '#F59E0B', '#EF4444', '#06B6D4', '#94A3B8'];

export const REPORT_REGISTRY = [
  /* 1. TODAY'S VISITOR REPORT ─────────────────────────────────── */
  {
    key: 'today-visitors',
    title: "Today's Visitor Report",
    description: 'Hourly arrival pattern, top hosts and offices, average visit duration.',
    Icon: UserRound,
    category: 'core',
    defaultRange: 'today',
    lockedRange: false,
    hasChart: true,
    build: (appointments, ctx) => buildTodayVisitorReport(appointments, ctx),
    renderSummary: (data) => (
      <>
        <Kpi label="Total Visitors" value={data.kpis.totalVisitors} />
        <Kpi label="Walk-ins" value={data.kpis.walkIns} />
        <Kpi label="Completed" value={data.kpis.completed} />
        <Kpi label="Avg Duration (min)" value={data.kpis.avgDurationMin} />
        <Kpi label="Peak Hour" value={data.kpis.peakHourLabel || '—'} />
      </>
    ),
    renderCharts: (data, ctx) => {
      if (!data?.hourly?.some((h) => h.count > 0)) return <EmptyChart />;
      const activeHour = ctx?.tableFilter?.field === 'hour' ? ctx.tableFilter.value : null;
      const onBarClick = (bar) => {
        if (!bar || bar.count === 0) return;
        ctx?.setChartFilter?.({
          field: 'hour',
          value: bar.hour,
          label: `Hour: ${bar.label}`,
          predicate: (a) => {
            const t = a?.startTime || a?.time || '';
            if (!/^\d{2}:\d{2}$/.test(t)) return false;
            return Number(t.slice(0, 2)) === bar.hour;
          },
        });
      };
      return (
        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.hourly} margin={{ top: 8, right: 16, bottom: 0, left: -12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-[#142535]" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="currentColor" className="text-slate-400 dark:text-slate-500" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="currentColor" className="text-slate-400 dark:text-slate-500" />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(14,165,233,0.08)' }} />
              <Bar dataKey="count" name="Visitors" radius={[4, 4, 0, 0]} onClick={onBarClick} style={{ cursor: 'pointer' }}>
                {data.hourly.map((h) => (
                  <Cell
                    key={h.hour}
                    fill="#0EA5E9"
                    fillOpacity={activeHour == null || activeHour === h.hour ? 1 : 0.35}
                    stroke={activeHour === h.hour ? '#0284C7' : undefined}
                    strokeWidth={activeHour === h.hour ? 2 : 0}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    },
    renderTable: (data, ctx) => (
      <TodayVisitorTable data={data} ctx={ctx} />
    ),
    csvColumns: commonAppointmentCsvColumns(),
    pdfColumns: commonAppointmentPdfColumns(),
  },

  /* 2. WEEKLY SUMMARY ─────────────────────────────────────────── */
  {
    key: 'weekly-summary',
    title: 'Weekly Summary',
    description: '7-day visitor trend, status breakdown, visitor type mix and walk-in ratio.',
    Icon: CalendarDays,
    category: 'core',
    defaultRange: 'week',
    hasChart: true,
    build: (appointments, ctx) => buildWeeklySummary(appointments, ctx),
    renderSummary: (data) => (
      <>
        <Kpi label="Total Visitors" value={data.kpis.totalVisitors} />
        <Kpi label="Walk-ins" value={data.kpis.walkIns} />
        <Kpi label="Walk-in Ratio" value={`${data.kpis.walkInRatioPct}%`} />
        <Kpi label="Completed" value={data.kpis.completed} />
        <Kpi label="Cancelled" value={data.kpis.cancelled} />
      </>
    ),
    renderCharts: (data, ctx) => {
      if ((data?.dailyTrend || []).every((d) => d.count === 0)) return <EmptyChart />;
      const activeDate = ctx?.tableFilter?.field === 'date' ? ctx.tableFilter.value : null;
      const activeStatus = ctx?.tableFilter?.field === 'status' ? ctx.tableFilter.value : null;

      const onLineClick = (state) => {
        const p = state?.activePayload?.[0]?.payload;
        if (!p || !p.iso || p.count === 0) return;
        ctx?.setChartFilter?.({
          field: 'date',
          value: p.iso,
          label: `Date: ${p.label}`,
          predicate: (a) => (a?.scheduledDate || a?.date || '').slice(0, 10) === p.iso,
        });
      };

      const onPieClick = (slice) => {
        const payload = slice?.payload || slice;
        if (!payload || !payload.status || !payload.count) return;
        ctx?.setChartFilter?.({
          field: 'status',
          value: payload.status,
          label: `Status: ${payload.status}`,
          predicate: (a) => a?.status === payload.status,
        });
      };

      const renderDot = (props) => {
        const { cx, cy, payload } = props;
        const isActive = activeDate === payload?.iso;
        return (
          <circle
            cx={cx}
            cy={cy}
            r={isActive ? 5 : 3}
            fill="#fff"
            stroke={isActive ? '#0284C7' : '#0EA5E9'}
            strokeWidth={isActive ? 2.5 : 1.5}
            style={{ cursor: 'pointer' }}
          />
        );
      };

      return (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data.dailyTrend}
                margin={{ top: 8, right: 16, bottom: 0, left: -12 }}
                onClick={onLineClick}
                style={{ cursor: 'pointer' }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-[#142535]" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="currentColor" className="text-slate-400 dark:text-slate-500" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="currentColor" className="text-slate-400 dark:text-slate-500" />
                <Tooltip contentStyle={tooltipStyle} />
                <Line
                  type="monotone"
                  dataKey="count"
                  name="Visitors"
                  stroke={activeDate ? 'rgba(14,165,233,0.55)' : '#0EA5E9'}
                  strokeWidth={2.4}
                  dot={renderDot}
                  activeDot={{ r: 6, stroke: '#0284C7', strokeWidth: 2, fill: '#fff' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.statusBreakdown}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  outerRadius="70%"
                  innerRadius="40%"
                  paddingAngle={2}
                  onClick={onPieClick}
                  style={{ cursor: 'pointer' }}
                >
                  {data.statusBreakdown.map((entry, idx) => {
                    const isActive = activeStatus === entry.status;
                    const baseFill = PIE_COLORS[idx % PIE_COLORS.length];
                    return (
                      <Cell
                        key={entry.status}
                        fill={baseFill}
                        fillOpacity={activeStatus == null || isActive ? 1 : 0.35}
                        stroke={isActive ? '#0284C7' : '#fff'}
                        strokeWidth={isActive ? 2.5 : 1}
                      />
                    );
                  })}
                </Pie>
                <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    },
    renderTable: (data, ctx) => <WeeklySummaryTable data={data} ctx={ctx} />,
    csvColumns: commonAppointmentCsvColumns(),
    pdfColumns: commonAppointmentPdfColumns(),
  },

  /* 3. STAFF PERFORMANCE ──────────────────────────────────────── */
  {
    key: 'staff-performance',
    title: 'Staff Performance',
    description: 'Visits hosted, average duration, no-show rate and feedback rating per staff.',
    Icon: Users,
    category: 'core',
    defaultRange: 'last30',
    hasChart: true,
    build: (appointments, ctx) => buildStaffPerformance(appointments, ctx),
    renderSummary: (data) => (
      <>
        <Kpi label="Active Hosts" value={data.kpis.uniqueHosts} />
        <Kpi label="Visits Hosted" value={data.kpis.totalVisitsHosted} />
        <Kpi label="Avg Rating" value={data.kpis.avgRating != null ? data.kpis.avgRating.toFixed(1) : '—'} />
        <Kpi label="Total No-Shows" value={data.kpis.totalNoShows} />
      </>
    ),
    renderCharts: (data, ctx) => {
      if (!data?.top10?.length) return <EmptyChart />;
      const activeHost = ctx?.tableFilter?.field === 'hostName' ? ctx.tableFilter.value : null;
      const onBarClick = (bar) => {
        if (!bar || !bar.hostName || bar.visits === 0) return;
        ctx?.setChartFilter?.({
          field: 'hostName',
          value: bar.hostName,
          label: `Host: ${bar.hostName}`,
          predicate: (r) => r.hostName === bar.hostName,
        });
      };
      return (
        <div className="h-[360px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.top10} layout="vertical" margin={{ top: 8, right: 16, bottom: 0, left: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-[#142535]" />
              <XAxis type="number" tick={{ fontSize: 11 }} stroke="currentColor" allowDecimals={false} className="text-slate-400 dark:text-slate-500" />
              <YAxis type="category" dataKey="hostName" tick={{ fontSize: 11 }} stroke="currentColor" width={120} className="text-slate-400 dark:text-slate-500" />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="visits" name="Visits Hosted" radius={[0, 4, 4, 0]} onClick={onBarClick} style={{ cursor: 'pointer' }}>
                {data.top10.map((r) => (
                  <Cell
                    key={r.hostUserId}
                    fill="#0EA5E9"
                    fillOpacity={activeHost == null || activeHost === r.hostName ? 1 : 0.35}
                    stroke={activeHost === r.hostName ? '#0284C7' : undefined}
                    strokeWidth={activeHost === r.hostName ? 2 : 0}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    },
    renderTable: (data, ctx) => <StaffPerformanceTable data={data} ctx={ctx} />,
    csvColumns: [
      { key: '__sr', label: 'SR. No.' },
      { key: 'hostUserId', label: 'Host ID', getter: (r) => r.hostUserId },
      { key: 'hostName', label: 'Host Name', getter: (r) => r.hostName },
      { key: 'role', label: 'Role', getter: (r) => r.role },
      { key: 'office', label: 'Office', getter: (r) => r.office },
      { key: 'visits', label: 'Visits Hosted', getter: (r) => r.visits, format: 'number' },
      { key: 'avgDuration', label: 'Avg Duration (min)', getter: (r) => r.avgDurationMin, format: 'number' },
      { key: 'noShows', label: 'No-Shows', getter: (r) => r.noShows, format: 'number' },
      { key: 'noShowRate', label: 'No-Show Rate', getter: (r) => `${r.noShowRatePct}%` },
      { key: 'avgRating', label: 'Avg Rating', getter: (r) => r.avgRating != null ? r.avgRating.toFixed(1) : '' },
    ],
    pdfColumns: [
      { key: '__sr', label: 'SR. No.', width: '14mm' },
      { key: 'hostName', label: 'Host', width: '50mm', getter: (r) => r.hostName },
      { key: 'role', label: 'Role', width: '30mm', getter: (r) => r.role },
      { key: 'visits', label: 'Visits', width: '20mm', getter: (r) => r.visits, format: 'number' },
      { key: 'avgDuration', label: 'Avg (min)', width: '22mm', getter: (r) => r.avgDurationMin, format: 'number' },
      { key: 'noShowRate', label: 'No-Show%', width: '24mm', getter: (r) => `${r.noShowRatePct}%`, format: 'number' },
      { key: 'avgRating', label: 'Rating', width: '22mm', getter: (r) => r.avgRating != null ? r.avgRating.toFixed(1) : '—' },
    ],
  },

  /* 4. ROOM UTILISATION ───────────────────────────────────────── */
  {
    key: 'room-utilisation',
    title: 'Room Utilisation',
    description: 'Bookings per room, peak hours and idle capacity across your offices.',
    Icon: DoorOpen,
    category: 'core',
    defaultRange: 'last30',
    hasChart: true,
    build: (appointments, ctx) => buildRoomUtilisation(appointments, ctx),
    renderSummary: (data) => (
      <>
        <Kpi label="Total Rooms" value={data.kpis.totalRooms} />
        <Kpi label="Rooms In Use" value={data.kpis.roomsUsed} />
        <Kpi label="Total Bookings" value={data.kpis.totalBookings} />
        <Kpi label="Avg Duration (min)" value={data.kpis.avgDurationMin} />
        <Kpi label="Idle Capacity" value={`${data.kpis.idleCapacityPct}%`} />
      </>
    ),
    renderCharts: (data, ctx) => {
      if (!data?.rows?.length) return <EmptyChart />;
      const top10 = data.rows.slice(0, 10);
      const activeRoom = ctx?.tableFilter?.field === 'roomName' ? ctx.tableFilter.value : null;
      const activeHour = ctx?.tableFilter?.field === 'hour' ? ctx.tableFilter.value : null;

      const onRoomBarClick = (bar) => {
        if (!bar || !bar.roomName || bar.bookings === 0) return;
        ctx?.setChartFilter?.({
          field: 'roomName',
          value: bar.roomName,
          label: `Room: ${bar.roomName}`,
          predicate: (r) => r.roomName === bar.roomName,
        });
      };

      const onHourBarClick = (bar) => {
        if (!bar || bar.bookings === 0) return;
        ctx?.setChartFilter?.({
          field: 'hour',
          value: bar.hour,
          label: `Peak Hour: ${bar.label}`,
          predicate: (r) => Array.isArray(r.hoursBooked) && r.hoursBooked.includes(bar.hour),
        });
      };

      return (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={top10} margin={{ top: 8, right: 16, bottom: 0, left: -12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-[#142535]" />
                <XAxis dataKey="roomName" tick={{ fontSize: 10 }} stroke="currentColor" angle={-20} textAnchor="end" height={60} className="text-slate-400 dark:text-slate-500" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="currentColor" className="text-slate-400 dark:text-slate-500" />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="bookings" name="Bookings" radius={[4, 4, 0, 0]} onClick={onRoomBarClick} style={{ cursor: 'pointer' }}>
                  {top10.map((r) => (
                    <Cell
                      key={r.roomId}
                      fill="#0EA5E9"
                      fillOpacity={activeRoom == null || activeRoom === r.roomName ? 1 : 0.35}
                      stroke={activeRoom === r.roomName ? '#0284C7' : undefined}
                      strokeWidth={activeRoom === r.roomName ? 2 : 0}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.peak} margin={{ top: 8, right: 16, bottom: 0, left: -12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-[#142535]" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="currentColor" interval={2} className="text-slate-400 dark:text-slate-500" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="currentColor" className="text-slate-400 dark:text-slate-500" />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="bookings" name="Peak Hours" radius={[4, 4, 0, 0]} onClick={onHourBarClick} style={{ cursor: 'pointer' }}>
                  {data.peak.map((h) => (
                    <Cell
                      key={h.hour}
                      fill="#10B981"
                      fillOpacity={activeHour == null || activeHour === h.hour ? 1 : 0.35}
                      stroke={activeHour === h.hour ? '#047857' : undefined}
                      strokeWidth={activeHour === h.hour ? 2 : 0}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    },
    renderTable: (data, ctx) => <RoomUtilisationTable data={data} ctx={ctx} />,
    csvColumns: [
      { key: '__sr', label: 'SR. No.' },
      { key: 'roomId', label: 'Room ID', getter: (r) => r.roomId },
      { key: 'roomName', label: 'Room Name', getter: (r) => r.roomName },
      { key: 'officeName', label: 'Office', getter: (r) => r.officeName },
      { key: 'capacity', label: 'Capacity', getter: (r) => r.capacity, format: 'number' },
      { key: 'bookings', label: 'Bookings', getter: (r) => r.bookings, format: 'number' },
      { key: 'avgDuration', label: 'Avg Duration (min)', getter: (r) => r.avgDurationMin, format: 'number' },
    ],
    pdfColumns: [
      { key: '__sr', label: 'SR. No.', width: '14mm' },
      { key: 'roomName', label: 'Room', width: '50mm', getter: (r) => r.roomName },
      { key: 'officeName', label: 'Office', width: '45mm', getter: (r) => r.officeName },
      { key: 'capacity', label: 'Capacity', width: '22mm', getter: (r) => r.capacity, format: 'number' },
      { key: 'bookings', label: 'Bookings', width: '22mm', getter: (r) => r.bookings, format: 'number' },
      { key: 'avgDuration', label: 'Avg (min)', width: '22mm', getter: (r) => r.avgDurationMin, format: 'number' },
    ],
  },

  /* 5. SERVICE USAGE (tabular) ──────────────────────────────── */
  {
    key: 'service-usage',
    title: 'Service Usage',
    description: 'Breakdown of services requested by category, with top consuming office per service.',
    Icon: Sparkles,
    category: 'stretch',
    defaultRange: 'last30',
    hasChart: false,
    build: (appointments, ctx) => buildServiceUsage(appointments, ctx),
    renderSummary: (data) => (
      <>
        <Kpi label="Unique Services" value={data.kpis.uniqueServices} />
        <Kpi label="Total Bookings" value={data.kpis.totalBookings} />
      </>
    ),
    renderCharts: () => null,
    renderTable: (data) => <ServiceUsageTable data={data} />,
    csvColumns: [
      { key: '__sr', label: 'SR. No.' },
      { key: 'serviceName', label: 'Service', getter: (r) => r.serviceName },
      { key: 'category', label: 'Category', getter: (r) => r.category },
      { key: 'bookingCount', label: 'Bookings', getter: (r) => r.bookingCount, format: 'number' },
      { key: 'topOffice', label: 'Top Office', getter: (r) => r.topOfficeName },
      { key: 'topOfficeCount', label: 'Top Office Count', getter: (r) => r.topOfficeCount, format: 'number' },
      { key: 'chargeable', label: 'Chargeable?', getter: (r) => r.chargeable ? 'Yes' : 'No' },
    ],
    pdfColumns: [
      { key: '__sr', label: 'SR. No.', width: '14mm' },
      { key: 'serviceName', label: 'Service', width: '50mm', getter: (r) => `${r.serviceIcon} ${r.serviceName}` },
      { key: 'category', label: 'Category', width: '40mm', getter: (r) => r.category },
      { key: 'bookingCount', label: 'Bookings', width: '20mm', getter: (r) => r.bookingCount, format: 'number' },
      { key: 'topOffice', label: 'Top Office', width: '60mm', getter: (r) => `${r.topOfficeName} (${r.topOfficeCount})` },
    ],
  },

  /* 6. AUDIT REPORT (delegated) ───────────────────────────────── */
  {
    key: 'audit-report',
    title: 'Audit Report',
    description: 'Track security events, data changes and user actions across the platform.',
    Icon: Shield,
    category: 'stretch',
    defaultRange: 'last7',
    hasChart: false,
    externalLink: {
      page: 'audit-logs',
      queryParams: (ctx) => ({ from: ctx.from, to: ctx.to }),
    },
  },
];

export const REPORTS_BY_KEY = Object.fromEntries(REPORT_REGISTRY.map((r) => [r.key, r]));

const tooltipStyle = {
  borderRadius: 10,
  border: '1px solid #E5E7EB',
  fontSize: 12,
  fontWeight: 600,
  backgroundColor: 'rgba(255,255,255,0.98)',
};

function Kpi({ label, value, sparkline }) {
  return (
    <div className="flex flex-col gap-1 rounded-[12px] border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-[#142535] dark:bg-[#0A1828]">
      <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400">{label}</p>
      <div className="flex items-end justify-between gap-2">
        <p className="font-[Outfit,sans-serif] text-[22px] font-extrabold leading-none text-[#0C2340] dark:text-slate-100">
          {typeof value === 'number' ? value.toLocaleString('en-GB') : (value || '—')}
        </p>
        {sparkline}
      </div>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-[320px] w-full flex-col items-center justify-center gap-2 rounded-[12px] border border-dashed border-slate-200 bg-slate-50 text-center dark:border-[#142535] dark:bg-[#071220]">
      <span aria-hidden="true" className="text-[28px]">📊</span>
      <p className="text-[13px] font-bold text-slate-600 dark:text-slate-300">Not enough data to visualise.</p>
      <p className="text-[11px] text-slate-500 dark:text-slate-400">Try a broader date range or wait for more visitor activity.</p>
    </div>
  );
}

function commonAppointmentCsvColumns() {
  return [
    { key: '__sr', label: 'SR. No.' },
    { key: 'id', label: 'Appointment ID', getter: (a) => a.id },
    { key: 'fullName', label: 'Visitor Name', getter: (a) => a.visitor?.fullName || a.guestName || '' },
    { key: 'company', label: 'Company', getter: (a) => a.visitor?.companyName || a.company || '' },
    { key: 'contact', label: 'Contact Number', getter: (a) => a.visitor?.contactNumber || a.contactNumber || '', format: 'contact-text' },
    { key: 'email', label: 'Email ID', getter: (a) => a.visitor?.emailId || a.email || '' },
    { key: 'vType', label: 'Visitor Type', getter: (a) => a.visitor?.visitorType || '' },
    { key: 'host', label: 'Host', getter: (a) => a.host || '' },
    { key: 'office', label: 'Office', getter: (a, ctx) => ctx?.officeById?.get(a.officeId)?.name || '' },
    { key: 'date', label: 'Date', getter: (a) => formatDateGB(a.scheduledDate || a.date) },
    { key: 'startT', label: 'Start Time', getter: (a) => to12hAmPm(a.startTime || a.time) },
    { key: 'endT', label: 'End Time', getter: (a) => to12hAmPm(a.endTime) },
    { key: 'status', label: 'Status', getter: (a) => a.status || '' },
    { key: 'checkIn', label: 'Check-In', getter: (a) => a.checkedInAt ? formatDateTime(a.checkedInAt) : '' },
    { key: 'checkOut', label: 'Check-Out', getter: (a) => a.checkedOutAt ? formatDateTime(a.checkedOutAt) : '' },
    { key: 'walkIn', label: 'Walk-In?', getter: (a) => a.isWalkIn ? 'Yes' : 'No' },
  ];
}

function commonAppointmentPdfColumns() {
  return [
    { key: '__sr', label: 'SR. No.', width: '14mm' },
    { key: 'fullName', label: 'Visitor', width: '50mm', getter: (a) => a.visitor?.fullName || a.guestName || '' },
    { key: 'host', label: 'Host', width: '40mm', getter: (a) => a.host || '' },
    { key: 'office', label: 'Office', width: '40mm', getter: (a, ctx) => ctx?.officeById?.get(a.officeId)?.name || '' },
    { key: 'date', label: 'Date', width: '24mm', getter: (a) => formatDateGB(a.scheduledDate || a.date) },
    { key: 'startT', label: 'Time', width: '30mm', getter: (a) => `${to12hAmPm(a.startTime || a.time)} ${getTimezoneAbbr(ctxTz(a))}`.trim() },
    {
      key: 'status',
      label: 'Status',
      width: '30mm',
      getter: (a) => {
        const disp = displayStatus(a);
        return pdfStatusPill(disp.label, statusColor(disp.tone));
      },
    },
    { key: 'vType', label: 'Type', width: '22mm', getter: (a) => a.visitor?.visitorType || '' },
  ];
}

function statusColor(tone) {
  switch (tone) {
    case 'emerald': return '#15803D';
    case 'amber': return '#B45309';
    case 'violet': return '#0284C7';
    case 'blue': return '#2563EB';
    case 'red': return '#DC2626';
    default: return '#64748B';
  }
}

function ctxTz() {
  return '';
}

function TodayVisitorTable({ data, ctx }) {
  const rows = data?.rows || [];
  return <AppointmentMiniTable rows={rows} ctx={ctx} />;
}

function WeeklySummaryTable({ data, ctx }) {
  const rows = data?.rows || [];
  return <AppointmentMiniTable rows={rows} ctx={ctx} />;
}

function AppointmentMiniTable({ rows, ctx }) {
  const { onSelectAppointment, filterLabel, onClearFilter } = ctx || {};
  const filtered = rows;

  return (
    <div>
      {filterLabel && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[11px] font-bold text-sky-700 dark:border-sky-400/30 dark:bg-sky-500/15 dark:text-sky-300">
            Filtered by: {filterLabel}
            {onClearFilter && (
              <button type="button" onClick={onClearFilter}
                className="ml-1 cursor-pointer rounded-full text-sky-500 hover:text-sky-700 dark:text-sky-300"
                aria-label="Clear filter" title="Clear filter">×</button>
            )}
          </span>
        </div>
      )}

      {/* ── Mobile card view (below md) ── */}
      <div className="block md:hidden space-y-2">
        {filtered.length === 0 && (
          <div className="rounded-[10px] border border-dashed border-slate-200 px-4 py-6 text-center text-[12px] text-slate-400 dark:border-[#142535]">
            No records match the current slice.
          </div>
        )}
        {filtered.map((a, idx) => {
          const disp = displayStatus(a);
          return (
            <div key={a.id} className="rounded-[10px] border border-slate-200 bg-white p-3 shadow-sm dark:border-[#142535] dark:bg-[#0A1828]">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-[#0C2340] dark:text-slate-100 truncate">
                    {a.visitor?.fullName || a.guestName || '—'}
                  </div>
                  <button type="button" onClick={() => onSelectAppointment?.(a.id)}
                    className="font-mono text-[11px] font-bold text-sky-700 hover:underline dark:text-sky-300">
                    {a.id}
                  </button>
                </div>
                <StatusPill label={disp.label} tone={disp.tone} />
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                <div><span className="text-[10px] font-bold uppercase text-slate-400">Host</span><div className="text-slate-600 dark:text-slate-300 truncate">{a.host || '—'}</div></div>
                <div><span className="text-[10px] font-bold uppercase text-slate-400">Date</span><div className="text-slate-600 dark:text-slate-300">{formatDateGB(a.scheduledDate || a.date)}</div></div>
                <div><span className="text-[10px] font-bold uppercase text-slate-400">Type</span><div className="text-slate-600 dark:text-slate-300">{a.visitor?.visitorType || 'Regular'}</div></div>
                <div><span className="text-[10px] font-bold uppercase text-slate-400">Sr.</span><div className="text-slate-400">{idx + 1}</div></div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Desktop table (md+) ── */}
      <div className="hidden md:block w-full rounded-[10px] border border-slate-200 dark:border-[#142535] overflow-x-auto">
        <table className="w-full min-w-[600px] border-collapse text-left text-[12px]">
          <thead className="bg-slate-50 dark:bg-[#071220]">
            <tr>
              {['SR. No.', 'Appointment ID', 'Visitor', 'Host', 'Date', 'Status', 'Type'].map((h) => (
                <th key={h} className="whitespace-nowrap px-3 py-2 text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-[#142535]">
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-[12px] text-slate-400">No records match the current slice.</td></tr>
            )}
            {filtered.map((a, idx) => {
              const disp = displayStatus(a);
              return (
                <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-[#1E1E3F]">
                  <td className="px-3 py-2 font-semibold text-slate-400">{idx + 1}</td>
                  <td className="px-3 py-2">
                    <button type="button" onClick={() => onSelectAppointment?.(a.id)}
                      className="cursor-pointer font-mono text-[11px] font-bold text-sky-700 hover:underline dark:text-sky-300">{a.id}</button>
                  </td>
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{a.visitor?.fullName || a.guestName || '—'}</td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{a.host || '—'}</td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{formatDateGB(a.scheduledDate || a.date)}</td>
                  <td className="px-3 py-2"><StatusPill label={disp.label} tone={disp.tone} /></td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{a.visitor?.visitorType || 'Regular'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StaffPerformanceTable({ data, ctx }) {
  const rows = data?.rows || [];
  return (
    <div>
      <FilterPill ctx={ctx} />

      {/* ── Mobile card view (below md) ── */}
      <div className="block md:hidden space-y-2">
        {rows.length === 0 && (
          <div className="rounded-[10px] border border-dashed border-slate-200 px-4 py-6 text-center text-[12px] text-slate-400 dark:border-[#142535]">No staff activity in this period.</div>
        )}
        {rows.map((r, idx) => (
          <div key={r.hostUserId} className="rounded-[10px] border border-slate-200 bg-white p-3 shadow-sm dark:border-[#142535] dark:bg-[#0A1828]">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <div className="text-[13px] font-bold text-[#0C2340] dark:text-slate-100">{r.hostName}</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">{r.role}</div>
              </div>
              <span className="text-[11px] font-bold text-slate-400">#{idx + 1}</span>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
              <div><span className="text-[10px] font-bold uppercase text-slate-400">Visits Hosted</span><div className="font-mono font-semibold text-slate-700 dark:text-slate-200">{r.visits.toLocaleString('en-GB')}</div></div>
              <div><span className="text-[10px] font-bold uppercase text-slate-400">Avg Duration</span><div className="font-mono text-slate-700 dark:text-slate-200">{r.avgDurationMin} min</div></div>
              <div><span className="text-[10px] font-bold uppercase text-slate-400">No-Show Rate</span><div className="font-mono text-slate-700 dark:text-slate-200">{r.noShowRatePct}%</div></div>
              <div><span className="text-[10px] font-bold uppercase text-slate-400">Avg Rating</span><div className="font-mono text-slate-700 dark:text-slate-200">{r.avgRating != null ? r.avgRating.toFixed(1) : '—'}</div></div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Desktop table (md+) ── */}
      <div className="hidden md:block w-full rounded-[10px] border border-slate-200 dark:border-[#142535] overflow-x-auto">
        <table className="w-full min-w-[600px] border-collapse text-left text-[12px]">
          <thead className="bg-slate-50 dark:bg-[#071220]">
            <tr>
              {['SR. No.', 'Host', 'Role', 'Visits Hosted', 'Avg Duration (min)', 'No-Show Rate', 'Avg Rating'].map((h) => (
                <th key={h} className="whitespace-nowrap px-3 py-2 text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-[#142535]">
            {rows.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-[12px] text-slate-400">No staff activity in this period.</td></tr>
            )}
            {rows.map((r, idx) => (
              <tr key={r.hostUserId} className="hover:bg-slate-50 dark:hover:bg-[#1E1E3F]">
                <td className="px-3 py-2 font-semibold text-slate-400">{idx + 1}</td>
                <td className="px-3 py-2 font-bold text-[#0C2340] dark:text-slate-100">{r.hostName}</td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{r.role}</td>
                <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-slate-200">{r.visits.toLocaleString('en-GB')}</td>
                <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-slate-200">{r.avgDurationMin}</td>
                <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-slate-200">{r.noShowRatePct}%</td>
                <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-slate-200">{r.avgRating != null ? r.avgRating.toFixed(1) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RoomUtilisationTable({ data, ctx }) {
  const rows = data?.rows || [];
  return (
    <div>
      <FilterPill ctx={ctx} />

      {/* ── Mobile card view (below md) ── */}
      <div className="block md:hidden space-y-2">
        {rows.length === 0 && (
          <div className="rounded-[10px] border border-dashed border-slate-200 px-4 py-6 text-center text-[12px] text-slate-400 dark:border-[#142535]">No room bookings in this period.</div>
        )}
        {rows.map((r, idx) => (
          <div key={r.roomId} className="rounded-[10px] border border-slate-200 bg-white p-3 shadow-sm dark:border-[#142535] dark:bg-[#0A1828]">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <div className="text-[13px] font-bold text-[#0C2340] dark:text-slate-100">{r.roomName}</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">{r.officeName}</div>
              </div>
              <span className="text-[11px] font-bold text-slate-400">#{idx + 1}</span>
            </div>
            <div className="grid grid-cols-3 gap-x-3 gap-y-1.5 text-[11px]">
              <div><span className="text-[10px] font-bold uppercase text-slate-400">Capacity</span><div className="font-mono text-slate-700 dark:text-slate-200">{r.capacity}</div></div>
              <div><span className="text-[10px] font-bold uppercase text-slate-400">Bookings</span><div className="font-mono font-semibold text-slate-700 dark:text-slate-200">{r.bookings}</div></div>
              <div><span className="text-[10px] font-bold uppercase text-slate-400">Avg (min)</span><div className="font-mono text-slate-700 dark:text-slate-200">{r.avgDurationMin}</div></div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Desktop table (md+) ── */}
      <div className="hidden md:block w-full rounded-[10px] border border-slate-200 dark:border-[#142535] overflow-x-auto">
        <table className="w-full min-w-[600px] border-collapse text-left text-[12px]">
          <thead className="bg-slate-50 dark:bg-[#071220]">
            <tr>
              {['SR. No.', 'Room', 'Office', 'Capacity', 'Bookings', 'Avg Duration (min)'].map((h) => (
                <th key={h} className="whitespace-nowrap px-3 py-2 text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-[#142535]">
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-[12px] text-slate-400">No room bookings in this period.</td></tr>
            )}
            {rows.map((r, idx) => (
              <tr key={r.roomId} className="hover:bg-slate-50 dark:hover:bg-[#1E1E3F]">
                <td className="px-3 py-2 font-semibold text-slate-400">{idx + 1}</td>
                <td className="px-3 py-2 font-bold text-[#0C2340] dark:text-slate-100">{r.roomName}</td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{r.officeName}</td>
                <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-slate-200">{r.capacity}</td>
                <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-slate-200">{r.bookings}</td>
                <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-slate-200">{r.avgDurationMin}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilterPill({ ctx }) {
  if (!ctx?.filterLabel) return null;
  return (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[11px] font-bold text-sky-700 dark:border-sky-400/30 dark:bg-sky-500/15 dark:text-sky-300">
        Filtered by: {ctx.filterLabel}
        {ctx.onClearFilter && (
          <button
            type="button"
            onClick={ctx.onClearFilter}
            className="ml-1 cursor-pointer rounded-full text-sky-500 hover:text-sky-700 dark:text-sky-300"
            aria-label="Clear filter"
            title="Clear filter"
          >
            ×
          </button>
        )}
      </span>
    </div>
  );
}

function ServiceUsageTable({ data }) {
  const rows = data?.rows || [];
  return (
    <div>
      {/* Mobile card view (below md) */}
      <div className="block md:hidden space-y-2">
        {rows.length === 0 && (
          <div className="rounded-[10px] border border-dashed border-slate-200 px-4 py-6 text-center text-[12px] text-slate-400 dark:border-[#142535]">No service bookings in this period.</div>
        )}
        {rows.map((r, idx) => (
          <div key={r.serviceId} className="rounded-[10px] border border-slate-200 bg-white p-3 shadow-sm dark:border-[#142535] dark:bg-[#0A1828]">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="text-[18px]" aria-hidden="true">{r.serviceIcon}</span>
                <div>
                  <div className="text-[13px] font-bold text-[#0C2340] dark:text-slate-100">{r.serviceName}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">{r.category}</div>
                </div>
              </div>
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${r.chargeable ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                {r.chargeable ? 'Paid' : 'Free'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
              <div><span className="text-[10px] font-bold uppercase text-slate-400">Bookings</span><div className="font-mono font-semibold text-slate-700 dark:text-slate-200">{r.bookingCount}</div></div>
              <div><span className="text-[10px] font-bold uppercase text-slate-400">Top Office</span><div className="text-slate-600 dark:text-slate-300 truncate">{r.topOfficeName}{r.topOfficeCount ? ` (${r.topOfficeCount})` : ''}</div></div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table (md+) */}
      <div className="hidden md:block w-full rounded-[10px] border border-slate-200 dark:border-[#142535] overflow-x-auto">
        <table className="w-full min-w-[600px] border-collapse text-left text-[12px]">
          <thead className="bg-slate-50 dark:bg-[#071220]">
            <tr>
              {['SR. No.', 'Service', 'Category', 'Bookings', 'Top Office', 'Chargeable'].map((h) => (
                <th key={h} className="whitespace-nowrap px-3 py-2 text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-[#142535]">
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-[12px] text-slate-400">No service bookings in this period.</td></tr>
            )}
            {rows.map((r, idx) => (
              <tr key={r.serviceId} className="hover:bg-slate-50 dark:hover:bg-[#1E1E3F]">
                <td className="px-3 py-2 font-semibold text-slate-400">{idx + 1}</td>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-2 font-bold text-[#0C2340] dark:text-slate-100">
                    <span aria-hidden="true">{r.serviceIcon}</span>{r.serviceName}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{r.category}</td>
                <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-slate-200">{r.bookingCount}</td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                  {r.topOfficeName}{r.topOfficeCount ? <span className="text-slate-400"> ({r.topOfficeCount})</span> : null}
                </td>
                <td className="px-3 py-2">
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${r.chargeable ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300'}`}>
                    {r.chargeable ? 'Yes' : 'Free'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function StatusPill({ label, tone }) {
  const cls = {
    amber: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
    violet: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/30 dark:bg-sky-500/10 dark:text-sky-300',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300',
    blue: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300',
    red: 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300',
    slate: 'border-slate-200 bg-slate-100 text-slate-500 dark:border-[#142535] dark:bg-[#071220] dark:text-slate-400',
  }[tone] || 'border-slate-200 bg-slate-100 text-slate-500';

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${cls}`}>
      <span aria-hidden="true">●</span>
      {label}
    </span>
  );
}

export { Kpi, StatusPill, EmptyChart };