---
name: release
description: Run the MigraLog Swift release process for TestFlight alpha builds. Use when the user asks to release, deploy, ship, or push a build to TestFlight. Executes pre-release checks (tests, git state), then triggers the TestFlight workflow. Also use when asked to "cut a build" or "release alpha".
---

# Release to TestFlight

## Execution Model

Run the entire release process as a **background agent** so the user can continue working. Use `Agent` with `run_in_background: true`. The agent runs all steps below and reports success or failure when done.

If a step fails, the agent should return a clear summary of what failed and why, so the user can fix and retry.

## Pre-Release Checklist

Run these steps in order.

### 1. Commit Pending Changes

```bash
git status --porcelain
```

If the working tree is dirty:
- **Feature work or bug fixes** from the current session: commit them automatically with a descriptive message. Stage specific files (not `git add -A`).
- **Ambiguous changes** (files you didn't create, unexpected modifications, sensitive files like `.env`): **stop and return** the list of unclear changes. The user will decide what to do.

### 2. Run Unit Tests

From the iOS project directory. All must pass.

```bash
cd mobile-apps/ios && xcodebuild test \
  -scheme MigraLog \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.0' \
  -only-testing:MigraLogTests \
  2>&1 | grep -E "Executed.*tests" | tail -1
```

If any test fails, **stop and return** the failure output. Do not proceed to release.

### 3. Run UI Tests

From the iOS project directory. All must pass.

```bash
cd mobile-apps/ios && xcodebuild test \
  -scheme MigraLog \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.0' \
  -only-testing:MigraLogUITests \
  2>&1 | grep -E "Executed.*tests" | tail -1
```

If any test fails, **stop and return** the failure output. Do not proceed to release.

### 4. Push to Remote

The deploy workflow triggers against whatever is on remote main. Ensure the current branch is main and code is pushed.

```bash
git push origin main
```

If on a feature branch, **stop and return** — the user needs to merge to main first.

### 5. Trigger TestFlight Build

```bash
gh workflow run "Deploy Swift to TestFlight" --repo vfilby/migralog --ref main --field bump=build
```

### 6. Monitor Deploy

Wait for the workflow to complete.

```bash
sleep 5
RUN_ID=$(gh run list --repo vfilby/migralog --workflow "Deploy Swift to TestFlight" --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch $RUN_ID --repo vfilby/migralog --exit-status
```

If the deploy fails, **stop and return** the failure output from `gh run view $RUN_ID --repo vfilby/migralog --log-failed`.

### 7. Report Result

Return a summary:
- Commit hash that was released
- Test results (unit + UI pass counts)
- TestFlight build version
- Workflow URL: `https://github.com/vfilby/migralog/actions`
