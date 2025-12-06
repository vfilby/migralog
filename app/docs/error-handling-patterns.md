# Error Handling Patterns

This document describes the standard error handling patterns for MigraLog, ensuring consistent error reporting, user-friendly messages, and HIPAA-compliant logging to Sentry.

## Table of Contents
- [Core Principles](#core-principles)
- [Pattern: Service Layer Error Handling](#pattern-service-layer-error-handling)
- [Pattern: UI Error Handling](#pattern-ui-error-handling)
- [Testing Error Handling](#testing-error-handling)
- [Sentry Integration](#sentry-integration)

## Core Principles

### 1. No Silent Failures
- **ALWAYS** log errors (console + Sentry)
- **ALWAYS** provide user feedback (toast, alert, or error state)
- **NEVER** swallow errors without logging or user notification

### 2. Privacy First (HIPAA Compliance)
- Use `errorLogger` or Sentry with privacy scrubbing
- **NEVER** log PHI/PII to console or external services
- Redact sensitive data before logging (medication names, symptoms, etc.)
- See `src/utils/sentryPrivacy.ts` for scrubbing implementation

### 3. Graceful Degradation
- Return null/default values when operations fail
- Provide meaningful error messages to users
- Allow users to retry failed operations

### 4. Context-Rich Logging
- Include relevant IDs (medicationId, episodeId, etc.)
- Add operation context (what was being attempted)
- Use appropriate log levels (error, warning, info)

## Pattern: Service Layer Error Handling

### Template

```typescript
export async function performOperation(
  id: string,
  data: SomeData
): Promise<Result | null> {
  try {
    // Validate inputs
    if (!id || !data) {
      throw new Error('Invalid input: id and data required');
    }

    // Perform operation
    const result = await someAsyncOperation(id, data);

    // Log success
    logger.log('[ServiceName] Operation succeeded', {
      id,
      resultId: result.id,
    });

    return result;
  } catch (error) {
    // 1. Log to Sentry with context (privacy-scrubbed automatically)
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[ServiceName] Operation failed:', {
      id,
      error: errorMessage,
      operation: 'performOperation',
    });

    // 2. Log to local error logger (for diagnostics screen)
    await errorLogger.log(
      'general', // or 'database', 'network', 'storage'
      'Failed to perform operation',
      error instanceof Error ? error : new Error(errorMessage),
      { id, operation: 'performOperation' }
    );

    // 3. Return null to indicate failure (caller handles user notification)
    return null;
  }
}
```

### Example: Notification Scheduling

```typescript
export async function scheduleSingleNotification(
  medication: Medication,
  schedule: MedicationSchedule
): Promise<string | null> {
  try {
    // ... scheduling logic ...
    
    logger.log('[Notification] Scheduled for', medication.name, 'at', schedule.time);
    return notificationId;
  } catch (error) {
    logger.error('[Notification] Error scheduling single notification:', error);
    // Return null - caller will handle user notification
    return null;
  }
}
```

## Pattern: UI Error Handling

### Template

```typescript
const handleAction = async () => {
  try {
    setLoading(true);
    setError(null);

    // Call service layer
    const result = await serviceFunction(id, data);

    // Check for null (indicates service-level error)
    if (!result) {
      throw new Error('Operation failed');
    }

    // Success - update UI
    setData(result);
    
    // Show success feedback
    Toast.show({
      type: 'success',
      text1: 'Success',
      text2: 'Operation completed successfully',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Log error (already logged by service, but add UI context)
    logger.error('[ComponentName] Action failed:', {
      error: errorMessage,
      context: 'user action',
    });
    
    // Set error state for UI
    setError(errorMessage);
    
    // Show user-friendly toast
    Toast.show({
      type: 'error',
      text1: 'Operation Failed',
      text2: 'Please try again or contact support',
    });
  } finally {
    setLoading(false);
  }
};
```

### Example: Medication Tracking Screen

```typescript
const handleLogDose = async () => {
  try {
    setIsLoggingDose(true);

    const dose = await useMedicationStore.getState().logDose({
      medicationId,
      scheduleId,
      timestamp: Date.now(),
      quantity: dosage,
      dosageAmount: medication.dosageAmount,
      dosageUnit: medication.dosageUnit,
      notes: doseNotes,
    });

    if (!dose) {
      throw new Error('Failed to log dose');
    }

    Toast.show({
      type: 'success',
      text1: 'Dose Logged',
      text2: `Logged ${dosage} dose(s)`,
    });

    navigation.goBack();
  } catch (error) {
    logger.error('[MedicationTracking] Failed to log dose:', error);
    
    Toast.show({
      type: 'error',
      text1: 'Failed to Log Dose',
      text2: 'Please try again',
    });
  } finally {
    setIsLoggingDose(false);
  }
};
```

## Testing Error Handling

### Setup

```typescript
import { expectSentryError, expectNoSentryError } from '../../utils/testUtils/sentryTestUtils';

// Mock Sentry
jest.mock('@sentry/react-native', () => ({
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  addBreadcrumb: jest.fn(),
}));

import * as Sentry from '@sentry/react-native';

describe('MyService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Sentry.captureException as jest.Mock).mockClear();
  });

  it('should log error to Sentry on failure', async () => {
    // Arrange
    mockDependency.mockRejectedValue(new Error('Test error'));

    // Act
    const result = await myService.performOperation('id-123');

    // Assert
    expect(result).toBeNull();
    expectSentryError(
      Sentry.captureException as jest.Mock,
      'Test error'
    );
  });

  it('should NOT log to Sentry on success', async () => {
    // Arrange
    mockDependency.mockResolvedValue({ id: 'result-123' });

    // Act
    const result = await myService.performOperation('id-123');

    // Assert
    expect(result).toBeDefined();
    expectNoSentryError(Sentry.captureException as jest.Mock);
  });
});
```

### Test Utilities

Use the utilities from `src/utils/testUtils/sentryTestUtils.ts`:

- `expectSentryError(captureException, messagePattern, options?)` - Assert error was logged
- `expectSentryMessage(captureMessage, messagePattern, level?)` - Assert message was logged
- `expectNoSentryError(captureException)` - Assert no errors were logged
- `expectNoSentryMessage(captureMessage)` - Assert no messages were logged
- `expectSentryBreadcrumb(addBreadcrumb, message?, category?)` - Assert breadcrumb was added
- `getSentryErrorCount(captureException)` - Get count of logged errors
- `getAllSentryErrors(captureException)` - Get all logged errors
- `getAllSentryMessages(captureMessage)` - Get all logged messages

## Sentry Integration

### Configuration

Sentry is configured in `App.tsx` with:
- Privacy scrubbing via `src/utils/sentryPrivacy.ts` (HIPAA compliance)
- Source maps for readable stack traces
- Performance monitoring (10% sample rate in production)
- Session tracking

### When to Use Sentry

**DO use Sentry for:**
- Unexpected errors (exceptions, crashes)
- Service failures (network, database, storage)
- Performance issues (slow operations)
- Critical warnings (quota exceeded, permission denied)

**DON'T use Sentry for:**
- Expected validation errors (user input errors)
- Flow control (using exceptions for logic)
- Debug logging (use `logger.log` instead)
- PHI/PII data (scrubbing should handle this, but avoid if possible)

### Sentry Severity Levels

- `fatal` - App crash or unrecoverable error
- `error` - Operation failed, but app continues
- `warning` - Unexpected condition that should be investigated
- `info` - Informational message (use sparingly)
- `debug` - Debug information (disabled in production)

### Example: Direct Sentry Usage

```typescript
import * as Sentry from '@sentry/react-native';

try {
  await criticalOperation();
} catch (error) {
  // Log to Sentry with context
  Sentry.captureException(error, {
    level: 'error',
    tags: {
      component: 'NotificationService',
      operation: 'scheduleNotification',
    },
    extra: {
      medicationId: '[REDACTED]', // PHI - manually redact
      scheduleId: '[REDACTED]',   // PHI - manually redact
      error: error instanceof Error ? error.message : String(error),
    },
  });
}
```

## Error Categories

Use appropriate error categories when logging to `errorLogger`:

- `database` - Database operations (queries, migrations, corruption)
- `network` - Network requests (API calls, connectivity)
- `storage` - AsyncStorage operations (read/write failures)
- `general` - All other errors

Example:

```typescript
await errorLogger.log(
  'database',
  'Failed to save medication',
  error instanceof Error ? error : new Error(String(error)),
  { medicationId: 'med-123', operation: 'saveMedication' }
);
```

## Common Anti-Patterns to Avoid

### ❌ Silent Failure

```typescript
// BAD - Error is swallowed
try {
  await operation();
} catch (error) {
  // Nothing - user has no idea it failed!
}
```

### ❌ Logging PHI to Sentry

```typescript
// BAD - Medication name is PHI
Sentry.captureException(error, {
  extra: {
    medicationName: medication.name, // ❌ PHI!
  },
});

// GOOD - Redact PHI
Sentry.captureException(error, {
  extra: {
    medicationId: medication.id, // ✅ ID is OK
    // Don't include name
  },
});
```

### ❌ Generic Error Messages

```typescript
// BAD - Not helpful to users
Toast.show({
  type: 'error',
  text1: 'Error',
  text2: 'Something went wrong',
});

// GOOD - Specific and actionable
Toast.show({
  type: 'error',
  text1: 'Failed to Save Medication',
  text2: 'Please check your internet connection and try again',
});
```

### ❌ Not Returning Failure Indicators

```typescript
// BAD - Caller doesn't know it failed
export async function saveData() {
  try {
    await db.save();
  } catch (error) {
    logger.error('Failed to save', error);
    // Missing return statement!
  }
}

// GOOD - Return null to indicate failure
export async function saveData(): Promise<Data | null> {
  try {
    const result = await db.save();
    return result;
  } catch (error) {
    logger.error('Failed to save', error);
    return null; // ✅ Caller can check for failure
  }
}
```

## Resources

- [Sentry React Native Docs](https://docs.sentry.io/platforms/react-native/)
- [Sentry Setup](./sentry-setup.md)
- [Privacy Scrubbing](../src/utils/sentryPrivacy.ts)
- [Error Logger](../src/services/errorLogger.ts)
- [Test Utilities](../src/utils/testUtils/sentryTestUtils.ts)
