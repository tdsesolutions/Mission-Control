/**
 * Voice Settings Panel
 * Configuration for voice preferences
 */

import { useState } from 'react';
import { Settings } from 'lucide-react';
import { useVoiceStore } from '../stores/voiceStore';

export function VoiceSettingsPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const {
    settings,
    isSupported,
    toggleVoice,
    toggleMute,
    toggleAutoSpeak,
    toggleConversationMode,
    setRate,
    setPitch,
    setVolume,
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

          {/* Speech Pitch */}
          <div className="voice-setting-item">
            <label>Speech Pitch</label>
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
