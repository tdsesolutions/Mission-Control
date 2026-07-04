# AI Service Launcher Plan

**Project:** AI Mission Control / Jarvis / OpenClaw  
**Version:** 1.0.0  
**Last Updated:** 2026-06-30  
**Status:** ACTIVE

---

## Overview

This document defines the coordinated launch sequence for all AI services in the Mission Control ecosystem. The plan ensures services start in dependency order without port conflicts.

---

## Launch Modes

### Mode 1: Core Only (Minimal)
Starts only essential services for basic operation.

**Services:**
- OpenClaw Gateway (18789)
- Mission Control (3002)
- Jarvis Core (3010)

**Use Case:** Development, testing, resource-constrained environments

### Mode 2: Standard (Recommended)
Starts core + extension services for full AI capability.

**Services:**
- Core services (18789, 3002, 3010)
- Jarvis Desktop/API Bridge (3011)
- Memory Service (3012)
- Voice Service (3013)
- Computer Control Service (3014)

**Use Case:** Normal operation, production

### Mode 3: Full (Infrastructure)
Starts all services including monitoring and notifications.

**Services:**
- All Standard services
- Service Monitor (3015)
- Internal Notification Service (3016)

**Use Case:** Production with monitoring, multi-user environments

---

## Launch Sequence

### Phase 1: Infrastructure Layer (0s)
```
Step 1.1: Verify port availability for all services
Step 1.2: Check for conflicts with protected ports (3000, 3001, 5173, 8000, 8080)
Step 1.3: Initialize service state directory
```

### Phase 2: Core Services Layer (0–5s)
```
Step 2.1: Start OpenClaw Gateway (18789)
        └── Wait for health: GET http://127.0.0.1:18789/health
        └── Timeout: 30s

Step 2.2: Start Mission Control (3002)
        └── Wait for health: GET http://127.0.0.1:3002/api/health
        └── Timeout: 30s
        └── Dependency: OpenClaw Gateway

Step 2.3: Start Jarvis Core (3010)
        └── Wait for health: GET http://127.0.0.1:3010/health
        └── Timeout: 60s
        └── Dependency: Mission Control
```

### Phase 3: Extension Services Layer (5–15s)
```
Step 3.1: Start Jarvis Desktop/API Bridge (3011)
        └── Wait for health: GET http://127.0.0.1:3011/health
        └── Timeout: 30s
        └── Dependency: Jarvis Core

Step 3.2: Start Memory Service (3012)
        └── Wait for health: GET http://127.0.0.1:3012/health
        └── Timeout: 30s
        └── Dependency: Jarvis Core

Step 3.3: Start Voice Service (3013)
        └── Wait for health: GET http://127.0.0.1:3013/health
        └── Timeout: 30s
        └── Dependency: Jarvis Core

Step 3.4: Start Computer Control Service (3014)
        └── Wait for health: GET http://127.0.0.1:3014/health
        └── Timeout: 30s
        └── Dependency: Jarvis Core
```

### Phase 4: Infrastructure Services Layer (15–20s)
```
Step 4.1: Start Service Monitor (3015)
        └── Wait for health: GET http://127.0.0.1:3015/health
        └── Timeout: 30s
        └── Dependency: All core + extension services

Step 4.2: Start Internal Notification Service (3016)
        └── Wait for health: GET http://127.0.0.1:3016/health
        └── Timeout: 30s
        └── Dependency: Service Monitor
```

### Phase 5: Verification (20–25s)
```
Step 5.1: Run full health check across all started services
Step 5.2: Verify no port conflicts detected
Step 5.3: Report launch status
```

---

## Port Availability Check

Before starting any service, verify:

```bash
# Check if port is in use
lsof -i :<PORT> 2>/dev/null || netstat -tuln 2>/dev/null | grep :<PORT>

# Protected ports to check first
PROTECTED_PORTS=(3000 3001 5173 8000 8080)
AI_PORTS=(18789 3002 3010 3011 3012 3013 3014 3015 3016)
```

**Action on Conflict:**
- If protected port in use → Log warning, continue
- If AI port in use → Skip service, log error, continue with others

---

## Launcher Commands

### Start Core Only
```bash
./scripts/launch-ai-services.sh --mode=core
```

### Start Standard
```bash
./scripts/launch-ai-services.sh --mode=standard
```

### Start Full
```bash
./scripts/launch-ai-services.sh --mode=full
```

### Stop All
```bash
./scripts/stop-ai-services.sh
```

### Check Status
```bash
./scripts/check-ai-services.sh
```

---

## Health Check Endpoints

| Service | Health URL | Expected Response |
|---------|------------|-------------------|
| OpenClaw Gateway | http://127.0.0.1:18789/health | `{"status":"ok"}` |
| Mission Control | http://127.0.0.1:3002/api/health | `{"status":"healthy"}` |
| Jarvis Core | http://127.0.0.1:3010/health | `{"status":"ok"}` |
| Jarvis Desktop | http://127.0.0.1:3011/health | `{"status":"ok"}` |
| Memory Service | http://127.0.0.1:3012/health | `{"status":"ok"}` |
| Voice Service | http://127.0.0.1:3013/health | `{"status":"ok"}` |
| Computer Control | http://127.0.0.1:3014/health | `{"status":"ok"}` |
| Service Monitor | http://127.0.0.1:3015/health | `{"status":"ok"}` |
| Notification | http://127.0.0.1:3016/health | `{"status":"ok"}` |

---

## Error Handling

| Scenario | Action |
|----------|--------|
| Port conflict with protected port | Log warning, skip service, continue |
| Port conflict with AI service | Log error, skip service, continue |
| Health check timeout | Retry 3x, then mark as failed |
| Dependency not ready | Wait 5s, retry, fail after 3 attempts |
| Launch script not found | Log error, skip to next service |

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-06-30 | Initial launcher plan created | Phase 10 |
