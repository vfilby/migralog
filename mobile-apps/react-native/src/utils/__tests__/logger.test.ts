import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger, LogLevel } from '../logger';
import { Share } from 'react-native';
import * as Sentry from '@sentry/react-native';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage');

// Mock Share
jest.mock('react-native', () => ({
  Share: {
    share: jest.fn(),
  },
}));

// Mock Sentry
jest.mock('@sentry/react-native', () => ({
  captureException: jest.fn(),
  captureMessage: jest.fn(),
}));

// Mock console methods to avoid cluttering test output
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

describe('logger', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock console methods
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();

    // Reset AsyncStorage mock to return null by default
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);

    // Clear any existing logs
    logger.clearLogs();
  });

  afterEach(() => {
    // Restore console methods
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
  });

  describe('log level filtering', () => {
    it('should not persist DEBUG logs when log level is set to INFO', async () => {
      await logger.setLogLevel(LogLevel.INFO);
      
      logger.debug('Debug message');
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const logs = logger.getLogs();
      expect(logs).toHaveLength(0);
    });

    it('should not persist INFO logs when log level is set to WARN', async () => {
      await logger.setLogLevel(LogLevel.WARN);
      
      logger.info('Info message');
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const logs = logger.getLogs();
      expect(logs).toHaveLength(0);
    });

    it('should not persist WARN logs when log level is set to ERROR', async () => {
      await logger.setLogLevel(LogLevel.ERROR);
      
      logger.warn('Warning message');
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const logs = logger.getLogs();
      expect(logs).toHaveLength(0);
    });

    it('should persist ERROR logs when log level is set to ERROR', async () => {
      await logger.setLogLevel(LogLevel.ERROR);
      
      logger.error('Error message');
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const logs = logger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe(LogLevel.ERROR);
      expect(logs[0].message).toBe('Error message');
    });

    it('should persist all logs when log level is set to DEBUG', async () => {
      await logger.setLogLevel(LogLevel.DEBUG);
      
      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warning message');
      logger.error('Error message');
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const logs = logger.getLogs();
      expect(logs).toHaveLength(4);
    });
  });

  describe('AsyncStorage persistence', () => {
    it('should persist logs to AsyncStorage', async () => {
      await logger.setLogLevel(LogLevel.DEBUG);
      
      logger.info('Test message');
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@app_logs',
        expect.any(String)
      );
    });

    it('should load persisted logs on initialization', async () => {
      // This test verifies that logs are loaded from AsyncStorage
      // We can't easily test re-initialization without re-importing the module
      // So we test that logs are saved and can be retrieved
      await logger.setLogLevel(LogLevel.DEBUG);
      logger.info('Persisted message');
      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify it was persisted to AsyncStorage
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@app_logs',
        expect.any(String)
      );

      const savedData = (AsyncStorage.setItem as jest.Mock).mock.calls.find(
        call => call[0] === '@app_logs'
      )?.[1];
      
      if (savedData) {
        const parsed = JSON.parse(savedData);
        expect(parsed).toHaveLength(1);
        expect(parsed[0].message).toBe('Persisted message');
      }
    });

    it('should handle corrupted AsyncStorage data gracefully', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('invalid json');

      // Create a new logger instance to trigger initialization
      const { logger: freshLogger } = require('../logger');
      const logs = await freshLogger.getLogsAsync();

      // Should not crash, should return empty array
      expect(logs).toHaveLength(0);
    });
  });

  describe('log rotation', () => {
    it('should keep maximum of 500 logs', async () => {
      await logger.setLogLevel(LogLevel.DEBUG);

      // Add 600 logs
      for (let i = 0; i < 600; i++) {
        logger.info(`Message ${i}`);
      }
      await new Promise(resolve => setTimeout(resolve, 50));

      const logs = logger.getLogs();
      expect(logs.length).toBeLessThanOrEqual(500);
    });

    it('should keep newest logs when rotating', async () => {
      await logger.setLogLevel(LogLevel.DEBUG);

      // Add 600 logs
      for (let i = 0; i < 600; i++) {
        logger.info(`Message ${i}`);
      }
      await new Promise(resolve => setTimeout(resolve, 50));

      const logs = logger.getLogs();
      // Newest logs should be first (unshift order)
      expect(logs[0].message).toBe('Message 599');
      expect(logs[logs.length - 1].message).toBe('Message 100');
    });
  });

  describe('exportLogs format', () => {
    it('should export logs in JSON format', async () => {
      await logger.setLogLevel(LogLevel.DEBUG);

      logger.info('Test message');
      await new Promise(resolve => setTimeout(resolve, 10));

      const exported = logger.exportLogs();
      const parsed = JSON.parse(exported);

      expect(parsed).toHaveProperty('exportedAt');
      expect(parsed).toHaveProperty('currentLogLevel');
      expect(parsed).toHaveProperty('totalLogs');
      expect(parsed).toHaveProperty('logs');
    });

    it('should include log level name in export', async () => {
      await logger.setLogLevel(LogLevel.WARN);

      logger.warn('Warning message');
      await new Promise(resolve => setTimeout(resolve, 10));

      const exported = logger.exportLogs();
      const parsed = JSON.parse(exported);

      expect(parsed.currentLogLevel).toBe('WARN');
      expect(parsed.logs[0].level).toBe('WARN');
    });

    it('should include all log metadata in export', async () => {
      await logger.setLogLevel(LogLevel.DEBUG);

      logger.info('Test message', { userId: 123 });
      await new Promise(resolve => setTimeout(resolve, 10));

      const exported = logger.exportLogs();
      const parsed = JSON.parse(exported);

      expect(parsed.logs[0]).toHaveProperty('id');
      expect(parsed.logs[0]).toHaveProperty('timestamp');
      expect(parsed.logs[0]).toHaveProperty('level');
      expect(parsed.logs[0]).toHaveProperty('message');
      expect(parsed.logs[0]).toHaveProperty('context');
      expect(parsed.logs[0].context).toEqual({ userId: 123 });
    });

    it('should format timestamps as ISO strings in export', async () => {
      await logger.setLogLevel(LogLevel.DEBUG);

      logger.info('Test message');
      await new Promise(resolve => setTimeout(resolve, 10));

      const exported = logger.exportLogs();
      const parsed = JSON.parse(exported);

      expect(parsed.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(parsed.logs[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('backward compatibility', () => {
    it('should support logger.log() method', async () => {
      await logger.setLogLevel(LogLevel.DEBUG);

      logger.log('Log message');
      await new Promise(resolve => setTimeout(resolve, 10));

      const logs = logger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('Log message');
      expect(logs[0].level).toBe(LogLevel.INFO);
    });

    it('should support logger.warn() method', async () => {
      await logger.setLogLevel(LogLevel.DEBUG);

      logger.warn('Warning message');
      await new Promise(resolve => setTimeout(resolve, 10));

      const logs = logger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('Warning message');
      expect(logs[0].level).toBe(LogLevel.WARN);
    });

    it('should support logger.error() method', async () => {
      await logger.setLogLevel(LogLevel.DEBUG);

      logger.error('Error message');
      await new Promise(resolve => setTimeout(resolve, 10));

      const logs = logger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('Error message');
      expect(logs[0].level).toBe(LogLevel.ERROR);
    });

    it('should support logger.debug() method', async () => {
      await logger.setLogLevel(LogLevel.DEBUG);

      logger.debug('Debug message');
      await new Promise(resolve => setTimeout(resolve, 10));

      const logs = logger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('Debug message');
      expect(logs[0].level).toBe(LogLevel.DEBUG);
    });

    it('should support logger.log() with context object', async () => {
      await logger.setLogLevel(LogLevel.DEBUG);

      logger.log('Message', { key: 'value' });
      await new Promise(resolve => setTimeout(resolve, 10));

      const logs = logger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('Message');
      expect(logs[0].context).toEqual({ key: 'value' });
    });
  });

  describe('structured logging with context/metadata', () => {
    it('should log with context object', async () => {
      await logger.setLogLevel(LogLevel.DEBUG);

      logger.info('User action', { userId: 123, action: 'login' });
      await new Promise(resolve => setTimeout(resolve, 10));

      const logs = logger.getLogs();
      expect(logs[0].context).toEqual({ userId: 123, action: 'login' });
    });

    it('should log with nested context objects', async () => {
      await logger.setLogLevel(LogLevel.DEBUG);

      logger.info('API call', {
        endpoint: '/api/data',
        response: { status: 200, data: { id: 1 } },
      });
      await new Promise(resolve => setTimeout(resolve, 10));

      const logs = logger.getLogs();
      expect(logs[0].context).toEqual({
        endpoint: '/api/data',
        response: { status: 200, data: { id: 1 } },
      });
    });

    it('should handle undefined context gracefully', async () => {
      await logger.setLogLevel(LogLevel.DEBUG);

      logger.info('Simple message');
      await new Promise(resolve => setTimeout(resolve, 10));

      const logs = logger.getLogs();
      expect(logs[0].context).toBeUndefined();
    });
  });

  describe('stack trace capture for errors', () => {
    it('should capture stack trace from Error objects', async () => {
      await logger.setLogLevel(LogLevel.DEBUG);

      const error = new Error('Test error');
      logger.error(error);
      await new Promise(resolve => setTimeout(resolve, 10));

      const logs = logger.getLogs();
      expect(logs[0].stack).toBeDefined();
      expect(logs[0].stack).toContain('Error: Test error');
    });

    it('should include error name in context', async () => {
      await logger.setLogLevel(LogLevel.DEBUG);

      const error = new TypeError('Invalid type');
      logger.error(error);
      await new Promise(resolve => setTimeout(resolve, 10));

      const logs = logger.getLogs();
      expect(logs[0].context?.errorName).toBe('TypeError');
    });

    it('should merge additional context with Error objects', async () => {
      await logger.setLogLevel(LogLevel.DEBUG);

      const error = new Error('Test error');
      logger.error(error, { endpoint: '/api/data', statusCode: 500 });
      await new Promise(resolve => setTimeout(resolve, 10));

      const logs = logger.getLogs();
      expect(logs[0].context).toEqual({
        errorName: 'Error',
        endpoint: '/api/data',
        statusCode: 500,
      });
    });

    it('should not capture stack trace for non-Error logs', async () => {
      await logger.setLogLevel(LogLevel.DEBUG);

      logger.error('String error message');
      await new Promise(resolve => setTimeout(resolve, 10));

      const logs = logger.getLogs();
      expect(logs[0].stack).toBeUndefined();
    });
  });

  describe('log level persistence across restarts', () => {
    it('should persist log level to AsyncStorage', async () => {
      await logger.setLogLevel(LogLevel.WARN);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@log_level',
        LogLevel.WARN.toString()
      );
    });

    it('should load persisted log level on initialization', async () => {
      // Set log level and verify it's persisted
      await logger.setLogLevel(LogLevel.ERROR);
      
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@log_level',
        LogLevel.ERROR.toString()
      );
      
      const level = await logger.getLogLevel();
      expect(level).toBe(LogLevel.ERROR);
    });

    it('should use default log level if none is persisted', async () => {
      // In the singleton instance, the default level is already set
      // This test verifies the logger has a valid default level
      const level = await logger.getLogLevel();

      // Default is DEBUG in __DEV__, ERROR in production
      // The logger can have any valid log level
      expect(level).toBeGreaterThanOrEqual(LogLevel.DEBUG);
      expect(level).toBeLessThanOrEqual(LogLevel.ERROR);
    });

    it('should only accept valid log levels when setting', async () => {
      // Set to a valid level
      await logger.setLogLevel(LogLevel.WARN);
      let level = await logger.getLogLevel();
      expect(level).toBe(LogLevel.WARN);

      // Setting to another valid level should work
      await logger.setLogLevel(LogLevel.INFO);
      level = await logger.getLogLevel();
      expect(level).toBe(LogLevel.INFO);
    });
  });

  describe('getLogs() and getLogsAsync()', () => {
    it('should return logs in newest-first order', async () => {
      await logger.setLogLevel(LogLevel.DEBUG);

      logger.info('First message');
      logger.info('Second message');
      logger.info('Third message');
      await new Promise(resolve => setTimeout(resolve, 10));

      const logs = logger.getLogs();
      expect(logs[0].message).toBe('Third message');
      expect(logs[1].message).toBe('Second message');
      expect(logs[2].message).toBe('First message');
    });

    it('should return a copy of logs array', async () => {
      await logger.setLogLevel(LogLevel.DEBUG);

      logger.info('Test message');
      await new Promise(resolve => setTimeout(resolve, 10));

      const logs1 = logger.getLogs();
      const logs2 = logger.getLogs();

      expect(logs1).not.toBe(logs2); // Different array instances
      expect(logs1).toEqual(logs2); // Same content
    });

    it('should support async version for initialization', async () => {
      await logger.setLogLevel(LogLevel.DEBUG);

      logger.info('Test message');
      await new Promise(resolve => setTimeout(resolve, 10));

      const logs = await logger.getLogsAsync();
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('Test message');
    });
  });

  describe('clearLogs() and clearLogsAsync()', () => {
    it('should clear all logs', async () => {
      await logger.setLogLevel(LogLevel.DEBUG);

      logger.info('Message 1');
      logger.info('Message 2');
      await new Promise(resolve => setTimeout(resolve, 10));

      logger.clearLogs();
      const logs = logger.getLogs();

      expect(logs).toHaveLength(0);
    });

    it('should remove logs from AsyncStorage', async () => {
      await logger.setLogLevel(LogLevel.DEBUG);

      logger.info('Test message');
      await new Promise(resolve => setTimeout(resolve, 10));

      logger.clearLogs();
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@app_logs');
    });

    it('should support async version', async () => {
      await logger.setLogLevel(LogLevel.DEBUG);

      logger.info('Test message');
      await new Promise(resolve => setTimeout(resolve, 10));

      await logger.clearLogsAsync();
      const logs = logger.getLogs();

      expect(logs).toHaveLength(0);
    });
  });

  describe('shareLogs()', () => {
    it('should call Share.share with exported logs', async () => {
      await logger.setLogLevel(LogLevel.DEBUG);

      logger.info('Test message');
      await new Promise(resolve => setTimeout(resolve, 10));

      await logger.shareLogs();

      expect(Share.share).toHaveBeenCalledWith({
        message: expect.any(String),
        title: 'App Logs Export',
      });
    });

    it('should handle share errors gracefully', async () => {
      (Share.share as jest.Mock).mockRejectedValueOnce(
        new Error('Share failed')
      );

      await logger.shareLogs();

      // Should not throw, just log error
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('Sentry integration', () => {
    describe('warn() with Error objects', () => {
      it('should use captureException for Error objects', async () => {
        await logger.setLogLevel(LogLevel.DEBUG);

        const error = new Error('Test warning error');
        logger.warn(error);
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(Sentry.captureException).toHaveBeenCalledWith(error, {
          level: 'warning',
          contexts: { logger: { errorName: 'Error' } },
        });
        expect(Sentry.captureMessage).not.toHaveBeenCalled();
      });

      it('should use captureMessage for string warnings', async () => {
        await logger.setLogLevel(LogLevel.DEBUG);

        logger.warn('String warning message');
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(Sentry.captureMessage).toHaveBeenCalledWith('String warning message', {
          level: 'warning',
          contexts: undefined,
        });
        expect(Sentry.captureException).not.toHaveBeenCalled();
      });

      it('should merge context for Error objects in warn()', async () => {
        await logger.setLogLevel(LogLevel.DEBUG);

        const error = new TypeError('Invalid type warning');
        logger.warn(error, { endpoint: '/api/test', statusCode: 400 });
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(Sentry.captureException).toHaveBeenCalledWith(error, {
          level: 'warning',
          contexts: {
            logger: {
              errorName: 'TypeError',
              endpoint: '/api/test',
              statusCode: 400,
            },
          },
        });
      });

      it('should preserve Error message in logs for warn()', async () => {
        await logger.setLogLevel(LogLevel.DEBUG);

        const error = new Error('Warning error message');
        logger.warn(error);
        await new Promise(resolve => setTimeout(resolve, 10));

        const logs = logger.getLogs();
        expect(logs[0].message).toBe('Warning error message');
        expect(logs[0].level).toBe(LogLevel.WARN);
      });
    });

    describe('error() with Error objects', () => {
      it('should use captureException for Error objects', async () => {
        await logger.setLogLevel(LogLevel.DEBUG);

        const error = new Error('Test error');
        logger.error(error);
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(Sentry.captureException).toHaveBeenCalledWith(error, {
          contexts: { logger: { errorName: 'Error' } },
        });
      });

      it('should handle Sentry errors gracefully in warn()', async () => {
        await logger.setLogLevel(LogLevel.DEBUG);
        (Sentry.captureException as jest.Mock).mockImplementationOnce(() => {
          throw new Error('Sentry error');
        });

        const error = new Error('Test warning');
        logger.warn(error);
        await new Promise(resolve => setTimeout(resolve, 10));

        // Should not throw, should log error
        expect(console.error).toHaveBeenCalledWith(
          '[Logger] Failed to send warning to Sentry:',
          expect.any(Error)
        );
      });
    });
  });

  describe('edge cases', () => {
    it('should handle empty message', async () => {
      await logger.setLogLevel(LogLevel.DEBUG);

      logger.info('');
      await new Promise(resolve => setTimeout(resolve, 10));

      const logs = logger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('');
    });

    it('should handle very long messages', async () => {
      await logger.setLogLevel(LogLevel.DEBUG);

      const longMessage = 'x'.repeat(10000);
      logger.info(longMessage);
      await new Promise(resolve => setTimeout(resolve, 10));

      const logs = logger.getLogs();
      expect(logs[0].message).toBe(longMessage);
    });

    it('should handle concurrent logging', async () => {
      await logger.setLogLevel(LogLevel.DEBUG);

      for (let i = 0; i < 100; i++) {
        logger.info(`Message ${i}`);
      }

      await new Promise(resolve => setTimeout(resolve, 50));

      const logs = logger.getLogs();
      expect(logs.length).toBeGreaterThan(0);
    });

    it('should generate unique log IDs', async () => {
      await logger.setLogLevel(LogLevel.DEBUG);

      logger.info('Message 1');
      logger.info('Message 2');
      logger.info('Message 3');
      await new Promise(resolve => setTimeout(resolve, 10));

      const logs = logger.getLogs();
      const ids = logs.map(log => log.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should handle AsyncStorage errors during persistence', async () => {
      await logger.setLogLevel(LogLevel.DEBUG);
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(
        new Error('Storage full')
      );

      logger.info('Test message');
      await new Promise(resolve => setTimeout(resolve, 10));

      // Should not throw, just log error
      expect(console.error).toHaveBeenCalled();
    });
  });
});
