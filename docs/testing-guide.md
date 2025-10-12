# Testing Guide

## Overview

MigraineTracker uses multiple testing approaches to ensure code quality and functionality:
- **Unit Tests**: Jest with React Native Testing Library
- **E2E Tests**: Detox for automated UI testing

## Running Tests

### Unit Tests (Jest)

```bash
# Run all unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage

# Run tests in CI mode
npm run test:ci
```

### E2E Tests (Detox)

**Important**: E2E tests require a development build, not Expo Go.

```bash
# Build the app for testing (do this first)
npm run test:e2e:build

# Run all E2E tests
npm run test:e2e

# Run specific test suite
npx detox test e2e/episodeLifecycle.test.js --configuration ios.sim.debug
```

## Test Organization

```
app/
├── e2e/                          # End-to-end tests (Detox)
│   ├── episodeLifecycle.test.js  # Episode creation/management tests
│   ├── medicationTracking.test.js # Medication tracking tests
│   ├── dailyStatusTracking.test.js # Daily status tests
│   ├── helpers.js                 # Test helper functions
│   └── jest.config.js            # Detox-specific Jest config
├── src/
│   └── **/__tests__/            # Unit tests alongside source files
└── jest.config.js               # Main Jest configuration
```

## Writing Tests

### Unit Tests

Place unit tests in `__tests__` directories next to the code they test:

```typescript
// src/database/__tests__/episodeRepository.test.ts
import { episodeRepository } from '../episodeRepository';

describe('episodeRepository', () => {
  it('should create an episode', async () => {
    const episode = await episodeRepository.create({
      startTime: Date.now(),
      // ...
    });
    expect(episode.id).toBeDefined();
  });
});
```

### E2E Tests

Place E2E tests in the `e2e/` directory:

```javascript
// e2e/myFeature.test.js
describe('My Feature', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  it('should perform some user action', async () => {
    await element(by.id('my-button')).tap();
    await expect(element(by.text('Expected Result'))).toBeVisible();
  });
});
```

## Test Coverage Goals

- **Unit Tests**: 80%+ coverage for:
  - Database repositories
  - Zustand stores
  - Utility functions
  - Business logic

- **E2E Tests**: Cover critical user flows:
  - Episode lifecycle (create, update, end)
  - Medication tracking
  - Daily status logging
  - Navigation between screens

## CI/CD

Tests run automatically on pull requests via GitHub Actions:
- Unit tests run on every PR
- E2E tests run on labeled PRs or main branch
- Coverage reports are generated and tracked

See `.github/workflows/` for CI configuration.

## Troubleshooting

### E2E Tests Failing

1. **Build not found**: Run `npm run test:e2e:build` first
2. **App crashes**: Check Metro bundler is running with `--clear` flag
3. **Element not found**: Ensure testID props are set correctly
4. **Simulator issues**: Reset simulator or try clean build

### Unit Tests Failing

1. **Database errors**: Check SQLite mocks are set up correctly
2. **Import errors**: Verify Jest configuration includes proper transforms
3. **Async issues**: Ensure proper use of `async/await` and test timeouts

## Resources

- [Jest Documentation](https://jestjs.io/)
- [React Native Testing Library](https://callstack.github.io/react-native-testing-library/)
- [Detox Documentation](https://wix.github.io/Detox/)
