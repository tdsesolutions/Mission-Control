# Workflow Rules & Approval Levels

**Phase 8: Controlled Workflow Rules & Approval Gates**  
**Date:** 2026-06-27  
**Version:** 1.0  
**Status:** Active

---

## Overview

This document defines the authorization model for the Mission Control execution pipeline. Every request must flow through:

```
Client → Mission Control → Approval Engine → Gateway → OpenClaw Main → Existing Routing
```

The Approval Engine is the final checkpoint before execution.

---

## Approval Levels

### LEVEL 0 — Automatic (Read-Only)

**Risk:** None  
**Impact:** Zero  
**Approval:** Never required

**Permitted Operations:**
- Read documentation
- Read logs
- Read project status
- Health checks
- Search project files
- Generate reports
- List directory contents
- View configuration files
- Query databases (read-only)

**Examples:**
```
✓ "Show me the project status"
✓ "Read the README file"
✓ "Search for TODO comments"
✓ "Generate a report on open tasks"
✓ "Check system health"
```

**Safety Guarantees:**
- No files modified
- No systems changed
- No data altered
- No configuration touched

---

### LEVEL 1 — Automatic (Sandbox-Safe)

**Risk:** Minimal  
**Impact:** Isolated to sandbox  
**Approval:** Never required

**Permitted Operations:**
- Create files inside approved sandbox directories
- Generate documentation
- Analyze code
- Research tasks
- Run isolated tests
- Create temporary files

**Sandbox Locations:**
- `~/Desktop/AI-Lab/Mission-Control/SANDBOX/`
- `~/Desktop/AI-Lab/sandbox/`
- Any explicitly configured sandbox path

**Examples:**
```
✓ "Create a test file in the sandbox"
✓ "Generate documentation for this function"
✓ "Analyze the code structure"
✓ "Research best practices for X"
```

**Safety Guarantees:**
- Cannot escape sandbox
- Cannot modify existing projects
- Cannot access production data
- Changes are disposable

---

### LEVEL 2 — Owner Approval Required

**Risk:** Moderate  
**Impact:** Project modifications  
**Approval:** Required before execution

**Permitted Operations (with approval):**
- Modify existing project files
- Create new projects
- Run builds
- Git commits
- Merge changes
- Delete files
- Move files
- Rename files
- Install dependencies
- Run tests that modify state

**Examples:**
```
⚠ "Update the footer component"
⚠ "Create a new React project"
⚠ "Commit these changes"
⚠ "Run the build process"
⚠ "Delete the old backup files"
```

**Approval Flow:**
1. Task classified as LEVEL 2
2. Owner notification sent
3. Owner reviews and approves/rejects
4. On approval: task executes
5. On rejection: task blocked with reason

**Safety Requirements:**
- Backup created before modifications
- Changes logged for audit
- Rollback capability maintained
- Scope clearly defined

---

### LEVEL 3 — Explicit Approval Required (Every Time)

**Risk:** High  
**Impact:** System-wide changes  
**Approval:** Required for each instance

**Permitted Operations (with explicit approval):**
- System configuration changes
- Shell profile modifications (.bashrc, .zshrc, etc.)
- PATH environment changes
- Package manager changes (brew, npm, pip, etc.)
- Global installations
- OpenClaw configuration changes
- Mission Control configuration changes
- Agent configuration changes
- Model configuration changes
- Gateway configuration changes

**Examples:**
```
🛑 "Add a new PATH entry to .zshrc"
🛑 "Install a new npm package globally"
🛑 "Update the OpenClaw gateway port"
🛑 "Change the default model"
🛑 "Modify the agent hierarchy"
```

**Approval Requirements:**
- Explicit confirmation for EACH operation
- Cannot be pre-approved
- Cannot be batched for automatic approval
- Must include justification

**Safety Requirements:**
- Configuration backed up before changes
- Change tested in isolation when possible
- Rollback plan documented
- Impact assessment provided

---

### LEVEL 4 — Never Automatic

**Risk:** Critical  
**Impact:** Catastrophic or irreversible  
**Approval:** Manual execution only

**Blocked Operations:**
- Delete repositories
- Delete databases
- Delete projects
- Factory reset
- Credential changes
- Security policy changes
- Anything outside approved workspace
- Mass deletion operations
- Data purging
- Account deletion

**Examples:**
```
❌ "Delete the entire project repository"
❌ "Drop the production database"
❌ "Reset the system to factory defaults"
❌ "Delete all user accounts"
❌ "Remove the Mission Control installation"
```

**Handling:**
- Task immediately blocked
- Owner notified of blocked operation
- Manual intervention required
- No automatic execution path exists

---

## Escalation Rules

### Automatic Escalation

Tasks automatically escalate to higher levels when:

1. **Scope Expansion:** Task attempts operations outside original classification
2. **Path Traversal:** Task tries to access files outside approved directories
3. **Pattern Match:** Task matches dangerous operation patterns
4. **Bulk Operations:** Task affects more than N files (configurable)
5. **Protected Resources:** Task targets protected files or directories

### Manual Escalation

Owners can escalate tasks manually:
- Demote: Requires lower approval level (e.g., LEVEL 2 → LEVEL 1)
- Promote: Requires higher approval level (e.g., LEVEL 2 → LEVEL 3)
- Block: Prevent execution entirely

### Escalation Matrix

| From Level | To Level | Trigger |
|------------|----------|---------|
| 0 | 2 | Write operation detected |
| 1 | 2 | Sandbox escape attempt |
| 1 | 3 | System file targeted |
| 2 | 3 | Configuration change detected |
| 2 | 4 | Destructive operation detected |
| 3 | 4 | Irreversible operation detected |

---

## Task Classification

### Classification Process

1. **Parse:** Extract intent from natural language
2. **Analyze:** Identify operations required
3. **Map:** Match operations to approval levels
4. **Assign:** Set task approval level (highest matched)
5. **Validate:** Confirm classification with rules engine

### Classification Examples

| Task | Operations | Level |
|------|------------|-------|
| "Show project status" | Read | 0 |
| "Create test file in sandbox" | Write (sandbox) | 1 |
| "Update the navigation component" | Write (project) | 2 |
| "Install new npm package" | System change | 3 |
| "Delete the database" | Destructive | 4 (Blocked) |

---

## Approval Flow

### Level 0-1: Automatic

```
Request → Parse → Classify → Execute → Report
                ↓
            [LEVEL 0-1]
                ↓
            Automatic
```

### Level 2: Owner Approval

```
Request → Parse → Classify → Notify Owner → Wait → Execute → Report
                ↓
            [LEVEL 2]
                ↓
          Approval Required
                ↓
          Owner Decision
```

### Level 3: Explicit Approval

```
Request → Parse → Classify → Present Details → Confirm → Execute → Report
                ↓
            [LEVEL 3]
                ↓
       Explicit Confirmation Required
                ↓
       Owner Explicitly Approves Each Time
```

### Level 4: Blocked

```
Request → Parse → Classify → Block → Notify → Manual Only
                ↓
            [LEVEL 4]
                ↓
            BLOCKED
                ↓
       Manual Intervention Required
```

---

## Override Rules

### Emergency Override

In emergency situations, owners can:
- Temporarily lower approval levels
- Bypass approval for specific operations
- Execute blocked operations manually

**Requirements:**
- Override logged with justification
- Time-limited (expires automatically)
- Owner explicitly acknowledges risk
- Audit trail maintained

### Developer Mode

For development/testing:
- Sandbox-only bypass available
- Cannot affect production
- All changes logged
- Mode clearly indicated in UI

---

## Audit & Logging

### Required Logs

Every approval decision logged:
- Timestamp
- Task ID
- Requested operations
- Classified level
- Decision (approve/reject/block)
- Decision maker
- Justification

### Retention

- Approval logs: 90 days
- Override logs: 1 year
- Blocked operation logs: 1 year

---

## Configuration

### Approval Level Configuration

```json
{
  "approval": {
    "levels": {
      "0": { "auto": true, "notify": false },
      "1": { "auto": true, "notify": false },
      "2": { "auto": false, "notify": true, "timeout": 86400 },
      "3": { "auto": false, "notify": true, "explicit": true },
      "4": { "auto": false, "blocked": true }
    },
    "sandbox_paths": [
      "~/Desktop/AI-Lab/Mission-Control/SANDBOX",
      "~/Desktop/AI-Lab/sandbox"
    ],
    "protected_paths": [
      "~/.openclaw",
      "~/.ssh",
      "~/.config"
    ]
  }
}
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-06-27 | Initial approval levels defined |

---

**END OF WORKFLOW RULES**
