/**
 * Voice Manager
 * Thin facade over speech recognition + synthesis + settings.
 *
 * Phase 7: lifecycle ORCHESTRATION lives in voiceStore (the single owner of
 * loop state). This class only provides capability checks, settings-applied
 * speech, and recognition passthrough — no state machine of its own.
 *
 * Engine selection: when cloud providers are configured on Kiaros Core
 * (Deepgram STT / ElevenLabs TTS, reported by GET /api/v1/voice/config),
 * they are used according to the owner's provider preference. Any cloud
 * failure falls back to the browser Web Speech API — honestly surfaced via
 * getProviderStatus(), and never mute, never fake.
 */

import { SpeechRecognitionService, SpeechRecognitionCallbacks } from './SpeechRecognitionService.js';
import { SpeechSynthesisService, SpeechSessionCallbacks } from './SpeechSynthesisService.js';
import { VoiceSettingsManager } from './VoiceSettings.js';
import { DeepgramSttEngine } from './DeepgramSttEngine.js';
import { ElevenLabsTtsEngine } from './ElevenLabsTtsEngine.js';
import { coreHeaders } from '../coreAuth';

export type VoiceState =
  | 'idle'
  | 'listening'
  | 'recognizing'
  | 'thinking'
  | 'speaking'
  | 'error';

export interface ProviderStatus {
  /** Engine the NEXT listen/speak will use. */
  stt: 'deepgram' | 'browser';
  tts: 'elevenlabs' | 'browser';
  /** Cloud capability as reported by Core (config present server-side). */
  cloudSttConfigured: boolean;
  cloudTtsConfigured: boolean;
  /** True while a recent cloud failure has us on the browser fallback. */
  sttDegraded: boolean;
  ttsDegraded: boolean;
}

const VOICE_CONFIG_URL = 'http://localhost:3010/api/v1/voice/config';
const CONFIG_TIMEOUT_MS = 3_000;
/** After a cloud failure, stay on the browser engine this long. */
const DEGRADE_MS = 60_000;

export class VoiceManager {
  private recognitionService: SpeechRecognitionService | null = null;
  private synthesisService: SpeechSynthesisService | null = null;
  private settingsManager: VoiceSettingsManager | null = null;
  private deepgramEngine: DeepgramSttEngine | null = null;
  private elevenLabsEngine: ElevenLabsTtsEngine | null = null;

  private cloudStt = false;
  private cloudTts = false;
  private sttDegradedUntil = 0;
  private ttsDegradedUntil = 0;
  private statusListener: ((status: ProviderStatus) => void) | null = null;

  getRecognition(): SpeechRecognitionService {
    if (!this.recognitionService) {
      this.recognitionService = new SpeechRecognitionService();
    }
    return this.recognitionService;
  }

  getSynthesis(): SpeechSynthesisService {
    if (!this.synthesisService) {
      this.synthesisService = new SpeechSynthesisService();
    }
    return this.synthesisService;
  }

  getSettingsManager(): VoiceSettingsManager {
    if (!this.settingsManager) {
      this.settingsManager = new VoiceSettingsManager();
    }
    return this.settingsManager;
  }

  getDeepgram(): DeepgramSttEngine {
    if (!this.deepgramEngine) {
      this.deepgramEngine = new DeepgramSttEngine();
    }
    return this.deepgramEngine;
  }

  getElevenLabs(): ElevenLabsTtsEngine {
    if (!this.elevenLabsEngine) {
      this.elevenLabsEngine = new ElevenLabsTtsEngine();
    }
    return this.elevenLabsEngine;
  }

  /** Notify the UI layer whenever engine selection or degradation changes. */
  onStatusChange(listener: ((status: ProviderStatus) => void) | null): void {
    this.statusListener = listener;
  }

  private emitStatus(): void {
    this.statusListener?.(this.getProviderStatus());
  }

  /**
   * Ask Core which cloud providers are configured. Failure (Core down,
   * timeout) honestly means "no cloud" — the browser engines still work.
   */
  async refreshCapabilities(): Promise<ProviderStatus> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), CONFIG_TIMEOUT_MS);
      const response = await fetch(VOICE_CONFIG_URL, {
        headers: coreHeaders(),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (response.ok) {
        const payload = await response.json();
        this.cloudStt = Boolean(payload?.data?.stt?.available);
        this.cloudTts = Boolean(payload?.data?.tts?.available);
      } else {
        this.cloudStt = false;
        this.cloudTts = false;
      }
    } catch {
      this.cloudStt = false;
      this.cloudTts = false;
    }
    this.emitStatus();
    return this.getProviderStatus();
  }

  getProviderStatus(): ProviderStatus {
    return {
      stt: this.useDeepgram() ? 'deepgram' : 'browser',
      tts: this.useElevenLabs() ? 'elevenlabs' : 'browser',
      cloudSttConfigured: this.cloudStt,
      cloudTtsConfigured: this.cloudTts,
      sttDegraded: this.cloudStt && Date.now() < this.sttDegradedUntil,
      ttsDegraded: this.cloudTts && Date.now() < this.ttsDegradedUntil,
    };
  }

  private useDeepgram(): boolean {
    const preference = this.getSettingsManager().getSettings().sttProvider;
    if (preference === 'browser') return false;
    return (
      this.cloudStt &&
      this.getDeepgram().isSupported() &&
      Date.now() >= this.sttDegradedUntil
    );
  }

  private useElevenLabs(): boolean {
    const preference = this.getSettingsManager().getSettings().ttsProvider;
    if (preference === 'browser') return false;
    return (
      this.cloudTts &&
      this.getElevenLabs().isSupported() &&
      Date.now() >= this.ttsDegradedUntil
    );
  }

  private degradeStt(): void {
    this.sttDegradedUntil = Date.now() + DEGRADE_MS;
    this.emitStatus();
  }

  private degradeTts(): void {
    this.ttsDegradedUntil = Date.now() + DEGRADE_MS;
    this.emitStatus();
  }

  /**
   * Start one recognition pass. Cloud setup failures (before any speech
   * was captured) transparently retry the same pass on the browser engine.
   */
  listen(callbacks: SpeechRecognitionCallbacks): void {
    const language = this.getSettingsManager().getSettings().language;

    if (!this.useDeepgram()) {
      const recognition = this.getRecognition();
      recognition.setLanguage(language);
      recognition.start(callbacks);
      return;
    }

    const deepgram = this.getDeepgram();
    deepgram.setLanguage(language);

    let captureStarted = false;
    deepgram.start({
      onStart: () => {
        captureStarted = true;
        callbacks.onStart?.();
      },
      onResult: (result) => callbacks.onResult?.(result),
      onEnd: () => callbacks.onEnd?.(),
      onError: (error) => {
        const isNoSpeech = /no speech/i.test(error);
        if (!captureStarted && !isNoSpeech) {
          // Never captured audio: the provider path failed to set up.
          // Fall back to the browser engine for this same pass.
          console.warn('Deepgram unavailable, falling back to browser STT:', error);
          this.degradeStt();
          const recognition = this.getRecognition();
          recognition.setLanguage(language);
          recognition.start(callbacks);
          return;
        }
        if (!isNoSpeech) {
          this.degradeStt();
        }
        callbacks.onError?.(error);
      },
    });
  }

  stopListening(): void {
    this.getRecognition().stop();
    this.getDeepgram().stop();
  }

  /**
   * Speak text with current settings applied. onDone fires exactly once
   * (completed | stopped | error). Callers own what happens next.
   * A cloud failure before audio starts retries once on the browser engine.
   */
  speak(text: string, callbacks: SpeechSessionCallbacks): void {
    const settings = this.getSettingsManager().getSettings();

    if (!this.useElevenLabs()) {
      this.speakWithBrowser(text, callbacks, settings);
      return;
    }

    const engine = this.getElevenLabs();
    engine.setVolume(settings.volume);
    engine.setRate(settings.rate);

    let audioStarted = false;
    engine.speak(text, {
      onStart: () => {
        audioStarted = true;
        callbacks.onStart?.();
      },
      onDone: (outcome, detail) => {
        if (outcome === 'error' && !audioStarted) {
          // No audio ever played — retry this reply on the browser voice.
          console.warn('ElevenLabs unavailable, falling back to browser TTS:', detail);
          this.degradeTts();
          this.speakWithBrowser(text, callbacks, settings);
          return;
        }
        if (outcome === 'error') {
          this.degradeTts();
        }
        callbacks.onDone?.(outcome, detail);
      },
    });
  }

  private speakWithBrowser(
    text: string,
    callbacks: SpeechSessionCallbacks,
    settings: ReturnType<VoiceSettingsManager['getSettings']>
  ): void {
    const synthesis = this.getSynthesis();
    synthesis.setRate(settings.rate);
    synthesis.setPitch(settings.pitch);
    synthesis.setVolume(settings.volume);
    if (settings.voiceURI) {
      const voice = synthesis.getVoices().find((v) => v.voiceURI === settings.voiceURI);
      if (voice) synthesis.setVoice(voice);
    }
    synthesis.speak(text, callbacks);
  }

  /**
   * Prime cloud audio playback. MUST be called synchronously inside a real
   * user gesture (the mic press) — Safari only allows delayed replies on an
   * element that was activated during a gesture.
   */
  unlockAudio(): void {
    this.getElevenLabs().unlock();
  }

  stopSpeaking(): void {
    // Stop both: barge-in must silence whichever engine is speaking.
    this.getSynthesis().stop();
    this.getElevenLabs().stop();
  }

  isSpeaking(): boolean {
    return this.getSynthesis().isSpeaking() || this.getElevenLabs().isSpeaking();
  }

  isSupported(): boolean {
    const sttSupported =
      this.getRecognition().isSupported() ||
      (this.cloudStt && this.getDeepgram().isSupported());
    const ttsSupported =
      this.getSynthesis().isSupported() ||
      (this.cloudTts && this.getElevenLabs().isSupported());
    return sttSupported && ttsSupported;
  }

  getSupportError(): string | null {
    const browserSttError = this.getRecognition().getSupportError();
    if (browserSttError && !(this.cloudStt && this.getDeepgram().isSupported())) {
      return browserSttError;
    }

    if (
      !this.getSynthesis().isSupported() &&
      !(this.cloudTts && this.getElevenLabs().isSupported())
    ) {
      return 'Speech synthesis not supported in this browser.';
    }

    return null;
  }

  /** Kept for voice-selection UI. */
  getSynthesisService(): SpeechSynthesisService {
    return this.getSynthesis();
  }
}
