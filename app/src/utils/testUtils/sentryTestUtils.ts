/**
 * Sentry Testing Utilities
 * 
 * Utilities for verifying Sentry error logging in tests.
 * 
 * Usage:
 * ```typescript
 * import { expectSentryError, expectSentryMessage } from '../../utils/testUtils/sentryTestUtils';
 * 
 * // In your test file
 * jest.mock('@sentry/react-native');
 * import * as Sentry from '@sentry/react-native';
 * 
 * describe('MyComponent', () => {
 *   beforeEach(() => {
 *     (Sentry.captureException as jest.Mock).mockClear();
 *     (Sentry.captureMessage as jest.Mock).mockClear();
 *   });
 * 
 *   it('should log error to Sentry', async () => {
 *     // ... trigger error condition
 *     expectSentryError(Sentry.captureException as jest.Mock, 'Expected error message');
 *   });
 * });
 * ```
 */

import type * as Sentry from '@sentry/react-native';

/**
 * Assert that Sentry.captureException was called with an error matching the expected pattern
 * 
 * @param captureException - The mocked Sentry.captureException function
 * @param expectedMessagePattern - String or RegExp to match against error message
 * @param options - Optional Sentry options (level, tags, extra, etc.)
 */
export function expectSentryError(
  captureException: jest.Mock,
  expectedMessagePattern?: string | RegExp,
  options?: {
    level?: Sentry.SeverityLevel;
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
  }
): void {
  expect(captureException).toHaveBeenCalled();

  const calls = captureException.mock.calls;
  const lastCall = calls[calls.length - 1];

  // Check error message if pattern provided
  if (expectedMessagePattern) {
    const error = lastCall[0];
    expect(error).toBeInstanceOf(Error);
    
    if (typeof expectedMessagePattern === 'string') {
      expect(error.message).toContain(expectedMessagePattern);
    } else {
      expect(error.message).toMatch(expectedMessagePattern);
    }
  }

  // Check options if provided
  if (options) {
    const sentryOptions = lastCall[1];

    if (options.level) {
      expect(sentryOptions?.level).toBe(options.level);
    }

    if (options.tags) {
      expect(sentryOptions?.tags).toMatchObject(options.tags);
    }

    if (options.extra) {
      expect(sentryOptions?.extra).toMatchObject(options.extra);
    }
  }
}

/**
 * Assert that Sentry.captureMessage was called with a message matching the expected pattern
 * 
 * @param captureMessage - The mocked Sentry.captureMessage function
 * @param expectedMessagePattern - String or RegExp to match against message
 * @param expectedLevel - Expected Sentry severity level
 */
export function expectSentryMessage(
  captureMessage: jest.Mock,
  expectedMessagePattern?: string | RegExp,
  expectedLevel?: Sentry.SeverityLevel
): void {
  expect(captureMessage).toHaveBeenCalled();

  const calls = captureMessage.mock.calls;
  const lastCall = calls[calls.length - 1];

  // Check message if pattern provided
  if (expectedMessagePattern) {
    const message = lastCall[0];
    
    if (typeof expectedMessagePattern === 'string') {
      expect(message).toContain(expectedMessagePattern);
    } else {
      expect(message).toMatch(expectedMessagePattern);
    }
  }

  // Check level if provided
  if (expectedLevel) {
    const level = lastCall[1];
    expect(level).toBe(expectedLevel);
  }
}

/**
 * Assert that Sentry.captureException was NOT called
 */
export function expectNoSentryError(captureException: jest.Mock): void {
  expect(captureException).not.toHaveBeenCalled();
}

/**
 * Assert that Sentry.captureMessage was NOT called
 */
export function expectNoSentryMessage(captureMessage: jest.Mock): void {
  expect(captureMessage).not.toHaveBeenCalled();
}

/**
 * Assert that a breadcrumb was added to Sentry
 */
export function expectSentryBreadcrumb(
  addBreadcrumb: jest.Mock,
  expectedMessage?: string | RegExp,
  expectedCategory?: string
): void {
  expect(addBreadcrumb).toHaveBeenCalled();

  const calls = addBreadcrumb.mock.calls;
  const lastCall = calls[calls.length - 1];
  const breadcrumb = lastCall[0];

  if (expectedMessage) {
    if (typeof expectedMessage === 'string') {
      expect(breadcrumb.message).toContain(expectedMessage);
    } else {
      expect(breadcrumb.message).toMatch(expectedMessage);
    }
  }

  if (expectedCategory) {
    expect(breadcrumb.category).toBe(expectedCategory);
  }
}

/**
 * Get the number of times Sentry.captureException was called
 */
export function getSentryErrorCount(captureException: jest.Mock): number {
  return captureException.mock.calls.length;
}

/**
 * Get all errors that were sent to Sentry
 */
export function getAllSentryErrors(captureException: jest.Mock): Error[] {
  return captureException.mock.calls.map(call => call[0]);
}

/**
 * Get all messages that were sent to Sentry
 */
export function getAllSentryMessages(captureMessage: jest.Mock): string[] {
  return captureMessage.mock.calls.map(call => call[0]);
}
