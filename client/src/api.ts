export const DEFAULT_SERVER_URL = 'http://10.124.148.23:3001';

export function getServerUrl(): string {
  const saved = localStorage.getItem('crowd_server_url');
  if (saved && saved.trim()) {
    return saved.trim().replace(/\/+$/, '');
  }
  // In Capacitor Android, protocol is capacitor: or hostname is localhost with no port
  const isCapacitor = 
    typeof window !== 'undefined' && 
    (window.location.protocol === 'capacitor:' || 
     window.location.protocol === 'file:' || 
     (window.location.hostname === 'localhost' && !window.location.port));

  if (isCapacitor) {
    return DEFAULT_SERVER_URL;
  }
  return import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/+$/, '') : '';
}

export function setServerUrl(url: string): void {
  const cleanUrl = url.trim().replace(/\/+$/, '');
  localStorage.setItem('crowd_server_url', cleanUrl);
}

export function getApiBase(): string {
  const server = getServerUrl();
  return server ? `${server}/api` : '/api';
}

export async function testServerConnection(url: string): Promise<{
  ok: boolean;
  uptime?: number;
  latencyMs?: number;
  error?: string;
}> {
  const cleanUrl = url.trim().replace(/\/+$/, '');
  const testUrl = `${cleanUrl}/api/health`;
  const startTime = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(testUrl, { signal: controller.signal });
    clearTimeout(timer);
    const latencyMs = Date.now() - startTime;
    if (res.ok) {
      const data = await res.json();
      return { ok: true, uptime: data.uptime, latencyMs };
    } else {
      return { ok: false, error: `HTTP ${res.status}: ${res.statusText}` };
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { ok: false, error: 'Connection timed out (6s). Check IP & port.' };
    }
    return { ok: false, error: err.message || 'Cannot reach server' };
  }
}

export interface OccupancySample {
  id: number;
  ts: number;
  occupancy: number;
  capacity: number;
  available: number;
  percentage: number;
  status: 'NORMAL' | 'FULL' | 'OVERLIMIT';
  source: string;
}

export interface MqttStatus {
  connected: boolean;
  lastMessageAt: number | null;
  reconnectCount: number;
  broker: string;
}

export interface CurrentOccupancy {
  sample: OccupancySample | null;
  mqtt: MqttStatus;
  isStale: boolean;
}

export interface Session {
  id: number;
  name: string;
  state: 'idle' | 'running' | 'ended';
  started_at: number | null;
  ended_at: number | null;
  capacity_at_start: number | null;
  capacity_at_end: number | null;
  notes: string | null;
}

export interface SessionStats {
  peakOccupancy: number;
  avgOccupancy: number;
  totalEntries: number;
  totalExits: number;
  overCapacityDurationMinutes: number;
  sampleCount: number;
}

export interface Alert {
  id: number;
  type: string;
  ts_start: number;
  ts_end: number | null;
  occupancy: number;
  capacity: number;
  threshold_pct: number;
  acknowledged_at: number | null;
}

export interface AnalyticsSummary {
  peakOccupancy: number;
  avgOccupancy: number;
  totalEntries: number;
  totalExits: number;
  overCapacityMinutes: number;
  sampleCount: number;
  hasEventTopics: boolean;
}

export interface TimeseriesPoint {
  bucket: string;
  ts: number;
  occupancy: number;
  avgOccupancy: number;
  peakOccupancy: number;
  entries: number;
  exits: number;
  capacity?: number;
}

export interface HeatmapPoint {
  dayOfWeek: number; // 0 (Sun) - 6 (Sat)
  hour: number;      // 0 - 23
  avgOccupancy: number;
  sampleCount: number;
}

export interface BusiestPeriod {
  busiestHour: { hour: number; avgOccupancy: number } | null;
  busiestDay: { dayOfWeek: number; avgOccupancy: number } | null;
}

export interface SettingsMap {
  [key: string]: string | number | boolean;
}

async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const apiBase = getApiBase();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = endpoint.startsWith('http') ? endpoint : `${apiBase}${cleanEndpoint}`;
  
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const token = localStorage.getItem('crowd_admin_token');
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errorMsg = `API request failed with status ${response.status}`;
      try {
        const errJson = await response.json();
        if (errJson && errJson.message) {
          errorMsg = errJson.message;
        } else if (errJson && errJson.error) {
          errorMsg = errJson.error;
        }
      } catch {
        // not JSON
      }
      throw new Error(errorMsg);
    }

    // Handle blob or text if not json
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const json = await response.json();
      return json;
    }
    return response as unknown as T;
  } catch (err: any) {
    if (err.name === 'TypeError' && err.message && err.message.toLowerCase().includes('fetch')) {
      const targetHost = apiBase || window.location.origin;
      throw new Error(`Cannot reach server at ${targetHost}. Please check Server Settings and verify the backend is running.`);
    }
    throw err;
  }
}

export const api = {
  // Occupancy
  getCurrentOccupancy: async (): Promise<{ data: CurrentOccupancy }> => {
    return apiFetch<{ data: CurrentOccupancy }>('/occupancy/current');
  },
  
  getOccupancyHistory: async (params?: { from?: number; to?: number; limit?: number }): Promise<{ data: OccupancySample[] }> => {
    const query = new URLSearchParams();
    if (params?.from !== undefined) query.set('from', params.from.toString());
    if (params?.to !== undefined) query.set('to', params.to.toString());
    if (params?.limit !== undefined) query.set('limit', params.limit.toString());
    const qs = query.toString();
    return apiFetch<{ data: OccupancySample[] }>(`/occupancy/history${qs ? `?${qs}` : ''}`);
  },

  updateCapacity: async (capacity: number): Promise<{ data: { published: boolean; capacity: number } }> => {
    return apiFetch<{ data: { published: boolean; capacity: number } }>('/occupancy/capacity', {
      method: 'POST',
      body: JSON.stringify({ capacity }),
    });
  },

  // Analytics
  getAnalyticsSummary: async (params?: { from?: number; to?: number }): Promise<{ data: AnalyticsSummary }> => {
    const query = new URLSearchParams();
    if (params?.from !== undefined) query.set('from', params.from.toString());
    if (params?.to !== undefined) query.set('to', params.to.toString());
    const qs = query.toString();
    return apiFetch<{ data: AnalyticsSummary }>(`/analytics/summary${qs ? `?${qs}` : ''}`);
  },

  getAnalyticsTimeseries: async (params: { from: number; to: number; granularity?: 'hour' | 'day' | 'week' }): Promise<{ data: TimeseriesPoint[] }> => {
    const query = new URLSearchParams();
    query.set('from', params.from.toString());
    query.set('to', params.to.toString());
    if (params.granularity) query.set('granularity', params.granularity);
    return apiFetch<{ data: TimeseriesPoint[] }>(`/analytics/timeseries?${query.toString()}`);
  },

  getHeatmap: async (): Promise<{ data: HeatmapPoint[] }> => {
    return apiFetch<{ data: HeatmapPoint[] }>('/analytics/heatmap');
  },

  getBusiestPeriod: async (): Promise<{ data: BusiestPeriod }> => {
    return apiFetch<{ data: BusiestPeriod }>('/analytics/busiest');
  },

  // Sessions
  getSessions: async (): Promise<{ data: Session[] }> => {
    return apiFetch<{ data: Session[] }>('/sessions');
  },

  createSession: async (name: string): Promise<{ data: Session }> => {
    return apiFetch<{ data: Session }>('/sessions', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },

  getSessionDetails: async (id: number): Promise<{ data: { session: Session; stats: SessionStats } }> => {
    return apiFetch<{ data: { session: Session; stats: SessionStats } }>(`/sessions/${id}`);
  },

  startSession: async (id: number): Promise<{ data: Session }> => {
    return apiFetch<{ data: Session }>(`/sessions/${id}/start`, {
      method: 'PUT',
    });
  },

  endSession: async (id: number): Promise<{ data: Session }> => {
    return apiFetch<{ data: Session }>(`/sessions/${id}/end`, {
      method: 'PUT',
    });
  },

  deleteSession: async (id: number): Promise<{ data: { deleted: boolean } }> => {
    return apiFetch<{ data: { deleted: boolean } }>(`/sessions/${id}`, {
      method: 'DELETE',
    });
  },

  getSessionExportUrl: (id: number): string => {
    return `${getApiBase()}/sessions/${id}/export`;
  },

  // Alerts
  getAlerts: async (): Promise<{ data: Alert[] }> => {
    return apiFetch<{ data: Alert[] }>('/alerts');
  },

  getOpenAlerts: async (): Promise<{ data: Alert[] }> => {
    return apiFetch<{ data: Alert[] }>('/alerts/open');
  },

  acknowledgeAlert: async (id: number): Promise<{ data: Alert }> => {
    return apiFetch<{ data: Alert }>(`/alerts/${id}/acknowledge`, {
      method: 'PATCH',
    });
  },

  // Reports
  getEventsReportUrl: (from?: number, to?: number): string => {
    const q = new URLSearchParams();
    if (from !== undefined) q.set('from', from.toString());
    if (to !== undefined) q.set('to', to.toString());
    const qs = q.toString();
    return `${getApiBase()}/reports/events${qs ? `?${qs}` : ''}`;
  },

  getOccupancyReportUrl: (from?: number, to?: number): string => {
    const q = new URLSearchParams();
    if (from !== undefined) q.set('from', from.toString());
    if (to !== undefined) q.set('to', to.toString());
    const qs = q.toString();
    return `${getApiBase()}/reports/occupancy${qs ? `?${qs}` : ''}`;
  },

  // Settings
  getSettings: async (): Promise<{ data: SettingsMap }> => {
    return apiFetch<{ data: SettingsMap }>('/settings');
  },

  updateSetting: async (key: string, value: string | number | boolean): Promise<{ data: { key: string; value: string | number | boolean } }> => {
    return apiFetch<{ data: { key: string; value: string | number | boolean } }>(`/settings/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    });
  },

  // Health
  getHealth: async (): Promise<{ ok: boolean }> => {
    return apiFetch<{ ok: boolean }>('/health');
  },

  // Public Sensor & Auth
  getPublicSensorStatus: async (code: string): Promise<{
    data: {
      sensor: { code: string; name: string; location: string };
      occupancy: number;
      capacity: number;
      available: number;
      percentage: number;
      status: 'NORMAL' | 'FULL' | 'OVERLIMIT';
      lastUpdatedAt: number | null;
      isStale: boolean;
      mqttConnected: boolean;
    }
  }> => {
    return apiFetch(`/public/sensor/${encodeURIComponent(code)}`);
  },

  adminLogin: async (credentials: { username: string; password: string }): Promise<{
    data: { authenticated: boolean; username: string; role: string; token: string }
  }> => {
    return apiFetch('/public/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },
};
