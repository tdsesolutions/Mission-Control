/**
 * Status Route
 * Returns detailed Jarvis status and state
 */

import { Router } from 'express';
import { logger } from '../../utils/logger.js';

const router = Router();

// In-memory state (will be replaced with state manager)
let jarvisState = {
  mode: 'orb',
  status: 'idle',
  timestamp: new Date(),
};

router.get('/', (req, res) => {
  logger.debug('Status requested');
  
  res.json({
    success: true,
    data: {
      state: jarvisState,
      version: process.env.JARVIS_VERSION || '1.0.0',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    },
    timestamp: new Date(),
    requestId: req.headers['x-request-id'] || 'unknown',
  });
});

router.post('/update', (req, res) => {
  const { mode, status } = req.body;
  
  if (mode) {
    jarvisState.mode = mode;
  }
  if (status) {
    jarvisState.status = status;
  }
  jarvisState.timestamp = new Date();
  
  logger.info(`Status updated: mode=${mode}, status=${status}`);
  
  res.json({
    success: true,
    data: jarvisState,
    timestamp: new Date(),
    requestId: req.headers['x-request-id'] || 'unknown',
  });
});

export { router as statusRouter };
