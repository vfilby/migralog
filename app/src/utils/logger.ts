/**
 * Development-Only Logger
 *
 * Provides conditional logging that only executes in development mode (__DEV__).
 * In production builds, these calls are no-ops, preventing performance overhead
 * and potential information leakage.
 *
 * Usage:
 *   import { logger } from '../utils/logger';
 *   logger.log('Debug message');
 *   logger.warn('Warning message');
 *   logger.error('Error message');
 */

/* eslint-disable no-console */

export const logger = {
  /**
   * Log informational messages (only in development)
   */
  log: (...args: unknown[]): void => {
    if (__DEV__) {
      console.log(...args);
    }
  },

  /**
   * Log warning messages (only in development)
   */
  warn: (...args: unknown[]): void => {
    if (__DEV__) {
      console.warn(...args);
    }
  },

  /**
   * Log error messages (only in development)
   */
  error: (...args: unknown[]): void => {
    if (__DEV__) {
      console.error(...args);
    }
  },

  /**
   * Log debug messages (only in development)
   */
  debug: (...args: unknown[]): void => {
    if (__DEV__) {
      console.debug(...args);
    }
  },

  /**
   * Log informational messages (only in development)
   * Alias for log()
   */
  info: (...args: unknown[]): void => {
    if (__DEV__) {
      console.info(...args);
    }
  },
};
