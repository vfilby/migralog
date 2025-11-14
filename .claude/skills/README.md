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

## Adding New Skills

To add new project-specific skills:

1. Create skill using the `skill-creator` skill in Claude Code
2. Package the skill
3. Extract to `.claude/skills/your-skill-name/`
4. Commit to version control to share with the team
