import { useEffect } from 'react';
import { JarvisProvider } from './hooks/useJarvis';
import { JarvisOrb } from './components/JarvisOrb';
import { JarvisSphere } from './components/JarvisSphere';
import { JarvisWave } from './components/JarvisWave';
import { JarvisHUD } from './components/JarvisHUD';
import { JarvisAmbient } from './components/JarvisAmbient';
import { ModeSelector } from './components/ModeSelector';
import { ConversationPanel } from './components/ConversationPanel';
import { ServicePanel } from './components/ServicePanel';
import { TaskPanel } from './components/TaskPanel';
import { Header } from './components/Header';
import { useJarvisStore } from './stores/jarvisStore';

function AppContent() {
  const { mode, initialize, shutdown } = useJarvisStore();

  useEffect(() => {
    initialize();
    return () => {
      shutdown();
    };
  }, [initialize, shutdown]);

  const renderCenterContent = () => {
    switch (mode) {
      case 'orb':
        return <JarvisOrb />;
      case 'sphere':
        return <JarvisSphere />;
      case 'wave':
        return <JarvisWave />;
      case 'hud':
        return <JarvisHUD />;
      case 'ambient':
        return <JarvisAmbient />;
      default:
        return <JarvisOrb />;
    }
  };

  return (
    <div className="jarvis-app">
      <div className="jarvis-hud-layout">
        {/* Header */}
        <Header />

        {/* Left Panel - Services & Status */}
        <div className="jarvis-left-panel">
          <ServicePanel />
        </div>

        {/* Center - Visual Mode (mode selector overlays the empty flank) */}
        <div className="jarvis-center">
          {renderCenterContent()}
          <ModeSelector />
        </div>

        {/* Right Panel - Tasks */}
        <div className="jarvis-right-panel">
          <TaskPanel />
        </div>

        {/* Footer - Communication Interface (full center-column width) */}
        <div className="jarvis-footer">
          <ConversationPanel />
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <JarvisProvider>
      <AppContent />
    </JarvisProvider>
  );
}

export default App;
