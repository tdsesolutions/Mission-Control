#!/bin/bash

# Jarvis Service Stopper
# Stops Jarvis Core and Desktop services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
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

stop_service() {
    local name=$1
    local pid_file="$PID_DIR/$2.pid"
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            log_info "Stopping $name (PID: $pid)..."
            kill "$pid" 2>/dev/null || true
            
            # Wait for process to stop
            local count=0
            while kill -0 "$pid" 2>/dev/null && [ $count -lt 10 ]; do
                sleep 1
                ((count++))
            done
            
            # Force kill if still running
            if kill -0 "$pid" 2>/dev/null; then
                log_warning "$name did not stop gracefully, forcing..."
                kill -9 "$pid" 2>/dev/null || true
            fi
            
            log_success "$name stopped"
        else
            log_warning "$name is not running"
        fi
        rm -f "$pid_file"
    else
        log_warning "No PID file found for $name"
    fi
}

# Main execution
main() {
    echo "========================================"
    echo "  Stopping Jarvis AI Executive"
    echo "========================================"
    echo ""
    
    stop_service "Jarvis Desktop" "desktop"
    stop_service "Jarvis Core" "core"
    
    echo ""
    log_success "All Jarvis services stopped"
}

# Handle script termination
trap 'log_error "Script interrupted"; exit 1' INT TERM

main "$@"
