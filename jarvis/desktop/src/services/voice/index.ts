/**
 * Voice Services Export
 */

export { SpeechRecognitionService } from './SpeechRecognitionService.js';
export type { SpeechRecognitionState, SpeechRecognitionResult, SpeechRecognitionCallbacks } from './SpeechRecognitionService.js';
export { SpeechSynthesisService } from './SpeechSynthesisService.js';
export type { SpeechSynthesisOptions, SpeechSessionCallbacks } from './SpeechSynthesisService.js';
export { VoiceSettingsManager } from './VoiceSettings.js';
export type { VoiceSettings, SttProviderPreference, TtsProviderPreference } from './VoiceSettings.js';
export { VoiceManager } from './VoiceManager.js';
export type { VoiceState, ProviderStatus } from './VoiceManager.js';
export { DeepgramSttEngine } from './DeepgramSttEngine.js';
export { ElevenLabsTtsEngine } from './ElevenLabsTtsEngine.js';
