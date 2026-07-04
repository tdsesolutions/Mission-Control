# Approval Engine

**Phase 8: Controlled Workflow Rules & Approval Gates**  
**Date:** 2026-06-27  
**Version:** 1.0  
**Status:** Specification

---

## Overview

The Approval Engine is Mission Control's final checkpoint before task execution. It determines whether a task should be:

- **Automatic** — Execute immediately
- **Approval Required** — Wait for owner approval
- **Blocked** — Prevent execution
- **Rejected** — Deny with explanation

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    APPROVAL ENGINE                              │
│                                                                 │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────────┐   │
│  │   Parser    │───▶│  Classifier  │───▶│   Decision       │   │
│  │             │    │              │    │   Engine         │   │
│  └─────────────┘    └──────────────┘    └──────────────────┘   │
│                                                │                │
│                    ┌───────────────────────────┼───────────┐    │
│                    ▼                           ▼           ▼    │
│              ┌─────────┐                ┌──────────┐  ┌────────┐│
│              │Automatic│                │ Approval │  │Blocked ││
│              │ Execute │                │ Required │  │        ││
│              └─────────┘                └──────────┘  └────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## Decision States

### AUTOMATIC

**Criteria:**
- Task classified as LEVEL 0 or LEVEL 1
- No protected resources accessed
- No escalation triggers matched
- Within sandbox boundaries (for LEVEL 1)

**Action:**
- Execute immediately
- Log execution
- Report results

**Notification:**
- Optional completion notification
- No approval notification required

---

### APPROVAL REQUIRED

**Criteria:**
- Task classified as LEVEL 2 or LEVEL 3
- Owner approval not yet received
- Task within allowed scope

**Action:**
- Queue task for approval
- Notify owner
- Wait for decision
- On approval: execute
- On rejection: cancel with reason

**Notification:**
- Immediate approval request to owner
- Reminder after 24 hours (LEVEL 2)
- No reminder for LEVEL 3 (explicit each time)

**Timeout:**
- LEVEL 2: 24 hours (configurable)
- LEVEL 3: No timeout (requires explicit action)

---

### BLOCKED

**Criteria:**
- Task classified as LEVEL 4
- Dangerous pattern detected
- Protected resource targeted
- Sandbox escape attempt
- Path traversal detected

**Action:**
- Prevent execution
- Log block event
- Notify owner of blocked operation
- Provide explanation

**Notification:**
- Immediate block notification
- Reason for block
- Suggested alternatives if applicable

**Recovery:**
- Manual intervention required
- No automatic retry
- Owner can reclassify if appropriate

---

### REJECTED

**Criteria:**
- Owner explicitly rejected approval request
- Task scope violates policy
- Insufficient justification provided
- Risk assessment failed

**Action:**
- Cancel task
- Log rejection
- Notify requester (if not owner)
- Archive task record

**Notification:**
- Rejection confirmation to owner
- Reason for rejection
- Suggested modifications if applicable

---

## Classification Logic

### Step 1: Intent Parsing

Extract from natural language:
- Primary action (read, write, delete, execute)
- Target resources (files, directories, systems)
- Scope (sandbox, project, system, global)
- Operations list

### Step 2: Operation Mapping

Map extracted operations to approval levels:

```
Operation → Approval Level Mapping:

Read file → LEVEL 0
List directory → LEVEL 0
Search content → LEVEL 0
Generate report → LEVEL 0

Write to sandbox → LEVEL 1
Create in sandbox → LEVEL 1
Test in sandbox → LEVEL 1

Modify project file → LEVEL 2
Git commit → LEVEL 2
Build project → LEVEL 2
Install dependency → LEVEL 2

Change configuration → LEVEL 3
Modify shell profile → LEVEL 3
Global install → LEVEL 3
System change → LEVEL 3

Delete repository → LEVEL 4
Drop database → LEVEL 4
Factory reset → LEVEL 4
Delete project → LEVEL 4
```

### Step 3: Level Assignment

Task approval level = MAX(matched operation levels)

Example:
- Task: "Update the footer and commit changes"
- Operations: [modify file (LEVEL 2), git commit (LEVEL 2)]
- Task Level: LEVEL 2

### Step 4: Validation

Validate classification against rules:
- Path validation (sandbox, protected)
- Pattern matching (dangerous operations)
- Scope validation
- Bulk operation detection

### Step 5: Decision

Based on validated level:
- LEVEL 0-1 → AUTOMATIC
- LEVEL 2-3 → APPROVAL REQUIRED
- LEVEL 4 → BLOCKED

---

## Pattern Detection

### Dangerous Patterns (Auto-Block)

```javascript
const DANGEROUS_PATTERNS = [
  // Destructive
  /delete\s+(all|everything|repository|database)/i,
  /drop\s+(database|table|schema)/i,
  /factory\s+reset/i,
  /rm\s+-rf\s+\//i,
  /format\s+(drive|disk)/i,
  
  // Security
  /disable\s+firewall/i,
  /turn\s+off\s+security/i,
  /bypass\s+authentication/i,
  
  // System
  /delete\s+system/i,
  /remove\s+operating\s+system/i,
  /uninstall\s+everything/i
];
```

### Escalation Patterns

```javascript
const ESCALATION_PATTERNS = [
  // Path traversal
  /\.\.\//,
  /~\/\.\./,
  
  // Protected paths
  /~\/\.openclaw/,
  /~\/\.ssh/,
  /~\/\./,
  
  // System files
  /\/etc\/passwd/,
  /\/etc\/shadow/,
  /\/System/,
  
  // Bulk operations
  /delete\s+all\s+files/i,
  /remove\s+everything/i
];
```

---

## Path Validation

### Sandbox Check

```javascript
function isInSandbox(filePath) {
  const sandboxPaths = [
    path.resolve('~/Desktop/AI-Lab/Mission-Control/SANDBOX'),
    path.resolve('~/Desktop/AI-Lab/sandbox')
  ];
  
  const resolvedPath = path.resolve(filePath);
  return sandboxPaths.some(sandbox => 
    resolvedPath.startsWith(sandbox)
  );
}
```

### Protected Path Check

```javascript
function isProtectedPath(filePath) {
  const protectedPaths = [
    path.resolve('~/.openclaw'),
    path.resolve('~/.ssh'),
    path.resolve('~/.config'),
    path.resolve('~/Library'),
    '/etc',
    '/System',
    '/usr'
  ];
  
  const resolvedPath = path.resolve(filePath);
  return protectedPaths.some(protected => 
    resolvedPath.startsWith(protected)
  );
}
```

---

## Decision Algorithm

```
function determineApproval(task) {
  // Step 1: Parse operations
  const operations = parseOperations(task);
  
  // Step 2: Check for dangerous patterns
  if (matchesDangerousPattern(task)) {
    return { state: 'BLOCKED', reason: 'Dangerous operation detected' };
  }
  
  // Step 3: Calculate approval level
  let maxLevel = 0;
  for (const op of operations) {
    const level = getOperationLevel(op);
    maxLevel = Math.max(maxLevel, level);
    
    // Check for escalation triggers
    if (requiresEscalation(op)) {
      maxLevel = Math.min(4, maxLevel + 1);
    }
  }
  
  // Step 4: Validate paths
  for (const path of task.targetPaths) {
    if (isProtectedPath(path) && maxLevel < 3) {
      maxLevel = 3; // Escalate to explicit approval
    }
    if (!isInSandbox(path) && maxLevel === 1) {
      maxLevel = 2; // Escalate sandbox escape
    }
  }
  
  // Step 5: Determine state
  if (maxLevel >= 4) {
    return { state: 'BLOCKED', level: maxLevel };
  }
  if (maxLevel >= 2) {
    return { state: 'APPROVAL_REQUIRED', level: maxLevel };
  }
  return { state: 'AUTOMATIC', level: maxLevel };
}
```

---

## Integration with Mission Control

### Task Creation Flow

```
1. Task created in Mission Control
2. Approval Engine classifies task
3. State assigned: AUTOMATIC / APPROVAL_REQUIRED / BLOCKED
4. Task queued or executed based on state
```

### API Integration

```typescript
// Task creation with approval check
async function createTask(taskData) {
  const approval = await approvalEngine.classify(taskData);
  
  if (approval.state === 'BLOCKED') {
    return { error: 'Task blocked', reason: approval.reason };
  }
  
  if (approval.state === 'APPROVAL_REQUIRED') {
    const task = await db.createTask({
      ...taskData,
      status: 'pending_approval',
      approval_level: approval.level
    });
    await notifyOwner(task);
    return { task, pending_approval: true };
  }
  
  // AUTOMATIC
  const task = await db.createTask({
    ...taskData,
    status: 'queued',
    approval_level: approval.level
  });
  await queueForExecution(task);
  return { task, executed: true };
}
```

### Approval Endpoint

```typescript
// Owner approves/rejects task
async function approveTask(taskId, decision, reason) {
  const task = await db.getTask(taskId);
  
  if (task.status !== 'pending_approval') {
    return { error: 'Task not awaiting approval' };
  }
  
  if (decision === 'approve') {
    await db.updateTask(taskId, { status: 'queued' });
    await queueForExecution(task);
    await logApproval(taskId, 'approved', reason);
    return { approved: true };
  }
  
  if (decision === 'reject') {
    await db.updateTask(taskId, { status: 'rejected' });
    await logApproval(taskId, 'rejected', reason);
    return { rejected: true };
  }
}
```

---

## Owner Notification

### Notification Channels

1. **In-App:** Mission Control dashboard notification
2. **Email:** If configured
3. **Telegram:** If Phase 9+ enabled
4. **Push:** If mobile app enabled

### Notification Content

```
Subject: Approval Required - [Task Title]

Task: [Title]
Level: [2/3]
Operations:
  - [Operation 1]
  - [Operation 2]

Impact: [Description of changes]

[Approve Button] [Reject Button] [View Details]
```

---

## Audit Logging

### Log Format

```json
{
  "timestamp": "2026-06-27T17:00:00Z",
  "event": "approval_decision",
  "task_id": 123,
  "task_title": "Update footer component",
  "classification": {
    "operations": ["modify_file", "git_commit"],
    "level": 2,
    "state": "APPROVAL_REQUIRED"
  },
  "decision": {
    "action": "approved",
    "by": "owner",
    "at": "2026-06-27T17:05:00Z",
    "reason": "Looks good"
  }
}
```

### Log Events

- `task_classified` — Initial classification
- `approval_requested` — Owner notified
- `approval_granted` — Owner approved
- `approval_rejected` — Owner rejected
- `task_blocked` — Task blocked by engine
- `task_executed` — Automatic execution
- `escalation_triggered` — Level increased

---

## Configuration

### Engine Configuration

```json
{
  "approval_engine": {
    "enabled": true,
    "default_timeout_hours": 24,
    "patterns": {
      "dangerous": [...],
      "escalation": [...]
    },
    "paths": {
      "sandbox": [...],
      "protected": [...]
    },
    "notifications": {
      "channels": ["in_app", "email"],
      "reminder_hours": 24
    }
  }
}
```

---

## Future Enhancements

### Phase 9+ Features

- **Risk Scoring:** ML-based risk assessment
- **Behavioral Analysis:** Learn owner preferences
- **Smart Bundling:** Group related approvals
- **Time-Based Rules:** Different rules for business hours
- **Delegated Approval:** Allow secondary approvers

---

**END OF APPROVAL ENGINE SPECIFICATION**
