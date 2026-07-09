/**
 * Events Route
 * Handle system events and notifications — backed by the shared EventBus,
 * so this endpoint returns the same event history the WebSocket broadcasts
 * from, and events posted here reach every bus subscriber.
 */

import { Router } from 'express';
import { getEventBus } from '../../services/eventBus.js';
import type { SystemEvent, SystemEventType } from '../../../../shared/types/index.js';

const router = Router();

const VALID_SEVERITIES = ['info', 'warning', 'error', 'critical'] as const;
type Severity = (typeof VALID_SEVERITIES)[number];

router.get('/', (req, res) => {
  const bus = getEventBus();
  if (!bus) {
    res.status(503).json({
      success: false,
      error: {
        code: 'EVENT_BUS_UNAVAILABLE',
        message: 'Event bus is not initialized',
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown',
    });
    return;
  }

  const type = req.query.type as SystemEventType | undefined;
  const severity = req.query.severity as string | undefined;
  const limit = parseInt(req.query.limit as string) || 50;

  const events: SystemEvent[] = bus.getEvents({ type, severity, limit });

  res.json({
    success: true,
    data: events,
    timestamp: new Date(),
    requestId: req.headers['x-request-id'] || 'unknown',
  });
});

router.post('/', (req, res) => {
  const bus = getEventBus();
  if (!bus) {
    res.status(503).json({
      success: false,
      error: {
        code: 'EVENT_BUS_UNAVAILABLE',
        message: 'Event bus is not initialized',
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown',
    });
    return;
  }

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

  if (severity !== undefined && !VALID_SEVERITIES.includes(severity)) {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_SEVERITY',
        message: `Invalid severity. Valid severities: ${VALID_SEVERITIES.join(', ')}`,
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown',
    });
    return;
  }

  const event = bus.emitEvent(
    type as SystemEventType,
    (severity as Severity) || 'info',
    source || 'jarvis-core',
    message,
    data
  );

  res.status(201).json({
    success: true,
    data: event,
    timestamp: new Date(),
    requestId: req.headers['x-request-id'] || 'unknown',
  });
});

export { router as eventsRouter };
