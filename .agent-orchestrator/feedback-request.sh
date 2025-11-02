#!/bin/bash
# feedback-request.sh - Request feedback from user
# Usage: feedback-request.sh <agent-id> "<message>"

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
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

log_feedback() {
    echo -e "${CYAN}🤔${NC} $1"
}

# Parse arguments
AGENT_ID="$1"
MESSAGE="$2"

if [ -z "$AGENT_ID" ] || [ -z "$MESSAGE" ]; then
    log_error "Usage: feedback-request.sh <agent-id> \"<message>\""
    echo "Example: feedback-request.sh agent-1 \"Should I use CSS or styled-components?\""
    exit 1
fi

# Check if agent exists
WORKSPACE_DIR="$PROJECT_ROOT/.agent-workspaces/$AGENT_ID"
METADATA_FILE="$WORKSPACE_DIR/metadata.json"

if [ ! -f "$METADATA_FILE" ]; then
    log_error "Agent $AGENT_ID not found"
    exit 1
fi

# Read metadata
METADATA=$(cat "$METADATA_FILE")
ISSUE_ID=$(echo "$METADATA" | jq -r '.issue_id')
ISSUE_TITLE=$(echo "$METADATA" | jq -r '.issue_title')
BRANCH_NAME=$(echo "$METADATA" | jq -r '.branch')

log_feedback "Agent $AGENT_ID is requesting feedback:"
echo ""
echo "  📋 Current Issue: $ISSUE_ID - $ISSUE_TITLE"
echo "  🌿 Branch: $BRANCH_NAME"
echo ""
echo "  ❓ Question: $MESSAGE"
echo ""

# Create feedback bd issue
if command -v bd >/dev/null 2>&1; then
    log_info "Creating feedback issue in bd..."
    
    FEEDBACK_TITLE="[FEEDBACK] Agent $AGENT_ID: $MESSAGE"
    FEEDBACK_DESC="Agent $AGENT_ID needs user feedback while working on issue $ISSUE_ID.

**Context:**
- Agent: $AGENT_ID
- Working on: $ISSUE_ID - $ISSUE_TITLE
- Branch: $BRANCH_NAME

**Question:**
$MESSAGE

**Instructions:**
1. Review the agent's question
2. Provide guidance or decision
3. Update this issue with your response
4. Close this issue when feedback is provided

**Agent will be notified when this issue is closed.**"

    # Create the feedback issue
    FEEDBACK_ISSUE=$(bd create "$FEEDBACK_TITLE" \
        --type task \
        --priority 0 \
        --description "$FEEDBACK_DESC" \
        --deps "discovered-from:$ISSUE_ID" \
        --json 2>/dev/null || echo '{"id": "failed"}')
    
    FEEDBACK_ID=$(echo "$FEEDBACK_ISSUE" | jq -r '.id // "failed"')
    
    if [ "$FEEDBACK_ID" != "failed" ] && [ "$FEEDBACK_ID" != "null" ]; then
        log_success "Created feedback issue: $FEEDBACK_ID"
        
        # Update agent metadata with feedback request
        UPDATED_METADATA=$(echo "$METADATA" | jq --arg feedback_id "$FEEDBACK_ID" \
            '. + {
                "feedback_request": {
                    "id": $feedback_id,
                    "message": "'"$MESSAGE"'",
                    "created_at": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'",
                    "status": "pending"
                }
            }')
        
        echo "$UPDATED_METADATA" > "$METADATA_FILE"
    else
        log_warning "Failed to create bd issue, continuing with notification only"
        FEEDBACK_ID=""
    fi
else
    log_warning "bd not available, skipping issue creation"
    FEEDBACK_ID=""
fi

# Send desktop notification (macOS)
if command -v osascript >/dev/null 2>&1; then
    log_info "Sending desktop notification..."
    osascript -e "display notification \"$MESSAGE\" with title \"Agent $AGENT_ID Feedback Request\" subtitle \"Issue: $ISSUE_ID\""
fi

# Send terminal bell/beep
echo -e "\a"

# Create a prominent visual notification
echo ""
echo "╭─────────────────────────────────────────────────────────────╮"
echo "│                    🤔 FEEDBACK NEEDED 🤔                    │"
echo "├─────────────────────────────────────────────────────────────┤"
echo "│ Agent: $AGENT_ID"
echo "│ Issue: $ISSUE_ID"
echo "│ Question: $MESSAGE"
if [ -n "$FEEDBACK_ID" ]; then
echo "│ Feedback Issue: $FEEDBACK_ID"
fi
echo "╰─────────────────────────────────────────────────────────────╯"
echo ""

# Wait for feedback (if bd is available)
if [ -n "$FEEDBACK_ID" ]; then
    log_info "Waiting for feedback... (Press Ctrl+C to cancel)"
    log_info "You can also respond by updating bd issue $FEEDBACK_ID"
    echo ""
    
    # Poll for feedback response
    local timeout=300  # 5 minutes
    local elapsed=0
    local check_interval=10
    
    while [ $elapsed -lt $timeout ]; do
        # Check if feedback issue is closed
        if bd show "$FEEDBACK_ID" --json 2>/dev/null | jq -e '.status == "closed"' >/dev/null; then
            log_success "Feedback received!"
            
            # Get the feedback response
            FEEDBACK_RESPONSE=$(bd show "$FEEDBACK_ID" --json 2>/dev/null | jq -r '.notes // "No response provided"')
            
            echo ""
            echo "📝 Response:"
            echo "$FEEDBACK_RESPONSE"
            echo ""
            
            # Update agent metadata
            UPDATED_METADATA=$(echo "$METADATA" | jq \
                '.feedback_request.status = "resolved" | 
                 .feedback_request.response = "'"$FEEDBACK_RESPONSE"'" |
                 .feedback_request.resolved_at = "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"')
            
            echo "$UPDATED_METADATA" > "$METADATA_FILE"
            
            log_success "Agent can continue with the provided feedback"
            exit 0
        fi
        
        # Show progress
        printf "\r⏳ Waiting for feedback... (%ds/%ds)" $elapsed $timeout
        
        sleep $check_interval
        elapsed=$((elapsed + check_interval))
    done
    
    echo ""
    log_warning "Feedback timeout reached (${timeout}s)"
    log_info "Agent will continue without feedback"
    
    # Update metadata to show timeout
    UPDATED_METADATA=$(echo "$METADATA" | jq \
        '.feedback_request.status = "timeout" |
         .feedback_request.timeout_at = "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"')
    
    echo "$UPDATED_METADATA" > "$METADATA_FILE"
    
else
    # No bd available, show manual instructions
    echo "Manual feedback instructions:"
    echo "1. Review the agent's question above"
    echo "2. Provide your response/decision"
    echo "3. The agent will continue based on your guidance"
    echo ""
    echo "Press Enter when you've provided feedback to the agent..."
    read -r
    
    log_success "Feedback acknowledged, agent can continue"
fi

# Log the feedback request for history
FEEDBACK_LOG="$PROJECT_ROOT/.agent-orchestrator/feedback.log"
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) | $AGENT_ID | $ISSUE_ID | $MESSAGE" >> "$FEEDBACK_LOG"

echo ""
log_info "Feedback request completed"
echo "Agent $AGENT_ID can now continue working"