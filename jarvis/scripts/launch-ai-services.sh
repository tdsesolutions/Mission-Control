#!/bin/bash
# launch-ai-services.sh — coordinated launch per the B10 launcher plan,
# amended by the governing documents (they win over the plan):
#   - OpenClaw Gateway is NEVER started/stopped/reconfigured here
#     (OPENCLAW_INTEGRATION.md); it is health-VERIFIED only.
#   - Mission Control is owner-managed (non-Kiaros port); verified only.
#   - This script manages ONLY the Kiaros services (3010, 3011).
#   - Protected ports are never used or killed (LOCALHOST_CONFLICT_POLICY.md).
#   - Unbuilt extension services (3012-3016) are skipped gracefully.
#
# Usage: ./launch-ai-services.sh [--mode=core|standard|full]   (mode affects
# only reporting; unbuilt services are skipped in every mode)

set -u

MODE="core"
for arg in "$@"; do
  case "$arg" in
    --mode=*) MODE="${arg#--mode=}" ;;
  esac
done

JARVIS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

port_up() { lsof -Pi :"$1" -sTCP:LISTEN -t >/dev/null 2>&1; }

health() {
  curl -s -m 8 -o /dev/null -w "%{http_code}" "$1" 2>/dev/null
}

echo "== AI service launch (mode: $MODE) =="

# Phase 1: pre-flight (read-only)
echo "-- Pre-flight port check --"
"$JARVIS_DIR/scripts/check-ai-services.sh" | sed 's/^/   /'

# Phase 2: verify core dependencies (NEVER started here)
echo "-- Dependency verification (verify-only) --"
if [ "$(health http://127.0.0.1:18789/health)" = "200" ]; then
  echo "   [OK]   OpenClaw Gateway healthy (18789)"
else
  echo "   [WARN] OpenClaw Gateway not healthy — it is externally managed; continuing (gateway-optional)"
fi
if [ "$(health http://127.0.0.1:3002/api/health)" = "200" ]; then
  echo "   [OK]   Mission Control healthy (3002)"
else
  echo "   [WARN] Mission Control not healthy — owner-managed; Kiaros will run degraded for MC reads"
fi

# Phase 3: Kiaros services
if port_up 3010 && port_up 3011; then
  echo "   [OK]   Kiaros Core + Desktop already running"
else
  echo "-- Starting Kiaros services --"
  "$JARVIS_DIR/scripts/start-jarvis.sh"
fi

# Phase 4: extension/infrastructure services — graceful degradation
echo "-- Extension services --"
for entry in "3012 Memory-Service" "3013 Voice-Service" "3014 Computer-Control" "3015 Service-Monitor" "3016 Notification-Service"; do
  set -- $entry
  echo "   [SKIP] $2 ($1): not built (reserved) — skipping per conflict policy"
done

# Phase 5: verification
echo "-- Post-launch verification --"
if [ "$(health http://127.0.0.1:3010/health)" = "200" ]; then
  echo "   [OK]   Kiaros Core healthy"
else
  echo "   [FAIL] Kiaros Core not healthy"
  exit 1
fi
if port_up 3011; then
  echo "   [OK]   Kiaros Desktop serving"
else
  echo "   [FAIL] Kiaros Desktop not serving"
  exit 1
fi
echo "== Launch complete =="
