/**
 * Real-time Socket Service (Socket.IO)
 * Handles job requests, location updates, and chat
 */

import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

class RealtimeService {
  socket: Socket | null = null;
  token: string | null = null;
  listeners: Map<string, Set<Function>> = new Map();

  connect(token: string) {
    if (this.socket?.connected) return;

    this.token = token;
    this.socket = io(SOCKET_URL, {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket!.id);
      // Authenticate with token
      this.socket!.emit('auth:token', token);
    });

    this.socket.on('auth:ok', (data) => {
      console.log('Socket authenticated:', data);
    });

    this.socket.on('auth:failed', (data) => {
      console.error('Socket auth failed:', data);
      this.disconnect();
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    // Forward all events to listeners
    this.socket.onAny((event, ...args) => {
      this.emit(event, ...args);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: Function) {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.delete(callback);
    }
  }

  private emit(event: string, ...args: any[]) {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.forEach((cb) => cb(...args));
    }
  }

  // Emit to server
  send(event: string, data?: any) {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    }
  }

  // Fundi location update
  updateLocation(latitude: number, longitude: number, accuracy?: number) {
    this.send('fundi:location:update', { latitude, longitude, accuracy });
  }

  // Fundi response to job request
  respondToJobRequest(jobId: string, accept: boolean) {
    this.send('fundi:response', { jobId, accept });
  }

  // Send chat message
  sendMessage(jobId: string, content: string) {
    this.send('chat:send', { jobId, content });
  }
}

export const realtimeService = new RealtimeService();
