/**
 * Sentry Test Utilities Tests
 * 
 * Tests for the Sentry testing utilities to ensure they work correctly.
 */

import {
  expectSentryError,
  expectSentryMessage,
  expectNoSentryError,
  expectNoSentryMessage,
  expectSentryBreadcrumb,
  getSentryErrorCount,
  getAllSentryErrors,
  getAllSentryMessages,
} from '../sentryTestUtils';

describe('Sentry Test Utilities', () => {
  describe('expectSentryError', () => {
    it('should pass when captureException was called', () => {
      const mockCaptureException = jest.fn();
      mockCaptureException(new Error('Test error'));

      expect(() => {
        expectSentryError(mockCaptureException);
      }).not.toThrow();
    });

    it('should pass when error message matches string pattern', () => {
      const mockCaptureException = jest.fn();
      mockCaptureException(new Error('Database connection failed'));

      expect(() => {
        expectSentryError(mockCaptureException, 'Database connection');
      }).not.toThrow();
    });

    it('should pass when error message matches regex pattern', () => {
      const mockCaptureException = jest.fn();
      mockCaptureException(new Error('Error 404: Not found'));

      expect(() => {
        expectSentryError(mockCaptureException, /Error \d+:/);
      }).not.toThrow();
    });

    it('should pass when options match', () => {
      const mockCaptureException = jest.fn();
      mockCaptureException(new Error('Test error'), {
        level: 'error',
        tags: { component: 'test' },
        extra: { userId: '123' },
      });

      expect(() => {
        expectSentryError(mockCaptureException, 'Test error', {
          level: 'error',
          tags: { component: 'test' },
          extra: { userId: '123' },
        });
      }).not.toThrow();
    });

    it('should fail when captureException was not called', () => {
      const mockCaptureException = jest.fn();

      expect(() => {
        expectSentryError(mockCaptureException);
      }).toThrow();
    });
  });

  describe('expectSentryMessage', () => {
    it('should pass when captureMessage was called', () => {
      const mockCaptureMessage = jest.fn();
      mockCaptureMessage('Test message');

      expect(() => {
        expectSentryMessage(mockCaptureMessage);
      }).not.toThrow();
    });

    it('should pass when message matches pattern', () => {
      const mockCaptureMessage = jest.fn();
      mockCaptureMessage('User logged in');

      expect(() => {
        expectSentryMessage(mockCaptureMessage, 'logged in');
      }).not.toThrow();
    });

    it('should pass when level matches', () => {
      const mockCaptureMessage = jest.fn();
      mockCaptureMessage('Warning message', 'warning');

      expect(() => {
        expectSentryMessage(mockCaptureMessage, 'Warning', 'warning');
      }).not.toThrow();
    });
  });

  describe('expectNoSentryError', () => {
    it('should pass when captureException was not called', () => {
      const mockCaptureException = jest.fn();

      expect(() => {
        expectNoSentryError(mockCaptureException);
      }).not.toThrow();
    });

    it('should fail when captureException was called', () => {
      const mockCaptureException = jest.fn();
      mockCaptureException(new Error('Test error'));

      expect(() => {
        expectNoSentryError(mockCaptureException);
      }).toThrow();
    });
  });

  describe('expectNoSentryMessage', () => {
    it('should pass when captureMessage was not called', () => {
      const mockCaptureMessage = jest.fn();

      expect(() => {
        expectNoSentryMessage(mockCaptureMessage);
      }).not.toThrow();
    });

    it('should fail when captureMessage was called', () => {
      const mockCaptureMessage = jest.fn();
      mockCaptureMessage('Test message');

      expect(() => {
        expectNoSentryMessage(mockCaptureMessage);
      }).toThrow();
    });
  });

  describe('expectSentryBreadcrumb', () => {
    it('should pass when addBreadcrumb was called', () => {
      const mockAddBreadcrumb = jest.fn();
      mockAddBreadcrumb({ message: 'User clicked button' });

      expect(() => {
        expectSentryBreadcrumb(mockAddBreadcrumb);
      }).not.toThrow();
    });

    it('should pass when message matches', () => {
      const mockAddBreadcrumb = jest.fn();
      mockAddBreadcrumb({
        message: 'User navigated to settings',
        category: 'navigation',
      });

      expect(() => {
        expectSentryBreadcrumb(mockAddBreadcrumb, 'navigated', 'navigation');
      }).not.toThrow();
    });
  });

  describe('getSentryErrorCount', () => {
    it('should return 0 when no errors logged', () => {
      const mockCaptureException = jest.fn();

      expect(getSentryErrorCount(mockCaptureException)).toBe(0);
    });

    it('should return correct count when errors logged', () => {
      const mockCaptureException = jest.fn();
      mockCaptureException(new Error('Error 1'));
      mockCaptureException(new Error('Error 2'));
      mockCaptureException(new Error('Error 3'));

      expect(getSentryErrorCount(mockCaptureException)).toBe(3);
    });
  });

  describe('getAllSentryErrors', () => {
    it('should return empty array when no errors logged', () => {
      const mockCaptureException = jest.fn();

      expect(getAllSentryErrors(mockCaptureException)).toEqual([]);
    });

    it('should return all logged errors', () => {
      const mockCaptureException = jest.fn();
      const error1 = new Error('Error 1');
      const error2 = new Error('Error 2');
      mockCaptureException(error1);
      mockCaptureException(error2);

      const errors = getAllSentryErrors(mockCaptureException);
      expect(errors).toEqual([error1, error2]);
    });
  });

  describe('getAllSentryMessages', () => {
    it('should return empty array when no messages logged', () => {
      const mockCaptureMessage = jest.fn();

      expect(getAllSentryMessages(mockCaptureMessage)).toEqual([]);
    });

    it('should return all logged messages', () => {
      const mockCaptureMessage = jest.fn();
      mockCaptureMessage('Message 1');
      mockCaptureMessage('Message 2');

      const messages = getAllSentryMessages(mockCaptureMessage);
      expect(messages).toEqual(['Message 1', 'Message 2']);
    });
  });
});
