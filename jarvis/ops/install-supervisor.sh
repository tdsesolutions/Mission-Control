#!/bin/bash
# Install/refresh the launchd supervisor for Kiaros Core + Identity plus the
# log-rotation job. Idempotent: re-running re-renders the plists from the
# templates and restarts the jobs. User-domain only — no sudo.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/../.." && pwd)"
NODE="$(command -v node)"
DEST="$HOME/Library/LaunchAgents"
DOMAIN="gui/$(id -u)"

mkdir -p "$DEST" "$REPO/jarvis/core/logs" "$REPO/jarvis/identity/logs"

for tpl in "$REPO"/jarvis/ops/launchd/*.plist.template; do
  name="$(basename "$tpl" .template)"
  sed -e "s|__REPO__|$REPO|g" -e "s|__NODE__|$NODE|g" "$tpl" > "$DEST/$name"
  plutil -lint -s "$DEST/$name"
  label="${name%.plist}"
  launchctl bootout "$DOMAIN/$label" 2>/dev/null || true
  launchctl bootstrap "$DOMAIN" "$DEST/$name"
  launchctl kickstart "$DOMAIN/$label"
  echo "installed $label"
done
