/**
 * Status Route
 * Returns detailed Jarvis status and state — backed by the shared
 * JarvisStateManager (same instance the mode route persists through),
 * plus real process metrics from CoreMetrics.
 */

import { Router } from 'express';
import { logger } from '../../utils/logger.js';
import { getMonitorService } from '../../services/monitorService.js';
import { getStateManager } from '../../services/stateManager.js';
import { getCoreMetrics } from '../../services/coreMetrics.js';
import { UI_MODES } from '../../../../shared/constants/index.js';
import type { JarvisMode, JarvisStatus } from '../../../../shared/types/index.js';

const router = Router();

const validModes = Object.values(UI_MODES);
const validStatuses: JarvisStatus[] = ['idle', 'listening', 'thinking', 'responding', 'executing', 'error'];

// Fallback only for the degenerate case where the state manager failed to
// initialize (crash-proof init keeps the server up regardless).
const fallbackState: { mode: JarvisMode; status: JarvisStatus } = {
  mode: UI_MODES.FACE,
  status: 'idle',
};

router.get('/', (req, res) => {
  logger.debug('Status requested');

  const manager = getStateManager();
  const state = manager
    ? { mode: manager.getMode(), status: manager.getStatus(), timestamp: new Date() }
    : { ...fallbackState, timestamp: new Date() };

  res.json({
    success: true,
    data: {
      state,
      persisted: Boolean(manager),
      version: process.env.JARVIS_VERSION || '1.0.0',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      metrics: getCoreMetrics().getMetrics(),
    },
    timestamp: new Date(),
    requestId: req.headers['x-request-id'] || 'unknown',
  });
});

// Monitored service statuses (gateway, mission control, core). The Desktop
// must read ecosystem health from here — never by fetching other services
// directly (MESSAGE_ROUTING.md §7). The jarvis-core entry carries live
// process metrics (the only service whose internals we can truthfully
// measure from here).
router.get('/services', (req, res) => {
  const monitor = getMonitorService();
  const statuses = monitor ? monitor.getAllServiceStatuses() : [];
  const data = statuses.map((service) =>
    service.name === 'jarvis-core'
      ? { ...service, metrics: getCoreMetrics().getMetrics() }
      : service
  );

  res.json({
    success: true,
    data,
    timestamp: new Date(),
    requestId: req.headers['x-request-id'] || 'unknown',
  });
});

router.post('/update', (req, res) => {
  const { mode, status } = req.body as { mode?: JarvisMode; status?: JarvisStatus };

  if (mode !== undefined && !validModes.includes(mode)) {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_MODE',
        message: `Invalid mode. Valid modes: ${validModes.join(', ')}`,
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown',
    });
    return;
  }

  if (status !== undefined && !validStatuses.includes(status)) {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_STATUS',
        message: `Invalid status. Valid statuses: ${validStatuses.join(', ')}`,
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown',
    });
    return;
  }

  const manager = getStateManager();
  if (manager) {
    if (mode !== undefined) {
      manager.setMode(mode); // emits mode:changed + persists
    }
    if (status !== undefined) {
      manager.setStatus(status);
    }
  } else {
    if (mode !== undefined) {
      fallbackState.mode = mode;
    }
    if (status !== undefined) {
      fallbackState.status = status;
    }
    logger.warn(`Status updated without state manager (not persisted): mode=${mode}, status=${status}`);
  }

  logger.info(`Status updated: mode=${mode}, status=${status}`);

  const current = manager
    ? { mode: manager.getMode(), status: manager.getStatus(), timestamp: new Date() }
    : { ...fallbackState, timestamp: new Date() };

  res.json({
    success: true,
    data: current,
    timestamp: new Date(),
    requestId: req.headers['x-request-id'] || 'unknown',
  });
});

export { router as statusRouter };
