# Agent Orchestrator

A hybrid containerization system that enables multiple OpenCode agents to work simultaneously on different branches without interference.

## Overview

The Agent Orchestrator provides two tiers of isolation:

- **Tier 1 (Git Worktrees)**: Lightweight isolation using git worktrees and separate working directories
- **Tier 2 (Docker)**: Full environment isolation using Docker containers

This allows multiple agents to work on different issues simultaneously while maintaining complete separation of their environments.

## Quick Start

### 1. Check Available Issues

```bash
bd ready --json | jq '.[] | {id: .id, title: .title}'
```

### 2. Create Agent Workspace

```bash
# Tier 1 (Git worktrees only - recommended)
./.agent-orchestrator/agent-cli.sh create agent-1 bd-14

# Tier 2 (With Docker isolation)
./.agent-orchestrator/agent-cli.sh create agent-2 bd-20 true

# Auto-start with task (Docker only, all permissions granted)
./.agent-orchestrator/spawn-agent.sh agent-3 true fix/bug-123 "Fix the login authentication bug"
```

### 3. Start Working

```bash
# Start OpenCode in agent workspace
./.agent-orchestrator/agent-cli.sh code agent-1

# Run tests before committing
./.agent-orchestrator/agent-cli.sh test agent-1

# Request user feedback
./.agent-orchestrator/agent-cli.sh feedback agent-1 "Should I use CSS or styled-components?"
```

### 4. Cleanup When Done

```bash
# Clean up single agent
./.agent-orchestrator/agent-cli.sh cleanup agent-1

# Clean up all idle agents
./.agent-orchestrator/agent-cli.sh cleanup-all
```

## Architecture

```
MigraineTracker/
├── .agent-orchestrator/           # Orchestration scripts
│   ├── agent-cli.sh              # Main CLI interface
│   ├── spawn-agent.sh            # Create workspace
│   ├── cleanup-agent.sh          # Remove workspace
│   ├── run-tests.sh              # Test runner
│   ├── opencode-agent.sh         # OpenCode wrapper
│   ├── feedback-request.sh       # User feedback
│   ├── docker-compose.template.yml
│   ├── Dockerfile
│   └── README.md
├── .agent-workspaces/             # Agent workspaces (git-ignored)
│   ├── agent-1/                  # First agent
│   │   ├── worktree/            # Git worktree
│   │   ├── metadata.json        # Agent metadata
│   │   └── docker-compose.yml   # Docker config (if using)
│   └── agent-2/                  # Second agent
└── .git/worktrees/               # Git worktree storage
```

## Commands Reference

### Core Commands

#### `create <agent-id> <issue-id> [use-docker]`

Creates a new agent workspace.

```bash
# Examples
./.agent-orchestrator/agent-cli.sh create agent-1 bd-14          # Tier 1
./.agent-orchestrator/agent-cli.sh create agent-2 bd-20 true     # Tier 2
```

**What it does:**
- Creates git worktree on branch `agent/{agent-id}/{issue-id}`
- Installs npm dependencies in isolation
- Assigns unique ports (Expo: 8100+N, Metro: 19000+N)
- Sets up Docker container (if requested)
- Updates bd issue status to `in_progress`

#### `status`

Lists all active agents.

```bash
./.agent-orchestrator/agent-cli.sh status
```

**Output:**
```
Active agents:
  agent-1:   agent/agent-1/bd-14 [active]
             → Improve sparkline gradient styling
  agent-2:   agent/agent-2/bd-20 [active]  
             → Improve ongoing episode card styling
```

#### `info <agent-id>`

Shows detailed information about an agent.

```bash
./.agent-orchestrator/agent-cli.sh info agent-1
```

#### `code <agent-id> [opencode-args...]`

Starts OpenCode in the agent workspace.

```bash
./.agent-orchestrator/agent-cli.sh code agent-1
```

**Features:**
- Changes to correct worktree directory
- Sets agent-specific environment variables
- Creates `.opencode-agent-context.md` with helpful information
- Runs inside Docker container if configured

#### `test <agent-id>`

Runs pre-commit tests in the agent workspace.

```bash
./.agent-orchestrator/agent-cli.sh test agent-1
```

**Tests run:**
- ESLint: `npm run test:lint:ci`
- TypeScript: `npx tsc --noEmit`
- Unit tests: `npm run test:ci`
- Additional checks (TODO comments, console.log)

#### `feedback <agent-id> "<message>"`

Requests feedback from the user.

```bash
./.agent-orchestrator/agent-cli.sh feedback agent-1 "Should I use opacity 10% or 20%?"
```

**What it does:**
- Creates a bd issue with priority 0 (urgent)
- Sends desktop notification (macOS)
- Waits for user response (5 minute timeout)
- Links feedback to original issue

#### `cleanup <agent-id>`

Removes an agent workspace.

```bash
./.agent-orchestrator/agent-cli.sh cleanup agent-1
```

**What it does:**
- Checks for uncommitted changes (warns user)
- Stops Docker containers (if using Docker)
- Removes git worktree
- Optionally deletes git branch
- Updates bd issue status
- Cleans up Docker resources

#### `cleanup-all`

Removes all idle agent workspaces.

```bash
./.agent-orchestrator/agent-cli.sh cleanup-all
```

### Workflow Examples

#### Auto-Start Agent with Task (Recommended)

```bash
# Launch agent with task and auto-start OpenCode (all permissions granted)
./.agent-orchestrator/spawn-agent.sh agent-1 true fix/login-bug "Fix the authentication timeout issue in the login flow"

# OpenCode will start automatically with the task
# All permissions are pre-granted, no manual approval needed
# Agent works autonomously on the specified task

# When done, check the work
cd .agent-workspaces/agent-1
git status

# Run tests
./.agent-orchestrator/agent-cli.sh test agent-1

# Commit and push
git commit -m "fix: resolve authentication timeout in login flow"
git push origin fix/login-bug

# Create PR
gh pr create --base main

# Cleanup
./.agent-orchestrator/agent-cli.sh cleanup agent-1
```

**Benefits:**
- ✅ No manual permission approval needed
- ✅ Agent starts working immediately
- ✅ Perfect for autonomous task execution
- ✅ Full Docker isolation for safety

**Requirements:**
- Must use Docker mode (`use-docker=true`)
- Requires `ANTHROPIC_API_KEY` environment variable
- OpenCode must be installed in the Docker image

#### Single Agent Workflow (Manual Start)

```bash
# 1. Create agent for issue
./.agent-orchestrator/agent-cli.sh create agent-1 bd-14

# 2. Start coding
./.agent-orchestrator/agent-cli.sh code agent-1

# (Inside OpenCode, make changes...)

# 3. Run tests
./.agent-orchestrator/agent-cli.sh test agent-1

# 4. Commit and push
cd .agent-workspaces/agent-1/worktree
git add .
git commit -m "Fix: Improve sparkline gradient styling"
git push origin agent/agent-1/bd-14

# 5. Create PR
gh pr create --base main --head agent/agent-1/bd-14

# 6. Cleanup
./.agent-orchestrator/agent-cli.sh cleanup agent-1
```

#### Parallel Agents Workflow

```bash
# Terminal 1: Agent 1 working on sparkline styling
./.agent-orchestrator/agent-cli.sh create agent-1 bd-14
./.agent-orchestrator/agent-cli.sh code agent-1

# Terminal 2: Agent 2 working on episode cards
./.agent-orchestrator/agent-cli.sh create agent-2 bd-20  
./.agent-orchestrator/agent-cli.sh code agent-2

# Terminal 3: Monitor status
./.agent-orchestrator/agent-cli.sh status

# When done, cleanup all
./.agent-orchestrator/agent-cli.sh cleanup-all
```

#### Feedback Request Example

```bash
# Agent needs user input
./.agent-orchestrator/agent-cli.sh feedback agent-1 "Found 3 CSS approaches: styled-components, emotion, vanilla CSS. Which should I use?"

# User gets notification and bd issue
# User responds via bd issue or terminal prompt
# Agent continues with guidance
```

## Tier Comparison

| Feature | Tier 1 (Worktrees) | Tier 2 (Docker) |
|---------|-------------------|------------------|
| **Setup Time** | Fast (~30s) | Slower (~2-3min) |
| **Progress Feedback** | Minimal | Detailed (build steps, container state, timing) |
| **Resource Usage** | Low | Medium |
| **Isolation Level** | File system only | Full environment |
| **Node.js Version** | Host system | Container-specific (Node.js 20) |
| **Dependencies** | Installed on host | Installed in container |
| **Best For** | Quick iterations | Complex dependencies |

### When to Use Tier 2 (Docker)

- Different Node.js versions needed
- Conflicting global packages
- Testing environment-specific behavior
- Complete isolation required
- CI/CD pipeline testing

### When to Use Tier 1 (Worktrees)

- Quick iterations and testing
- Standard development workflow
- Resource constraints
- Simple dependency requirements

### Progress Feedback (Tier 2)

Docker setup provides detailed progress feedback to keep you informed during the 2-3 minute setup:

**Build Phase:**
- Time estimate (2-3 minutes)
- Key installation steps shown in real-time
- Docker build steps (Step 1/25, Step 2/25, etc.)
- Major operations highlighted (apt-get, npm install -g, user setup)

**Container Startup:**
- Container state monitoring
- Elapsed time tracking
- Retry countdown

**Dependency Installation:**
- Time estimate (1-2 minutes)
- npm install progress
- Package count summary

This ensures you're never left wondering if the process is still running or hung.

## Configuration

### Resource Limits

Edit `spawn-agent.sh` to adjust:

```bash
MAX_AGENTS=3        # Maximum concurrent agents
BASE_PORT=8100      # Starting port for agents
```

### Docker Configuration

Modify `Dockerfile` for different base images or tools:

```dockerfile
# Use different Node version
FROM node:18-bullseye

# Add custom tools
RUN npm install -g your-custom-tool
```

### Pre-commit Tests

Modify `run-tests.sh` to add custom test steps:

```bash
# Add your custom tests
echo "Running custom validation..."
your-custom-test-command
```

## Troubleshooting

### Common Issues

#### "Agent workspace already exists"

```bash
# Check existing agents
./.agent-orchestrator/agent-cli.sh status

# Cleanup existing agent
./.agent-orchestrator/agent-cli.sh cleanup agent-1
```

#### "Maximum agent limit reached"

```bash
# Clean up idle agents
./.agent-orchestrator/agent-cli.sh cleanup-all

# Or increase limit in spawn-agent.sh
```

#### "Docker container failed to start"

```bash
# Check Docker logs
cd .agent-workspaces/agent-1
docker compose logs

# Restart Docker service
docker system prune
```

#### "Git worktree remove failed"

```bash
# Force remove
rm -rf .agent-workspaces/agent-1
git worktree prune
```

#### "Tests failing in Docker"

```bash
# Run tests manually
cd .agent-workspaces/agent-1
docker compose exec agent-workspace bash
cd /workspace/app
npm run test:lint:ci
```

### Debug Mode

Enable debug output:

```bash
# Add to any script
set -x

# Or run with debug
bash -x ./.agent-orchestrator/agent-cli.sh status
```

### Logs

Check agent logs:

```bash
# Feedback request log
tail -f .agent-orchestrator/feedback.log

# Docker logs
docker compose logs -f
```

## Integration with bd (beads)

The orchestrator integrates seamlessly with bd for issue tracking:

### Automatic Updates

- **Agent creation**: Sets issue status to `in_progress`
- **Feedback requests**: Creates linked priority-0 issues
- **Agent cleanup**: Removes agent assignment notes

### Manual bd Commands

```bash
# Check ready issues
bd ready --json

# View issue details
bd show bd-14 --json

# Update issue status
bd update bd-14 --status completed
```

## Security Considerations

### Docker Security

- Containers run as non-root user
- Limited access to host system
- No privileged mode required

### Git Security

- Each agent has isolated worktree
- No shared state between agents
- Clean branch isolation

### Network Security

- Unique ports per agent prevent conflicts
- No external network access required
- Local development only

## Performance Tips

### Tier 1 Optimization

```bash
# Use npm cache
npm config set cache ~/.npm-cache-shared

# Link common dependencies
ln -s ../node_modules_shared node_modules
```

### Tier 2 Optimization

```bash
# Pre-build base image
docker build -t agent-base .agent-orchestrator/

# Use volume caching
docker volume create agent-npm-cache
```

### Resource Management

```bash
# Monitor resource usage
docker stats

# Clean up unused resources
docker system prune -a
```

## Contributing

### Adding New Commands

1. Add function to `agent-cli.sh`:

```bash
cmd_your_command() {
    local agent_id="$1"
    # Your implementation
}
```

2. Add to main dispatcher:

```bash
your-command)
    cmd_your_command "$@"
    ;;
```

### Extending Docker Environment

1. Modify `Dockerfile` to add tools
2. Update `docker-compose.template.yml` for new services
3. Test with sample agent

### Adding Test Steps

1. Edit `run-tests.sh`
2. Add new validation logic
3. Test with existing agents

## FAQ

**Q: Can I run agents on different branches?**
A: Yes! Each agent gets its own branch: `agent/{agent-id}/{issue-id}`

**Q: Do agents share dependencies?**
A: Tier 1: Can share if using same node_modules. Tier 2: Completely isolated.

**Q: Can I switch between Tier 1 and Tier 2?**
A: Not directly. You need to cleanup and recreate the agent.

**Q: What happens if I kill an agent process?**
A: The workspace remains. Use `cleanup` to remove it properly.

**Q: Can agents work on the same issue?**
A: Not recommended. Use different agent IDs and coordinate manually.

**Q: How do I backup agent state?**
A: Commit frequently. Workspaces are temporary and cleaned up.

**Q: Can I run agents on remote machines?**
A: Not currently. This is designed for local development.

## License

Same as the main project.