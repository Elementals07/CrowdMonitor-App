import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Users, 
  MapPin, 
  ArrowLeft, 
  Clock, 
  AlertTriangle, 
  Activity, 
  CheckCircle2, 
  WifiOff,
  DoorOpen,
  DoorClosed
} from 'lucide-react';
import { api, OccupancySample } from '../api';
import { socket } from '../socket';

export const UserView: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sensorInfo, setSensorInfo] = useState<{ code: string; name: string; location: string } | null>(null);
  
  // Real-time telemetry state
  const [occupancy, setOccupancy] = useState<number>(0);
  const [capacity, setCapacity] = useState<number>(10);
  const [available, setAvailable] = useState<number>(10);
  const [percentage, setPercentage] = useState<number>(0);
  const [status, setStatus] = useState<'NORMAL' | 'FULL' | 'OVERLIMIT'>('NORMAL');
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [isStale, setIsStale] = useState<boolean>(false);
  const [mqttConnected, setMqttConnected] = useState<boolean>(true);
  const [secondsAgo, setSecondsAgo] = useState<number>(0);

  // Initial fetch
  useEffect(() => {
    let isMounted = true;
    async function fetchSensor() {
      if (!code) return;
      try {
        setLoading(true);
        setError(null);
        const res = await api.getPublicSensorStatus(code);
        if (isMounted && res.data) {
          const d = res.data;
          setSensorInfo(d.sensor);
          setOccupancy(d.occupancy);
          setCapacity(d.capacity);
          setAvailable(d.available);
          setPercentage(d.percentage);
          setStatus(d.status);
          setLastUpdatedAt(d.lastUpdatedAt);
          setIsStale(d.isStale);
          setMqttConnected(d.mqttConnected);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || `Sensor with code '${code}' was not found.`);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchSensor();
    return () => { isMounted = false; };
  }, [code]);

  // Real-time Socket.IO updates
  useEffect(() => {
    const handleOccupancyUpdate = (data: OccupancySample) => {
      setOccupancy(data.occupancy);
      setCapacity(data.capacity);
      setAvailable(data.available);
      setPercentage(data.percentage);
      setStatus(data.status);
      setLastUpdatedAt(data.ts);
      setIsStale(false);
    };

    const handleMqttStatus = (data: { connected: boolean }) => {
      setMqttConnected(data.connected);
    };

    socket.on('occupancy:update', handleOccupancyUpdate);
    socket.on('mqtt:status', handleMqttStatus);

    return () => {
      socket.off('occupancy:update', handleOccupancyUpdate);
      socket.off('mqtt:status', handleMqttStatus);
    };
  }, []);

  // Update seconds-ago counter
  useEffect(() => {
    const interval = setInterval(() => {
      if (lastUpdatedAt) {
        const diff = Math.max(0, Math.floor((Date.now() - lastUpdatedAt) / 1000));
        setSecondsAgo(diff);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [lastUpdatedAt]);

  // Status-driven Theme Configuration (light theme)
  const getStatusTheme = () => {
    switch (status) {
      case 'OVERLIMIT':
        return {
          bannerBg: 'bg-red-50 border-red-200',
          bannerText: 'text-red-800',
          dotBg: 'bg-red-500',
          tagBg: 'bg-red-100 text-red-700 border-red-200',
          tagText: 'OVER CAPACITY',
          headline: 'At Capacity — Please Wait Outside',
          subtext: 'Room has exceeded safety limits. The entrance gate has paused entries.',
          barColor: 'bg-red-500',
          barTrack: 'bg-red-100',
          textColor: 'text-red-600',
          metricColor: 'text-red-600',
          icon: <AlertTriangle className="w-6 h-6 text-red-500 animate-pulse" />,
          gateStatus: 'Gate Closed & Locked',
          gateIcon: <DoorClosed className="w-5 h-5 text-red-500" />,
          headerAccent: 'border-red-200 bg-red-50/50',
        };
      case 'FULL':
        return {
          bannerBg: 'bg-amber-50 border-amber-200',
          bannerText: 'text-amber-800',
          dotBg: 'bg-amber-500',
          tagBg: 'bg-amber-100 text-amber-700 border-amber-200',
          tagText: 'MAX CAPACITY',
          headline: 'Room is Currently Full',
          subtext: 'All permitted slots are occupied. Entry resumes as occupants exit.',
          barColor: 'bg-amber-500',
          barTrack: 'bg-amber-100',
          textColor: 'text-amber-600',
          metricColor: 'text-amber-600',
          icon: <AlertTriangle className="w-6 h-6 text-amber-500" />,
          gateStatus: 'Door Open (At Limit)',
          gateIcon: <DoorOpen className="w-5 h-5 text-amber-500" />,
          headerAccent: 'border-amber-200 bg-amber-50/50',
        };
      case 'NORMAL':
      default:
        return {
          bannerBg: 'bg-emerald-50 border-emerald-200',
          bannerText: 'text-emerald-800',
          dotBg: 'bg-emerald-500',
          tagBg: 'bg-emerald-100 text-emerald-700 border-emerald-200',
          tagText: 'SPACE AVAILABLE',
          headline: 'Safe Capacity — Entry Permitted',
          subtext: 'Plenty of space remains. You may enter immediately.',
          barColor: 'bg-emerald-500',
          barTrack: 'bg-emerald-100',
          textColor: 'text-emerald-600',
          metricColor: 'text-emerald-600',
          icon: <CheckCircle2 className="w-6 h-6 text-emerald-500" />,
          gateStatus: 'Door Unlocked & Open',
          gateIcon: <DoorOpen className="w-5 h-5 text-emerald-500" />,
          headerAccent: 'border-emerald-200 bg-emerald-50/50',
        };
    }
  };

  const theme = getStatusTheme();

  // Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 bg-white border border-slate-200 p-8 rounded-2xl shadow-md">
          <Activity className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-sm font-medium text-slate-800">Connecting to Sensor {code}...</p>
          <span className="text-xs text-slate-400">Retrieving real-time occupancy state</span>
        </div>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-md">
          <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-200 text-red-500 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Sensor Not Found</h2>
          <p className="text-slate-500 text-sm mb-6 leading-relaxed">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer border border-slate-200"
          >
            <ArrowLeft className="w-4 h-4" />
            Try Another Sensor Code
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col">

      {/* Top Header Bar */}
      <header className="w-full bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Portal</span>
            </button>
            <div className="hidden sm:block h-5 w-px bg-slate-200" />
            <div className="hidden sm:flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                {sensorInfo?.code || code}
              </span>
              <span className="text-sm font-semibold text-slate-800">
                {sensorInfo?.name || 'Facility Room'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {mqttConnected ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 text-red-600 border border-red-200 text-xs font-medium">
                <WifiOff className="w-3.5 h-3.5" />
                Offline
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Stale Warning Banner (full-width) */}
      {isStale && (
        <div className="w-full bg-amber-50 border-b border-amber-200 px-4 py-2.5">
          <div className="max-w-7xl mx-auto flex items-center gap-2.5 text-amber-700 text-xs font-medium">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
            <span>Sensor data may be outdated — no new readings in over 60 seconds.</span>
          </div>
        </div>
      )}

      {/* Main Content — Full Width Grid */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        
        {/* Mobile sensor label */}
        <div className="sm:hidden mb-4 flex items-center gap-2">
          <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
            {sensorInfo?.code || code}
          </span>
          <span className="text-sm font-semibold text-slate-800">{sensorInfo?.name || 'Facility Room'}</span>
        </div>

        {/* Row 1: Status Banner (full-width) */}
        <div className={`rounded-xl border p-4 sm:p-5 flex items-center gap-4 mb-6 ${theme.bannerBg}`}>
          <div className="shrink-0 p-2 rounded-xl bg-white/60 shadow-sm">
            {theme.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className={`text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded border ${theme.tagBg}`}>
                {theme.tagText}
              </span>
            </div>
            <h2 className={`text-lg sm:text-xl font-bold tracking-tight ${theme.bannerText}`}>
              {theme.headline}
            </h2>
            <p className={`text-xs sm:text-sm opacity-80 ${theme.bannerText}`}>
              {theme.subtext}
            </p>
          </div>
          <div className="hidden lg:flex items-center gap-2 shrink-0 text-xs text-slate-500">
            <MapPin className="w-3.5 h-3.5" />
            <span>{sensorInfo?.location || 'Main Building'}</span>
          </div>
        </div>

        {/* Row 2: Main Metrics Grid — 4 columns on desktop */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          
          {/* Card 1: Current Headcount (hero) */}
          <div className="col-span-2 bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-3">
              Current Headcount
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl sm:text-6xl font-black tracking-tight text-slate-900 font-mono tabular-nums leading-none">
                {occupancy}
              </span>
              <span className="text-2xl sm:text-3xl font-semibold text-slate-300 font-mono">
                / {capacity}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-3 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-blue-500" />
              Verified by IR entrance sensors
            </p>
          </div>

          {/* Card 2: Available Spaces */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
              Spaces Free
            </span>
            <span className="text-4xl font-black font-mono text-emerald-600 tabular-nums">
              {available}
            </span>
            <span className="text-[11px] text-slate-400 mt-2">Remaining entry slots</span>
          </div>

          {/* Card 3: Utilization % */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
              Utilization
            </span>
            <span className={`text-4xl font-black font-mono tabular-nums ${theme.metricColor}`}>
              {percentage}%
            </span>
            <span className="text-[11px] text-slate-400 mt-2">Capacity density</span>
          </div>
        </div>

        {/* Row 3: Progress Bar + Door Status + Data Freshness — 3 columns */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          
          {/* Capacity Progress Bar (spans 2 cols on desktop) */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex justify-between items-center text-sm font-semibold mb-3">
              <span className="text-slate-700">Capacity Progress</span>
              <span className={`font-mono ${theme.textColor}`}>{percentage}% Filled</span>
            </div>

            <div className={`w-full rounded-full h-4 p-0.5 overflow-hidden ${theme.barTrack}`}>
              <div
                className={`h-full rounded-full transition-all duration-700 ease-out ${theme.barColor}`}
                style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
              />
            </div>

            <div className="flex justify-between text-[11px] text-slate-400 mt-2">
              <span>0</span>
              <span>{Math.round(capacity * 0.5)}</span>
              <span>{capacity} (max)</span>
            </div>
          </div>

          {/* Right column: Door + Freshness stacked */}
          <div className="grid grid-cols-2 lg:grid-cols-1 gap-4">
            {/* Door Status */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-3">
              <div className="shrink-0 p-2 rounded-lg bg-slate-50 border border-slate-200">
                {theme.gateIcon}
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                  Door Barrier
                </span>
                <span className="text-sm font-bold text-slate-800">{theme.gateStatus}</span>
              </div>
            </div>

            {/* Data Freshness */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-3">
              <div className="shrink-0 p-2 rounded-lg bg-slate-50 border border-slate-200">
                <Clock className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                  Last Update
                </span>
                <span className="text-sm font-bold font-mono text-slate-800">
                  {secondsAgo === 0 ? 'Live Now' : `${secondsAgo}s ago`}
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full bg-white border-t border-slate-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-radar" />
            Real-time WebSocket active
          </span>

          <button
            onClick={() => navigate('/')}
            className="text-blue-600 hover:text-blue-700 font-medium hover:underline cursor-pointer"
          >
            Lookup Different Room →
          </button>
        </div>
      </footer>
    </div>
  );
};
