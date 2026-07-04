/**
 * Voice Store
 * Zustand store for voice state management
 */

import { create } from 'zustand';
import { VoiceManager, VoiceState, VoiceSettings, VoiceSettingsManager } from '../services/voice';
import { useJarvisStore } from './jarvisStore';

interface VoiceStoreState {
  // State
  voiceState: VoiceState;
  transcript: string;
  isListening: boolean;
  isSpeaking: boolean;
  isSupported: boolean;
  errorMessage: string | null;
  settings: VoiceSettings;
  permissionGranted: boolean; // NEW: Track permission persistence
  
  // Services
  voiceManager: VoiceManager;
  settingsManager: VoiceSettingsManager;
  
  // Actions
  requestMicrophonePermission: () => Promise<{ granted: boolean; error: string | null }>;
  checkPermission: () => Promise<boolean>; // NEW: Check existing permission
  startListening: () => Promise<void>;
  stopListening: () => void;
  stopSpeaking: () => void;
  speak: (text: string) => void;
  toggleVoice: () => void;
  toggleMute: () => void;
  toggleAutoSpeak: () => void;
  setRate: (rate: number) => void;
  setPitch: (pitch: number) => void;
  setVolume: (volume: number) => void;
  setVoice: (voiceURI: string) => void;
  initialize: () => void;
  processTranscript: (transcript: string) => void; // NEW: Handle transcript -> chat
}

// Lazy initialization - services created on first access
let voiceManagerInstance: VoiceManager | null = null;
let settingsManagerInstance: VoiceSettingsManager | null = null;

function getVoiceManager(): VoiceManager {
  if (!voiceManagerInstance) {
    voiceManagerInstance = new VoiceManager();
  }
  return voiceManagerInstance;
}

function getSettingsManager(): VoiceSettingsManager {
  if (!settingsManagerInstance) {
    settingsManagerInstance = getVoiceManager().getSettingsManager();
  }
  return settingsManagerInstance;
}

export const useVoiceStore = create<VoiceStoreState>((set, get) => {
  return {
    // Initial state - defer service initialization
    voiceState: 'idle',
    transcript: '',
    isListening: false,
    isSpeaking: false,
    isSupported: false, // Will be set on initialize
    errorMessage: null,
    permissionGranted: false, // NEW: Start with no permission
    settings: { enabled: true, muted: false, autoSpeak: true, rate: 1.0, pitch: 1.0, volume: 1.0, voiceURI: null },
    
    // Services - lazy getters
    get voiceManager() { return getVoiceManager(); },
    get settingsManager() { return getSettingsManager(); },
    
    // Actions
    requestMicrophonePermission: async () => {
      try {
        // Request microphone permission first (this triggers browser prompt)
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          return { granted: false, error: 'Microphone access is not available in this browser.' };
        }
        
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Stop the stream immediately - we just needed permission
        stream.getTracks().forEach(track => track.stop());
        
        // NEW: Persist permission state
        set({ permissionGranted: true });
        
        return { granted: true, error: null };
      } catch (err: any) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          return { granted: false, error: 'Microphone permission denied.' };
        }
        if (err.name === 'NotFoundError') {
          return { granted: false, error: 'No microphone found.' };
        }
        return { granted: false, error: `Microphone error: ${err.message}` };
      }
    },
    
    // NEW: Check if permission already granted without prompting
    checkPermission: async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          return false;
        }
        // Try to get permission status without showing prompt
        const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        const granted = result.state === 'granted';
        set({ permissionGranted: granted });
        return granted;
      } catch (err) {
        // Fallback: try getUserMedia silently (will fail if not granted)
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach(track => track.stop());
          set({ permissionGranted: true });
          return true;
        } catch {
          return false;
        }
      }
    },
    
    startListening: async () => {
      const { voiceManager, requestMicrophonePermission, checkPermission, permissionGranted } = get();
      
      // NEW: Check if permission already granted first
      let hasPermission = permissionGranted;
      if (!hasPermission) {
        hasPermission = await checkPermission();
      }
      
      // Only request permission if not already granted
      if (!hasPermission) {
        const permission = await requestMicrophonePermission();
        if (!permission.granted) {
          set({
            voiceState: 'error',
            isListening: false,
            errorMessage: permission.error,
          });
          return;
        }
      }
      
      // Now check speech recognition support
      const supportError = voiceManager.getSupportError();
      if (supportError) {
        set({
          voiceState: 'error',
          isListening: false,
          errorMessage: 'Speech recognition is not supported in this browser.',
        });
        return;
      }
      
      voiceManager.startListening({
        onStateChange: (state) => {
          set({ 
            voiceState: state,
            isListening: state === 'listening' || state === 'recognizing',
            isSpeaking: state === 'speaking',
            errorMessage: null,
          });
        },
        onTranscript: (transcript) => {
          set({ transcript });
          // Transcript is processed by VoiceButton/ConversationPanel
          // Do not submit here to avoid duplicate submission
        },
        onError: (error) => {
          console.error('Voice error:', error);
          set({ 
            voiceState: 'error',
            isListening: false,
            errorMessage: error,
          });
        },
      });
    },
    
    stopListening: () => {
      const { voiceManager } = get();
      voiceManager.stopListening();
      set({ 
        isListening: false,
        transcript: '',
      });
    },
    
    stopSpeaking: () => {
      const { voiceManager } = get();
      voiceManager.stopSpeaking();
      set({ isSpeaking: false });
    },
    
    speak: (text: string) => {
      const { voiceManager, settingsManager } = get();
      
      if (!settingsManager.isEnabled()) return;
      
      voiceManager.speak(text);
    },
    
    // NEW: Process transcript through existing chat system
    processTranscript: (transcript: string) => {
      // Send the message through the existing chat path
      const jarvisStore = useJarvisStore.getState();

      if (jarvisStore && typeof jarvisStore.sendMessage === 'function') {
        // Send through existing text chat path
        jarvisStore.sendMessage(transcript);
      }
    },
    
    toggleVoice: () => {
      const { settingsManager } = get();
      const current = settingsManager.getSettings().enabled;
      settingsManager.setEnabled(!current);
      set({ settings: settingsManager.getSettings() });
    },
    
    toggleMute: () => {
      const { settingsManager } = get();
      const current = settingsManager.getSettings().muted;
      settingsManager.setMuted(!current);
      set({ settings: settingsManager.getSettings() });
    },
    
    toggleAutoSpeak: () => {
      const { settingsManager } = get();
      const current = settingsManager.getSettings().autoSpeak;
      settingsManager.setAutoSpeak(!current);
      set({ settings: settingsManager.getSettings() });
    },
    
    setRate: (rate: number) => {
      const { settingsManager } = get();
      settingsManager.setRate(rate);
      set({ settings: settingsManager.getSettings() });
    },
    
    setPitch: (pitch: number) => {
      const { settingsManager } = get();
      settingsManager.setPitch(pitch);
      set({ settings: settingsManager.getSettings() });
    },
    
    setVolume: (volume: number) => {
      const { settingsManager } = get();
      settingsManager.setVolume(volume);
      set({ settings: settingsManager.getSettings() });
    },
    
    setVoice: (voiceURI: string) => {
      const { settingsManager } = get();
      settingsManager.setVoiceURI(voiceURI);
      set({ settings: settingsManager.getSettings() });
    },
    
    initialize: () => {
      const { voiceManager, settingsManager, checkPermission } = get();
      // Check support at initialization time
      const isSupported = voiceManager.isSupported();
      const supportError = voiceManager.getSupportError();
      
      if (supportError) {
        console.warn('Voice support issue:', supportError);
      }
      
      // NEW: Check permission status on init
      checkPermission();
      
      set({
        isSupported,
        settings: settingsManager.getSettings(),
      });
    },
  };
});
