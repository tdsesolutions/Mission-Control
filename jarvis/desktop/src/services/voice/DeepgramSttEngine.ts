/**
 * Deepgram STT engine (cloud, via Core proxy).
 * Streams mic audio to ws://localhost:3010/ws/voice/stt; Kiaros Core relays
 * to Deepgram — the API key never reaches the browser. Honors the same
 * one-pass callback contract as SpeechRecognitionService: exactly one
 * terminal callback per start() (final onResult, onEnd, or onError).
 *
 * NOTE: choosing this engine sends microphone audio to a cloud provider —
 * an owner-configured, opt-in exception to the local-only voice default
 * (VOICE_ARCHITECTURE.md).
 */

import { coreWsQuery } from '../coreAuth';
import type { SpeechRecognitionCallbacks } from './SpeechRecognitionService.js';

const STT_WS_URL = 'ws://localhost:3010/ws/voice/stt';
/** Silence bound: no transcript at all → "no speech" (relisten path). */
const NO_SPEECH_TIMEOUT_MS = 8_000;
/** Hard bound per utterance — the loop must never listen forever. */
const MAX_UTTERANCE_MS = 30_000;
const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
const AUDIO_TIMESLICE_MS = 250;

export class DeepgramSttEngine {
  private sessionToken = 0;
  private ws: WebSocket | null = null;
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private language = '';
  private activeStop: (() => void) | null = null;

  setLanguage(language: string): void {
    this.language = language;
  }

  isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      window.isSecureContext &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof MediaRecorder !== 'undefined' &&
      MIME_CANDIDATES.some((mime) => MediaRecorder.isTypeSupported(mime))
    );
  }

  getSupportError(): string | null {
    if (typeof window === 'undefined') {
      return 'Speech recognition not available in server environment.';
    }
    if (!window.isSecureContext) {
      return 'Speech recognition requires a secure context (HTTPS or localhost).';
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      return 'Audio capture not supported in this browser.';
    }
    if (!MIME_CANDIDATES.some((mime) => MediaRecorder.isTypeSupported(mime))) {
      return 'No supported audio recording format in this browser.';
    }
    return null;
  }

  /** One listen pass (single utterance), mirroring the browser engine. */
  start(callbacks: SpeechRecognitionCallbacks): void {
    const token = ++this.sessionToken;
    const finals: string[] = [];
    let sawTranscript = false;
    let concluded = false;
    let noSpeechTimer: ReturnType<typeof setTimeout> | null = null;
    let maxTimer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (noSpeechTimer) clearTimeout(noSpeechTimer);
      if (maxTimer) clearTimeout(maxTimer);
      noSpeechTimer = null;
      maxTimer = null;
      if (this.recorder && this.recorder.state !== 'inactive') {
        try { this.recorder.stop(); } catch { /* already stopped */ }
      }
      this.recorder = null;
      this.stream?.getTracks().forEach((track) => track.stop());
      this.stream = null;
      if (this.ws) {
        const ws = this.ws;
        this.ws = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
        if (ws.readyState === WebSocket.OPEN) {
          try { ws.send(JSON.stringify({ type: 'finish' })); } catch { /* closing */ }
        }
        try { ws.close(1000); } catch { /* closing */ }
      }
      this.activeStop = null;
    };

    const conclude = (fn: () => void) => {
      if (concluded || token !== this.sessionToken) return;
      concluded = true;
      cleanup();
      fn();
    };

    const concludeWithCombined = () => {
      const combined = finals.join(' ').trim();
      if (combined) {
        callbacks.onResult?.({ transcript: combined, confidence: 1, isFinal: true });
      } else {
        callbacks.onEnd?.();
      }
    };

    // Deliberate stop() concludes like the browser engine's onend.
    this.activeStop = () => conclude(concludeWithCombined);

    const armNoSpeech = () => {
      if (noSpeechTimer) clearTimeout(noSpeechTimer);
      noSpeechTimer = setTimeout(() => {
        if (!sawTranscript) {
          conclude(() => callbacks.onError?.('No speech detected. Please try again.'));
        }
      }, NO_SPEECH_TIMEOUT_MS);
    };

    void (async () => {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        });
      } catch (err: unknown) {
        const name = (err as { name?: string })?.name;
        const message =
          name === 'NotAllowedError' || name === 'PermissionDeniedError'
            ? 'Microphone access denied. Please allow microphone access.'
            : name === 'NotFoundError'
              ? 'Microphone not available. Please check your settings.'
              : 'Failed to access microphone.';
        conclude(() => callbacks.onError?.(message));
        return;
      }

      if (token !== this.sessionToken) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      this.stream = stream;

      const mime = MIME_CANDIDATES.find((candidate) => MediaRecorder.isTypeSupported(candidate));
      if (!mime) {
        conclude(() => callbacks.onError?.('No supported audio recording format in this browser.'));
        return;
      }

      const tokenQuery = coreWsQuery();
      const langQuery = this.language
        ? `${tokenQuery ? '&' : '?'}language=${encodeURIComponent(this.language)}`
        : '';
      let ws: WebSocket;
      try {
        ws = new WebSocket(`${STT_WS_URL}${tokenQuery}${langQuery}`);
      } catch {
        conclude(() => callbacks.onError?.('Speech service connection failed.'));
        return;
      }
      this.ws = ws;

      ws.onmessage = (event) => {
        if (token !== this.sessionToken) return;
        let message: { type?: string; transcript?: string; confidence?: number; isFinal?: boolean; speechFinal?: boolean; message?: string; code?: string };
        try {
          message = JSON.parse(String(event.data));
        } catch {
          return;
        }

        if (message.type === 'ready') {
          try {
            this.recorder = new MediaRecorder(stream, { mimeType: mime });
            this.recorder.ondataavailable = (chunk) => {
              if (chunk.data.size > 0) {
                void chunk.data.arrayBuffer().then((buffer) => {
                  if (token === this.sessionToken && ws.readyState === WebSocket.OPEN) {
                    ws.send(buffer);
                  }
                });
              }
            };
            this.recorder.start(AUDIO_TIMESLICE_MS);
            callbacks.onStart?.();
            armNoSpeech();
            maxTimer = setTimeout(() => conclude(concludeWithCombined), MAX_UTTERANCE_MS);
          } catch {
            conclude(() => callbacks.onError?.('Failed to start audio capture.'));
          }
          return;
        }

        if (message.type === 'transcript') {
          const segment = String(message.transcript ?? '').trim();
          if (segment) {
            sawTranscript = true;
            armNoSpeech();
          }
          if (message.isFinal && segment) {
            finals.push(segment);
          }
          const combined = finals.join(' ').trim();
          const progressive = message.isFinal ? combined : [combined, segment].filter(Boolean).join(' ');

          if (message.speechFinal) {
            // Deepgram end-of-utterance — the pass's final result.
            const finalText = combined || progressive;
            if (finalText) {
              conclude(() =>
                callbacks.onResult?.({
                  transcript: finalText,
                  confidence: Number(message.confidence ?? 0),
                  isFinal: true,
                })
              );
            } else {
              conclude(() => callbacks.onEnd?.());
            }
          } else if (progressive) {
            callbacks.onResult?.({
              transcript: progressive,
              confidence: Number(message.confidence ?? 0),
              isFinal: false,
            });
          }
          return;
        }

        if (message.type === 'error') {
          conclude(() =>
            callbacks.onError?.(
              `Speech recognition error: ${message.message || message.code || 'unknown'}`
            )
          );
        }
      };

      ws.onerror = () => {
        conclude(() => callbacks.onError?.('Speech service connection failed.'));
      };

      ws.onclose = () => {
        // Provider closed first (e.g. its own endpointing) — use what we have.
        conclude(concludeWithCombined);
      };
    })();
  }

  stop(): void {
    const stop = this.activeStop;
    if (stop) {
      stop();
    }
  }

  /** Hard abort: no callbacks, used when the loop is being torn down. */
  abort(): void {
    this.sessionToken++;
    if (this.recorder && this.recorder.state !== 'inactive') {
      try { this.recorder.stop(); } catch { /* already stopped */ }
    }
    this.recorder = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    if (this.ws) {
      try { this.ws.close(1000); } catch { /* closing */ }
      this.ws = null;
    }
    this.activeStop = null;
  }
}
