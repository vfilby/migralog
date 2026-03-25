import { errorLogger, ErrorLog } from '../errorLogger';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage');

describe('errorLogger', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation();

    // Reset the errorLogger state by clearing storage
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);

    // Clear the internal state
    await errorLogger.clearLogs();

    // Reset the initialized flag
    errorLogger['initialized'] = false;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('init', () => {
    it('should load existing logs from storage', async () => {
      const existingLogs: ErrorLog[] = [
        {
          id: 'log-1',
          timestamp: Date.now(),
          type: 'database',
          message: 'Test error',
          stack: 'stack trace',
          context: { key: 'value' },
        },
      ];

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(existingLogs));

      // Create a new instance to test initialization
      const testLogger = new (errorLogger.constructor as any)();
      await testLogger.init();

      const logs = await testLogger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].id).toBe('log-1');
    });

    it('should handle missing storage gracefully', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const testLogger = new (errorLogger.constructor as any)();
      await testLogger.init();

      const logs = await testLogger.getLogs();
      expect(logs).toEqual([]);
    });

    it('should handle storage errors', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

      const testLogger = new (errorLogger.constructor as any)();
      await testLogger.init();

      // Should not throw
      const logs = await testLogger.getLogs();
      expect(logs).toEqual([]);
      
      // Wait for async logger to complete
      await new Promise(resolve => setImmediate(resolve));
       
      expect(console.error).toHaveBeenCalledWith(expect.stringMatching(/^\[.*\] \[ERROR\]$/), 'Failed to load error logs:', { context: expect.any(Error), stack: undefined });
    });

    it('should only initialize once', async () => {
      const testLogger = new (errorLogger.constructor as any)();

      await testLogger.init();
      await testLogger.init();
      await testLogger.init();

      // Should only call getItem once
      expect(AsyncStorage.getItem).toHaveBeenCalledTimes(1);
    });
  });

  describe('log', () => {
    it('should log an error with all fields', async () => {
      const error = new Error('Test error');
      error.stack = 'stack trace here';

      await errorLogger.log('database', 'Database connection failed', error, {
        operation: 'insert',
        table: 'episodes',
      });

      const logs = await errorLogger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        type: 'database',
        message: 'Database connection failed',
        stack: 'stack trace here',
        context: {
          operation: 'insert',
          table: 'episodes',
        },
      });
      expect(logs[0].id).toBeDefined();
      expect(logs[0].timestamp).toBeDefined();
    });

    it('should log an error without error object or context', async () => {
      await errorLogger.log('network', 'Network request failed');

      const logs = await errorLogger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        type: 'network',
        message: 'Network request failed',
      });
      expect(logs[0].stack).toBeUndefined();
      expect(logs[0].context).toBeUndefined();
    });

    it('should add new logs to the beginning of the array', async () => {
      await errorLogger.log('database', 'First error');
      await errorLogger.log('network', 'Second error');
      await errorLogger.log('storage', 'Third error');

      const logs = await errorLogger.getLogs();
      expect(logs[0].message).toBe('Third error');
      expect(logs[1].message).toBe('Second error');
      expect(logs[2].message).toBe('First error');
    });

    it('should trim logs to MAX_LOGS (100)', async () => {
      // Add 105 logs
      for (let i = 0; i < 105; i++) {
        await errorLogger.log('general', `Error ${i}`);
      }

      const logs = await errorLogger.getLogs();
      expect(logs).toHaveLength(100);
      // Most recent should be kept
      expect(logs[0].message).toBe('Error 104');
      // Oldest should be trimmed
      expect(logs[99].message).toBe('Error 5');
    });

    it('should persist logs to AsyncStorage', async () => {
      await errorLogger.log('database', 'Test error');

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@error_logs',
        expect.stringContaining('Test error')
      );
    });

    it('should handle storage persistence errors gracefully', async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error('Storage full'));

      await errorLogger.log('database', 'Test error');

      // Wait for async logger to complete
      await new Promise(resolve => setImmediate(resolve));

      // Should not throw
      expect(console.error).toHaveBeenCalledWith(
        expect.stringMatching(/^\[.*\] \[ERROR\]$/),
        'Failed to persist error logs:',
        { context: expect.any(Error), stack: undefined }
      );
    });

    it('should log to console in development', async () => {
      const error = new Error('Test error');
      const context = { key: 'value' };

      await errorLogger.log('database', 'Test message', error, context);

      // Wait for async logger to complete
      await new Promise(resolve => setImmediate(resolve));

      expect(console.error).toHaveBeenCalledWith(
        expect.stringMatching(/^\[.*\] \[ERROR\]$/),
        '[database] Test message',
        { context: error, stack: undefined }
      );
    });
  });

  describe('getLogs', () => {
    it('should return all logs', async () => {
      await errorLogger.log('database', 'Error 1');
      await errorLogger.log('network', 'Error 2');
      await errorLogger.log('storage', 'Error 3');

      const logs = await errorLogger.getLogs();
      expect(logs).toHaveLength(3);
    });

    it('should initialize if not already initialized', async () => {
      const existingLogs = [
        {
          id: 'log-1',
          timestamp: Date.now(),
          type: 'database' as const,
          message: 'Existing error',
        },
      ];

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(existingLogs));

      const testLogger = new (errorLogger.constructor as any)();
      const logs = await testLogger.getLogs();

      expect(logs).toHaveLength(1);
    });
  });

  describe('clearLogs', () => {
    it('should clear all logs', async () => {
      await errorLogger.log('database', 'Error 1');
      await errorLogger.log('network', 'Error 2');

      await errorLogger.clearLogs();

      const logs = await errorLogger.getLogs();
      expect(logs).toEqual([]);
    });

    it('should remove logs from AsyncStorage', async () => {
      await errorLogger.clearLogs();

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@error_logs');
    });

    it('should handle storage removal errors gracefully', async () => {
      (AsyncStorage.removeItem as jest.Mock).mockRejectedValue(new Error('Removal failed'));

      await errorLogger.clearLogs();

      // Wait for async logger to complete
      await new Promise(resolve => setImmediate(resolve));

      expect(console.error).toHaveBeenCalledWith(expect.stringMatching(/^\[.*\] \[ERROR\]$/), 'Failed to clear error logs:', { context: expect.any(Error), stack: undefined });
       
    });
  });

  describe('getRecentLogs', () => {
    it('should return the most recent N logs', async () => {
      await errorLogger.log('database', 'Error 1');
      await errorLogger.log('network', 'Error 2');
      await errorLogger.log('storage', 'Error 3');
      await errorLogger.log('general', 'Error 4');

      const recent = await errorLogger.getRecentLogs(2);

      expect(recent).toHaveLength(2);
      expect(recent[0].message).toBe('Error 4');
      expect(recent[1].message).toBe('Error 3');
    });

    it('should default to 10 logs if count not specified', async () => {
      for (let i = 0; i < 15; i++) {
        await errorLogger.log('general', `Error ${i}`);
      }

      const recent = await errorLogger.getRecentLogs();

      expect(recent).toHaveLength(10);
    });

    it('should return all logs if count exceeds total', async () => {
      await errorLogger.log('database', 'Error 1');
      await errorLogger.log('network', 'Error 2');

      const recent = await errorLogger.getRecentLogs(10);

      expect(recent).toHaveLength(2);
    });

    it('should initialize if not already initialized', async () => {
      const existingLogs = [
        {
          id: 'log-1',
          timestamp: Date.now(),
          type: 'database' as const,
          message: 'Existing error',
        },
      ];

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(existingLogs));

      const testLogger = new (errorLogger.constructor as any)();
      const logs = await testLogger.getRecentLogs(5);

      expect(logs).toHaveLength(1);
    });
  });

  describe('getLogsByType', () => {
    it('should filter logs by type', async () => {
      await errorLogger.log('database', 'DB Error 1');
      await errorLogger.log('network', 'Network Error 1');
      await errorLogger.log('database', 'DB Error 2');
      await errorLogger.log('storage', 'Storage Error 1');
      await errorLogger.log('database', 'DB Error 3');

      const dbLogs = await errorLogger.getLogsByType('database');

      expect(dbLogs).toHaveLength(3);
      expect(dbLogs.every(log => log.type === 'database')).toBe(true);
    });

    it('should return empty array if no logs of that type exist', async () => {
      await errorLogger.log('database', 'DB Error');
      await errorLogger.log('network', 'Network Error');

      const storageLogs = await errorLogger.getLogsByType('storage');

      expect(storageLogs).toEqual([]);
    });

    it('should support all error types', async () => {
      await errorLogger.log('database', 'Database error');
      await errorLogger.log('network', 'Network error');
      await errorLogger.log('storage', 'Storage error');
      await errorLogger.log('general', 'General error');

      const dbLogs = await errorLogger.getLogsByType('database');
      const netLogs = await errorLogger.getLogsByType('network');
      const storageLogs = await errorLogger.getLogsByType('storage');
      const generalLogs = await errorLogger.getLogsByType('general');

      expect(dbLogs).toHaveLength(1);
      expect(netLogs).toHaveLength(1);
      expect(storageLogs).toHaveLength(1);
      expect(generalLogs).toHaveLength(1);
    });

    it('should initialize if not already initialized', async () => {
      const existingLogs = [
        {
          id: 'log-1',
          timestamp: Date.now(),
          type: 'database' as const,
          message: 'Existing error',
        },
      ];

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(existingLogs));

      const testLogger = new (errorLogger.constructor as any)();
      const logs = await testLogger.getLogsByType('database');

      expect(logs).toHaveLength(1);
    });
  });
});
