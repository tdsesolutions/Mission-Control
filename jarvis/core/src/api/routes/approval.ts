/**
 * Approval Route
 * Decision authority endpoints — classification and audit reads ONLY.
 * Nothing here executes work (Approval Engine mandate, Phase 6).
 */

import { Router } from 'express';
import { getApprovalEngine } from '../../services/approval/ApprovalEngine.js';

const router = Router();

// Classify a request. Pure decision: the engine performs no work on the
// request's behalf regardless of the outcome.
router.post('/classify', (req, res) => {
  const { intent, operations, targetPaths, source } = req.body ?? {};

  if (typeof intent !== 'string') {
    res.status(400).json({
      success: false,
      error: { code: 'MISSING_INTENT', message: 'intent (string) is required' },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown',
    });
    return;
  }

  const decision = getApprovalEngine().classify({
    intent,
    operations: Array.isArray(operations) ? operations.map(String) : undefined,
    targetPaths: Array.isArray(targetPaths) ? targetPaths.map(String) : undefined,
    source: typeof source === 'string' ? source : 'api',
  });

  res.json({
    success: true,
    data: decision,
    timestamp: new Date(),
    requestId: req.headers['x-request-id'] || 'unknown',
  });
});

// Read the audit trail (newest last).
router.get('/audit', (req, res) => {
  const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10) || 50, 500);

  res.json({
    success: true,
    data: getApprovalEngine().readAudit(limit),
    timestamp: new Date(),
    requestId: req.headers['x-request-id'] || 'unknown',
  });
});

export { router as approvalRouter };
