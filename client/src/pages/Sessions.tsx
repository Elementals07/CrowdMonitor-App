import React, { useEffect, useState, useMemo } from 'react';
import {
  Clock,
  Play,
  Square,
  Trash2,
  Download,
  Info,
  Plus,
  AlertTriangle,
  CheckCircle2,
  X
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import { format, formatDistanceStrict } from 'date-fns';
import { api, Session, SessionStats, OccupancySample } from '../api';
import { socket } from '../socket';
import { Card } from '../components/ui/Card';
import { PageHeader } from '../components/ui/PageHeader';
import { Badge, BadgeVariant } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';
import { DataLabel } from '../components/ui/DataLabel';

export const Sessions: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // New session state
  const [newSessionName, setNewSessionName] = useState('');
  const [creating, setCreating] = useState(false);

  // Live occupancy for active session
  const [liveOccupancy, setLiveOccupancy] = useState<number | null>(null);

  // Session details modal state
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [detailData, setDetailData] = useState<{
    session: Session;
    stats: SessionStats;
    history: OccupancySample[];
  } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const res = await api.getSessions();
      setSessions(res.data || []);
    } catch (err: any) {
      setErrorToast(err.message || 'Failed to fetch sessions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();

    const handleSessionUpdate = (updated: Session) => {
      setSessions((prev) => {
        const exists = prev.some((s) => s.id === updated.id);
        if (exists) {
          return prev.map((s) => (s.id === updated.id ? updated : s));
        }
        return [updated, ...prev];
      });
    };

    const handleOccupancyUpdate = (data: OccupancySample) => {
      setLiveOccupancy(data.occupancy);
    };

    socket.on('session:update', handleSessionUpdate);
    socket.on('occupancy:update', handleOccupancyUpdate);

    return () => {
      socket.off('session:update', handleSessionUpdate);
      socket.off('occupancy:update', handleOccupancyUpdate);
    };
  }, []);

  // Find active running session
  const activeSession = useMemo(() => {
    return sessions.find((s) => s.state === 'running') || null;
  }, [sessions]);

  // Duration timer for active session
  const [activeDuration, setActiveDuration] = useState<string>('');
  useEffect(() => {
    if (!activeSession?.started_at) {
      setActiveDuration('');
      return;
    }

    const updateDuration = () => {
      const now = Date.now();
      const start = activeSession.started_at!;
      const diffSecs = Math.max(0, Math.floor((now - start) / 1000));
      const hours = Math.floor(diffSecs / 3600);
      const mins = Math.floor((diffSecs % 3600) / 60);
      const secs = diffSecs % 60;
      setActiveDuration(
        `${hours.toString().padStart(2, '0')}:${mins
          .toString()
          .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
      );
    };

    updateDuration();
    const timer = setInterval(updateDuration, 1000);
    return () => clearInterval(timer);
  }, [activeSession]);

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSessionName.trim()) return;

    try {
      setCreating(true);
      setErrorToast(null);
      const res = await api.createSession(newSessionName.trim());
      setSessions((prev) => [res.data, ...prev]);
      setNewSessionName('');
      setSuccessToast(`Session "${res.data.name}" created successfully.`);
    } catch (err: any) {
      setErrorToast(err.message || 'Failed to create session');
    } finally {
      setCreating(false);
    }
  };

  const handleStartSession = async (session: Session) => {
    if (session.state !== 'idle') {
      setErrorToast(`Cannot start session in state "${session.state}"`);
      return;
    }
    if (activeSession) {
      setErrorToast(`Session "${activeSession.name}" is currently active. End it first.`);
      return;
    }

    try {
      setActionLoading(session.id);
      setErrorToast(null);
      const res = await api.startSession(session.id);
      setSessions((prev) => prev.map((s) => (s.id === session.id ? res.data : s)));
      setSuccessToast(`Session "${res.data.name}" started.`);
    } catch (err: any) {
      setErrorToast(err.message || 'Failed to start session');
    } finally {
      setActionLoading(null);
    }
  };

  const handleEndSession = async (session: Session) => {
    if (session.state !== 'running') {
      setErrorToast(`Cannot end session in state "${session.state}"`);
      return;
    }

    try {
      setActionLoading(session.id);
      setErrorToast(null);
      const res = await api.endSession(session.id);
      setSessions((prev) => prev.map((s) => (s.id === session.id ? res.data : s)));
      setSuccessToast(`Session "${res.data.name}" ended.`);
    } catch (err: any) {
      setErrorToast(err.message || 'Failed to end session');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteSession = async (session: Session) => {
    if (session.state !== 'idle') {
      setErrorToast('Only idle (unstarted) sessions can be deleted.');
      return;
    }

    if (!confirm(`Are you sure you want to delete session "${session.name}"?`)) {
      return;
    }

    try {
      setActionLoading(session.id);
      setErrorToast(null);
      await api.deleteSession(session.id);
      setSessions((prev) => prev.filter((s) => s.id !== session.id));
      setSuccessToast(`Session "${session.name}" deleted.`);
    } catch (err: any) {
      setErrorToast(err.message || 'Failed to delete session');
    } finally {
      setActionLoading(null);
    }
  };

  const handleViewDetails = async (session: Session) => {
    try {
      setSelectedSessionId(session.id);
      setDetailLoading(true);
      setErrorToast(null);

      const [detailRes, historyRes] = await Promise.all([
        api.getSessionDetails(session.id),
        session.started_at && session.ended_at
          ? api.getOccupancyHistory({ from: session.started_at, to: session.ended_at, limit: 500 }).catch(() => ({ data: [] }))
          : Promise.resolve({ data: [] }),
      ]);

      const sortedHist = [...(historyRes.data || [])].sort((a, b) => a.ts - b.ts);
      setDetailData({
        session: detailRes.data.session,
        stats: detailRes.data.stats,
        history: sortedHist,
      });
    } catch (err: any) {
      setErrorToast(err.message || 'Failed to load session details');
      setSelectedSessionId(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const formatSessionDuration = (session: Session) => {
    if (!session.started_at) return '—';
    if (!session.ended_at) {
      return activeDuration || formatDistanceStrict(Date.now(), session.started_at);
    }
    return formatDistanceStrict(session.ended_at, session.started_at);
  };

  const getStateBadgeVariant = (state: Session['state']): BadgeVariant => {
    switch (state) {
      case 'running':
        return 'normal';
      case 'ended':
        return 'info';
      default:
        return 'warning';
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Session Management"
        subtitle="Track discrete operational windows, shifts, or events with isolated analytics"
      />

      {/* Toast Notifications */}
      {errorToast && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-3.5 rounded-xl text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorToast}</span>
          </div>
          <button onClick={() => setErrorToast(null)} className="text-red-500 hover:text-red-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successToast && (
        <div className="bg-green-50 border border-green-200 text-green-800 p-3.5 rounded-xl text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
            <span>{successToast}</span>
          </div>
          <button onClick={() => setSuccessToast(null)} className="text-green-500 hover:text-green-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Active Session Highlight Banner */}
      {activeSession && (
        <div className="bg-blue-50 border-2 border-blue-200 text-slate-900 rounded-xl p-6 shadow-sm relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold uppercase tracking-wider border border-blue-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                Live Session In Progress
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">{activeSession.name}</h2>
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                <span>
                  Started: {activeSession.started_at ? format(new Date(activeSession.started_at), 'HH:mm:ss (MM/dd)') : '—'}
                </span>
                <span>•</span>
                <span>Elapsed: <span className="font-mono font-bold text-slate-800">{activeDuration || '00:00:00'}</span></span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6">
              <div className="bg-white rounded-xl p-3.5 border border-blue-200 min-w-[140px] text-center shadow-sm">
                <span className="text-[11px] uppercase font-bold text-blue-600 block">Live Occupancy</span>
                <span className="text-3xl font-extrabold text-slate-900">
                  {liveOccupancy !== null ? liveOccupancy : '—'}
                </span>
              </div>

              <button
                onClick={() => handleEndSession(activeSession)}
                disabled={actionLoading === activeSession.id}
                className="inline-flex items-center gap-2 px-5 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl text-sm transition-colors shadow-md cursor-pointer"
              >
                {actionLoading === activeSession.id ? (
                  <Spinner size="sm" className="border-white" />
                ) : (
                  <Square className="w-4 h-4 fill-white" />
                )}
                <span>End Session</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Session Panel */}
      <Card>
        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-100">
          <Plus className="w-5 h-5 text-blue-600" />
          <h2 className="text-base font-semibold text-gray-900">Create New Session</h2>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Prepare a new monitoring session (e.g. "Morning Shift", "Main Hall Keynote", "Evening Event"). Start it when the event begins.
        </p>

        <form onSubmit={handleCreateSession} className="flex flex-col sm:flex-row gap-3 max-w-xl">
          <input
            type="text"
            value={newSessionName}
            onChange={(e) => setNewSessionName(e.target.value)}
            placeholder="e.g. Saturday Concert Phase 1"
            className="flex-1 px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <button
            type="submit"
            disabled={creating || !newSessionName.trim()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:bg-gray-300 shadow-sm"
          >
            {creating ? <Spinner size="sm" className="border-white" /> : <Plus className="w-4 h-4" />}
            <span>Create Session</span>
          </button>
        </form>
      </Card>

      {/* Session History Table */}
      <Card>
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Session History</h2>
            <p className="text-xs text-gray-500">All registered monitoring sessions</p>
          </div>
          <span className="text-xs text-gray-500 font-medium">{sessions.length} total</span>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <Spinner size="md" />
            <p className="text-xs text-gray-400 mt-2">Loading session registry...</p>
          </div>
        ) : sessions.length === 0 ? (
          <EmptyState
            icon={<Clock className="w-10 h-10 text-gray-300" />}
            title="No sessions created yet"
            description="Create your first session above to start recording discrete occupancy windows."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500 font-semibold bg-gray-50/50">
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-3">State</th>
                  <th className="py-3 px-3">Started</th>
                  <th className="py-3 px-3">Ended</th>
                  <th className="py-3 px-3">Duration</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sessions.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-gray-900">{s.name}</td>
                    <td className="py-3.5 px-3">
                      <Badge variant={getStateBadgeVariant(s.state)} size="sm">
                        {s.state.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-3 text-gray-600">
                      {s.started_at ? format(new Date(s.started_at), 'MM/dd HH:mm:ss') : '—'}
                    </td>
                    <td className="py-3.5 px-3 text-gray-600">
                      {s.ended_at ? format(new Date(s.ended_at), 'MM/dd HH:mm:ss') : '—'}
                    </td>
                    <td className="py-3.5 px-3 font-mono text-gray-600">
                      {formatSessionDuration(s)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {s.state === 'idle' && (
                          <button
                            onClick={() => handleStartSession(s)}
                            disabled={actionLoading === s.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 rounded font-semibold text-xs transition-colors"
                            title="Start this session"
                          >
                            <Play className="w-3 h-3 fill-green-600" />
                            Start
                          </button>
                        )}

                        {s.state === 'running' && (
                          <button
                            onClick={() => handleEndSession(s)}
                            disabled={actionLoading === s.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 rounded font-semibold text-xs transition-colors"
                            title="End active session"
                          >
                            <Square className="w-3 h-3 fill-red-600" />
                            End
                          </button>
                        )}

                        <button
                          onClick={() => handleViewDetails(s)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded font-semibold text-xs transition-colors"
                          title="View detailed analytics"
                        >
                          <Info className="w-3 h-3" />
                          Details
                        </button>

                        <a
                          href={api.getSessionExportUrl(s.id)}
                          download
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded font-semibold text-xs transition-colors"
                          title="Export CSV"
                        >
                          <Download className="w-3 h-3" />
                          CSV
                        </a>

                        {s.state === 'idle' && (
                          <button
                            onClick={() => handleDeleteSession(s)}
                            disabled={actionLoading === s.id}
                            className="inline-flex items-center p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Delete idle session"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Session Details Modal */}
      {selectedSessionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-gray-200 p-6 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {detailData?.session?.name || 'Session Details'}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  ID: #{selectedSessionId} • Status: {detailData?.session?.state?.toUpperCase()}
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedSessionId(null);
                  setDetailData(null);
                }}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {detailLoading ? (
              <div className="p-12 text-center">
                <Spinner size="lg" />
                <p className="text-xs text-gray-500 mt-3">Aggregating session statistics...</p>
              </div>
            ) : detailData ? (
              <div className="space-y-6">
                {/* Stats Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100">
                    <span className="text-[10px] font-semibold uppercase text-gray-500">Peak Occupancy</span>
                    <div className="text-xl font-extrabold text-gray-900 mt-1">
                      {detailData.stats.peakOccupancy}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100">
                    <span className="text-[10px] font-semibold uppercase text-gray-500">Avg Occupancy</span>
                    <div className="text-xl font-extrabold text-gray-900 mt-1">
                      {Math.round(detailData.stats.avgOccupancy)}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100">
                    <span className="text-[10px] font-semibold uppercase text-gray-500">Over-Limit Duration</span>
                    <div className="text-xl font-extrabold text-red-600 mt-1">
                      {detailData.stats.overCapacityDurationMinutes} min
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-semibold uppercase text-gray-500">Entries</span>
                      <DataLabel type="estimated" />
                    </div>
                    <div className="text-xl font-extrabold text-blue-600 mt-1">
                      {detailData.stats.totalEntries}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-semibold uppercase text-gray-500">Exits</span>
                      <DataLabel type="estimated" />
                    </div>
                    <div className="text-xl font-extrabold text-emerald-600 mt-1">
                      {detailData.stats.totalExits}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100">
                    <span className="text-[10px] font-semibold uppercase text-gray-500">Telemetry Points</span>
                    <div className="text-xl font-extrabold text-gray-900 mt-1">
                      {detailData.stats.sampleCount}
                    </div>
                  </div>
                </div>

                {/* Session Timeline Chart */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
                    Occupancy Profile During Session
                  </h4>
                  {detailData.history.length === 0 ? (
                    <div className="p-8 text-center text-xs text-gray-400 bg-gray-50 rounded-xl">
                      No telemetry points recorded during this session window.
                    </div>
                  ) : (
                    <div className="h-60 w-full bg-white border border-gray-100 rounded-xl p-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={detailData.history.map((h) => ({
                            time: format(new Date(h.ts), 'HH:mm:ss'),
                            occupancy: h.occupancy,
                            capacity: h.capacity,
                          }))}
                          margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                          <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#64748b' }} />
                          <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                          <Tooltip
                            content={({ active, payload, label }) => {
                              if (active && payload && payload.length) {
                                return (
                                  <div className="bg-gray-900 text-white text-xs p-2 rounded shadow">
                                    <p className="font-semibold">{label}</p>
                                    <p className="text-blue-400">Occupancy: {payload[0]?.value}</p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="occupancy"
                            stroke="#2563eb"
                            strokeWidth={2}
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {/* Modal Footer */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <a
                    href={api.getSessionExportUrl(detailData.session.id)}
                    download
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export Session CSV
                  </a>

                  <button
                    onClick={() => {
                      setSelectedSessionId(null);
                      setDetailData(null);
                    }}
                    className="px-4 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};
