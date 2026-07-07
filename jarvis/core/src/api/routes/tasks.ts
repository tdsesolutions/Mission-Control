/**
 * Tasks Route — READ-THROUGH PROXY of Mission Control.
 *
 * Mission Control's SQLite is the ONLY durable task store; Kiaros never
 * mirrors it and never persists its own task state (STATE_MANAGEMENT §1/§3).
 * The former in-memory stub store (placeholder behavior) is gone.
 *
 * Writes are constitutionally gated: no Kiaros→MC task creation until an
 * owner-approved phase routes it through the Approval Engine
 * (PROJECT_CONSTITUTION Art. V). Write endpoints answer honestly.
 */

import { Router } from 'express';
import { getMissionControlClient } from '../../services/missionControlClient.js';

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

// Writes: honestly gated. Creating fake local tasks would be placeholder
// behavior (Art. IV); creating real MC tasks is owner-gated (Art. V).
const writeGate = (req: Parameters<typeof envelope>[0], res: { status: (n: number) => { json: (b: unknown) => void } }) => {
  res.status(501).json({
    success: false,
    error: {
      code: 'WRITES_OWNER_GATED',
      message:
        'Task writes are not enabled: Kiaros→Mission Control task creation requires an ' +
        'owner-approved phase routed through the Approval Engine (Constitution Art. V).',
    },
    ...envelope(req),
  });
};

router.post('/', (req, res) => writeGate(req, res));
router.patch('/:id', (req, res) => writeGate(req, res));
router.put('/:id', (req, res) => writeGate(req, res));
router.delete('/:id', (req, res) => writeGate(req, res));

export { router as tasksRouter };
