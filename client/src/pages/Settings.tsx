import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Cpu,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Save,
  Code2
} from 'lucide-react';
import { format } from 'date-fns';
import { api, SettingsMap, CurrentOccupancy } from '../api';
import { Card } from '../components/ui/Card';
import { PageHeader } from '../components/ui/PageHeader';
import { StatusDot } from '../components/ui/StatusDot';
import { Spinner } from '../components/ui/Spinner';

export const Settings: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState<CurrentOccupancy | null>(null);
  const [settings, setSettings] = useState<SettingsMap>({});

  // Threshold form
  const [warningThreshold, setWarningThreshold] = useState<number>(85);
  const [criticalThreshold, setCriticalThreshold] = useState<number>(100);
  const [savingThresholds, setSavingThresholds] = useState(false);
  const [thresholdFeedback, setThresholdFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // System settings form
  const [defaultCapacity, setDefaultCapacity] = useState<number>(100);
  const [staleThresholdSecs, setStaleThresholdSecs] = useState<number>(30);
  const [savingSystem, setSavingSystem] = useState(false);
  const [systemFeedback, setSystemFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [settingsRes, currentRes] = await Promise.all([
          api.getSettings().catch(() => ({ data: {} as SettingsMap })),
          api.getCurrentOccupancy().catch(() => null),
        ]);

        const s: SettingsMap = settingsRes.data || {};
        setSettings(s);
        if (currentRes?.data) setCurrent(currentRes.data);

        // Populate state from retrieved settings or fallback
        if (s['threshold.warning']) setWarningThreshold(Number(s['threshold.warning']));
        if (s['threshold.critical']) setCriticalThreshold(Number(s['threshold.critical']));
        if (s['facility.defaultCapacity']) setDefaultCapacity(Number(s['facility.defaultCapacity']));
        if (s['telemetry.staleSeconds']) setStaleThresholdSecs(Number(s['telemetry.staleSeconds']));
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const handleSaveThresholds = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingThresholds(true);
      setThresholdFeedback(null);

      await Promise.all([
        api.updateSetting('threshold.warning', warningThreshold),
        api.updateSetting('threshold.critical', criticalThreshold),
      ]);

      setThresholdFeedback({
        type: 'success',
        message: 'Alert thresholds successfully saved.',
      });
    } catch (err: any) {
      setThresholdFeedback({
        type: 'error',
        message: err.message || 'Failed to update alert thresholds',
      });
    } finally {
      setSavingThresholds(false);
    }
  };

  const handleSaveSystemSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingSystem(true);
      setSystemFeedback(null);

      await Promise.all([
        api.updateSetting('facility.defaultCapacity', defaultCapacity),
        api.updateSetting('telemetry.staleSeconds', staleThresholdSecs),
      ]);

      setSystemFeedback({
        type: 'success',
        message: 'System settings successfully updated.',
      });
    } catch (err: any) {
      setSystemFeedback({
        type: 'error',
        message: err.message || 'Failed to update system settings',
      });
    } finally {
      setSavingSystem(false);
    }
  };

  // Redact MQTT broker host/url
  const redactedBrokerUrl = () => {
    const raw = current?.mqtt?.broker || String(settings['mqtt.broker'] || 'mqtt://broker.emqx.io:1883');
    try {
      // Remove username/password if present
      if (raw.includes('@')) {
        const parts = raw.split('@');
        const scheme = parts[0].split('://')[0];
        return `${scheme}://***@${parts[1]}`;
      }
      return raw;
    } catch {
      return raw;
    }
  };

  const isConnected = !!current?.mqtt?.connected;
  const isStale = !!current?.isStale;

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="System & Device Settings" subtitle="Configure thresholds, hardware broker, and system parameters" />
        <div className="p-12 text-center bg-white rounded-xl border border-gray-100">
          <Spinner size="lg" />
          <p className="text-xs text-gray-500 mt-3">Loading configuration store...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="System & Device Settings"
        subtitle="Manage alert trigger thresholds, MQTT telemetry parameters, and firmware deployment options"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section 1: Alert Thresholds */}
        <Card className="flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-100">
              <Sliders className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-semibold text-gray-900">Alert Thresholds</h2>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Configure occupancy percentage limits that trigger automatic system incident warnings and critical notifications.
            </p>

            <form onSubmit={handleSaveThresholds} className="space-y-4">
              <div>
                <label htmlFor="warningThreshold" className="block text-xs font-semibold text-gray-700 mb-1">
                  Warning Threshold (% of capacity)
                </label>
                <input
                  id="warningThreshold"
                  type="number"
                  min="1"
                  max="100"
                  value={warningThreshold}
                  onChange={(e) => setWarningThreshold(Number(e.target.value))}
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <span className="text-[11px] text-gray-400 mt-1 block">
                  Triggers amber status badge and logged warning event (default: 85%)
                </span>
              </div>

              <div>
                <label htmlFor="criticalThreshold" className="block text-xs font-semibold text-gray-700 mb-1">
                  Critical Threshold (% of capacity)
                </label>
                <input
                  id="criticalThreshold"
                  type="number"
                  min="1"
                  max="150"
                  value={criticalThreshold}
                  onChange={(e) => setCriticalThreshold(Number(e.target.value))}
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <span className="text-[11px] text-gray-400 mt-1 block">
                  Triggers red OVERLIMIT status and active security alert (default: 100%)
                </span>
              </div>

              {thresholdFeedback && (
                <div
                  className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                    thresholdFeedback.type === 'success'
                      ? 'bg-green-50 text-green-800 border border-green-200'
                      : 'bg-red-50 text-red-800 border border-red-200'
                  }`}
                >
                  {thresholdFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-green-600" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                  )}
                  <span>{thresholdFeedback.message}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={savingThresholds}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm disabled:bg-gray-300"
              >
                {savingThresholds ? <Spinner size="sm" className="border-white" /> : <Save className="w-3.5 h-3.5" />}
                <span>Save Alert Thresholds</span>
              </button>
            </form>
          </div>
        </Card>

        {/* Section 2: Device Information */}
        <Card className="flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-100">
              <Cpu className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-semibold text-gray-900">Device & Telemetry Information</h2>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Hardware gateway connectivity parameters and real-time link diagnostics.
            </p>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-between">
                <span className="text-gray-500 font-medium">MQTT Broker Address</span>
                <span className="font-mono text-gray-800 font-semibold">{redactedBrokerUrl()}</span>
              </div>

              <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-between">
                <span className="text-gray-500 font-medium">Connection Status</span>
                <div className="flex items-center gap-2">
                  <StatusDot connected={isConnected} stale={isStale} size="sm" />
                  <span className="font-semibold text-gray-800">
                    {isConnected ? (isStale ? 'Connected (Stale)' : 'Online') : 'Disconnected'}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-between">
                <span className="text-gray-500 font-medium">Last Telemetry Payload</span>
                <span className="font-mono text-gray-800 font-semibold">
                  {current?.mqtt?.lastMessageAt
                    ? format(new Date(current.mqtt.lastMessageAt), 'yyyy-MM-dd HH:mm:ss')
                    : current?.sample?.ts
                    ? format(new Date(current.sample.ts), 'yyyy-MM-dd HH:mm:ss')
                    : 'No telemetry frames recorded'}
                </span>
              </div>

              <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-between">
                <span className="text-gray-500 font-medium">Daemon Reconnect Count</span>
                <span className="font-mono text-gray-800 font-semibold">{current?.mqtt?.reconnectCount ?? 0}</span>
              </div>

              <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-between">
                <span className="text-gray-500 font-medium">Active Telemetry Topic</span>
                <span className="font-mono text-blue-600 font-semibold">crowd/occupancy</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Section 3: System Settings */}
        <Card className="flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-100">
              <SettingsIcon className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-semibold text-gray-900">Facility & System Settings</h2>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Facility-wide operating constants and stale telemetry watchdogs.
            </p>

            <form onSubmit={handleSaveSystemSettings} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Facility Timezone
                </label>
                <div className="w-full px-3.5 py-2 border border-gray-200 bg-gray-50 rounded-lg text-sm text-gray-600 font-mono">
                  {Intl.DateTimeFormat().resolvedOptions().timeZone} (Local System Time)
                </div>
                <span className="text-[11px] text-gray-400 mt-1 block">
                  Read-only: timeseries graphs and timestamp aggregations use the browser/server facility timezone.
                </span>
              </div>

              <div>
                <label htmlFor="defaultCapacity" className="block text-xs font-semibold text-gray-700 mb-1">
                  Default Venue Capacity
                </label>
                <input
                  id="defaultCapacity"
                  type="number"
                  min="1"
                  value={defaultCapacity}
                  onChange={(e) => setDefaultCapacity(Number(e.target.value))}
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <span className="text-[11px] text-gray-400 mt-1 block">
                  Initial capacity fallback used when hardware reconnects without retained state.
                </span>
              </div>

              <div>
                <label htmlFor="staleThreshold" className="block text-xs font-semibold text-gray-700 mb-1">
                  Stale Telemetry Threshold (seconds)
                </label>
                <input
                  id="staleThreshold"
                  type="number"
                  min="5"
                  max="600"
                  value={staleThresholdSecs}
                  onChange={(e) => setStaleThresholdSecs(Number(e.target.value))}
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <span className="text-[11px] text-gray-400 mt-1 block">
                  Duration without an incoming payload before flagging the feed as STALE (default: 30s).
                </span>
              </div>

              {systemFeedback && (
                <div
                  className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                    systemFeedback.type === 'success'
                      ? 'bg-green-50 text-green-800 border border-green-200'
                      : 'bg-red-50 text-red-800 border border-red-200'
                  }`}
                >
                  {systemFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-green-600" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                  )}
                  <span>{systemFeedback.message}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={savingSystem}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm disabled:bg-gray-300"
              >
                {savingSystem ? <Spinner size="sm" className="border-white" /> : <Save className="w-3.5 h-3.5" />}
                <span>Update System Settings</span>
              </button>
            </form>
          </div>
        </Card>

        {/* Section 4: Firmware Note Box */}
        <Card className="flex flex-col justify-between border-l-4 border-l-indigo-600 bg-gradient-to-br from-white to-indigo-50/30">
          <div>
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-100">
              <Code2 className="w-5 h-5 text-indigo-600" />
              <h2 className="text-base font-semibold text-gray-900">Firmware Architecture Note</h2>
            </div>
            
            <div className="space-y-3 text-xs text-gray-700 leading-relaxed">
              <p>
                The ESP8266 microcontroller firmware publishes occupancy snapshots to <code className="bg-indigo-100 text-indigo-900 px-1 py-0.5 rounded font-mono font-semibold">crowd/occupancy</code>.
              </p>
              <p>
                Dedicated entry/exit event topics (<code className="bg-indigo-100 text-indigo-900 px-1 py-0.5 rounded font-mono font-semibold">crowd/entry</code>, <code className="bg-indigo-100 text-indigo-900 px-1 py-0.5 rounded font-mono font-semibold">crowd/exit</code>) are not yet active on the currently deployed embedded build.
              </p>
              <div className="p-3 bg-white rounded-lg border border-indigo-200 text-gray-800">
                <span className="font-semibold block text-indigo-950 mb-1">To enable discrete gate event analytics:</span>
                Add the following call to your ESP8266 interrupt service routines:
                <pre className="mt-2 p-2 bg-gray-900 text-gray-100 rounded font-mono text-[11px] overflow-x-auto">
{`mqttClient.publish("crowd/entry", "{\\"ts\\": 123456789}");`}
                </pre>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
