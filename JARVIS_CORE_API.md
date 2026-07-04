# Jarvis Core Internal API Specification

**Phase 9: Jarvis Core Foundation**  
**Date:** 2026-06-28  
**Version:** 1.0  
**Status:** Internal Service Interface

---

## Overview

This document defines the **internal service interface** for Jarvis Core. These APIs are for service-to-service communication within Jarvis Core modules only. They are NOT exposed externally and NOT for client consumption.

---

## API Design Principles

1. **Internal Only** — No external exposure, no authentication required between modules
2. **Type-Safe** — All interfaces defined in TypeScript with strict typing
3. **Async/Await** — All operations return Promises
4. **Event-Driven** — State changes emit events for loose coupling
5. **Idempotent** — Operations safe to retry

---

## Module APIs

### 1. Intent Parser API

```typescript
// Interface
interface IntentParserAPI {
  /**
   * Parse raw user input into structured intent
   * @param input Raw text from user
   * @param context Current conversation context
   * @returns Parsed intent with confidence score
   */
  parse(input: string, context?: ConversationContext): Promise<ParsedIntent>;
  
  /**
   * Extract entities from text
   * @param input Raw text
   * @param entityTypes Types of entities to extract
   * @returns Array of extracted entities
   */
  extractEntities(
    input: string, 
    entityTypes: EntityType[]
  ): Promise<ExtractedEntity[]>;
  
  /**
   * Classify intent type
   * @param input Raw text
   * @returns Intent classification with confidence
   */
  classify(input: string): Promise<IntentClassification>;
  
  /**
   * Resolve ambiguous entities
   * @param entity Ambiguous entity
   * @param candidates Possible resolutions
   * @returns Best match or null if uncertain
   */
  resolveAmbiguity(
    entity: AmbiguousEntity,
    candidates: EntityCandidate[]
  ): Promise<ResolvedEntity | null>;
}

// Types
interface ParsedIntent {
  id: string;
  rawText: string;
  timestamp: number;
  classification: IntentClassification;
  entities: EntityMap;
  extracted: {
    action: string;
    target?: string;
    constraints?: string[];
    context?: string;
  };
  confidence: number;
  metadata: {
    parseTimeMs: number;
    modelUsed: string;
    tokensUsed: number;
  };
}

interface IntentClassification {
  type: 'query' | 'command' | 'objective' | 'conversation';
  confidence: number;
  alternatives: Array<{ type: string; confidence: number }>;
}

type EntityType = 'project' | 'agent' | 'file' | 'operation' | 'deadline' | 'priority';

interface ExtractedEntity {
  type: EntityType;
  value: string;
  startIndex: number;
  endIndex: number;
  confidence: number;
  normalized?: string;
}

interface EntityMap {
  projects?: ExtractedEntity[];
  agents?: ExtractedEntity[];
  files?: ExtractedEntity[];
  operations?: ExtractedEntity[];
  deadlines?: ExtractedEntity[];
  priorities?: ExtractedEntity[];
}
```

---

### 2. Context Engine API

```typescript
// Interface
interface ContextEngineAPI {
  /**
   * Load project context by ID
   * @param projectId Project identifier
   * @returns Full project context
   */
  loadProject(projectId: string): Promise<ProjectContext>;
  
  /**
   * Load business context for owner
   * @param ownerId Owner identifier
   * @returns Business context
   */
  loadBusinessContext(ownerId: string): Promise<BusinessContext>;
  
  /**
   * Load or create conversation context
   * @param conversationId Conversation identifier
   * @returns Conversation context
   */
  loadConversation(conversationId: string): Promise<ConversationContext>;
  
  /**
   * Search knowledge base
   * @param query Search query
   * @param filters Optional filters
   * @returns Search results
   */
  search(
    query: string, 
    filters?: SearchFilters
  ): Promise<SearchResult[]>;
  
  /**
   * Update context entity
   * @param entityType Type of entity
   * @param entityId Entity identifier
   * @param data Updated data
   */
  update(
    entityType: 'project' | 'objective' | 'conversation',
    entityId: string,
    data: Partial<unknown>
  ): Promise<void>;
  
  /**
   * Invalidate cache for entity
   * @param entityType Type of entity
   * @param entityId Entity identifier
   */
  invalidate(
    entityType: 'project' | 'agent' | 'task',
    entityId: string
  ): Promise<void>;
  
  /**
   * Get related entities
   * @param entityType Source entity type
   * @param entityId Source entity ID
   * @param relationType Type of relationship
   * @returns Related entities
   */
  getRelated(
    entityType: string,
    entityId: string,
    relationType: string
  ): Promise<RelatedEntity[]>;
}

// Types
interface ProjectContext {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'paused' | 'completed';
  goals: string[];
  constraints: string[];
  relatedFiles: string[];
  recentActivity: Activity[];
  openTasks: TaskSummary[];
  completedTasks: TaskSummary[];
  agents: AgentSummary[];
  metadata: {
    lastSyncedAt: number;
    missionControlProjectId?: number;
  };
}

interface BusinessContext {
  id: string;
  ownerId: string;
  name: string;
  preferences: {
    communicationStyle: 'concise' | 'detailed' | 'technical';
    workingHours: {
      start: string; // "09:00"
      end: string;   // "17:00"
      timezone: string; // "America/Chicago"
    };
    approvalThresholds: Record<string, number>;
    notificationPreferences: NotificationPreferences;
  };
  constraints: {
    budget?: number;
    deadlines: Date[];
    technicalLimitations: string[];
  };
  relationships: {
    projects: string[];
    agents: string[];
    integrations: string[];
  };
}

interface ConversationContext {
  id: string;
  ownerId: string;
  startedAt: number;
  lastMessageAt: number;
  messages: Message[];
  currentObjective?: string;
  pendingTasks: string[];
  resolvedAmbiguities: Record<string, string>;
  contextSnapshot: {
    projects: string[];
    activeObjectives: string[];
  };
}

interface SearchFilters {
  entityTypes?: string[];
  dateRange?: { start: Date; end: Date };
  projectId?: string;
  limit?: number;
}

interface SearchResult {
  entityType: string;
  entityId: string;
  title: string;
  excerpt: string;
  relevanceScore: number;
  metadata: Record<string, unknown>;
}
```

---

### 3. Prioritizer API

```typescript
// Interface
interface PrioritizerAPI {
  /**
   * Calculate priority score for objective
   * @param objective Objective to score
   * @param context Current context
   * @returns Priority score with breakdown
   */
  calculate(
    objective: Objective,
    context?: PriorityContext
  ): Promise<PriorityScore>;
  
  /**
   * Rank multiple objectives
   * @param objectives Array of objectives
   * @returns Objectives sorted by priority (highest first)
   */
  rank(objectives: Objective[]): Promise<RankedObjective[]>;
  
  /**
   * Update priority weights
   * @param weights New weight configuration
   */
  configureWeights(weights: PriorityWeights): Promise<void>;
  
  /**
   * Get current priority queue
   * @param limit Maximum items to return
   * @returns Prioritized list of pending objectives
   */
  getQueue(limit?: number): Promise<RankedObjective[]>;
  
  /**
   * Recalculate priorities (e.g., after context change)
   */
  recalculateAll(): Promise<void>;
}

// Types
interface Objective {
  id: string;
  rawText: string;
  parsedIntent: ParsedIntent;
  deadline?: Date;
  businessValue: number; // 1-10
  estimatedHours: number;
  complexity: 'low' | 'medium' | 'high';
  requiredSkills: string[];
  blockers: string[];
  blocking: string[];
  createdAt: Date;
  source: 'user' | 'system' | 'scheduled';
}

interface PriorityScore {
  objectiveId: string;
  totalScore: number; // 0-100
  breakdown: {
    urgency: number;
    impact: number;
    effort: number;
    dependencies: number;
    resources: number;
  };
  reasoning: string;
  calculatedAt: number;
}

interface RankedObjective {
  objective: Objective;
  score: PriorityScore;
  rank: number;
}

interface PriorityWeights {
  urgency: number;      // Default: 0.30
  impact: number;       // Default: 0.25
  effort: number;       // Default: 0.20
  dependencies: number; // Default: 0.15
  resources: number;    // Default: 0.10
}

interface PriorityContext {
  currentLoad: number; // Current active tasks
  availableAgents: string[];
  businessHours: boolean;
  recentFailures: number;
}
```

---

### 4. Planner API

```typescript
// Interface
interface PlannerAPI {
  /**
   * Create execution plan for objective
   * @param objective Objective to plan
   * @param context Project/business context
   * @returns Execution plan with tasks
   */
  createPlan(
    objective: Objective,
    context: PlanningContext
  ): Promise<ExecutionPlan>;
  
  /**
   * Estimate effort for objective
   * @param objective Objective to estimate
   * @returns Effort estimate with confidence
   */
  estimateEffort(objective: Objective): Promise<EffortEstimate>;
  
  /**
   * Identify dependencies between tasks
   * @param tasks Array of planned tasks
   * @returns Tasks with dependencies resolved
   */
  resolveDependencies(tasks: PlannedTask[]): Promise<PlannedTask[]>;
  
  /**
   * Optimize task order for parallel execution
   * @param tasks Array of tasks
   * @returns Optimized execution order
   */
  optimizeOrder(tasks: PlannedTask[]): Promise<PlannedTask[]>;
  
  /**
   * Validate plan feasibility
   * @param plan Execution plan
   * @returns Validation result with issues
   */
  validate(plan: ExecutionPlan): Promise<PlanValidation>;
}

// Types
interface ExecutionPlan {
  id: string;
  objectiveId: string;
  tasks: PlannedTask[];
  strategy: 'sequential' | 'parallel' | 'phased';
  phases?: PlanPhase[];
  estimatedTotalHours: number;
  criticalPath: string[]; // Task IDs
  risks: Risk[];
  createdAt: number;
}

interface PlannedTask {
  id: string;
  objectiveId: string;
  sequenceOrder: number;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  assignedTo: string; // Agent ID or role
  estimatedHours: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dependencies: string[]; // Task IDs
  tags: string[];
  metadata: {
    projectId?: string;
    category?: string;
    skillsRequired?: string[];
    approvalLevel?: number;
  };
}

interface PlanPhase {
  id: string;
  name: string;
  description: string;
  tasks: string[]; // Task IDs
  milestone?: string;
}

interface PlanningContext {
  project: ProjectContext;
  business: BusinessContext;
  availableAgents: AgentSummary[];
  constraints: string[];
}

interface EffortEstimate {
  minHours: number;
  maxHours: number;
  expectedHours: number;
  confidence: number; // 0-1
  factors: string[];
}

interface Risk {
  type: string;
  description: string;
  probability: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  mitigation?: string;
}

interface PlanValidation {
  valid: boolean;
  issues: PlanIssue[];
  warnings: PlanWarning[];
}

interface PlanIssue {
  type: 'dependency_cycle' | 'missing_agent' | 'constraint_violation';
  description: string;
  affectedTasks: string[];
}

interface PlanWarning {
  type: 'high_effort' | 'tight_deadline' | 'skill_gap';
  description: string;
  suggestion: string;
}
```

---

### 5. Monitor API

```typescript
// Interface
interface MonitorAPI {
  /**
   * Start monitoring task
   * @param taskId Mission Control task ID
   */
  watchTask(taskId: number): Promise<void>;
  
  /**
   * Stop monitoring task
   * @param taskId Mission Control task ID
   */
  unwatchTask(taskId: number): Promise<void>;
  
  /**
   * Get current status of monitored tasks
   * @returns Status map
   */
  getStatus(): Promise<Map<number, TaskStatus>>;
  
  /**
   * Get task history
   * @param taskId Mission Control task ID
   * @returns Status history
   */
  getHistory(taskId: number): Promise<StatusHistoryEntry[]>;
  
  /**
   * Check for blocked tasks
   * @returns List of blocked tasks with reasons
   */
  checkBlockers(): Promise<BlockedTask[]>;
  
  /**
   * Get agent availability
   * @returns Map of agent IDs to availability status
   */
  getAgentAvailability(): Promise<Map<string, AgentAvailability>>;
  
  /**
   * Subscribe to status changes
   * @param callback Function to call on status change
   * @returns Unsubscribe function
   */
  subscribe(callback: StatusChangeCallback): () => void;
}

// Types
interface TaskStatus {
  taskId: number;
  missionControlId: number;
  status: 'pending' | 'queued' | 'in_progress' | 'completed' | 'failed' | 'blocked';
  assignedAgent?: string;
  progress?: number; // 0-100
  startedAt?: number;
  completedAt?: number;
  outcome?: 'success' | 'failed' | 'partial' | 'abandoned';
  errorMessage?: string;
  lastUpdated: number;
}

interface StatusHistoryEntry {
  status: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

interface BlockedTask {
  taskId: number;
  reason: string;
  blockedAt: number;
  suggestedAction?: string;
}

interface AgentAvailability {
  agentId: string;
  status: 'available' | 'busy' | 'offline' | 'error';
  currentTask?: number;
  lastSeen: number;
  skills: string[];
}

type StatusChangeCallback = (event: StatusChangeEvent) => void;

interface StatusChangeEvent {
  taskId: number;
  previousStatus: string;
  currentStatus: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}
```

---

### 6. Notification Handler API

```typescript
// Interface
interface NotificationHandlerAPI {
  /**
   * Process incoming event
   * @param event Event to process
   */
  handle(event: JarvisEvent): Promise<void>;
  
  /**
   * Send notification to user
   * @param notification Notification to send
   */
  notify(notification: Notification): Promise<void>;
  
  /**
   * Queue notification for batching
   * @param notification Notification to queue
   */
  queue(notification: Notification): Promise<void>;
  
  /**
   * Flush queued notifications
   */
  flush(): Promise<void>;
  
  /**
   * Register handler for event type
   * @param eventType Event type
   * @param handler Handler function
   */
  on<T extends JarvisEvent>(
    eventType: T['type'],
    handler: (event: T) => Promise<void>
  ): void;
  
  /**
   * Get pending notifications
   * @returns Queue of pending notifications
   */
  getPending(): Promise<Notification[]>;
}

// Types
type JarvisEvent =
  | TaskCreatedEvent
  | TaskCompletedEvent
  | TaskFailedEvent
  | TaskBlockedEvent
  | AgentStatusEvent
  | IntentParsedEvent
  | ObjectivePlannedEvent
  | PriorityUpdatedEvent
  | ApprovalRequiredEvent
  | ApprovalGrantedEvent
  | ApprovalRejectedEvent;

interface TaskCompletedEvent {
  type: 'task.completed';
  taskId: number;
  objectiveId: string;
  outcome: 'success' | 'failed' | 'partial';
  result?: unknown;
  completedAt: number;
}

interface TaskFailedEvent {
  type: 'task.failed';
  taskId: number;
  objectiveId: string;
  error: string;
  retryable: boolean;
  failedAt: number;
}

interface TaskBlockedEvent {
  type: 'task.blocked';
  taskId: number;
  objectiveId: string;
  reason: string;
  blockedAt: number;
}

interface ApprovalRequiredEvent {
  type: 'approval.required';
  taskId: number;
  objectiveId: string;
  level: number;
  operations: string[];
}

interface Notification {
  id: string;
  type: 'confirmation' | 'progress' | 'completion' | 'failure' | 'blocker' | 'escalation' | 'approval_request';
  recipient: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  message: string;
  actions?: NotificationAction[];
  metadata?: Record<string, unknown>;
  createdAt: number;
}

interface NotificationAction {
  id: string;
  label: string;
  type: 'button' | 'link';
  action: string;
  data?: Record<string, unknown>;
}
```

---

### 7. Mission Control Client API

```typescript
// Interface
interface MissionControlClientAPI {
  // Tasks
  createTask(task: CreateTaskRequest): Promise<Task>;
  getTask(taskId: number): Promise<Task>;
  updateTask(taskId: number, updates: Partial<Task>): Promise<Task>;
  listTasks(filters?: TaskFilters): Promise<Task[]>;
  
  // Agents
  listAgents(): Promise<Agent[]>;
  getAgent(agentId: number): Promise<Agent>;
  
  // Activities
  listActivities(filters?: ActivityFilters): Promise<Activity[]>;
  
  // Notifications
  listNotifications(): Promise<Notification[]>;
  markNotificationRead(notificationId: number): Promise<void>;
  
  // WebSocket
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  onEvent(callback: (event: MissionControlEvent) => void): void;
  
  // Health
  healthCheck(): Promise<HealthStatus>;
}

// Types (subset of Mission Control API)
interface CreateTaskRequest {
  title: string;
  description?: string;
  status?: 'backlog' | 'inbox' | 'assigned' | 'in_progress' | 'review' | 'done';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  assigned_to?: string;
  project_id?: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

interface Task {
  id: number;
  title: string;
  description?: string;
  status: string;
  priority: string;
  assigned_to?: string;
  created_at: number;
  updated_at: number;
  completed_at?: number;
  outcome?: string;
  error_message?: string;
}

interface TaskFilters {
  status?: string[];
  assigned_to?: string;
  project_id?: number;
  limit?: number;
  offset?: number;
}

interface Agent {
  id: number;
  name: string;
  role: string;
  status: 'offline' | 'idle' | 'busy' | 'error';
  last_seen?: number;
}

interface Activity {
  id: number;
  type: string;
  entity_type: string;
  entity_id: number;
  actor: string;
  description: string;
  created_at: number;
}

type MissionControlEvent =
  | { type: 'task.created'; task: Task }
  | { type: 'task.updated'; task: Task }
  | { type: 'task.completed'; task: Task }
  | { type: 'agent.status_changed'; agent: Agent }
  | { type: 'activity.created'; activity: Activity };

interface HealthStatus {
  healthy: boolean;
  version: string;
  latency: number;
}
```

---

### 8. Approval Engine Client API

```typescript
// Interface
interface ApprovalEngineClientAPI {
  /**
   * Classify task for approval requirements
   * @param request Classification request
   * @returns Classification result
   */
  classify(request: ClassificationRequest): Promise<ClassificationResult>;
  
  /**
   * Check if operation requires approval
   * @param operation Operation to check
   * @returns Approval requirement
   */
  checkOperation(operation: string): Promise<ApprovalRequirement>;
  
  /**
   * Validate path against sandbox/protected lists
   * @param path File path to validate
   * @returns Path validation result
   */
  validatePath(path: string): Promise<PathValidation>;
  
  /**
   * Check for dangerous patterns
   * @param input Input to check
   * @returns Pattern match result
   */
  checkPatterns(input: string): Promise<PatternCheckResult>;
}

// Types
interface ClassificationRequest {
  intent: string;
  operations: string[];
  targetPaths: string[];
  estimatedImpact: 'none' | 'minimal' | 'moderate' | 'high' | 'critical';
}

interface ClassificationResult {
  state: 'AUTOMATIC' | 'APPROVAL_REQUIRED' | 'BLOCKED';
  level: number;
  reason?: string;
  operations: ClassifiedOperation[];
}

interface ClassifiedOperation {
  operation: string;
  level: number;
  autoEscalate?: boolean;
  reason?: string;
}

interface ApprovalRequirement {
  required: boolean;
  level?: number;
  timeout?: number;
  explicit?: boolean;
}

interface PathValidation {
  valid: boolean;
  inSandbox: boolean;
  isProtected: boolean;
  reason?: string;
}

interface PatternCheckResult {
  safe: boolean;
  matches: PatternMatch[];
}

interface PatternMatch {
  pattern: string;
  type: 'dangerous' | 'escalation';
  position: number;
}
```

---

## Event Bus API

```typescript
// Interface
interface EventBus {
  /**
   * Publish event to bus
   * @param event Event to publish
   */
  publish<T extends JarvisEvent>(event: T): void;
  
  /**
   * Subscribe to events
   * @param eventType Event type filter (or '*' for all)
   * @param handler Event handler
   * @returns Unsubscribe function
   */
  subscribe<T extends JarvisEvent>(
    eventType: T['type'] | '*',
    handler: (event: T) => void
  ): () => void;
  
  /**
   * Subscribe once to event type
   * @param eventType Event type
   * @param handler Event handler
   */
  once<T extends JarvisEvent>(
    eventType: T['type'],
    handler: (event: T) => void
  ): void;
  
  /**
   * Wait for specific event
   * @param eventType Event type
   * @param timeoutMs Timeout in milliseconds
   * @returns Promise that resolves with event
   */
  waitFor<T extends JarvisEvent>(
    eventType: T['type'],
    timeoutMs?: number
  ): Promise<T>;
}
```

---

## Database API

```typescript
// Interface
interface DatabaseAPI {
  // Objectives
  createObjective(objective: CreateObjectiveInput): Promise<Objective>;
  getObjective(id: string): Promise<Objective | null>;
  updateObjective(id: string, updates: Partial<Objective>): Promise<Objective>;
  listObjectives(filters?: ObjectiveFilters): Promise<Objective[]>;
  
  // Task Mappings
  createTaskMapping(mapping: CreateTaskMappingInput): Promise<TaskMapping>;
  getTaskMappings(objectiveId: string): Promise<TaskMapping[]>;
  
  // Projects
  createProject(project: CreateProjectInput): Promise<Project>;
  getProject(id: string): Promise<Project | null>;
  updateProject(id: string, updates: Partial<Project>): Promise<Project>;
  
  // Conversations
  createConversation(input: CreateConversationInput): Promise<Conversation>;
  getConversation(id: string): Promise<Conversation | null>;
  addMessage(conversationId: string, message: MessageInput): Promise<Message>;
  
  // Events
  logEvent(event: EventInput): Promise<Event>;
  getEvents(filters?: EventFilters): Promise<Event[]>;
}

// Types
interface CreateObjectiveInput {
  rawText: string;
  parsedIntent: ParsedIntent;
  ownerId: string;
  conversationId?: string;
}

interface ObjectiveFilters {
  status?: string[];
  ownerId?: string;
  priority?: number;
  createdAfter?: number;
  limit?: number;
}

interface CreateTaskMappingInput {
  objectiveId: string;
  missionControlTaskId: number;
  sequenceOrder: number;
  dependencyOf?: string;
}

interface CreateProjectInput {
  name: string;
  description?: string;
  missionControlProjectId?: number;
}

interface CreateConversationInput {
  ownerId: string;
  contextSnapshot: Record<string, unknown>;
}

interface MessageInput {
  role: 'user' | 'jarvis' | 'system';
  content: string;
  metadata?: Record<string, unknown>;
}

interface EventInput {
  type: string;
  source: string;
  payload: Record<string, unknown>;
}

interface EventFilters {
  type?: string[];
  source?: string[];
  processed?: boolean;
  after?: number;
  limit?: number;
}
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-06-28 | Initial internal API specification |

---

**END OF JARVIS CORE INTERNAL API SPECIFICATION**
