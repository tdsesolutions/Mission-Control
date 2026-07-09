/**
 * WebSocket Manager
 * Manages WebSocket connections for real-time updates
 */

import { WebSocketServer, WebSocket } from 'ws';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';
import { EventBus } from './eventBus.js';
import type { SystemEvent } from '../../../shared/types/index.js';

interface ClientInfo {
  ws: WebSocket;
  id: string;
  connectedAt: Date;
  subscriptions: string[];
  /** Liveness flag for the protocol-level ping sweep (dead-socket reaping). */
  alive: boolean;
}

const LIVENESS_SWEEP_MS = 30_000;

export class WebSocketManager {
  private wss: WebSocketServer;
  private eventBus: EventBus;
  private clients: Map<string, ClientInfo> = new Map();
  private initialized = false;
  private livenessTimer: ReturnType<typeof setInterval> | null = null;

  constructor(wss: WebSocketServer, eventBus: EventBus) {
    this.wss = wss;
    this.eventBus = eventBus;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    logger.info('Initializing WebSocket Manager...');

    // Setup WebSocket server
    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    // Subscribe to all events
    this.eventBus.on('*', (event: SystemEvent) => {
      this.broadcastEvent(event);
    });

    // Half-open TCP connections never fire 'close' on their own — sweep
    // with protocol pings and terminate anything that missed a pong.
    this.livenessTimer = setInterval(() => {
      for (const [clientId, client] of this.clients) {
        if (!client.alive) {
          logger.info(`Reaping unresponsive WebSocket client: ${clientId}`);
          client.ws.terminate();
          this.clients.delete(clientId);
          continue;
        }
        client.alive = false;
        try { client.ws.ping(); } catch { /* close event will clean up */ }
      }
    }, LIVENESS_SWEEP_MS);

    this.initialized = true;
    logger.info('WebSocket Manager initialized');
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down WebSocket Manager...');

    if (this.livenessTimer) {
      clearInterval(this.livenessTimer);
      this.livenessTimer = null;
    }

    // Close all client connections
    for (const client of this.clients.values()) {
      client.ws.close(1000, 'Server shutting down');
    }
    this.clients.clear();

    logger.info('WebSocket Manager shutdown complete');
  }

  private handleConnection(ws: WebSocket, req: any): void {
    // Optional shared-secret (mirrors the HTTP middleware): when
    // KIAROS_CORE_TOKEN is set, /ws requires ?token=<value>.
    if (config.security.coreToken) {
      const url = new URL(String(req?.url ?? '/ws'), 'http://localhost');
      if (url.searchParams.get('token') !== config.security.coreToken) {
        logger.warn('WebSocket connection rejected: bad or missing token');
        ws.close(1008, 'unauthorized');
        return;
      }
    }

    const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const clientInfo: ClientInfo = {
      ws,
      id: clientId,
      connectedAt: new Date(),
      subscriptions: [],
      alive: true,
    };

    this.clients.set(clientId, clientInfo);
    logger.info(`WebSocket client connected: ${clientId}`);

    ws.on('pong', () => {
      clientInfo.alive = true;
    });

    // Send welcome message
    this.sendToClient(clientId, {
      type: 'connected',
      data: { clientId, timestamp: new Date() },
    });

    // Handle messages
    ws.on('message', (data) => {
      this.handleMessage(clientId, data.toString());
    });

    // Handle close
    ws.on('close', (code, reason) => {
      logger.info(`WebSocket client disconnected: ${clientId} (code: ${code})`);
      this.clients.delete(clientId);
    });

    // Handle errors
    ws.on('error', (error) => {
      logger.error(`WebSocket error for client ${clientId}:`, error);
    });
  }

  private handleMessage(clientId: string, message: string): void {
    try {
      const data = JSON.parse(message);
      const client = this.clients.get(clientId);

      if (!client) {
        logger.warn(`Message from unknown client: ${clientId}`);
        return;
      }

      switch (data.type) {
        case 'subscribe':
          if (data.events && Array.isArray(data.events)) {
            client.subscriptions = [...new Set([...client.subscriptions, ...data.events])];
            this.sendToClient(clientId, {
              type: 'subscribed',
              data: { events: client.subscriptions },
            });
          }
          break;

        case 'unsubscribe':
          if (data.events && Array.isArray(data.events)) {
            client.subscriptions = client.subscriptions.filter(e => !data.events.includes(e));
            this.sendToClient(clientId, {
              type: 'unsubscribed',
              data: { events: client.subscriptions },
            });
          }
          break;

        case 'ping':
          this.sendToClient(clientId, { type: 'pong', timestamp: new Date() });
          break;

        default:
          logger.debug(`Unknown message type from ${clientId}: ${data.type}`);
      }
    } catch (error) {
      logger.error(`Failed to handle message from ${clientId}:`, error);
    }
  }

  private sendToClient(clientId: string, data: unknown): void {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(data));
    }
  }

  private broadcastEvent(event: SystemEvent): void {
    const message = JSON.stringify({
      type: 'event',
      data: event,
    });

    for (const client of this.clients.values()) {
      if (client.ws.readyState === WebSocket.OPEN) {
        // Check if client is subscribed to this event type
        if (client.subscriptions.length === 0 || 
            client.subscriptions.includes(event.type) ||
            client.subscriptions.includes('*')) {
          client.ws.send(message);
        }
      }
    }
  }

  broadcast(type: string, data: unknown): void {
    const message = JSON.stringify({ type, data });

    for (const client of this.clients.values()) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
      }
    }
  }

  getConnectedClients(): number {
    return this.clients.size;
  }
}
