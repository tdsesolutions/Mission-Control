/**
 * Context Manager
 * Tracks session-level conversation context
 */

export interface ConversationContext {
  currentTopic?: string;
  currentProject?: string;
  currentPhase?: string;
  recentCommands: string[];
  pendingTasks: string[];
  lastIntent?: string;
  lastMode?: string;
  messageCount: number;
  sessionStartTime: Date;
}

export class ContextManager {
  private context: ConversationContext;

  constructor() {
    this.context = {
      recentCommands: [],
      pendingTasks: [],
      messageCount: 0,
      sessionStartTime: new Date(),
    };
  }

  updateContext(updates: Partial<ConversationContext>): void {
    this.context = { ...this.context, ...updates };
  }

  setTopic(topic: string): void {
    this.context.currentTopic = topic;
  }

  setProject(project: string): void {
    this.context.currentProject = project;
  }

  setPhase(phase: string): void {
    this.context.currentPhase = phase;
  }

  addCommand(command: string): void {
    this.context.recentCommands.unshift(command);
    // Keep only last 5 commands
    if (this.context.recentCommands.length > 5) {
      this.context.recentCommands.pop();
    }
  }

  addPendingTask(task: string): void {
    this.context.pendingTasks.push(task);
  }

  completePendingTask(task: string): void {
    this.context.pendingTasks = this.context.pendingTasks.filter(t => t !== task);
  }

  setLastIntent(intent: string): void {
    this.context.lastIntent = intent;
  }

  setLastMode(mode: string): void {
    this.context.lastMode = mode;
  }

  incrementMessageCount(): void {
    this.context.messageCount++;
  }

  getContext(): ConversationContext {
    return { ...this.context };
  }

  getRecentCommands(): string[] {
    return [...this.context.recentCommands];
  }

  getPendingTasks(): string[] {
    return [...this.context.pendingTasks];
  }

  getCurrentTopic(): string | undefined {
    return this.context.currentTopic;
  }

  getCurrentProject(): string | undefined {
    return this.context.currentProject;
  }

  clear(): void {
    this.context = {
      recentCommands: [],
      pendingTasks: [],
      messageCount: 0,
      sessionStartTime: new Date(),
    };
  }
}
