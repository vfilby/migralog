# AGENTS.md

This file provides guidance for AI agents working on this codebase.

## Testing

### E2E Test Troubleshooting

If E2E tests are failing or hanging:
1. Run `npm run test:e2e:rebuild` for a full clean rebuild
2. Restart the Expo dev server
3. Kill all iOS simulators and restart them
4. Note: Sometimes the log box prevents proper app restart - close it before rerunning tests

**Important**: Never blame the tests for being "flaky". If tests fail, investigate the actual issue (dev server state, build state, cache state, etc.).