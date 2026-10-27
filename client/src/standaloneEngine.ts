/**
 * Standalone Embedded Prototype Engine
 * Provides 100% self-contained IoT simulation, persistence, and live data stream
 * so the CrowdMonitor Android APK functions completely standalone without needing a laptop.
 */

import { 
  CurrentOccupancy, 
  OccupancySample, 
  Session, 
  SessionStats, 
  Alert, 
  AnalyticsSummary, 
  TimeseriesPoint, 
  HeatmapPoint, 
  BusiestPeriod,
  SettingsMap 
} from './api';

// Internal simulated state
let simulatedCapacity = Number(localStorage.getItem('crowd_proto_capacity')) || 15;
let simulatedOccupancy = Number(localStorage.getItem('crowd_proto_occupancy')) || 6;
let lastMessageTime = Date.now();

// Generate 60 historical samples for initial rolling window
function generateInitialHistory(cap: number, occ: number): OccupancySample[] {
  const samples: OccupancySample[] = [];
  const now = Date.now();
  let tempOcc = occ;
  
  for (let i = 59; i >= 0; i--) {
    const ts = now - i * 5000;
    // slight variation
    const change = Math.floor(Math.random() * 3) - 1; // -1, 0, or 1
    tempOcc = Math.max(1, Math.min(cap + 2, tempOcc + change));
    const pct = Math.round((tempOcc / cap) * 100);
    const status = pct > 100 ? 'OVERLIMIT' : pct >= 80 ? 'FULL' : 'NORMAL';
    
    samples.push({
      id: 60 - i,
      ts,
      occupancy: tempOcc,
      capacity: cap,
      available: Math.max(0, cap - tempOcc),
      percentage: pct,
      status,
      source: 'mqtt'
    });
  }
  return samples;
}

let historyBuffer: OccupancySample[] = generateInitialHistory(simulatedCapacity, simulatedOccupancy);

// Default mock sessions
let mockSessions: Session[] = [
  {
    id: 1,
    name: 'Morning Keynote Presentation',
    state: 'ended',
    started_at: Date.now() - 14400000,
    ended_at: Date.now() - 7200000,
    capacity_at_start: 15,
    capacity_at_end: 15,
    notes: 'Completed without capacity breach.'
  },
  {
    id: 2,
    name: 'Afternoon Research Seminar',
    state: 'running',
    started_at: Date.now() - 3600000,
    ended_at: null,
    capacity_at_start: 15,
    capacity_at_end: null,
    notes: 'Active session currently monitored by ESP8266 IR sensors.'
  }
];

// Default mock alerts
let mockAlerts: Alert[] = [
  {
    id: 1,
    type: 'HIGH_CAPACITY_WARNING',
    ts_start: Date.now() - 1800000,
    ts_end: Date.now() - 1200000,
    occupancy: 13,
    capacity: 15,
    threshold_pct: 80,
    acknowledged_at: Date.now() - 1500000
  }
];

// Event subscribers for live simulation
type EventCallback = (data: any) => void;
const listeners: { [event: string]: EventCallback[] } = {};

export const standaloneEvents = {
  on(event: string, cb: EventCallback) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(cb);
  },
  off(event: string, cb: EventCallback) {
    if (!listeners[event]) return;
    listeners[event] = listeners[event].filter(l => l !== cb);
  },
  emit(event: string, data: any) {
    if (!listeners[event]) return;
    listeners[event].forEach(cb => {
      try { cb(data); } catch (e) { console.error('Sim event listener err:', e); }
    });
  }
};

// Start live IoT telemetry simulation ticker (every 4 seconds)
let simTickerStarted = false;
export function startSimulationTicker() {
  if (simTickerStarted) return;
  simTickerStarted = true;

  setInterval(() => {
    lastMessageTime = Date.now();
    // Randomly fluctuate occupancy slightly (+1, -1, or stay)
    const deltaOptions = [-1, 0, 1, 0];
    const delta = deltaOptions[Math.floor(Math.random() * deltaOptions.length)];
    
    simulatedOccupancy = Math.max(1, Math.min(simulatedCapacity + 1, simulatedOccupancy + delta));
    localStorage.setItem('crowd_proto_occupancy', String(simulatedOccupancy));

    const pct = Math.round((simulatedOccupancy / simulatedCapacity) * 100);
    const status: 'NORMAL' | 'FULL' | 'OVERLIMIT' = 
      pct > 100 ? 'OVERLIMIT' : pct >= 80 ? 'FULL' : 'NORMAL';

    const newSample: OccupancySample = {
      id: Date.now(),
      ts: lastMessageTime,
      occupancy: simulatedOccupancy,
      capacity: simulatedCapacity,
      available: Math.max(0, simulatedCapacity - simulatedOccupancy),
      percentage: pct,
      status,
      source: 'mqtt'
    };

    historyBuffer.push(newSample);
    if (historyBuffer.length > 120) historyBuffer.shift();

    // Broadcast live update to all listeners (overview, live monitor, header status)
    standaloneEvents.emit('occupancy:update', newSample);
    standaloneEvents.emit('mqtt:status', {
      connected: true,
      lastMessageAt: lastMessageTime,
      reconnectCount: 0,
      broker: 'HiveMQ Cloud'
    });

    // Check alert trigger
    if (pct >= 80 && Math.random() > 0.85) {
      const alertId = Date.now();
      const alert: Alert = {
        id: alertId,
        type: pct > 100 ? 'CAPACITY_OVERLIMIT' : 'WARNING_80_PERCENT',
        ts_start: Date.now(),
        ts_end: null,
        occupancy: simulatedOccupancy,
        capacity: simulatedCapacity,
        threshold_pct: pct,
        acknowledged_at: null
      };
      mockAlerts.unshift(alert);
      standaloneEvents.emit('alert:new', alert);
    }
  }, 4000);
}

// Ensure ticker starts immediately
if (typeof window !== 'undefined') {
  startSimulationTicker();
}

/**
 * Mock API handlers for Standalone Operation
 */
export const standaloneApi = {
  login: async (credentials: { username: string; password: string }) => {
    const { username, password } = credentials;
    // Accept standard demo admin / admin123 or admin
    if (username === 'admin' && (password === 'admin123' || password === 'admin')) {
      return {
        data: {
          authenticated: true,
          username: 'admin',
          role: 'admin',
          token: 'proto_jwt_' + Date.now()
        }
      };
    }
    throw new Error('Invalid credentials. Default: admin / admin123');
  },

  getPublicSensorStatus: async (code: string) => {
    const pct = Math.round((simulatedOccupancy / simulatedCapacity) * 100);
    const status: 'NORMAL' | 'FULL' | 'OVERLIMIT' = 
      pct > 100 ? 'OVERLIMIT' : pct >= 80 ? 'FULL' : 'NORMAL';

    return {
      data: {
        sensor: {
          code: code.toUpperCase(),
          name: code.toUpperCase() === 'ROOM-101' ? 'Main Conference Hall' : `Facility Zone ${code.toUpperCase()}`,
          location: 'Building A, Floor 1'
        },
        occupancy: simulatedOccupancy,
        capacity: simulatedCapacity,
        available: Math.max(0, simulatedCapacity - simulatedOccupancy),
        percentage: pct,
        status,
        lastUpdatedAt: lastMessageTime,
        isStale: false,
        mqttConnected: true
      }
    };
  },

  getCurrentOccupancy: async (): Promise<{ data: CurrentOccupancy }> => {
    const pct = Math.round((simulatedOccupancy / simulatedCapacity) * 100);
    const status: 'NORMAL' | 'FULL' | 'OVERLIMIT' = 
      pct > 100 ? 'OVERLIMIT' : pct >= 80 ? 'FULL' : 'NORMAL';

    return {
      data: {
        sample: {
          id: Date.now(),
          ts: lastMessageTime,
          occupancy: simulatedOccupancy,
          capacity: simulatedCapacity,
          available: Math.max(0, simulatedCapacity - simulatedOccupancy),
          percentage: pct,
          status,
          source: 'mqtt'
        },
        mqtt: {
          connected: true,
          lastMessageAt: lastMessageTime,
          reconnectCount: 0,
          broker: 'HiveMQ Cloud'
        },
        isStale: false
      }
    };
  },

  getOccupancyHistory: async (params?: { limit?: number }): Promise<{ data: OccupancySample[] }> => {
    const limit = params?.limit || 60;
    return {
      data: historyBuffer.slice(-limit)
    };
  },

  updateCapacity: async (newCapacity: number): Promise<{ data: { published: boolean; capacity: number } }> => {
    simulatedCapacity = Math.max(1, newCapacity);
    localStorage.setItem('crowd_proto_capacity', String(simulatedCapacity));
    
    // Immediately emit confirmation
    const pct = Math.round((simulatedOccupancy / simulatedCapacity) * 100);
    const sample: OccupancySample = {
      id: Date.now(),
      ts: Date.now(),
      occupancy: simulatedOccupancy,
      capacity: simulatedCapacity,
      available: Math.max(0, simulatedCapacity - simulatedOccupancy),
      percentage: pct,
      status: pct > 100 ? 'OVERLIMIT' : pct >= 80 ? 'FULL' : 'NORMAL',
      source: 'mqtt'
    };
    standaloneEvents.emit('occupancy:update', sample);

    return {
      data: {
        published: true,
        capacity: simulatedCapacity
      }
    };
  },

  getAnalyticsSummary: async (): Promise<{ data: AnalyticsSummary }> => {
    return {
      data: {
        peakOccupancy: Math.max(simulatedCapacity, simulatedOccupancy + 2),
        avgOccupancy: Math.round(simulatedCapacity * 0.55),
        totalEntries: 64,
        totalExits: 58,
        overCapacityMinutes: 0,
        sampleCount: 2840,
        hasEventTopics: false
      }
    };
  },

  getAnalyticsTimeseries: async (_params: { from: number; to: number; granularity?: string }): Promise<{ data: TimeseriesPoint[] }> => {
    const points: TimeseriesPoint[] = [];
    const now = Date.now();
    const hours = 12;
    for (let i = hours; i >= 0; i--) {
      const ts = now - i * 3600000;
      const d = new Date(ts);
      const bucket = `${d.getHours()}:00`;
      const baseOcc = Math.max(2, Math.floor(simulatedCapacity * 0.45) + (i % 4));
      points.push({
        bucket,
        ts,
        occupancy: baseOcc,
        avgOccupancy: baseOcc,
        peakOccupancy: baseOcc + 2,
        entries: Math.floor(Math.random() * 8) + 3,
        exits: Math.floor(Math.random() * 7) + 2,
        capacity: simulatedCapacity
      });
    }
    return { data: points };
  },

  getHeatmap: async (): Promise<{ data: HeatmapPoint[] }> => {
    const matrix: HeatmapPoint[] = [];
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        // Higher during 9am to 6pm on weekdays (1-5)
        const isWorkDay = day >= 1 && day <= 5;
        const isWorkHour = hour >= 9 && hour <= 18;
        const avg = isWorkDay && isWorkHour
          ? Math.round(simulatedCapacity * (0.5 + Math.sin((hour - 9) / 3) * 0.35))
          : Math.max(0, Math.round(simulatedCapacity * 0.1));
        
        matrix.push({
          dayOfWeek: day,
          hour,
          avgOccupancy: avg,
          sampleCount: 12
        });
      }
    }
    return { data: matrix };
  },

  getBusiestPeriod: async (): Promise<{ data: BusiestPeriod }> => {
    return {
      data: {
        busiestHour: { hour: 14, avgOccupancy: Math.round(simulatedCapacity * 0.85) },
        busiestDay: { dayOfWeek: 2, avgOccupancy: Math.round(simulatedCapacity * 0.75) }
      }
    };
  },

  getSessions: async (): Promise<{ data: Session[] }> => {
    return { data: [...mockSessions] };
  },

  createSession: async (name: string): Promise<{ data: Session }> => {
    const newSession: Session = {
      id: Date.now(),
      name,
      state: 'idle',
      started_at: null,
      ended_at: null,
      capacity_at_start: null,
      capacity_at_end: null,
      notes: null
    };
    mockSessions.unshift(newSession);
    return { data: newSession };
  },

  getSessionDetails: async (id: number): Promise<{ data: { session: Session; stats: SessionStats } }> => {
    const s = mockSessions.find(x => x.id === id) || mockSessions[0];
    return {
      data: {
        session: s,
        stats: {
          peakOccupancy: simulatedCapacity - 1,
          avgOccupancy: Math.round(simulatedCapacity * 0.6),
          totalEntries: 24,
          totalExits: 22,
          overCapacityDurationMinutes: 0,
          sampleCount: 140
        }
      }
    };
  },

  startSession: async (id: number): Promise<{ data: Session }> => {
    const s = mockSessions.find(x => x.id === id);
    if (s) {
      s.state = 'running';
      s.started_at = Date.now();
      s.capacity_at_start = simulatedCapacity;
    }
    return { data: s || mockSessions[0] };
  },

  endSession: async (id: number): Promise<{ data: Session }> => {
    const s = mockSessions.find(x => x.id === id);
    if (s) {
      s.state = 'ended';
      s.ended_at = Date.now();
      s.capacity_at_end = simulatedCapacity;
    }
    return { data: s || mockSessions[0] };
  },

  deleteSession: async (id: number): Promise<{ data: { deleted: boolean } }> => {
    mockSessions = mockSessions.filter(x => x.id !== id);
    return { data: { deleted: true } };
  },

  getAlerts: async (): Promise<{ data: Alert[] }> => {
    return { data: [...mockAlerts] };
  },

  getOpenAlerts: async (): Promise<{ data: Alert[] }> => {
    return { data: mockAlerts.filter(a => a.ts_end === null) };
  },

  acknowledgeAlert: async (id: number): Promise<{ data: Alert }> => {
    const a = mockAlerts.find(x => x.id === id);
    if (a) a.acknowledged_at = Date.now();
    return { data: a || mockAlerts[0] };
  },

  getSettings: async (): Promise<{ data: SettingsMap }> => {
    return {
      data: {
        warning_threshold_pct: '80',
        critical_threshold_pct: '100',
        facility_timezone: 'Asia/Kolkata',
        stale_threshold_seconds: '60',
        default_capacity: String(simulatedCapacity)
      }
    };
  },

  updateSetting: async (key: string, value: string | number | boolean) => {
    return { data: { key, value } };
  },

  getHealth: async () => {
    return { ok: true, uptime: 12040 };
  }
};
