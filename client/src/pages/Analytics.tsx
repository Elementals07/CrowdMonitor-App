import React, { useEffect, useState, useMemo } from 'react';
import {
  Calendar,
  Filter,
  Clock,
  AlertTriangle
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ReferenceLine,
  Cell
} from 'recharts';
import { format, subDays, parseISO, startOfDay, endOfDay } from 'date-fns';
import {
  api,
  AnalyticsSummary,
  TimeseriesPoint,
  HeatmapPoint,
  BusiestPeriod
} from '../api';
import { Card } from '../components/ui/Card';
import { PageHeader } from '../components/ui/PageHeader';
import { DataLabel } from '../components/ui/DataLabel';
import { EmptyState } from '../components/ui/EmptyState';
import { Spinner } from '../components/ui/Spinner';

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export const Analytics: React.FC = () => {
  // Filters
  const [startDateStr, setStartDateStr] = useState<string>(() => {
    return format(subDays(new Date(), 7), 'yyyy-MM-dd');
  });
  const [endDateStr, setEndDateStr] = useState<string>(() => {
    return format(new Date(), 'yyyy-MM-dd');
  });
  const [granularity, setGranularity] = useState<'hour' | 'day' | 'week'>('hour');

  // Loading & Error states
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [timeseries, setTimeseries] = useState<TimeseriesPoint[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapPoint[]>([]);
  const [busiest, setBusiest] = useState<BusiestPeriod | null>(null);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      const fromTs = startOfDay(parseISO(startDateStr)).getTime();
      const toTs = endOfDay(parseISO(endDateStr)).getTime();

      const [summaryRes, tsRes, heatRes, busyRes] = await Promise.all([
        api.getAnalyticsSummary({ from: fromTs, to: toTs }),
        api.getAnalyticsTimeseries({ from: fromTs, to: toTs, granularity }),
        api.getHeatmap().catch(() => ({ data: [] })),
        api.getBusiestPeriod().catch(() => ({ data: { busiestHour: null, busiestDay: null } })),
      ]);

      setSummary(summaryRes.data);
      setTimeseries(tsRes.data || []);
      setHeatmap(heatRes.data || []);
      setBusiest(busyRes.data);
    } catch (err: any) {
      console.error('Failed to load analytics:', err);
      setError(err.message || 'Failed to load historical analytics data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const handleApplyFilter = (e: React.FormEvent) => {
    e.preventDefault();
    fetchAnalytics();
  };

  // Heatmap helper: build matrix 7x24
  const heatmapMatrix = useMemo(() => {
    const matrix: Record<string, number> = {};
    let maxVal = 1;

    for (const pt of heatmap) {
      const key = `${pt.dayOfWeek}-${pt.hour}`;
      matrix[key] = pt.avgOccupancy;
      if (pt.avgOccupancy > maxVal) {
        maxVal = pt.avgOccupancy;
      }
    }

    return { matrix, maxVal };
  }, [heatmap]);

  const getHeatmapColor = (val: number, max: number) => {
    if (val === 0 || !val) return 'bg-gray-100';
    const intensity = Math.min(1, val / (max || 1));
    if (intensity < 0.2) return 'bg-blue-100 text-blue-900';
    if (intensity < 0.4) return 'bg-blue-200 text-blue-900';
    if (intensity < 0.6) return 'bg-blue-400 text-white';
    if (intensity < 0.8) return 'bg-blue-600 text-white';
    return 'bg-blue-800 text-white';
  };

  // Timeseries chart formatting
  const formattedTimeseries = useMemo(() => {
    return timeseries.map((pt) => {
      const net = (pt.entries || 0) - (pt.exits || 0);
      let label = pt.bucket;
      if (pt.ts) {
        if (granularity === 'hour') {
          label = format(new Date(pt.ts), 'MM/dd HH:mm');
        } else if (granularity === 'day') {
          label = format(new Date(pt.ts), 'EEE MM/dd');
        } else {
          label = format(new Date(pt.ts), 'yyyy-ww');
        }
      }
      return {
        label,
        occupancy: pt.avgOccupancy !== undefined ? Math.round(pt.avgOccupancy) : (pt.occupancy || 0),
        peakOccupancy: pt.peakOccupancy || 0,
        entries: pt.entries || 0,
        exits: pt.exits || 0,
        net,
        capacity: pt.capacity,
      };
    });
  }, [timeseries, granularity]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Historical Analytics"
        subtitle="Long-term occupancy trends, flow modeling, and facility congestion heatmaps"
      />

      {/* Filter Bar */}
      <Card className="p-4">
        <form
          onSubmit={handleApplyFilter}
          className="flex flex-wrap items-center justify-between gap-4"
        >
          <div className="flex flex-wrap items-center gap-4">
            {/* Start Date */}
            <div className="flex items-center gap-2">
              <label htmlFor="startDate" className="text-xs font-semibold text-gray-700">From:</label>
              <div className="relative">
                <input
                  id="startDate"
                  type="date"
                  value={startDateStr}
                  onChange={(e) => setStartDateStr(e.target.value)}
                  className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* End Date */}
            <div className="flex items-center gap-2">
              <label htmlFor="endDate" className="text-xs font-semibold text-gray-700">To:</label>
              <div className="relative">
                <input
                  id="endDate"
                  type="date"
                  value={endDateStr}
                  onChange={(e) => setEndDateStr(e.target.value)}
                  className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Granularity Selector */}
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
              {(['hour', 'day', 'week'] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGranularity(g)}
                  className={`px-3 py-1 text-xs font-semibold rounded-md capitalize transition-colors ${
                    granularity === g
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm"
          >
            <Filter className="w-3.5 h-3.5" />
            Apply Filter
          </button>
        </form>
      </Card>

      {/* DataLabel Warning Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-900 leading-relaxed">
          <span className="font-semibold">Notice regarding Flow Analytics: </span>
          Entry and exit counts are estimated from occupancy snapshot differences. Dedicated event topics (<code className="bg-amber-100 px-1 py-0.5 rounded font-mono">crowd/entry</code>, <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">crowd/exit</code>) are not yet active on the sensor firmware. These flow figures represent estimated deltas rather than discrete gate sensor triggers.
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-72 bg-white rounded-xl border border-gray-100">
          <div className="text-center">
            <Spinner size="lg" />
            <p className="mt-4 text-xs text-gray-500">Querying analytics aggregation engine...</p>
          </div>
        </div>
      ) : error ? (
        <EmptyState
          icon={<AlertTriangle className="w-10 h-10 text-red-500" />}
          title="Analytics Retrieval Error"
          description={error}
          action={
            <button
              onClick={fetchAnalytics}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-medium"
            >
              Retry
            </button>
          }
        />
      ) : (
        <>
          {/* Summary KPIs Row */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {/* Peak */}
            <Card className="p-4">
              <span className="text-[11px] font-semibold uppercase text-gray-500 tracking-wider">Peak Occupancy</span>
              <div className="text-2xl font-black text-gray-900 mt-1">{summary?.peakOccupancy ?? 0}</div>
              <span className="text-[10px] text-gray-400">Highest headcount</span>
            </Card>

            {/* Average */}
            <Card className="p-4">
              <span className="text-[11px] font-semibold uppercase text-gray-500 tracking-wider">Avg Occupancy</span>
              <div className="text-2xl font-black text-gray-900 mt-1">
                {summary?.avgOccupancy ? Math.round(summary.avgOccupancy) : 0}
              </div>
              <span className="text-[10px] text-gray-400">Mean load over range</span>
            </Card>

            {/* Total Entries */}
            <Card className="p-4">
              <div className="flex items-center gap-1 mb-1">
                <span className="text-[11px] font-semibold uppercase text-gray-500 tracking-wider">Total Entries</span>
                <DataLabel type="estimated" />
              </div>
              <div className="text-2xl font-black text-blue-600">{summary?.totalEntries ?? 0}</div>
              <span className="text-[10px] text-gray-400">Inbound influx</span>
            </Card>

            {/* Total Exits */}
            <Card className="p-4">
              <div className="flex items-center gap-1 mb-1">
                <span className="text-[11px] font-semibold uppercase text-gray-500 tracking-wider">Total Exits</span>
                <DataLabel type="estimated" />
              </div>
              <div className="text-2xl font-black text-emerald-600">{summary?.totalExits ?? 0}</div>
              <span className="text-[10px] text-gray-400">Outbound egress</span>
            </Card>

            {/* Over Capacity Duration */}
            <Card className="p-4">
              <span className="text-[11px] font-semibold uppercase text-gray-500 tracking-wider">Over Capacity</span>
              <div className="text-2xl font-black text-red-600 mt-1">
                {summary?.overCapacityMinutes ?? 0}
                <span className="text-xs font-normal text-gray-500 ml-1">min</span>
              </div>
              <span className="text-[10px] text-gray-400">Breach duration</span>
            </Card>

            {/* Sample Count */}
            <Card className="p-4">
              <span className="text-[11px] font-semibold uppercase text-gray-500 tracking-wider">Sensor Samples</span>
              <div className="text-2xl font-black text-gray-900 mt-1">
                {(summary?.sampleCount ?? 0).toLocaleString()}
              </div>
              <span className="text-[10px] text-gray-400">Data points aggregated</span>
            </Card>
          </div>

          {/* Occupancy Over Time Line Chart */}
          <Card>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Occupancy Over Time</h2>
                <p className="text-xs text-gray-500">
                  Granularity: {granularity} • Aggregated headcount trend
                </p>
              </div>
            </div>

            {formattedTimeseries.length === 0 ? (
              <EmptyState title="No timeseries data" description="Try selecting a wider date range" />
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={formattedTimeseries} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      tickLine={false}
                      axisLine={{ stroke: '#e2e8f0' }}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      tickLine={false}
                      axisLine={{ stroke: '#e2e8f0' }}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-gray-900 text-white text-xs p-2.5 rounded-lg shadow-xl">
                              <p className="font-semibold text-gray-300">{label}</p>
                              <p className="text-blue-400 mt-1">Avg Occupancy: {payload[0]?.value}</p>
                              {payload[1] && <p className="text-purple-400">Peak Occupancy: {payload[1]?.value}</p>}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Line
                      type="monotone"
                      dataKey="occupancy"
                      name="Average Occupancy"
                      stroke="#2563eb"
                      strokeWidth={2.5}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="peakOccupancy"
                      name="Peak in Period"
                      stroke="#a855f7"
                      strokeWidth={1.5}
                      strokeDasharray="3 3"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          {/* Two-Column: Entries vs Exits and Net Flow */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Entries vs Exits */}
            <Card>
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                <div>
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-base font-semibold text-gray-900">Entries vs Exits</h2>
                    <DataLabel type="estimated" />
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">Comparative flow counts per bucket</p>
                </div>
              </div>

              {formattedTimeseries.length === 0 ? (
                <EmptyState title="No flow data available" />
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={formattedTimeseries} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis
                        dataKey="label"
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
                              <div className="bg-gray-900 text-white text-xs p-2.5 rounded-lg shadow-xl">
                                <p className="font-semibold text-gray-300">{label}</p>
                                <p className="text-blue-400 mt-1">Entries: {payload[0]?.value}</p>
                                <p className="text-emerald-400">Exits: {payload[1]?.value}</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                      <Bar dataKey="entries" name="Entries" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="exits" name="Exits" fill="#10b981" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            {/* Net Flow */}
            <Card>
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                <div>
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-base font-semibold text-gray-900">Net Flow (Delta)</h2>
                    <DataLabel type="estimated" />
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">Inflow minus outflow (positive = growing crowd)</p>
                </div>
              </div>

              {formattedTimeseries.length === 0 ? (
                <EmptyState title="No net flow data available" />
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={formattedTimeseries} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        tickLine={false}
                        axisLine={{ stroke: '#e2e8f0' }}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        tickLine={false}
                        axisLine={{ stroke: '#e2e8f0' }}
                      />
                      <ReferenceLine y={0} stroke="#94a3b8" />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            const val = Number(payload[0]?.value) || 0;
                            return (
                              <div className="bg-gray-900 text-white text-xs p-2.5 rounded-lg shadow-xl">
                                <p className="font-semibold text-gray-300">{label}</p>
                                <p className={`mt-1 font-medium ${val >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                  Net Flow: {val > 0 ? `+${val}` : val}
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="net" name="Net Flow">
                        {formattedTimeseries.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.net >= 0 ? '#10b981' : '#ef4444'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
          </div>

          {/* Busiest Period Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="flex items-center gap-4 bg-gradient-to-br from-white to-blue-50/50">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-semibold uppercase text-gray-500 tracking-wider">Busiest Hour of Day</span>
                <div className="text-xl font-bold text-gray-900 mt-0.5">
                  {busiest?.busiestHour
                    ? `${busiest.busiestHour.hour.toString().padStart(2, '0')}:00 – ${(busiest.busiestHour.hour + 1).toString().padStart(2, '0')}:00`
                    : 'Insufficient data'}
                </div>
                <p className="text-xs text-gray-500">
                  {busiest?.busiestHour
                    ? `Average occupancy: ${Math.round(busiest.busiestHour.avgOccupancy)} people`
                    : 'Calculated over all recorded historical telemetry'}
                </p>
              </div>
            </Card>

            <Card className="flex items-center gap-4 bg-gradient-to-br from-white to-indigo-50/50">
              <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-semibold uppercase text-gray-500 tracking-wider">Busiest Day of Week</span>
                <div className="text-xl font-bold text-gray-900 mt-0.5">
                  {busiest?.busiestDay
                    ? `${DAYS_OF_WEEK[busiest.busiestDay.dayOfWeek] || `Day ${busiest.busiestDay.dayOfWeek}`}`
                    : 'Insufficient data'}
                </div>
                <p className="text-xs text-gray-500">
                  {busiest?.busiestDay
                    ? `Average occupancy: ${Math.round(busiest.busiestDay.avgOccupancy)} people`
                    : 'Calculated over all recorded historical telemetry'}
                </p>
              </div>
            </Card>
          </div>

          {/* Day of Week x Hour Heatmap (Custom Div Grid) */}
          <Card>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Congestion Heatmap</h2>
                <p className="text-xs text-gray-500">Historical average occupancy by Day of Week × Hour (00:00 – 23:00)</p>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                <span>Low</span>
                <div className="w-3 h-3 rounded bg-gray-100 border border-gray-200" />
                <div className="w-3 h-3 rounded bg-blue-100" />
                <div className="w-3 h-3 rounded bg-blue-300" />
                <div className="w-3 h-3 rounded bg-blue-600" />
                <div className="w-3 h-3 rounded bg-blue-900" />
                <span>High</span>
              </div>
            </div>

            <div className="overflow-x-auto pb-2">
              <div className="min-w-[700px]">
                {/* Hour Header */}
                <div className="grid grid-cols-[60px_repeat(24,1fr)] gap-1 mb-1">
                  <div className="text-[10px] font-semibold text-gray-400 text-right pr-2">Day/Hr</div>
                  {HOURS.map((h) => (
                    <div key={h} className="text-[10px] text-gray-400 font-mono text-center">
                      {h}
                    </div>
                  ))}
                </div>

                {/* Day Rows */}
                {DAYS_OF_WEEK.map((dayName, dayIdx) => (
                  <div key={dayName} className="grid grid-cols-[60px_repeat(24,1fr)] gap-1 mb-1 items-center">
                    <div className="text-xs font-medium text-gray-600 text-right pr-2">
                      {dayName}
                    </div>
                    {HOURS.map((hour) => {
                      const val = heatmapMatrix.matrix[`${dayIdx}-${hour}`] || 0;
                      const rounded = Math.round(val);
                      return (
                        <div
                          key={hour}
                          title={`${dayName} at ${hour.toString().padStart(2, '0')}:00 — Avg Occupancy: ${rounded}`}
                          className={`h-7 rounded flex items-center justify-center text-[10px] font-medium transition-transform hover:scale-110 cursor-pointer ${getHeatmapColor(
                            val,
                            heatmapMatrix.maxVal
                          )}`}
                        >
                          {rounded > 0 ? rounded : ''}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
};
