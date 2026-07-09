/**
 * Core WebSocket client — real-time EventBus feed from Kiaros Core
 * (ws://localhost:3010/ws). HTTP polling in jarvisStore remains the
 * authority for connection state; this socket adds push updates
 * (mode:changed, service health events) and immediate open/close
 * awareness. Reconnects with capped exponential backoff; a heartbeat
 * ping detects dead sockets. Honors the optional shared-secret via
 * coreWsQuery() (VITE_KIAROS_CORE_TOKEN).
 */

import { coreWsQuery } from './coreAuth';

/** SystemEvent as serialized by the Core WebSocketManager broadcast. */
export interface CoreSystemEvent {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  source: string;
  message: string;
  data?: unknown;
  timestamp: string;
}

export interface CoreSocketHandlers {
  onEvent?: (event: CoreSystemEvent) => void;
  onOpen?: () => void;
  onClose?: () => void;
}

const WS_URL = 'ws://localhost:3010/ws';
const BACKOFF_MIN_MS = 1_000;
const BACKOFF_MAX_MS = 30_000;
const HEARTBEAT_INTERVAL_MS = 20_000;
const PONG_TIMEOUT_MS = 5_000;

class CoreSocket {
  private ws: WebSocket | null = null;
  private handlers: CoreSocketHandlers = {};
  private backoffMs = BACKOFF_MIN_MS;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private pongTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = true;

  /** Idempotent — StrictMode double-mounts must not open a second socket. */
  start(handlers: CoreSocketHandlers): void {
    this.handlers = handlers;
    if (!this.stopped) {
      return;
    }
    this.stopped = false;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    this.clearTimers();
    if (this.ws) {
      // Detach first so the close handler doesn't schedule a reconnect.
      this.ws.onclose = null;
      this.ws.close(1000, 'client shutdown');
      this.ws = null;
    }
  }

  isOpen(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private connect(): void {
    if (this.stopped) {
      return;
    }
    try {
      this.ws = new WebSocket(`${WS_URL}${coreWsQuery()}`);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.backoffMs = BACKOFF_MIN_MS;
      this.startHeartbeat();
      this.handlers.onOpen?.();
    };
    this.ws.onmessage = (message) => {
      this.handleMessage(String(message.data));
    };
    this.ws.onclose = () => {
      this.clearTimers();
      this.ws = null;
      this.handlers.onClose?.();
      this.scheduleReconnect();
    };
    // Errors are always followed by close; reconnect is handled there.
    this.ws.onerror = () => {};
  }

  private handleMessage(raw: string): void {
    let parsed: { type?: string; data?: unknown };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }

    switch (parsed.type) {
      case 'event':
        this.handlers.onEvent?.(parsed.data as CoreSystemEvent);
        break;
      case 'pong':
        if (this.pongTimer) {
          clearTimeout(this.pongTimer);
          this.pongTimer = null;
        }
        break;
      case 'connected':
      case 'subscribed':
      case 'unsubscribed':
        break;
      default:
        break;
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (!this.isOpen()) {
        return;
      }
      this.ws!.send(JSON.stringify({ type: 'ping' }));
      this.pongTimer = setTimeout(() => {
        // No pong: the socket is dead — close triggers reconnect.
        this.ws?.close();
      }, PONG_TIMEOUT_MS);
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
  }

  private clearTimers(): void {
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.reconnectTimer) {
      return;
    }
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.backoffMs);
    this.backoffMs = Math.min(this.backoffMs * 2, BACKOFF_MAX_MS);
  }
}

/** Single shared socket for the Desktop app. */
export const coreSocket = new CoreSocket();
