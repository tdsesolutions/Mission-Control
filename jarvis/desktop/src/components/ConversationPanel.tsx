import { useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react';
import { useJarvisStore } from '../stores/jarvisStore';
import { Send, MessageSquare, AlertCircle } from 'lucide-react';

// Voice components - lazy loaded to prevent breaking core chat
const VoiceButton = lazy(() => import('./VoiceButton').then(m => ({ default: m.VoiceButton })).catch(() => ({ default: () => null })));
const VoiceStatusIndicator = lazy(() => import('./VoiceStatusIndicator').then(m => ({ default: m.VoiceStatusIndicator })).catch(() => ({ default: () => null })));
const VoiceSettingsPanel = lazy(() => import('./VoiceSettings').then(m => ({ default: m.VoiceSettingsPanel })).catch(() => ({ default: () => null })));

export function ConversationPanel() {
  const { messages, sendMessage, status, isConnected } = useJarvisStore();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || status === 'thinking' || !isConnected) return;
    
    await sendMessage(input.trim());
    setInput('');
  };

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
  };

  // Memoized callback to prevent VoiceButton useEffect from re-triggering on every render
  const handleVoiceTranscript = useCallback((transcript: string) => {
    if (transcript.trim() && isConnected && status !== 'thinking') {
      sendMessage(transcript.trim());
    }
  }, [isConnected, status, sendMessage]);

  return (
    <div className="conversation-container h-full">
      <div className="conversation-header">
        <div className="conversation-title">
          <MessageSquare size={14} />
          <span>Kiaros Communication Interface</span>
        </div>
        <div className="flex items-center gap-2">
          <Suspense fallback={null}>
            <VoiceStatusIndicator />
          </Suspense>
          {!isConnected && (
            <span className="flex items-center gap-1 text-xs text-[var(--j-error)] px-2 py-1 bg-[rgba(255,51,102,0.1)] rounded">
              <AlertCircle size={12} />
              Kiaros Offline
            </span>
          )}
          <span className="text-xs text-[var(--j-text-muted)] font-mono">
            {messages.length} messages
          </span>
          <Suspense fallback={null}>
            <VoiceSettingsPanel />
          </Suspense>
        </div>
      </div>

      <div className="conversation-messages">
        {!isConnected && messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[var(--j-text-muted)]">
            <div className="w-16 h-16 rounded-full bg-[rgba(255,51,102,0.1)] flex items-center justify-center mb-4">
              <AlertCircle size={24} className="text-[var(--j-error)]" />
            </div>
            <p className="text-lg mb-1 text-[var(--j-error)]">Connection Failed</p>
            <p className="text-sm opacity-70 text-center max-w-xs">
              Unable to connect to Kiaros Core on port 3010.<br />
              Please ensure the Core service is running.
            </p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[var(--j-text-muted)]">
            <div className="w-16 h-16 rounded-full bg-[rgba(0,240,255,0.1)] flex items-center justify-center mb-4">
              <MessageSquare size={24} className="text-[var(--j-primary)]" />
            </div>
            <p className="text-lg mb-1">Kiaros Online</p>
            <p className="text-sm opacity-70">Greetings Teddie. How can I assist you today?</p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div
              key={index}
              className={`message ${msg.role}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs font-semibold uppercase ${
                  msg.role === 'user' ? 'text-[var(--j-primary)]' : 'text-[var(--j-secondary)]'
                }`}>
                  {msg.role === 'user' ? 'You' : 'Kiaros'}
                </span>
                <span className="message-timestamp">
                  {formatTime(msg.timestamp)}
                </span>
              </div>
              <div className="whitespace-pre-wrap">{msg.content}</div>
            </div>
          ))
        )}
        
        {status === 'thinking' && (
          <div className="message jarvis">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold uppercase text-[var(--j-secondary)]">
                Kiaros
              </span>
              <span className="text-xs text-[var(--j-text-muted)]">Processing...</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="thinking-dot" />
              <div className="thinking-dot" />
              <div className="thinking-dot" />
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <form className="conversation-input-area" onSubmit={handleSubmit}>
        <Suspense fallback={
          <button type="button" disabled className="voice-button-fallback" title="Voice not available">
            🎤
          </button>
        }>
          <VoiceButton 
            onTranscript={handleVoiceTranscript}
            disabled={!isConnected || status === 'thinking'}
          />
        </Suspense>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={!isConnected 
            ? "Waiting for Kiaros connection..." 
            : status === 'thinking' 
              ? "Kiaros is thinking..." 
              : "Enter command or message..."
          }
          disabled={status === 'thinking' || !isConnected}
          className="conversation-input"
        />
        <button
          type="submit"
          disabled={!input.trim() || status === 'thinking' || !isConnected}
          className="conversation-send-btn"
        >
          <Send size={18} />
        </button>
      </form>
      <style>{`
        .voice-button-fallback {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 44px;
          height: 44px;
          min-width: 44px;
          min-height: 44px;
          background: rgba(0, 240, 255, 0.1);
          border: 1px solid rgba(0, 240, 255, 0.2);
          border-radius: 0.5rem;
          color: var(--j-primary);
          font-size: 1.25rem;
          cursor: not-allowed;
          opacity: 0.5;
          flex-shrink: 0;
        }
      `}</style>
    </div>
  );
}
