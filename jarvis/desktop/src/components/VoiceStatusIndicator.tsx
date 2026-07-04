/**
 * Voice Status Indicator
 * Shows current voice state in the UI
 */

import { Mic, Volume2, VolumeX, AlertCircle } from 'lucide-react';
import { useVoiceStore } from '../stores/voiceStore';

export function VoiceStatusIndicator() {
  const { voiceState, isSupported, settings } = useVoiceStore();

  if (!isSupported) {
    return null;
  }

  const getIcon = () => {
    if (!settings.enabled) {
      return <VolumeX size={14} />;
    }
    if (voiceState === 'error') {
      return <AlertCircle size={14} className="text-[var(--j-error)]" />;
    }
    if (voiceState === 'speaking') {
      return <Volume2 size={14} className="animate-pulse" />;
    }
    return <Mic size={14} />;
  };

  const getStatusText = () => {
    if (!settings.enabled) {
      return 'Voice Off';
    }
    switch (voiceState) {
      case 'listening':
        return 'Listening';
      case 'recognizing':
        return 'Recognizing';
      case 'thinking':
        return 'Processing';
      case 'speaking':
        return 'Speaking';
      case 'error':
        return 'Voice Error';
      default:
        return 'Voice Ready';
    }
  };

  return (
    <div className="voice-status-indicator">
      {getIcon()}
      <span className="text-xs">{getStatusText()}</span>
    </div>
  );
}
