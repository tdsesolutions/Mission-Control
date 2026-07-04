#!/bin/bash

# Jarvis Service Launcher
# Starts Jarvis Core and Desktop services

set -e

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
LOGS_DIR="$JARVIS_DIR/logs"
PID_DIR="$JARVIS_DIR/.pids"

# Create necessary directories
mkdir -p "$LOGS_DIR"
mkdir -p "$PID_DIR"
mkdir -p "$JARVIS_DIR/memory"

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

wait_for_service() {
    local port=$1
    local name=$2
    local timeout=${3:-30}
    local count=0
    
    log_info "Waiting for $name on port $port..."
    
    while ! check_port "$port"; do
        if [ $count -ge $timeout ]; then
            log_error "Timeout waiting for $name"
            return 1
        fi
        sleep 1
        ((count++))
    done
    
    log_success "$name is ready"
    return 0
}

# Check if services are already running
check_existing() {
    local running=0
    
    if check_port $JARVIS_CORE_PORT; then
        log_warning "Jarvis Core is already running on port $JARVIS_CORE_PORT"
        running=1
    fi
    
    if check_port $JARVIS_DESKTOP_PORT; then
        log_warning "Jarvis Desktop is already running on port $JARVIS_DESKTOP_PORT"
        running=1
    fi
    
    if [ $running -eq 1 ]; then
        log_info "Use ./stop-jarvis.sh to stop existing services first"
        exit 1
    fi
}

# Start Jarvis Core
start_core() {
    log_info "Starting Jarvis Core Service..."
    
    cd "$JARVIS_DIR/core"
    
    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        log_info "Installing dependencies..."
        npm install
    fi
    
    # Start the service
    npm run dev > "$LOGS_DIR/core.log" 2>&1 &
    local pid=$!
    echo $pid > "$PID_DIR/core.pid"
    
    if wait_for_service $JARVIS_CORE_PORT "Jarvis Core" 30; then
        log_success "Jarvis Core started (PID: $pid)"
        log_info "Health check: http://localhost:$JARVIS_CORE_PORT/health"
    else
        log_error "Failed to start Jarvis Core"
        exit 1
    fi
}

# Start Jarvis Desktop
start_desktop() {
    log_info "Starting Jarvis Desktop Application..."
    
    cd "$JARVIS_DIR/desktop"
    
    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        log_info "Installing dependencies..."
        npm install
    fi
    
    # Start the service
    npm run dev > "$LOGS_DIR/desktop.log" 2>&1 &
    local pid=$!
    echo $pid > "$PID_DIR/desktop.pid"
    
    if wait_for_service $JARVIS_DESKTOP_PORT "Jarvis Desktop" 30; then
        log_success "Jarvis Desktop started (PID: $pid)"
        log_info "Access: http://localhost:$JARVIS_DESKTOP_PORT"
    else
        log_error "Failed to start Jarvis Desktop"
        exit 1
    fi
}

# Print status
print_status() {
    echo ""
    echo "========================================"
    echo "  Jarvis Services Status"
    echo "========================================"
    echo ""
    echo "Jarvis Core:     http://localhost:$JARVIS_CORE_PORT"
    echo "Jarvis Desktop:  http://localhost:$JARVIS_DESKTOP_PORT"
    echo ""
    echo "Logs: $LOGS_DIR"
    echo ""
    echo "To stop: ./scripts/stop-jarvis.sh"
    echo "========================================"
}

# Main execution
main() {
    echo "========================================"
    echo "  Starting Jarvis AI Executive"
    echo "========================================"
    echo ""
    
    # Check for existing services
    check_existing
    
    # Start services
    start_core
    echo ""
    start_desktop
    
    # Print status
    print_status
}

# Handle script termination
trap 'log_error "Script interrupted"; exit 1' INT TERM

main "$@"
