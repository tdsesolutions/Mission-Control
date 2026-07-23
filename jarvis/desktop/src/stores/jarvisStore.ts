import { create } from 'zustand';
import type { JarvisMode, JarvisStatus } from '../../../shared/types/index.js';
import { UI_MODES } from '../../../shared/constants/index.js';
import { coreHeaders } from '../services/coreAuth';
import { coreSocket } from '../services/coreSocket';

interface JarvisState {
  // State
  mode: JarvisMode;
  status: JarvisStatus;
  isConnected: boolean;
  messages: Array<{ role: 'user' | 'jarvis'; content: string; timestamp: Date }>;
  /**
   * Change counters bumped by Core push events (task_* / approval_*).
   * Panels put these in their effect deps to refetch immediately instead
   * of waiting for their poll interval.
   */
  taskEventsNonce: number;
  approvalEventsNonce: number;

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
  taskEventsNonce: 0,
  approvalEventsNonce: 0,

  // Actions
  setMode: (mode) => {
    set({ mode });
    // Notify server of mode change. A failure is visible in the console
    // (local and server mode can diverge until the next mode:changed push).
    fetch(`${JARVIS_CORE_URL}/api/v1/mode/set`, {
      method: 'POST',
      headers: coreHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ mode }),
    }).then((response) => {
      if (!response.ok) console.warn(`Mode sync failed: Core answered HTTP ${response.status}`);
    }).catch((error) => {
      console.warn('Mode sync failed: Core unreachable', error);
    });
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

      // Real-time channel: push updates from the Core EventBus. Polling
      // above remains the connection-state authority; the socket makes
      // open/close awareness immediate and keeps the mode in sync when it
      // changes outside this window (start() is StrictMode-idempotent).
      coreSocket.start({
        onOpen: () => {
          void get().checkConnection();
        },
        onClose: () => {
          void get().checkConnection();
        },
        onEvent: (event) => {
          if (event.type === 'mode:changed') {
            const newMode = (event.data as { newMode?: string } | undefined)?.newMode;
            if (
              newMode &&
              Object.values(UI_MODES).includes(newMode as JarvisMode) &&
              newMode !== get().mode
            ) {
              set({ mode: newMode as JarvisMode });
            }
            return;
          }
          // Push-refresh signals for the task/approval panels — Kiaros can
          // now create MC tasks and hold dispatches for owner approval, so
          // these must surface immediately, not on the next poll.
          if (event.type === 'task_created' || event.type === 'task_completed' || event.type === 'task_failed') {
            set((state) => ({ taskEventsNonce: state.taskEventsNonce + 1 }));
            return;
          }
          if (event.type === 'approval_required' || event.type === 'approval_granted' || event.type === 'approval_denied') {
            set((state) => ({ approvalEventsNonce: state.approvalEventsNonce + 1 }));
          }
        },
      });

    } catch (error) {
      console.error('Failed to initialize Jarvis:', error);
      set({ isConnected: false });
    }
  },
  
  shutdown: () => {
    if ((window as any).__jarvisInterval) {
      clearInterval((window as any).__jarvisInterval);
    }
    coreSocket.stop();
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
