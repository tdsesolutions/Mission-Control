/**
 * Identity API. Envelope mirrors Core's: { success, data|error, timestamp }.
 * Audio arrives as a raw WAV body (PCM16 mono). Enrollment is a short
 * session: start → N samples → finish (computes centroid + calibrated
 * threshold and persists). Verification is stateless.
 */

import { Router, raw, json } from 'express';
import crypto from 'crypto';
import { SpeakerEmbedder } from '../embedding/Embedder.js';
import { centroid, calibrateThreshold, cosineSimilarity } from '../embedding/math.js';
import { VoiceprintStore, Voiceprint } from '../store/VoiceprintStore.js';
import { AuditLog } from '../audit.js';
import { parseWav } from '../wav.js';
import { config } from '../config.js';

export interface Deps {
  embedder: SpeakerEmbedder | null;
  store: VoiceprintStore;
  audit: AuditLog;
  modelError?: string;
}

interface EnrollSession {
  profile: string;
  embeddings: Float32Array[];
  touchedAt: number;
}

// Full sentences on purpose: short choppy phrases embed unstably.
const ENROLLMENT_PHRASES = [
  'Kiaros, this is my voice — listen carefully and remember exactly how I sound.',
  'Mission Control belongs to me, and it answers only to my direct commands.',
  'The quick brown fox jumps over the lazy dog while the band plays on.',
  'When I ask you to approve, deny, dispatch, or schedule, verify it is really me.',
  'Today I am teaching my system to recognize who I am by voice alone.',
];

export function createRoutes(deps: Deps): Router {
  const router = Router();
  const sessions = new Map<string, EnrollSession>();

  const ok = (data: unknown) => ({ success: true, data, timestamp: new Date() });
  const fail = (message: string) => ({ success: false, error: message, timestamp: new Date() });

  const sweepSessions = () => {
    const now = Date.now();
    for (const [id, s] of sessions) {
      if (now - s.touchedAt > config.enrollment.sessionTtlMs) sessions.delete(id);
    }
  };

  router.get('/health', (_req, res) => {
    res.json(
      ok({
        service: 'identity',
        modelLoaded: Boolean(deps.embedder),
        modelError: deps.modelError ?? null,
        dim: deps.embedder?.dim ?? null,
        enrolled: { desktop: Boolean(deps.store.load('desktop')) },
      })
    );
  });

  /** Everything below needs the model. */
  router.use((_req, res, next) => {
    if (!deps.embedder) {
      res.status(503).json(fail(`speaker model unavailable: ${deps.modelError ?? 'unknown'}`));
      return;
    }
    next();
  });

  router.post('/enroll/start', json(), (req, res) => {
    sweepSessions();
    const profile = (req.body?.profile as string) || 'desktop';
    const sessionId = crypto.randomUUID();
    sessions.set(sessionId, { profile, embeddings: [], touchedAt: Date.now() });
    res.json(
      ok({
        sessionId,
        phrases: ENROLLMENT_PHRASES,
        minSamples: config.enrollment.minSamples,
        maxSamples: config.enrollment.maxSamples,
      })
    );
  });

  const rawWav = raw({ type: ['audio/wav', 'application/octet-stream'], limit: '10mb' });

  router.post('/enroll/sample/:sessionId', rawWav, async (req, res) => {
    const session = sessions.get(req.params.sessionId);
    if (!session) {
      res.status(404).json(fail('enrollment session not found or expired'));
      return;
    }
    if (session.embeddings.length >= config.enrollment.maxSamples) {
      res.status(400).json(fail('enrollment session already has the maximum number of samples'));
      return;
    }
    try {
      const wav = parseWav(req.body as Buffer);
      if (wav.durationSeconds < config.enrollment.minSampleSeconds) {
        res.status(400).json(fail(`sample too short (${wav.durationSeconds.toFixed(2)}s < ${config.enrollment.minSampleSeconds}s)`));
        return;
      }
      const embedding = await deps.embedder!.embed(wav.samples, wav.sampleRate);
      session.embeddings.push(embedding);
      session.touchedAt = Date.now();
      res.json(
        ok({
          samplesCollected: session.embeddings.length,
          samplesNeeded: Math.max(0, config.enrollment.minSamples - session.embeddings.length),
          durationSeconds: wav.durationSeconds,
        })
      );
    } catch (err) {
      res.status(400).json(fail(err instanceof Error ? err.message : 'invalid audio'));
    }
  });

  router.post('/enroll/finish/:sessionId', json(), (req, res) => {
    const session = sessions.get(req.params.sessionId);
    if (!session) {
      res.status(404).json(fail('enrollment session not found or expired'));
      return;
    }
    if (session.embeddings.length < config.enrollment.minSamples) {
      res.status(400).json(fail(`need at least ${config.enrollment.minSamples} samples, have ${session.embeddings.length}`));
      return;
    }
    const calibration = calibrateThreshold(session.embeddings, {
      floor: config.verification.thresholdFloor,
      ceiling: config.verification.thresholdCeiling,
      fallback: config.verification.thresholdDefault,
    });
    const now = new Date().toISOString();
    const existing = deps.store.load(session.profile);
    const voiceprint: Voiceprint = {
      version: 1,
      profile: session.profile,
      dim: deps.embedder!.dim,
      centroid: Array.from(centroid(session.embeddings)),
      threshold: calibration.threshold,
      sampleCount: session.embeddings.length,
      calibration: {
        intraMean: calibration.intraMean,
        intraStd: calibration.intraStd,
        pairCount: calibration.pairCount,
      },
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    deps.store.save(voiceprint);
    sessions.delete(req.params.sessionId);
    deps.audit.append({
      event: 'enroll',
      profile: session.profile,
      source: 'desktop-enrollment',
      outcome: 'voiceprint_saved',
      threshold: calibration.threshold,
    });
    res.json(
      ok({
        profile: session.profile,
        sampleCount: voiceprint.sampleCount,
        threshold: voiceprint.threshold,
        calibration: voiceprint.calibration,
      })
    );
  });

  router.post('/verify', rawWav, async (req, res) => {
    const profile = (req.query.profile as string) || 'desktop';
    const source = (req.query.source as string) || 'unknown';
    const voiceprint = deps.store.load(profile);
    if (!voiceprint) {
      res.json(ok({ enrolled: false, speaker: 'unknown', reason: 'no voiceprint enrolled' }));
      return;
    }
    try {
      const wav = parseWav(req.body as Buffer);
      const embedding = await deps.embedder!.embed(wav.samples, wav.sampleRate);
      const score = cosineSimilarity(embedding, Float32Array.from(voiceprint.centroid));
      const isOwner = score >= voiceprint.threshold;
      deps.audit.append({
        event: 'verify',
        profile,
        source,
        outcome: isOwner ? 'owner' : 'unknown',
        score: Math.round(score * 1000) / 1000,
        threshold: voiceprint.threshold,
        durationSeconds: Math.round(wav.durationSeconds * 100) / 100,
      });
      res.json(
        ok({
          enrolled: true,
          speaker: isOwner ? 'owner' : 'unknown',
          score: Math.round(score * 1000) / 1000,
          threshold: voiceprint.threshold,
        })
      );
    } catch (err) {
      res.status(400).json(fail(err instanceof Error ? err.message : 'invalid audio'));
    }
  });

  router.delete('/voiceprint/:profile', (req, res) => {
    const deleted = deps.store.delete(req.params.profile);
    if (deleted) {
      deps.audit.append({
        event: 'voiceprint_deleted',
        profile: req.params.profile,
        source: 'api',
        outcome: 'deleted',
      });
    }
    res.status(deleted ? 200 : 404).json(deleted ? ok({ deleted: true }) : fail('no such voiceprint'));
  });

  return router;
}
