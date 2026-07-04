# Task Classification Matrix

**Phase 8: Controlled Workflow Rules & Approval Gates**  
**Date:** 2026-06-27  
**Version:** 1.0  
**Status:** Active

---

## Overview

This document categorizes all task types and defines their default approval levels. Use this matrix to understand what operations require approval and which are automatic.

---

## Classification Matrix

### Category: Documentation

| Operation | Level | Automatic | Approval Required | Notes |
|-----------|-------|-----------|-------------------|-------|
| Read documentation | 0 | ✅ | — | Always safe |
| Generate documentation | 1 | ✅ | — | Sandbox output |
| Update documentation | 2 | — | ✅ | Project file modification |
| Delete documentation | 2 | — | ✅ | Project file deletion |
| Create new docs | 1 | ✅ | — | If in sandbox |

**Examples:**
```
✓ "Read the README" → LEVEL 0 → Automatic
✓ "Generate API docs" → LEVEL 1 → Automatic (sandbox)
⚠ "Update the wiki" → LEVEL 2 → Approval Required
```

---

### Category: Research

| Operation | Level | Automatic | Approval Required | Notes |
|-----------|-------|-----------|-------------------|-------|
| Search web | 0 | ✅ | — | Read-only |
| Search project files | 0 | ✅ | — | Read-only |
| Analyze code | 0 | ✅ | — | Read-only analysis |
| Research best practices | 0 | ✅ | — | Information gathering |
| Compare technologies | 0 | ✅ | — | Research task |
| Generate research report | 1 | ✅ | — | Sandbox output |

**Examples:**
```
✓ "Research React patterns" → LEVEL 0 → Automatic
✓ "Search for TODO comments" → LEVEL 0 → Automatic
✓ "Analyze code complexity" → LEVEL 0 → Automatic
```

---

### Category: Coding

| Operation | Level | Automatic | Approval Required | Notes |
|-----------|-------|-----------|-------------------|-------|
| Read code | 0 | ✅ | — | Read-only |
| Analyze code structure | 0 | ✅ | — | Read-only |
| Write code (sandbox) | 1 | ✅ | — | Isolated testing |
| Modify existing code | 2 | — | ✅ | Project change |
| Create new file | 2 | — | ✅ | Project addition |
| Delete code file | 2 | — | ✅ | Project deletion |
| Refactor code | 2 | — | ✅ | Project modification |
| Run linter | 1 | ✅ | — | If read-only |
| Run formatter | 2 | — | ✅ | Modifies files |

**Examples:**
```
✓ "Read the component code" → LEVEL 0 → Automatic
✓ "Write test in sandbox" → LEVEL 1 → Automatic
⚠ "Fix the bug in footer" → LEVEL 2 → Approval Required
⚠ "Refactor the auth module" → LEVEL 2 → Approval Required
```

---

### Category: Deployment

| Operation | Level | Automatic | Approval Required | Notes |
|-----------|-------|-----------|-------------------|-------|
| Check deployment status | 0 | ✅ | — | Read-only |
| Generate deployment plan | 1 | ✅ | — | Sandbox output |
| Build project | 2 | — | ✅ | Modifies build output |
| Deploy to staging | 2 | — | ✅ | Affects environment |
| Deploy to production | 3 | — | ✅ | Critical system |
| Rollback deployment | 3 | — | ✅ | Critical operation |
| Update CI/CD config | 3 | — | ✅ | System configuration |

**Examples:**
```
✓ "Check deployment status" → LEVEL 0 → Automatic
⚠ "Build the project" → LEVEL 2 → Approval Required
🛑 "Deploy to production" → LEVEL 3 → Explicit Approval
```

---

### Category: Infrastructure

| Operation | Level | Automatic | Approval Required | Notes |
|-----------|-------|-----------|-------------------|-------|
| Check system health | 0 | ✅ | — | Read-only monitoring |
| View logs | 0 | ✅ | — | Read-only |
| Generate infra report | 1 | ✅ | — | Sandbox output |
| Modify configuration | 3 | — | ✅ | System change |
| Update environment vars | 3 | — | ✅ | System change |
| Change service settings | 3 | — | ✅ | System change |
| Provision resources | 3 | — | ✅ | Infrastructure change |
| Delete infrastructure | 4 | — | — | BLOCKED |

**Examples:**
```
✓ "Check system health" → LEVEL 0 → Automatic
✓ "View recent logs" → LEVEL 0 → Automatic
🛑 "Update nginx config" → LEVEL 3 → Explicit Approval
❌ "Delete the server" → LEVEL 4 → BLOCKED
```

---

### Category: Security

| Operation | Level | Automatic | Approval Required | Notes |
|-----------|-------|-----------|-------------------|-------|
| Run security scan | 0 | ✅ | — | Read-only assessment |
| Generate security report | 1 | ✅ | — | Sandbox output |
| Review security settings | 0 | ✅ | — | Read-only |
| Update security policy | 3 | — | ✅ | Critical configuration |
| Change credentials | 4 | — | — | BLOCKED |
| Modify permissions | 3 | — | ✅ | System change |
| Enable/disable security features | 3 | — | ✅ | System change |

**Examples:**
```
✓ "Run security scan" → LEVEL 0 → Automatic
✓ "Generate security report" → LEVEL 1 → Automatic
🛑 "Update firewall rules" → LEVEL 3 → Explicit Approval
❌ "Change admin password" → LEVEL 4 → BLOCKED
```

---

### Category: Computer Control

| Operation | Level | Automatic | Approval Required | Notes |
|-----------|-------|-----------|-------------------|-------|
| Take screenshot | 0 | ✅ | — | Read-only capture |
| List running processes | 0 | ✅ | — | Read-only |
| Check disk space | 0 | ✅ | — | Read-only |
| Control applications | 3 | — | ✅ | System control |
| Automate UI interactions | 3 | — | ✅ | System control |
| Execute system commands | 3 | — | ✅ | System change |
| Modify system settings | 3 | — | ✅ | System change |
| Install applications | 3 | — | ✅ | System change |

**Examples:**
```
✓ "Take a screenshot" → LEVEL 0 → Automatic
✓ "Check disk space" → LEVEL 0 → Automatic
🛑 "Open Safari and navigate to X" → LEVEL 3 → Explicit Approval
🛑 "Install new application" → LEVEL 3 → Explicit Approval
```

---

### Category: Voice

| Operation | Level | Automatic | Approval Required | Notes |
|-----------|-------|-----------|-------------------|-------|
| Text-to-speech | 0 | ✅ | — | Output only |
| Voice response | 0 | ✅ | — | Output only |
| Voice command (read) | 0 | ✅ | — | Information only |
| Voice command (action) | Matches action | — | — | Inherits action level |

**Examples:**
```
✓ "Speak this message" → LEVEL 0 → Automatic
✓ "What's the weather?" → LEVEL 0 → Automatic
⚠ "Delete the file (voice)" → LEVEL 2 → Approval Required
```

---

### Category: Telegram

| Operation | Level | Automatic | Approval Required | Notes |
|-----------|-------|-----------|-------------------|-------|
| Send notification | 0 | ✅ | — | Output only |
| Send status update | 0 | ✅ | — | Output only |
| Receive command (read) | 0 | ✅ | — | Information only |
| Receive command (action) | Matches action | — | — | Inherits action level |
| Send message to group | 0 | ✅ | — | If pre-approved |
| Send file | 1 | ✅ | — | Sandbox file |

**Examples:**
```
✓ "Send me a notification when done" → LEVEL 0 → Automatic
✓ "Send status update" → LEVEL 0 → Automatic
⚠ "Deploy to production (via Telegram)" → LEVEL 3 → Explicit Approval
```

---

### Category: System Administration

| Operation | Level | Automatic | Approval Required | Notes |
|-----------|-------|-----------|-------------------|-------|
| Check system status | 0 | ✅ | — | Read-only |
| View system logs | 0 | ✅ | — | Read-only |
| Monitor resources | 0 | ✅ | — | Read-only |
| Update package lists | 2 | — | ✅ | System change |
| Install system packages | 3 | — | ✅ | System change |
| Modify shell profile | 3 | — | ✅ | System configuration |
| Update PATH | 3 | — | ✅ | System configuration |
| Modify system services | 3 | — | ✅ | System change |
| Reboot system | 4 | — | — | BLOCKED |
| Shutdown system | 4 | — | — | BLOCKED |

**Examples:**
```
✓ "Check system status" → LEVEL 0 → Automatic
✓ "View system logs" → LEVEL 0 → Automatic
⚠ "Update npm packages" → LEVEL 2 → Approval Required
🛑 "Add PATH to .zshrc" → LEVEL 3 → Explicit Approval
❌ "Reboot the computer" → LEVEL 4 → BLOCKED
```

---

### Category: Business Operations

| Operation | Level | Automatic | Approval Required | Notes |
|-----------|-------|-----------|-------------------|-------|
| Generate report | 1 | ✅ | — | Sandbox output |
| Analyze data | 0 | ✅ | — | Read-only |
| Create presentation | 1 | ✅ | — | Sandbox output |
| Send email (draft) | 1 | ✅ | — | Sandbox draft |
| Send email (actual) | 2 | — | ✅ | External action |
| Schedule meeting | 2 | — | ✅ | External action |
| Update CRM | 2 | — | ✅ | Data modification |
| Process payment | 4 | — | — | BLOCKED |
| Sign contract | 4 | — | — | BLOCKED |

**Examples:**
```
✓ "Generate sales report" → LEVEL 1 → Automatic
✓ "Create presentation draft" → LEVEL 1 → Automatic
⚠ "Send email to client" → LEVEL 2 → Approval Required
❌ "Process refund" → LEVEL 4 → BLOCKED
```

---

### Category: Git Operations

| Operation | Level | Automatic | Approval Required | Notes |
|-----------|-------|-----------|-------------------|-------|
| Check git status | 0 | ✅ | — | Read-only |
| View commit history | 0 | ✅ | — | Read-only |
| View diff | 0 | ✅ | — | Read-only |
| Stage files | 2 | — | ✅ | Prepares modification |
| Commit changes | 2 | — | ✅ | Project modification |
| Push to remote | 2 | — | ✅ | Affects remote |
| Pull from remote | 2 | — | ✅ | Modifies local |
| Create branch | 2 | — | ✅ | Repository change |
| Merge branch | 2 | — | ✅ | Repository change |
| Delete branch | 2 | — | ✅ | Repository change |
| Force push | 3 | — | ✅ | Destructive potential |
| Rewrite history | 3 | — | ✅ | Destructive |
| Delete repository | 4 | — | — | BLOCKED |

**Examples:**
```
✓ "Show git status" → LEVEL 0 → Automatic
✓ "Show recent commits" → LEVEL 0 → Automatic
⚠ "Commit these changes" → LEVEL 2 → Approval Required
⚠ "Push to main" → LEVEL 2 → Approval Required
🛑 "Force push to main" → LEVEL 3 → Explicit Approval
❌ "Delete the repository" → LEVEL 4 → BLOCKED
```

---

### Category: File Operations

| Operation | Level | Automatic | Approval Required | Notes |
|-----------|-------|-----------|-------------------|-------|
| Read file | 0 | ✅ | — | Read-only |
| List directory | 0 | ✅ | — | Read-only |
| Search files | 0 | ✅ | — | Read-only |
| Create file (sandbox) | 1 | ✅ | — | Isolated |
| Create file (project) | 2 | — | ✅ | Project modification |
| Modify file (sandbox) | 1 | ✅ | — | Isolated |
| Modify file (project) | 2 | — | ✅ | Project modification |
| Delete file (sandbox) | 1 | ✅ | — | Isolated |
| Delete file (project) | 2 | — | ✅ | Project modification |
| Move file (sandbox) | 1 | ✅ | — | Isolated |
| Move file (project) | 2 | — | ✅ | Project modification |
| Copy file | 1-2 | Varies | Varies | Depends on destination |
| Bulk delete | 4 | — | — | BLOCKED |
| Delete system files | 4 | — | — | BLOCKED |

**Examples:**
```
✓ "Read the config file" → LEVEL 0 → Automatic
✓ "Create test file in sandbox" → LEVEL 1 → Automatic
⚠ "Update the config file" → LEVEL 2 → Approval Required
⚠ "Delete the old files" → LEVEL 2 → Approval Required
❌ "Delete all files" → LEVEL 4 → BLOCKED
```

---

### Category: Database Operations

| Operation | Level | Automatic | Approval Required | Notes |
|-----------|-------|-----------|-------------------|-------|
| Query data | 0 | ✅ | — | Read-only |
| Generate query | 1 | ✅ | — | Sandbox output |
| Analyze schema | 0 | ✅ | — | Read-only |
| Insert data | 2 | — | ✅ | Data modification |
| Update data | 2 | — | ✅ | Data modification |
| Delete data | 2 | — | ✅ | Data modification |
| Create table | 2 | — | ✅ | Schema change |
| Alter table | 2 | — | ✅ | Schema change |
| Drop table | 3 | — | ✅ | Destructive |
| Drop database | 4 | — | — | BLOCKED |
| Backup database | 2 | — | ✅ | System operation |
| Restore database | 3 | — | ✅ | Critical operation |

**Examples:**
```
✓ "Query active users" → LEVEL 0 → Automatic
✓ "Generate SQL for report" → LEVEL 1 → Automatic
⚠ "Insert new record" → LEVEL 2 → Approval Required
🛑 "Drop the users table" → LEVEL 3 → Explicit Approval
❌ "Drop the database" → LEVEL 4 → BLOCKED
```

---

## Quick Reference

### Automatic (No Approval)

✅ All read operations  
✅ Sandbox file operations  
✅ Report generation  
✅ Research tasks  
✅ Code analysis  
✅ Health checks  
✅ Notifications  

### Approval Required

⚠️ Project file modifications  
⚠️ Git commits/pushes  
⚠️ Builds and deployments  
⚠️ Package installations  
⚠️ Database modifications  

### Explicit Approval (Every Time)

🛑 System configuration changes  
🛑 Shell profile modifications  
🛑 Global installations  
🛑 Production deployments  
🛑 Infrastructure changes  

### Blocked (Never Automatic)

❌ Repository deletion  
❌ Database deletion  
❌ Mass deletions  
❌ Credential changes  
❌ Factory reset  
❌ System shutdown  

---

## Classification Override

Owners can override classifications:

- **Demote:** Lower approval level for specific task
- **Promote:** Raise approval level for caution
- **Pre-approve:** Auto-approve specific patterns
- **Block:** Prevent specific operations entirely

**Override Logging:**
All overrides logged with:
- Original classification
- Override reason
- Override scope (one-time / permanent)
- Owner identity
- Timestamp

---

**END OF TASK CLASSIFICATION MATRIX**
