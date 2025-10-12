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

### TestFlight Deployment (`deploy-testflight.yml`)
Builds and submits iOS app to TestFlight for testing.

**Jobs:**
1. **Build & Deploy** (Ubuntu)
   - Generates build info
   - Builds iOS app using EAS Build
   - Auto-submits to TestFlight via App Store Connect
   - Uses `production` build profile by default

**Triggers:**
- Automatic: Pushes to main branch (after CI passes)
- Manual: Via workflow_dispatch with optional build profile selection

**Build Profiles:**
- `production`: App Store distribution with release configuration (default)
- `preview`: App Store distribution for testing, auto-increment build number

## Configuration

### Required Secrets
- `CODECOV_TOKEN` (optional): For uploading test coverage to Codecov
- `EXPO_TOKEN` (required for TestFlight): Expo access token for EAS builds
  - Create at: https://expo.dev/accounts/[username]/settings/access-tokens
  - Or via CLI: `npx eas token:create --name "GitHub Actions"`
  - Add to: https://github.com/[org]/[repo]/settings/secrets/actions

### Environment Requirements
- **Node.js**: 20.x
- **Ruby**: 3.2 (for CocoaPods)
- **Xcode**: 16.1
- **macOS**: 14 (for E2E tests)

### EAS Build Configuration
The TestFlight workflow uses EAS (Expo Application Services) for builds:
- Configured via `app/eas.json`
- Requires App Store Connect API credentials configured in EAS
- To configure credentials: `cd app && npx eas credentials`
- Build status: https://expo.dev/accounts/akin-gulp/projects/migraine-tracker/builds

### Test Commands
The workflows use these npm scripts from `app/package.json`:
- `npm run test:ci` - Jest unit tests in CI mode
- `npm run test:e2e` - Run Detox E2E tests
- `npx detox build --configuration ios.sim.debug` - Build iOS app for Detox testing

### Build Commands
For TestFlight deployments:
- `npm run build:ios` - Build and submit to TestFlight (local, uses production profile)
- `eas build --platform ios --profile production --non-interactive --auto-submit` - CI command

## Local Testing

To run tests locally that match CI:

```bash
cd app

# Type checking
npx tsc --noEmit

# Unit tests
npm run test:ci

# E2E tests (requires iOS simulator)
npx detox build --configuration ios.sim.debug
npm run test:e2e

# TestFlight build (requires EAS credentials)
npm run build:ios
```

## Troubleshooting

### E2E Tests Failing
- Ensure you have Xcode 16.1+ installed
- Install applesimutils: `brew tap wix/brew && brew install applesimutils`
- Check that iPhone 16 Pro Max simulator is available
- Verify CocoaPods are installed: `cd ios && pod install`
- Ensure Metro bundler is running in background during tests

### Build Timeouts
- E2E tests have a 60-minute timeout (20 min for build, 30 min for tests)
- If tests consistently timeout, check for:
  - Simulator startup issues
  - Metro bundler hangs
  - Detox synchronization issues

### TestFlight Build Failures
Common issues:
- **EXPO_TOKEN not set**: Verify secret is added to GitHub repository
- **EAS credentials missing**: Run `cd app && npx eas credentials` to configure
- **App Store Connect API**: Ensure API key is uploaded to EAS
- **Build profile errors**: Check `app/eas.json` configuration
- **Build status**: Monitor at https://expo.dev/accounts/akin-gulp/projects/migraine-tracker/builds

### Artifacts
Test artifacts are uploaded for 7-30 days:
- **PR Tests**: 7 days retention
- **CI**: 30 days retention

Artifacts include:
- Detox screenshots
- Detox logs
- Test coverage reports
