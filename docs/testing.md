# Testing Documentation

## Overview

MigraineTracker uses a comprehensive testing strategy to ensure code quality, reliability, and maintainability. This document outlines our testing approach, tools, and best practices.

## Testing Stack

### Unit & Integration Testing
- **Jest 30.2.0**: JavaScript testing framework
- **@testing-library/react-native 13.3.3**: React Native component testing utilities
- **react-test-renderer 19.1.0**: React renderer for snapshot and component testing

### End-to-End Testing
- **Detox**: React Native E2E testing framework for iOS/Android
- **Device Testing**: Automated testing on real devices and simulators

### Test Coverage Goals
- **Minimum Coverage**: 80% for statements, branches, functions, and lines
- **Current Coverage** (for tested modules):
  - `episodeRepository.ts`: 100% statements, 97.72% branches, 100% functions, 100% lines
  - `episodeStore.ts`: 100% statements, 87.5% branches, 100% functions, 100% lines
  - `painScale.ts`: 100% coverage across all metrics

## Running Tests

### Unit Tests (Jest)

```bash
cd app

# Run all unit tests
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run tests in CI mode (no watch, with coverage)
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

# Rebuild E2E setup if needed
npm run test:e2e:rebuild
```

### Test Organization

```
app/
├── e2e/                          # End-to-end tests (Detox)
│   ├── episodeLifecycle.test.js  # Episode creation/management tests
│   ├── medicationTracking.test.js # Medication tracking tests
│   ├── dailyStatusTracking.test.js # Daily status tests
│   ├── helpers.js                 # Test helper functions
│   └── jest.config.js            # Detox-specific Jest config
├── src/
│   └── **/__tests__/            # Unit tests co-located with source files
│       ├── utils/
│       │   ├── painScale.ts
│       │   └── __tests__/
│       │       └── painScale.test.ts
│       ├── database/
│       │   ├── episodeRepository.ts
│       │   └── __tests__/
│       │       └── episodeRepository.test.ts
│       └── store/
│           ├── episodeStore.ts
│           └── __tests__/
│               └── episodeStore.test.ts
└── jest.config.js               # Main Jest configuration
```

## Test Configuration

### Jest Configuration (`jest.config.js`)

```javascript
module.exports = {
  preset: 'react-native',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)',
  ],
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/__mocks__/**',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
```

### Global Mocks (`jest.setup.js`)

The following dependencies are automatically mocked for all tests:

- **expo-sqlite**: Mocked database operations
- **AsyncStorage**: Mocked persistent storage
- **React Navigation**: Mocked navigation hooks
- **expo-notifications**: Mocked notification APIs
- **expo-location**: Mocked location services

## Writing Tests

### Test Structure

Follow the Arrange-Act-Assert (AAA) pattern:

```typescript
describe('ComponentName', () => {
  describe('methodName', () => {
    it('should do something when condition is met', () => {
      // Arrange: Set up test data and mocks
      const mockData = { id: '123', name: 'Test' };

      // Act: Execute the code being tested
      const result = functionUnderTest(mockData);

      // Assert: Verify the expected outcome
      expect(result).toBe(expectedValue);
    });
  });
});
```

### Unit Testing Best Practices

#### 1. Test Pure Functions

```typescript
import { getPainLevel, getPainColor } from '../painScale';

describe('painScale utilities', () => {
  it('should return correct pain level for value 5', () => {
    const level = getPainLevel(5);
    expect(level.value).toBe(5);
    expect(level.label).toBe('Moderate');
  });

  it('should handle edge cases', () => {
    expect(getPainLevel(-1).value).toBe(0);
    expect(getPainLevel(15).value).toBe(10);
    expect(getPainLevel(NaN).value).toBe(0);
  });
});
```

#### 2. Test Repository Methods

```typescript
import { episodeRepository } from '../episodeRepository';
import * as db from '../db';

jest.mock('../db');

describe('episodeRepository', () => {
  let mockDatabase: any;

  beforeEach(() => {
    mockDatabase = {
      runAsync: jest.fn().mockResolvedValue(undefined),
      getFirstAsync: jest.fn().mockResolvedValue(null),
      getAllAsync: jest.fn().mockResolvedValue([]),
    };

    (db.getDatabase as jest.Mock).mockResolvedValue(mockDatabase);
    (db.generateId as jest.Mock).mockReturnValue('test-id-123');
  });

  it('should create a new episode', async () => {
    const newEpisode = {
      startTime: Date.now(),
      endTime: null,
      locations: ['Head'],
      // ... other fields
    };

    const result = await episodeRepository.create(newEpisode);

    expect(result.id).toBe('test-id-123');
    expect(mockDatabase.runAsync).toHaveBeenCalledTimes(1);
  });
});
```

#### 3. Test Zustand Stores

```typescript
import { useEpisodeStore } from '../episodeStore';
import { episodeRepository } from '../../database/episodeRepository';

jest.mock('../../database/episodeRepository');

describe('episodeStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useEpisodeStore.setState({
      currentEpisode: null,
      episodes: [],
      loading: false,
      error: null,
    });
  });

  it('should load episodes successfully', async () => {
    const mockEpisodes = [{ id: 'ep-1', /* ... */ }];
    (episodeRepository.getAll as jest.Mock).mockResolvedValue(mockEpisodes);

    await useEpisodeStore.getState().loadEpisodes();

    const state = useEpisodeStore.getState();
    expect(state.episodes).toEqual(mockEpisodes);
    expect(state.loading).toBe(false);
  });

  it('should handle errors', async () => {
    (episodeRepository.getAll as jest.Mock).mockRejectedValue(
      new Error('Database error')
    );

    await useEpisodeStore.getState().loadEpisodes();

    expect(useEpisodeStore.getState().error).toBe('Database error');
  });
});
```

### Testing Async Operations

```typescript
it('should set loading state during async operation', async () => {
  (repository.method as jest.Mock).mockImplementation(
    () => new Promise(resolve => setTimeout(() => resolve([]), 100))
  );

  const promise = store.loadData();

  // Check loading state is true
  expect(store.getState().loading).toBe(true);

  await promise;

  // Check loading state is false after completion
  expect(store.getState().loading).toBe(false);
});
```

### Testing Error Handling

```typescript
it('should handle errors gracefully', async () => {
  const error = new Error('Something went wrong');
  (repository.method as jest.Mock).mockRejectedValue(error);

  await expect(store.performAction()).rejects.toThrow('Something went wrong');

  const state = store.getState();
  expect(state.error).toBe('Something went wrong');
  expect(state.loading).toBe(false);
});
```

## Test Coverage

### Viewing Coverage Reports

After running `npm run test:coverage`, open the HTML coverage report:

```bash
open coverage/lcov-report/index.html
```

### Coverage Goals

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

### Coverage Metrics

- **Statements**: Has each statement been executed?
- **Branches**: Has each branch of conditional statements been executed?
- **Functions**: Has each function been called?
- **Lines**: Has each executable line been executed?

### Improving Coverage

1. **Identify Uncovered Code**:
   - Review the coverage report
   - Focus on critical business logic first

2. **Add Missing Tests**:
   - Test edge cases
   - Test error conditions
   - Test boundary values

3. **Refactor for Testability**:
   - Extract complex logic into pure functions
   - Reduce dependencies through dependency injection
   - Use interfaces for better mocking

## Best Practices

### 1. Keep Tests Simple and Focused

✅ **Good**:
```typescript
it('should add two numbers', () => {
  expect(add(2, 3)).toBe(5);
});

it('should handle negative numbers', () => {
  expect(add(-2, 3)).toBe(1);
});
```

❌ **Bad**:
```typescript
it('should do math operations', () => {
  expect(add(2, 3)).toBe(5);
  expect(subtract(5, 3)).toBe(2);
  expect(multiply(2, 3)).toBe(6);
  // Testing too many things at once
});
```

### 2. Use Descriptive Test Names

✅ **Good**:
```typescript
it('should return null when episode is not found', () => {
  // ...
});
```

❌ **Bad**:
```typescript
it('test1', () => {
  // What does this test do?
});
```

### 3. Avoid Test Interdependence

Each test should be independent and not rely on the state from previous tests.

✅ **Good**:
```typescript
beforeEach(() => {
  // Reset state before each test
  useStore.setState({ items: [] });
});
```

❌ **Bad**:
```typescript
it('should add item', () => {
  store.addItem(item1);
  expect(store.items.length).toBe(1);
});

it('should remove item', () => {
  // This assumes the previous test ran first!
  store.removeItem(item1);
  expect(store.items.length).toBe(0);
});
```

### 4. Test Behavior, Not Implementation

Focus on what the code does, not how it does it.

✅ **Good**:
```typescript
it('should filter episodes by date range', () => {
  const result = getEpisodesByDateRange(startDate, endDate);
  expect(result).toHaveLength(3);
  expect(result[0].startTime).toBeGreaterThanOrEqual(startDate);
});
```

❌ **Bad**:
```typescript
it('should call Array.filter', () => {
  const filterSpy = jest.spyOn(Array.prototype, 'filter');
  getEpisodesByDateRange(startDate, endDate);
  expect(filterSpy).toHaveBeenCalled();
  // This tests implementation details, not behavior
});
```

### 5. Use Test Fixtures for Complex Data

```typescript
// testFixtures.ts
export const mockEpisode: Episode = {
  id: 'test-ep-1',
  startTime: 1234567890,
  endTime: null,
  locations: ['Head'],
  qualities: ['Throbbing'],
  symptoms: ['Nausea'],
  triggers: ['Stress'],
  notes: 'Test episode',
  peakIntensity: 7,
  averageIntensity: 5,
  createdAt: 1234567890,
  updatedAt: 1234567890,
};

// In tests
import { mockEpisode } from '../testFixtures';

it('should process episode', () => {
  const result = processEpisode(mockEpisode);
  expect(result).toBeDefined();
});
```

### E2E Testing Best Practices

Place E2E tests in the `e2e/` directory:

```javascript
// e2e/myFeature.test.js
describe('My Feature', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  beforeEach(async () => {
    // Reset app state using deep links
    await device.openURL({ url: 'migralog://reset-for-testing' });
  });

  it('should perform some user action', async () => {
    await element(by.id('my-button')).tap();
    await expect(element(by.text('Expected Result'))).toBeVisible();
  });
});
```

#### E2E Test Patterns

**Navigation Testing**:
```javascript
it('should navigate to episodes screen', async () => {
  await element(by.id('episodes-tab')).tap();
  await expect(element(by.id('episodes-screen'))).toBeVisible();
});
```

**Form Testing**:
```javascript
it('should create new episode', async () => {
  await element(by.id('new-episode-button')).tap();
  await element(by.id('pain-level-slider')).swipe('right');
  await element(by.id('save-episode-button')).tap();
  
  await expect(element(by.text('Episode saved'))).toBeVisible();
});
```

**Data Persistence Testing**:
```javascript
it('should persist data across app restarts', async () => {
  // Create data
  await createTestEpisode();
  
  // Restart app
  await device.terminateApp();
  await device.launchApp();
  
  // Verify data persists
  await expect(element(by.text('Test Episode'))).toBeVisible();
});
```

## Common Testing Patterns

### Testing with Multiple Scenarios

```typescript
describe.each([
  [0, 'No Pain'],
  [5, 'Moderate'],
  [10, 'Debilitating'],
])('getPainLevel(%i)', (value, expectedLabel) => {
  it(`should return "${expectedLabel}"`, () => {
    const result = getPainLevel(value);
    expect(result.label).toBe(expectedLabel);
  });
});
```

### Testing State Changes

```typescript
it('should transition from loading to loaded state', async () => {
  const initialState = store.getState();
  expect(initialState.loading).toBe(false);

  const promise = store.loadData();
  expect(store.getState().loading).toBe(true);

  await promise;
  expect(store.getState().loading).toBe(false);
  expect(store.getState().data).toBeDefined();
});
```

## Continuous Integration

Tests run automatically on pull requests via GitHub Actions:
- Unit tests run on every PR
- E2E tests run on labeled PRs or main branch
- Coverage reports are generated and tracked

See `.github/workflows/` for current CI configuration.

## Troubleshooting

### Common Issues

#### Unit Tests

1. **Tests timing out**
   - **Problem**: Async tests taking too long
   - **Solution**: Increase timeout or fix slow operations
   ```typescript
   it('should complete async operation', async () => {
     jest.setTimeout(10000);
     await slowOperation();
   }, 10000);
   ```

2. **Module not found errors**
   - **Problem**: Import paths not resolving
   - **Solution**: Check `transformIgnorePatterns` in jest.config.js

3. **State persisting between tests**
   - **Problem**: Tests affecting each other
   - **Solution**: Add proper cleanup
   ```typescript
   beforeEach(() => {
     jest.clearAllMocks();
     useStore.setState(initialState);
   });
   ```

#### E2E Tests

1. **Build not found**: Run `npm run test:e2e:build` first
2. **App crashes**: Check Metro bundler is running with `--clear` flag
3. **Element not found**: Ensure testID props are set correctly
4. **Simulator issues**: Reset simulator or try clean build
5. **Tests hanging**: Use `npm run test:e2e:rebuild` to reset Expo server

## Future Enhancements

### Planned Testing Improvements

1. **E2E Testing with Maestro**
   - Test critical user flows
   - Automated UI testing on real devices/simulators

2. **Visual Regression Testing**
   - Screenshot comparison testing
   - Detect unintended UI changes

3. **Performance Testing**
   - Test app startup time
   - Measure render performance
   - Database query performance

4. **Accessibility Testing**
   - Automated a11y checks
   - Screen reader compatibility testing

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Native Testing Library](https://callstack.github.io/react-native-testing-library/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Zustand Testing Guide](https://github.com/pmndrs/zustand#testing)
