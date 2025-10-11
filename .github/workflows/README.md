# GitHub Actions Workflows

This directory contains CI/CD workflows for the MigraineTracker project.

## Workflows

### PR Tests (`pr-tests.yml`)

Runs automatically on pull requests to `main`, `master`, or `develop` branches when files in `app/` are modified.

**Jobs:**
- **Unit Tests** (Ubuntu):
  - TypeScript type checking (`tsc --noEmit`)
  - Jest unit tests with coverage
  - Uploads coverage to Codecov

- **E2E Tests** (macOS-14):
  - Builds iOS app for Detox
  - Runs Detox E2E tests on iOS simulator
  - Uploads test artifacts on failure

- **Lint** (Ubuntu):
  - Runs ESLint checks
  - Non-blocking (continues on error)

### CI (`ci.yml`)

Runs automatically on pushes to `main` or `master` branches when files in `app/` are modified.

**Jobs:**
- **Test Suite** (macOS-14):
  - TypeScript type checking
  - Jest unit tests with coverage
  - Detox E2E tests on iOS simulator
  - Uploads all test artifacts with 30-day retention

## Requirements

### For E2E Tests:
- iOS Simulator (iPhone 15, iOS 17.5)
- Ruby 3.2
- CocoaPods
- Detox configuration

### For Unit Tests:
- Node.js 20
- npm dependencies from `app/package.json`

## Local Testing

To run the same tests locally:

```bash
# Unit tests
cd app
npm run test -- --ci --coverage

# Type checking
cd app
npx tsc --noEmit

# E2E tests
cd app
npx detox build --configuration ios.release
npx detox test --configuration ios.release

# Lint
cd app
npm run lint
```

## Troubleshooting

### E2E Tests Failing
- Check that Detox configuration in `app/.detoxrc.js` is correct
- Verify iOS simulator is available: `xcrun simctl list devices`
- Check pod installation: `cd app/ios && pod install`

### Unit Tests Failing
- Clear node_modules and reinstall: `rm -rf app/node_modules && cd app && npm install`
- Check TypeScript errors: `cd app && npx tsc --noEmit`

### Workflow Not Triggering
- Ensure changes are in `app/` directory or workflow files
- Check branch name matches trigger conditions
- Verify GitHub Actions is enabled for the repository
