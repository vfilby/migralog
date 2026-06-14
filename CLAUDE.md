# CLAUDE.md

This file provides guidance for AI agents working on this codebase.

## Project Structure
- `mobile-apps/ios/` — Native iOS Swift app (primary)
- `spec/` — Shared specifications, wireframes, data models, test specs
- `spec/ios/` — iOS-specific specs (iCloud sync, CloudKit schemas)

## Essential Info
- **Working Directory**: `/mobile-apps/ios`
- **Branch Rule**: NEVER commit to main — always use feature/bugfix branches
- **Health Data**: HIPAA compliance — never log sensitive information
- **Build from spec**: Reference `spec/` for data models, wireframes, test specs
- **Tests**: `xcodebuild test -scheme MigraLog -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.0'`
- Never blame tests for being "flaky" — investigate the actual issue

## Definition of Done — you own a change end to end
Opening a PR is NOT done. For any change you make, you are responsible for it landing and deploying, without being asked:
1. **Merge it.** Enable auto-merge right after opening the PR (`gh pr merge <pr> --auto --squash`). Do not stop at "PR submitted."
2. **Monitor PR CI.** Poll the PR's checks to completion (`gh pr checks <pr>`). If a check fails, fix it — don't hand back a red or pending state.
3. **Monitor the post-merge deploy.** A merge to `main` touching `mobile-apps/ios/**` triggers the `[iOS] Release Pipeline` (TestFlight). After merge, find that run (`gh run list --limit 8`) and poll it to completion (`gh run view <id> --json status,conclusion`). If it fails, read `gh run view <id> --log-failed` and fix.
4. **Only then is the task done.** Report success once the deploy is green.

Exceptions: do NOT auto-merge if the user says not to, or if you judge the change high-risk — in that case say so and ask.
