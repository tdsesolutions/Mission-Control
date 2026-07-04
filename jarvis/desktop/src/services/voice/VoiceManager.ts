/**
 * Voice Manager
 * Central orchestrator for voice interactions
 * 
 * Pipeline:
 * Microphone → Speech Recognition → Conversation Manager → Response → Speech Synthesis → User
 */

import { SpeechRecognitionService, SpeechRecognitionResult } from './SpeechRecognitionService.js';
import { SpeechSynthesisService } from './SpeechSynthesisService.js';
import { VoiceSettingsManager } from './VoiceSettings.js';

export type VoiceState =
  | 'idle'
  | 'listening'
  | 'recognizing'
  | 'thinking'
  | 'speaking'
  | 'error';

export interface VoiceCallbacks {
  onStateChange?: (state: VoiceState) => void;
  onTranscript?: (transcript: string, isFinal: boolean) => void;
  onResponse?: (response: string) => void;
  onError?: (error: string) => void;
}

export class VoiceManager {
  private recognitionService: SpeechRecognitionService | null = null;
  private synthesisService: SpeechSynthesisService | null = null;
  private settingsManager: VoiceSettingsManager | null = null;
  private state: VoiceState = 'idle';
  private callbacks: VoiceCallbacks = {};
  private isStarting: boolean = false;

  constructor() {
    // Defer service initialization to first use
  }

  private getRecognitionService(): SpeechRecognitionService {
    if (!this.recognitionService) {
      this.recognitionService = new SpeechRecognitionService();
    }
    return this.recognitionService;
  }

  private _getSynthesisService(): SpeechSynthesisService {
    if (!this.synthesisService) {
      this.synthesisService = new SpeechSynthesisService();
    }
    return this.synthesisService;
  }

  private getSettingsManagerService(): VoiceSettingsManager {
    if (!this.settingsManager) {
      this.settingsManager = new VoiceSettingsManager();
    }
    return this.settingsManager;
  }

  /**
   * Start voice interaction
   */
  startListening(callbacks: VoiceCallbacks): void {
    if (this.isStarting) {
      console.log('VoiceManager: Already starting, ignoring duplicate call');
      return;
    }
    
    if (this.state === 'listening' || this.state === 'recognizing') {
      console.log('VoiceManager: Already listening, ignoring start call');
      return;
    }
    
    this.isStarting = true;
    this.callbacks = callbacks;

    const recognitionService = this.getRecognitionService();
    const supportError = recognitionService.getSupportError();
    
    if (supportError) {
      this.isStarting = false;
      this.setState('error');
      this.callbacks.onError?.(supportError);
      return;
    }

    this.setState('listening');

    this.getRecognitionService().start({
      onStart: () => {
        this.isStarting = false;
        this.setState('listening');
      },
      onResult: (result: SpeechRecognitionResult) => {
        if (result.isFinal) {
          this.setState('thinking');
          this.callbacks.onTranscript?.(result.transcript, true);
        } else {
          this.setState('recognizing');
          this.callbacks.onTranscript?.(result.transcript, false);
        }
      },
      onEnd: () => {
        this.isStarting = false;
        if (this.state === 'listening' || this.state === 'recognizing' || this.state === 'thinking') {
          this.setState('idle');
        }
      },
      onError: (error: string) => {
        this.isStarting = false;
        this.setState('error');
        this.callbacks.onError?.(error);
      },
    });
  }

  /**
   * Stop listening
   */
  stopListening(): void {
    this.isStarting = false;
    this.getRecognitionService().stop();
    if (this.state === 'listening' || this.state === 'recognizing') {
      this.setState('idle');
    }
  }

  /**
   * Speak a response
   */
  speak(text: string): void {
    if (!this.getSettingsManagerService().isEnabled()) return;

    if (!this._getSynthesisService().isSupported()) {
      this.callbacks.onError?.('Speech synthesis not supported');
      return;
    }

    const settings = this.getSettingsManagerService().getSettings();
    this._getSynthesisService().setRate(settings.rate);
    this._getSynthesisService().setPitch(settings.pitch);
    this._getSynthesisService().setVolume(settings.volume);

    if (settings.voiceURI) {
      const voices = this._getSynthesisService().getVoices();
      const voice = voices.find(v => v.voiceURI === settings.voiceURI);
      if (voice) {
        this._getSynthesisService().setVoice(voice);
      }
    }

    this.setState('speaking');

    this._getSynthesisService().speak(text, {
      onStart: () => {
        this.setState('speaking');
      },
      onEnd: () => {
        this.setState('idle');
      },
      onError: (error: string) => {
        this.setState('error');
        this.callbacks.onError?.(error);
      },
    });
  }

  /**
   * Stop speaking
   */
  stopSpeaking(): void {
    this._getSynthesisService().stop();
    this.setState('idle');
  }

  /**
   * Process a complete voice interaction
   */
  processResponse(response: string): void {
    this.callbacks.onResponse?.(response);

    if (this.getSettingsManagerService().shouldAutoSpeak()) {
      this.speak(response);
    } else {
      this.setState('idle');
    }
  }

  /**
   * Get current voice state
   */
  getState(): VoiceState {
    return this.state;
  }

  /**
   * Check if voice is supported
   */
  isSupported(): boolean {
    return this.getRecognitionService().isSupported() && this._getSynthesisService().isSupported();
  }

  /**
   * Get detailed support error message
   */
  getSupportError(): string | null {
    const recognitionError = this.getRecognitionService().getSupportError();
    if (recognitionError) return recognitionError;
    
    if (!this._getSynthesisService().isSupported()) {
      return 'Speech synthesis not supported in this browser.';
    }
    
    return null;
  }

  /**
   * Get voice settings manager
   */
  getSettingsManager(): VoiceSettingsManager {
    return this.getSettingsManagerService();
  }

  /**
   * Get speech synthesis service for voice selection
   * Public API - returns the synthesis service instance
   */
  getSynthesisService(): SpeechSynthesisService {
    return this._getSynthesisService();
  }

  private setState(state: VoiceState): void {
    this.state = state;
    this.callbacks.onStateChange?.(state);
  }
}
