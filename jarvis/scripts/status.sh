#!/bin/bash

# Jarvis Service Status Checker
# Checks the status of Jarvis services

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
JARVIS_CORE_PORT=3010
JARVIS_DESKTOP_PORT=3011
JARVIS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_DIR="$JARVIS_DIR/.pids"

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_port() {
    local port=$1
    if lsof -Pi :"$port" -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

check_health() {
    local port=$1
    local endpoint=$2
    
    if curl -s "http://localhost:$port$endpoint" >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

check_pid() {
    local pid_file=$1
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            return 0
        fi
    fi
    return 1
}

# Main execution
main() {
    echo "========================================"
    echo "  Jarvis Services Status"
    echo "========================================"
    echo ""
    
    # Check Jarvis Core
    echo -n "Jarvis Core (port $JARVIS_CORE_PORT): "
    if check_port $JARVIS_CORE_PORT; then
        if check_health $JARVIS_CORE_PORT "/health"; then
            log_success "RUNNING (Healthy)"
        else
            log_warning "RUNNING (Unhealthy)"
        fi
        
        if check_pid "$PID_DIR/core.pid"; then
            local pid=$(cat "$PID_DIR/core.pid")
            echo "  PID: $pid"
        fi
        echo "  URL: http://localhost:$JARVIS_CORE_PORT"
    else
        log_error "STOPPED"
    fi
    
    echo ""
    
    # Check Jarvis Desktop
    echo -n "Jarvis Desktop (port $JARVIS_DESKTOP_PORT): "
    if check_port $JARVIS_DESKTOP_PORT; then
        log_success "RUNNING"
        
        if check_pid "$PID_DIR/desktop.pid"; then
            local pid=$(cat "$PID_DIR/desktop.pid")
            echo "  PID: $pid"
        fi
        echo "  URL: http://localhost:$JARVIS_DESKTOP_PORT"
    else
        log_error "STOPPED"
    fi
    
    echo ""
    echo "========================================"
}

main "$@"
