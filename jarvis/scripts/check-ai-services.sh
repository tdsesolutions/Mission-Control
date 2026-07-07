#!/bin/bash
# check-ai-services.sh — READ-ONLY status of every registered AI service port
# (AI_SERVICE_PORT_REGISTRY.md) plus protected dev ports. Specified by the
# B10 launcher plan; implemented under the governing constraint that this
# tooling never starts, stops, or reconfigures anything.

set -u

check() {
  local port=$1 name=$2 kind=$3
  if lsof -Pi :"$port" -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "  [UP]      $name (port $port) $kind"
  else
    echo "  [DOWN]    $name (port $port) $kind"
  fi
}

echo "AI Service Port Registry status ($(date '+%Y-%m-%d %H:%M:%S'))"
echo "-- Core services (owner/system managed — never touched by this tooling) --"
check 18789 "OpenClaw Gateway" "[external]"
check 3002  "Mission Control"  "[owner-managed]"
echo "-- Kiaros services (managed by launch/stop-ai-services.sh) --"
check 3010  "Kiaros Core"      ""
check 3011  "Kiaros Desktop"   ""
echo "-- Extension/infrastructure services (RESERVED, NOT BUILT) --"
for entry in "3012 Memory-Service" "3013 Voice-Service" "3014 Computer-Control" "3015 Service-Monitor" "3016 Notification-Service"; do
  set -- $entry
  if lsof -Pi :"$1" -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "  [OCCUPIED] port $1 ($2 reserved) — something else is using it"
  else
    echo "  [reserved] port $1 ($2) — not built"
  fi
done
echo "-- Protected web-dev ports (informational; never used by AI services) --"
for port in 3000 3001 5173 8000 8080; do
  if lsof -Pi :"$port" -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "  [in use]  port $port (expected for web development)"
  else
    echo "  [free]    port $port"
  fi
done
