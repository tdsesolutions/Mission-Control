# Jarvis Core Architecture

**Phase 9: Jarvis Core Foundation**  
**Date:** 2026-06-28  
**Version:** 1.0  
**Status:** Specification

---

## Executive Summary

Jarvis Core is the executive orchestration service that sits above Mission Control in the AI execution hierarchy. It is not a user interface, not a voice assistant, and not a replacement for OpenClaw. Jarvis Core is the strategic decision layer that understands projects, businesses, and priorities—and translates high-level intent into actionable tasks within the Mission Control framework.

---

## Purpose

Jarvis Core exists to:

1. **Understand Context** — Maintain deep knowledge of projects, businesses, and their relationships
2. **Prioritize Work** — Evaluate competing demands and determine execution order
3. **Create Tasks** — Transform high-level objectives into specific, actionable Mission Control tasks
4. **Monitor Progress** — Track task status, agent activity, and completion notifications
5. **Respect Boundaries** — Never bypass Mission Control, Approval Engine, or OpenClaw Main

---

## Architecture Hierarchy

The execution pipeline maintains strict hierarchy:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         USER                                            │
│                    (Natural Language Intent)                            │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      JARVIS CORE                                        │
│              (Executive Orchestration Service)                          │
│                                                                         │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │
│  │   Context   │  │  Prioritizer │  │   Planner    │  │  Monitor    │  │
│  │   Engine    │  │              │  │              │  │             │  │
│  └─────────────┘  └──────────────┘  └──────────────┘  └─────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     MISSION CONTROL                                     │
│              (Task Management & Agent Orchestration)                    │
│                                                                         │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │
│  │ Task Queue  │  │    Agents    │  │   Activity   │  │   Chat      │  │
│  │             │  │              │  │   Stream     │  │             │  │
│  └─────────────┘  └──────────────┘  └──────────────┘  └─────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    APPROVAL ENGINE                                      │
│              (Authorization & Safety Gate)                              │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     GATEWAY                                             │
│              (OpenClaw WebSocket Bridge)                                │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                   OPENCLAW MAIN                                         │
│              (Primary Agent Router)                                     │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                EXISTING ROUTING                                         │
│       (Department Agents, Skills, Tools)                                │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Responsibilities

### What Jarvis Core Does

| Responsibility | Description |
|----------------|-------------|
| **Context Management** | Maintains project memory, business context, and relationship mappings |
| **Intent Parsing** | Translates natural language into structured objectives |
| **Task Planning** | Breaks objectives into discrete, executable tasks |
| **Priority Scoring** | Evaluates urgency, impact, dependencies, and resources |
| **Agent Selection** | Determines which agent(s) should handle each task |
| **Status Monitoring** | Polls Mission Control for task completions and blockers |
| **Notification Handling** | Receives and processes completion/failure notifications |
| **Escalation** | Elevates blocked tasks or complex decisions to owner |

### What Jarvis Core Does NOT Do

| Out of Scope | Rationale |
|--------------|-----------|
| Voice Interface | Future Phase 10+ interface layer |
| Telegram Bot | Future Phase 10+ interface layer |
| Computer Control | Future Phase 11+ automation layer |
| Browser Automation | Future Phase 11+ automation layer |
| Direct OpenClaw Calls | Must route through Mission Control |
| Bypass Approval Engine | Safety gates are non-negotiable |
| Autonomous Execution | All execution requires explicit task creation |

---

## Boundaries

### Hard Boundaries (Never Violated)

1. **Never bypass Mission Control** — All tasks must be created in Mission Control's task queue
2. **Never bypass Approval Engine** — All tasks must pass through approval classification
3. **Never bypass OpenClaw Main** — All execution must route through the established Gateway → OpenClaw Main pipeline
4. **Never modify OpenClaw** — Jarvis Core is a consumer, not a modifier
5. **Never modify Mission Control** — Jarvis Core uses Mission Control APIs, does not change its code
6. **Never create external interfaces** — No APIs, webhooks, or public endpoints

### Soft Boundaries (Internal Only)

1. **Internal State** — Jarvis Core maintains its own context database
2. **Internal APIs** — Service-to-service communication within Jarvis Core modules
3. **Read-Only Access** — Extensive read access to Mission Control status, tasks, agents

---

## Data Flow

### Request Flow (User → Execution)

```
1. User submits natural language request
   ↓
2. Jarvis Core parses intent and extracts context
   ↓
3. Context Engine loads relevant project/business data
   ↓
4. Prioritizer scores urgency and importance
   ↓
5. Planner decomposes into specific tasks
   ↓
6. Each task submitted to Mission Control API
   ↓
7. Mission Control routes to Approval Engine
   ↓
8. Approval Engine classifies (Level 0-4)
   ↓
9. Automatic tasks execute immediately
   Approval-required tasks await owner decision
   Blocked tasks are rejected
   ↓
10. Gateway delivers approved tasks to OpenClaw Main
   ↓
11. OpenClaw Main routes to appropriate department agents
   ↓
12. Results flow back up the chain
```

### Notification Flow (Completion → User)

```
1. Agent completes task in OpenClaw
   ↓
2. OpenClaw Main reports completion to Gateway
   ↓
3. Gateway notifies Mission Control
   ↓
4. Mission Control updates task status
   ↓
5. Mission Control emits notification event
   ↓
6. Jarvis Core receives notification via WebSocket
   ↓
7. Jarvis Core updates internal context
   ↓
8. Jarvis Core determines if follow-up actions needed
   ↓
9. User notified of completion (via future interface layer)
```

---

## Interaction with Mission Control

### Read Operations (Continuous)

| Endpoint | Purpose | Frequency |
|----------|---------|-----------|
| `GET /api/tasks` | Task status monitoring | Every 30s |
| `GET /api/agents` | Agent availability | Every 60s |
| `GET /api/activities` | Activity stream | Real-time (SSE) |
| `GET /api/notifications` | Completion alerts | Real-time (SSE) |
| `GET /api/standup` | Daily summaries | On demand |

### Write Operations (Task Creation)

| Endpoint | Purpose | When Used |
|----------|---------|-----------|
| `POST /api/tasks` | Create new task | After planning |
| `PATCH /api/tasks/:id` | Update task | Status changes |
| `POST /api/chat` | Agent coordination | Multi-agent tasks |

### Event Subscriptions (WebSocket)

| Event | Handler |
|-------|---------|
| `task.completed` | Update context, trigger follow-ups |
| `task.failed` | Escalate to owner, log for analysis |
| `task.blocked` | Notify owner, suggest alternatives |
| `agent.status_changed` | Update agent availability map |
| `activity.created` | Update project activity log |

---

## Interaction with Approval Engine

### Classification Query

Before creating any task, Jarvis Core queries the Approval Engine:

```typescript
// Pseudo-code
const classification = await approvalEngine.classify({
  intent: userIntent,
  operations: extractedOperations,
  targetPaths: targetResources,
  estimatedImpact: impactAssessment
});

if (classification.state === 'BLOCKED') {
  // Explain to user why task cannot proceed
  return explainBlock(classification.reason);
}

if (classification.state === 'APPROVAL_REQUIRED') {
  // Create task with pending_approval status
  // Mission Control will notify owner
  return createPendingTask(task, classification.level);
}

// AUTOMATIC — proceed with task creation
return createAndQueueTask(task);
```

### Respect for Decisions

Jarvis Core never:
- Overrides approval decisions
- Retries blocked operations automatically
- Circumvents approval requirements
- Masks the approval process from users

---

## Interaction with OpenClaw

### Indirect Only

Jarvis Core **never** communicates directly with OpenClaw. All communication flows:

```
Jarvis Core → Mission Control → Gateway → OpenClaw Main
```

This ensures:
- Approval Engine always engaged
- Task tracking maintained
- Audit trail complete
- Safety boundaries preserved

### Status Monitoring

Jarvis Core monitors OpenClaw status **through Mission Control**:

- Session health via Mission Control's `/api/sessions`
- Gateway connectivity via Mission Control's connection status
- Agent activity via Mission Control's activity stream

---

## State Management

### Persistent State (Database)

| Entity | Description |
|--------|-------------|
| `projects` | Project definitions, goals, status |
| `business_context` | Business rules, preferences, constraints |
| `conversations` | User conversation history |
| `objectives` | High-level goals decomposed into tasks |
| `task_mappings` | Links between Jarvis objectives and MC tasks |

### Ephemeral State (Memory)

| Entity | Description |
|--------|-------------|
| `session_context` | Current conversation context |
| `agent_availability` | Real-time agent status cache |
| `pending_notifications` | Queue of unprocessed events |
| `priority_queue` | Scored list of pending objectives |

---

## Security Model

### Authentication

Jarvis Core authenticates to Mission Control using:
- API Key (server-to-server)
- JWT tokens (if user-impersonation required)

### Authorization

Jarvis Core operates with these constraints:
- Read access: All Mission Control data
- Write access: Task creation only
- No access: System configuration, user management

### Audit

All Jarvis Core actions logged:
- Intent parsed
- Decisions made
- Tasks created
- Classifications requested
- Notifications received

---

## Error Handling

### Graceful Degradation

| Failure Mode | Response |
|--------------|----------|
| Mission Control unavailable | Queue requests, retry with backoff |
| Approval Engine timeout | Treat as approval required |
| Gateway disconnect | Wait for reconnect, preserve state |
| Classification ambiguous | Escalate to owner for clarification |
| Task creation fails | Log error, notify user, suggest retry |

### Recovery Strategy

1. **State Persistence** — All pending work persisted to database
2. **Idempotent Operations** — Task creation safe to retry
3. **Circuit Breakers** — Back off from failing services
4. **Owner Escalation** — Complex failures routed to human

---

## Future Integration Points

### Phase 10: Interface Layer

Jarvis Core will expose internal APIs for:
- Voice interface (speech-to-intent)
- Telegram bot (message-to-intent)
- Web dashboard (click-to-intent)

### Phase 11: Automation Layer

Jarvis Core may receive events from:
- Scheduled triggers (cron-based objectives)
- External webhooks (GitHub, monitoring alerts)
- System events (disk full, errors detected)

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Intent parsing accuracy | >90% |
| Task decomposition quality | Owner approval rate >80% |
| Priority alignment | Owner reprioritization <20% |
| Response latency | <2s for simple requests |
| Escalation rate | <10% of requests |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-06-28 | Initial architecture specification |

---

**END OF JARVIS CORE ARCHITECTURE**
