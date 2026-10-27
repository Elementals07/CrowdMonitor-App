import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  Users,
  ShieldCheck,
  UserMinus,
  Percent,
  Clock,
  Send,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  DoorOpen,
  DoorClosed,
  Minus,
  Plus,
  Cpu
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid
} from 'recharts';
import { format } from 'date-fns';
import { api, CurrentOccupancy, OccupancySample, MqttStatus } from '../api';
import { socket } from '../socket';
import { Card } from '../components/ui/Card';
import { StatusDot } from '../components/ui/StatusDot';
import { PageHeader } from '../components/ui/PageHeader';
import { Spinner } from '../components/ui/Spinner';

export const LiveMonitor: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState<CurrentOccupancy | null>(null);
  const [history, setHistory] = useState<OccupancySample[]>([]);
  const historyRef = useRef<OccupancySample[]>([]);

  // Capacity Control State
  const [newCapacity, setNewCapacity] = useState<number | ''>('');
  const [capacityUpdating, setCapacityUpdating] = useState(false);
  const [capacityFeedback, setCapacityFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [waitingDeviceConfirm, setWaitingDeviceConfirm] = useState(false);

  // Time tracker for time-since-last-message
  const [secondsSinceLastMsg, setSecondsSinceLastMsg] = useState<number | null>(null);

  const capacityPresets = [10, 15, 20, 25, 50, 100];

  // Initial load
  useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        setLoading(true);
        const [currRes, histRes] = await Promise.all([
          api.getCurrentOccupancy(),
          api.getOccupancyHistory({ limit: 60 }),
        ]);

        if (isMounted) {
          setCurrent(currRes.data);
          if (currRes.data.sample?.capacity) {
            setNewCapacity(currRes.data.sample.capacity);
          }
          const sorted = [...(histRes.data || [])].sort((a, b) => a.ts - b.ts);
          historyRef.current = sorted;
          setHistory(sorted);
        }
      } catch (err) {
        console.error('Failed to load initial live monitor data:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    init();

    return () => {
      isMounted = false;
    };
  }, []);

  // Socket listener for real-time occupancy updates
  useEffect(() => {
    const handleOccupancyUpdate = (data: OccupancySample) => {
      setCurrent((prev) => {
        const mqttState: MqttStatus = prev?.mqtt ?? {
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

      // Check if we were waiting for confirmation of capacity update
      if (waitingDeviceConfirm && data.capacity === Number(newCapacity)) {
        setWaitingDeviceConfirm(false);
        setCapacityFeedback({
          type: 'success',
          message: `Hardware confirmed new capacity ceiling of ${data.capacity}!`,
        });
      }

      // Maintain rolling window in ref (max 120 points)
      const next = [...historyRef.current, data];
      if (next.length > 120) {
        historyRef.current = next.slice(next.length - 120);
      } else {
        historyRef.current = next;
      }
      setHistory([...historyRef.current]);
    };

    const handleMqttStatus = (status: MqttStatus) => {
      setCurrent((prev) => (prev ? { ...prev, mqtt: status } : null));
    };

    socket.on('occupancy:update', handleOccupancyUpdate);
    socket.on('mqtt:status', handleMqttStatus);

    return () => {
      socket.off('occupancy:update', handleOccupancyUpdate);
      socket.off('mqtt:status', handleMqttStatus);
    };
  }, [waitingDeviceConfirm, newCapacity]);

  // Tick timer for "seconds since last message"
  useEffect(() => {
    const interval = setInterval(() => {
      const lastMsg = current?.mqtt?.lastMessageAt || current?.sample?.ts;
      if (lastMsg) {
        const secs = Math.max(0, Math.floor((Date.now() - lastMsg) / 1000));
        setSecondsSinceLastMsg(secs);
      } else {
        setSecondsSinceLastMsg(null);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [current?.mqtt?.lastMessageAt, current?.sample?.ts]);

  const handleUpdateCapacity = async (e?: React.FormEvent, directValue?: number) => {
    if (e) e.preventDefault();
    const targetValue = directValue !== undefined ? directValue : Number(newCapacity);
    if (!targetValue || targetValue <= 0) return;

    try {
      setCapacityUpdating(true);
      setCapacityFeedback(null);
      setNewCapacity(targetValue);
      const res = await api.updateCapacity(targetValue);
      if (res.data?.published) {
        setWaitingDeviceConfirm(true);
        setCapacityFeedback({
          type: 'success',
          message: `Dispatched command to ESP8266 (${targetValue}). Awaiting hardware echo...`,
        });
      } else {
        setCapacityFeedback({
          type: 'error',
          message: 'Failed to publish capacity command to HiveMQ Cloud.',
        });
      }
    } catch (err: any) {
      setCapacityFeedback({
        type: 'error',
        message: err.message || 'Error transmitting capacity command',
      });
    } finally {
      setCapacityUpdating(false);
    }
  };

  const sample = current?.sample;
  const capacity = sample?.capacity ?? 10;
  const occupancy = sample?.occupancy ?? 0;
  const percentage = sample?.percentage ?? (capacity > 0 ? (occupancy / capacity) * 100 : 0);
  const available = sample?.available ?? Math.max(0, capacity - occupancy);
  const status = sample?.status ?? 'NORMAL';

  const chartData = useMemo(() => {
    return history.map((item) => ({
      time: format(new Date(item.ts), 'HH:mm:ss'),
      occupancy: item.occupancy,
      capacity: item.capacity,
    }));
  }, [history]);

  if (loading && !current) {
    return (
      <div className="space-y-6">
        <PageHeader title="Live Monitor Cockpit" subtitle="High-frequency telemetry stream from entrance sensors" />
        <div className="flex items-center justify-center h-80 bg-white rounded-3xl border border-slate-200/80 shadow-sm">
          <div className="text-center">
            <Spinner size="lg" />
            <p className="mt-4 text-xs font-semibold text-slate-500 font-mono">Synchronizing telemetry frames...</p>
          </div>
        </div>
      </div>
    );
  }

  const isMqttConnected = !!current?.mqtt?.connected;
  const isDataStale = current?.isStale || (secondsSinceLastMsg !== null && secondsSinceLastMsg > 30);

  const getStatusDisplay = () => {
    switch (status) {
      case 'OVERLIMIT':
        return {
          banner: 'bg-red-50 border-2 border-red-300 text-red-800',
          badge: 'overlimit' as const,
          actionNotice: 'EMERGENCY PROTOCOL ACTIVE: Entrance servo is closed, warning buzzer triggered.',
          doorState: 'Closed & Locked',
          doorIcon: <DoorClosed className="w-5 h-5 text-red-500" />
        };
      case 'FULL':
        return {
          banner: 'bg-amber-50 border-2 border-amber-300 text-amber-800',
          badge: 'full' as const,
          actionNotice: 'CAPACITY LIMIT REACHED: Facility is 100% full. New arrivals must queue.',
          doorState: 'Open (At Limit)',
          doorIcon: <DoorOpen className="w-5 h-5 text-amber-500" />
        };
      case 'NORMAL':
      default:
        return {
          banner: 'bg-emerald-50 border-2 border-emerald-300 text-emerald-800',
          badge: 'normal' as const,
          actionNotice: 'STANDARD OPERATING CONDITIONS: Headcount is within safe fire & safety limits.',
          doorState: 'Open & Unlocked',
          doorIcon: <DoorOpen className="w-5 h-5 text-emerald-500" />
        };
    }
  };

  const statusView = getStatusDisplay();

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <PageHeader
        title="Live Mission Control"
        subtitle="Operator cockpit with microsecond sensor feedback and remote hardware overrides"
        action={
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-500 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-sm">
              Node: <strong className="text-slate-800">ROOM-101</strong>
            </span>
          </div>
        }
      />

      {/* Telemetry Status Bar */}
      <div className="bg-white border border-slate-200/80 rounded-2xl px-5 py-3.5 shadow-sm flex flex-wrap items-center justify-between gap-4 text-xs font-semibold">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <StatusDot connected={isMqttConnected} stale={isDataStale} size="md" />
            <span className="font-bold text-slate-800">
              {isMqttConnected
                ? isDataStale
                  ? 'Sensor Signal Stale (>30s)'
                  : 'ESP8266 Live Telemetry Connected'
                : 'MQTT Hardware Disconnected'}
            </span>
          </div>

          <span className="text-slate-300 hidden sm:inline">|</span>

          <div className="flex items-center gap-1.5 text-slate-500">
            <Clock className="w-3.5 h-3.5" />
            <span>
              {sample?.ts ? `Last frame: ${format(new Date(sample.ts), 'HH:mm:ss')}` : 'Awaiting data'}
            </span>
          </div>

          {secondsSinceLastMsg !== null && (
            <span className="font-mono text-slate-400">
              ({secondsSinceLastMsg}s ago)
            </span>
          )}
        </div>

        <div className="flex items-center gap-4 text-slate-500 font-mono">
          <div className="flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-blue-600" />
            <span>Broker Reconnects: <strong className="text-slate-800">{current?.mqtt?.reconnectCount ?? 0}</strong></span>
          </div>
        </div>
      </div>

      {/* STADIUM OPERATING STATE HERO */}
      <div className={`rounded-2xl p-6 sm:p-8 shadow-sm ${statusView.banner} transition-all duration-300 relative overflow-hidden`}>
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
          <div>
            <div className="text-xs font-mono font-bold uppercase tracking-widest opacity-70 mb-1">
              Active Hardware Status
            </div>
            <div className="text-3xl sm:text-5xl font-black tracking-tight flex items-center gap-3">
              {status === 'OVERLIMIT' && <AlertTriangle className="w-10 h-10 animate-bounce" />}
              <span>{status}</span>
            </div>
            <p className="text-sm opacity-80 mt-2 max-w-xl leading-relaxed">
              {statusView.actionNotice}
            </p>
          </div>

          <div className="bg-white/60 backdrop-blur-sm border border-current/10 p-4 rounded-xl flex items-center gap-3.5 shrink-0 shadow-sm">
            {statusView.doorIcon}
            <div>
              <div className="text-[10px] uppercase font-mono font-bold opacity-70">Barrier Servo</div>
              <div className="text-base font-bold">{statusView.doorState}</div>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Large Tactical Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Metric 1: Headcount */}
        <Card elevated className="flex flex-col justify-between border-l-4 border-l-blue-600">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Live Headcount</span>
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <span className="text-5xl font-black font-mono text-slate-900 tracking-tight tabular-nums">
              {occupancy}
            </span>
            <span className="text-xs text-slate-500 block mt-1">Confirmed people inside</span>
          </div>
        </Card>

        {/* Metric 2: Configured Capacity */}
        <Card elevated className="flex flex-col justify-between border-l-4 border-l-slate-400">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Ceiling Limit</span>
            <ShieldCheck className="w-5 h-5 text-slate-600" />
          </div>
          <div>
            <span className="text-5xl font-black font-mono text-slate-900 tracking-tight tabular-nums">
              {capacity}
            </span>
            <span className="text-xs text-slate-500 block mt-1">Maximum allowed capacity</span>
          </div>
        </Card>

        {/* Metric 3: Spaces Remaining */}
        <Card elevated className="flex flex-col justify-between border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Available Spaces</span>
            <UserMinus className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <span className="text-5xl font-black font-mono text-emerald-600 tracking-tight tabular-nums">
              {available}
            </span>
            <span className="text-xs text-slate-500 block mt-1">Free entry allocations</span>
          </div>
        </Card>

        {/* Metric 4: Utilization */}
        <Card elevated className="flex flex-col justify-between border-l-4 border-l-purple-600">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Density Ratio</span>
            <Percent className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <span className="text-5xl font-black font-mono text-slate-900 tracking-tight tabular-nums">
              {Math.round(percentage)}%
            </span>
            <span className="text-xs text-slate-500 block mt-1">
              {percentage > 100 ? 'Breaching ceiling' : `${100 - Math.round(percentage)}% buffer remaining`}
            </span>
          </div>
        </Card>

      </div>

      {/* REMOTE HARDWARE CAPACITY CONTROLLER MODULE */}
      <Card elevated className="bg-gradient-to-b from-white to-slate-50/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">Remote Capacity Overrides</h2>
              <p className="text-xs text-slate-500">
                Instantly adjust ESP8266 capacity threshold. Hardware updates LCD & door servo limits.
              </p>
            </div>
          </div>

          <span className="text-xs font-mono text-slate-500">
            Active: <strong className="text-blue-600">{capacity} Max</strong>
          </span>
        </div>

        {/* Quick Presets */}
        <div className="mb-5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2 font-mono">
            One-Touch Quick Preset Ceilings:
          </span>
          <div className="flex flex-wrap gap-2">
            {capacityPresets.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => handleUpdateCapacity(undefined, preset)}
                disabled={!isMqttConnected || capacityUpdating || waitingDeviceConfirm}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer border ${
                  capacity === preset
                    ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 hover:border-slate-300'
                } disabled:opacity-50`}
              >
                {preset} People
              </button>
            ))}
          </div>
        </div>

        {/* Direct Custom Form */}
        <form onSubmit={handleUpdateCapacity} className="max-w-xl space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex-1 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const val = Math.max(1, (Number(newCapacity) || capacity) - 1);
                  setNewCapacity(val);
                }}
                disabled={!isMqttConnected || capacityUpdating || waitingDeviceConfirm}
                className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 border border-slate-200 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Minus className="w-4 h-4" />
              </button>

              <input
                id="capacity-input"
                type="number"
                min="1"
                step="1"
                value={newCapacity}
                onChange={(e) => setNewCapacity(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                disabled={!isMqttConnected || capacityUpdating || waitingDeviceConfirm}
                className="flex-1 px-4 py-2.5 border border-slate-300 rounded-xl text-sm font-mono font-bold text-center focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                placeholder="Custom limit"
                required
              />

              <button
                type="button"
                onClick={() => {
                  const val = (Number(newCapacity) || capacity) + 1;
                  setNewCapacity(val);
                }}
                disabled={!isMqttConnected || capacityUpdating || waitingDeviceConfirm}
                className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 border border-slate-200 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <button
              type="submit"
              disabled={!isMqttConnected || capacityUpdating || waitingDeviceConfirm || !newCapacity}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 disabled:bg-slate-300 disabled:cursor-not-allowed cursor-pointer"
            >
              {capacityUpdating ? (
                <>
                  <Spinner size="sm" className="border-white" />
                  <span>Publishing...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Apply Limit</span>
                </>
              )}
            </button>
          </div>

          {capacityFeedback && (
            <div
              className={`p-3.5 rounded-xl text-xs flex items-center gap-2.5 font-medium ${
                capacityFeedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              {capacityFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              )}
              <span>{capacityFeedback.message}</span>
            </div>
          )}
        </form>
      </Card>

      {/* Real-Time Rolling Timeline */}
      <Card elevated>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">High-Resolution Rolling Timeline</h2>
            <p className="text-xs text-slate-500">Live sliding buffer displaying up to 120 sensor data points</p>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-1 bg-blue-600 rounded-full inline-block" />
              Headcount
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-1 bg-rose-500 border-dashed rounded-full inline-block" />
              Capacity ({capacity})
            </span>
          </div>
        </div>

        {chartData.length === 0 ? (
          <div className="h-72 flex items-center justify-center text-xs text-slate-400 font-mono">
            Waiting for sensor transmissions...
          </div>
        ) : (
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 15, right: 15, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="liveGlow" x1="0" y1="0" x2="0" y2="1">
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
                  domain={[0, (dataMax: number) => Math.max(capacity + 5, Math.ceil(dataMax * 1.15))]}
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
                          <p className="font-mono text-slate-400 mb-1">{label}</p>
                          <p className="text-blue-400 font-bold font-mono text-sm">Occupancy: {val}</p>
                          <p className="text-slate-400">Limit: {capacity}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <ReferenceLine
                  y={capacity}
                  stroke="#ef4444"
                  strokeDasharray="4 4"
                  strokeWidth={2}
                  label={{
                    value: `Cap: ${capacity}`,
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
                  fill="url(#liveGlow)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  );
};
