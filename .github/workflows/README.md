# GitHub Actions Workflows

This directory contains CI/CD workflows for the MigraineTracker app.

## Workflows

### PR Tests (`pr-tests.yml`)
Runs on every pull request to `main`, `master`, or `develop` branches.

**Jobs:**
1. **Unit Tests** (Ubuntu)
   - Type checking with TypeScript
   - Jest unit tests with coverage
   - Uploads coverage to Codecov (if configured)

2. **E2E Tests** (macOS)
   - Builds iOS app with Expo
   - Runs Detox E2E tests on iPhone simulator
   - Tests include:
     - Episode lifecycle tests
     - Medication tracking tests
     - Daily status tracking tests
   - Uploads test artifacts (screenshots, logs)

3. **Lint** (Ubuntu)
   - Runs ESLint on TypeScript/JavaScript files
   - Configured to continue on error (non-blocking)

**Triggers:**
- Pull requests targeting main/master/develop
- Only when files in `app/` directory change

### CI (`ci.yml`)
Runs on every push to `main` or `master` branches.

**Jobs:**
1. **Test & Build** (macOS)
   - Type checking
   - Unit tests with coverage
   - Full E2E test suite
   - Uploads coverage and test artifacts

**Triggers:**
- Pushes to main/master
- Only when files in `app/` directory change

## Configuration

### Required Secrets
- `CODECOV_TOKEN` (optional): For uploading test coverage to Codecov

### Environment Requirements
- **Node.js**: 20.x
- **Ruby**: 3.2 (for CocoaPods)
- **Xcode**: 15.4
- **macOS**: 14 (for E2E tests)

### Test Commands
The workflows use these npm scripts from `app/package.json`:
- `npm run test:ci` - Jest unit tests in CI mode
- `npm run test:e2e:build` - Build iOS app for Detox testing
- `npm run test:e2e` - Run Detox E2E tests

## Local Testing

To run tests locally that match CI:

```bash
cd app

# Type checking
npx tsc --noEmit

# Unit tests
npm run test:ci

# E2E tests (requires iOS simulator)
npm run test:e2e:build
npm run test:e2e
```

## Troubleshooting

### E2E Tests Failing
- Ensure you have Xcode 15.4+ installed
- Install applesimutils: `brew tap wix/brew && brew install applesimutils`
- Check that iPhone 16 Pro Max simulator is available
- Verify CocoaPods are installed: `cd ios && pod install`

### Build Timeouts
- E2E tests have a 60-minute timeout
- If tests consistently timeout, check for:
  - Simulator startup issues
  - Metro bundler hangs
  - Detox synchronization issues

### Artifacts
Test artifacts are uploaded for 7-30 days:
- **PR Tests**: 7 days retention
- **CI**: 30 days retention

Artifacts include:
- Detox screenshots
- Detox logs
- Test coverage reports
