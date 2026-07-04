/**
 * Events Route
 * Handle system events and notifications
 */

import { Router } from 'express';
import { logger } from '../../utils/logger.js';
import type { SystemEvent, SystemEventType } from '../../../../shared/types/index.js';

const router = Router();

// In-memory event store (will integrate with event bus)
const events: SystemEvent[] = [];
const MAX_EVENTS = 1000;

router.get('/', (req, res) => {
  const type = req.query.type as SystemEventType | undefined;
  const severity = req.query.severity as string | undefined;
  const limit = parseInt(req.query.limit as string) || 50;
  
  let eventList = [...events];
  
  if (type) {
    eventList = eventList.filter(e => e.type === type);
  }
  
  if (severity) {
    eventList = eventList.filter(e => e.severity === severity);
  }
  
  // Sort by timestamp descending
  eventList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  
  // Apply limit
  eventList = eventList.slice(0, limit);
  
  res.json({
    success: true,
    data: eventList,
    timestamp: new Date(),
    requestId: req.headers['x-request-id'] || 'unknown',
  });
});

router.post('/', (req, res) => {
  const { type, severity, source, message, data } = req.body;
  
  if (!type || !message) {
    res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_FIELDS',
        message: 'Event type and message are required',
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown',
    });
    return;
  }
  
  const event: SystemEvent = {
    id: `evt_${Date.now()}`,
    type: type as SystemEventType,
    severity: severity || 'info',
    source: source || 'jarvis-core',
    message,
    data,
    timestamp: new Date(),
  };
  
  events.push(event);
  
  // Trim events if exceeding max
  if (events.length > MAX_EVENTS) {
    events.shift();
  }
  
  logger.info(`Event recorded: ${type} - ${message}`);
  
  res.status(201).json({
    success: true,
    data: event,
    timestamp: new Date(),
    requestId: req.headers['x-request-id'] || 'unknown',
  });
});

export { router as eventsRouter };
