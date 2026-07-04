# AI Service Port Registry

**Project:** AI Mission Control / Jarvis / OpenClaw  
**Version:** 1.0.0  
**Last Updated:** 2026-06-30  
**Status:** ACTIVE

---

## Overview

This registry defines fixed port assignments for all AI services within the Mission Control ecosystem. These ports are reserved and must not be used by website development or other projects.

---

## Reserved AI Service Ports

| Port | Service | Purpose | Status |
|------|---------|---------|--------|
| **18789** | OpenClaw Gateway | Primary OpenClaw API gateway and orchestration | Core |
| **3002** | Mission Control | Main Mission Control dashboard and API | Core |
| **3010** | Jarvis Core | Jarvis AI core service and reasoning engine | Core |
| **3011** | Jarvis Desktop/API Bridge | Desktop integration and external API bridge | Extension |
| **3012** | Memory Service | Long-term memory and context persistence | Extension |
| **3013** | Voice Service | Voice synthesis and speech recognition | Extension |
| **3014** | Computer Control Service | Remote computer automation and control | Extension |
| **3015** | Service Monitor | Health monitoring and status aggregation | Infrastructure |
| **3016** | Internal Notification Service | Internal messaging and alerts | Infrastructure |

---

## Port Range Summary

- **Core Services:** 18789, 3002, 3010
- **Extension Services:** 3011–3014
- **Infrastructure Services:** 3015–3016
- **Reserved Range:** 3002, 3010–3016 (AI services block)

---

## Protected Website/Dev Ports

The following ports are reserved for website development and must remain free of AI services:

| Port | Common Use | Protection Status |
|------|------------|-------------------|
| **3000** | Next.js dev server, general web dev | PROTECTED |
| **3001** | Alternative dev server, API dev | PROTECTED |
| **5173** | Vite dev server | PROTECTED |
| **8000** | Django, general backend dev | PROTECTED |
| **8080** | Alternative web server, proxy | PROTECTED |

---

## Port Conflict Prevention

### Rules

1. **No Overlap:** AI services may never use ports 3000, 3001, 5173, 8000, or 8080
2. **Fixed Assignment:** Each AI service has a permanent port — no dynamic allocation
3. **Documentation Required:** Any new AI service must be registered here before deployment
4. **Pre-Launch Check:** All launchers must verify port availability before starting services

### Conflict Resolution Priority

1. AI services yield to website dev ports if conflicts detected
2. Extension services can be deferred if ports unavailable
3. Core services require port reassignment if conflicts persist

---

## Service Dependencies

```
OpenClaw Gateway (18789)
    └── Mission Control (3002)
            └── Jarvis Core (3010)
                    ├── Jarvis Desktop/API Bridge (3011)
                    ├── Memory Service (3012)
                    ├── Voice Service (3013)
                    └── Computer Control Service (3014)
            └── Service Monitor (3015)
            └── Internal Notification Service (3016)
```

---

## Adding New Services

To register a new AI service:

1. Assign next available port in 3010–3099 range
2. Update this registry
3. Update launcher plan
4. Update conflict policy if needed
5. Create audit entry

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-06-30 | Initial registry created | Phase 10 |
