/**
 * Memory Route
 * Handle Jarvis memory operations — backed by the shared persistent
 * MemoryService (jarvis-memory.json), the same store the StateManager
 * snapshots into. Writes and deletes persist to disk immediately so
 * values survive Core restarts.
 */

import { Router } from 'express';
import { logger } from '../../utils/logger.js';
import { getMemoryService } from '../../services/memoryService.js';

const router = Router();

router.get('/:key', (req, res) => {
  const { key } = req.params;
  const memory = getMemoryService();

  if (!memory.has(key)) {
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
    data: { key, value: memory.get(key) },
    timestamp: new Date(),
    requestId: req.headers['x-request-id'] || 'unknown',
  });
});

router.post('/:key', async (req, res) => {
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

  const memory = getMemoryService();
  memory.set(key, value);
  await memory.saveMemory();
  logger.debug(`Memory set: ${key}`);

  res.json({
    success: true,
    data: { key, value },
    timestamp: new Date(),
    requestId: req.headers['x-request-id'] || 'unknown',
  });
});

router.delete('/:key', async (req, res) => {
  const { key } = req.params;
  const memory = getMemoryService();
  const existed = memory.delete(key);
  if (existed) {
    await memory.saveMemory();
  }

  res.json({
    success: true,
    data: { key, deleted: existed },
    timestamp: new Date(),
    requestId: req.headers['x-request-id'] || 'unknown',
  });
});

router.get('/', (req, res) => {
  const keys = getMemoryService().keys();

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
