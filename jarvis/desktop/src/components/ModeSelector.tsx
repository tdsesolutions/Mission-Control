import { useJarvisStore } from '../stores/jarvisStore';
import { Circle, Box, Waves, LayoutDashboard, Sparkles, ScanFace } from 'lucide-react';
import type { JarvisMode } from '@shared/types/index.js';

const modes: { id: JarvisMode; icon: React.ReactNode; label: string }[] = [
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
        <button
          key={m.id}
          className={`mode-btn ${mode === m.id ? 'active' : ''}`}
          onClick={() => setMode(m.id)}
          title={m.label}
        >
          {m.icon}
        </button>
      ))}
    </div>
  );
}
