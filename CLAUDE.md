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
