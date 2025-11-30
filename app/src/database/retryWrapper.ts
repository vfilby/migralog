import * as SQLite from 'expo-sqlite';
import { errorLogger } from '../services/errorLogger';
import { logger } from '../utils/logger';

/**
 * SQLite error codes that should trigger retry logic
 * These represent transient errors that may resolve on subsequent attempts
 */
const RETRYABLE_ERROR_CODES = [5, 6, 10, 13, 14, 15] as const; // BUSY, LOCKED, IOERR, FULL, CANTOPEN, PROTOCOL

/**
 * Error codes that should NOT trigger retry logic
 * These represent permanent errors that won't be resolved by retrying
 */
const NON_RETRYABLE_ERROR_CODES = [1, 2, 3, 4, 8, 9, 11, 12, 19, 20, 21, 22, 23, 24, 25, 26] as const;

interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 100,
  maxDelayMs: 800,
  backoffMultiplier: 2,
};

/**
 * Determines if an error should be retried based on SQLite error codes
 */
function isRetryableError(error: unknown): boolean {
  if (!error) return false;
  
  // Check if error message contains SQLite error codes
  const errorMessage = (error as Error)?.message || String(error) || '';
  const errorCode = extractSQLiteErrorCode(errorMessage);
  
  if (errorCode !== null) {
    return RETRYABLE_ERROR_CODES.includes(errorCode as typeof RETRYABLE_ERROR_CODES[number]);
  }
  
  // Check for common transient error patterns in message
  const retryablePatterns = [
    /database.*is.*locked/i,
    /table.*is.*locked/i,
    /database.*busy/i,
    /disk.*i\/o.*error/i,
    /temporary.*failure/i,
    /resource.*temporarily.*unavailable/i,
  ];
  
  return retryablePatterns.some(pattern => pattern.test(errorMessage));
}

/**
 * Extracts SQLite error code from error message
 * SQLite errors typically include codes like "SQLITE_BUSY (5)"
 */
function extractSQLiteErrorCode(message: string): number | null {
  // Look for pattern like "SQLITE_BUSY (5)" or just "(5)"
  const codeMatch = message.match(/\((\d+)\)/);
  if (codeMatch) {
    return parseInt(codeMatch[1], 10);
  }
  
  // Look for named error codes
  const errorCodeMappings: Record<string, number> = {
    'SQLITE_BUSY': 5,
    'SQLITE_LOCKED': 6,
    'SQLITE_IOERR': 10,
    'SQLITE_PROTOCOL': 15,
    'SQLITE_FULL': 13,
    'SQLITE_CANTOPEN': 14,
  };
  
  for (const [name, code] of Object.entries(errorCodeMappings)) {
    if (message.includes(name)) {
      return code;
    }
  }
  
  return null;
}

/**
 * Calculates delay for exponential backoff
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
  const delay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt - 1);
  return Math.min(delay, config.maxDelayMs);
}

/**
 * Sleeps for the specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generic retry wrapper function that handles the retry logic
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 1; attempt <= config.maxRetries + 1; attempt++) {
    try {
      const result = await operation();
      
      // Log successful retry if it wasn't the first attempt
      if (attempt > 1) {
        logger.log(`[DatabaseRetry] ${operationName} succeeded on attempt ${attempt}`);
      }
      
      return result;
    } catch (error) {
      lastError = error as Error;
      
      // If this is the last attempt or error is not retryable, throw immediately
      if (attempt > config.maxRetries || !isRetryableError(error)) {
        if (!isRetryableError(error)) {
          logger.log(`[DatabaseRetry] ${operationName} failed with non-retryable error: ${lastError.message}`);
        } else {
          logger.error(`[DatabaseRetry] ${operationName} failed after ${config.maxRetries} retries: ${lastError.message}`);
          
          // Log to error logger for persistent tracking
          await errorLogger.log(
            'database',
            `Database operation failed after retries: ${operationName}`,
            lastError,
            {
              operation: operationName,
              attempts: config.maxRetries + 1,
              retryable: true,
            }
          ).catch(logError => {
            logger.error('[DatabaseRetry] Failed to log retry failure:', logError);
          });
        }
        throw lastError;
      }
      
      // Calculate delay and log retry attempt
      const delay = calculateDelay(attempt, config);
      logger.log(
        `[DatabaseRetry] ${operationName} failed on attempt ${attempt}/${config.maxRetries + 1}, ` +
        `retrying in ${delay}ms: ${lastError.message}`
      );
      
      await sleep(delay);
    }
  }
  
  // This should never be reached due to the loop logic above, but TypeScript needs it
  throw lastError!;
}

/**
 * Helper method to determine operation type from SQL statement
 */
function getOperationType(sql: string): string {
  const trimmed = sql.trim().toLowerCase();
  
  if (trimmed.startsWith('select')) return 'SELECT';
  if (trimmed.startsWith('insert')) return 'INSERT';
  if (trimmed.startsWith('update')) return 'UPDATE';
  if (trimmed.startsWith('delete')) return 'DELETE';
  if (trimmed.startsWith('create')) return 'CREATE';
  if (trimmed.startsWith('drop')) return 'DROP';
  if (trimmed.startsWith('alter')) return 'ALTER';
  if (trimmed.startsWith('pragma')) return 'PRAGMA';
  
  return 'OTHER';
}

/**
 * Creates a retry-wrapped database instance that provides retry logic 
 * for the main SQLite database operations
 */
export function createRetryWrapper(
  database: SQLite.SQLiteDatabase,
  config?: Partial<RetryConfig>
): SQLite.SQLiteDatabase {
  const finalConfig: RetryConfig = {
    ...DEFAULT_RETRY_CONFIG,
    ...config,
  };

  // Create a proxy that intercepts database method calls and adds retry logic
  return new Proxy(database, {
    get(target, prop, receiver) {
      const originalValue = Reflect.get(target, prop, receiver);
      
      // Only wrap the specific methods we want to retry
      if (prop === 'runAsync') {
        return async function(source: string, params?: unknown[]) {
          const operationName = `runAsync(${getOperationType(source)})`;
          return withRetry(
            () => originalValue.call(target, source, params),
            operationName,
            finalConfig
          );
        };
      }
      
      if (prop === 'getAllAsync') {
        return async function<T>(source: string, params?: unknown[]): Promise<T[]> {
          const operationName = 'getAllAsync(SELECT)';
          return withRetry(
            () => originalValue.call(target, source, params),
            operationName,
            finalConfig
          );
        };
      }
      
      if (prop === 'getFirstAsync') {
        return async function<T>(source: string, params?: unknown[]): Promise<T | null> {
          const operationName = 'getFirstAsync(SELECT)';
          return withRetry(
            () => originalValue.call(target, source, params),
            operationName,
            finalConfig
          );
        };
      }
      
      if (prop === 'execAsync') {
        return async function(source: string): Promise<void> {
          const operationName = `execAsync(${getOperationType(source)})`;
          return withRetry(
            () => originalValue.call(target, source),
            operationName,
            finalConfig
          );
        };
      }
      
      if (prop === 'withTransactionAsync') {
        return async function<T>(task: (txn: SQLite.SQLiteDatabase) => Promise<T>): Promise<T> {
          const operationName = 'withTransactionAsync';
          return withRetry(
            () => originalValue.call(target, task),
            operationName,
            finalConfig
          );
        };
      }
      
      if (prop === 'withExclusiveTransactionAsync') {
        return async function<T>(task: (txn: SQLite.SQLiteDatabase) => Promise<T>): Promise<T> {
          const operationName = 'withExclusiveTransactionAsync';
          return withRetry(
            () => originalValue.call(target, task),
            operationName,
            finalConfig
          );
        };
      }
      
      // For all other properties/methods, return as-is
      return originalValue;
    }
  });
}

/**
 * Export error checking functions for testing purposes
 */
export const retryUtils = {
  isRetryableError,
  extractSQLiteErrorCode,
  calculateDelay,
  RETRYABLE_ERROR_CODES,
  NON_RETRYABLE_ERROR_CODES,
};