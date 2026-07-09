# Jarvis AI Executive

**Version:** 1.0.0  
**Status:** Production Ready

Jarvis is a premium AI executive system that serves as the interface between you and the Mission Control ecosystem. It provides a living AI operating system experience with multiple visualization modes and seamless integration with OpenClaw through Mission Control.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Jarvis Desktop                         │
│                   (Port 3011 - React)                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                      Jarvis Core                            │
│              (Port 3010 - Node.js/Express)                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ State Mgr   │  │ Memory Svc  │  │ Monitor Svc         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   Mission Control                           │
│                   (Port 3002)                               │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   Approval Engine                           │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   OpenClaw Gateway                          │
│                   (Port 18789)                              │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   OpenClaw Main                             │
└─────────────────────────────────────────────────────────────┘
```

## Features

### UI Modes

Jarvis supports 6 distinct visualization modes:

1. **Orb Mode** - Animated pulsing orb with rotating rings
2. **Sphere Mode** - 3D wireframe sphere with rotating core
3. **Wave Mode** - Expanding wave animations
4. **HUD Mode** - Information dashboard with system metrics
5. **Ambient Mode** - Subtle gradient background
6. **Face Mode** (default) - KiarosFace executive interface: expressive AI
   face driven by live voice/conversation state (turquoise/purple system)

### Core Capabilities

- **Mission Control Integration** - Reads (tasks/projects/agents read
  through) plus sanctioned TASK CREATION (2026-07-09): every create is
  decided by the deterministic Approval Engine — auto-approved work
  dispatches immediately, project-modifying work waits in the
  owner-approval queue, dangerous work is rejected. Task update/delete
  stays with Mission Control's own UI (Kiaros answers 501 by design)
- **Project Monitoring** - Track project progress and metrics
- **Memory System** - Persistent key-value memory (jarvis-memory.json)
- **Knowledge Vault** - Questions consult the owner's Obsidian vault through
  Mission Control's read-only FTS search (when MC is up)
- **Health Monitoring** - Service health checks + real Core process metrics
- **Event System** - Real-time event streaming via WebSocket (EventBus-backed)
- **Conversation Interface** - LLM-backed natural language (model-agnostic)
- **Voice** - Push-to-talk + hands-free loop; browser Web Speech by default,
  Deepgram STT / ElevenLabs TTS via Core proxy when keys are set in
  `jarvis/.env` (keys never reach the browser; automatic browser fallback)

## Quick Start

### Prerequisites

- Node.js 18+
- Mission Control running on port 3002
- OpenClaw Gateway running on port 18789 (optional)

### Installation

```bash
# From the jarvis directory
cd ~/Desktop/AI-Lab/Mission-Control/jarvis

# Copy environment file
cp .env.example .env

# Start all services
./scripts/start-jarvis.sh
```

### Access

- **Jarvis Desktop:** http://localhost:3011
- **Jarvis Core API:** http://localhost:3010
- **Health Check:** http://localhost:3010/health

### Stop Services

```bash
./scripts/stop-jarvis.sh
```

### Check Status

```bash
./scripts/status.sh
```

## API Endpoints

### Health
- `GET /health` - Service health check

### Status
- `GET /api/v1/status` - Get Jarvis state
- `POST /api/v1/status/update` - Update Jarvis state

### Mode
- `GET /api/v1/mode` - Get current UI mode
- `POST /api/v1/mode/set` - Set UI mode

### Conversation
- `GET /api/v1/conversation` - Get conversation history
- `POST /api/v1/conversation/message` - Send message

### Tasks (reads proxy Mission Control; create routes through the Approval Engine)
- `GET /api/v1/tasks` - List tasks (MC read-through)
- `GET /api/v1/tasks/:id` - Get task (MC read-through)
- `POST /api/v1/tasks` - Create via TaskDispatcher (body: `{intent}` or
  `{title, description}`); HTTP status mirrors the decision — 201 created,
  202 held for owner approval, 403 rejected, 422 needs clarification,
  502 MC unreachable
- `PATCH/PUT/DELETE /api/v1/tasks/:id` - `501` (lifecycle edits belong to MC)

### Projects (reads proxy Mission Control; writes owner-gated)
- `GET /api/v1/projects` - List projects (MC read-through)
- `GET /api/v1/projects/:id` - Get project (MC read-through)
- `POST/PATCH/PUT/DELETE /api/v1/projects*` - `501 WRITES_OWNER_GATED`

### Memory (persistent — shared MemoryService, survives restarts)
- `GET /api/v1/memory` - List memory keys
- `GET /api/v1/memory/:key` - Get memory value
- `POST /api/v1/memory/:key` - Set memory value
- `DELETE /api/v1/memory/:key` - Delete memory value

### Events (EventBus-backed — same history the WebSocket broadcasts)
- `GET /api/v1/events` - Get system events
- `POST /api/v1/events` - Create event

### Voice (cloud providers via Core proxy; keys stay server-side)
- `GET /api/v1/voice/config` - Provider capability booleans (never keys)
- `POST /api/v1/voice/tts` - ElevenLabs synthesis (audio/mpeg stream)

### WebSocket
- `ws://localhost:3010/ws` - Real-time event stream (Desktop subscribes)
- `ws://localhost:3010/ws/voice/stt` - Deepgram live STT audio relay

### Approval Engine + owner-approval workflow
- `POST /api/v1/approval/classify` - Deterministic decision classification
- `GET /api/v1/approval/audit` - JSONL audit trail
- `GET /api/v1/approval/pending` - Dispatches awaiting the owner (`?all=true` includes resolved)
- `POST /api/v1/approval/pending/:id/approve` - Approve → creates the real MC task now
- `POST /api/v1/approval/pending/:id/deny` - Deny (optional `{reason}`) → nothing is created

## Project Structure

```
jarvis/
├── core/                   # Jarvis Core Service (Node.js/Express)
│   ├── src/
│   │   ├── api/routes/     # API route handlers
│   │   ├── services/       # Core services
│   │   ├── config/         # Configuration
│   │   └── utils/          # Utilities
│   ├── package.json
│   └── tsconfig.json
├── desktop/                # Jarvis Desktop (React/Vite)
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── hooks/          # Custom hooks
│   │   ├── stores/         # Zustand stores
│   │   └── styles/         # CSS styles
│   ├── package.json
│   └── vite.config.ts
├── shared/                 # Shared types and constants
│   ├── types/
│   └── constants/
├── scripts/                # Launch scripts
│   ├── start-jarvis.sh
│   ├── stop-jarvis.sh
│   └── status.sh
├── memory/                 # Memory persistence
├── logs/                   # Service logs
└── README.md
```

## Configuration

Environment variables (see `.env.example`):

| Variable | Default | Description |
|----------|---------|-------------|
| `JARVIS_CORE_PORT` | 3010 | Jarvis Core service port |
| `JARVIS_DESKTOP_PORT` | 3011 | Jarvis Desktop port |
| `MISSION_CONTROL_URL` | http://localhost:3002 | Mission Control URL |
| `OPENCLAW_GATEWAY_URL` | http://localhost:18789 | OpenClaw Gateway URL |
| `LOG_LEVEL` | info | Logging level |

## Development

### Start Core Only

```bash
cd jarvis/core
npm install
npm run dev
```

### Start Desktop Only

```bash
cd jarvis/desktop
npm install
npm run dev
```

### Build for Production

```bash
# Build Core
cd jarvis/core
npm run build

# Build Desktop
cd jarvis/desktop
npm run build
```

## Safety & Constraints

Jarvis operates under strict safety constraints:

- **No Direct OpenClaw Access** - All communication goes through Mission Control
- **No Code Execution** - Jarvis never executes code directly
- **Approval Required** - All actions requiring approval go through the Approval Engine
- **Local Memory Only** - By default, all memory is stored locally
- **No Auto-Start** - Services must be started manually

## Integration with Mission Control

Jarvis integrates with Mission Control through:

1. **Read Operations** - Task status, project data, agent information
   (read-through proxies; MC is the single system of record)
2. **Task Creation** (implemented 2026-07-09) - Every request is decided by
   the Approval Engine first: approved work is created immediately
   (`assigned_to` = `KIAROS_MC_ASSIGNEE`, default `main`); project-level
   work waits in the owner-approval queue; dangerous work is rejected
3. **Health Monitoring** - Service status aggregation via MonitorService

## Roadmap

### Complete (see CURRENT_PHASE.md for the authoritative record)
- ✅ Core Service + Desktop Application (6 UI modes, KiarosFace default)
- ✅ LLM-backed conversation (model-agnostic) + persistent memory
- ✅ Voice: push-to-talk + hands-free loop; cloud STT/TTS opt-in via proxy
- ✅ Approval Engine (deterministic) — wired into dispatch
- ✅ Mission Control integration: reads + approval-gated task creation
- ✅ Owner-approval workflow (API + Desktop panel)

### Future (owner-gated)
- Mobile Application
- Browser Automation
- Computer Control
- Advanced AI Reasoning / streaming replies / prompt caching

## License

Proprietary - All rights reserved.

## Support

For issues or questions, please refer to the Mission Control documentation or contact the development team.
