/**
 * Memory Route
 * Handle Jarvis memory operations
 */

import { Router } from 'express';
import { logger } from '../../utils/logger.js';

const router = Router();

// In-memory store (will be replaced with persistent memory service)
const memoryStore: Map<string, unknown> = new Map();

router.get('/:key', (req, res) => {
  const { key } = req.params;
  const value = memoryStore.get(key);
  
  if (value === undefined) {
    res.status(404).json({
      success: false,
      error: {
        code: 'KEY_NOT_FOUND',
        message: `Memory key '${key}' not found`,
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown',
    });
    return;
  }
  
  res.json({
    success: true,
    data: { key, value },
    timestamp: new Date(),
    requestId: req.headers['x-request-id'] || 'unknown',
  });
});

router.post('/:key', (req, res) => {
  const { key } = req.params;
  const { value } = req.body;
  
  if (value === undefined) {
    res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_VALUE',
        message: 'Value is required',
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown',
    });
    return;
  }
  
  memoryStore.set(key, value);
  logger.debug(`Memory set: ${key}`);
  
  res.json({
    success: true,
    data: { key, value },
    timestamp: new Date(),
    requestId: req.headers['x-request-id'] || 'unknown',
  });
});

router.delete('/:key', (req, res) => {
  const { key } = req.params;
  const existed = memoryStore.has(key);
  
  memoryStore.delete(key);
  
  res.json({
    success: true,
    data: { key, deleted: existed },
    timestamp: new Date(),
    requestId: req.headers['x-request-id'] || 'unknown',
  });
});

router.get('/', (req, res) => {
  const keys = Array.from(memoryStore.keys());
  
  res.json({
    success: true,
    data: {
      keys,
      count: keys.length,
    },
    timestamp: new Date(),
    requestId: req.headers['x-request-id'] || 'unknown',
  });
});

export { router as memoryRouter };
