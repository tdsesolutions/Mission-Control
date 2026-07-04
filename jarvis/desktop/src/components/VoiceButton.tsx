import React, { useEffect, useCallback } from 'react';
import { useVoiceStore } from '../stores/voiceStore';

interface VoiceButtonProps {
  onTranscript?: (transcript: string) => void;
  disabled?: boolean;
}

export const VoiceButton: React.FC<VoiceButtonProps> = ({ onTranscript, disabled }) => {
  const {
    voiceState,
    isListening,
    isSupported,
    errorMessage,
    permissionGranted,
    transcript,
    startListening,
    stopListening,
    initialize,
    checkPermission,
  } = useVoiceStore();

  // Initialize voice on mount and check permission
  useEffect(() => {
    initialize();
    checkPermission();
  }, [initialize, checkPermission]);

  // Handle transcript completion
  useEffect(() => {
    if (transcript && onTranscript && !isListening) {
      onTranscript(transcript);
    }
  }, [transcript, isListening, onTranscript]);

  const handleClick = useCallback(async () => {
    if (disabled) return;
    if (isListening) {
      stopListening();
    } else {
      await startListening();
    }
  }, [isListening, startListening, stopListening, disabled]);

  // Get button state
  const getButtonState = () => {
    if (!isSupported) {
      return { text: '🎤', title: 'Voice not supported', className: 'opacity-50 cursor-not-allowed' };
    }
    if (disabled) {
      return { text: '🎤', title: 'Voice disabled', className: 'opacity-50 cursor-not-allowed' };
    }
    if (isListening) {
      return { text: '⏹', title: 'Stop listening', className: 'animate-pulse bg-red-500/20 border-red-500/50' };
    }
    if (voiceState === 'thinking') {
      return { text: '🎤', title: 'Processing...', className: 'opacity-75' };
    }
    if (errorMessage) {
      return { text: '⚠️', title: errorMessage, className: 'bg-yellow-500/20 border-yellow-500/50' };
    }
    return { 
      text: '🎤', 
      title: permissionGranted ? 'Click to speak' : 'Enable microphone',
      className: '' 
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
        flex items-center justify-center
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
      aria-label={isListening ? 'Stop listening' : 'Start voice input'}
    >
      {text}
      
      {/* Listening indicator */}
      {isListening && (
        <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
        </span>
      )}
    </button>
  );
};

export default VoiceButton;
