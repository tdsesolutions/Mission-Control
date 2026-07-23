import { AnimatePresence, motion } from 'framer-motion';
import { useJarvisStore } from '../stores/jarvisStore';
import { Zap } from 'lucide-react';

/** Live presence colors per connection/conversation state. */
function presence(isConnected: boolean, status: string): { color: string; label: string } {
  if (!isConnected) return { color: 'var(--j-error)', label: 'Offline' };
  switch (status) {
    case 'thinking':
      return { color: 'var(--j-secondary)', label: 'Thinking' };
    case 'listening':
      return { color: 'var(--j-primary)', label: 'Listening' };
    case 'responding':
    case 'executing':
      return { color: 'var(--j-info)', label: 'Working' };
    default:
      return { color: 'var(--j-success)', label: 'Online' };
  }
}

export function Header() {
  const { isConnected, status } = useJarvisStore();
  const state = presence(isConnected, status);

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
        {/* Presence: breathing orb + crossfading state label */}
        <div className="state-chip" style={{ color: state.color, borderColor: `color-mix(in srgb, ${state.color} 35%, transparent)` }}>
          <span className="presence-orb" />
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={state.label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              {state.label}
            </motion.span>
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
