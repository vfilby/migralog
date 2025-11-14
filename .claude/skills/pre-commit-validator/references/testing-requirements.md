# MigraineTracker Testing Requirements

## Overview
This document outlines the testing requirements and standards for the MigraineTracker React Native application.

## Pre-Commit Requirements

**ALL of the following checks MUST pass before any commit:**

1. **TypeScript Type Checking** - No type errors
2. **Unit/Integration Tests** - All tests passing
3. **Test Coverage** - Minimum 80% coverage for:
   - Repositories (`src/database/*Repository.ts`)
   - Stores (`src/store/*.ts`)
   - Utilities (`src/utils/*.ts`)
4. **Branch Strategy** - Never commit directly to `main` or `master`

## Testing Stack

### Unit/Integration Testing
- **Framework**: Jest
- **Test Location**: `__tests__` directories alongside source files
- **Run Command**: `npm test` (from `/app` directory)
- **Coverage Command**: `npm run test:coverage`
- **Watch Mode**: `npm run test:watch`

### E2E Testing
- **Framework**: Detox
- **Test Location**: `e2e/` directory
- **Test Files**:
  - `episodeLifecycle.test.js` - Episode creation, logging, ending
  - `medicationTracking.test.js` - Medication management and dose logging
  - `dailyStatusTracking.test.js` - Daily status tracking features
- **Build Command**: `npm run test:e2e:build` (creates development build in simulator)
- **Run Command**: `npm run test:e2e` or `npm run test:e2e -- e2e/specificTest.test.js`
- **Full Rebuild**: `npm run test:e2e:rebuild` (for troubleshooting)
- **IMPORTANT**: E2E tests require a development build, NOT Expo Go

### E2E Test Troubleshooting
If E2E tests fail or hang:
1. Run `npm run test:e2e:rebuild` for a full clean rebuild
2. Restart the Expo dev server
3. Kill all iOS simulators and restart them
4. Note: The log box can prevent proper app restart - close it before rerunning tests

## Test Coverage Requirements

### Minimum Coverage: 80%
Apply to:
- **Repositories** - All database operations
- **Stores** - All state management
- **Utilities** - All utility functions

### Coverage Metrics
All four metrics must meet the 80% threshold:
- **Statements** - Individual executable statements
- **Branches** - Conditional branches (if/else)
- **Functions** - Function definitions
- **Lines** - Lines of code

## Branch Strategy

### Required Workflow
1. **Create a new branch** for every feature or bug fix
2. **Never commit directly** to `main` or `master`
3. **Branch naming conventions**:
   - Features: `feature/description`
   - Bug fixes: `bugfix/description`
4. **Merge to main** only after:
   - Feature is complete
   - All tests pass
   - Code has been tested on iOS (primary platform)

## Testing Principles

### Never Skip Failing Tests
- **Don't delete** failing tests
- **Don't skip** failing tests with `.skip()`
- **Don't comment out** failing tests
- **Always fix** the underlying issue

### Don't Work Around Bugs
- Tests should behave like real users
- If a test needs a workaround, the app has a bug
- Fix the bug, don't patch the test

### Test Accessibility
Per `.clinerules`, tests should cover:
- Unit testing
- Integration testing
- Accessibility requirements

## Platform Priorities

### Primary Platform: iOS
- Test iOS first
- E2E tests run on iOS simulator
- Ensure iOS functionality before other platforms

### Platform-Specific Considerations
- Web version has limited functionality (database is no-op)
- Test on physical iOS devices for accurate performance
- Tab bar styling assumes iPhone with home indicator

## Running Commands

**All commands must be run from the `/app` directory:**

```bash
cd app

# TypeScript checking
npx tsc --noEmit

# Unit/Integration tests
npm test
npm run test:coverage
npm run test:watch

# E2E tests
npm run test:e2e:build    # First time or after native changes
npm run test:e2e          # Run all E2E tests
npm run test:e2e:rebuild  # Troubleshooting
```

## Additional Notes

- **No preambles or env configuration** - Test scripts handle all setup
- **Use existing libraries** - Don't reinvent the wheel
- **Don't declare success** until tests pass and goals are met
- **All tests must pass** before committing
