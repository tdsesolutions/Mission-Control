/**
 * Voice Button — presentational control for the conversation loop.
 *
 * Phase 7: submission does NOT happen here. The voiceStore orchestrator owns
 * the lifecycle (the old transcript-watching effect caused duplicate
 * submissions). This button only toggles the loop and reflects state.
 */

import React, { useEffect } from 'react';
import { useVoiceStore } from '../stores/voiceStore';

interface VoiceButtonProps {
  disabled?: boolean;
}

export const VoiceButton: React.FC<VoiceButtonProps> = ({ disabled }) => {
  const {
    voiceState,
    loopActive,
    isListening,
    isSpeaking,
    isSupported,
    errorMessage,
    permissionGranted,
    toggleConversation,
    initialize,
  } = useVoiceStore();

  useEffect(() => {
    initialize(); // idempotent (StrictMode-safe)
  }, [initialize]);

  const handleClick = () => {
    if (disabled) return;
    void toggleConversation();
  };

  const getButtonState = () => {
    if (!isSupported) {
      return { text: '🎤', title: 'Voice not supported in this browser', className: 'opacity-50 cursor-not-allowed' };
    }
    if (disabled) {
      return { text: '🎤', title: 'Waiting for Kiaros Core connection', className: 'opacity-50 cursor-not-allowed' };
    }
    if (isSpeaking) {
      return { text: '🔊', title: 'Kiaros is speaking — press to interrupt and talk', className: 'animate-pulse bg-[rgba(112,0,255,0.15)] border-[rgba(112,0,255,0.5)]' };
    }
    if (isListening) {
      return { text: '⏹', title: 'Listening — press to stop', className: 'animate-pulse bg-red-500/20 border-red-500/50' };
    }
    if (voiceState === 'thinking') {
      return { text: '…', title: 'Kiaros is thinking — press to cancel the loop', className: 'opacity-75' };
    }
    if (errorMessage) {
      return { text: '⚠️', title: `${errorMessage} — press to try again`, className: 'bg-yellow-500/20 border-yellow-500/50' };
    }
    return {
      text: '🎤',
      title: permissionGranted ? 'Press to talk to Kiaros' : 'Press to enable the microphone',
      className: '',
    };
  };

  const { text, title, className } = getButtonState();

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || !isSupported}
      title={title}
      className={`
        relative flex items-center justify-center
        w-11 h-11 min-w-[44px] min-h-[44px]
        bg-[rgba(0,240,255,0.1)]
        border border-[rgba(0,240,255,0.2)]
        rounded-lg
        text-[var(--j-primary)]
        text-xl
        transition-all duration-200
        hover:bg-[rgba(0,240,255,0.2)]
        hover:border-[rgba(0,240,255,0.4)]
        active:scale-95
        flex-shrink-0
        ${className}
      `}
      aria-label={loopActive ? 'Stop conversation' : 'Start voice conversation'}
    >
      {text}

      {/* Active-loop indicator */}
      {loopActive && (
        <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
        </span>
      )}
    </button>
  );
};

export default VoiceButton;
