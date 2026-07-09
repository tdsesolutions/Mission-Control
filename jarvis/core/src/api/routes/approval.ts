/**
 * Approval Route
 * Decision authority endpoints — classification, audit reads, and the
 * owner-approval workflow for held dispatches (owner-approved 2026-07-09).
 * Classification itself never executes work (Approval Engine mandate,
 * Phase 6); approving a held dispatch creates the real Mission Control
 * task through the TaskDispatcher.
 */

import { Router } from 'express';
import { getApprovalEngine } from '../../services/approval/ApprovalEngine.js';
import { getTaskDispatcher } from '../../services/dispatch/TaskDispatcher.js';

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

// ---- Owner-approval workflow for held dispatches (2026-07-09) ----

// List dispatches awaiting the owner (pass ?all=true to include resolved).
router.get('/pending', (req, res) => {
  const includeResolved = String(req.query.all ?? '') === 'true';
  res.json({
    success: true,
    data: getTaskDispatcher().listPending(includeResolved),
    timestamp: new Date(),
    requestId: req.headers['x-request-id'] || 'unknown',
  });
});

// Owner approves a held dispatch → the Mission Control task is created NOW.
router.post('/pending/:id/approve', async (req, res) => {
  const result = await getTaskDispatcher().approvePending(req.params.id);
  if (!result.ok) {
    res.status(result.status).json({
      success: false,
      error: { code: result.status === 404 ? 'PENDING_NOT_FOUND' : result.status === 409 ? 'ALREADY_RESOLVED' : 'MISSION_CONTROL_UNAVAILABLE', message: result.error },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown',
    });
    return;
  }
  res.json({
    success: true,
    data: { pending: result.pending, task: result.task },
    timestamp: new Date(),
    requestId: req.headers['x-request-id'] || 'unknown',
  });
});

// Owner denies a held dispatch. Nothing is created anywhere.
router.post('/pending/:id/deny', (req, res) => {
  const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;
  const result = getTaskDispatcher().denyPending(req.params.id, reason);
  if (!result.ok) {
    res.status(result.status).json({
      success: false,
      error: { code: result.status === 404 ? 'PENDING_NOT_FOUND' : 'ALREADY_RESOLVED', message: result.error },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown',
    });
    return;
  }
  res.json({
    success: true,
    data: { pending: result.pending },
    timestamp: new Date(),
    requestId: req.headers['x-request-id'] || 'unknown',
  });
});

export { router as approvalRouter };
