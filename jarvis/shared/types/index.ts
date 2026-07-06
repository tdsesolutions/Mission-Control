/**
 * Jarvis Shared Types
 * Core type definitions for Jarvis AI Executive System
 */

// ============================================================================
// Core Service Types
// ============================================================================

export interface JarvisConfig {
  version: string;
  environment: 'development' | 'production';
  ports: {
    core: number;
    desktop: number;
    memory: number;
    monitor: number;
  };
  missionControl: {
    url: string;
    apiKey: string;
  };
  openclaw: {
    gatewayUrl: string;
  };
  features: {
    orbMode: boolean;
    sphereMode: boolean;
    waveMode: boolean;
    hudMode: boolean;
    ambientMode: boolean;
  };
  /** Conversation intelligence — provider-agnostic by mandate (Phase 5). */
  llm: {
    provider: 'auto' | 'anthropic' | 'openai-compatible' | 'none';
    /** Generic model override; empty string = use the provider's default. */
    model: string;
    maxTokens: number;
    timeoutMs: number;
    anthropic: {
      apiKey: string;
    };
    openaiCompat: {
      baseUrl: string;
      apiKey: string;
      model: string;
    };
  };
}

export interface ServiceStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  lastCheck: Date;
  uptime: number;
  version: string;
  port: number;
  metrics?: ServiceMetrics;
}

export interface ServiceMetrics {
  cpuUsage: number;
  memoryUsage: number;
  requestCount: number;
  errorRate: number;
  latency: number;
}

// ============================================================================
// Jarvis AI Types
// ============================================================================

export interface JarvisState {
  mode: JarvisMode;
  status: JarvisStatus;
  context: JarvisContext;
  memory: JarvisMemory;
}

export type JarvisMode = 'orb' | 'sphere' | 'wave' | 'hud' | 'ambient';

export type JarvisStatus = 'idle' | 'listening' | 'thinking' | 'responding' | 'executing' | 'error';

export interface JarvisContext {
  sessionId: string;
  userId: string;
  projectId?: string;
  taskId?: string;
  timestamp: Date;
  location: string;
}

export interface JarvisMemory {
  shortTerm: ShortTermMemory;
  longTerm: LongTermMemory;
  working: WorkingMemory;
}

export interface ShortTermMemory {
  recentConversations: Conversation[];
  currentTask?: Task;
  activeProjects: Project[];
}

export interface LongTermMemory {
  userPreferences: UserPreferences;
  projectHistory: Project[];
  learnedPatterns: Pattern[];
}

export interface WorkingMemory {
  currentGoal?: string;
  pendingActions: Action[];
  contextStack: ContextFrame[];
}

// ============================================================================
// Task & Project Types
// ============================================================================

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  projectId?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  assignedTo?: string;
  metadata: TaskMetadata;
}

export type TaskStatus = 'pending' | 'in_progress' | 'blocked' | 'completed' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export interface TaskMetadata {
  source: 'user' | 'jarvis' | 'mission_control' | 'openclaw';
  classification?: string;
  estimatedDuration?: number;
  tags: string[];
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  path: string;
  createdAt: Date;
  updatedAt: Date;
  tasks: Task[];
  metrics: ProjectMetrics;
}

export type ProjectStatus = 'active' | 'paused' | 'completed' | 'archived';

export interface ProjectMetrics {
  totalTasks: number;
  completedTasks: number;
  blockedTasks: number;
  progressPercentage: number;
}

// ============================================================================
// Conversation & Interaction Types
// ============================================================================

export interface Conversation {
  id: string;
  timestamp: Date;
  role: 'user' | 'jarvis' | 'system';
  content: string;
  type: 'text' | 'command' | 'notification' | 'status';
  metadata?: ConversationMetadata;
}

export interface ConversationMetadata {
  intent?: string;
  entities?: Entity[];
  sentiment?: 'positive' | 'neutral' | 'negative';
  actionTaken?: string;
}

export interface Entity {
  type: string;
  value: string;
  confidence: number;
}

// ============================================================================
// Action & Delegation Types
// ============================================================================

export interface Action {
  id: string;
  type: ActionType;
  status: ActionStatus;
  payload: unknown;
  createdAt: Date;
  executedAt?: Date;
  result?: ActionResult;
}

export type ActionType = 
  | 'create_task'
  | 'update_task'
  | 'delegate_to_mission_control'
  | 'request_approval'
  | 'monitor_service'
  | 'notify_user'
  | 'summarize_work'
  | 'read_memory'
  | 'write_memory';

export type ActionStatus = 'pending' | 'approved' | 'rejected' | 'executing' | 'completed' | 'failed';

export interface ActionResult {
  success: boolean;
  data?: unknown;
  error?: string;
  timestamp: Date;
}

export interface DelegationRequest {
  id: string;
  source: 'jarvis';
  target: 'mission_control';
  action: string;
  payload: unknown;
  priority: TaskPriority;
  requiresApproval: boolean;
  timestamp: Date;
}

// ============================================================================
// User & Preference Types
// ============================================================================

export interface UserPreferences {
  displayMode: JarvisMode;
  notifications: NotificationPreferences;
  automation: AutomationPreferences;
  privacy: PrivacyPreferences;
}

export interface NotificationPreferences {
  enabled: boolean;
  soundEnabled: boolean;
  desktopNotifications: boolean;
  emailNotifications: boolean;
  quietHours: { start: string; end: string } | null;
}

export interface AutomationPreferences {
  autoApproveLowRisk: boolean;
  autoMonitorServices: boolean;
  proactiveSuggestions: boolean;
  learningEnabled: boolean;
}

export interface PrivacyPreferences {
  localMemoryOnly: boolean;
  encryptSensitiveData: boolean;
  retentionDays: number;
}

// ============================================================================
// Pattern & Learning Types
// ============================================================================

export interface Pattern {
  id: string;
  type: 'workflow' | 'command' | 'schedule' | 'preference';
  pattern: string;
  frequency: number;
  confidence: number;
  lastObserved: Date;
  metadata?: unknown;
}

export interface ContextFrame {
  id: string;
  type: string;
  data: unknown;
  timestamp: Date;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  timestamp: Date;
  requestId: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface HealthCheckResponse {
  status: 'ok' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  services: ServiceStatus[];
  timestamp: Date;
}

// ============================================================================
// Monitor & Event Types
// ============================================================================

export interface SystemEvent {
  id: string;
  type: SystemEventType;
  severity: 'info' | 'warning' | 'error' | 'critical';
  source: string;
  message: string;
  data?: unknown;
  timestamp: Date;
}

export type SystemEventType =
  | 'service_started'
  | 'service_stopped'
  | 'service_unhealthy'
  | 'service:healthy'
  | 'service:unhealthy'
  | 'mode:changed'
  | 'task_created'
  | 'task_completed'
  | 'task_failed'
  | 'approval_required'
  | 'approval_granted'
  | 'approval_denied'
  | 'memory_updated'
  | 'error_occurred';

export interface MonitorConfig {
  checkInterval: number;
  alertThresholds: AlertThresholds;
  services: string[];
}

export interface AlertThresholds {
  cpuPercent: number;
  memoryPercent: number;
  errorRatePercent: number;
  latencyMs: number;
}
