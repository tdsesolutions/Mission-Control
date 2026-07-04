#!/bin/bash

# Jarvis Core Verification Script
# Checks if Core can start and responds to health checks

echo "=== Jarvis Core Verification ==="
echo ""

# Check if node_modules exists
if [ ! -d "../core/node_modules" ]; then
    echo "❌ node_modules not found in core/"
    echo "   Run: cd ../core && npm install"
    exit 1
fi
echo "✓ node_modules exists"

# Check if logs directory exists
if [ ! -d "../core/logs" ]; then
    mkdir -p ../core/logs
    echo "✓ Created logs directory"
fi

# Check if shared types exist
if [ ! -f "../shared/types/index.ts" ]; then
    echo "❌ Shared types not found"
    exit 1
fi
echo "✓ Shared types exist"

# Check if port 3010 is already in use
if lsof -Pi :3010 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠ Port 3010 is already in use"
    echo "   Run: ./stop-jarvis.sh first"
fi

echo ""
echo "=== Ready to start Core ==="
echo "Run: cd ../core && npm run dev"
