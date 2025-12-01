
# AGENTS.md

This file provides guidance for AI agents working on this codebase.

## CRITICAL - Never Run Without Permission
- EAS builds: `npm run build:ios`, `eas build` (cost money)
- Use `npx tsc --noEmit` for validation instead

## Common Issues & Quick Fixes
- E2E test hanging: `npm run test:e2e:rebuild` + restart Expo server
- Code validation: `npm run test:ci` + `npm run test:lint`
- Never blame tests for being "flaky" - investigate the actual issue