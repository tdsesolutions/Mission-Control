/**
 * Voice Manager
 * Thin facade over speech recognition + synthesis + settings.
 *
 * Phase 7: lifecycle ORCHESTRATION lives in voiceStore (the single owner of
 * loop state). This class only provides capability checks, settings-applied
 * speech, and recognition passthrough — no state machine of its own.
 */

import { SpeechRecognitionService, SpeechRecognitionCallbacks } from './SpeechRecognitionService.js';
import { SpeechSynthesisService, SpeechSessionCallbacks } from './SpeechSynthesisService.js';
import { VoiceSettingsManager } from './VoiceSettings.js';

export type VoiceState =
  | 'idle'
  | 'listening'
  | 'recognizing'
  | 'thinking'
  | 'speaking'
  | 'error';

export class VoiceManager {
  private recognitionService: SpeechRecognitionService | null = null;
  private synthesisService: SpeechSynthesisService | null = null;
  private settingsManager: VoiceSettingsManager | null = null;

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

  /** Start one recognition pass. */
  listen(callbacks: SpeechRecognitionCallbacks): void {
    this.getRecognition().start(callbacks);
  }

  stopListening(): void {
    this.getRecognition().stop();
  }

  /**
   * Speak text with current settings applied. onDone fires exactly once
   * (completed | stopped | error). Callers own what happens next.
   */
  speak(text: string, callbacks: SpeechSessionCallbacks): void {
    const synthesis = this.getSynthesis();
    const settings = this.getSettingsManager().getSettings();

    synthesis.setRate(settings.rate);
    synthesis.setPitch(settings.pitch);
    synthesis.setVolume(settings.volume);
    if (settings.voiceURI) {
      const voice = synthesis.getVoices().find((v) => v.voiceURI === settings.voiceURI);
      if (voice) synthesis.setVoice(voice);
    }

    synthesis.speak(text, callbacks);
  }

  stopSpeaking(): void {
    this.getSynthesis().stop();
  }

  isSpeaking(): boolean {
    return this.getSynthesis().isSpeaking();
  }

  isSupported(): boolean {
    return this.getRecognition().isSupported() && this.getSynthesis().isSupported();
  }

  getSupportError(): string | null {
    const recognitionError = this.getRecognition().getSupportError();
    if (recognitionError) return recognitionError;

    if (!this.getSynthesis().isSupported()) {
      return 'Speech synthesis not supported in this browser.';
    }

    return null;
  }

  /** Kept for voice-selection UI. */
  getSynthesisService(): SpeechSynthesisService {
    return this.getSynthesis();
  }
}
