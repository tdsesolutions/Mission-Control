/**
 * Jarvis State Manager
 * Manages Jarvis AI state and context
 */

import { logger } from '../utils/logger.js';
import type { 
  JarvisState, 
  JarvisMode, 
  JarvisStatus,
  JarvisContext,
  JarvisMemory,
  ShortTermMemory,
  LongTermMemory,
  WorkingMemory,
  Conversation,
  Task,
  Project
} from '../../../shared/types/index.js';
import { UI_MODES } from '../../../shared/constants/index.js';
import { EventBus } from './eventBus.js';
import { getMemoryService } from './memoryService.js';

/** Persisted snapshot shape (STATE_MANAGEMENT gap 1 closed). */
interface PersistedState {
  mode: JarvisMode;
  userPreferences: LongTermMemory['userPreferences'];
}

const STATE_MEMORY_KEY = 'state.snapshot';

let sharedInstance: JarvisStateManager | null = null;

/** Register the container-owned instance so route modules share it. */
export function setStateManager(instance: JarvisStateManager): void {
  sharedInstance = instance;
}

export function getStateManager(): JarvisStateManager | null {
  return sharedInstance;
}

interface ServiceRefs {
  memoryService?: any;
  missionControlClient?: any;
  monitorService?: any;
}

export class JarvisStateManager {
  private state: JarvisState;
  private eventBus: EventBus;
  private services: ServiceRefs = {};
  private initialized = false;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    
    // Initialize default state
    this.state = {
      mode: UI_MODES.ORB,
      status: 'idle',
      context: this.createInitialContext(),
      memory: this.createInitialMemory(),
    };
  }

  private createInitialContext(): JarvisContext {
    return {
      sessionId: `session_${Date.now()}`,
      userId: 'default_user',
      timestamp: new Date(),
      location: 'local',
    };
  }

  private createInitialMemory(): JarvisMemory {
    return {
      shortTerm: {
        recentConversations: [],
        activeProjects: [],
      },
      longTerm: {
        userPreferences: {
          displayMode: UI_MODES.ORB,
          notifications: {
            enabled: true,
            soundEnabled: true,
            desktopNotifications: true,
            emailNotifications: false,
            quietHours: null,
          },
          automation: {
            autoApproveLowRisk: false,
            autoMonitorServices: true,
            proactiveSuggestions: true,
            learningEnabled: true,
          },
          privacy: {
            localMemoryOnly: true,
            encryptSensitiveData: true,
            retentionDays: 30,
          },
        },
        projectHistory: [],
        learnedPatterns: [],
      },
      working: {
        pendingActions: [],
        contextStack: [],
      },
    };
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    logger.info('Initializing Jarvis State Manager...');

    // Load persisted state if available
    await this.loadState();

    // Emit initialization event
    this.eventBus.emitEvent('service_started', 'info', 'state-manager', 'Jarvis State Manager initialized');

    this.initialized = true;
    logger.info('Jarvis State Manager initialized');
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down Jarvis State Manager...');
    
    // Persist state
    await this.saveState();
    
    this.eventBus.emitEvent('service_stopped', 'info', 'state-manager', 'Jarvis State Manager stopped');
    
    logger.info('Jarvis State Manager shutdown complete');
  }

  setServices(services: ServiceRefs): void {
    this.services = services;
  }

  // State getters
  getState(): JarvisState {
    return { ...this.state };
  }

  getMode(): JarvisMode {
    return this.state.mode;
  }

  getStatus(): JarvisStatus {
    return this.state.status;
  }

  getContext(): JarvisContext {
    return { ...this.state.context };
  }

  // State setters
  setMode(mode: JarvisMode): void {
    if (!Object.values(UI_MODES).includes(mode)) {
      throw new Error(`Invalid mode: ${mode}`);
    }

    const oldMode = this.state.mode;
    this.state.mode = mode;

    // Update user preferences
    this.state.memory.longTerm.userPreferences.displayMode = mode;

    this.eventBus.emitEvent('mode:changed', 'info', 'state-manager', `Mode changed from ${oldMode} to ${mode}`, { oldMode, newMode: mode });
    logger.info(`Mode changed: ${oldMode} -> ${mode}`);

    // Persist immediately — mode must survive Core restarts.
    void this.saveState();
  }

  setStatus(status: JarvisStatus): void {
    this.state.status = status;
    logger.debug(`Status changed: ${status}`);
  }

  setContext(updates: Partial<JarvisContext>): void {
    this.state.context = { ...this.state.context, ...updates };
  }

  // Memory operations
  addConversation(conversation: Conversation): void {
    this.state.memory.shortTerm.recentConversations.push(conversation);
    
    // Keep only last 50 conversations
    if (this.state.memory.shortTerm.recentConversations.length > 50) {
      this.state.memory.shortTerm.recentConversations.shift();
    }
  }

  addActiveProject(project: Project): void {
    const exists = this.state.memory.shortTerm.activeProjects.find(p => p.id === project.id);
    if (!exists) {
      this.state.memory.shortTerm.activeProjects.push(project);
    }
  }

  removeActiveProject(projectId: string): void {
    this.state.memory.shortTerm.activeProjects = this.state.memory.shortTerm.activeProjects.filter(
      p => p.id !== projectId
    );
  }

  setCurrentTask(task: Task | undefined): void {
    this.state.memory.shortTerm.currentTask = task;
  }

  // Persistence via the shared MemoryService (survives Core restarts).
  private async loadState(): Promise<void> {
    try {
      const persisted = getMemoryService().get<PersistedState>(STATE_MEMORY_KEY);
      if (!persisted) {
        logger.debug('No persisted state snapshot — starting with defaults');
        return;
      }
      if (persisted.mode && Object.values(UI_MODES).includes(persisted.mode)) {
        this.state.mode = persisted.mode;
      }
      if (persisted.userPreferences) {
        this.state.memory.longTerm.userPreferences = {
          ...this.state.memory.longTerm.userPreferences,
          ...persisted.userPreferences,
        };
      }
      logger.info(`Restored persisted state (mode: ${this.state.mode})`);
    } catch (error) {
      logger.warn('Failed to load persisted state, using defaults:', error);
    }
  }

  private async saveState(): Promise<void> {
    try {
      const memory = getMemoryService();
      memory.set<PersistedState>(STATE_MEMORY_KEY, {
        mode: this.state.mode,
        userPreferences: this.state.memory.longTerm.userPreferences,
      });
      await memory.saveMemory();
    } catch (error) {
      logger.warn('Failed to persist state:', error);
    }
  }
}
