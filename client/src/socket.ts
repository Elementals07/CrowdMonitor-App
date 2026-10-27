import { io, Socket } from 'socket.io-client';
import { getServerUrl, setServerUrl, DEFAULT_SERVER_URL } from './api';
import { standaloneEvents } from './standaloneEngine';

let socketInstance: Socket | null = null;

function resolveSocketUrl(): string {
  const configured = getServerUrl();
  if (configured) return configured;
  
  if (typeof window !== 'undefined' && 
      (window.location.protocol === 'capacitor:' || 
       window.location.protocol === 'file:' || 
       (window.location.hostname === 'localhost' && !window.location.port))) {
    return DEFAULT_SERVER_URL;
  }
  return import.meta.env.VITE_SOCKET_URL || '/';
}

export function getSocket(): Socket {
  if (!socketInstance) {
    try {
      const targetUrl = resolveSocketUrl();
      socketInstance = io(targetUrl, {
        path: '/socket.io',
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 3,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        transports: ['websocket', 'polling'],
        timeout: 4000
      });
    } catch (e) {
      // In standalone mode, socketInstance can be null
    }
  }
  return socketInstance as Socket;
}

export function reconnectSocket(newUrl?: string): Socket {
  if (newUrl) {
    setServerUrl(newUrl);
  }
  if (socketInstance) {
    try {
      socketInstance.disconnect();
      socketInstance.removeAllListeners();
    } catch (e) {}
    socketInstance = null;
  }
  return getSocket();
}

// Transparent Proxy that bridges both real WebSocket and embedded Standalone Simulation
export const socket = new Proxy({} as Socket, {
  get(_target, prop) {
    if (prop === 'on') {
      return (event: string, cb: any) => {
        // Register with embedded standalone IoT engine
        standaloneEvents.on(event, cb);
        // Also register with network socket if available
        try {
          const s = getSocket();
          if (s && typeof s.on === 'function') s.on(event, cb);
        } catch (e) {}
      };
    }

    if (prop === 'off') {
      return (event: string, cb: any) => {
        standaloneEvents.off(event, cb);
        try {
          const s = getSocket();
          if (s && typeof s.off === 'function') s.off(event, cb);
        } catch (e) {}
      };
    }

    const s = getSocket();
    if (!s) return () => {};
    const val = (s as any)[prop];
    return typeof val === 'function' ? val.bind(s) : val;
  }
});
