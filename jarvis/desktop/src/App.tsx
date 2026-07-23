import { useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { KiarosFace } from './components/KiarosFace';
import { JarvisOrb } from './components/JarvisOrb';
import { JarvisSphere } from './components/JarvisSphere';
import { JarvisWave } from './components/JarvisWave';
import { JarvisHUD } from './components/JarvisHUD';
import { JarvisAmbient } from './components/JarvisAmbient';
import { ModeSelector } from './components/ModeSelector';
import { ConversationPanel } from './components/ConversationPanel';
import { ServicePanel } from './components/ServicePanel';
import { TaskPanel } from './components/TaskPanel';
import { PendingApprovals } from './components/PendingApprovals';
import { Header } from './components/Header';
import { useJarvisStore } from './stores/jarvisStore';

const PARTICLE_COUNT = 26;

/**
 * Ambient depth stack: aurora blobs + rising particle field + vignette.
 * Pure CSS animation (GPU transforms only); voice reactivity is wired in
 * index.css via :has(.voice-button.listening/speaking) — no JS coupling.
 * Particle geometry is deterministic per index so SSR/re-renders agree.
 */
function AmbientBackdrop() {
  const particles = useMemo(
    () =>
      Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
        left: `${(i * 137.5) % 100}%`,
        duration: 14 + ((i * 7) % 18),
        delay: -((i * 5.3) % 22),
        drift: `${((i % 5) - 2) * 30}px`,
      })),
    []
  );

  return (
    <div className="jarvis-backdrop" aria-hidden="true">
      <div className="aurora aurora-1" />
      <div className="aurora aurora-2" />
      <div className="aurora aurora-3" />
      <div className="particle-field">
        {particles.map((p, i) => (
          <span
            key={i}
            style={{
              left: p.left,
              animationDuration: `${p.duration}s`,
              animationDelay: `${p.delay}s`,
              ['--drift' as string]: p.drift,
            }}
          />
        ))}
      </div>
      <div className="vignette" />
    </div>
  );
}

const MODE_COMPONENTS = {
  face: KiarosFace,
  orb: JarvisOrb,
  sphere: JarvisSphere,
  wave: JarvisWave,
  hud: JarvisHUD,
  ambient: JarvisAmbient,
} as const;

/** Staggered panel entrance — the app assembles itself on load. */
const panelEntrance = (delay: number) => ({
  initial: { opacity: 0, y: 18, scale: 0.985 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: { duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] as const },
});

function AppContent() {
  const { mode, initialize, shutdown } = useJarvisStore();

  useEffect(() => {
    initialize();
    return () => {
      shutdown();
    };
  }, [initialize, shutdown]);

  const ModeVisualization = MODE_COMPONENTS[mode] ?? KiarosFace;

  return (
    <div className="jarvis-app">
      <AmbientBackdrop />
      <div className="jarvis-hud-layout">
        {/* Header */}
        <motion.div style={{ gridArea: 'header', display: 'flex', minHeight: 0 }} {...panelEntrance(0)}>
          <Header />
        </motion.div>

        {/* Left Panel - Services & Status */}
        <motion.div className="jarvis-left-panel" {...panelEntrance(0.08)}>
          <ServicePanel />
        </motion.div>

        {/* Center - Visual Mode (mode selector overlays the empty flank).
            Mode switches crossfade+scale instead of hard-swapping. */}
        <div className="jarvis-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, scale: 0.92, filter: 'blur(6px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 1.05, filter: 'blur(6px)' }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}
            >
              <ModeVisualization />
            </motion.div>
          </AnimatePresence>
          <ModeSelector />
        </div>

        {/* Right Panel - Tasks + owner-approval workflow */}
        <motion.div className="jarvis-right-panel" {...panelEntrance(0.16)}>
          <TaskPanel />
          <PendingApprovals />
        </motion.div>

        {/* Footer - Communication Interface (full center-column width) */}
        <motion.div className="jarvis-footer" {...panelEntrance(0.24)}>
          <ConversationPanel />
        </motion.div>
      </div>
    </div>
  );
}

// AppContent owns the single initialize/shutdown lifecycle. The former
// JarvisProvider wrapper duplicated it (double init on every mount, 4x
// under StrictMode) and its context was never consumed — removed 2026-07-09.
function App() {
  return <AppContent />;
}

export default App;
