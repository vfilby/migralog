# Testing Guide

This document describes the testing patterns, practices, and conventions used in the MigraLog codebase.

## Table of Contents

- [Overview](#overview)
- [Test Types](#test-types)
- [Test Structure](#test-structure)
- [Testing Utilities](#testing-utilities)
- [Common Patterns](#common-patterns)
- [Best Practices](#best-practices)
- [Running Tests](#running-tests)

## Overview

MigraLog uses a comprehensive testing strategy with:
- **Unit tests**: Component and function testing with Jest and React Native Testing Library
- **Integration tests**: Cross-component workflow testing (planned)
- **E2E tests**: Full user journey testing with Detox

### Test Statistics
- **Total tests**: 1,996
- **Passing**: 1,989
- **Skipped**: 7 (documented with reasons)
- **Coverage target**: >70% for all screens

## Test Types

### Unit Tests (`src/**/__tests__/*.test.tsx`)

Test individual components and functions in isolation:

```typescript
describe('AddMedicationScreen', () => {
  describe('Rendering', () => {
    it('should render medication name input', () => {
      renderWithProviders(<AddMedicationScreen {...props} />);
      expect(screen.getByLabelText('Medication Name Input')).toBeTruthy();
    });
  });

  describe('User Interactions', () => {
    it('should save medication when form is valid', async () => {
      // Test implementation
    });
  });

  describe('Form Validation', () => {
    it('should show error for empty medication name', () => {
      // Test implementation
    });
  });

  describe('Error Handling', () => {
    it('should handle save errors gracefully', async () => {
      // Test implementation
    });
  });
});
```

### E2E Tests (`e2e/*.test.js`)

Test complete user workflows in a real device environment:

```javascript
describe('Medication Logging Flow', () => {
  it('should log a medication from notification', async () => {
    await element(by.id('notification-action-log')).tap();
    await expect(element(by.text('Logged'))).toBeVisible();
  });
});
```

## Test Structure

### File Organization

```
src/
  screens/
    __tests__/
      ScreenName.test.tsx       # Screen component tests
  components/
    __tests__/
      ComponentName.test.tsx    # Component tests
  utils/
    __tests__/
      utilName.test.ts          # Utility function tests
  services/
    __tests__/
      serviceName.test.ts       # Service tests
```

### Test Structure Pattern

Organize tests into logical sections using `describe` blocks:

```typescript
describe('ComponentName', () => {
  // Setup
  beforeEach(() => {
    jest.clearAllMocks();
    // Setup test data
  });

  afterEach(() => {
    // Cleanup if needed
  });

  describe('Rendering', () => {
    // Tests for initial render, different states, conditional rendering
  });

  describe('User Interactions', () => {
    // Tests for button presses, form submissions, navigation
  });

  describe('Form Validation', () => {
    // Tests for input validation, error messages
  });

  describe('Error Handling', () => {
    // Tests for error states, error messages, recovery
  });

  describe('Accessibility', () => {
    // Tests for labels, states, keyboard navigation
  });
});
```

## Testing Utilities

### Test Fixtures (`src/utils/testUtils/fixtures.ts`)

Reusable mock objects to reduce duplication:

```typescript
import { createMockNavigation, createMockRoute, createMockMedication } from '../../utils/testUtils/fixtures';

// Create mock navigation
const navigation = createMockNavigation();

// Create mock route with params
const route = createMockRoute('EpisodeDetail', { episodeId: 'ep-123' });

// Create mock medication with overrides
const medication = createMockMedication({ 
  name: 'Ibuprofen', 
  type: 'rescue',
  dosageAmount: 400 
});

// Create multiple mocks
const medications = createMockList(3, createMockMedication, (i) => ({
  name: `Medication ${i + 1}`
}));
```

### Alert Testing (`src/utils/testUtils/alertHelpers.ts`)

Utilities for testing React Native Alert dialogs:

```typescript
import { pressAlertButtonByText, expectAlert, expectAlertButtons } from '../../utils/testUtils/alertHelpers';

// Press a button by its text
fireEvent.press(deleteButton);
await pressAlertButtonByText('Delete');

// Verify alert was shown
expectAlert('Confirm Delete', 'Are you sure?');

// Verify button texts
expectAlertButtons(['Cancel', 'Delete']);
```

### Screen Test Helpers (`src/utils/screenTestHelpers.tsx`)

Render components with required providers:

```typescript
import { renderWithProviders } from '../../utils/screenTestHelpers';

// Automatically wraps with ThemeProvider, NavigationContainer, etc.
const { getByText, getByLabelText } = renderWithProviders(
  <MyScreen navigation={mockNav} route={mockRoute} />
);
```

## Common Patterns

### Async Testing

Use `waitFor` for async operations:

```typescript
it('should load data on mount', async () => {
  renderWithProviders(<MyScreen />);
  
  // Wait for loading to complete
  await waitFor(() => {
    expect(screen.getByText('Data loaded')).toBeTruthy();
  });
});
```

### Controlled Async Testing

For more control over async timing:

```typescript
it('should show loading state', async () => {
  let resolvePromise: (value: Data) => void;
  const loadingPromise = new Promise<Data>((resolve) => {
    resolvePromise = resolve;
  });
  
  mockRepository.getData.mockImplementation(() => loadingPromise);
  
  renderWithProviders(<MyScreen />);
  
  // Test loading state
  expect(screen.getByText('Loading...')).toBeTruthy();
  
  // Resolve the promise
  await act(async () => {
    resolvePromise!(mockData);
  });
  
  // Test loaded state
  await waitFor(() => {
    expect(screen.getByText('Data loaded')).toBeTruthy();
  });
});
```

### Mock Setup

Create clear, reusable mocks:

```typescript
// At top of file
jest.mock('../../services/myService', () => ({
  myService: {
    getData: jest.fn().mockResolvedValue(mockData),
    saveData: jest.fn().mockResolvedValue(undefined),
  },
}));

// In beforeEach
beforeEach(() => {
  jest.clearAllMocks();
  
  // Setup default return values
  (myService.getData as jest.Mock).mockResolvedValue(defaultData);
});

// In specific tests
it('should handle error', async () => {
  (myService.getData as jest.Mock).mockRejectedValue(new Error('Failed'));
  // Test error handling
});
```

### Testing Navigation

```typescript
import { createMockNavigation } from '../../utils/testUtils/fixtures';

it('should navigate to detail screen', () => {
  const navigation = createMockNavigation();
  
  renderWithProviders(<MyScreen navigation={navigation} />);
  
  fireEvent.press(screen.getByText('View Details'));
  
  expect(navigation.navigate).toHaveBeenCalledWith('Detail', {
    id: 'item-123'
  });
});
```

### Testing Forms

```typescript
it('should validate form inputs', async () => {
  renderWithProviders(<MyForm />);
  
  // Test empty field validation
  fireEvent.press(screen.getByText('Save'));
  
  await waitFor(() => {
    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'Please enter a name'
    );
  });
  
  // Fill in form
  fireEvent.changeText(
    screen.getByLabelText('Name Input'),
    'Test Name'
  );
  
  // Submit should succeed
  fireEvent.press(screen.getByText('Save'));
  
  await waitFor(() => {
    expect(mockRepository.save).toHaveBeenCalled();
  });
});
```

## Best Practices

### 1. Test Organization

✅ **DO**: Group related tests in describe blocks
```typescript
describe('Error Handling', () => {
  it('should show error for network failure', () => {});
  it('should show error for validation failure', () => {});
});
```

❌ **DON'T**: Have flat test structure
```typescript
it('should show error for network failure', () => {});
it('should show error for validation failure', () => {});
it('should show loading spinner', () => {});
```

### 2. Test Naming

✅ **DO**: Use descriptive names that explain what is being tested
```typescript
it('should display error message when medication name is empty', () => {});
```

❌ **DON'T**: Use vague or technical names
```typescript
it('test 1', () => {});
it('validation check', () => {});
```

### 3. Mock Management

✅ **DO**: Clear mocks between tests
```typescript
beforeEach(() => {
  jest.clearAllMocks();
});
```

❌ **DON'T**: Let mock state leak between tests
```typescript
// No cleanup - mocks accumulate
```

### 4. Async Handling

✅ **DO**: Use `waitFor` for async operations
```typescript
await waitFor(() => {
  expect(screen.getByText('Success')).toBeTruthy();
});
```

❌ **DON'T**: Use arbitrary timeouts
```typescript
await new Promise(resolve => setTimeout(resolve, 1000));
```

### 5. Accessibility

✅ **DO**: Test accessibility labels and states
```typescript
expect(screen.getByLabelText('Medication Name Input')).toBeTruthy();
expect(button).toHaveAccessibilityState({ disabled: false });
```

❌ **DON'T**: Ignore accessibility in tests
```typescript
// Tests work but accessibility is untested
```

### 6. Test Utilities

✅ **DO**: Use helper utilities for common patterns
```typescript
await pressAlertButtonByText('Delete');
const navigation = createMockNavigation();
```

❌ **DON'T**: Duplicate complex mock setup
```typescript
const alertCalls = (Alert.alert as jest.Mock).mock.calls;
const deleteAlert = alertCalls.find(call => call[0] === 'Delete');
// ... repeated in every test
```

## Running Tests

### Run all tests
```bash
npm run test:ci
```

### Run tests for a specific file
```bash
npx jest src/screens/__tests__/AddMedicationScreen.test.tsx
```

### Run tests in watch mode
```bash
npx jest --watch
```

### Run tests with coverage
```bash
npx jest --coverage
```

### Run E2E tests
```bash
npm run test:e2e
```

### Lint and type-check before committing
```bash
npm run precommit
```

## Troubleshooting

### Tests fail with "Unable to find node on unmounted component"

This indicates an async lifecycle issue. The component is unmounting before async operations complete.

**Solution**: Ensure proper cleanup in components:
```typescript
useEffect(() => {
  let mounted = true;
  
  const loadData = async () => {
    const data = await fetchData();
    if (mounted) {
      setData(data);
    }
  };
  
  loadData();
  
  return () => {
    mounted = false;
  };
}, []);
```

### Tests are flaky or timing-dependent

**Solution**: Use `waitFor` instead of arbitrary delays:
```typescript
// ❌ Flaky
await new Promise(resolve => setTimeout(resolve, 1000));

// ✅ Reliable
await waitFor(() => {
  expect(screen.getByText('Loaded')).toBeTruthy();
}, { timeout: 5000 });
```

### Mocks not working as expected

**Solution**: Ensure mocks are cleared between tests:
```typescript
beforeEach(() => {
  jest.clearAllMocks();
});
```

## Contributing

When adding new tests:

1. Follow the established structure patterns
2. Use existing test utilities when possible
3. Add new utilities to `testUtils/` if you create reusable patterns
4. Ensure tests are isolated and don't depend on execution order
5. Run `npm run precommit` before committing

## Resources

- [React Native Testing Library Docs](https://callstack.github.io/react-native-testing-library/)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Detox Documentation](https://wix.github.io/Detox/)
