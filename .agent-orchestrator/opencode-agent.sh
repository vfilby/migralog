#!/bin/bash
# opencode-agent.sh - Wrapper to run opencode in agent workspace
# Usage: opencode-agent.sh <agent-id> [opencode-args...]

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
shift || true

if [ -z "$AGENT_ID" ]; then
    log_error "Usage: opencode-agent.sh <agent-id> [opencode-args...]"
    exit 1
fi

# Check if agent exists
WORKSPACE_DIR="$PROJECT_ROOT/.agent-workspaces/$AGENT_ID"
METADATA_FILE="$WORKSPACE_DIR/metadata.json"

if [ ! -f "$METADATA_FILE" ]; then
    log_error "Agent $AGENT_ID not found"
    echo "Available agents:"
    find "$PROJECT_ROOT/.agent-workspaces" -name "metadata.json" -exec dirname {} \; 2>/dev/null | while read -r dir; do
        if [ -f "$dir/metadata.json" ]; then
            jq -r '"\(.id): \(.branch)"' "$dir/metadata.json"
        fi
    done
    exit 1
fi

# Read metadata
METADATA=$(cat "$METADATA_FILE")
USE_DOCKER=$(echo "$METADATA" | jq -r '.use_docker')
WORKTREE_DIR=$(echo "$METADATA" | jq -r '.worktree_dir')
BRANCH_NAME=$(echo "$METADATA" | jq -r '.branch')
ISSUE_ID=$(echo "$METADATA" | jq -r '.issue_id')
ISSUE_TITLE=$(echo "$METADATA" | jq -r '.issue_title')

if [ ! -d "$WORKTREE_DIR" ]; then
    log_error "Worktree directory not found: $WORKTREE_DIR"
    exit 1
fi

log_info "Starting OpenCode for agent $AGENT_ID"
echo "  📋 Issue: $ISSUE_ID - $ISSUE_TITLE"
echo "  🌿 Branch: $BRANCH_NAME"
echo "  📁 Workspace: $WORKTREE_DIR"
echo "  🐳 Docker: $USE_DOCKER"
echo ""

# Check if OpenCode is available
if ! command -v opencode >/dev/null 2>&1; then
    log_error "OpenCode CLI not found"
    echo "Install OpenCode first:"
    echo "  npm install -g @sst/opencode"
    exit 1
fi

# Function to run opencode locally
run_opencode_local() {
    local worktree_dir="$1"
    shift
    
    log_info "Running OpenCode in local environment"
    cd "$worktree_dir"
    
    # Set environment variables for the agent
    export AGENT_ID="$AGENT_ID"
    export AGENT_ISSUE_ID="$ISSUE_ID"
    export AGENT_BRANCH="$BRANCH_NAME"
    export AGENT_WORKSPACE="$worktree_dir"
    
    # Create agent context file for OpenCode
    cat > ".opencode-agent-context.md" <<EOF
# Agent Context

**Agent ID:** $AGENT_ID
**Issue:** $ISSUE_ID - $ISSUE_TITLE
**Branch:** $BRANCH_NAME
**Workspace:** $worktree_dir

## Available Commands

\`\`\`bash
# Run tests
../.agent-orchestrator/agent-cli.sh test $AGENT_ID

# Request feedback
../.agent-orchestrator/agent-cli.sh feedback $AGENT_ID "Your question here"

# Check agent status
../.agent-orchestrator/agent-cli.sh info $AGENT_ID
\`\`\`

## Important Notes

- You are working in an isolated git worktree
- All changes are on branch: $BRANCH_NAME
- Run tests before committing: \`npm run precommit\`
- Use feedback command if you need user input
- This workspace will be cleaned up when task is complete

EOF
    
    log_success "OpenCode starting with agent context..."
    
    # Run OpenCode with agent-specific context
    if [ $# -eq 0 ]; then
        # No additional args, start OpenCode normally
        opencode
    else
        # Pass through additional arguments
        opencode "$@"
    fi
}

# Function to run opencode in Docker
run_opencode_docker() {
    local workspace_dir="$1"
    shift
    
    log_info "Running OpenCode in Docker environment"
    cd "$workspace_dir"
    
    # Check if container is running
    if ! docker compose ps | grep -q "running"; then
        log_error "Docker container is not running"
        log_info "Starting container..."
        
        if ! docker compose up -d; then
            log_error "Failed to start Docker container"
            exit 1
        fi
        
        # Wait for container to be ready
        local retries=10
        while [ $retries -gt 0 ]; do
            if docker compose ps | grep -q "running"; then
                break
            fi
            log_info "Waiting for container to start... ($retries retries left)"
            sleep 2
            ((retries--))
        done
        
        if [ $retries -eq 0 ]; then
            log_error "Container failed to start"
            docker compose logs
            exit 1
        fi
    fi
    
    # Create agent context file inside container
    docker compose exec -T agent-workspace bash -c "cat > /workspace/.opencode-agent-context.md" <<EOF
# Agent Context (Docker)

**Agent ID:** $AGENT_ID
**Issue:** $ISSUE_ID - $ISSUE_TITLE
**Branch:** $BRANCH_NAME
**Environment:** Docker Container

## Available Commands (inside container)

\`\`\`bash
# Run tests
cd /workspace/app && npm run precommit

# Check git status
git status

# Commit changes
git commit -m "Your commit message"
\`\`\`

## Important Notes

- You are working inside a Docker container
- All changes are on branch: $BRANCH_NAME
- Container has full development environment
- Use docker compose exec agent-workspace bash for shell access

EOF
    
    log_success "OpenCode starting in Docker container..."
    
    # Check if OpenCode is available in container
    if docker compose exec -T agent-workspace bash -c "command -v opencode" >/dev/null 2>&1; then
        # Run OpenCode inside container
        if [ $# -eq 0 ]; then
            docker compose exec agent-workspace bash -c "cd /workspace && opencode"
        else
            docker compose exec agent-workspace bash -c "cd /workspace && opencode $*"
        fi
    else
        log_warning "OpenCode not available in container"
        log_info "Starting interactive shell instead..."
        log_info "You can install OpenCode with: npm install -g @sst/opencode"
        
        docker compose exec agent-workspace bash -c "cd /workspace && bash"
    fi
}

# Function to setup agent working environment
setup_agent_environment() {
    local worktree_dir="$1"
    
    cd "$worktree_dir"
    
    # Create or update .opencode directory with agent-specific config
    mkdir -p .opencode
    
    # Create agent-specific OpenCode configuration
    cat > ".opencode/agent-config.json" <<EOF
{
  "agent_id": "$AGENT_ID",
  "issue_id": "$ISSUE_ID",
  "branch": "$BRANCH_NAME",
  "workspace": "$worktree_dir",
  "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
    
    # Create .env file for agent-specific environment variables
    cat > ".env.agent" <<EOF
# Agent Environment Variables
AGENT_ID=$AGENT_ID
AGENT_ISSUE_ID=$ISSUE_ID
AGENT_BRANCH=$BRANCH_NAME
AGENT_WORKSPACE=$worktree_dir
EOF
    
    # Add agent context to git (but don't commit)
    git add .opencode-agent-context.md .opencode/agent-config.json .env.agent 2>/dev/null || true
}

# Update agent metadata to mark as active
update_agent_status() {
    local status="$1"
    local updated_metadata
    
    updated_metadata=$(echo "$METADATA" | jq --arg status "$status" \
        '. + {
            "last_activity": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'",
            "opencode_status": $status
        }')
    
    echo "$updated_metadata" > "$METADATA_FILE"
}

# Cleanup function
cleanup() {
    log_info "Cleaning up OpenCode session..."
    update_agent_status "stopped"
    
    # Remove temporary files
    if [ -d "$WORKTREE_DIR" ]; then
        cd "$WORKTREE_DIR"
        rm -f .opencode-agent-context.md .env.agent 2>/dev/null || true
        rm -rf .opencode/agent-config.json 2>/dev/null || true
    fi
}

# Set up signal handlers
trap cleanup EXIT INT TERM

# Setup agent environment
setup_agent_environment "$WORKTREE_DIR"

# Update agent status
update_agent_status "starting"

# Main execution
if [ "$USE_DOCKER" = "true" ]; then
    update_agent_status "running_docker"
    run_opencode_docker "$WORKSPACE_DIR" "$@"
else
    update_agent_status "running_local"
    run_opencode_local "$WORKTREE_DIR" "$@"
fi

# Update status when done
update_agent_status "completed"

log_success "OpenCode session completed for agent $AGENT_ID"
echo ""
echo "Next steps:"
echo "  1. Review changes: cd $WORKTREE_DIR && git status"
echo "  2. Run tests: ./.agent-orchestrator/agent-cli.sh test $AGENT_ID"
echo "  3. Commit changes: cd $WORKTREE_DIR && git commit -m 'Your message'"
echo "  4. Push branch: cd $WORKTREE_DIR && git push origin $BRANCH_NAME"
echo "  5. Create PR: cd $WORKTREE_DIR && gh pr create --base main"
echo "  6. Cleanup: ./.agent-orchestrator/agent-cli.sh cleanup $AGENT_ID"