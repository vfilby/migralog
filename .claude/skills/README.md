# Project Skills

Claude Code skills specific to MigraLog.

## Available Skills

### release

Runs the MigraLog Swift release process for TestFlight alpha builds.
Executes pre-release checks (tests, git state), then triggers the
`Deploy Swift to TestFlight` workflow.

**Triggers when:**
- User asks to release, deploy, or ship a build to TestFlight
- User asks to "cut a build" or "release alpha"

See `release/SKILL.md` for the full procedure.

## Adding New Skills

1. Create skill via the `skill-creator` skill in Claude Code.
2. Drop the packaged skill into `.claude/skills/<your-skill-name>/`.
3. Commit so the team can use it.
