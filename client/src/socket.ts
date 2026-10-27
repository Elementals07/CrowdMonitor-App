import { io } from 'socket.io-client';

// Use '/' so the Vite proxy handles it in development
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '/';

export const socket = io(SOCKET_URL, {
  path: '/socket.io',
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
});
