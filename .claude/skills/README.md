# Project Skills

This directory contains Claude Code skills specific to the MigraineTracker project.

## Available Skills

### pre-commit-validator

Automates pre-commit validation workflow to ensure code quality before commits.

**Triggers when:**
- User asks "Can I commit this?"
- User mentions committing, pushing, or creating a PR
- User asks to "run pre-commit checks"

**What it validates:**
- Linting (ESLint with zero warnings)
- TypeScript type safety (no type errors)
- All unit/integration tests passing
- Test coverage ≥80% for repositories, stores, and utilities
- Not committing directly to main/master branch

**Usage:**
The skill is automatically invoked by Claude Code when appropriate. You can also manually run the validation script:

```bash
cd app
bash ../.claude/skills/pre-commit-validator/scripts/validate.sh
```

---

### e2e-test-runner

Runs and debugs Detox E2E tests with automatic diagnostics collection and failure analysis.

**Triggers when:**
- User asks to run E2E tests, UI tests, or test:ui
- User mentions Detox testing
- User asks to debug test failures
- User mentions test screenshots or artifacts

**What it does:**
- Runs E2E tests with console output capture
- Monitors for errors in real-time
- Kills tests early on first failure (saves time)
- Collects and analyzes screenshots from failures
- Checks multiple log sources (console, artifacts, simulator)
- Identifies common failure patterns
- Provides specific fix recommendations

**Features:**
- Visual screenshot analysis with Read tool
- Database constraint error detection
- Test fixture loading verification
- Known issues reference library
- Automated monitoring script

**Usage:**
The skill is automatically invoked when you mention E2E tests. You can also use the monitoring script:

```bash
cd app

# Run all tests with monitoring
bash ../.claude/skills/e2e-test-runner/scripts/run-with-monitoring.sh

# Run specific test file
bash ../.claude/skills/e2e-test-runner/scripts/run-with-monitoring.sh e2e/medicationTracking.test.js
```

**Key Capabilities:**
- Reads error toasts from screenshots
- Searches console logs for full error messages
- Checks Detox artifact logs (enabled in .detoxrc.js)
- Uses xcrun simctl for live simulator logs
- Identifies SQL constraint errors (NOT NULL, FOREIGN KEY)
- Verifies test fixtures loaded correctly
- Compares against known issues database

## Adding New Skills

To add new project-specific skills:

1. Create skill using the `skill-creator` skill in Claude Code
2. Package the skill
3. Extract to `.claude/skills/your-skill-name/`
4. Commit to version control to share with the team
