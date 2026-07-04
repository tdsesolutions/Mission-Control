import { createContext, useContext, useEffect, ReactNode } from 'react';
import { useJarvisStore } from '../stores/jarvisStore';

interface JarvisContextType {
  isInitialized: boolean;
}

const JarvisContext = createContext<JarvisContextType>({ isInitialized: false });

export const useJarvis = () => useContext(JarvisContext);

interface JarvisProviderProps {
  children: ReactNode;
}

export function JarvisProvider({ children }: JarvisProviderProps) {
  const initialize = useJarvisStore((state) => state.initialize);
  const shutdown = useJarvisStore((state) => state.shutdown);
  const isConnected = useJarvisStore((state) => state.isConnected);

  useEffect(() => {
    initialize();
    
    return () => {
      shutdown();
    };
  }, [initialize, shutdown]);

  return (
    <JarvisContext.Provider value={{ isInitialized: isConnected }}>
      {children}
    </JarvisContext.Provider>
  );
}
