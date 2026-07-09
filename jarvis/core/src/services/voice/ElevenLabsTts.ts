/**
 * ElevenLabs Text-to-Speech client (server-side proxy target).
 * The API key never leaves this process; the Desktop calls
 * POST /api/v1/voice/tts and receives an audio stream.
 */

import { logger } from '../../utils/logger.js';

const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io/v1';
const REQUEST_TIMEOUT_MS = 60_000;
/** ElevenLabs voice IDs are short alphanumeric tokens. */
const VOICE_ID_PATTERN = /^[A-Za-z0-9]{8,64}$/;

export interface ElevenLabsConfig {
  apiKey: string;
  voiceId: string;
  modelId: string;
}

export type SynthesisResult =
  | { ok: true; stream: ReadableStream<Uint8Array>; contentType: string }
  | { ok: false; status: number; code: string; message: string };

export function isValidVoiceId(voiceId: string): boolean {
  return VOICE_ID_PATTERN.test(voiceId);
}

export class ElevenLabsTtsService {
  constructor(private readonly cfg: ElevenLabsConfig) {}

  isConfigured(): boolean {
    return Boolean(this.cfg.apiKey);
  }

  getVoiceId(): string {
    return this.cfg.voiceId;
  }

  /**
   * Synthesize speech for text. Returns the provider's audio stream on
   * success, or an honest error envelope — never fabricated audio.
   */
  async synthesize(text: string, voiceIdOverride?: string): Promise<SynthesisResult> {
    if (!this.isConfigured()) {
      return {
        ok: false,
        status: 503,
        code: 'TTS_NOT_CONFIGURED',
        message: 'ElevenLabs is not configured (set ELEVENLABS_API_KEY in jarvis/.env)',
      };
    }

    const voiceId = voiceIdOverride || this.cfg.voiceId;
    if (!isValidVoiceId(voiceId)) {
      return { ok: false, status: 400, code: 'INVALID_VOICE_ID', message: 'Invalid voice id' };
    }

    const url = `${ELEVENLABS_API_BASE}/text-to-speech/${voiceId}?output_format=mp3_44100_128`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'xi-api-key': this.cfg.apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: this.cfg.modelId,
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const detail = await response.text().catch(() => '');
        clearTimeout(timeout);
        logger.warn(`ElevenLabs TTS failed: HTTP ${response.status} ${detail.slice(0, 300)}`);
        return {
          ok: false,
          status: response.status === 401 ? 502 : response.status,
          code: 'TTS_PROVIDER_ERROR',
          message: `ElevenLabs returned HTTP ${response.status}`,
        };
      }

      // The stream outlives this call; the route clears nothing — the
      // timeout only bounds connection + headers, not audio delivery.
      clearTimeout(timeout);
      return {
        ok: true,
        stream: response.body,
        contentType: response.headers.get('content-type') || 'audio/mpeg',
      };
    } catch (error) {
      clearTimeout(timeout);
      const message = error instanceof Error ? error.message : 'fetch failed';
      logger.warn(`ElevenLabs TTS unreachable: ${message}`);
      return {
        ok: false,
        status: 502,
        code: 'TTS_PROVIDER_UNREACHABLE',
        message: `ElevenLabs unreachable: ${message}`,
      };
    }
  }
}
