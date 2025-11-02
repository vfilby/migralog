#!/bin/bash
# cleanup-agent.sh - Removes agent workspace and cleanup resources
# Usage: cleanup-agent.sh <agent-id>

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✅${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}❌${NC} $1" >&2
}

# Parse arguments
AGENT_ID="$1"

if [ -z "$AGENT_ID" ]; then
    log_error "Usage: cleanup-agent.sh <agent-id>"
    exit 1
fi

# Check if agent exists
WORKSPACE_DIR="$PROJECT_ROOT/.agent-workspaces/$AGENT_ID"
METADATA_FILE="$WORKSPACE_DIR/metadata.json"

if [ ! -d "$WORKSPACE_DIR" ]; then
    log_warning "Agent $AGENT_ID workspace not found"
    exit 0
fi

if [ ! -f "$METADATA_FILE" ]; then
    log_warning "Agent $AGENT_ID metadata not found, proceeding with cleanup"
    METADATA="{}"
else
    METADATA=$(cat "$METADATA_FILE")
fi

log_info "Cleaning up agent workspace: $AGENT_ID"

# Extract metadata
USE_DOCKER=$(echo "$METADATA" | jq -r '.use_docker // false')
BRANCH_NAME=$(echo "$METADATA" | jq -r '.branch // empty')

echo "  Workspace: $WORKSPACE_DIR"
echo "  Branch: $BRANCH_NAME"
echo "  Docker: $USE_DOCKER"
echo ""

# Stop Docker containers and remove volumes if using Docker
if [ "$USE_DOCKER" = "true" ] && [ -f "$WORKSPACE_DIR/docker-compose.yml" ]; then
    log_info "Stopping Docker container and removing volumes..."
    cd "$WORKSPACE_DIR"

    # Stop and remove container + volumes
    if docker compose down --volumes --remove-orphans 2>/dev/null; then
        log_success "Docker container and volumes removed"
    else
        log_warning "Failed to cleanly stop Docker container"

        # Try to force remove container if it exists
        container_name="agent-${AGENT_ID}"
        if docker ps -a | grep -q "$container_name"; then
            log_info "Force removing container: $container_name"
            docker rm -f "$container_name" 2>/dev/null || true
        fi

        # Manually remove volumes
        log_info "Manually removing volumes..."
        docker volume ls -q | grep "agent-${AGENT_ID}" | xargs -r docker volume rm 2>/dev/null || true
    fi

    # Note: We use a shared base image (migralog-agent-workspace:latest)
    # so we don't remove it per-agent
fi

# Note: With Docker volumes, the git clone is isolated inside the container
# No worktree or host git cleanup needed

# Kill any running processes in the workspace
log_info "Stopping any running processes..."
if pgrep -f "$WORKSPACE_DIR" >/dev/null 2>&1; then
    pkill -f "$WORKSPACE_DIR" 2>/dev/null || true
    sleep 2
fi

# Remove workspace directory
log_info "Removing workspace directory..."

# On macOS, Docker-created files may have extended attributes preventing deletion
# Clear them proactively before attempting removal
if [[ "$OSTYPE" == "darwin"* ]] && [ -d "$WORKSPACE_DIR" ]; then
    log_info "Clearing macOS extended attributes and flags..."
    xattr -cr "$WORKSPACE_DIR" 2>/dev/null || true
    chflags -R nouchg "$WORKSPACE_DIR" 2>/dev/null || true
fi

# Try removal
if rm -rf "$WORKSPACE_DIR" 2>/dev/null; then
    log_success "Workspace directory removed"
else
    log_error "Failed to remove workspace directory"
    echo "Try manually: xattr -cr \"$WORKSPACE_DIR\" && chflags -R nouchg \"$WORKSPACE_DIR\" && rm -rf \"$WORKSPACE_DIR\""
    exit 1
fi

echo ""
log_success "Agent $AGENT_ID cleanup complete!"

# Show remaining agents
remaining=$(find "$PROJECT_ROOT/.agent-workspaces" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')
if [ "$remaining" -gt 0 ]; then
    echo ""
    log_info "Remaining active agents:"
    "$SCRIPT_DIR/agent-cli.sh" status
else
    echo ""
    log_info "No remaining active agents"
fi