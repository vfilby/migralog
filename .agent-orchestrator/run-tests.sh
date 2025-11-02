#!/bin/bash
# run-tests.sh - Runs pre-commit tests in agent workspace
# Usage: run-tests.sh <agent-id>

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
    log_error "Usage: run-tests.sh <agent-id>"
    exit 1
fi

# Get agent metadata
METADATA_FILE="$PROJECT_ROOT/.agent-workspaces/$AGENT_ID/metadata.json"

if [ ! -f "$METADATA_FILE" ]; then
    log_error "Agent $AGENT_ID not found"
    exit 1
fi

# Read metadata
METADATA=$(cat "$METADATA_FILE")
USE_DOCKER=$(echo "$METADATA" | jq -r '.use_docker')
WORKTREE_DIR=$(echo "$METADATA" | jq -r '.worktree_dir')
WORKSPACE_DIR=$(echo "$METADATA" | jq -r '.workspace_dir')

if [ ! -d "$WORKTREE_DIR" ]; then
    log_error "Worktree directory not found: $WORKTREE_DIR"
    exit 1
fi

log_info "Running pre-commit tests for agent $AGENT_ID"
echo "  Workspace: $WORKTREE_DIR"
echo "  Docker: $USE_DOCKER"
echo ""

# Function to run tests
run_tests() {
    local test_dir="$1"
    
    cd "$test_dir/app"
    
    if [ ! -f package.json ]; then
        log_error "package.json not found in $test_dir/app"
        return 1
    fi
    
    # Check if required scripts exist
    local has_lint has_typecheck has_test_ci
    has_lint=$(jq -r '.scripts["test:lint:ci"] // empty' package.json)
    has_typecheck=$(which tsc >/dev/null 2>&1 && echo "true" || echo "false")
    has_test_ci=$(jq -r '.scripts["test:ci"] // empty' package.json)
    
    # Run linting
    if [ -n "$has_lint" ]; then
        log_info "Running ESLint..."
        if npm run test:lint:ci; then
            log_success "Linting passed"
        else
            log_error "Linting failed"
            return 1
        fi
    else
        log_warning "No lint script found, skipping"
    fi
    
    echo ""
    
    # Run type checking
    if [ "$has_typecheck" = "true" ]; then
        log_info "Running TypeScript type checking..."
        if npx tsc --noEmit; then
            log_success "Type checking passed"
        else
            log_error "Type checking failed"
            return 1
        fi
    else
        log_warning "TypeScript not available, skipping type check"
    fi
    
    echo ""
    
    # Run unit tests
    if [ -n "$has_test_ci" ]; then
        log_info "Running unit tests..."
        if npm run test:ci; then
            log_success "Unit tests passed"
        else
            log_error "Unit tests failed"
            return 1
        fi
    else
        log_warning "No test:ci script found, skipping unit tests"
    fi
    
    return 0
}

# Function to run tests in Docker
run_tests_docker() {
    local workspace_dir="$1"
    
    cd "$workspace_dir"
    
    # Check if container is running
    if ! docker compose ps | grep -q "running"; then
        log_error "Docker container is not running"
        log_info "Starting container..."
        docker compose up -d
        
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
            return 1
        fi
    fi
    
    log_info "Running tests inside Docker container..."
    
    # Run each test step in container
    local failed=false
    
    # Linting
    log_info "Running ESLint in container..."
    if docker compose exec -T agent-workspace bash -c "cd /workspace/app && npm run test:lint:ci"; then
        log_success "Linting passed"
    else
        log_error "Linting failed"
        failed=true
    fi
    
    echo ""
    
    # Type checking
    log_info "Running TypeScript type checking in container..."
    if docker compose exec -T agent-workspace bash -c "cd /workspace/app && npx tsc --noEmit"; then
        log_success "Type checking passed"
    else
        log_error "Type checking failed"
        failed=true
    fi
    
    echo ""
    
    # Unit tests
    log_info "Running unit tests in container..."
    if docker compose exec -T agent-workspace bash -c "cd /workspace/app && npm run test:ci"; then
        log_success "Unit tests passed"
    else
        log_error "Unit tests failed"
        failed=true
    fi
    
    if [ "$failed" = "true" ]; then
        return 1
    fi
    
    return 0
}

# Main execution
if [ "$USE_DOCKER" = "true" ]; then
    log_info "Running tests in Docker environment"
    if run_tests_docker "$WORKSPACE_DIR"; then
        echo ""
        log_success "All pre-commit tests passed! ✨"
        log_info "Ready to commit changes"
    else
        echo ""
        log_error "Pre-commit tests failed!"
        log_info "Fix the issues before committing"
        exit 1
    fi
else
    log_info "Running tests in local environment"
    if run_tests "$WORKTREE_DIR"; then
        echo ""
        log_success "All pre-commit tests passed! ✨"
        log_info "Ready to commit changes"
    else
        echo ""
        log_error "Pre-commit tests failed!"
        log_info "Fix the issues before committing"
        exit 1
    fi
fi

# Optional: Run additional checks
log_info "Running additional checks..."

# Check for TODO comments in changed files
cd "$WORKTREE_DIR"
if git diff --name-only HEAD^ 2>/dev/null | xargs grep -l "TODO\|FIXME\|XXX" 2>/dev/null; then
    log_warning "Found TODO/FIXME comments in changed files"
    log_info "Consider addressing these before committing:"
    git diff --name-only HEAD^ 2>/dev/null | xargs grep -n "TODO\|FIXME\|XXX" 2>/dev/null || true
    echo ""
fi

# Check for console.log statements in production code
if git diff --name-only HEAD^ 2>/dev/null | grep -E '\.(ts|tsx|js|jsx)$' | xargs grep -l "console\.log" 2>/dev/null; then
    log_warning "Found console.log statements in changed files"
    log_info "Consider removing debug logs before committing:"
    git diff --name-only HEAD^ 2>/dev/null | grep -E '\.(ts|tsx|js|jsx)$' | xargs grep -n "console\.log" 2>/dev/null || true
    echo ""
fi

log_success "Pre-commit validation complete!"
echo ""
echo "Next steps:"
echo "  1. Review changes: cd $WORKTREE_DIR && git status"
echo "  2. Commit changes: git commit -m 'Your commit message'"
echo "  3. Push to remote: git push origin $(git branch --show-current)"
echo "  4. Create PR: gh pr create --base main"