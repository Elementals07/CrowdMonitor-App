/**
 * Direct HiveMQ Cloud MQTT Client
 * Connects directly over WebSockets (WSS) to HiveMQ Cloud.
 * Zero dependency on PC backend.
 */

import mqtt, { MqttClient } from 'mqtt';
import { OccupancySample, MqttStatus } from './api';
import { standaloneEvents } from './standaloneEngine';

export const HIVEMQ_WSS_URL = 'wss://c4102da92fbe4c4e867a3cd351dbf2aa.s1.eu.hivemq.cloud:8884/mqtt';
export const MQTT_CONFIG = {
  username: 'crowd_esp',
  password: '1234567890.',
  topics: {
    occupancy: 'crowd/occupancy',
    capacity: 'crowd/capacity',
    entry: 'crowd/entry',
    exit: 'crowd/exit',
  }
};

let client: MqttClient | null = null;
let isConnected = false;
let lastMessageAt: number | null = null;
let reconnectCount = 0;

// Current state extracted from live ESP8266 messages
let liveOccupancy = Number(localStorage.getItem('crowd_live_occupancy')) || 0;
let liveCapacity = Number(localStorage.getItem('crowd_live_capacity')) || 10;
let liveStatus: 'NORMAL' | 'FULL' | 'OVERLIMIT' = 'NORMAL';

export function getMqttClient(): MqttClient | null {
  return client;
}

export function getLiveMqttStatus(): MqttStatus {
  return {
    connected: isConnected,
    lastMessageAt,
    reconnectCount,
    broker: 'HiveMQ Cloud'
  };
}

export function getLiveOccupancyState() {
  const percentage = liveCapacity > 0 ? Math.round((liveOccupancy / liveCapacity) * 100) : 0;
  const available = Math.max(0, liveCapacity - liveOccupancy);
  return {
    occupancy: liveOccupancy,
    capacity: liveCapacity,
    available,
    percentage,
    status: liveStatus,
    lastMessageAt
  };
}

export function initMqttClient() {
  if (client) return client;

  const clientId = `CrowdMonitor-App-${Math.random().toString(16).substring(2, 10)}`;
  console.log('[MQTT] Connecting directly to HiveMQ Cloud via WSS...', HIVEMQ_WSS_URL);

  client = mqtt.connect(HIVEMQ_WSS_URL, {
    username: MQTT_CONFIG.username,
    password: MQTT_CONFIG.password,
    clientId,
    clean: true,
    reconnectPeriod: 4000,
    connectTimeout: 15000,
    protocolVersion: 4,
  });

  client.on('connect', () => {
    isConnected = true;
    reconnectCount = 0;
    console.log('[MQTT] Connected directly to HiveMQ Cloud broker');

    // Broadcast status
    standaloneEvents.emit('mqtt:status', getLiveMqttStatus());

    // Subscribe to all topics with QoS 1
    const topicsToSub = [
      MQTT_CONFIG.topics.occupancy,
      MQTT_CONFIG.topics.capacity,
      MQTT_CONFIG.topics.entry,
      MQTT_CONFIG.topics.exit,
    ];

    client?.subscribe(topicsToSub, { qos: 1 }, (err) => {
      if (err) {
        console.error('[MQTT] Subscription error:', err.message);
      } else {
        console.log('[MQTT] Successfully subscribed to topics:', topicsToSub);
      }
    });
  });

  client.on('message', (topic, payloadBuffer) => {
    lastMessageAt = Date.now();
    const payloadStr = payloadBuffer.toString();
    console.log(`[MQTT] Message received on [${topic}]:`, payloadStr);

    if (topic === MQTT_CONFIG.topics.occupancy) {
      try {
        const data = JSON.parse(payloadStr);
        if (typeof data.occupancy === 'number') liveOccupancy = data.occupancy;
        if (typeof data.capacity === 'number') liveCapacity = data.capacity;
        
        const pct = liveCapacity > 0 ? Math.round((liveOccupancy / liveCapacity) * 100) : 0;
        const avail = Math.max(0, liveCapacity - liveOccupancy);
        const st: 'NORMAL' | 'FULL' | 'OVERLIMIT' = data.status || (pct > 100 ? 'OVERLIMIT' : pct >= 80 ? 'FULL' : 'NORMAL');
        liveStatus = st;

        // Persist real values
        localStorage.setItem('crowd_live_occupancy', String(liveOccupancy));
        localStorage.setItem('crowd_live_capacity', String(liveCapacity));
        localStorage.setItem('crowd_last_msg_at', String(lastMessageAt));

        const sample: OccupancySample = {
          id: Date.now(),
          ts: lastMessageAt,
          occupancy: liveOccupancy,
          capacity: liveCapacity,
          available: typeof data.available === 'number' ? data.available : avail,
          percentage: typeof data.percentage === 'number' ? data.percentage : pct,
          status: liveStatus,
          source: 'mqtt'
        };

        // Notify all app UI listeners (LiveMonitor, Overview, UserView, Header)
        standaloneEvents.emit('occupancy:update', sample);
        standaloneEvents.emit('mqtt:status', getLiveMqttStatus());

        // Check for capacity alerts
        if (pct >= 80) {
          standaloneEvents.emit('alert:new', {
            id: Date.now(),
            type: pct > 100 ? 'CAPACITY_OVERLIMIT' : 'WARNING_80_PERCENT',
            ts_start: Date.now(),
            ts_end: null,
            occupancy: liveOccupancy,
            capacity: liveCapacity,
            threshold_pct: pct,
            acknowledged_at: null
          });
        }
      } catch (e) {
        console.error('[MQTT] Failed to parse occupancy JSON:', e);
      }
    } else if (topic === MQTT_CONFIG.topics.capacity) {
      const parsedCap = parseInt(payloadStr, 10);
      if (!isNaN(parsedCap) && parsedCap > 0) {
        liveCapacity = parsedCap;
        localStorage.setItem('crowd_live_capacity', String(liveCapacity));
        const sample: OccupancySample = {
          id: Date.now(),
          ts: Date.now(),
          occupancy: liveOccupancy,
          capacity: liveCapacity,
          available: Math.max(0, liveCapacity - liveOccupancy),
          percentage: liveCapacity > 0 ? Math.round((liveOccupancy / liveCapacity) * 100) : 0,
          status: liveStatus,
          source: 'mqtt'
        };
        standaloneEvents.emit('occupancy:update', sample);
      }
    }
  });

  client.on('reconnect', () => {
    reconnectCount++;
    isConnected = false;
    console.warn(`[MQTT] Reconnecting to HiveMQ Cloud (attempt ${reconnectCount})...`);
    standaloneEvents.emit('mqtt:status', getLiveMqttStatus());
  });

  client.on('offline', () => {
    isConnected = false;
    console.warn('[MQTT] Offline from broker');
    standaloneEvents.emit('mqtt:status', getLiveMqttStatus());
  });

  client.on('error', (err) => {
    isConnected = false;
    console.error('[MQTT] Error:', err.message);
    standaloneEvents.emit('mqtt:status', getLiveMqttStatus());
  });

  client.on('close', () => {
    isConnected = false;
    standaloneEvents.emit('mqtt:status', getLiveMqttStatus());
  });

  return client;
}

/**
 * Publishes capacity adjustment directly to HiveMQ Cloud topic `crowd/capacity`
 * with retain: true and qos: 1 so the ESP8266 gets it immediately.
 */
export async function publishCapacityDirect(newCapacity: number): Promise<boolean> {
  const capVal = Math.max(1, newCapacity);
  liveCapacity = capVal;
  localStorage.setItem('crowd_live_capacity', String(capVal));

  if (!client || !isConnected) {
    console.warn('[MQTT] Cannot publish capacity, broker not connected');
    return false;
  }

  return new Promise((resolve) => {
    client?.publish(
      MQTT_CONFIG.topics.capacity,
      String(capVal),
      { qos: 1, retain: true },
      (err) => {
        if (err) {
          console.error('[MQTT] Failed to publish capacity:', err);
          resolve(false);
        } else {
          console.log(`[MQTT] Published capacity ${capVal} with retain: true, QoS: 1`);
          resolve(true);
        }
      }
    );
  });
}
