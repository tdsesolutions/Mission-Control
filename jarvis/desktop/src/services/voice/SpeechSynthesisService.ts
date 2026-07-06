/**
 * Speech Synthesis Service
 * Converts text to speech using the Web Speech API.
 *
 * Hardened for the conversational lifecycle (Phase 7):
 * - Sentence chunking: Chrome silently kills utterances after ~15s; chunked
 *   playback also gives natural pacing.
 * - Per-session callbacks: cancelling a previous utterance must never leak
 *   an 'interrupted' error into the NEXT speech session's handlers.
 * - 'interrupted'/'canceled' are benign (they mean we stopped on purpose).
 * - Keepalive resume() interval works around Chrome's paused-synthesis stall.
 * - Watchdog per chunk guarantees the session always completes — a stuck
 *   'speaking' state is a lifecycle violation.
 * - voiceschanged handling: getVoices() is empty until the event fires.
 */

export interface SpeechSynthesisOptions {
  rate: number;
  pitch: number;
  volume: number;
  voice: SpeechSynthesisVoice | null;
}

export interface SpeechSessionCallbacks {
  onStart?: () => void;
  /** Called exactly once per speak() call: when done, stopped, or failed. */
  onDone?: (outcome: 'completed' | 'stopped' | 'error', detail?: string) => void;
}

const MAX_CHUNK_CHARS = 200;
const KEEPALIVE_MS = 5000;
const WATCHDOG_BASE_MS = 8000;
const WATCHDOG_PER_CHAR_MS = 120;

function chunkText(text: string): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];

  // Split on sentence boundaries, then pack into chunks under the limit.
  const sentences = clean.match(/[^.!?…]+[.!?…]+["')\]]*|[^.!?…]+$/g) ?? [clean];
  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    const candidate = current ? `${current} ${sentence.trim()}` : sentence.trim();
    if (candidate.length > MAX_CHUNK_CHARS && current) {
      chunks.push(current);
      current = sentence.trim();
    } else {
      current = candidate;
    }
    // A single overlong sentence still gets hard-split.
    while (current.length > MAX_CHUNK_CHARS * 1.5) {
      const cut = current.lastIndexOf(' ', MAX_CHUNK_CHARS);
      const at = cut > 40 ? cut : MAX_CHUNK_CHARS;
      chunks.push(current.slice(0, at));
      current = current.slice(at).trim();
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export class SpeechSynthesisService {
  private synthesis: SpeechSynthesis | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private options: SpeechSynthesisOptions = {
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0,
    voice: null,
  };

  /** Monotonic token: bumping it invalidates any in-flight session. */
  private sessionToken = 0;
  private speaking = false;
  private keepalive: ReturnType<typeof setInterval> | null = null;
  private watchdog: ReturnType<typeof setTimeout> | null = null;

  private initialize(): void {
    if (typeof window === 'undefined') return;
    if (this.synthesis) return;

    this.synthesis = window.speechSynthesis;
    this.voices = this.synthesis.getVoices();
    // Chrome populates voices asynchronously.
    this.synthesis.addEventListener?.('voiceschanged', () => {
      this.voices = this.synthesis?.getVoices() ?? [];
      if (!this.options.voice) this.pickDefaultVoice();
    });
    if (this.voices.length > 0 && !this.options.voice) this.pickDefaultVoice();
  }

  private pickDefaultVoice(): void {
    const preferred =
      this.voices.find(
        (v) =>
          v.lang.startsWith('en') &&
          (v.name.includes('Premium') || v.name.includes('Enhanced') || v.name.includes('Samantha') || v.name.includes('Google')),
      ) ||
      this.voices.find((v) => v.lang.startsWith('en')) ||
      this.voices[0] ||
      null;
    this.options.voice = preferred;
  }

  /**
   * Speak text as a chunked session. onDone fires exactly once.
   */
  speak(text: string, callbacks: SpeechSessionCallbacks): void {
    this.initialize();

    if (!this.synthesis) {
      callbacks.onDone?.('error', 'Speech synthesis not supported');
      return;
    }

    // Supersede any in-flight session (its onDone('stopped') fires via stop).
    this.stop();

    const token = ++this.sessionToken;
    const chunks = chunkText(text);
    if (chunks.length === 0) {
      callbacks.onDone?.('completed');
      return;
    }

    let started = false;
    let finished = false;
    const finish = (outcome: 'completed' | 'stopped' | 'error', detail?: string) => {
      if (finished) return;
      finished = true;
      if (token === this.sessionToken) {
        this.speaking = false;
        this.clearTimers();
      }
      callbacks.onDone?.(outcome, detail);
    };

    const speakChunk = (index: number) => {
      if (token !== this.sessionToken) {
        finish('stopped');
        return;
      }
      if (index >= chunks.length) {
        finish('completed');
        return;
      }

      const chunk = chunks[index];
      const utterance = new SpeechSynthesisUtterance(chunk);
      utterance.rate = this.options.rate;
      utterance.pitch = this.options.pitch;
      utterance.volume = this.options.volume;
      if (this.options.voice) utterance.voice = this.options.voice;

      const armWatchdog = () => {
        if (this.watchdog) clearTimeout(this.watchdog);
        this.watchdog = setTimeout(() => {
          // Chunk never completed — force the session to a terminal state.
          if (token === this.sessionToken && !finished) {
            this.synthesis?.cancel();
            finish('error', 'speech watchdog fired (stuck utterance)');
          }
        }, WATCHDOG_BASE_MS + chunk.length * WATCHDOG_PER_CHAR_MS);
      };

      utterance.onstart = () => {
        if (token !== this.sessionToken) return;
        if (!started) {
          started = true;
          this.speaking = true;
          this.startKeepalive();
          callbacks.onStart?.();
        }
        armWatchdog();
      };

      utterance.onend = () => {
        if (token !== this.sessionToken) {
          finish('stopped');
          return;
        }
        speakChunk(index + 1);
      };

      utterance.onerror = (event) => {
        // Deliberate cancellation is not an error.
        if (event.error === 'interrupted' || event.error === 'canceled') {
          finish('stopped');
          return;
        }
        if (token !== this.sessionToken) {
          finish('stopped');
          return;
        }
        finish('error', `Speech synthesis error: ${event.error}`);
      };

      armWatchdog();
      try {
        this.synthesis!.speak(utterance);
      } catch {
        finish('error', 'Failed to start speech synthesis');
      }
    };

    speakChunk(0);
  }

  /** Stop speaking. Invalidates the current session; safe to call anytime. */
  stop(): void {
    this.initialize();
    this.sessionToken++;
    this.speaking = false;
    this.clearTimers();
    try {
      this.synthesis?.cancel();
    } catch {
      // ignore
    }
  }

  private startKeepalive(): void {
    // Chrome bug: long speech silently pauses; pause/resume keeps it alive.
    if (this.keepalive) clearInterval(this.keepalive);
    this.keepalive = setInterval(() => {
      if (!this.synthesis || !this.speaking) return;
      if (this.synthesis.speaking && !this.synthesis.paused) {
        this.synthesis.pause();
        this.synthesis.resume();
      }
    }, KEEPALIVE_MS);
  }

  private clearTimers(): void {
    if (this.keepalive) {
      clearInterval(this.keepalive);
      this.keepalive = null;
    }
    if (this.watchdog) {
      clearTimeout(this.watchdog);
      this.watchdog = null;
    }
  }

  getVoices(): SpeechSynthesisVoice[] {
    this.initialize();
    if (this.voices.length === 0 && this.synthesis) {
      this.voices = this.synthesis.getVoices();
    }
    return this.voices;
  }

  setVoice(voice: SpeechSynthesisVoice): void {
    this.options.voice = voice;
  }

  setRate(rate: number): void {
    this.options.rate = Math.max(0.5, Math.min(2.0, rate));
  }

  setPitch(pitch: number): void {
    this.options.pitch = Math.max(0.5, Math.min(2.0, pitch));
  }

  setVolume(volume: number): void {
    this.options.volume = Math.max(0, Math.min(1.0, volume));
  }

  getOptions(): SpeechSynthesisOptions {
    return { ...this.options };
  }

  isSpeaking(): boolean {
    return this.speaking;
  }

  isSupported(): boolean {
    return typeof window !== 'undefined' && !!window.speechSynthesis;
  }
}
