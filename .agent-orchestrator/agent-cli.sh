#!/bin/bash
# agent-cli.sh - Main CLI interface for agent orchestrator
# Usage: agent-cli.sh <command> [args...]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
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

# Check dependencies
check_dependencies() {
    local missing=()
    
    if ! command -v jq >/dev/null 2>&1; then
        missing+=("jq")
    fi
    
    if ! command -v bd >/dev/null 2>&1; then
        missing+=("bd (beads)")
    fi
    
    if [ ${#missing[@]} -ne 0 ]; then
        log_error "Missing dependencies: ${missing[*]}"
        echo "Install with:"
        for dep in "${missing[@]}"; do
            case $dep in
                "jq") echo "  brew install jq" ;;
                "bd (beads)") echo "  pip install beads-cli" ;;
            esac
        done
        exit 1
    fi
}

# Get agent metadata
get_agent_metadata() {
    local agent_id="$1"
    local metadata_file="$PROJECT_ROOT/.agent-workspaces/$agent_id/metadata.json"
    
    if [ ! -f "$metadata_file" ]; then
        log_error "Agent $agent_id not found"
        exit 1
    fi
    
    cat "$metadata_file"
}

# Validate agent exists
validate_agent() {
    local agent_id="$1"
    if [ ! -d "$PROJECT_ROOT/.agent-workspaces/$agent_id" ]; then
        log_error "Agent $agent_id does not exist"
        echo "Available agents:"
        list_agents
        exit 1
    fi
}

# List all agents
list_agents() {
    local workspaces_dir="$PROJECT_ROOT/.agent-workspaces"
    
    if [ ! -d "$workspaces_dir" ] || [ -z "$(ls -A "$workspaces_dir" 2>/dev/null)" ]; then
        echo "No active agents"
        return
    fi
    
    echo "Active agents:"
    for workspace in "$workspaces_dir"/*/; do
        if [ -f "${workspace}metadata.json" ]; then
            local metadata
            metadata=$(cat "${workspace}metadata.json")
            local agent_id status branch issue_title
            agent_id=$(echo "$metadata" | jq -r '.id')
            status=$(echo "$metadata" | jq -r '.status')
            branch=$(echo "$metadata" | jq -r '.branch')
            issue_title=$(echo "$metadata" | jq -r '.issue_title')
            
            printf "  %-10s %s [%s]\n" "$agent_id:" "$branch" "$status"
            printf "  %-10s %s\n" "" "→ $issue_title"
        fi
    done
}

# Create new agent workspace
cmd_create() {
    check_dependencies
    
    local agent_id="$1"
    local issue_id="$2"
    local use_docker="${3:-false}"
    
    if [ -z "$agent_id" ]; then
        log_error "Usage: agent-cli.sh create <agent-id> [issue-id] [use-docker]"
        echo "Examples:"
        echo "  agent-cli.sh create agent-1 bd-14 false    # With issue"
        echo "  agent-cli.sh create dev-shell              # General development shell"
        echo "  agent-cli.sh create debug-env --docker     # Docker development shell"
        exit 1
    fi
    
    # Handle special flags
    if [ "$issue_id" = "true" ] || [ "$issue_id" = "--docker" ]; then
        use_docker="true"
        issue_id=""
    fi
    if [ "$use_docker" = "true" ] || [ "$use_docker" = "--docker" ]; then
        use_docker="true"
    fi
    
    # If no issue_id provided, create a general development shell
    if [ -z "$issue_id" ]; then
        log_info "Creating general development workspace: $agent_id"
        "$SCRIPT_DIR/spawn-agent.sh" "$agent_id" "" "$use_docker"
        return
    fi
    
    # Validate issue exists if provided
    if ! bd show "$issue_id" >/dev/null 2>&1; then
        log_error "Issue $issue_id not found in bd"
        echo "Available issues:"
        bd ready --json 2>/dev/null | jq -r '.[] | "  \(.id): \(.title)"' || echo "  No ready issues"
        echo ""
        echo "Or create without issue ID for general development:"
        echo "  agent-cli.sh create $agent_id [--docker]"
        exit 1
    fi
    
    log_info "Creating agent workspace: $agent_id for issue $issue_id"
    "$SCRIPT_DIR/spawn-agent.sh" "$agent_id" "$issue_id" "$use_docker"
}

# Show agent status
cmd_status() {
    list_agents
}

# Run tests in agent workspace
cmd_test() {
    local agent_id="$1"
    
    if [ -z "$agent_id" ]; then
        log_error "Usage: agent-cli.sh test <agent-id>"
        exit 1
    fi
    
    validate_agent "$agent_id"
    
    log_info "Running tests for agent $agent_id"
    "$SCRIPT_DIR/run-tests.sh" "$agent_id"
}

# Run opencode in agent workspace
cmd_code() {
    local agent_id="$1"
    shift # Remove agent_id from args
    
    if [ -z "$agent_id" ]; then
        log_error "Usage: agent-cli.sh code <agent-id> [opencode-args...]"
        exit 1
    fi
    
    validate_agent "$agent_id"
    
    log_info "Starting opencode for agent $agent_id"
    "$SCRIPT_DIR/opencode-agent.sh" "$agent_id" "$@"
}

# Access agent shell (Docker containers)
cmd_shell() {
    local agent_id="$1"
    
    if [ -z "$agent_id" ]; then
        log_error "Usage: agent-cli.sh shell <agent-id>"
        exit 1
    fi
    
    validate_agent "$agent_id"
    
    local metadata
    metadata=$(get_agent_metadata "$agent_id")
    local use_docker
    use_docker=$(echo "$metadata" | jq -r '.use_docker')
    
    if [ "$use_docker" != "true" ]; then
        log_error "Agent $agent_id is not using Docker"
        log_info "For Tier 1 agents, access the worktree directly:"
        local worktree_dir
        worktree_dir=$(echo "$metadata" | jq -r '.worktree_dir')
        echo "  cd $worktree_dir"
        exit 1
    fi
    
    local workspace_dir
    workspace_dir=$(echo "$metadata" | jq -r '.workspace_dir')
    
    log_info "Accessing shell for agent $agent_id"
    cd "$workspace_dir"
    
    if ! docker compose ps | grep -q "running"; then
        log_error "Container not running. Starting..."
        docker compose up -d
        sleep 5
    fi
    
    log_success "Connecting to agent container shell..."
    docker compose exec agent-workspace /home/agent/shell-access.sh
}

# Monitor agent logs (Docker containers)
cmd_logs() {
    local agent_id="$1"
    local follow="${2:-false}"
    
    if [ -z "$agent_id" ]; then
        log_error "Usage: agent-cli.sh logs <agent-id> [follow]"
        exit 1
    fi
    
    validate_agent "$agent_id"
    
    local metadata
    metadata=$(get_agent_metadata "$agent_id")
    local use_docker
    use_docker=$(echo "$metadata" | jq -r '.use_docker')
    
    if [ "$use_docker" != "true" ]; then
        log_error "Agent $agent_id is not using Docker"
        exit 1
    fi
    
    local workspace_dir
    workspace_dir=$(echo "$metadata" | jq -r '.workspace_dir')
    
    cd "$workspace_dir"
    
    if [ "$follow" = "true" ] || [ "$follow" = "f" ]; then
        log_info "Following logs for agent $agent_id (Ctrl+C to exit)"
        docker compose logs -f
    else
        log_info "Showing logs for agent $agent_id"
        docker compose logs --tail=50
    fi
}

# Stop agent container
cmd_stop() {
    local agent_id="$1"
    
    if [ -z "$agent_id" ]; then
        log_error "Usage: agent-cli.sh stop <agent-id>"
        exit 1
    fi
    
    validate_agent "$agent_id"
    
    local metadata
    metadata=$(get_agent_metadata "$agent_id")
    local use_docker
    use_docker=$(echo "$metadata" | jq -r '.use_docker')
    
    if [ "$use_docker" != "true" ]; then
        log_warning "Agent $agent_id is not using Docker"
        exit 0
    fi
    
    local workspace_dir
    workspace_dir=$(echo "$metadata" | jq -r '.workspace_dir')
    
    log_info "Stopping agent $agent_id container"
    cd "$workspace_dir"
    docker compose stop
    
    log_success "Agent $agent_id container stopped"
}

# Start agent container
cmd_start() {
    local agent_id="$1"
    
    if [ -z "$agent_id" ]; then
        log_error "Usage: agent-cli.sh start <agent-id>"
        exit 1
    fi
    
    validate_agent "$agent_id"
    
    local metadata
    metadata=$(get_agent_metadata "$agent_id")
    local use_docker
    use_docker=$(echo "$metadata" | jq -r '.use_docker')
    
    if [ "$use_docker" != "true" ]; then
        log_warning "Agent $agent_id is not using Docker"
        exit 0
    fi
    
    local workspace_dir
    workspace_dir=$(echo "$metadata" | jq -r '.workspace_dir')
    
    log_info "Starting agent $agent_id container"
    cd "$workspace_dir"
    docker compose up -d
    
    log_success "Agent $agent_id container started"
}

# Request feedback from user
cmd_feedback() {
    local agent_id="$1"
    local message="$2"
    
    if [ -z "$agent_id" ] || [ -z "$message" ]; then
        log_error "Usage: agent-cli.sh feedback <agent-id> \"<message>\""
        exit 1
    fi
    
    validate_agent "$agent_id"
    
    log_info "Requesting feedback for agent $agent_id"
    "$SCRIPT_DIR/feedback-request.sh" "$agent_id" "$message"
}

# Cleanup agent workspace
cmd_cleanup() {
    local agent_id="$1"
    
    if [ -z "$agent_id" ]; then
        log_error "Usage: agent-cli.sh cleanup <agent-id>"
        exit 1
    fi
    
    validate_agent "$agent_id"
    
    log_info "Cleaning up agent workspace: $agent_id"
    "$SCRIPT_DIR/cleanup-agent.sh" "$agent_id"
}

# Cleanup all idle agents
cmd_cleanup_all() {
    local workspaces_dir="$PROJECT_ROOT/.agent-workspaces"
    local cleaned=0
    
    if [ ! -d "$workspaces_dir" ]; then
        log_info "No agents to cleanup"
        return
    fi
    
    log_info "Cleaning up all idle agents..."
    
    for workspace in "$workspaces_dir"/*/; do
        if [ -f "${workspace}metadata.json" ]; then
            local agent_id
            agent_id=$(basename "$workspace")
            
            # Check if any processes are running in the workspace
            local worktree_dir
            worktree_dir=$(jq -r '.worktree_dir' "${workspace}metadata.json")
            
            if [ -d "$worktree_dir" ]; then
                # Check for running processes (opencode, npm, etc.)
                if ! pgrep -f "$worktree_dir" >/dev/null 2>&1; then
                    log_info "Cleaning up idle agent: $agent_id"
                    "$SCRIPT_DIR/cleanup-agent.sh" "$agent_id"
                    ((cleaned++))
                else
                    log_warning "Agent $agent_id appears to be active, skipping"
                fi
            else
                log_warning "Agent $agent_id has missing worktree, force cleaning"
                "$SCRIPT_DIR/cleanup-agent.sh" "$agent_id"
                ((cleaned++))
            fi
        fi
    done
    
    log_success "Cleaned up $cleaned idle agents"
}

# Show agent details
cmd_info() {
    local agent_id="$1"
    
    if [ -z "$agent_id" ]; then
        log_error "Usage: agent-cli.sh info <agent-id>"
        exit 1
    fi
    
    validate_agent "$agent_id"
    
    local metadata
    metadata=$(get_agent_metadata "$agent_id")
    
    echo "Agent Details:"
    echo "  ID: $(echo "$metadata" | jq -r '.id')"
    echo "  Issue: $(echo "$metadata" | jq -r '.issue_id')"
    echo "  Branch: $(echo "$metadata" | jq -r '.branch')"
    echo "  Status: $(echo "$metadata" | jq -r '.status')"
    echo "  Created: $(echo "$metadata" | jq -r '.created_at')"
    echo "  Docker: $(echo "$metadata" | jq -r '.use_docker')"
    echo "  Ports:"
    echo "    Expo: $(echo "$metadata" | jq -r '.ports.expo')"
    echo "    Metro: $(echo "$metadata" | jq -r '.ports.metro')"
    echo "  Issue Title: $(echo "$metadata" | jq -r '.issue_title')"
    echo "  Workspace: $(echo "$metadata" | jq -r '.workspace_dir')"
    echo "  Worktree: $(echo "$metadata" | jq -r '.worktree_dir')"
    
    # Show git status
    local worktree_dir
    worktree_dir=$(echo "$metadata" | jq -r '.worktree_dir')
    
    if [ -d "$worktree_dir" ]; then
        echo ""
        echo "Git Status:"
        cd "$worktree_dir"
        git status --short || echo "  No changes"
    fi
}

# Show help
cmd_help() {
    cat << EOF
Agent Orchestrator CLI

USAGE:
    agent-cli.sh <command> [args...]

COMMANDS:
    create <agent-id> [issue-id] [use-docker]
        Create new agent workspace
        Examples: 
          agent-cli.sh create agent-1 bd-14 false    # With specific issue
          agent-cli.sh create dev-shell               # General development
          agent-cli.sh create debug-env --docker     # Docker dev environment

    status
        List all active agents

    info <agent-id>
        Show detailed information about an agent

    code <agent-id> [opencode-args...]
        Run opencode in agent workspace
        Example: agent-cli.sh code agent-1

    shell <agent-id>
        Access interactive shell in Docker container
        Example: agent-cli.sh shell agent-1

    logs <agent-id> [follow]
        Show Docker container logs
        Example: agent-cli.sh logs agent-1 follow

    start <agent-id>
        Start Docker container for agent
        Example: agent-cli.sh start agent-1

    stop <agent-id>
        Stop Docker container for agent
        Example: agent-cli.sh stop agent-1

    test <agent-id>
        Run pre-commit tests in agent workspace

    feedback <agent-id> "<message>"
        Request feedback from user
        Example: agent-cli.sh feedback agent-1 "Should I use CSS or styled-components?"

    cleanup <agent-id>
        Remove agent workspace and cleanup resources

    cleanup-all
        Remove all idle agent workspaces

    help
        Show this help message

EXAMPLES:
    # Create agent for specific issue
    agent-cli.sh create agent-1 bd-14

    # Create general development shell
    agent-cli.sh create dev-shell

    # Create Docker development environment
    agent-cli.sh create docker-dev --docker

    # List active agents
    agent-cli.sh status

    # Start coding with agent
    agent-cli.sh code agent-1

    # Access shell in Docker agent
    agent-cli.sh shell docker-dev

    # Run tests before committing
    agent-cli.sh test agent-1

    # Cleanup when done
    agent-cli.sh cleanup agent-1

For more information, see .agent-orchestrator/README.md
EOF
}

# Main command dispatcher
main() {
    local command="$1"
    shift || true
    
    case "$command" in
        create)
            cmd_create "$@"
            ;;
        status)
            cmd_status "$@"
            ;;
        info)
            cmd_info "$@"
            ;;
        test)
            cmd_test "$@"
            ;;
        code)
            cmd_code "$@"
            ;;
        shell)
            cmd_shell "$@"
            ;;
        logs)
            cmd_logs "$@"
            ;;
        stop)
            cmd_stop "$@"
            ;;
        start)
            cmd_start "$@"
            ;;
        feedback)
            cmd_feedback "$@"
            ;;
        cleanup)
            cmd_cleanup "$@"
            ;;
        cleanup-all)
            cmd_cleanup_all "$@"
            ;;
        help|--help|-h)
            cmd_help
            ;;
        "")
            log_error "No command specified"
            echo ""
            cmd_help
            exit 1
            ;;
        *)
            log_error "Unknown command: $command"
            echo ""
            cmd_help
            exit 1
            ;;
    esac
}

# Run main function
main "$@"