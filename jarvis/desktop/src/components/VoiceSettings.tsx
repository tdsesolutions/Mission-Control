/**
 * Voice Settings Panel
 * Configuration for voice preferences
 */

import { useState } from 'react';
import { Settings } from 'lucide-react';
import { useVoiceStore } from '../stores/voiceStore';

const LANGUAGES: Array<{ tag: string; label: string }> = [
  { tag: 'en-US', label: 'English (US)' },
  { tag: 'en-GB', label: 'English (UK)' },
  { tag: 'es-ES', label: 'Español' },
  { tag: 'fr-FR', label: 'Français' },
  { tag: 'de-DE', label: 'Deutsch' },
  { tag: 'it-IT', label: 'Italiano' },
  { tag: 'pt-BR', label: 'Português (BR)' },
  { tag: 'ja-JP', label: '日本語' },
  { tag: 'ko-KR', label: '한국어' },
  { tag: 'zh-CN', label: '中文' },
];

export function VoiceSettingsPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const {
    settings,
    isSupported,
    providers,
    toggleVoice,
    toggleMute,
    toggleAutoSpeak,
    toggleConversationMode,
    setRate,
    setPitch,
    setVolume,
    setSttProvider,
    setTtsProvider,
    setLanguage,
  } = useVoiceStore();

  if (!isSupported) {
    return null;
  }

  return (
    <div className="voice-settings">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="voice-settings-toggle"
        title="Voice Settings"
      >
        <Settings size={16} />
      </button>

      {isOpen && (
        <div className="voice-settings-panel">
          <div className="voice-settings-header">
            <span>Voice Settings</span>
          </div>

          {/* Enable/Disable Voice */}
          <div className="voice-setting-item">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={toggleVoice}
              />
              <span>Enable Voice</span>
            </label>
          </div>

          {/* Mute */}
          <div className="voice-setting-item">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.muted}
                onChange={toggleMute}
                disabled={!settings.enabled}
              />
              <span>Mute</span>
            </label>
          </div>

          {/* Auto Speak */}
          <div className="voice-setting-item">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.autoSpeak}
                onChange={toggleAutoSpeak}
                disabled={!settings.enabled || settings.muted}
              />
              <span>Auto-speak Responses</span>
            </label>
          </div>

          {/* Conversation Mode (hands-free multi-turn) */}
          <div className="voice-setting-item">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.conversationMode}
                onChange={toggleConversationMode}
                disabled={!settings.enabled}
              />
              <span>Conversation Mode (auto-listen after replies)</span>
            </label>
          </div>

          {/* Speech Recognition Provider */}
          <div className="voice-setting-item">
            <label>Speech Recognition</label>
            <select
              value={settings.sttProvider}
              onChange={(e) => setSttProvider(e.target.value as 'auto' | 'browser' | 'deepgram')}
              disabled={!settings.enabled}
            >
              <option value="auto">Auto (Deepgram when available)</option>
              <option value="browser">Browser</option>
              <option value="deepgram" disabled={!providers.cloudSttConfigured}>
                Deepgram (cloud){providers.cloudSttConfigured ? '' : ' — not configured'}
              </option>
            </select>
            <span className="text-xs text-[var(--j-text-muted)]">
              Active: {providers.stt === 'deepgram' ? 'Deepgram' : 'Browser'}
              {providers.sttDegraded ? ' (cloud temporarily unavailable)' : ''}
            </span>
          </div>

          {/* Speech Voice Provider */}
          <div className="voice-setting-item">
            <label>Speech Voice</label>
            <select
              value={settings.ttsProvider}
              onChange={(e) => setTtsProvider(e.target.value as 'auto' | 'browser' | 'elevenlabs')}
              disabled={!settings.enabled || settings.muted}
            >
              <option value="auto">Auto (ElevenLabs when available)</option>
              <option value="browser">Browser</option>
              <option value="elevenlabs" disabled={!providers.cloudTtsConfigured}>
                ElevenLabs (cloud){providers.cloudTtsConfigured ? '' : ' — not configured'}
              </option>
            </select>
            <span className="text-xs text-[var(--j-text-muted)]">
              Active: {providers.tts === 'elevenlabs' ? 'ElevenLabs' : 'Browser'}
              {providers.ttsDegraded ? ' (cloud temporarily unavailable)' : ''}
            </span>
          </div>

          {/* Recognition Language */}
          <div className="voice-setting-item">
            <label>Language</label>
            <select
              value={settings.language}
              onChange={(e) => setLanguage(e.target.value)}
              disabled={!settings.enabled}
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.tag} value={lang.tag}>{lang.label}</option>
              ))}
            </select>
          </div>

          {/* Speech Rate */}
          <div className="voice-setting-item">
            <label>Speech Rate</label>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={settings.rate}
              onChange={(e) => setRate(parseFloat(e.target.value))}
              disabled={!settings.enabled || settings.muted}
            />
            <span className="text-xs text-[var(--j-text-muted)]">
              {settings.rate.toFixed(1)}x
            </span>
          </div>

          {/* Speech Pitch (browser voice only — cloud voices define their own) */}
          <div className="voice-setting-item">
            <label>Speech Pitch (browser voice)</label>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={settings.pitch}
              onChange={(e) => setPitch(parseFloat(e.target.value))}
              disabled={!settings.enabled || settings.muted}
            />
            <span className="text-xs text-[var(--j-text-muted)]">
              {settings.pitch.toFixed(1)}
            </span>
          </div>

          {/* Speech Volume */}
          <div className="voice-setting-item">
            <label>Speech Volume</label>
            <input
              type="range"
              min="0"
              max="1.0"
              step="0.1"
              value={settings.volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              disabled={!settings.enabled || settings.muted}
            />
            <span className="text-xs text-[var(--j-text-muted)]">
              {Math.round(settings.volume * 100)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
