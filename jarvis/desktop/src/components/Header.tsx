import { useJarvisStore } from '../stores/jarvisStore';
import { Zap, Wifi, WifiOff } from 'lucide-react';

export function Header() {
  const { isConnected, status } = useJarvisStore();

  return (
    <header className="jarvis-header">
      <div className="jarvis-brand">
        <div className="jarvis-logo">
          <Zap size={20} className="text-black" />
        </div>
        <div>
          <div className="jarvis-title">KIAROS</div>
          <div className="jarvis-subtitle">AI Executive System — Configured for Teddie / tdsesolutions only</div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Connection Status */}
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded border ${
          isConnected 
            ? 'bg-[rgba(0,255,136,0.1)] border-[rgba(0,255,136,0.3)]' 
            : 'bg-[rgba(255,51,102,0.1)] border-[rgba(255,51,102,0.3)]'
        }`}>
          {isConnected ? (
            <Wifi size={16} className="text-[var(--j-success)]" />
          ) : (
            <WifiOff size={16} className="text-[var(--j-error)]" />
          )}
          <span className={`text-sm font-medium ${
            isConnected ? 'text-[var(--j-success)]' : 'text-[var(--j-error)]'
          }`}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>

        {/* Status */}
        {isConnected && (
          <div className="text-xs text-[var(--j-text-muted)] uppercase tracking-wider">
            {status}
          </div>
        )}
      </div>
    </header>
  );
}
