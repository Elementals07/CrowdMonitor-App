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

import { 
  initMqttClient, 
  getLiveOccupancyState, 
  getLiveMqttStatus, 
  publishCapacityDirect 
} from './mqttClient';

// Real IoT occupancy and capacity tracking from HiveMQ Cloud
let liveOccupancy = Number(localStorage.getItem('crowd_live_occupancy')) || 0;
let liveCapacity = Number(localStorage.getItem('crowd_live_capacity')) || 15;

function loadStoredHistory(): OccupancySample[] {
  try {
    const raw = localStorage.getItem('crowd_live_history');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {}

  // Fallback initial baseline using current live occupancy
  const samples: OccupancySample[] = [];
  const now = Date.now();
  for (let i = 19; i >= 0; i--) {
    const pct = liveCapacity > 0 ? Math.round((liveOccupancy / liveCapacity) * 100) : 0;
    samples.push({
      id: Date.now() - i * 5000,
      ts: now - i * 5000,
      occupancy: liveOccupancy,
      capacity: liveCapacity,
      available: Math.max(0, liveCapacity - liveOccupancy),
      percentage: pct,
      status: pct > 100 ? 'OVERLIMIT' : pct >= 80 ? 'FULL' : 'NORMAL',
      source: 'mqtt'
    });
  }
  return samples;
}

let historyBuffer: OccupancySample[] = loadStoredHistory();

// Default mock sessions
let mockSessions: Session[] = [
  {
    id: 1,
    name: 'Facility Room Session',
    state: 'running',
    started_at: Date.now() - 3600000,
    ended_at: null,
    capacity_at_start: liveCapacity,
    capacity_at_end: null,
    notes: 'Active session monitored directly via NodeMCU ESP8266 and HiveMQ Cloud.'
  }
];

// Default alerts
let mockAlerts: Alert[] = [];

// Event subscribers for live direct HiveMQ stream
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
      try { cb(data); } catch (e) { console.error('Event listener err:', e); }
    });
  }
};

// Store real samples received from HiveMQ into the rolling history
standaloneEvents.on('occupancy:update', (sample: OccupancySample) => {
  if (sample && typeof sample.occupancy === 'number') {
    liveOccupancy = sample.occupancy;
    liveCapacity = sample.capacity;
    historyBuffer.push(sample);
    if (historyBuffer.length > 120) historyBuffer.shift();
    try {
      localStorage.setItem('crowd_live_history', JSON.stringify(historyBuffer.slice(-60)));
    } catch (e) {}
  }
});

standaloneEvents.on('alert:new', (alert: Alert) => {
  if (alert) {
    mockAlerts.unshift(alert);
    if (mockAlerts.length > 30) mockAlerts.pop();
  }
});

// Initialize direct HiveMQ MQTT connection immediately on device startup
if (typeof window !== 'undefined') {
  initMqttClient();
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
    const live = getLiveOccupancyState();
    const mqttState = getLiveMqttStatus();

    return {
      data: {
        sensor: {
          code: code.toUpperCase(),
          name: code.toUpperCase() === 'ROOM-101' ? 'Main Conference Hall' : `Facility Zone ${code.toUpperCase()}`,
          location: 'Building A, Floor 1'
        },
        occupancy: live.occupancy,
        capacity: live.capacity,
        available: live.available,
        percentage: live.percentage,
        status: live.status,
        lastUpdatedAt: live.lastMessageAt || Date.now(),
        isStale: live.lastMessageAt ? (Date.now() - live.lastMessageAt > 60000) : false,
        mqttConnected: mqttState.connected
      }
    };
  },

  getCurrentOccupancy: async (): Promise<{ data: CurrentOccupancy }> => {
    const live = getLiveOccupancyState();
    const mqttState = getLiveMqttStatus();
    const isStale = live.lastMessageAt ? (Date.now() - live.lastMessageAt > 60000) : false;

    return {
      data: {
        sample: {
          id: Date.now(),
          ts: live.lastMessageAt || Date.now(),
          occupancy: live.occupancy,
          capacity: live.capacity,
          available: live.available,
          percentage: live.percentage,
          status: live.status,
          source: 'mqtt'
        },
        mqtt: mqttState,
        isStale
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
    const targetCapacity = Math.max(1, newCapacity);
    const published = await publishCapacityDirect(targetCapacity);
    
    // Also emit immediate local UI update
    const live = getLiveOccupancyState();
    const sample: OccupancySample = {
      id: Date.now(),
      ts: Date.now(),
      occupancy: live.occupancy,
      capacity: targetCapacity,
      available: Math.max(0, targetCapacity - live.occupancy),
      percentage: targetCapacity > 0 ? Math.round((live.occupancy / targetCapacity) * 100) : 0,
      status: live.occupancy > targetCapacity ? 'OVERLIMIT' : (live.occupancy / targetCapacity) >= 0.8 ? 'FULL' : 'NORMAL',
      source: 'mqtt'
    };
    standaloneEvents.emit('occupancy:update', sample);

    return {
      data: {
        published,
        capacity: targetCapacity
      }
    };
  },

  getAnalyticsSummary: async (): Promise<{ data: AnalyticsSummary }> => {
    const live = getLiveOccupancyState();
    return {
      data: {
        peakOccupancy: Math.max(live.capacity, live.occupancy),
        avgOccupancy: Math.round(live.occupancy * 0.9),
        totalEntries: live.occupancy + 12,
        totalExits: 12,
        overCapacityMinutes: 0,
        sampleCount: historyBuffer.length,
        hasEventTopics: true
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
      const baseOcc = Math.max(2, Math.floor(liveCapacity * 0.45) + (i % 4));
      points.push({
        bucket,
        ts,
        occupancy: baseOcc,
        avgOccupancy: baseOcc,
        peakOccupancy: baseOcc + 2,
        entries: Math.floor(Math.random() * 8) + 3,
        exits: Math.floor(Math.random() * 7) + 2,
        capacity: liveCapacity
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
          ? Math.round(liveCapacity * (0.5 + Math.sin((hour - 9) / 3) * 0.35))
          : Math.max(0, Math.round(liveCapacity * 0.1));
        
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
        busiestHour: { hour: 14, avgOccupancy: Math.round(liveCapacity * 0.85) },
        busiestDay: { dayOfWeek: 2, avgOccupancy: Math.round(liveCapacity * 0.75) }
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
          peakOccupancy: liveCapacity - 1,
          avgOccupancy: Math.round(liveCapacity * 0.6),
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
      s.capacity_at_start = liveCapacity;
    }
    return { data: s || mockSessions[0] };
  },

  endSession: async (id: number): Promise<{ data: Session }> => {
    const s = mockSessions.find(x => x.id === id);
    if (s) {
      s.state = 'ended';
      s.ended_at = Date.now();
      s.capacity_at_end = liveCapacity;
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
        default_capacity: String(liveCapacity)
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
