/**
 * Event Bus Service
 * Central event management for Jarvis
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';
import type { SystemEvent, SystemEventType } from '../../../shared/types/index.js';

export class EventBus extends EventEmitter {
  private events: SystemEvent[] = [];
  private readonly maxEvents: number;

  constructor(maxEvents = 1000) {
    super();
    this.maxEvents = maxEvents;
    this.setMaxListeners(100);
  }

  emitEvent(type: SystemEventType, severity: 'info' | 'warning' | 'error' | 'critical', source: string, message: string, data?: unknown): void {
    const event: SystemEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity,
      source,
      message,
      data,
      timestamp: new Date(),
    };

    this.events.push(event);
    
    // Trim if exceeding max
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }

    // Emit to listeners
    this.emit(type, event);
    this.emit('*', event);

    // Log based on severity
    switch (severity) {
      case 'critical':
        logger.error(`[CRITICAL] ${source}: ${message}`, data);
        break;
      case 'error':
        logger.error(`${source}: ${message}`, data);
        break;
      case 'warning':
        logger.warn(`${source}: ${message}`, data);
        break;
      default:
        logger.info(`${source}: ${message}`, data);
    }
  }

  getEvents(options?: {
    type?: SystemEventType;
    severity?: string;
    limit?: number;
  }): SystemEvent[] {
    let filtered = [...this.events];

    if (options?.type) {
      filtered = filtered.filter(e => e.type === options.type);
    }

    if (options?.severity) {
      filtered = filtered.filter(e => e.severity === options.severity);
    }

    // Sort by timestamp descending
    filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (options?.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  clearEvents(): void {
    this.events = [];
    logger.info('Event history cleared');
  }
}
