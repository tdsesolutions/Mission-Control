#!/bin/bash
# Size-capped log rotation for Kiaros services. Run every 30 min by
# com.kiaros.logrotate (launchd). When a log exceeds CAP bytes, the current
# contents move to <log>.1 (previous .1 is discarded) and the live file is
# truncated IN PLACE — launchd opens StandardOutPath with O_APPEND, so the
# writer's fd stays valid across truncation. Never mv/rm the live file.
set -u
CAP=$((20 * 1024 * 1024))   # 20 MB per log, plus one 20 MB predecessor
REPO="$(cd "$(dirname "$0")/../.." && pwd)"

LOGS=(
  "$REPO/jarvis/core/logs"/*.log
  "$REPO/jarvis/identity/logs"/*.log
  "$REPO/jarvis/core/core.log"
  "$REPO/jarvis/desktop/desktop.log"
  "$REPO/mc-dev.log"
)

for f in "${LOGS[@]}"; do
  [ -f "$f" ] || continue
  size=$(stat -f %z "$f" 2>/dev/null) || continue
  if [ "$size" -gt "$CAP" ]; then
    cp "$f" "$f.1" && : > "$f"
  fi
done
