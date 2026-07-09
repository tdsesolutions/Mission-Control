/**
 * Voice Settings
 * Manages voice configuration and preferences
 */

/** 'auto' = cloud provider when configured & healthy, else browser. */
export type SttProviderPreference = 'auto' | 'browser' | 'deepgram';
export type TtsProviderPreference = 'auto' | 'browser' | 'elevenlabs';

export interface VoiceSettings {
  enabled: boolean;
  muted: boolean;
  autoSpeak: boolean;
  /** Hands-free multi-turn: auto-relisten after Kiaros finishes speaking. */
  conversationMode: boolean;
  rate: number;
  pitch: number;
  volume: number;
  voiceURI: string | null;
  sttProvider: SttProviderPreference;
  ttsProvider: TtsProviderPreference;
  /** BCP-47 speech-recognition language. */
  language: string;
}

const DEFAULT_SETTINGS: VoiceSettings = {
  enabled: true,
  muted: false,
  autoSpeak: true,
  conversationMode: true,
  rate: 1.0,
  pitch: 1.0,
  volume: 1.0,
  voiceURI: null,
  sttProvider: 'auto',
  ttsProvider: 'auto',
  language: 'en-US',
};

const STORAGE_KEY = 'kiaros_voice_settings';

export class VoiceSettingsManager {
  private settings: VoiceSettings;

  constructor() {
    this.settings = this.loadSettings();
  }

  private loadSettings(): VoiceSettings {
    if (typeof window === 'undefined') return { ...DEFAULT_SETTINGS };

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.warn('Failed to load voice settings:', error);
    }

    return { ...DEFAULT_SETTINGS };
  }

  private saveSettings(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch (error) {
      console.warn('Failed to save voice settings:', error);
    }
  }

  getSettings(): VoiceSettings {
    return { ...this.settings };
  }

  setEnabled(enabled: boolean): void {
    this.settings.enabled = enabled;
    this.saveSettings();
  }

  setMuted(muted: boolean): void {
    this.settings.muted = muted;
    this.saveSettings();
  }

  setAutoSpeak(autoSpeak: boolean): void {
    this.settings.autoSpeak = autoSpeak;
    this.saveSettings();
  }

  setConversationMode(conversationMode: boolean): void {
    this.settings.conversationMode = conversationMode;
    this.saveSettings();
  }

  isConversationMode(): boolean {
    return this.settings.enabled && this.settings.conversationMode;
  }

  setRate(rate: number): void {
    this.settings.rate = Math.max(0.5, Math.min(2.0, rate));
    this.saveSettings();
  }

  setPitch(pitch: number): void {
    this.settings.pitch = Math.max(0.5, Math.min(2.0, pitch));
    this.saveSettings();
  }

  setVolume(volume: number): void {
    this.settings.volume = Math.max(0, Math.min(1.0, volume));
    this.saveSettings();
  }

  setVoiceURI(voiceURI: string): void {
    this.settings.voiceURI = voiceURI;
    this.saveSettings();
  }

  setSttProvider(provider: SttProviderPreference): void {
    this.settings.sttProvider = provider;
    this.saveSettings();
  }

  setTtsProvider(provider: TtsProviderPreference): void {
    this.settings.ttsProvider = provider;
    this.saveSettings();
  }

  setLanguage(language: string): void {
    this.settings.language = language || 'en-US';
    this.saveSettings();
  }

  isEnabled(): boolean {
    return this.settings.enabled && !this.settings.muted;
  }

  shouldAutoSpeak(): boolean {
    return this.settings.enabled && !this.settings.muted && this.settings.autoSpeak;
  }

  reset(): void {
    this.settings = { ...DEFAULT_SETTINGS };
    this.saveSettings();
  }
}
