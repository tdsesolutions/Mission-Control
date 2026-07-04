import { create } from 'zustand';
import type { JarvisMode, JarvisStatus } from '@shared/types/index.js';

interface JarvisState {
  // State
  mode: JarvisMode;
  status: JarvisStatus;
  isConnected: boolean;
  messages: Array<{ role: 'user' | 'jarvis'; content: string; timestamp: Date }>;
  
  // Actions
  setMode: (mode: JarvisMode) => void;
  setStatus: (status: JarvisStatus) => void;
  addMessage: (role: 'user' | 'jarvis', content: string) => void;
  clearMessages: () => void;
  initialize: () => Promise<void>;
  shutdown: () => void;
  sendMessage: (content: string) => Promise<void>;
  checkConnection: () => Promise<boolean>;
}

const JARVIS_CORE_URL = 'http://localhost:3010';

export const useJarvisStore = create<JarvisState>((set, get) => ({
  // Initial state
  mode: 'orb',
  status: 'idle',
  isConnected: false,
  messages: [],
  
  // Actions
  setMode: (mode) => {
    set({ mode });
    // Notify server of mode change
    fetch(`${JARVIS_CORE_URL}/api/v1/mode/set`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    }).catch(() => {});
  },
  
  setStatus: (status) => set({ status }),
  
  addMessage: (role, content) => {
    set((state) => ({
      messages: [...state.messages, { role, content, timestamp: new Date() }],
    }));
  },
  
  clearMessages: () => set({ messages: [] }),

  checkConnection: async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const response = await fetch(`${JARVIS_CORE_URL}/health`, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const connected = response.ok;
      set({ isConnected: connected });
      return connected;
    } catch {
      set({ isConnected: false });
      return false;
    }
  },
  
  initialize: async () => {
    try {
      // Check connection to Jarvis Core
      const isConnected = await get().checkConnection();
      
      if (isConnected) {
        // Load current mode
        try {
          const modeController = new AbortController();
          const modeTimeout = setTimeout(() => modeController.abort(), 3000);
          const modeResponse = await fetch(`${JARVIS_CORE_URL}/api/v1/mode`, {
            signal: modeController.signal,
          });
          clearTimeout(modeTimeout);
          if (modeResponse.ok) {
            const data = await modeResponse.json();
            if (data.success && data.data?.currentMode) {
              set({ mode: data.data.currentMode });
            }
          }
        } catch {}
        
        // Load conversation history
        try {
          const convController = new AbortController();
          const convTimeout = setTimeout(() => convController.abort(), 3000);
          const convResponse = await fetch(`${JARVIS_CORE_URL}/api/v1/conversation`, {
            signal: convController.signal,
          });
          clearTimeout(convTimeout);
          if (convResponse.ok) {
            const data = await convResponse.json();
            if (data.success && data.data) {
              const messages = data.data.map((msg: any) => ({
                role: msg.role,
                content: msg.content,
                timestamp: new Date(msg.timestamp),
              }));
              set({ messages });
            }
          }
        } catch {}
      }

      // Set up periodic connection check
      const interval = setInterval(() => {
        get().checkConnection();
      }, 5000);

      // Store interval for cleanup
      (window as any).__jarvisInterval = interval;
      
    } catch (error) {
      console.error('Failed to initialize Jarvis:', error);
      set({ isConnected: false });
    }
  },
  
  shutdown: () => {
    if ((window as any).__jarvisInterval) {
      clearInterval((window as any).__jarvisInterval);
    }
    set({ isConnected: false });
  },
  
  sendMessage: async (content) => {
    const { addMessage, setStatus, checkConnection } = get();
    
    // Verify connection first
    const isConnected = await checkConnection();
    if (!isConnected) {
      addMessage('jarvis', 'I am unable to connect to the Kiaros Core service. Please ensure the service is running on port 3010.');
      return;
    }
    
    // Add user message
    addMessage('user', content);
    setStatus('thinking');
    
    try {
      const response = await fetch(`${JARVIS_CORE_URL}/api/v1/conversation/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, type: 'text' }),
        signal: (() => { const c = new AbortController(); setTimeout(() => c.abort(), 10000); return c.signal; })(),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.jarvisResponse) {
          addMessage('jarvis', data.data.jarvisResponse.content);
        } else {
          addMessage('jarvis', 'I received your message but was unable to formulate a proper response.');
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        addMessage('jarvis', `I encountered an error processing your request: ${errorData.error?.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      addMessage('jarvis', 'I apologize, but I am unable to process your request at the moment. The connection to Kiaros Core was lost.');
    } finally {
      setStatus('idle');
    }
  },
}));
