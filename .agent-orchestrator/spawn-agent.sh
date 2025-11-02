#!/bin/bash
# spawn-agent.sh - Creates isolated workspace for an agent
# Usage: spawn-agent.sh <agent-id> [use-docker] [branch-name] [task-prompt]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Check dependencies
command -v jq >/dev/null 2>&1 || { echo "Error: jq is required but not installed"; exit 1; }

# Parse arguments
AGENT_ID="$1"
USE_DOCKER="${2:-false}"
CUSTOM_BRANCH="$3"
TASK_PROMPT="$4"

if [ -z "$AGENT_ID" ]; then
    echo "Usage: spawn-agent.sh <agent-id> [use-docker] [branch-name] [task-prompt]"
    echo "Examples:"
    echo "  spawn-agent.sh agent-1                                     # Auto-generated branch"
    echo "  spawn-agent.sh agent-1 true                                # With Docker"
    echo "  spawn-agent.sh agent-1 true fix/custom-branch              # Custom branch"
    echo "  spawn-agent.sh agent-1 true fix/bug \"Fix the login bug\"   # With task prompt"
    exit 1
fi

# Set branch name (custom or auto-generated)
BRANCH_NAME="${CUSTOM_BRANCH:-agent/$AGENT_ID/dev-$(date +%Y%m%d-%H%M%S)}"

# Create workspace paths
WORKSPACE_DIR="$PROJECT_ROOT/.agent-workspaces/$AGENT_ID"

# Check if agent already exists
if [ -d "$WORKSPACE_DIR" ]; then
    echo "Error: Agent workspace $AGENT_ID already exists"
    echo "Use cleanup-agent.sh first or choose different agent ID"
    exit 1
fi

echo "🚀 Creating agent workspace for $AGENT_ID..."
echo "   Branch: $BRANCH_NAME"
echo "   Docker: $USE_DOCKER"
if [ -n "$TASK_PROMPT" ]; then
    echo "   Task: $TASK_PROMPT"
    echo "   Auto-start: Enabled (with all permissions)"
fi

# Check resource limits
MAX_AGENTS=3
ACTIVE_COUNT=$(find "$PROJECT_ROOT/.agent-workspaces" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')

if [ "$ACTIVE_COUNT" -ge "$MAX_AGENTS" ]; then
    echo "Error: Maximum agent limit reached ($MAX_AGENTS)"
    echo "Active agents:"
    find "$PROJECT_ROOT/.agent-workspaces" -name "metadata.json" -exec dirname {} \; 2>/dev/null | while read -r dir; do
        if [ -f "$dir/metadata.json" ]; then
            jq -r '"\(.id): \(.branch) [\(.status)]"' "$dir/metadata.json"
        fi
    done
    exit 1
fi

# Create workspace directory
mkdir -p "$WORKSPACE_DIR"

# Assign unique ports for this agent
BASE_PORT=8100
AGENT_NUM=$(echo "$AGENT_ID" | sed 's/agent-//')
EXPO_PORT=$((BASE_PORT + AGENT_NUM))
METRO_PORT=$((19000 + AGENT_NUM))

# Note: Git clone will happen inside the container on first start
# This keeps the workspace isolated and simplifies cleanup

echo "📝 Creating agent metadata..."
# Create agent metadata with task prompt if provided
TASK_JSON=""
if [ -n "$TASK_PROMPT" ]; then
    TASK_JSON=",\n  \"task_prompt\": $(echo "$TASK_PROMPT" | jq -R .),\n  \"auto_start\": true,\n  \"permissions_granted\": true"
fi

cat > "$WORKSPACE_DIR/metadata.json" <<EOF
{
  "id": "$AGENT_ID",
  "branch": "$BRANCH_NAME",
  "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "use_docker": $USE_DOCKER,
  "status": "active",
  "ports": {
    "expo": $EXPO_PORT,
    "metro": $METRO_PORT
  },
  "workspace_dir": "$WORKSPACE_DIR"$TASK_JSON
}
EOF

# Setup Docker if requested
if [ "$USE_DOCKER" = "true" ]; then
    echo "🐳 Setting up Docker environment..."
    
    # Check if Docker is running
    if ! docker info >/dev/null 2>&1; then
        echo "Error: Docker is not running"
        cd "$PROJECT_ROOT"
        rm -rf "$WORKSPACE_DIR"
        exit 1
    fi

    # Build base image if it doesn't exist
    if ! docker image inspect migralog-agent-workspace:latest >/dev/null 2>&1; then
        echo "🔨 Building base agent image (one-time build, ~2-3 minutes)..."
        echo "   → This image will be shared by all agents"
        echo ""
        cd "$SCRIPT_DIR"

        # Build without filtering to see all output
        if docker build -t migralog-agent-workspace:latest -f Dockerfile . ; then
            echo ""
            echo "✅ Base image built successfully"
            echo ""
        else
            echo ""
            echo "❌ Failed to build base image"
            cd "$PROJECT_ROOT"
            rm -rf "$WORKSPACE_DIR" 2>/dev/null || true
            exit 1
        fi
    else
        echo "✅ Using existing base image: migralog-agent-workspace:latest"
    fi

    # Create docker-compose.yml from template with all environment variables
    export AGENT_ID="$AGENT_ID"
    export BRANCH_NAME="$BRANCH_NAME"
    export PROJECT_ROOT="$PROJECT_ROOT"
    export EXPO_PORT="$EXPO_PORT"
    export METRO_PORT="$METRO_PORT"
    export ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-}"
    export TASK_PROMPT="${TASK_PROMPT:-}"

    envsubst < "$SCRIPT_DIR/docker-compose.template.yml" > "$WORKSPACE_DIR/docker-compose.yml"

    # Start container
    cd "$WORKSPACE_DIR"
    echo "🚀 Starting container..."
    docker compose up -d --remove-orphans

    # Wait a few seconds for container to initialize
    sleep 3

    # Check if container is running (use docker ps instead of compose ps)
    container_name="agent-${AGENT_ID}"
    if ! docker ps --filter "name=${container_name}" --filter "status=running" --format "{{.Names}}" | grep -q "^${container_name}$"; then
        echo "❌ Container failed to start"
        echo "Logs:"
        docker compose logs
        echo ""
        echo "⚠️  Cleaning up failed workspace..."
        cd "$PROJECT_ROOT"

        # Stop any containers
        cd "$WORKSPACE_DIR"
        docker compose down --volumes 2>/dev/null || true
        cd "$PROJECT_ROOT"

        # Clean up workspace
        xattr -cr "$WORKSPACE_DIR" 2>/dev/null || true
        rm -rf "$WORKSPACE_DIR" 2>/dev/null || true

        exit 1
    fi

    echo "✅ Container is running"
fi

echo ""
echo "✅ Agent workspace ready!"
echo "   Agent ID: $AGENT_ID"
echo "   Workspace: $WORKSPACE_DIR"
echo "   Branch: $BRANCH_NAME"
if [ "$USE_DOCKER" = "true" ]; then
    echo "   Ports: Expo=$EXPO_PORT, Metro=$METRO_PORT"
fi
echo ""

# For Docker agents, either auto-start with task or launch shell
if [ "$USE_DOCKER" = "true" ]; then
    if [ -n "$TASK_PROMPT" ]; then
        echo "🤖 Starting interactive OpenCode with task..."
        echo "   Task: $TASK_PROMPT"
        echo ""
        cd "$WORKSPACE_DIR"
        # Execute OpenCode interactively with task in the container
        # Write prompt to a temp file to avoid shell quoting issues
        echo "$TASK_PROMPT" > "$WORKSPACE_DIR/task-prompt.txt"
        # Export PATH to include OpenCode and bd
        # Use --prompt with file contents
        exec docker compose exec agent-workspace bash -c "export PATH=\"\$HOME/.opencode/bin:\$HOME/go/bin:\$PATH\" && cd /workspace/app && opencode --prompt \"\$(cat /workspace/task-prompt.txt)\""
    else
        echo "🐚 Launching container shell..."
        echo ""
        cd "$WORKSPACE_DIR"
        exec docker compose exec agent-workspace /home/agent/shell-access.sh
    fi
else
    if [ -n "$TASK_PROMPT" ]; then
        echo "🤖 Task auto-start is only supported with Docker mode (use-docker=true)"
        echo ""
    fi
    echo "Next steps:"
    echo "   Run tests: ./.agent-orchestrator/agent-cli.sh test $AGENT_ID"
    echo "   Check status: ./.agent-orchestrator/agent-cli.sh status"
    echo ""
fi