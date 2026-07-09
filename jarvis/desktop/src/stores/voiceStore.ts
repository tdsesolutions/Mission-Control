/**
 * Voice Store — the conversational loop orchestrator (Phase 7).
 *
 * SINGLE OWNER of the voice lifecycle:
 *
 *   ready ──press──▶ listening ──final transcript──▶ thinking
 *     thinking ──reply──▶ speaking ──done──▶ ready | listening (conversation mode)
 *   Every error path returns to ready. Always.
 *
 * Loop-integrity invariants (owner completion criteria):
 * - Exactly one submission per final transcript (submission happens inside
 *   the recognition callback, atomically guarded — never via React effects).
 * - Exactly one spoken reply per submission (synthesis onDone fires once).
 * - Never listening while speaking; echo filter drops self-transcripts.
 * - Bounded auto-relisten (no infinite hot-mic loops).
 * - No state can stick: recognition errors, synthesis watchdog, and LLM
 *   timeouts all resolve to ready.
 */

import { create } from 'zustand';
import { VoiceManager, VoiceState, VoiceSettings, VoiceSettingsManager, ProviderStatus, SttProviderPreference, TtsProviderPreference } from '../services/voice';
import { useJarvisStore } from './jarvisStore';

const RELISTEN_SETTLE_MS = 400;
const MAX_SILENT_RELISTENS = 2;
const ECHO_MIN_LENGTH = 8;
/** Short transcripts matching recent speech exactly are echo within this window. */
const ECHO_WINDOW_MS = 7000;

interface VoiceStoreState {
  // Lifecycle state (single source of truth for the loop)
  voiceState: VoiceState;
  /** True while the hands-free loop is engaged (mic press toggles it). */
  loopActive: boolean;
  transcript: string;
  isListening: boolean;
  isSpeaking: boolean;
  isSupported: boolean;
  errorMessage: string | null;
  settings: VoiceSettings;
  permissionGranted: boolean;
  /** Which engines the next listen/speak will use (cloud vs browser). */
  providers: ProviderStatus;

  // Services
  voiceManager: VoiceManager;
  settingsManager: VoiceSettingsManager;

  // Loop control
  toggleConversation: () => Promise<void>;
  stopConversation: () => void;

  // Settings & support
  initialize: () => void;
  checkPermission: () => Promise<boolean>;
  requestMicrophonePermission: () => Promise<{ granted: boolean; error: string | null }>;
  speak: (text: string) => void;
  stopSpeaking: () => void;
  toggleVoice: () => void;
  toggleMute: () => void;
  toggleAutoSpeak: () => void;
  toggleConversationMode: () => void;
  setRate: (rate: number) => void;
  setPitch: (pitch: number) => void;
  setVolume: (volume: number) => void;
  setVoice: (voiceURI: string) => void;
  setSttProvider: (provider: SttProviderPreference) => void;
  setTtsProvider: (provider: TtsProviderPreference) => void;
  setLanguage: (language: string) => void;
}

// Lazy singletons
let voiceManagerInstance: VoiceManager | null = null;
function getVoiceManager(): VoiceManager {
  if (!voiceManagerInstance) voiceManagerInstance = new VoiceManager();
  return voiceManagerInstance;
}

let initialized = false;

/** Normalize for echo comparison: lowercase, strip punctuation/whitespace. */
function normalizeForEcho(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9 ]+/g, '').replace(/\s+/g, ' ').trim();
}

export const useVoiceStore = create<VoiceStoreState>((set, get) => {
  // ---- private loop internals (closure state, not React state) ----
  let submitting = false;        // exactly-once guard per recognition pass
  let silentRelistens = 0;       // bounded no-speech re-listen counter
  let lastSpokenText = '';       // echo filter reference
  let lastSpokenEndedAt = 0;     // when Kiaros last finished speaking
  let loopGeneration = 0;        // bumping invalidates stale async continuations

  const manager = () => getVoiceManager();
  const settingsManager = () => manager().getSettingsManager();

  const toReady = (error?: string) => {
    set({
      voiceState: error ? 'error' : 'idle',
      isListening: false,
      isSpeaking: false,
      transcript: '',
      errorMessage: error ?? null,
    });
  };

  const isEcho = (transcript: string): boolean => {
    if (!lastSpokenText) return false;
    const heard = normalizeForEcho(transcript);
    const spoken = normalizeForEcho(lastSpokenText);
    let result: boolean;

    if (heard.length < ECHO_MIN_LENGTH) {
      // Short utterances are too ambiguous to drop on containment — but an
      // EXACT match of what Kiaros just finished saying, heard within a few
      // seconds of the speech ending, is echo with near-certainty.
      const withinWindow = Date.now() - lastSpokenEndedAt < ECHO_WINDOW_MS;
      result = withinWindow && heard.length > 0 && (spoken === heard || spoken.endsWith(` ${heard}`));
    } else {
      // Containment, plus a token-overlap fallback: recognition of our own
      // TTS is imperfect, so near-matches (≥80% of heard words present in
      // what we just said) also count as echo.
      result = spoken.includes(heard);
      if (!result) {
        const heardTokens = heard.split(' ').filter((t) => t.length > 1);
        if (heardTokens.length >= 3) {
          const spokenSet = new Set(spoken.split(' '));
          const overlap = heardTokens.filter((t) => spokenSet.has(t)).length / heardTokens.length;
          result = overlap >= 0.8;
        }
      }
    }

    // Diagnostic surface (dev + automated verification)
    (window as unknown as Record<string, unknown>).__kiarosEchoDebug = { heard, spoken, result };
    return result;
  };

  /** One listen → submit → speak cycle. Re-arms itself in conversation mode. */
  const listenOnce = (generation: number) => {
    if (generation !== loopGeneration || !get().loopActive) return;
    if (manager().isSpeaking()) {
      // Invariant: never listen while speaking.
      manager().stopSpeaking();
    }

    submitting = false;
    // Web Speech fires onerror AND onend for the same cycle — each listen
    // cycle must conclude exactly once or relisten gets double-armed
    // (double recognition.start() → InvalidStateError → broken loop).
    let concluded = false;
    const concludeOnce = (fn: () => void) => {
      if (concluded || generation !== loopGeneration) return;
      concluded = true;
      fn();
    };

    set({ voiceState: 'listening', isListening: true, isSpeaking: false, transcript: '', errorMessage: null });

    manager().listen({
      onResult: (result) => {
        if (generation !== loopGeneration) return;
        set({ transcript: result.transcript, voiceState: result.isFinal ? 'thinking' : 'recognizing' });
        if (result.isFinal) {
          concludeOnce(() => void handleFinalTranscript(result.transcript, generation));
        }
      },
      onEnd: () => {
        // Recognition ended without a final transcript (silence/timeout).
        concludeOnce(() => relistenOrReady(generation));
      },
      onError: (error) => {
        concludeOnce(() => {
          // 'No speech detected' is a normal part of hands-free flow.
          if (/no speech/i.test(error)) {
            relistenOrReady(generation);
          } else {
            get().stopConversation();
            toReady(error);
          }
        });
      },
    });
  };

  const relistenOrReady = (generation: number) => {
    if (generation !== loopGeneration) return;
    const conversationMode = settingsManager().isConversationMode();
    if (get().loopActive && conversationMode && silentRelistens < MAX_SILENT_RELISTENS) {
      silentRelistens++;
      setTimeout(() => listenOnce(generation), RELISTEN_SETTLE_MS);
    } else {
      set({ loopActive: false });
      toReady();
    }
  };

  const handleFinalTranscript = async (rawTranscript: string, generation: number) => {
    // Exactly-once guard: recognition implementations can emit a final
    // result AND fire end/error afterwards — only the first path submits.
    if (submitting || generation !== loopGeneration) return;
    submitting = true;

    manager().stopListening();
    const transcript = rawTranscript.trim();

    if (!transcript) {
      relistenOrReady(generation);
      return;
    }

    // Echo protection: Kiaros must never converse with itself.
    if (isEcho(transcript)) {
      relistenOrReady(generation);
      return;
    }

    silentRelistens = 0;
    set({ voiceState: 'thinking', isListening: false, transcript });

    const reply = await useJarvisStore.getState().sendMessage(transcript);
    if (generation !== loopGeneration) return;

    if (reply && settingsManager().shouldAutoSpeak()) {
      speakReply(reply, generation);
    } else {
      afterTurn(generation);
    }
  };

  const speakReply = (text: string, generation: number) => {
    lastSpokenText = text;
    set({ voiceState: 'speaking', isSpeaking: true, isListening: false });

    manager().speak(text, {
      onDone: (outcome, detail) => {
        if (generation !== loopGeneration) return;
        lastSpokenEndedAt = Date.now();
        set({ isSpeaking: false });
        if (outcome === 'error') {
          console.warn('Speech synthesis issue:', detail);
        }
        afterTurn(generation);
      },
    });
  };

  const afterTurn = (generation: number) => {
    if (generation !== loopGeneration) return;
    const conversationMode = settingsManager().isConversationMode();
    if (get().loopActive && conversationMode) {
      // Settle delay so the tail of TTS audio can't leak into the mic.
      setTimeout(() => listenOnce(generation), RELISTEN_SETTLE_MS);
    } else {
      set({ loopActive: false });
      toReady();
    }
  };

  return {
    voiceState: 'idle',
    loopActive: false,
    transcript: '',
    isListening: false,
    isSpeaking: false,
    isSupported: false,
    errorMessage: null,
    permissionGranted: false,
    settings: { enabled: true, muted: false, autoSpeak: true, conversationMode: true, rate: 1.0, pitch: 1.0, volume: 1.0, voiceURI: null, sttProvider: 'auto', ttsProvider: 'auto', language: 'en-US' },
    providers: { stt: 'browser', tts: 'browser', cloudSttConfigured: false, cloudTtsConfigured: false, sttDegraded: false, ttsDegraded: false },

    get voiceManager() { return getVoiceManager(); },
    get settingsManager() { return getVoiceManager().getSettingsManager(); },

    // ---- Loop control ----

    toggleConversation: async () => {
      const state = get();

      // Barge-in: pressing the mic while Kiaros speaks stops the speech
      // and immediately listens — the natural "let me interrupt" gesture.
      if (state.isSpeaking) {
        manager().stopSpeaking();
        loopGeneration++;
        silentRelistens = 0;
        set({ loopActive: true, isSpeaking: false });
        listenOnce(loopGeneration);
        return;
      }

      // Press while listening/thinking = stop the loop.
      if (state.loopActive || state.isListening || state.voiceState === 'thinking') {
        get().stopConversation();
        return;
      }

      // Start: permission first, then listen.
      let hasPermission = state.permissionGranted || (await get().checkPermission());
      if (!hasPermission) {
        const permission = await get().requestMicrophonePermission();
        if (!permission.granted) {
          toReady(permission.error ?? 'Microphone permission denied.');
          return;
        }
      }

      const supportError = manager().getSupportError();
      if (supportError) {
        toReady(supportError);
        return;
      }

      loopGeneration++;
      silentRelistens = 0;
      set({ loopActive: true, errorMessage: null });
      listenOnce(loopGeneration);
    },

    stopConversation: () => {
      loopGeneration++; // invalidate all in-flight continuations
      submitting = false;
      silentRelistens = 0;
      manager().stopListening();
      manager().stopSpeaking();
      set({ loopActive: false });
      toReady();
    },

    // ---- Settings, permissions, support ----

    initialize: () => {
      if (initialized) {
        // StrictMode double-mounts effects in dev — init must be idempotent.
        set({ isSupported: manager().isSupported(), settings: settingsManager().getSettings() });
        return;
      }
      initialized = true;
      const isSupported = manager().isSupported();
      const supportError = manager().getSupportError();
      if (supportError) console.warn('Voice support issue:', supportError);
      void get().checkPermission();
      // Cloud provider discovery (Deepgram/ElevenLabs on Core). Failure
      // means browser engines only — support state is re-derived after the
      // answer since cloud STT can make an otherwise-unsupported browser
      // (no Web Speech recognition) voice-capable.
      manager().onStatusChange((status) => set({ providers: status }));
      void manager().refreshCapabilities().then((status) => {
        set({ providers: status, isSupported: manager().isSupported() });
      });
      set({ isSupported, settings: settingsManager().getSettings() });
    },

    checkPermission: async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) return false;
        const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        const granted = result.state === 'granted';
        set({ permissionGranted: granted });
        return granted;
      } catch {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach((track) => track.stop());
          set({ permissionGranted: true });
          return true;
        } catch {
          return false;
        }
      }
    },

    requestMicrophonePermission: async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          return { granted: false, error: 'Microphone access is not available in this browser.' };
        }
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
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

    speak: (text: string) => {
      if (!settingsManager().isEnabled()) return;
      lastSpokenText = text;
      set({ voiceState: 'speaking', isSpeaking: true });
      manager().speak(text, {
        onDone: () => {
          set({ isSpeaking: false });
          if (!get().loopActive) toReady();
        },
      });
    },

    stopSpeaking: () => {
      manager().stopSpeaking();
      set({ isSpeaking: false });
      if (!get().loopActive) toReady();
    },

    toggleVoice: () => {
      const current = settingsManager().getSettings().enabled;
      settingsManager().setEnabled(!current);
      if (current) get().stopConversation();
      set({ settings: settingsManager().getSettings() });
    },

    toggleMute: () => {
      const current = settingsManager().getSettings().muted;
      settingsManager().setMuted(!current);
      if (!current) manager().stopSpeaking();
      set({ settings: settingsManager().getSettings() });
    },

    toggleAutoSpeak: () => {
      const current = settingsManager().getSettings().autoSpeak;
      settingsManager().setAutoSpeak(!current);
      set({ settings: settingsManager().getSettings() });
    },

    toggleConversationMode: () => {
      const current = settingsManager().getSettings().conversationMode;
      settingsManager().setConversationMode(!current);
      set({ settings: settingsManager().getSettings() });
    },

    setRate: (rate) => { settingsManager().setRate(rate); set({ settings: settingsManager().getSettings() }); },
    setPitch: (pitch) => { settingsManager().setPitch(pitch); set({ settings: settingsManager().getSettings() }); },
    setVolume: (volume) => { settingsManager().setVolume(volume); set({ settings: settingsManager().getSettings() }); },
    setVoice: (voiceURI) => { settingsManager().setVoiceURI(voiceURI); set({ settings: settingsManager().getSettings() }); },
    setSttProvider: (provider) => {
      settingsManager().setSttProvider(provider);
      set({ settings: settingsManager().getSettings(), providers: manager().getProviderStatus() });
    },
    setTtsProvider: (provider) => {
      settingsManager().setTtsProvider(provider);
      set({ settings: settingsManager().getSettings(), providers: manager().getProviderStatus() });
    },
    setLanguage: (language) => {
      settingsManager().setLanguage(language);
      set({ settings: settingsManager().getSettings() });
    },
  };
});
