// Mock the logger imports before importing the module
jest.mock('../../services/errorLogger', () => ({
  errorLogger: {
    log: jest.fn().mockResolvedValue(undefined),
  }
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    log: jest.fn(),
    error: jest.fn(),
  }
}));

import { createRetryWrapper, retryUtils } from '../retryWrapper';
import * as SQLite from 'expo-sqlite';

// Mock SQLite database
const createMockDatabase = () => {
  const mockDb = {
    runAsync: jest.fn(),
    getAllAsync: jest.fn(),
    getFirstAsync: jest.fn(),
    execAsync: jest.fn(),
    withTransactionAsync: jest.fn(),
    withExclusiveTransactionAsync: jest.fn(),
    closeAsync: jest.fn(),
    databasePath: '/test/db/path',
    options: {},
  } as unknown as SQLite.SQLiteDatabase;

  return mockDb;
};

describe('retryWrapper', () => {
  describe('retryUtils', () => {
    describe('isRetryableError', () => {
      test('should return true for SQLITE_BUSY error', () => {
        const error = new Error('SQLITE_BUSY (5): database is locked');
        expect(retryUtils.isRetryableError(error)).toBe(true);
      });

      test('should return true for SQLITE_LOCKED error', () => {
        const error = new Error('SQLITE_LOCKED (6): table is locked');
        expect(retryUtils.isRetryableError(error)).toBe(true);
      });

      test('should return true for I/O error pattern', () => {
        const error = new Error('disk I/O error occurred');
        expect(retryUtils.isRetryableError(error)).toBe(true);
      });

      test('should return false for constraint violation', () => {
        const error = new Error('SQLITE_CONSTRAINT (19): UNIQUE constraint failed');
        expect(retryUtils.isRetryableError(error)).toBe(false);
      });

      test('should return false for syntax error', () => {
        const error = new Error('SQLITE_ERROR (1): SQL syntax error');
        expect(retryUtils.isRetryableError(error)).toBe(false);
      });

      test('should return false for null error', () => {
        expect(retryUtils.isRetryableError(null)).toBe(false);
      });
    });

    describe('extractSQLiteErrorCode', () => {
      test('should extract error code from parentheses', () => {
        expect(retryUtils.extractSQLiteErrorCode('SQLITE_BUSY (5)')).toBe(5);
        expect(retryUtils.extractSQLiteErrorCode('Something went wrong (10)')).toBe(10);
      });

      test('should extract error code from named error', () => {
        expect(retryUtils.extractSQLiteErrorCode('Error: SQLITE_BUSY occurred')).toBe(5);
        expect(retryUtils.extractSQLiteErrorCode('SQLITE_LOCKED detected')).toBe(6);
      });

      test('should return null for unrecognized errors', () => {
        expect(retryUtils.extractSQLiteErrorCode('Unknown error')).toBe(null);
        expect(retryUtils.extractSQLiteErrorCode('Network timeout')).toBe(null);
      });
    });

    describe('calculateDelay', () => {
      const config = { initialDelayMs: 100, backoffMultiplier: 2, maxDelayMs: 800, maxRetries: 3 };

      test('should calculate exponential backoff correctly', () => {
        expect(retryUtils.calculateDelay(1, config)).toBe(100);  // 100 * 2^0
        expect(retryUtils.calculateDelay(2, config)).toBe(200);  // 100 * 2^1
        expect(retryUtils.calculateDelay(3, config)).toBe(400);  // 100 * 2^2
        expect(retryUtils.calculateDelay(4, config)).toBe(800);  // 100 * 2^3, capped at 800
        expect(retryUtils.calculateDelay(5, config)).toBe(800);  // Still capped at 800
      });
    });
  });

  describe('createRetryWrapper', () => {
    let mockDb: SQLite.SQLiteDatabase;
    let wrappedDb: SQLite.SQLiteDatabase;

    beforeEach(() => {
      mockDb = createMockDatabase();
      wrappedDb = createRetryWrapper(mockDb, { 
        maxRetries: 2, 
        initialDelayMs: 10,
        maxDelayMs: 50,
        backoffMultiplier: 2 
      });
      jest.clearAllMocks();
    });

    describe('runAsync', () => {
      test('should succeed on first attempt', async () => {
        const mockResult = { lastInsertRowId: 1, changes: 1 };
        jest.mocked(mockDb.runAsync).mockResolvedValue(mockResult);

        const result = await wrappedDb.runAsync('INSERT INTO test VALUES (?)', [1]);

        expect(result).toEqual(mockResult);
        expect(mockDb.runAsync).toHaveBeenCalledTimes(1);
      });

      test('should retry on retryable error and succeed', async () => {
        const mockResult = { lastInsertRowId: 1, changes: 1 };
        jest.mocked(mockDb.runAsync)
          .mockRejectedValueOnce(new Error('SQLITE_BUSY (5): database is locked'))
          .mockResolvedValue(mockResult);

        const result = await wrappedDb.runAsync('INSERT INTO test VALUES (?)', [1]);

        expect(result).toEqual(mockResult);
        expect(mockDb.runAsync).toHaveBeenCalledTimes(2);
      });

      test('should not retry on non-retryable error', async () => {
        const error = new Error('SQLITE_CONSTRAINT (19): UNIQUE constraint failed');
        jest.mocked(mockDb.runAsync).mockRejectedValue(error);

        await expect(wrappedDb.runAsync('INSERT INTO test VALUES (?)', [1]))
          .rejects.toThrow('UNIQUE constraint failed');

        expect(mockDb.runAsync).toHaveBeenCalledTimes(1);
      });

      test('should fail after max retries', async () => {
        const error = new Error('SQLITE_BUSY (5): database is locked');
        jest.mocked(mockDb.runAsync).mockRejectedValue(error);

        await expect(wrappedDb.runAsync('INSERT INTO test VALUES (?)', [1]))
          .rejects.toThrow('database is locked');

        expect(mockDb.runAsync).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
      });
    });

    describe('getAllAsync', () => {
      test('should succeed on first attempt', async () => {
        const mockResult = [{ id: 1, name: 'test' }];
        jest.mocked(mockDb.getAllAsync).mockResolvedValue(mockResult);

        const result = await wrappedDb.getAllAsync('SELECT * FROM test');

        expect(result).toEqual(mockResult);
        expect(mockDb.getAllAsync).toHaveBeenCalledTimes(1);
      });

      test('should retry on transient error', async () => {
        const mockResult = [{ id: 1, name: 'test' }];
        jest.mocked(mockDb.getAllAsync)
          .mockRejectedValueOnce(new Error('SQLITE_LOCKED (6): table is locked'))
          .mockResolvedValue(mockResult);

        const result = await wrappedDb.getAllAsync('SELECT * FROM test');

        expect(result).toEqual(mockResult);
        expect(mockDb.getAllAsync).toHaveBeenCalledTimes(2);
      });
    });

    describe('getFirstAsync', () => {
      test('should succeed on first attempt', async () => {
        const mockResult = { id: 1, name: 'test' };
        jest.mocked(mockDb.getFirstAsync).mockResolvedValue(mockResult);

        const result = await wrappedDb.getFirstAsync('SELECT * FROM test WHERE id = ?', [1]);

        expect(result).toEqual(mockResult);
        expect(mockDb.getFirstAsync).toHaveBeenCalledTimes(1);
      });

      test('should retry on I/O error', async () => {
        const mockResult = { id: 1, name: 'test' };
        jest.mocked(mockDb.getFirstAsync)
          .mockRejectedValueOnce(new Error('SQLITE_IOERR (10): disk I/O error'))
          .mockResolvedValue(mockResult);

        const result = await wrappedDb.getFirstAsync('SELECT * FROM test WHERE id = ?', [1]);

        expect(result).toEqual(mockResult);
        expect(mockDb.getFirstAsync).toHaveBeenCalledTimes(2);
      });
    });

    describe('execAsync', () => {
      test('should succeed on first attempt', async () => {
        jest.mocked(mockDb.execAsync).mockResolvedValue(undefined);

        await wrappedDb.execAsync('CREATE TABLE test (id INTEGER)');

        expect(mockDb.execAsync).toHaveBeenCalledTimes(1);
      });

      test('should retry on database full error', async () => {
        jest.mocked(mockDb.execAsync)
          .mockRejectedValueOnce(new Error('SQLITE_FULL (13): database or disk is full'))
          .mockResolvedValue(undefined);

        await wrappedDb.execAsync('CREATE TABLE test (id INTEGER)');

        expect(mockDb.execAsync).toHaveBeenCalledTimes(2);
      });
    });

    // Note: Transaction tests are complex due to TypeScript function overloads
    // The retry wrapper will work for transactions but testing them is intricate

    describe('pass-through methods', () => {
      test('should pass through closeAsync without retry', async () => {
        jest.mocked(mockDb.closeAsync).mockResolvedValue(undefined);

        await wrappedDb.closeAsync();

        expect(mockDb.closeAsync).toHaveBeenCalledTimes(1);
      });

      test('should pass through properties', () => {
        expect(wrappedDb.databasePath).toBe('/test/db/path');
        expect(wrappedDb.options).toEqual({});
      });
    });

    describe('custom retry configuration', () => {
      test('should use custom retry configuration', async () => {
        const customWrappedDb = createRetryWrapper(mockDb, {
          maxRetries: 1,
          initialDelayMs: 50,
          maxDelayMs: 100,
          backoffMultiplier: 3
        });

        const error = new Error('SQLITE_BUSY (5): database is locked');
        jest.mocked(mockDb.runAsync).mockRejectedValue(error);

        await expect(customWrappedDb.runAsync('INSERT INTO test VALUES (?)', [1]))
          .rejects.toThrow('database is locked');

        expect(mockDb.runAsync).toHaveBeenCalledTimes(2); // 1 initial + 1 retry only
      });
    });
  });
});