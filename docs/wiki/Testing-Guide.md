# Testing Guide

Comprehensive testing strategy for MigraineTracker.

## Test Types

### Unit Tests (Jest)

Test individual functions, components, and modules in isolation.

**Location**: `src/**/__tests__/*.test.ts`

**Run**:
```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # With coverage report
```

**Coverage Goals**: 80%+ for repositories, stores, and utilities

**Example**:
```typescript
// src/database/__tests__/episodeRepository.test.ts
describe('episodeRepository', () => {
  it('should create an episode', async () => {
    const episode = await episodeRepository.create({
      startTime: Date.now(),
      peakIntensity: 7,
    });
    expect(episode.id).toBeDefined();
    expect(episode.peakIntensity).toBe(7);
  });
});
```

### Integration Tests (Jest)

Test interactions between multiple modules.

**Example**: Testing store + repository integration

### E2E Tests (Detox)

Test complete user workflows through the UI.

**Location**: `e2e/*.test.js`

**Setup**:
```bash
# Build development app first
npm run test:e2e:build
```

**Run**:
```bash
npm run test:e2e  # Run all E2E tests
npx detox test e2e/episodeLifecycle.test.js  # Run specific test
```

**Important**: E2E tests require a development build, NOT Expo Go!

**Example**:
```javascript
describe('Episode Lifecycle', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  it('should create and end episode', async () => {
    await element(by.id('new-episode-button')).tap();
    await element(by.id('start-episode-button')).tap();
    await expect(element(by.text('Ongoing Episode'))).toBeVisible();
  });
});
```

## Writing Tests

### Best Practices

1. **Use testID props** for E2E element selection:
```tsx
<TouchableOpacity testID="start-episode-button">
```

2. **Mock external dependencies** in unit tests
3. **Test edge cases** and error conditions
4. **Keep tests focused** - one concept per test
5. **Use descriptive test names**

### Test Structure

```typescript
describe('Feature/Component Name', () => {
  // Setup
  beforeAll(() => {
    // Runs once before all tests
  });

  beforeEach(() => {
    // Runs before each test
  });

  // Tests
  it('should do something specific', () => {
    // Arrange
    // Act
    // Assert
  });

  // Cleanup
  afterEach(() => {
    // Runs after each test
  });

  afterAll(() => {
    // Runs once after all tests
  });
});
```

## Test Organization

```
app/
├── e2e/                              # E2E tests
│   ├── episodeLifecycle.test.js
│   ├── medicationTracking.test.js
│   ├── dailyStatusTracking.test.js
│   ├── helpers.js
│   └── jest.config.js
├── src/
│   ├── database/
│   │   ├── __tests__/               # Unit tests
│   │   │   ├── episodeRepository.test.ts
│   │   │   └── medicationRepository.test.ts
│   │   └── episodeRepository.ts
│   ├── store/
│   │   ├── __tests__/
│   │   │   └── episodeStore.test.ts
│   │   └── episodeStore.ts
│   └── ...
└── jest.config.js
```

## CI/CD

Tests run automatically in GitHub Actions:

- **On every PR**: Unit tests + coverage
- **On main branch**: Full test suite including E2E

See `.github/workflows/` for configuration.

## Troubleshooting

### E2E Tests Failing

**Problem**: `device is not defined`
**Solution**: E2E tests must be run with Detox, not regular Jest:
```bash
npm run test:e2e
```

**Problem**: App crashes or doesn't load
**Solution**:
1. Clear bundler cache: `npm start -- --clear`
2. Rebuild app: `npm run test:e2e:build`
3. Reset simulator

**Problem**: Element not found
**Solution**:
1. Check testID is correct and element is rendered
2. Add waitFor timeout:
```javascript
await waitFor(element(by.id('my-element')))
  .toBeVisible()
  .withTimeout(5000);
```

### Unit Tests Failing

**Problem**: SQLite errors in tests
**Solution**: Ensure database is properly mocked in `jest.setup.js`

**Problem**: Async test timeout
**Solution**: Increase timeout or ensure promises are resolved:
```typescript
it('should work', async () => {
  await someAsyncOperation();
}, 10000); // 10 second timeout
```

## Coverage Reports

View coverage after running:
```bash
npm run test:coverage
open coverage/lcov-report/index.html
```

Coverage is tracked for:
- Line coverage
- Branch coverage
- Function coverage
- Statement coverage

## Testing Checklist

Before committing:
- [ ] All unit tests pass
- [ ] New code has tests
- [ ] Coverage meets 80% threshold
- [ ] E2E tests pass (if UI changed)
- [ ] No console errors or warnings
- [ ] Types check: `npx tsc --noEmit`

## Resources

- [Jest Documentation](https://jestjs.io/)
- [React Native Testing Library](https://callstack.github.io/react-native-testing-library/)
- [Detox Documentation](https://wix.github.io/Detox/)
