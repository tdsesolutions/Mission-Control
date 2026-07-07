#!/bin/bash
# stop-ai-services.sh — stops ONLY the Kiaros services (ports 3010/3011).
# Governing constraints (COMPONENT_OWNERSHIP §8): never kill processes on
# protected or non-Kiaros ports — the OpenClaw Gateway (18789) and Mission
# Control (3002) are never touched by this tooling.

set -u

JARVIS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "== Stopping Kiaros services (gateway and Mission Control are never touched) =="
"$JARVIS_DIR/scripts/stop-jarvis.sh"
