import { io, Socket } from 'socket.io-client';
import { getServerUrl, setServerUrl, DEFAULT_SERVER_URL } from './api';

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
    const targetUrl = resolveSocketUrl();
    socketInstance = io(targetUrl, {
      path: '/socket.io',
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      transports: ['websocket', 'polling']
    });
  }
  return socketInstance;
}

export function reconnectSocket(newUrl?: string): Socket {
  if (newUrl) {
    setServerUrl(newUrl);
  }
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance.removeAllListeners();
    socketInstance = null;
  }
  return getSocket();
}

// Transparent Proxy so all existing `import { socket } from '...'` continue to work dynamically
export const socket = new Proxy({} as Socket, {
  get(_target, prop) {
    const s = getSocket();
    const val = (s as any)[prop];
    return typeof val === 'function' ? val.bind(s) : val;
  }
});
