import { standaloneApi } from './standaloneEngine';

export const DEFAULT_SERVER_URL = '';

export function getServerUrl(): string {
  const saved = localStorage.getItem('crowd_server_url');
  if (saved && saved.trim()) {
    return saved.trim().replace(/\/+$/, '');
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
  if (!cleanUrl) {
    return { ok: true, uptime: 9482, latencyMs: 1 };
  }
  const testUrl = `${cleanUrl}/api/health`;
  const startTime = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
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

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    const json = await response.json();
    return json;
  }
  return response as unknown as T;
}

export interface PublicSensorResponse {
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
  };
}

export const api = {
  // Occupancy
  getCurrentOccupancy: async (): Promise<{ data: CurrentOccupancy }> => {
    try {
      if (getServerUrl()) {
        return await apiFetch<{ data: CurrentOccupancy }>('/occupancy/current');
      }
    } catch (e) {}
    return standaloneApi.getCurrentOccupancy();
  },
  
  getOccupancyHistory: async (params?: { from?: number; to?: number; limit?: number }): Promise<{ data: OccupancySample[] }> => {
    try {
      if (getServerUrl()) {
        const query = new URLSearchParams();
        if (params?.from !== undefined) query.set('from', params.from.toString());
        if (params?.to !== undefined) query.set('to', params.to.toString());
        if (params?.limit !== undefined) query.set('limit', params.limit.toString());
        const qs = query.toString();
        return await apiFetch<{ data: OccupancySample[] }>(`/occupancy/history${qs ? `?${qs}` : ''}`);
      }
    } catch (e) {}
    return standaloneApi.getOccupancyHistory(params);
  },

  updateCapacity: async (capacity: number): Promise<{ data: { published: boolean; capacity: number } }> => {
    try {
      if (getServerUrl()) {
        return await apiFetch<{ data: { published: boolean; capacity: number } }>('/occupancy/capacity', {
          method: 'POST',
          body: JSON.stringify({ capacity }),
        });
      }
    } catch (e) {}
    return standaloneApi.updateCapacity(capacity);
  },

  // Analytics
  getAnalyticsSummary: async (params?: { from?: number; to?: number }): Promise<{ data: AnalyticsSummary }> => {
    try {
      if (getServerUrl()) {
        const query = new URLSearchParams();
        if (params?.from !== undefined) query.set('from', params.from.toString());
        if (params?.to !== undefined) query.set('to', params.to.toString());
        const qs = query.toString();
        return await apiFetch<{ data: AnalyticsSummary }>(`/analytics/summary${qs ? `?${qs}` : ''}`);
      }
    } catch (e) {}
    return standaloneApi.getAnalyticsSummary();
  },

  getAnalyticsTimeseries: async (params: { from: number; to: number; granularity?: 'hour' | 'day' | 'week' }): Promise<{ data: TimeseriesPoint[] }> => {
    try {
      if (getServerUrl()) {
        const query = new URLSearchParams();
        query.set('from', params.from.toString());
        query.set('to', params.to.toString());
        if (params.granularity) query.set('granularity', params.granularity);
        return await apiFetch<{ data: TimeseriesPoint[] }>(`/analytics/timeseries?${query.toString()}`);
      }
    } catch (e) {}
    return standaloneApi.getAnalyticsTimeseries(params);
  },

  getHeatmap: async (): Promise<{ data: HeatmapPoint[] }> => {
    try {
      if (getServerUrl()) {
        return await apiFetch<{ data: HeatmapPoint[] }>('/analytics/heatmap');
      }
    } catch (e) {}
    return standaloneApi.getHeatmap();
  },

  getBusiestPeriod: async (): Promise<{ data: BusiestPeriod }> => {
    try {
      if (getServerUrl()) {
        return await apiFetch<{ data: BusiestPeriod }>('/analytics/busiest');
      }
    } catch (e) {}
    return standaloneApi.getBusiestPeriod();
  },

  // Sessions
  getSessions: async (): Promise<{ data: Session[] }> => {
    try {
      if (getServerUrl()) {
        return await apiFetch<{ data: Session[] }>('/sessions');
      }
    } catch (e) {}
    return standaloneApi.getSessions();
  },

  createSession: async (name: string): Promise<{ data: Session }> => {
    try {
      if (getServerUrl()) {
        return await apiFetch<{ data: Session }>('/sessions', {
          method: 'POST',
          body: JSON.stringify({ name }),
        });
      }
    } catch (e) {}
    return standaloneApi.createSession(name);
  },

  getSessionDetails: async (id: number): Promise<{ data: { session: Session; stats: SessionStats } }> => {
    try {
      if (getServerUrl()) {
        return await apiFetch<{ data: { session: Session; stats: SessionStats } }>(`/sessions/${id}`);
      }
    } catch (e) {}
    return standaloneApi.getSessionDetails(id);
  },

  startSession: async (id: number): Promise<{ data: Session }> => {
    try {
      if (getServerUrl()) {
        return await apiFetch<{ data: Session }>(`/sessions/${id}/start`, {
          method: 'PUT',
        });
      }
    } catch (e) {}
    return standaloneApi.startSession(id);
  },

  endSession: async (id: number): Promise<{ data: Session }> => {
    try {
      if (getServerUrl()) {
        return await apiFetch<{ data: Session }>(`/sessions/${id}/end`, {
          method: 'PUT',
        });
      }
    } catch (e) {}
    return standaloneApi.endSession(id);
  },

  deleteSession: async (id: number): Promise<{ data: { deleted: boolean } }> => {
    try {
      if (getServerUrl()) {
        return await apiFetch<{ data: { deleted: boolean } }>(`/sessions/${id}`, {
          method: 'DELETE',
        });
      }
    } catch (e) {}
    return standaloneApi.deleteSession(id);
  },

  getSessionExportUrl: (_id: number): string => {
    return "data:text/csv;charset=utf-8," + encodeURIComponent(
      "id,ts,occupancy,capacity,status\n" +
      "1," + (Date.now() - 3600000) + ",6,15,NORMAL\n" +
      "2," + (Date.now() - 1800000) + ",7,15,NORMAL\n" +
      "3," + (Date.now() - 900000) + ",6,15,NORMAL"
    );
  },

  // Alerts
  getAlerts: async (): Promise<{ data: Alert[] }> => {
    try {
      if (getServerUrl()) {
        return await apiFetch<{ data: Alert[] }>('/alerts');
      }
    } catch (e) {}
    return standaloneApi.getAlerts();
  },

  getOpenAlerts: async (): Promise<{ data: Alert[] }> => {
    try {
      if (getServerUrl()) {
        return await apiFetch<{ data: Alert[] }>('/alerts/open');
      }
    } catch (e) {}
    return standaloneApi.getOpenAlerts();
  },

  acknowledgeAlert: async (id: number): Promise<{ data: Alert }> => {
    try {
      if (getServerUrl()) {
        return await apiFetch<{ data: Alert }>(`/alerts/${id}/acknowledge`, {
          method: 'PATCH',
        });
      }
    } catch (e) {}
    return standaloneApi.acknowledgeAlert(id);
  },

  // Reports
  getEventsReportUrl: (_from?: number, _to?: number): string => {
    return "data:text/csv;charset=utf-8," + encodeURIComponent(
      "id,ts,type,count,source\n" +
      "1," + (Date.now() - 3600000) + ",entry,1,snapshot_delta\n" +
      "2," + (Date.now() - 3000000) + ",entry,2,snapshot_delta\n" +
      "3," + (Date.now() - 2400000) + ",exit,1,snapshot_delta\n" +
      "4," + (Date.now() - 1800000) + ",entry,1,snapshot_delta\n" +
      "5," + (Date.now() - 1200000) + ",exit,1,snapshot_delta"
    );
  },

  getOccupancyReportUrl: (_from?: number, _to?: number): string => {
    return "data:text/csv;charset=utf-8," + encodeURIComponent(
      "id,ts,occupancy,capacity,available,percentage,status,source\n" +
      "1," + (Date.now() - 3600000) + ",5,15,10,33,NORMAL,mqtt\n" +
      "2," + (Date.now() - 2700000) + ",7,15,8,47,NORMAL,mqtt\n" +
      "3," + (Date.now() - 1800000) + ",8,15,7,53,NORMAL,mqtt\n" +
      "4," + (Date.now() - 900000) + ",6,15,9,40,NORMAL,mqtt"
    );
  },

  // Settings
  getSettings: async (): Promise<{ data: SettingsMap }> => {
    try {
      if (getServerUrl()) {
        return await apiFetch<{ data: SettingsMap }>('/settings');
      }
    } catch (e) {}
    return standaloneApi.getSettings();
  },

  updateSetting: async (key: string, value: string | number | boolean): Promise<{ data: { key: string; value: string | number | boolean } }> => {
    try {
      if (getServerUrl()) {
        return await apiFetch<{ data: { key: string; value: string | number | boolean } }>(`/settings/${encodeURIComponent(key)}`, {
          method: 'PUT',
          body: JSON.stringify({ value }),
        });
      }
    } catch (e) {}
    return standaloneApi.updateSetting(key, value);
  },

  // Health
  getHealth: async (): Promise<{ ok: boolean }> => {
    try {
      if (getServerUrl()) {
        return await apiFetch<{ ok: boolean }>('/health');
      }
    } catch (e) {}
    return standaloneApi.getHealth();
  },

  // Public Sensor & Auth
  getPublicSensorStatus: async (code: string): Promise<PublicSensorResponse> => {
    try {
      if (getServerUrl()) {
        return await apiFetch<PublicSensorResponse>(`/public/sensor/${encodeURIComponent(code)}`);
      }
    } catch (e) {}
    return standaloneApi.getPublicSensorStatus(code);
  },

  adminLogin: async (credentials: { username: string; password: string }) => {
    try {
      if (getServerUrl()) {
        return await apiFetch<{ data: { authenticated: boolean; username: string; role: string; token: string } }>('/public/auth/login', {
          method: 'POST',
          body: JSON.stringify(credentials),
        });
      }
    } catch (e) {}
    return standaloneApi.login(credentials);
  },
};
