/**
 * Mode Route
 * Handle Kiaros UI mode changes — backed by the JarvisStateManager so the
 * mode PERSISTS across Core restarts (STATE_MANAGEMENT gap closed).
 */

import { Router } from 'express';
import { logger } from '../../utils/logger.js';
import { UI_MODES } from '../../../../shared/constants/index.js';
import { getStateManager } from '../../services/stateManager.js';
import type { JarvisMode } from '../../../../shared/types/index.js';

const router = Router();

const validModes = Object.values(UI_MODES);

// Fallback only for the degenerate case where the state manager failed to
// initialize (crash-proof init keeps the server up regardless).
let fallbackMode: JarvisMode = UI_MODES.FACE;

router.get('/', (req, res) => {
  const manager = getStateManager();
  res.json({
    success: true,
    data: {
      currentMode: manager ? manager.getMode() : fallbackMode,
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

  const manager = getStateManager();
  if (manager) {
    manager.setMode(mode); // emits mode:changed + persists
  } else {
    fallbackMode = mode;
    logger.warn(`Mode set without state manager (not persisted): ${mode}`);
  }

  res.json({
    success: true,
    data: { mode },
    timestamp: new Date(),
    requestId: req.headers['x-request-id'] || 'unknown',
  });
});

export { router as modeRouter };
