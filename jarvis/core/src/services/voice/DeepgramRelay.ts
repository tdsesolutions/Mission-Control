/**
 * Deepgram live STT relay (server-side proxy).
 * Browser mic audio arrives on ws://localhost:3010/ws/voice/stt as binary
 * frames; this relay forwards it to Deepgram's live API and returns
 * simplified transcript messages. The API key never leaves this process.
 *
 * Client-bound messages:
 *   { type: 'ready' }                                    relay + provider connected
 *   { type: 'transcript', transcript, confidence, isFinal, speechFinal }
 *   { type: 'error', code, message }                     then the socket closes
 */

import { WebSocketServer, WebSocket } from 'ws';
import { logger } from '../../utils/logger.js';

const DEEPGRAM_WS_BASE = 'wss://api.deepgram.com/v1/listen';
const KEEPALIVE_MS = 8_000;
/**
 * Cap on audio buffered while the provider socket is still CONNECTING
 * (~10s of 16kHz/16-bit mono at 4KB frames). A stalled handshake must not
 * let a streaming mic grow the buffer without bound.
 */
const MAX_PENDING_AUDIO_FRAMES = 320;
/** BCP-47-ish whitelist — query params must never be attacker-shaped. */
const LANGUAGE_PATTERN = /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/;

export interface DeepgramRelayConfig {
  apiKey: string;
  model: string;
  /** Optional shared-secret; mirrors the HTTP middleware. */
  coreToken: string;
}

export interface RelayTranscript {
  type: 'transcript';
  transcript: string;
  confidence: number;
  isFinal: boolean;
  speechFinal: boolean;
}

/**
 * Map a raw Deepgram live message to the client protocol.
 * Returns null for messages the client doesn't need (Metadata, etc.).
 * Exported for unit tests.
 */
export function mapDeepgramMessage(raw: string): RelayTranscript | null {
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (parsed?.type !== 'Results') {
    return null;
  }
  const alternative = parsed?.channel?.alternatives?.[0];
  if (!alternative) {
    return null;
  }
  return {
    type: 'transcript',
    transcript: String(alternative.transcript ?? ''),
    confidence: Number(alternative.confidence ?? 0),
    isFinal: Boolean(parsed.is_final),
    speechFinal: Boolean(parsed.speech_final),
  };
}

/** Sanitize the requested language; empty string = provider default. */
export function sanitizeLanguage(language: string | null): string {
  if (!language) {
    return '';
  }
  return LANGUAGE_PATTERN.test(language) ? language : '';
}

export class DeepgramRelay {
  private initialized = false;

  constructor(
    private readonly wss: WebSocketServer,
    private readonly cfg: DeepgramRelayConfig
  ) {}

  isConfigured(): boolean {
    return Boolean(this.cfg.apiKey);
  }

  initialize(): void {
    if (this.initialized) {
      return;
    }
    this.wss.on('connection', (client, req) => {
      this.handleConnection(client, req);
    });
    this.initialized = true;
    logger.info('Deepgram relay initialized (configured: %s)', this.isConfigured());
  }

  private handleConnection(client: WebSocket, req: { url?: string }): void {
    const url = new URL(String(req?.url ?? '/ws/voice/stt'), 'http://localhost');

    // Same optional shared-secret as /ws (WebSocketManager).
    if (this.cfg.coreToken && url.searchParams.get('token') !== this.cfg.coreToken) {
      logger.warn('Voice STT connection rejected: bad or missing token');
      client.close(1008, 'unauthorized');
      return;
    }

    if (!this.isConfigured()) {
      client.send(JSON.stringify({
        type: 'error',
        code: 'STT_NOT_CONFIGURED',
        message: 'Deepgram is not configured (set DEEPGRAM_API_KEY in jarvis/.env)',
      }));
      client.close(1011, 'not configured');
      return;
    }

    const language = sanitizeLanguage(url.searchParams.get('language'));
    const params = new URLSearchParams({
      model: this.cfg.model,
      interim_results: 'true',
      smart_format: 'true',
      endpointing: '300',
    });
    if (language) {
      params.set('language', language);
    }

    const upstream = new WebSocket(`${DEEPGRAM_WS_BASE}?${params.toString()}`, {
      headers: { Authorization: `Token ${this.cfg.apiKey}` },
    });

    // Audio arriving before the provider socket opens is buffered, not lost.
    const pendingAudio: Buffer[] = [];
    let keepalive: ReturnType<typeof setInterval> | null = null;
    let closed = false;

    const shutdown = (clientCode: number, clientReason: string) => {
      if (closed) {
        return;
      }
      closed = true;
      if (keepalive) {
        clearInterval(keepalive);
        keepalive = null;
      }
      if (upstream.readyState === WebSocket.OPEN) {
        try {
          upstream.send(JSON.stringify({ type: 'CloseStream' }));
        } catch { /* closing anyway */ }
      }
      try { upstream.close(); } catch { /* closing anyway */ }
      if (client.readyState === WebSocket.OPEN) {
        client.close(clientCode, clientReason);
      }
    };

    upstream.on('open', () => {
      if (closed) {
        return;
      }
      for (const chunk of pendingAudio) {
        upstream.send(chunk);
      }
      pendingAudio.length = 0;
      client.send(JSON.stringify({ type: 'ready' }));
      // Deepgram closes idle streams; KeepAlive covers pauses in audio.
      keepalive = setInterval(() => {
        if (upstream.readyState === WebSocket.OPEN) {
          upstream.send(JSON.stringify({ type: 'KeepAlive' }));
        }
      }, KEEPALIVE_MS);
    });

    upstream.on('message', (raw) => {
      if (closed || client.readyState !== WebSocket.OPEN) {
        return;
      }
      const mapped = mapDeepgramMessage(raw.toString());
      if (mapped) {
        client.send(JSON.stringify(mapped));
      }
    });

    upstream.on('error', (error) => {
      logger.warn(`Deepgram upstream error: ${error.message}`);
      if (!closed && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'error',
          code: 'STT_PROVIDER_ERROR',
          message: 'Deepgram connection failed',
        }));
      }
      shutdown(1011, 'provider error');
    });

    upstream.on('close', () => {
      shutdown(1000, 'provider closed');
    });

    client.on('message', (data, isBinary) => {
      if (closed) {
        return;
      }
      if (isBinary) {
        const chunk = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
        if (upstream.readyState === WebSocket.OPEN) {
          upstream.send(chunk);
        } else if (upstream.readyState === WebSocket.CONNECTING) {
          if (pendingAudio.length >= MAX_PENDING_AUDIO_FRAMES) {
            logger.warn('Deepgram handshake stalled; closing STT relay to bound memory');
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'error',
                code: 'STT_PROVIDER_TIMEOUT',
                message: 'Deepgram connection did not open in time',
              }));
            }
            shutdown(1011, 'provider handshake stalled');
            return;
          }
          pendingAudio.push(chunk);
        }
        return;
      }
      // The only text message the client sends is a deliberate finish.
      try {
        const message = JSON.parse(data.toString());
        if (message?.type === 'finish') {
          shutdown(1000, 'client finished');
        }
      } catch { /* ignore malformed control frames */ }
    });

    client.on('close', () => {
      shutdown(1000, 'client closed');
    });

    client.on('error', () => {
      shutdown(1011, 'client error');
    });
  }
}
