/**
 * Speech Synthesis Service
 * Converts text to speech using Web Speech API
 */

export interface SpeechSynthesisOptions {
  rate: number;
  pitch: number;
  volume: number;
  voice: SpeechSynthesisVoice | null;
}

export type SpeechSynthesisState =
  | 'idle'
  | 'speaking'
  | 'paused'
  | 'error';

export interface SpeechSynthesisCallbacks {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
}

export class SpeechSynthesisService {
  private synthesis: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private callbacks: SpeechSynthesisCallbacks = {};
  private state: SpeechSynthesisState = 'idle';
  private options: SpeechSynthesisOptions = {
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0,
    voice: null,
  };

  constructor() {
    // Defer initialization to first use
  }

  private initialize(): void {
    if (typeof window === 'undefined') return;
    if (this.synthesis) return; // Already initialized

    this.synthesis = window.speechSynthesis;

    // Load default voice
    this.loadDefaultVoice();
  }

  private loadDefaultVoice(): void {
    if (!this.synthesis) return;

    const voices = this.synthesis.getVoices();
    if (voices.length > 0) {
      // Prefer a premium English voice
      const preferredVoice = voices.find(v => 
        v.lang.startsWith('en') && 
        (v.name.includes('Premium') || v.name.includes('Enhanced') || v.name.includes('Google'))
      ) || voices.find(v => v.lang.startsWith('en')) || voices[0];
      
      this.options.voice = preferredVoice;
    }
  }

  speak(text: string, callbacks: SpeechSynthesisCallbacks): void {
    this.initialize(); // Lazy init
    
    if (!this.synthesis) {
      callbacks.onError?.('Speech synthesis not supported');
      return;
    }

    // Cancel any ongoing speech
    this.stop();

    this.callbacks = callbacks;
    this.currentUtterance = new SpeechSynthesisUtterance(text);

    // Apply settings
    this.currentUtterance.rate = this.options.rate;
    this.currentUtterance.pitch = this.options.pitch;
    this.currentUtterance.volume = this.options.volume;
    this.currentUtterance.voice = this.options.voice;

    // Event handlers
    this.currentUtterance.onstart = () => {
      this.state = 'speaking';
      this.callbacks.onStart?.();
    };

    this.currentUtterance.onend = () => {
      this.state = 'idle';
      this.currentUtterance = null;
      this.callbacks.onEnd?.();
    };

    this.currentUtterance.onerror = (event) => {
      this.state = 'error';
      this.callbacks.onError?.(`Speech synthesis error: ${event.error}`);
    };

    try {
      this.synthesis.speak(this.currentUtterance);
    } catch (error) {
      this.callbacks.onError?.('Failed to start speech synthesis');
    }
  }

  stop(): void {
    this.initialize(); // Lazy init
    if (!this.synthesis) return;

    this.synthesis.cancel();
    this.state = 'idle';
    this.currentUtterance = null;
  }

  pause(): void {
    this.initialize(); // Lazy init
    if (!this.synthesis) return;

    this.synthesis.pause();
    this.state = 'paused';
  }

  resume(): void {
    this.initialize(); // Lazy init
    if (!this.synthesis) return;

    this.synthesis.resume();
    this.state = 'speaking';
  }

  getVoices(): SpeechSynthesisVoice[] {
    this.initialize(); // Lazy init
    if (!this.synthesis) return [];
    return this.synthesis.getVoices();
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

  getState(): SpeechSynthesisState {
    return this.state;
  }

  isSupported(): boolean {
    return typeof window !== 'undefined' && !!window.speechSynthesis;
  }

  isSpeaking(): boolean {
    return this.state === 'speaking';
  }
}
