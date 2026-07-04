/**
 * Mode Route
 * Handle Jarvis UI mode changes
 */

import { Router } from 'express';
import { logger } from '../../utils/logger.js';
import { UI_MODES } from '../../../../shared/constants/index.js';

const router = Router();

// Valid modes
const validModes = Object.values(UI_MODES);

// Current mode
let currentMode = UI_MODES.ORB;

router.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      currentMode,
      availableModes: validModes,
    },
    timestamp: new Date(),
    requestId: req.headers['x-request-id'] || 'unknown',
  });
});

router.post('/set', (req, res) => {
  const { mode } = req.body;
  
  if (!mode || !validModes.includes(mode)) {
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
  
  currentMode = mode;
  logger.info(`Mode changed to: ${mode}`);
  
  res.json({
    success: true,
    data: { mode: currentMode },
    timestamp: new Date(),
    requestId: req.headers['x-request-id'] || 'unknown',
  });
});

export { router as modeRouter };
