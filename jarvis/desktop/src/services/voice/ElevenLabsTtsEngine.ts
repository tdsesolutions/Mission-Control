/**
 * ElevenLabs TTS engine (cloud, via Core proxy).
 * Fetches synthesized audio from POST /api/v1/voice/tts and plays it with
 * an HTMLAudioElement — the API key never reaches the browser. Honors the
 * SpeechSessionCallbacks contract: onDone fires exactly once per speak()
 * (completed | stopped | error), with a playback watchdog so a stuck
 * 'speaking' state is impossible.
 */

import { coreHeaders } from '../coreAuth';
import type { SpeechSessionCallbacks } from './SpeechSynthesisService.js';

const TTS_URL = 'http://localhost:3010/api/v1/voice/tts';
const FETCH_TIMEOUT_MS = 30_000;
/** Watchdog slack beyond the audio's own duration. */
const PLAYBACK_GRACE_MS = 8_000;
/** Watchdog when the duration is unknown (metadata missing). */
const UNKNOWN_DURATION_WATCHDOG_MS = 90_000;

export class ElevenLabsTtsEngine {
  private sessionToken = 0;
  private audio: HTMLAudioElement | null = null;
  private objectUrl: string | null = null;
  private abortController: AbortController | null = null;
  private speaking = false;
  private volume = 1.0;
  private rate = 1.0;
  private activeFinish: ((outcome: 'completed' | 'stopped' | 'error', detail?: string) => void) | null = null;

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1.0, volume));
  }

  setRate(rate: number): void {
    this.rate = Math.max(0.5, Math.min(2.0, rate));
  }

  isSupported(): boolean {
    return typeof window !== 'undefined' && typeof Audio !== 'undefined';
  }

  isSpeaking(): boolean {
    return this.speaking;
  }

  speak(text: string, callbacks: SpeechSessionCallbacks): void {
    // Supersede any in-flight session (its onDone('stopped') fires via stop).
    this.stop();

    const token = ++this.sessionToken;
    let finished = false;
    let watchdog: ReturnType<typeof setTimeout> | null = null;

    const finish = (outcome: 'completed' | 'stopped' | 'error', detail?: string) => {
      if (finished) return;
      finished = true;
      if (watchdog) {
        clearTimeout(watchdog);
        watchdog = null;
      }
      if (token === this.sessionToken) {
        this.speaking = false;
        this.releaseMedia();
        this.activeFinish = null;
      }
      callbacks.onDone?.(outcome, detail);
    };
    this.activeFinish = finish;

    void (async () => {
      const controller = new AbortController();
      this.abortController = controller;
      const fetchTimeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      let response: Response;
      try {
        response = await fetch(TTS_URL, {
          method: 'POST',
          headers: coreHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ text }),
          signal: controller.signal,
        });
      } catch {
        clearTimeout(fetchTimeout);
        finish(token !== this.sessionToken ? 'stopped' : 'error', 'TTS request failed');
        return;
      }
      clearTimeout(fetchTimeout);

      if (token !== this.sessionToken) {
        finish('stopped');
        return;
      }

      if (!response.ok) {
        let detail = `TTS HTTP ${response.status}`;
        try {
          const body = await response.json();
          detail = body?.error?.message || detail;
        } catch { /* keep status text */ }
        finish('error', detail);
        return;
      }

      let blob: Blob;
      try {
        blob = await response.blob();
      } catch {
        finish(token !== this.sessionToken ? 'stopped' : 'error', 'TTS download failed');
        return;
      }
      if (token !== this.sessionToken) {
        finish('stopped');
        return;
      }

      this.objectUrl = URL.createObjectURL(blob);
      const audio = new Audio(this.objectUrl);
      this.audio = audio;
      audio.volume = this.volume;
      audio.playbackRate = this.rate;

      const armWatchdog = () => {
        if (watchdog) clearTimeout(watchdog);
        const durationMs =
          Number.isFinite(audio.duration) && audio.duration > 0
            ? (audio.duration * 1000) / (this.rate || 1)
            : UNKNOWN_DURATION_WATCHDOG_MS;
        watchdog = setTimeout(() => {
          finish('error', 'audio watchdog fired (stuck playback)');
        }, durationMs + PLAYBACK_GRACE_MS);
      };

      audio.onplaying = () => {
        if (token !== this.sessionToken) return;
        if (!this.speaking) {
          this.speaking = true;
          callbacks.onStart?.();
        }
        armWatchdog();
      };
      audio.onended = () => finish('completed');
      audio.onerror = () => {
        finish(token !== this.sessionToken ? 'stopped' : 'error', 'Audio playback error');
      };

      armWatchdog();
      try {
        await audio.play();
      } catch {
        finish(token !== this.sessionToken ? 'stopped' : 'error', 'Audio playback blocked');
      }
    })();
  }

  /** Stop speaking. Invalidates the current session; safe to call anytime. */
  stop(): void {
    this.sessionToken++;
    this.abortController?.abort();
    this.abortController = null;
    this.releaseMedia();
    this.speaking = false;
    const finish = this.activeFinish;
    this.activeFinish = null;
    finish?.('stopped');
  }

  private releaseMedia(): void {
    if (this.audio) {
      try { this.audio.pause(); } catch { /* already paused */ }
      this.audio.onplaying = null;
      this.audio.onended = null;
      this.audio.onerror = null;
      this.audio.removeAttribute('src');
      this.audio = null;
    }
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }
}
