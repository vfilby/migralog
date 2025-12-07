/**
 * Error Notification Helper Tests
 * 
 * Tests for the centralized error notification system.
 * Verifies Sentry logging, user notifications, error categorization, and rate limiting.
 */

// Mock dependencies FIRST
jest.mock('expo-notifications');
jest.mock('@sentry/react-native');
jest.mock('../errorLogger', () => ({
  errorLogger: {
    log: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('../../utils/logger', () => ({
  logger: {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

// Import AFTER mocks
import * as Notifications from 'expo-notifications';
import { logger } from '../../utils/logger';
import {
  notifyUserOfError,
  clearRateLimitHistory,
  getRateLimitCount,
} from '../notifications/errorNotificationHelper';

// Setup Notifications mock methods
(Notifications as any).AndroidNotificationPriority = {
  DEFAULT: 0,
  HIGH: 1,
  MAX: 2,
};
// Don't replace the global mock, just use it as-is

describe('Error Notification Helper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    clearRateLimitHistory();
    
    // Configure mocks (after clearAllMocks clears them)
    (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('notif-123');
  });

  describe('Basic Functionality', () => {
    it('ERRHELP-1: should log error when error occurs', async () => {
      // Arrange
      const error = new Error('Test error');
      
      // Act
      await notifyUserOfError('data', 'User message', error);
      
      // Assert - logger.warn is called because data errors are categorized as transient
      expect(logger.warn).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          errorType: 'data',
          component: 'NotificationSystem',
        })
      );
    });

    it('ERRHELP-2: should schedule user notification when error occurs', async () => {
      // Arrange
      const error = new Error('Test error');
      
      // Act
      await notifyUserOfError('data', 'User-friendly message', error);
      
      // Assert
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
        content: expect.objectContaining({
          body: 'User-friendly message',
        }),
        trigger: null, // Immediate
      });
    });

    it('ERRHELP-3: should include full context in error log', async () => {
      // Arrange
      const error = new Error('Test error');
      const context = {
        medicationId: 'med-123',
        scheduleId: 'sched-456',
      };
      
      // Act
      await notifyUserOfError('data', 'User message', error, context);
      
      // Assert - logger.warn is used for transient errors
      expect(logger.warn).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          context,
        })
      );
    });
  });

  describe('Error Categorization', () => {
    it('ERRHELP-CAT1: should categorize data error as catastrophic when data not found', async () => {
      // Arrange
      const error = new Error('Medication not found');
      
      // Act
      await notifyUserOfError('data', undefined, error);
      
      // Assert
      // Catastrophic errors use logger.error
      expect(logger.error).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          severity: 'catastrophic',
        })
      );
    });

    it('ERRHELP-CAT2: should categorize network error as transient', async () => {
      // Arrange
      const error = new Error('Network timeout');
      
      // Act
      await notifyUserOfError('network', undefined, error);
      
      // Assert
      // Transient errors use logger.warn
      expect(logger.warn).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          severity: 'transient',
        })
      );
    });

    it('ERRHELP-CAT3: should categorize data inconsistency as catastrophic', async () => {
      // Arrange
      const error = new Error('Data inconsistency detected');
      
      // Act
      await notifyUserOfError('data', undefined, error);
      
      // Assert
      // Catastrophic errors use logger.error
      expect(logger.error).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          severity: 'catastrophic',
        })
      );
    });

    it('ERRHELP-CAT4: should use high priority for catastrophic errors', async () => {
      // Arrange
      const error = new Error('Data corruption detected');
      
      // Act
      await notifyUserOfError('data', undefined, error);
      
      // Assert
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            priority: Notifications.AndroidNotificationPriority.HIGH,
          }),
        })
      );
    });

    it('ERRHELP-CAT5: should use default priority for transient errors', async () => {
      // Arrange
      const error = new Error('Temporary issue');
      
      // Act
      await notifyUserOfError('network', undefined, error);
      
      // Assert
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            priority: Notifications.AndroidNotificationPriority.DEFAULT,
          }),
        })
      );
    });
  });

  describe('User-Friendly Messages', () => {
    it('ERRHELP-MSG1: should use custom message when provided', async () => {
      // Act
      await notifyUserOfError('data', 'Custom user message');
      
      // Assert
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            body: 'Custom user message',
          }),
        })
      );
    });

    it('ERRHELP-MSG2: should generate default data error message when not provided', async () => {
      // Arrange
      const error = new Error('Medication not found');
      
      // Act
      await notifyUserOfError('data', undefined, error);
      
      // Assert
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            body: expect.stringContaining('problem with your medication data'),
          }),
        })
      );
    });

    it('ERRHELP-MSG3: should generate default network error message', async () => {
      // Act
      await notifyUserOfError('network');
      
      // Assert
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            body: expect.stringContaining('Network error'),
          }),
        })
      );
    });

    it('ERRHELP-MSG4: should not include technical jargon in user messages', async () => {
      // Arrange
      const error = new Error('TypeError: Cannot read property "schedule" of null');
      
      // Act
      await notifyUserOfError('data', undefined, error);
      
      // Assert
      const call = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0][0];
      const userMessage = call.content.body;
      
      // Should not contain technical terms
      expect(userMessage).not.toContain('TypeError');
      expect(userMessage).not.toContain('null');
      expect(userMessage).not.toContain('undefined');
      
      // Should be user-friendly
      expect(userMessage).toMatch(/problem|error|issue/i);
    });
  });

  describe('Rate Limiting', () => {
    it('ERRHELP-RATE1: should allow first notification', async () => {
      // Act
      await notifyUserOfError('data', 'Error 1');
      
      // Assert
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
      expect(getRateLimitCount()).toBe(1);
    });

    it('ERRHELP-RATE2: should allow multiple notifications within limit', async () => {
      // Act - Max is 3 per 5 minutes
      await notifyUserOfError('data', 'Error 1');
      await notifyUserOfError('data', 'Error 2');
      await notifyUserOfError('data', 'Error 3');
      
      // Assert
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(3);
      expect(getRateLimitCount()).toBe(3);
    });

    it('ERRHELP-RATE3: should block notifications when rate limit exceeded', async () => {
      // Act - Max is 3 per 5 minutes, try 4
      await notifyUserOfError('data', 'Error 1');
      await notifyUserOfError('data', 'Error 2');
      await notifyUserOfError('data', 'Error 3');
      await notifyUserOfError('data', 'Error 4'); // Should be blocked
      
      // Assert - Only first 3 notifications should be sent
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(3);
      expect(getRateLimitCount()).toBe(3);
    });

    it('ERRHELP-RATE4: should still log even when rate limited', async () => {
      // Arrange - Fill up rate limit (3 errors per minute)
      await notifyUserOfError('data', 'Error 1');
      await notifyUserOfError('data', 'Error 2');
      await notifyUserOfError('data', 'Error 3');
      
      jest.clearAllMocks(); // Clear previous calls
      
      await notifyUserOfError('data', 'Error 4'); // Rate limited
      
      // Assert - logger should still be called, but not user notification
      expect(logger.error).toHaveBeenCalled();
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('ERRHELP-RATE5: should clear rate limit history on demand', () => {
      // Arrange - Fill up rate limit
      expect(getRateLimitCount()).toBe(0);
      
      // Act
      clearRateLimitHistory();
      
      // Assert
      expect(getRateLimitCount()).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('ERRHELP-ERR1: should not throw when notification scheduling fails', async () => {
      // Arrange
      (Notifications.scheduleNotificationAsync as jest.Mock).mockRejectedValue(
        new Error('Notification permission denied')
      );
      
      // Act & Assert - Should not throw
      await expect(
        notifyUserOfError('data', 'Error message')
      ).resolves.not.toThrow();
    });

    it('ERRHELP-ERR2: should still log when notification fails', async () => {
      // Arrange
      (Notifications.scheduleNotificationAsync as jest.Mock).mockRejectedValue(
        new Error('Notification permission denied')
      );
      
      // Act
      await notifyUserOfError('data', 'Error message');
      
      // Assert - Should log both original error and notification failure
      expect(logger.error).toHaveBeenCalledTimes(2);
    });

    it('ERRHELP-ERR3: should handle non-Error objects', async () => {
      // Act
      await notifyUserOfError('data', 'Error message', 'string error');
      
      // Assert - Should convert to Error (warn is used for transient errors)
      expect(logger.warn).toHaveBeenCalledWith(
        expect.any(Error),
        expect.anything()
      );
    });
  });

  describe('Integration with Error Logger', () => {
    it('ERRHELP-LOG1: should log to local error logger', async () => {
      // Arrange
      const { errorLogger } = require('../errorLogger');
      const error = new Error('Test error');
      
      // Act
      await notifyUserOfError('data', 'Error message', error);
      
      // Assert
      expect(errorLogger.log).toHaveBeenCalledWith(
        'database', // data type maps to database
        'Error message',
        error,
        expect.objectContaining({
          errorType: 'data',
        })
      );
    });

    it('ERRHELP-LOG2: should map network errors to network category', async () => {
      // Arrange
      const { errorLogger } = require('../errorLogger');
      
      // Act
      await notifyUserOfError('network', 'Network error');
      
      // Assert
      expect(errorLogger.log).toHaveBeenCalledWith(
        'network',
        expect.anything(),
        expect.anything(),
        expect.anything()
      );
    });

    it('ERRHELP-LOG3: should map system errors to general category', async () => {
      // Arrange
      const { errorLogger } = require('../errorLogger');
      
      // Act
      await notifyUserOfError('system', 'System error');
      
      // Assert
      expect(errorLogger.log).toHaveBeenCalledWith(
        'general',
        expect.anything(),
        expect.anything(),
        expect.anything()
      );
    });
  });
});
