/**
 * Health Check Route
 */

import { Router } from 'express';
import { logger } from '../../utils/logger.js';

const router = Router();

router.get('/', (req, res) => {
  logger.debug('Health check requested');
  
  res.json({
    status: 'ok',
    version: process.env.JARVIS_VERSION || '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date(),
    service: 'jarvis-core',
  });
});

export { router as healthRouter };
