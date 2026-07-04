# Localhost Conflict Policy

**Project:** AI Mission Control / Jarvis / OpenClaw  
**Version:** 1.0.0  
**Last Updated:** 2026-06-30  
**Status:** ACTIVE

---

## Purpose

This policy establishes rules to prevent and resolve port conflicts between AI services and website development projects running on localhost.

---

## Priority Hierarchy

### Tier 1: Protected Dev Ports (Highest Priority)
These ports are reserved for website development and take precedence over AI services.

| Port | Reserved For | Conflict Resolution |
|------|--------------|---------------------|
| 3000 | Next.js, React dev servers | AI services must yield |
| 3001 | Alternative dev servers | AI services must yield |
| 5173 | Vite dev servers | AI services must yield |
| 8000 | Django, general backend | AI services must yield |
| 8080 | Proxy, alternative servers | AI services must yield |

### Tier 2: Core AI Services (Fixed)
These ports are permanently assigned to AI infrastructure.

| Port | Service | Cannot Change |
|------|---------|---------------|
| 18789 | OpenClaw Gateway | Yes |
| 3002 | Mission Control | Yes |
| 3010 | Jarvis Core | Yes |

### Tier 3: Extension AI Services (Deferrable)
These services can be skipped if conflicts occur.

| Port | Service | Can Defer |
|------|---------|-----------|
| 3011 | Jarvis Desktop/API Bridge | Yes |
| 3012 | Memory Service | Yes |
| 3013 | Voice Service | Yes |
| 3014 | Computer Control Service | Yes |
| 3015 | Service Monitor | Yes |
| 3016 | Internal Notification Service | Yes |

---

## Conflict Prevention Rules

### Rule 1: Pre-Launch Verification
Before starting any AI service:
1. Check if target port is available
2. Check if protected ports are in use (for awareness)
3. Log all port status to console

### Rule 2: No Override of Protected Ports
AI services must never:
- Kill processes on protected ports
- Force-stop dev servers
- Reassign themselves to protected ports

### Rule 3: Graceful Degradation
If an AI service port is unavailable:
1. Log the conflict
2. Skip the service
3. Continue with remaining services
4. Report which services are unavailable

### Rule 4: Human Override Required
To change any port assignment:
1. Update AI_SERVICE_PORT_REGISTRY.md
2. Update AI_SERVICE_LAUNCHER_PLAN.md
3. Update this policy
4. Create audit entry

---

## Conflict Detection

### Automated Detection
```bash
# Check all AI ports before launch
for port in 18789 3002 3010 3011 3012 3013 3014 3015 3016; do
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        echo "WARNING: Port $port is already in use"
    fi
done

# Check protected ports (informational only)
for port in 3000 3001 5173 8000 8080; do
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        echo "INFO: Protected port $port is in use (expected for dev)"
    fi
done
```

### Manual Detection
If services fail to start:
1. Run `lsof -i :<PORT>` to identify process
2. Check if it's a dev server (Node, Python, etc.)
3. Refer to priority hierarchy for resolution

---

## Resolution Procedures

### Scenario A: AI Service Won't Start (Port in Use)
**Symptom:** "Port 3002 already in use"

**Resolution:**
1. Identify process: `lsof -i :3002`
2. If it's another AI service → Check for duplicate launch
3. If it's a dev server → Move dev server to different port
4. If unknown → Manual investigation required

### Scenario B: Dev Server Won't Start (Port in Use)
**Symptom:** Next.js/Vite fails with port conflict

**Resolution:**
1. Identify process: `lsof -i :3000`
2. If it's an AI service → AI service must be moved/stopped
3. Use `npm run dev -- --port 3003` to use alternative port
4. Report conflict to update registry if needed

### Scenario C: Both Need the Same Port
**Symptom:** Both AI and dev need port 3000

**Resolution:**
1. Dev server wins (protected port)
2. AI service uses alternative port or defers
3. Update documentation if permanent change needed

---

## Communication Protocol

### When Conflicts Occur
1. Log to console with clear messaging
2. Indicate which service is affected
3. Suggest resolution steps
4. Continue with other services if possible

### Example Messages
```
[CONFLICT] Port 3000 is in use by Next.js dev server (PID 12345)
[INFO] Mission Control uses port 3002 — no conflict
[WARNING] Voice Service (3013) port unavailable — skipping
[ERROR] Jarvis Core (3010) failed to start — required service
```

---

## Exceptions

Emergency exceptions require:
1. Documentation of reason
2. Temporary port reassignment
3. Plan to restore standard ports
4. Audit trail entry

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-06-30 | Initial conflict policy created | Phase 10 |
