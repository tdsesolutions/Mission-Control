/**
 * Speech Recognition Service
 * Converts speech to text using Web Speech API
 */

export type SpeechRecognitionState = 
  | 'idle'
  | 'listening'
  | 'recognizing'
  | 'recognized'
  | 'error';

export interface SpeechRecognitionResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
}

export interface SpeechRecognitionCallbacks {
  onStart?: () => void;
  onResult?: (result: SpeechRecognitionResult) => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
}

export class SpeechRecognitionService {
  private recognition: SpeechRecognition | null = null;
  private callbacks: SpeechRecognitionCallbacks = {};
  private state: SpeechRecognitionState = 'idle';

  constructor() {
    // Defer initialization to first use
  }

  private initialize(): void {
    if (typeof window === 'undefined') return;
    if (this.recognition) return; // Already initialized

    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognitionAPI) {
      console.warn('Speech Recognition not supported in this browser');
      return;
    }

    this.recognition = new SpeechRecognitionAPI();
    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    if (!this.recognition) return;

    this.recognition.onstart = () => {
      this.state = 'listening';
      this.callbacks.onStart?.();
    };

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      const result = event.results[event.results.length - 1];
      const transcript = result[0].transcript;
      const confidence = result[0].confidence;
      const isFinal = result.isFinal;

      this.state = isFinal ? 'recognized' : 'recognizing';

      this.callbacks.onResult?.({
        transcript,
        confidence,
        isFinal,
      });
    };

    this.recognition.onend = () => {
      this.state = 'idle';
      this.callbacks.onEnd?.();
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      this.state = 'error';
      let errorMessage = 'Speech recognition error';

      switch (event.error) {
        case 'no-speech':
          errorMessage = 'No speech detected. Please try again.';
          break;
        case 'audio-capture':
          errorMessage = 'Microphone not available. Please check your settings.';
          break;
        case 'not-allowed':
          errorMessage = 'Microphone access denied. Please allow microphone access.';
          break;
        case 'network':
          errorMessage = 'Network error. Please check your connection.';
          break;
        case 'aborted':
          errorMessage = 'Speech recognition was aborted.';
          // NEW: Don't treat user abort as error
          this.state = 'idle';
          this.callbacks.onEnd?.();
          return;
        default:
          errorMessage = `Speech recognition error: ${event.error}`;
      }

      this.callbacks.onError?.(errorMessage);
    };
  }

  start(callbacks: SpeechRecognitionCallbacks): void {
    this.initialize(); // Lazy init
    
    if (!this.recognition) {
      callbacks.onError?.('Speech recognition not supported');
      return;
    }

    this.callbacks = callbacks;

    try {
      // NEW: Stop any existing recognition first
      try {
        this.recognition.stop();
      } catch {
        // Ignore stop errors
      }
      
      // Small delay to ensure clean start
      setTimeout(() => {
        if (this.recognition) {
          this.recognition.start();
        }
      }, 50);
    } catch (error) {
      this.callbacks.onError?.('Failed to start speech recognition');
    }
  }

  stop(): void {
    if (!this.recognition) return;

    try {
      this.recognition.stop();
    } catch (error) {
      // Ignore stop errors
    }
  }

  abort(): void {
    if (!this.recognition) return;

    try {
      this.recognition.abort();
    } catch (error) {
      // Ignore abort errors
    }
  }

  getState(): SpeechRecognitionState {
    return this.state;
  }

  isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    
    const hasSpeechAPI = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    const isSecure = window.isSecureContext;
    
    return hasSpeechAPI && isSecure;
  }

  getSupportError(): string | null {
    if (typeof window === 'undefined') {
      return 'Speech recognition not available in server environment.';
    }
    
    const hasSpeechAPI = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    const isSecure = window.isSecureContext;
    
    if (!isSecure) {
      return 'Speech recognition requires a secure context (HTTPS or localhost).';
    }
    
    if (!hasSpeechAPI) {
      return 'Speech recognition not supported in this browser.';
    }
    
    return null;
  }
}

// Type declarations for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}
