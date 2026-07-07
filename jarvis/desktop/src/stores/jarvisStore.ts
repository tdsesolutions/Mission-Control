import { create } from 'zustand';
import type { JarvisMode, JarvisStatus } from '@shared/types/index.js';
import { coreHeaders } from '../services/coreAuth';

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
  /** Resolves with Kiaros's reply text (null on failure) so the voice loop can speak it. */
  sendMessage: (content: string) => Promise<string | null>;
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
      headers: coreHeaders({ 'Content-Type': 'application/json' }),
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
            headers: coreHeaders(),
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
            headers: coreHeaders(),
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

      // Set up periodic connection check (idempotent: StrictMode mounts
      // effects twice in dev — never leak a second interval)
      if ((window as any).__jarvisInterval) {
        clearInterval((window as any).__jarvisInterval);
      }
      (window as any).__jarvisInterval = setInterval(() => {
        get().checkConnection();
      }, 5000);
      
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
      const offline = 'I am unable to connect to the Kiaros Core service. Please ensure the service is running on port 3010.';
      addMessage('jarvis', offline);
      return offline;
    }

    // Add user message
    addMessage('user', content);
    setStatus('thinking');

    let reply: string | null = null;
    try {
      const response = await fetch(`${JARVIS_CORE_URL}/api/v1/conversation/message`, {
        method: 'POST',
        headers: coreHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ content, type: 'text' }),
        // LLM-backed replies can take tens of seconds (Phase 5); the Core
        // enforces its own provider timeout and degrades honestly.
        signal: (() => { const c = new AbortController(); setTimeout(() => c.abort(), 60000); return c.signal; })(),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.jarvisResponse) {
          reply = String(data.data.jarvisResponse.content);
        } else {
          reply = 'I received your message but was unable to formulate a proper response.';
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        reply = `I encountered an error processing your request: ${errorData.error?.message || 'Unknown error'}`;
      }
      addMessage('jarvis', reply);
    } catch (error) {
      console.error('Failed to send message:', error);
      reply = 'I apologize, but I could not reach Kiaros Core just now. I will keep listening.';
      addMessage('jarvis', reply);
    } finally {
      // The lifecycle must always leave 'thinking' — a stuck thinking
      // state is a stalled conversation.
      setStatus('idle');
    }
    return reply;
  },
}));
