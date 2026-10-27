import React, { useState, useEffect } from 'react';
import {
  Download,
  Table,
  Clock,
  FileSpreadsheet
} from 'lucide-react';
import { format, subDays, parseISO, startOfDay, endOfDay, formatDistanceStrict } from 'date-fns';
import { api, OccupancySample, Session } from '../api';
import { Card } from '../components/ui/Card';
import { PageHeader } from '../components/ui/PageHeader';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';

export const Reports: React.FC = () => {
  const [startDateStr, setStartDateStr] = useState<string>(() =>
    format(subDays(new Date(), 7), 'yyyy-MM-dd')
  );
  const [endDateStr, setEndDateStr] = useState<string>(() =>
    format(new Date(), 'yyyy-MM-dd')
  );

  const [samples, setSamples] = useState<OccupancySample[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const fromTs = startOfDay(parseISO(startDateStr)).getTime();
      const toTs = endOfDay(parseISO(endDateStr)).getTime();

      const [historyRes, sessionsRes] = await Promise.all([
        api.getOccupancyHistory({ from: fromTs, to: toTs, limit: 50 }).catch(() => ({ data: [] })),
        api.getSessions().catch(() => ({ data: [] })),
      ]);

      setSamples(historyRes.data || []);
      setSessions((sessionsRes.data || []).filter((s) => s.state === 'ended'));
    } catch (err) {
      console.error('Failed to load reports data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleApplyRange = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData();
  };

  const getFromTs = () => startOfDay(parseISO(startDateStr)).getTime();
  const getToTs = () => endOfDay(parseISO(endDateStr)).getTime();

  const handleDownloadEvents = () => {
    const url = api.getEventsReportUrl(getFromTs(), getToTs());
    window.open(url, '_blank');
  };

  const handleDownloadOccupancy = () => {
    const url = api.getOccupancyReportUrl(getFromTs(), getToTs());
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Reports & Data Export"
        subtitle="Export raw sensor telemetry, computed events, and discrete operational session logs in standard CSV formats"
      />

      {/* Date Filter & Export Action Bar */}
      <Card>
        <form onSubmit={handleApplyRange} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label htmlFor="reportStart" className="text-xs font-semibold text-gray-700">From:</label>
              <input
                id="reportStart"
                type="date"
                value={startDateStr}
                onChange={(e) => setStartDateStr(e.target.value)}
                className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="reportEnd" className="text-xs font-semibold text-gray-700">To:</label>
              <input
                id="reportEnd"
                type="date"
                value={endDateStr}
                onChange={(e) => setEndDateStr(e.target.value)}
                className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-xs font-semibold transition-colors"
            >
              Apply Filter
            </button>
          </div>

          {/* Direct CSV Download Triggers */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleDownloadEvents}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 rounded-lg text-xs font-semibold shadow-sm transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              Download Events CSV
            </button>

            <button
              type="button"
              onClick={handleDownloadOccupancy}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Download Occupancy Samples CSV
            </button>
          </div>
        </form>
      </Card>

      {/* Preview Table: First 50 Occupancy Samples */}
      <Card>
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Occupancy Samples Preview</h2>
            <p className="text-xs text-gray-500">Showing first 50 recorded telemetry samples in selected window</p>
          </div>
          <span className="text-xs text-gray-400 font-mono">Limit: 50 rows</span>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <Spinner size="md" />
            <p className="text-xs text-gray-500 mt-2">Fetching sample preview...</p>
          </div>
        ) : samples.length === 0 ? (
          <EmptyState
            icon={<Table className="w-8 h-8 text-gray-300" />}
            title="No occupancy samples found"
            description="Adjust your date filter to a period when the sensor was active."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500 font-semibold bg-gray-50/50">
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Occupancy</th>
                  <th className="py-2.5 px-3">Capacity</th>
                  <th className="py-2.5 px-3">Available</th>
                  <th className="py-2.5 px-3">Utilization</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {samples.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50/70">
                    <td className="py-2.5 px-3 text-gray-600 font-mono">
                      {format(new Date(s.ts), 'yyyy-MM-dd HH:mm:ss')}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-gray-900">{s.occupancy}</td>
                    <td className="py-2.5 px-3 text-gray-600">{s.capacity}</td>
                    <td className="py-2.5 px-3 text-emerald-600 font-medium">{s.available}</td>
                    <td className="py-2.5 px-3 text-gray-700 font-mono">{Math.round(s.percentage)}%</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          s.status === 'OVERLIMIT'
                            ? 'bg-red-100 text-red-700'
                            : s.status === 'FULL'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-gray-400 font-mono">{s.source || 'mqtt'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Sessions Report Section */}
      <Card>
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Ended Sessions Log & Exports</h2>
            <p className="text-xs text-gray-500">Historical archived sessions with individual CSV export links</p>
          </div>
          <span className="text-xs text-gray-500">{sessions.length} ended sessions</span>
        </div>

        {sessions.length === 0 ? (
          <EmptyState
            icon={<Clock className="w-8 h-8 text-gray-300" />}
            title="No completed sessions available"
            description="Sessions that have ended will be listed here with dedicated export capabilities."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500 font-semibold bg-gray-50/50">
                  <th className="py-3 px-3">Session Name</th>
                  <th className="py-3 px-3">Started</th>
                  <th className="py-3 px-3">Ended</th>
                  <th className="py-3 px-3">Duration</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sessions.map((s) => {
                  const duration =
                    s.started_at && s.ended_at
                      ? formatDistanceStrict(s.ended_at, s.started_at)
                      : '—';
                  return (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="py-3 px-3 font-semibold text-gray-900">{s.name}</td>
                      <td className="py-3 px-3 text-gray-600">
                        {s.started_at ? format(new Date(s.started_at), 'yyyy-MM-dd HH:mm') : '—'}
                      </td>
                      <td className="py-3 px-3 text-gray-600">
                        {s.ended_at ? format(new Date(s.ended_at), 'yyyy-MM-dd HH:mm') : '—'}
                      </td>
                      <td className="py-3 px-3 font-mono text-gray-600">{duration}</td>
                      <td className="py-3 px-3 text-right">
                        <a
                          href={api.getSessionExportUrl(s.id)}
                          download
                          className="inline-flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-gray-50 border border-gray-200 text-blue-600 rounded-lg font-semibold text-xs transition-colors shadow-sm"
                        >
                          <Download className="w-3 h-3" />
                          <span>Export CSV</span>
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
