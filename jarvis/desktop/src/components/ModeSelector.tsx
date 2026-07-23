import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useJarvisStore } from '../stores/jarvisStore';
import { Circle, Box, Waves, LayoutDashboard, Sparkles, ScanFace } from 'lucide-react';
import type { JarvisMode } from '../../../shared/types/index.js';

const modes: { id: JarvisMode; icon: ReactNode; label: string }[] = [
  { id: 'face', icon: <ScanFace size={20} />, label: 'Face' },
  { id: 'orb', icon: <Circle size={20} />, label: 'Orb' },
  { id: 'sphere', icon: <Box size={20} />, label: 'Sphere' },
  { id: 'wave', icon: <Waves size={20} />, label: 'Wave' },
  { id: 'hud', icon: <LayoutDashboard size={20} />, label: 'HUD' },
  { id: 'ambient', icon: <Sparkles size={20} />, label: 'Ambient' },
];

export function ModeSelector() {
  const { mode, setMode } = useJarvisStore();

  return (
    <div className="mode-selector">
      {modes.map((m) => (
        <motion.button
          key={m.id}
          className={`mode-btn ${mode === m.id ? 'active' : ''}`}
          onClick={() => setMode(m.id)}
          title={m.label}
          whileHover={{ scale: 1.12 }}
          whileTap={{ scale: 0.92 }}
          transition={{ type: 'spring', stiffness: 500, damping: 28 }}
        >
          {/* Sliding glass pill glides between active modes */}
          {mode === m.id && (
            <motion.span
              layoutId="mode-active-pill"
              className="mode-active-pill"
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            />
          )}
          <span style={{ position: 'relative', zIndex: 1, display: 'flex' }}>{m.icon}</span>
          <span className="mode-tooltip">{m.label}</span>
        </motion.button>
      ))}
    </div>
  );
}
