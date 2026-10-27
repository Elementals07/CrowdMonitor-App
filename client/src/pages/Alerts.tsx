import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  AlertTriangle,
  CheckCircle,
  ShieldAlert,
  Clock,
  Check,
  Settings,
  ArrowRight,
  Info
} from 'lucide-react';
import { format, formatDistanceStrict, parseISO, startOfDay, endOfDay, subDays } from 'date-fns';
import { api, Alert, CurrentOccupancy, MqttStatus } from '../api';
import { socket } from '../socket';
import { Card } from '../components/ui/Card';
import { PageHeader } from '../components/ui/PageHeader';
import { Badge, BadgeVariant } from '../components/ui/Badge';
import { StatusDot } from '../components/ui/StatusDot';
import { EmptyState } from '../components/ui/EmptyState';
import { Spinner } from '../components/ui/Spinner';

export const Alerts: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState<CurrentOccupancy | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [openAlerts, setOpenAlerts] = useState<Alert[]>([]);
  const [acknowledgingId, setAcknowledgingId] = useState<number | null>(null);

  // Filters for alert history
  const [filterStartDate, setFilterStartDate] = useState<string>(() =>
    format(subDays(new Date(), 14), 'yyyy-MM-dd')
  );
  const [filterEndDate, setFilterEndDate] = useState<string>(() =>
    format(new Date(), 'yyyy-MM-dd')
  );
  const [filterType, setFilterType] = useState<string>('all');

  const fetchAlertsData = async () => {
    try {
      setLoading(true);
      const [currRes, alertsRes, openRes] = await Promise.all([
        api.getCurrentOccupancy().catch(() => null),
        api.getAlerts().catch(() => ({ data: [] })),
        api.getOpenAlerts().catch(() => ({ data: [] })),
      ]);

      if (currRes?.data) setCurrent(currRes.data);
      setAlerts(alertsRes.data || []);
      setOpenAlerts(openRes.data || []);
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlertsData();

    const handleAlertNew = (newAlert: Alert) => {
      setOpenAlerts((prev) => [newAlert, ...prev]);
      setAlerts((prev) => [newAlert, ...prev]);
    };

    const handleMqttStatus = (status: MqttStatus) => {
      setCurrent((prev) => (prev ? { ...prev, mqtt: status } : null));
    };

    socket.on('alert:new', handleAlertNew);
    socket.on('mqtt:status', handleMqttStatus);

    return () => {
      socket.off('alert:new', handleAlertNew);
      socket.off('mqtt:status', handleMqttStatus);
    };
  }, []);

  const handleAcknowledge = async (id: number) => {
    try {
      setAcknowledgingId(id);
      const res = await api.acknowledgeAlert(id);
      // Remove from open alerts
      setOpenAlerts((prev) => prev.filter((a) => a.id !== id));
      // Update in full alerts list
      setAlerts((prev) => prev.map((a) => (a.id === id ? res.data : a)));
    } catch (err: any) {
      console.error('Failed to acknowledge alert:', err);
    } finally {
      setAcknowledgingId(null);
    }
  };

  const filteredAlerts = useMemo(() => {
    const fromTs = startOfDay(parseISO(filterStartDate)).getTime();
    const toTs = endOfDay(parseISO(filterEndDate)).getTime();

    return alerts.filter((a) => {
      if (a.ts_start < fromTs || a.ts_start > toTs) return false;
      if (filterType !== 'all' && a.type !== filterType) return false;
      return true;
    });
  }, [alerts, filterStartDate, filterEndDate, filterType]);

  const uniqueAlertTypes = useMemo(() => {
    const types = new Set(alerts.map((a) => a.type));
    return Array.from(types);
  }, [alerts]);

  const getAlertBadgeVariant = (type: string): BadgeVariant => {
    if (type.includes('OVERLIMIT')) return 'overlimit';
    if (type.includes('FULL') || type.includes('WARNING')) return 'full';
    return 'warning';
  };

  const isConnected = !!current?.mqtt?.connected;
  const isStale = !!current?.isStale;

  if (loading && !current) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Alerts & System Incidents"
          subtitle="Real-time incident response, capacity threshold breaches, and connectivity monitoring"
        />
        <div className="p-12 text-center bg-white rounded-xl border border-gray-100">
          <Spinner size="lg" />
          <p className="text-xs text-gray-500 mt-3">Loading incident log and device health...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Alerts & System Incidents"
        subtitle="Real-time incident response, capacity threshold breaches, and connectivity monitoring"
      />

      {/* Hardware Disclaimer Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-900 leading-relaxed">
          <span className="font-semibold">Hardware Diagnostics Note: </span>
          Device health is based on MQTT broker connectivity. An MQTT disconnection indicates network loss or broker broker timeout, but does not necessarily mean sensor failure or microcontroller reboot.
        </div>
      </div>

      {/* Device Health Panel */}
      <Card>
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-semibold text-gray-900">Device & Telemetry Health</h2>
          </div>
          <Link
            to="/settings"
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Configure Thresholds</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Connection Status */}
          <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase text-gray-500">Broker Link</span>
              <StatusDot connected={isConnected} stale={isStale} size="sm" />
            </div>
            <div className="text-base font-bold text-gray-900 mt-2">
              {isConnected ? (isStale ? 'Connected (Stale)' : 'Online & Active') : 'Disconnected'}
            </div>
            <span className="text-[10px] text-gray-400 mt-0.5 block">
              {current?.mqtt?.broker ? `Broker: ${current.mqtt.broker}` : 'Local MQTT Broker'}
            </span>
          </div>

          {/* Last Message Time */}
          <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100">
            <span className="text-[11px] font-semibold uppercase text-gray-500">Last Telemetry Frame</span>
            <div className="text-base font-bold text-gray-900 mt-2">
              {current?.mqtt?.lastMessageAt
                ? format(new Date(current.mqtt.lastMessageAt), 'HH:mm:ss')
                : current?.sample?.ts
                ? format(new Date(current.sample.ts), 'HH:mm:ss')
                : 'None'}
            </div>
            <span className="text-[10px] text-gray-400 mt-0.5 block">
              {current?.mqtt?.lastMessageAt
                ? `${formatDistanceStrict(Date.now(), current.mqtt.lastMessageAt)} ago`
                : 'Waiting for stream'}
            </span>
          </div>

          {/* Reconnect Count */}
          <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100">
            <span className="text-[11px] font-semibold uppercase text-gray-500">Broker Reconnections</span>
            <div className="text-base font-bold text-gray-900 mt-2">
              {current?.mqtt?.reconnectCount ?? 0}
            </div>
            <span className="text-[10px] text-gray-400 mt-0.5 block">Since bridge daemon start</span>
          </div>

          {/* Stale Status */}
          <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100">
            <span className="text-[11px] font-semibold uppercase text-gray-500">Stream Liveness</span>
            <div className={`text-base font-bold mt-2 ${isStale ? 'text-amber-600' : 'text-emerald-600'}`}>
              {isStale ? 'Telemetry Stale' : 'Streaming Real-Time'}
            </div>
            <span className="text-[10px] text-gray-400 mt-0.5 block">
              {isStale ? '> 30s since last payload' : 'Latency < 2s'}
            </span>
          </div>
        </div>
      </Card>

      {/* Open Alerts Section */}
      <Card>
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            <h2 className="text-base font-semibold text-gray-900">Active / Open Incidents</h2>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 bg-red-100 text-red-700 rounded-full">
            {openAlerts.length} Open
          </span>
        </div>

        {openAlerts.length === 0 ? (
          <div className="py-8 text-center text-gray-400 text-xs">
            <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2 opacity-80" />
            <p className="font-semibold text-gray-700">No active incidents</p>
            <p className="text-gray-400 mt-0.5">All sensors and capacity thresholds operating normally.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {openAlerts.map((alert) => {
              const duration = formatDistanceStrict(Date.now(), alert.ts_start);
              return (
                <div
                  key={alert.id}
                  className="p-4 rounded-xl border border-red-200 bg-red-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3">
                    <span className="p-2 rounded-lg bg-red-100 text-red-600 shrink-0 mt-0.5">
                      <AlertTriangle className="w-5 h-5" />
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant={getAlertBadgeVariant(alert.type)} size="sm">
                          {alert.type}
                        </Badge>
                        <span className="text-xs font-semibold text-gray-900">
                          Occupancy: {alert.occupancy} / {alert.capacity} ({Math.round(alert.threshold_pct)}% threshold)
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mt-1.5">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          Started: {format(new Date(alert.ts_start), 'HH:mm:ss (MM/dd)')}
                        </span>
                        <span>•</span>
                        <span className="font-semibold text-red-600">Active for {duration}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleAcknowledge(alert.id)}
                    disabled={acknowledgingId === alert.id}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-white hover:bg-gray-50 border border-red-300 text-red-700 font-semibold text-xs rounded-lg transition-colors shadow-sm shrink-0"
                  >
                    {acknowledgingId === alert.id ? (
                      <Spinner size="sm" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    <span>Acknowledge Incident</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Alert History Section */}
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-3 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Incident History & Audit Log</h2>
            <p className="text-xs text-gray-500">Historical record of capacity warnings and critical events</p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="px-2.5 py-1 text-xs border border-gray-300 rounded-lg text-gray-700"
            />
            <span className="text-xs text-gray-400">to</span>
            <input
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="px-2.5 py-1 text-xs border border-gray-300 rounded-lg text-gray-700"
            />
            {uniqueAlertTypes.length > 0 && (
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-2.5 py-1 text-xs border border-gray-300 rounded-lg text-gray-700"
              >
                <option value="all">All Types</option>
                {uniqueAlertTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {filteredAlerts.length === 0 ? (
          <EmptyState
            icon={<Bell className="w-8 h-8 text-gray-300" />}
            title="No incidents match filter"
            description="Adjust your date range or filter criteria to see older logs."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500 font-semibold bg-gray-50/50">
                  <th className="py-3 px-4">Event Type</th>
                  <th className="py-3 px-3">Start Time</th>
                  <th className="py-3 px-3">Resolved At</th>
                  <th className="py-3 px-3">Duration</th>
                  <th className="py-3 px-3">Occupancy</th>
                  <th className="py-3 px-3">Capacity</th>
                  <th className="py-3 px-4 text-right">Acknowledged</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredAlerts.map((alert) => {
                  const duration = alert.ts_end
                    ? formatDistanceStrict(alert.ts_end, alert.ts_start)
                    : formatDistanceStrict(Date.now(), alert.ts_start);

                  return (
                    <tr key={alert.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-semibold">
                        <Badge variant={getAlertBadgeVariant(alert.type)} size="sm">
                          {alert.type}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-3 text-gray-700">
                        {format(new Date(alert.ts_start), 'MM/dd HH:mm:ss')}
                      </td>
                      <td className="py-3.5 px-3 text-gray-700">
                        {alert.ts_end ? (
                          format(new Date(alert.ts_end), 'MM/dd HH:mm:ss')
                        ) : (
                          <span className="text-red-600 font-semibold">Active</span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 font-mono text-gray-600">{duration}</td>
                      <td className="py-3.5 px-3 font-bold text-gray-900">{alert.occupancy}</td>
                      <td className="py-3.5 px-3 text-gray-600">{alert.capacity}</td>
                      <td className="py-3.5 px-4 text-right">
                        {alert.acknowledged_at ? (
                          <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-medium inline-flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            {format(new Date(alert.acknowledged_at), 'HH:mm')}
                          </span>
                        ) : (
                          <span className="text-gray-400 italic">Pending</span>
                        )}
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
