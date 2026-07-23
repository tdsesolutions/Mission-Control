/**
 * Tasks Route — READ-THROUGH PROXY of Mission Control, plus the sanctioned
 * CREATE path (owner-approved 2026-07-09).
 *
 * Mission Control's SQLite is the ONLY durable task store; Kiaros never
 * mirrors it and never persists its own task state (STATE_MANAGEMENT §1/§3).
 *
 * POST routes through the TaskDispatcher, which consults the Approval
 * Engine on EVERY request (Constitution Art. V — bypassing it is
 * FORBIDDEN). Update/delete remain deliberately gated: Mission Control's
 * own UI owns task lifecycle edits.
 */

import { Router } from 'express';
import { getMissionControlClient } from '../../services/missionControlClient.js';
import { getTaskDispatcher } from '../../services/dispatch/TaskDispatcher.js';
import { extractExecCode } from '../../services/dispatch/execCode.js';
import { config } from '../../config/index.js';

const router = Router();

const envelope = (req: { headers: Record<string, unknown> }) => ({
  timestamp: new Date(),
  requestId: (req.headers['x-request-id'] as string) || 'unknown',
});

const upstreamError = (error?: string, status?: number) => ({
  success: false,
  error: {
    code: status === 404 ? 'TASK_NOT_FOUND' : 'MISSION_CONTROL_UNAVAILABLE',
    message: error ?? 'Mission Control did not respond.',
  },
});

router.get('/', async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const limit = parseInt(String(req.query.limit ?? '50'), 10) || 50;

  const result = await getMissionControlClient().listTasks({ status, limit });
  if (!result.ok || !result.data) {
    // Degraded envelope with HTTP 200: this endpoint is polled by the
    // Desktop, and browsers console-log every non-2xx resource load — a
    // known-degraded upstream must not spam errors. success:false +
    // error.code carries the honest truth (Art. IV).
    res.json({ ...upstreamError(result.error, result.status), degraded: true, ...envelope(req) });
    return;
  }

  res.json({
    success: true,
    data: result.data.tasks,
    total: result.data.total,
    source: 'mission-control',
    ...envelope(req),
  });
});

router.get('/:id', async (req, res) => {
  const result = await getMissionControlClient().getTask(req.params.id);
  if (!result.ok || !result.data) {
    res.status(result.status === 404 ? 404 : 502).json({ ...upstreamError(result.error, result.status), ...envelope(req) });
    return;
  }

  res.json({ success: true, data: result.data, source: 'mission-control', ...envelope(req) });
});

// Create — the sanctioned write path (owner-approved 2026-07-09). Every
// request is classified by the Approval Engine inside the TaskDispatcher;
// the HTTP status mirrors the decision honestly.
router.post('/', async (req, res) => {
  const { intent, title, description } = req.body ?? {};
  const statement = typeof intent === 'string' && intent.trim()
    ? intent.trim()
    : [title, description].filter((part) => typeof part === 'string' && part.trim()).join(' — ').trim();

  if (!statement) {
    res.status(400).json({
      success: false,
      error: { code: 'MISSING_INTENT', message: 'Provide `intent` (or `title`/`description`) describing the requested work.' },
      ...envelope(req),
    });
    return;
  }

  // Owner execute code: extract + strip before dispatch so the digits never
  // reach task descriptions or audit trails (same rule as conversation).
  const exec = extractExecCode(statement, config.security.execCode);

  const result = await getTaskDispatcher().requestDispatch({
    intent: exec.cleaned,
    title: typeof title === 'string' ? title : undefined,
    source: 'api',
    execAuthorized: exec.authorized,
  });

  switch (result.outcome) {
    case 'dispatched':
      res.status(201).json({ success: true, data: { task: result.task, decision: result.decision }, source: 'mission-control', ...envelope(req) });
      return;
    case 'pending_owner_approval':
      res.status(202).json({
        success: true,
        data: { pending: result.pending, decision: result.decision },
        message: 'Held for owner approval — resolve via /api/v1/approval/pending.',
        ...envelope(req),
      });
      return;
    case 'clarification_needed':
      res.status(422).json({ success: false, error: { code: 'CLARIFICATION_NEEDED', message: result.decision.reason }, data: { decision: result.decision }, ...envelope(req) });
      return;
    case 'rejected':
      res.status(403).json({ success: false, error: { code: 'REJECTED_BY_APPROVAL_ENGINE', message: result.decision.reason }, data: { decision: result.decision }, ...envelope(req) });
      return;
    case 'dispatch_failed':
      res.status(502).json({ success: false, error: { code: 'MISSION_CONTROL_UNAVAILABLE', message: result.error }, data: { decision: result.decision }, ...envelope(req) });
      return;
  }
});

// Owner approval of a review-column task (owner-approved 2026-07-23) — the
// one sanctioned lifecycle edit besides creation. Requires the owner's
// execute code in the body; the response is identical for a missing and a
// wrong code (no oracle). Only review-state tasks can be accepted —
// MissionControlClient.acceptReviewTask enforces that again.
router.post('/:id/approve', async (req, res) => {
  const provided = String((req.body ?? {}).execCode ?? '').trim();
  const configured = (config.security.execCode ?? '').trim();
  if (!configured || !provided || provided !== configured) {
    res.status(403).json({
      success: false,
      error: { code: 'EXEC_CODE_REQUIRED', message: 'Owner execute code required to approve tasks.' },
      ...envelope(req),
    });
    return;
  }

  const result = await getMissionControlClient().acceptReviewTask(
    req.params.id,
    'Approved by owner via Kiaros desktop (execute code verified) — accepted from review.'
  );
  if (!result.ok || !result.data) {
    const status = result.status === 404 ? 404 : result.status === 409 ? 409 : 502;
    res.status(status).json({
      success: false,
      error: {
        code: status === 404 ? 'TASK_NOT_FOUND' : status === 409 ? 'NOT_AWAITING_REVIEW' : 'MISSION_CONTROL_UNAVAILABLE',
        message: result.error ?? 'Mission Control did not respond.',
      },
      ...envelope(req),
    });
    return;
  }

  res.json({ success: true, data: result.data, source: 'mission-control', ...envelope(req) });
});

// Update/delete: deliberately gated by design (not a stub). Task lifecycle
// edits belong to Mission Control's own UI — Kiaros creates work, it does
// not rewrite the system of record.
const writeGate = (req: Parameters<typeof envelope>[0], res: { status: (n: number) => { json: (b: unknown) => void } }) => {
  res.status(501).json({
    success: false,
    error: {
      code: 'LIFECYCLE_EDITS_NOT_SUPPORTED',
      message:
        'Kiaros does not modify or delete Mission Control tasks — task creation is supported ' +
        '(POST, via the Approval Engine); lifecycle edits are owned by Mission Control.',
    },
    ...envelope(req),
  });
};

router.patch('/:id', (req, res) => writeGate(req, res));
router.put('/:id', (req, res) => writeGate(req, res));
router.delete('/:id', (req, res) => writeGate(req, res));

export { router as tasksRouter };
