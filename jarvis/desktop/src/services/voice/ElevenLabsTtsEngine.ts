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
  private unlocked = false;
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

  /**
   * Prime audio playback from within a REAL user gesture (mic press).
   * Safari's autoplay policy blocks play() calls issued long after the
   * gesture; playing a silent clip on the persistent element during the
   * gesture marks that element user-activated, so later replies on the
   * same element are allowed. Safe to call repeatedly; no-op elsewhere.
   */
  unlock(): void {
    if (!this.isSupported()) return;
    const audio = this.ensureElement();
    if (this.unlocked) return;
    // 2-sample silent WAV — inaudible, decodes everywhere.
    audio.src = SILENT_WAV_DATA_URI;
    audio.muted = true;
    void audio
      .play()
      .then(() => {
        audio.pause();
        this.unlocked = true;
      })
      .catch(() => {
        // Rejected: leave unlocked=false so the next press retries.
      })
      .finally(() => {
        audio.muted = false;
        audio.removeAttribute('src');
      });
  }

  /** One persistent element: user activation sticks to the element. */
  private ensureElement(): HTMLAudioElement {
    if (!this.audio) {
      this.audio = new Audio();
    }
    return this.audio;
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
      // Reuse the persistent (gesture-unlocked) element — a fresh Audio()
      // created here would carry no user activation and Safari would block
      // playback this far from the mic press.
      const audio = this.ensureElement();
      audio.src = this.objectUrl;
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
      // Keep the element itself — its user activation must survive for the
      // next reply (see unlock()).
    }
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }
}

/** 44-byte header + 2 zero samples: the shortest broadly-decodable clip. */
const SILENT_WAV_DATA_URI =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAIlYAAESsAAACABAAZGF0YQQAAAAAAAAA';
