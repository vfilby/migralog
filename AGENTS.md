# AGENTS.md

This file provides guidance for AI agents working on this codebase.

## Agent Orchestrator

**IMPORTANT**: This project uses an **Agent Orchestrator** system that enables multiple OpenCode agents to work simultaneously on different branches without interference.

### Why Use the Agent Orchestrator?

- **Parallel Development**: Multiple agents can work on different issues simultaneously
- **Branch Isolation**: Each agent gets its own git worktree and branch
- **No Conflicts**: Separate working directories prevent interference
- **Pre-commit Testing**: Built-in test validation before commits
- **User Feedback**: Agents can request user input when needed
- **Resource Management**: Automatic cleanup and resource limits

### Quick Start

```bash
# Check available issues
bd ready --json | jq '.[] | {id: .id, title: .title}'

# Create agent workspace (Tier 1 - recommended)
./.agent-orchestrator/agent-cli.sh create agent-1 MigraineTracker-14

# Start working
./.agent-orchestrator/agent-cli.sh code agent-1

# Run tests before committing
./.agent-orchestrator/agent-cli.sh test agent-1

# Request user feedback if needed
./.agent-orchestrator/agent-cli.sh feedback agent-1 "Should I use CSS or styled-components?"

# Cleanup when done
./.agent-orchestrator/agent-cli.sh cleanup agent-1
```

### Commands Reference

- `create <agent-id> <issue-id> [use-docker]` - Create agent workspace
- `status` - List active agents
- `info <agent-id>` - Show agent details
- `code <agent-id>` - Start OpenCode in agent workspace
- `test <agent-id>` - Run pre-commit tests
- `feedback <agent-id> "<message>"` - Request user feedback
- `cleanup <agent-id>` - Remove agent workspace
- `cleanup-all` - Remove all idle agents

### Two-Tier Architecture

**Tier 1 (Git Worktrees)**: Lightweight isolation using git worktrees
- Fast setup (~30s)
- Low resource usage
- File system isolation only
- Best for: Quick iterations, standard development

**Tier 2 (Docker)**: Full environment isolation using containers
- Slower setup (~2-3min)
- Higher resource usage
- Complete environment isolation
- Best for: Complex dependencies, different Node versions

### Workflow Examples

#### Single Agent
```bash
./.agent-orchestrator/agent-cli.sh create agent-1 MigraineTracker-14
./.agent-orchestrator/agent-cli.sh code agent-1
# (work on issue)
./.agent-orchestrator/agent-cli.sh test agent-1
# (commit, push, create PR)
./.agent-orchestrator/agent-cli.sh cleanup agent-1
```

#### Parallel Agents
```bash
# Terminal 1
./.agent-orchestrator/agent-cli.sh create agent-1 MigraineTracker-14
./.agent-orchestrator/agent-cli.sh code agent-1

# Terminal 2
./.agent-orchestrator/agent-cli.sh create agent-2 MigraineTracker-20
./.agent-orchestrator/agent-cli.sh code agent-2

# Monitor status
./.agent-orchestrator/agent-cli.sh status
```

For complete documentation, see `.agent-orchestrator/README.md`

## Issue Tracking with bd (beads)

**IMPORTANT**: This project uses **bd (beads)** for ALL issue tracking. Do NOT use markdown TODOs, task lists, or other tracking methods.

### Why bd?

- Dependency-aware: Track blockers and relationships between issues
- Git-friendly: Auto-syncs to JSONL for version control
- Agent-optimized: JSON output, ready work detection, discovered-from links
- Prevents duplicate tracking systems and confusion

### Quick Start

**Check for ready work:**
```bash
bd ready --json
```

**Create new issues:**
```bash
bd create "Issue title" -t bug|feature|task -p 0-4 --json
bd create "Issue title" -p 1 --deps discovered-from:bd-123 --json
```

**Claim and update:**
```bash
bd update bd-42 --status in_progress --json
bd update bd-42 --priority 1 --json
```

**Complete work:**
```bash
bd close bd-42 --reason "Completed" --json
```

### Issue Types

- `bug` - Something broken
- `feature` - New functionality
- `task` - Work item (tests, docs, refactoring)
- `epic` - Large feature with subtasks
- `chore` - Maintenance (dependencies, tooling)

### Priorities

- `0` - Critical (security, data loss, broken builds)
- `1` - High (major features, important bugs)
- `2` - Medium (default, nice-to-have)
- `3` - Low (polish, optimization)
- `4` - Backlog (future ideas)

### Workflow for AI Agents

1. **Check ready work**: `bd ready` shows unblocked issues
2. **Claim your task**: `bd update <id> --status in_progress`
3. **Work on it**: Implement, test, document
4. **Discover new work?** Create linked issue:
   - `bd create "Found bug" -p 1 --deps discovered-from:<parent-id>`
5. **Complete**: `bd close <id> --reason "Done"`
6. **Commit together**: Always commit the `.beads/issues.jsonl` file together with the code changes so issue state stays in sync with code state

### Auto-Sync

bd automatically syncs with git:
- Exports to `.beads/issues.jsonl` after changes (5s debounce)
- Imports from JSONL when newer (e.g., after `git pull`)
- No manual export/import needed!

### MCP Server (Recommended)

If using Claude or MCP-compatible clients, install the beads MCP server:

```bash
pip install beads-mcp
```

Add to MCP config (e.g., `~/.config/claude/config.json`):
```json
{
  "beads": {
    "command": "beads-mcp",
    "args": []
  }
}
```

Then use `mcp__beads__*` functions instead of CLI commands.

### Important Rules

- ✅ Use bd for ALL task tracking
- ✅ Always use `--json` flag for programmatic use
- ✅ Link discovered work with `discovered-from` dependencies
- ✅ Check `bd ready` before asking "what should I work on?"
- ❌ Do NOT create markdown TODO lists
- ❌ Do NOT use external issue trackers
- ❌ Do NOT duplicate tracking systems

For more details, see README.md and QUICKSTART.md.

## Testing

### E2E Test Troubleshooting

If E2E tests are failing or hanging:
1. Run `npm run test:e2e:rebuild` for a full clean rebuild
2. Restart the Expo dev server
3. Kill all iOS simulators and restart them
4. Note: Sometimes the log box prevents proper app restart - close it before rerunning tests

**Important**: Never blame the tests for being "flaky". If tests fail, investigate the actual issue (dev server state, build state, cache state, etc.).