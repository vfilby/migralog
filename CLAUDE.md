# CLAUDE.md

This file provides guidance for AI agents working on this codebase.

## Project Structure
- `mobile-apps/react-native/` — React Native (Expo) app (current production app)
- `mobile-apps/ios/` — Native iOS Swift app (in development, building from spec)
- `spec/` — Shared specifications, wireframes, data models, test specs
- `spec/ios/` — iOS-specific specs (iCloud sync, CloudKit schemas)

## CRITICAL - Never Run Without Permission
- EAS builds: `npm run build:ios`, `eas build` (cost money)
- Use `npx tsc --noEmit` for validation instead

## Common Issues & Quick Fixes
- E2E test hanging: `npm run test:e2e:rebuild` + restart Expo server
- Code validation: `npm run test:ci` + `npm run test:lint`
- Never blame tests for being "flaky" - investigate the actual issue

## Essential Info — React Native
- **Working Directory**: All npm commands run from `/mobile-apps/react-native` directory
- **Primary Platform**: iOS-first (test iOS first)
- **Branch Rule**: NEVER commit to main - always use feature/bugfix branches
- **Pre-commit**: ALWAYS run `npm run precommit` before committing
- **Health Data**: HIPAA compliance - never log sensitive information

## Essential Info — iOS Swift
- **Working Directory**: `/mobile-apps/ios`
- **Build from spec**: Reference `spec/` for data models, wireframes, test specs
- **Parity goal**: Feature parity with mobile-apps/react-native/ app
