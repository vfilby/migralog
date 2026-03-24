/**
 * Shared mock factory for localeUtils module
 *
 * This provides consistent mock implementations for tests that need
 * to isolate date formatting behavior from locale detection.
 *
 * Note: Constants are duplicated here to avoid circular dependencies
 * with the actual localeUtils module during Jest mock hoisting.
 */

import { enUS } from 'date-fns/locale';

// Duplicated constants to avoid circular import during mock setup
const TIME_FORMAT_12H = 'h:mm a';
const TIME_FORMAT_24H = 'HH:mm';
const DATETIME_FORMAT_12H = 'MMM d, yyyy h:mm a';
const DATETIME_FORMAT_24H = 'MMM d, yyyy HH:mm';
const SHORT_DATETIME_FORMAT_12H = 'MMM d, h:mm a';
const SHORT_DATETIME_FORMAT_24H = 'MMM d, HH:mm';

/**
 * Creates a mock for localeUtils configured for US locale (12-hour format)
 *
 * Usage:
 * ```typescript
 * jest.mock('../localeUtils', () =>
 *   require('./mocks/localeUtilsMock').createUSLocaleMock()
 * );
 * ```
 */
export function createUSLocaleMock() {
  return {
    getDeviceLocale: jest.fn(() => enUS),
    getDeviceLocaleCode: jest.fn(() => 'en-US'),
    uses12HourClock: jest.fn(() => true),
    getTimeFormatString: jest.fn(() => TIME_FORMAT_12H),
    getDateTimeFormatString: jest.fn(() => DATETIME_FORMAT_12H),
    getShortDateTimeFormatString: jest.fn(() => SHORT_DATETIME_FORMAT_12H),
    clearLocaleCache: jest.fn(),
    getFormatLocaleOptions: jest.fn(() => ({ locale: enUS })),
    // Export constants so they're available to consuming tests
    TIME_FORMAT_12H,
    TIME_FORMAT_24H,
    DATETIME_FORMAT_12H,
    DATETIME_FORMAT_24H,
    SHORT_DATETIME_FORMAT_12H,
    SHORT_DATETIME_FORMAT_24H,
  };
}

/**
 * Creates a mock for localeUtils configured for 24-hour format (e.g., German locale)
 *
 * Usage:
 * ```typescript
 * jest.mock('../localeUtils', () =>
 *   require('./mocks/localeUtilsMock').create24HourLocaleMock()
 * );
 * ```
 */
export function create24HourLocaleMock() {
  return {
    getDeviceLocale: jest.fn(() => enUS), // Still use enUS for date formatting compatibility
    getDeviceLocaleCode: jest.fn(() => 'de-DE'),
    uses12HourClock: jest.fn(() => false),
    getTimeFormatString: jest.fn(() => TIME_FORMAT_24H),
    getDateTimeFormatString: jest.fn(() => DATETIME_FORMAT_24H),
    getShortDateTimeFormatString: jest.fn(() => SHORT_DATETIME_FORMAT_24H),
    clearLocaleCache: jest.fn(),
    getFormatLocaleOptions: jest.fn(() => ({ locale: enUS })),
    // Export constants so they're available to consuming tests
    TIME_FORMAT_12H,
    TIME_FORMAT_24H,
    DATETIME_FORMAT_12H,
    DATETIME_FORMAT_24H,
    SHORT_DATETIME_FORMAT_12H,
    SHORT_DATETIME_FORMAT_24H,
  };
}
