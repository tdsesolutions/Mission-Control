/**
 * Projects Route — READ-THROUGH PROXY of Mission Control.
 * Same rules as tasks: MC is the system of record (STATE_MANAGEMENT §1);
 * writes are owner-gated (Constitution Art. V); no local mirror. The former
 * in-memory stub store (placeholder behavior) is gone.
 */

import { Router } from 'express';
import { getMissionControlClient } from '../../services/missionControlClient.js';

const router = Router();

const envelope = (req: { headers: Record<string, unknown> }) => ({
  timestamp: new Date(),
  requestId: (req.headers['x-request-id'] as string) || 'unknown',
});

router.get('/', async (req, res) => {
  const result = await getMissionControlClient().listProjects();
  if (!result.ok || !result.data) {
    // 200 + degraded envelope: polled endpoints must not console-spam
    // (see tasks route for rationale).
    res.json({
      success: false,
      degraded: true,
      error: { code: 'MISSION_CONTROL_UNAVAILABLE', message: result.error ?? 'Mission Control did not respond.' },
      ...envelope(req),
    });
    return;
  }

  res.json({ success: true, data: result.data, source: 'mission-control', ...envelope(req) });
});

router.get('/:id', async (req, res) => {
  const result = await getMissionControlClient().listProjects();
  if (!result.ok || !result.data) {
    res.status(502).json({
      success: false,
      error: { code: 'MISSION_CONTROL_UNAVAILABLE', message: result.error ?? 'Mission Control did not respond.' },
      ...envelope(req),
    });
    return;
  }
  const project = result.data.find((p) => p.id === req.params.id);
  if (!project) {
    res.status(404).json({
      success: false,
      error: { code: 'PROJECT_NOT_FOUND', message: `Project ${req.params.id} not found in Mission Control` },
      ...envelope(req),
    });
    return;
  }
  res.json({ success: true, data: project, source: 'mission-control', ...envelope(req) });
});

// Writes: honestly gated (Constitution Art. IV/V).
const writeGate = (req: Parameters<typeof envelope>[0], res: { status: (n: number) => { json: (b: unknown) => void } }) => {
  res.status(501).json({
    success: false,
    error: {
      code: 'WRITES_OWNER_GATED',
      message:
        'Project writes are not enabled: Kiaros→Mission Control writes require an ' +
        'owner-approved phase routed through the Approval Engine (Constitution Art. V).',
    },
    ...envelope(req),
  });
};

router.post('/', (req, res) => writeGate(req, res));
router.patch('/:id', (req, res) => writeGate(req, res));
router.put('/:id', (req, res) => writeGate(req, res));
router.delete('/:id', (req, res) => writeGate(req, res));

export { router as projectsRouter };
