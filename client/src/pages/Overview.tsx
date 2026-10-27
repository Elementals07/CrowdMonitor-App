import React, { useEffect, useState, useMemo } from 'react';
import {
  UserMinus,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  Activity,
  MapPin,
  CheckCircle2
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  BarChart,
  Bar,
  CartesianGrid,
  Legend
} from 'recharts';
import { format } from 'date-fns';
import { api, CurrentOccupancy, OccupancySample, AnalyticsSummary, TimeseriesPoint, Alert } from '../api';
import { socket } from '../socket';
import { Card } from '../components/ui/Card';
import { Badge, BadgeVariant } from '../components/ui/Badge';
import { DataLabel } from '../components/ui/DataLabel';
import { StatusDot } from '../components/ui/StatusDot';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { NavLink } from 'react-router-dom';

export const Overview: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [current, setCurrent] = useState<CurrentOccupancy | null>(null);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [history, setHistory] = useState<OccupancySample[]>([]);
  const [timeseries, setTimeseries] = useState<TimeseriesPoint[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<Alert[]>([]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const now = Date.now();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const oneHourAgo = now - 60 * 60 * 1000;
      const dayAgo = now - 24 * 60 * 60 * 1000;

      const [currentRes, summaryRes, historyRes, timeseriesRes, alertsRes] = await Promise.all([
        api.getCurrentOccupancy(),
        api.getAnalyticsSummary({ from: todayStart.getTime(), to: now }).catch(() => ({
          data: {
            peakOccupancy: 0,
            avgOccupancy: 0,
            totalEntries: 0,
            totalExits: 0,
            overCapacityMinutes: 0,
            sampleCount: 0,
            hasEventTopics: false,
          },
        })),
        api.getOccupancyHistory({ from: oneHourAgo, to: now, limit: 60 }).catch(() => ({ data: [] })),
        api.getAnalyticsTimeseries({ from: dayAgo, to: now, granularity: 'hour' }).catch(() => ({ data: [] })),
        api.getAlerts().catch(() => ({ data: [] })),
      ]);

      setCurrent(currentRes.data);
      setSummary(summaryRes.data);
      const sortedHistory = [...(historyRes.data || [])].sort((a, b) => a.ts - b.ts);
      setHistory(sortedHistory);
      setTimeseries(timeseriesRes.data || []);
      setRecentAlerts((alertsRes.data || []).slice(0, 8));
    } catch (err: any) {
      console.error('Failed to load overview data:', err);
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Listen to real-time occupancy updates
    const handleOccupancyUpdate = (data: OccupancySample) => {
      setCurrent((prev) => {
        const mqttState = prev?.mqtt ?? {
          connected: true,
          lastMessageAt: data.ts,
          reconnectCount: 0,
          broker: '',
        };
        return {
          sample: data,
          mqtt: { ...mqttState, lastMessageAt: data.ts, connected: true },
          isStale: false,
        };
      });

      // Update rolling history (last 60 items)
      setHistory((prev) => {
        const next = [...prev, data];
        if (next.length > 60) {
          return next.slice(next.length - 60);
        }
        return next;
      });

      // Update today's peak if higher
      setSummary((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          peakOccupancy: Math.max(prev.peakOccupancy, data.occupancy),
        };
      });
    };

    const handleAlertNew = (alert: Alert) => {
      setRecentAlerts((prev) => [alert, ...prev.slice(0, 7)]);
    };

    socket.on('occupancy:update', handleOccupancyUpdate);
    socket.on('alert:new', handleAlertNew);

    return () => {
      socket.off('occupancy:update', handleOccupancyUpdate);
      socket.off('alert:new', handleAlertNew);
    };
  }, []);

  const chartData = useMemo(() => {
    return history.map((item) => ({
      time: format(new Date(item.ts), 'HH:mm:ss'),
      occupancy: item.occupancy,
      capacity: item.capacity,
    }));
  }, [history]);

  const currentSample = current?.sample;
  const currentCapacity = currentSample?.capacity ?? 10;
  const currentOccupancy = currentSample?.occupancy ?? 0;
  const currentPercentage = currentSample?.percentage ?? 
    (currentCapacity > 0 ? Math.round((currentOccupancy / currentCapacity) * 100) : 0);
  const currentAvailable = currentSample?.available ?? Math.max(0, currentCapacity - currentOccupancy);
  const currentStatus = currentSample?.status ?? 'NORMAL';

  const getStatusVariant = (st?: string): BadgeVariant => {
    switch (st) {
      case 'FULL':
        return 'full';
      case 'OVERLIMIT':
        return 'overlimit';
      default:
        return 'normal';
    }
  };

  if (loading && !current) {
    return (
      <div className="space-y-6">
        <PageHeader title="Executive Overview" subtitle="Real-time occupancy metrics and space utilization telemetry" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-slate-200/60 rounded-2xl" />
          ))}
        </div>
        <div className="h-80 bg-slate-200/60 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Facility Overview" />
        <EmptyState
          icon={<AlertTriangle className="w-10 h-10 text-rose-500" />}
          title="Telemetry Connection Interrupted"
          description={error}
          action={
            <button
              onClick={fetchData}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 text-sm font-semibold shadow-sm transition-all cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              Reconnect Telemetry
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Page Header */}
      <PageHeader
        title="Facility Overview"
        subtitle="Unified telemetry hub showing live occupancy, capacity constraints, and crowd flow"
        badge={
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200/80 text-xs font-semibold text-slate-700">
            <MapPin className="w-3.5 h-3.5 text-blue-600" />
            Node: ROOM-101
          </span>
        }
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200/80 rounded-xl hover:bg-slate-50 transition-all shadow-sm cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
              <span>Sync Feed</span>
            </button>

            <NavLink
              to="/admin/live"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-sm shadow-blue-500/20"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Live Console →</span>
            </NavLink>
          </div>
        }
      />

      {/* MASTER HERO STATUS BANNER */}
      <div className="bg-white text-slate-900 rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm relative overflow-hidden">

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
          
          {/* Left Column: Live Headcount & Operating Status */}
          <div className="lg:col-span-5 border-b lg:border-b-0 lg:border-r border-slate-200 pb-6 lg:pb-0 lg:pr-8">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold font-mono tracking-wider text-slate-500 uppercase">
                Active Headcount
              </span>
              <Badge variant={getStatusVariant(currentStatus)} size="sm">
                {currentStatus}
              </Badge>
            </div>

            <div className="flex items-baseline gap-3">
              <span className="text-5xl sm:text-7xl font-black font-mono tracking-tight text-slate-900 tabular-nums">
                {currentOccupancy}
              </span>
              <span className="text-2xl font-bold font-mono text-slate-300">
                / {currentCapacity} cap
              </span>
            </div>

            <div className="mt-4">
              <div className="flex justify-between text-xs font-semibold mb-1.5">
                <span className="text-slate-500">Capacity Density</span>
                <span className="font-mono text-blue-600">{currentPercentage}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3 p-0.5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    currentStatus === 'OVERLIMIT'
                      ? 'bg-rose-500'
                      : currentStatus === 'FULL'
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, currentPercentage))}%` }}
                />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <StatusDot connected={!!current?.mqtt?.connected} stale={current?.isStale} size="sm" />
                {current?.mqtt?.connected
                  ? current?.isStale
                    ? 'Feed Stale (>30s)'
                    : 'ESP8266 Live Telemetry'
                  : 'Hardware Offline'}
              </span>
              <span className="font-mono text-[11px] text-slate-400">
                {current?.sample?.ts ? `Frame: ${format(new Date(current.sample.ts), 'HH:mm:ss')}` : 'No signal'}
              </span>
            </div>
          </div>

          {/* Right Column: 4 Micro KPI Metric Blocks */}
          <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-4">
            
            {/* Tile 1: Available Spaces */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider">Available</span>
                <UserMinus className="w-4 h-4 text-emerald-500" />
              </div>
              <div>
                <span className="text-3xl font-extrabold font-mono text-emerald-600 tabular-nums">
                  {currentAvailable}
                </span>
                <span className="text-[10px] text-slate-400 block mt-1">Free entry spots</span>
              </div>
            </div>

            {/* Tile 2: Entries Today */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider">Entries</span>
                <ArrowUpRight className="w-4 h-4 text-blue-500" />
              </div>
              <div>
                <span className="text-3xl font-extrabold font-mono text-blue-600 tabular-nums">
                  {summary?.totalEntries ?? 0}
                </span>
                <span className="text-[10px] text-slate-400 block mt-1">Daily Inflow</span>
              </div>
            </div>

            {/* Tile 3: Exits Today */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider">Exits</span>
                <ArrowDownRight className="w-4 h-4 text-emerald-500" />
              </div>
              <div>
                <span className="text-3xl font-extrabold font-mono text-emerald-600 tabular-nums">
                  {summary?.totalExits ?? 0}
                </span>
                <span className="text-[10px] text-slate-400 block mt-1">Daily Outflow</span>
              </div>
            </div>

            {/* Tile 4: Peak Today */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider">Today's Peak</span>
                <TrendingUp className="w-4 h-4 text-purple-500" />
              </div>
              <div>
                <span className="text-3xl font-extrabold font-mono text-purple-600 tabular-nums">
                  {summary?.peakOccupancy ?? currentOccupancy}
                </span>
                <span className="text-[10px] text-slate-400 block mt-1">High Watermark</span>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* 60-MINUTE HIGH RESOLUTION STREAM CHART */}
      <Card elevated>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Live Occupancy Rolling Trend (Last 60 Minutes)
              </h2>
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Continuously buffered from hardware IR motion interrupts
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-semibold text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-1 bg-blue-600 rounded-full inline-block" />
              Live Headcount
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-1 bg-rose-500 border-dashed rounded-full inline-block" />
              Safety Ceiling ({currentCapacity})
            </span>
          </div>
        </div>

        {chartData.length === 0 ? (
          <div className="h-72 flex items-center justify-center text-xs text-slate-400 font-mono">
            Buffering initial telemetry packets from HiveMQ Cloud...
          </div>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="areaGlow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <YAxis
                  domain={[0, (dataMax: number) => Math.max(currentCapacity + 4, Math.ceil(dataMax * 1.15))]}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const val = Number(payload[0]?.value) || 0;
                      return (
                        <div className="bg-slate-900 text-white text-xs p-3 rounded-xl shadow-xl border border-slate-800">
                          <p className="font-mono text-slate-400 text-[11px] mb-1">{label}</p>
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-500" />
                            <span className="font-bold text-base text-white font-mono">{val} people</span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1">Limit: {currentCapacity}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <ReferenceLine
                  y={currentCapacity}
                  stroke="#ef4444"
                  strokeDasharray="4 4"
                  strokeWidth={2}
                  label={{
                    value: `Ceiling: ${currentCapacity}`,
                    position: 'top',
                    fill: '#ef4444',
                    fontSize: 11,
                    fontWeight: 'bold',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="occupancy"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#areaGlow)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* TWO COLUMN GRID: HOURLY FLOW + INCIDENT RADAR */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left: Hourly In/Out Distribution */}
        <Card elevated className="flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900 tracking-tight">Hourly Flow Distribution (24h)</h2>
                  <DataLabel type="estimated" />
                </div>
                <p className="text-xs text-slate-500 mt-0.5">Foot traffic volume grouped by 60-minute intervals</p>
              </div>
            </div>

            <div className="h-64 w-full">
              {timeseries.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-400 font-mono">
                  No hourly historical samples in the current 24h window
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={timeseries.map((pt) => ({
                      time: pt.bucket || (pt.ts ? format(new Date(pt.ts), 'HH:mm') : ''),
                      entries: pt.entries || 0,
                      exits: pt.exits || 0,
                    }))}
                    margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      tickLine={false}
                      axisLine={{ stroke: '#e2e8f0' }}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      tickLine={false}
                      axisLine={{ stroke: '#e2e8f0' }}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-slate-900 text-white text-xs p-2.5 rounded-xl shadow-lg border border-slate-800">
                              <p className="font-mono text-slate-400 mb-1">{label}</p>
                              <p className="text-blue-400 font-medium">In: {payload[0]?.value}</p>
                              <p className="text-emerald-400 font-medium">Out: {payload[1]?.value}</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} iconType="circle" />
                    <Bar dataKey="entries" name="Entries (In)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="exits" name="Exits (Out)" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </Card>

        {/* Right: Incident & Safety Alert Stream */}
        <Card elevated className="flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900 tracking-tight">Recent Safety Incidents & Alerts</h2>
                <p className="text-xs text-slate-500 mt-0.5">Threshold crossing events and alarm logs</p>
              </div>
              <span className="text-xs font-mono font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                {recentAlerts.length} events
              </span>
            </div>

            <div className="overflow-y-auto max-h-[256px] space-y-2.5 pr-1">
              {recentAlerts.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-xs text-slate-400">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500/60 mb-2" />
                  <span>No safety violations or over-limit events recorded today</span>
                </div>
              ) : (
                recentAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="p-3 rounded-xl border border-slate-200/70 bg-slate-50/70 flex items-start justify-between gap-3 text-xs hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-start gap-2.5">
                      <span
                        className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                          alert.type.includes('critical') || alert.type.includes('OVERLIMIT')
                            ? 'bg-rose-100 text-rose-600'
                            : 'bg-amber-100 text-amber-600'
                        }`}
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                      </span>
                      <div>
                        <div className="font-bold text-slate-900 capitalize">
                          {alert.type} Incident
                        </div>
                        <div className="text-slate-500 mt-0.5">
                          Occupancy peaked at <span className="font-bold font-mono text-slate-700">{alert.occupancy}</span> (Cap: {alert.capacity})
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0 font-mono">
                      <span className="text-slate-400 text-[11px] block">
                        {format(new Date(alert.ts_start), 'HH:mm:ss')}
                      </span>
                      <span
                        className={`inline-block mt-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                          alert.ts_end 
                            ? 'bg-emerald-100 text-emerald-700' 
                            : 'bg-rose-100 text-rose-700 animate-pulse'
                        }`}
                      >
                        {alert.ts_end ? 'Resolved' : 'Active'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>

      </div>
    </div>
  );
};
