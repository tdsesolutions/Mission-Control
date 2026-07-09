/**
 * Voice Route
 * Cloud-voice proxy surface. GET /config reports capability booleans only
 * (never keys); POST /tts streams ElevenLabs audio. STT streaming lives on
 * ws://…/ws/voice/stt (DeepgramRelay), not here.
 */

import { Router } from 'express';
import { Readable } from 'stream';
import { logger } from '../../utils/logger.js';
import { config } from '../../config/index.js';
import { ElevenLabsTtsService } from '../../services/voice/ElevenLabsTts.js';

const MAX_TTS_TEXT_LENGTH = 5000;

const router = Router();
const tts = new ElevenLabsTtsService(config.voice.elevenlabs);

router.get('/config', (req, res) => {
  const sttAvailable = Boolean(config.voice.deepgram.apiKey);
  const ttsAvailable = tts.isConfigured();

  res.json({
    success: true,
    data: {
      stt: {
        available: sttAvailable,
        provider: sttAvailable ? 'deepgram' : null,
        model: sttAvailable ? config.voice.deepgram.model : null,
      },
      tts: {
        available: ttsAvailable,
        provider: ttsAvailable ? 'elevenlabs' : null,
        voiceId: ttsAvailable ? tts.getVoiceId() : null,
      },
    },
    timestamp: new Date(),
    requestId: req.headers['x-request-id'] || 'unknown',
  });
});

router.post('/tts', async (req, res) => {
  const { text, voiceId } = req.body as { text?: unknown; voiceId?: unknown };

  if (typeof text !== 'string' || !text.trim()) {
    res.status(400).json({
      success: false,
      error: { code: 'MISSING_TEXT', message: 'Text is required' },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown',
    });
    return;
  }

  if (text.length > MAX_TTS_TEXT_LENGTH) {
    res.status(400).json({
      success: false,
      error: {
        code: 'TEXT_TOO_LONG',
        message: `Text exceeds ${MAX_TTS_TEXT_LENGTH} characters`,
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown',
    });
    return;
  }

  const result = await tts.synthesize(
    text,
    typeof voiceId === 'string' ? voiceId : undefined
  );

  if (!result.ok) {
    res.status(result.status).json({
      success: false,
      error: { code: result.code, message: result.message },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown',
    });
    return;
  }

  res.status(200);
  res.setHeader('Content-Type', result.contentType);
  res.setHeader('Cache-Control', 'no-store');

  const nodeStream = Readable.fromWeb(result.stream as import('stream/web').ReadableStream<Uint8Array>);
  nodeStream.on('error', (error) => {
    logger.warn(`TTS stream aborted: ${error.message}`);
    res.destroy();
  });
  // Client disconnect (barge-in, page close) must cancel the upstream
  // ElevenLabs fetch too, or aborted syntheses keep draining for up to 60s
  // each and leak sockets under repeated barge-ins.
  res.on('close', () => {
    if (!nodeStream.destroyed) nodeStream.destroy();
  });
  nodeStream.pipe(res);
});

export { router as voiceRouter };
