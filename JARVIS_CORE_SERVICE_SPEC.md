# Jarvis Core Service Specification

**Phase 9: Jarvis Core Foundation**  
**Date:** 2026-06-28  
**Version:** 1.0  
**Status:** Specification

---

## Overview

This document specifies the internal service architecture of Jarvis Core. It defines the modules, event flows, lifecycles, and operational characteristics of the executive orchestration service.

---

## Service Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         JARVIS CORE SERVICE                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     API LAYER (Internal)                        │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐   │   │
│  │  │   Intent    │  │   Context    │  │     Task Control     │   │   │
│  │  │    API      │  │     API      │  │        API           │   │   │
│  │  └─────────────┘  └──────────────┘  └──────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    CORE MODULES                                 │   │
│  │                                                                 │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │   │
│  │  │    Intent    │  │    Context   │  │     Prioritizer      │  │   │
│  │  │    Parser    │  │    Engine    │  │                      │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────────┘  │   │
│  │                                                                 │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │   │
│  │  │    Planner   │  │   Monitor    │  │   Notification       │  │   │
│  │  │              │  │              │  │   Handler            │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────────┘  │   │
│  │                                                                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                  INTEGRATION LAYER                              │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │   │
│  │  │   Mission    │  │   Approval   │  │   State Persistence  │  │   │
│  │  │   Control    │  │   Engine     │  │                      │  │   │
│  │  │   Client     │  │   Client     │  │   (Database)         │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────────┘  │   │
│  │                                                                 │   │
│  │  ┌──────────────┐  ┌──────────────┐                            │   │
│  │  │   Event      │  │   WebSocket  │                            │   │
│  │  │   Bus        │  │   Manager    │                            │   │
│  │  └──────────────┘  └──────────────┘                            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Module Specifications

### 1. Intent Parser Module

**Purpose:** Transform natural language into structured intent objects.

**Input:** Raw text (user request)
**Output:** Structured intent object

```typescript
interface ParsedIntent {
  id: string;
  rawText: string;
  timestamp: number;
  classification: {
    type: 'query' | 'command' | 'objective' | 'conversation';
    confidence: number;
  };
  entities: {
    projects?: string[];
    agents?: string[];
    files?: string[];
    operations?: string[];
    deadlines?: Date[];
    priorities?: ('low' | 'medium' | 'high' | 'urgent')[];
  };
  extracted: {
    action: string;
    target?: string;
    constraints?: string[];
    context?: string;
  };
}
```

**Processing Steps:**
1. Tokenization and entity extraction
2. Intent classification (query vs command vs objective)
3. Entity linking (resolve project names, agent references)
4. Context enrichment (add conversation history)
5. Confidence scoring

**Error Handling:**
- Low confidence (<0.7): Escalate to owner for clarification
- Ambiguous entities: Ask disambiguation question
- Unknown references: Search knowledge base or ask

---

### 2. Context Engine Module

**Purpose:** Maintain and retrieve contextual knowledge about projects, businesses, and history.

**Data Sources:**
- Jarvis Core database (projects, objectives, conversations)
- Mission Control API (tasks, agents, activities)
- File system (project directories, documentation)

**Context Types:**

```typescript
interface ProjectContext {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'paused' | 'completed';
  goals: string[];
  constraints: string[];
  relatedFiles: string[];
  recentActivity: Activity[];
  openTasks: Task[];
  completedTasks: Task[];
  agents: Agent[];
}

interface BusinessContext {
  id: string;
  name: string;
  preferences: {
    communicationStyle: string;
    workingHours: { start: string; end: string; timezone: string };
    approvalThresholds: Record<string, number>;
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
  messages: Message[];
  currentObjective?: string;
  pendingTasks: string[];
  resolvedAmbiguities: Record<string, string>;
}
```

**Operations:**
- `loadProjectContext(projectId): ProjectContext`
- `loadBusinessContext(): BusinessContext`
- `loadConversationContext(conversationId): ConversationContext`
- `updateContext(entity, data): void`
- `searchKnowledge(query): SearchResult[]`

---

### 3. Prioritizer Module

**Purpose:** Score and rank objectives based on multiple factors.

**Scoring Factors:**

| Factor | Weight | Description |
|--------|--------|-------------|
| Urgency | 30% | Time sensitivity, deadlines |
| Impact | 25% | Business value, strategic importance |
| Effort | 20% | Estimated time/complexity |
| Dependencies | 15% | Blocked by or blocking other work |
| Resources | 10% | Agent availability, skills match |

**Scoring Algorithm:**

```typescript
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
  rank: number;
  reasoning: string;
}

function calculatePriority(objective: Objective): PriorityScore {
  const urgency = calculateUrgency(objective.deadline, objective.createdAt);
  const impact = calculateImpact(objective.businessValue, objective.strategicAlignment);
  const effort = calculateEffort(objective.estimatedHours, objective.complexity);
  const dependencies = calculateDependencyScore(objective.blockers, objective.blocking);
  const resources = calculateResourceAvailability(objective.requiredSkills);
  
  const totalScore = (
    urgency * 0.30 +
    impact * 0.25 +
    (100 - effort) * 0.20 + // Lower effort = higher score
    dependencies * 0.15 +
    resources * 0.10
  );
  
  return {
    objectiveId: objective.id,
    totalScore,
    breakdown: { urgency, impact, effort, dependencies, resources },
    rank: 0, // Set after sorting
    reasoning: generateReasoning(urgency, impact, effort, dependencies, resources)
  };
}
```

---

### 4. Planner Module

**Purpose:** Decompose high-level objectives into executable tasks.

**Planning Process:**

```
Objective: "Build a user authentication system"
    ↓
[Planner analyzes objective]
    ↓
Sub-objectives:
  1. Design authentication flow
  2. Implement login API
  3. Create login UI
  4. Add password reset
  5. Write tests
    ↓
[Each sub-objective becomes a Mission Control task]
```

**Task Template:**

```typescript
interface PlannedTask {
  id: string;
  objectiveId: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  assignedTo: string; // Agent ID or role
  estimatedHours: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dependencies: string[]; // Task IDs that must complete first
  tags: string[];
  metadata: {
    projectId?: string;
    category?: string;
    skillsRequired?: string[];
  };
}
```

**Planning Strategies:**
- **Sequential:** Tasks execute in order (dependencies required)
- **Parallel:** Independent tasks execute simultaneously
- **Phased:** Groups of tasks form milestones

---

### 5. Monitor Module

**Purpose:** Track task execution status and detect completion/blockage.

**Polling Strategy:**

| Data Type | Frequency | Endpoint |
|-----------|-----------|----------|
| Task status | 30 seconds | `GET /api/tasks` |
| Agent status | 60 seconds | `GET /api/agents` |
| Activities | Real-time | WebSocket SSE |
| Notifications | Real-time | WebSocket SSE |

**Status Tracking:**

```typescript
interface TaskStatus {
  taskId: number;
  missionControlId: number;
  status: 'pending' | 'queued' | 'in_progress' | 'completed' | 'failed' | 'blocked';
  assignedAgent?: string;
  progress?: number;
  startedAt?: number;
  completedAt?: number;
  outcome?: 'success' | 'failed' | 'partial' | 'abandoned';
  errorMessage?: string;
}

interface MonitoringState {
  activeTasks: Map<number, TaskStatus>;
  completedToday: TaskStatus[];
  blockedTasks: TaskStatus[];
  agentAvailability: Map<string, AgentStatus>;
}
```

**Alert Conditions:**
- Task failed → Escalate to owner
- Task blocked > 1 hour → Notify owner
- Agent offline > 5 minutes → Mark unavailable
- Multiple failures → Pattern detection, suggest investigation

---

### 6. Notification Handler Module

**Purpose:** Process events from Mission Control and trigger appropriate responses.

**Event Types:**

| Event | Source | Handler |
|-------|--------|---------|
| `task.completed` | Mission Control | Update context, check for follow-ups |
| `task.failed` | Mission Control | Escalate, log error, suggest retry |
| `task.blocked` | Mission Control | Notify owner, analyze blocker |
| `agent.status_changed` | Mission Control | Update availability map |
| `approval.required` | Approval Engine | Queue for owner attention |
| `approval.granted` | Approval Engine | Proceed with execution |

**Notification Processing:**

```typescript
interface NotificationHandler {
  onTaskCompleted(event: TaskCompletedEvent): void;
  onTaskFailed(event: TaskFailedEvent): void;
  onTaskBlocked(event: TaskBlockedEvent): void;
  onAgentStatusChanged(event: AgentStatusEvent): void;
  onApprovalRequired(event: ApprovalRequiredEvent): void;
  onApprovalGranted(event: ApprovalGrantedEvent): void;
}
```

---

## Event Flow

### Event Bus Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        EVENT BUS                                │
│                   (Pub/Sub Pattern)                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Publishers:                                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Mission Ctrl │  │  Jarvis Core │  │   Approval Engine    │  │
│  │   WebSocket  │  │   Modules    │  │      Client          │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                                                                 │
│  Subscribers:                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   Monitor    │  │ Notification │  │   Context Engine     │  │
│  │              │  │   Handler    │  │                      │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Event Types

```typescript
// Mission Control Events
interface TaskCreatedEvent { type: 'task.created'; taskId: number; }
interface TaskCompletedEvent { type: 'task.completed'; taskId: number; outcome: string; }
interface TaskFailedEvent { type: 'task.failed'; taskId: number; error: string; }
interface TaskBlockedEvent { type: 'task.blocked'; taskId: number; reason: string; }
interface AgentStatusEvent { type: 'agent.status_changed'; agentId: number; status: string; }

// Jarvis Core Internal Events
interface IntentParsedEvent { type: 'intent.parsed'; intentId: string; }
interface ObjectivePlannedEvent { type: 'objective.planned'; objectiveId: string; taskCount: number; }
interface PriorityUpdatedEvent { type: 'priority.updated'; objectiveId: string; newScore: number; }

// Approval Engine Events
interface ApprovalRequiredEvent { type: 'approval.required'; taskId: number; level: number; }
interface ApprovalGrantedEvent { type: 'approval.granted'; taskId: number; }
interface ApprovalRejectedEvent { type: 'approval.rejected'; taskId: number; reason: string; }

type JarvisEvent = 
  | TaskCreatedEvent | TaskCompletedEvent | TaskFailedEvent | TaskBlockedEvent
  | AgentStatusEvent | IntentParsedEvent | ObjectivePlannedEvent | PriorityUpdatedEvent
  | ApprovalRequiredEvent | ApprovalGrantedEvent | ApprovalRejectedEvent;
```

---

## Task Lifecycle

```
┌─────────┐    ┌──────────┐    ┌───────────┐    ┌──────────┐    ┌──────────┐
│ INTENT  │───▶│  PARSE   │───▶│  CONTEXT  │───▶│ PRIORITY │───▶│  PLAN    │
│ RECEIVED│    │          │    │   LOAD    │    │   SCORE  │    │          │
└─────────┘    └──────────┘    └───────────┘    └──────────┘    └────┬─────┘
                                                                      │
                                                                      ▼
┌─────────┐    ┌──────────┐    ┌───────────┐    ┌──────────┐    ┌──────────┐
│  NOTIFY │◀───│  HANDLE  │◀───│  EXECUTE  │◀───│ APPROVAL │◀───│  CREATE  │
│  USER   │    │  RESULT  │    │           │    │  CHECK   │    │   TASK   │
└─────────┘    └──────────┘    └───────────┘    └──────────┘    └──────────┘
```

### State Transitions

| State | Description | Next States |
|-------|-------------|-------------|
| `received` | Intent captured from user | `parsing` |
| `parsing` | NLP processing in progress | `context_loading`, `parse_failed` |
| `context_loading` | Retrieving relevant context | `scoring` |
| `scoring` | Calculating priority | `planning` |
| `planning` | Decomposing into tasks | `awaiting_approval`, `queued` |
| `awaiting_approval` | Waiting for owner approval | `queued`, `rejected` |
| `queued` | Tasks created in Mission Control | `executing` |
| `executing` | Agents working on tasks | `completed`, `failed`, `blocked` |
| `completed` | All tasks finished | `notifying` |
| `failed` | Task execution failed | `escalating`, `retrying` |
| `blocked` | Task blocked (dependencies, etc.) | `escalating` |
| `notifying` | Sending completion to user | `done` |
| `done` | Lifecycle complete | — |

---

## Status Lifecycle

### Objective Status

```typescript
type ObjectiveStatus = 
  | 'draft'           // Created but not yet processed
  | 'analyzing'       // Intent parser working
  | 'planned'         // Tasks created, awaiting approval
  | 'approved'        // Approved, tasks queued
  | 'in_progress'     // At least one task executing
  | 'completed'       // All tasks completed successfully
  | 'partial'         // Some tasks completed, some failed
  | 'failed'          // All tasks failed or critical failure
  | 'blocked'         // Blocked awaiting owner intervention
  | 'cancelled';      // Cancelled by owner
```

### Status Transitions

```
draft → analyzing → planned → approved → in_progress ─┬─▶ completed
                                                      │
                                                      ├─▶ partial
                                                      │
                                                      └─▶ failed

planned → blocked (if approval rejected)
in_progress → blocked (if task blocked)
any → cancelled (owner action)
```

---

## Notification Lifecycle

### Notification Types

| Type | Trigger | Recipient | Content |
|------|---------|-----------|---------|
| `confirmation` | Objective received | User | Acknowledgment, estimated processing time |
| `approval_request` | Approval required | Owner | Task details, impact, approve/reject buttons |
| `progress` | Milestone reached | User | Completion percentage, what's next |
| `completion` | All tasks done | User | Summary, results, follow-up suggestions |
| `failure` | Task failed | User + Owner | Error details, retry options |
| `blocker` | Task blocked | Owner | Blocker description, resolution options |
| `escalation` | Complex issue | Owner | Context, recommended action |

### Notification Flow

```
Event Detected
      │
      ▼
┌─────────────┐
│  Format     │──▶ Generate human-readable message
│  Message    │
└─────────────┘
      │
      ▼
┌─────────────┐
│  Determine  │──▶ Select channel based on urgency/preferences
│  Channel    │
└─────────────┘
      │
      ▼
┌─────────────┐
│   Queue     │──▶ Add to notification queue
│             │
└─────────────┘
      │
      ▼
┌─────────────┐
│   Deliver   │──▶ Send via selected channel
│             │
└─────────────┘
      │
      ▼
┌─────────────┐
│   Confirm   │──▶ Track delivery status
│   Receipt   │
└─────────────┘
```

---

## Error Handling

### Error Categories

| Category | Examples | Response |
|----------|----------|----------|
| `parse_error` | Ambiguous intent, unknown entities | Ask clarification question |
| `context_error` | Missing project data, stale information | Refresh context, notify user |
| `planning_error` | Cannot decompose objective | Escalate to owner |
| `api_error` | Mission Control unavailable | Retry with backoff, queue request |
| `approval_error` | Classification timeout | Treat as approval required |
| `execution_error` | Task failed | Analyze error, suggest retry/alternative |
| `system_error` | Internal failure | Log, escalate, preserve state |

### Recovery Strategies

```typescript
interface ErrorRecovery {
  error: Error;
  category: ErrorCategory;
  retryable: boolean;
  maxRetries: number;
  backoffMs: number;
  fallbackAction: () => void;
  escalationRequired: boolean;
}

const recoveryStrategies: Record<ErrorCategory, ErrorRecovery> = {
  parse_error: {
    retryable: false,
    maxRetries: 0,
    backoffMs: 0,
    fallbackAction: askClarification,
    escalationRequired: false
  },
  api_error: {
    retryable: true,
    maxRetries: 3,
    backoffMs: 1000,
    fallbackAction: queueForLater,
    escalationRequired: false
  },
  execution_error: {
    retryable: true,
    maxRetries: 1,
    backoffMs: 5000,
    fallbackAction: suggestAlternative,
    escalationRequired: true
  },
  // ... etc
};
```

---

## Database Schema

### Core Tables

```sql
-- Objectives: High-level goals from users
CREATE TABLE objectives (
  id TEXT PRIMARY KEY,
  raw_text TEXT NOT NULL,
  parsed_intent JSONB,
  status TEXT NOT NULL DEFAULT 'draft',
  priority_score INTEGER,
  priority_reasoning TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  completed_at INTEGER,
  owner_id TEXT NOT NULL,
  conversation_id TEXT
);

-- Task Mappings: Link Jarvis objectives to Mission Control tasks
CREATE TABLE task_mappings (
  id TEXT PRIMARY KEY,
  objective_id TEXT NOT NULL REFERENCES objectives(id),
  mission_control_task_id INTEGER NOT NULL,
  sequence_order INTEGER NOT NULL,
  dependency_of TEXT, -- mapping_id of task that depends on this one
  created_at INTEGER NOT NULL
);

-- Projects: Project context cache
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL,
  goals JSONB,
  constraints JSONB,
  file_paths JSONB,
  mission_control_project_id INTEGER,
  last_synced_at INTEGER
);

-- Conversations: User conversation history
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  last_message_at INTEGER,
  context_snapshot JSONB -- Cached context at conversation start
);

-- Conversation Messages
CREATE TABLE conversation_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  role TEXT NOT NULL, -- 'user' | 'jarvis' | 'system'
  content TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  metadata JSONB
);

-- Events: Audit log of all Jarvis Core events
CREATE TABLE events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  source TEXT NOT NULL,
  payload JSONB,
  timestamp INTEGER NOT NULL,
  processed BOOLEAN DEFAULT FALSE
);
```

---

## Configuration

### Service Configuration

```typescript
interface JarvisCoreConfig {
  // Server
  port: number;
  host: string;
  
  // Mission Control Integration
  missionControl: {
    baseUrl: string;
    apiKey: string;
    websocketUrl: string;
    reconnectIntervalMs: number;
  };
  
  // Polling Intervals
  polling: {
    taskStatusMs: number;
    agentStatusMs: number;
    healthCheckMs: number;
  };
  
  // Prioritization
  prioritization: {
    weights: {
      urgency: number;
      impact: number;
      effort: number;
      dependencies: number;
      resources: number;
    };
    maxQueueSize: number;
  };
  
  // Error Handling
  errorHandling: {
    maxRetries: number;
    baseBackoffMs: number;
    maxBackoffMs: number;
  };
  
  // Logging
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    destination: 'console' | 'file' | 'both';
    retentionDays: number;
  };
}
```

---

## Deployment Model

### Service Topology

Jarvis Core runs as a **separate service** from Mission Control:

```
┌─────────────────────────────────────────────────────────────────┐
│                        HOST MACHINE                             │
│                                                                 │
│  ┌─────────────────────┐      ┌─────────────────────────────┐  │
│  │   Mission Control   │      │       Jarvis Core           │  │
│  │   (Port 3000)       │◀────▶│       (Port 4000)           │  │
│  │                     │      │                             │  │
│  │  - Next.js app      │      │  - Node.js service          │  │
│  │  - SQLite database  │      │  - SQLite database          │  │
│  │  - WebSocket server │      │  - WebSocket client         │  │
│  └─────────────────────┘      └─────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Startup Sequence

1. **Mission Control must start first** (dependency)
2. Jarvis Core connects to Mission Control WebSocket
3. Jarvis Core initializes context cache
4. Jarvis Core begins polling loops
5. Service ready to receive intents

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-06-28 | Initial service specification |

---

**END OF JARVIS CORE SERVICE SPECIFICATION**
