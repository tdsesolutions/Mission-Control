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

Jarvis supports 5 distinct visualization modes:

1. **Orb Mode** - Animated pulsing orb with rotating rings
2. **Sphere Mode** - 3D wireframe sphere with rotating core
3. **Wave Mode** - Expanding wave animations
4. **HUD Mode** - Information dashboard with system metrics
5. **Ambient Mode** - Subtle gradient background

### Core Capabilities

- **Mission Control Integration** - Read task status, create approved tasks
- **Project Monitoring** - Track project progress and metrics
- **Memory System** - Short-term and long-term memory persistence
- **Health Monitoring** - Service health checks and status aggregation
- **Event System** - Real-time event streaming via WebSocket
- **Conversation Interface** - Natural language interaction

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

### Tasks
- `GET /api/v1/tasks` - List tasks
- `POST /api/v1/tasks` - Create task
- `GET /api/v1/tasks/:id` - Get task
- `PATCH /api/v1/tasks/:id` - Update task
- `DELETE /api/v1/tasks/:id` - Delete task

### Projects
- `GET /api/v1/projects` - List projects
- `POST /api/v1/projects` - Create project
- `GET /api/v1/projects/:id` - Get project
- `PATCH /api/v1/projects/:id` - Update project
- `DELETE /api/v1/projects/:id` - Delete project

### Memory
- `GET /api/v1/memory` - List memory keys
- `GET /api/v1/memory/:key` - Get memory value
- `POST /api/v1/memory/:key` - Set memory value
- `DELETE /api/v1/memory/:key` - Delete memory value

### Events
- `GET /api/v1/events` - Get system events
- `POST /api/v1/events` - Create event

### WebSocket
- `ws://localhost:3010/ws` - Real-time event stream

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
2. **Write Operations** - Task creation (requires approval)
3. **Event Streaming** - Real-time updates via WebSocket
4. **Health Monitoring** - Service status aggregation

## Roadmap

### Phase 11 (Current) - V1.0
- ✅ Core Service
- ✅ Desktop Application
- ✅ Mission Control Integration
- ✅ Memory System
- ✅ Health Monitoring
- ✅ 5 UI Modes

### Future Phases
- Voice Integration
- Mobile Application
- Browser Automation
- Computer Control
- Advanced AI Reasoning

## License

Proprietary - All rights reserved.

## Support

For issues or questions, please refer to the Mission Control documentation or contact the development team.
